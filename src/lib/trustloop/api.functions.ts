import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { runModel, type ModelKey } from "@/lib/ml/engine";
import { buildFeatureVector, type CategoryRow, type CustomerRow, type OrderRow } from "./features";
import { evaluatePolicy } from "./policy";
import { analyseBehaviour } from "./behaviour";
import { decide, fuseEvidence } from "./fusion";
import type { VisionResult } from "./vision-types";
import type { ConditionCode, ReasonCode } from "./domain";
import type { Json } from "@/integrations/supabase/types";
import categoriesSample from "./data/categories.json";
import customersSample from "./data/customers_sample.json";
import ordersSample from "./data/orders_sample.json";

const json = (value: unknown) => value as Json;

const BUCKET = "return-evidence";

async function db() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

const reasonEnum = z.enum([
  "DAMAGED",
  "DEFECTIVE",
  "WRONG_ITEM",
  "NOT_AS_DESCRIBED",
  "SIZE_FIT",
  "LATE_DELIVERY",
  "CHANGED_MIND",
]);
const conditionEnum = z.enum(["UNOPENED", "LIKE_NEW", "USED", "DAMAGED"]);

/* --------------------------------- lookups --------------------------------- */

export const searchOrders = createServerFn({ method: "GET" })
  .validator((d: unknown) => z.object({ query: z.string().max(80).optional() }).parse(d))
  .handler(async ({ data }) => {
    const qTerm = data.query?.trim().toLowerCase() || "";
    try {
      const supabase = await db();
      let q = supabase
        .from("orders")
        .select(
          "id, external_id, total_price, purchased_at, delivered_at, review_score, num_items, category_code, customers(external_id, city, state, total_orders)",
        )
        .order("purchased_at", { ascending: false })
        .limit(30);
      if (qTerm) q = q.ilike("external_id", `%${qTerm}%`);
      const { data: rows, error } = await q;
      if (!error && rows && rows.length > 0) return rows;
    } catch {
      // Supabase table empty or offline, fall through to bundled dataset
    }

    if (!qTerm) {
      return (ordersSample as any[]).slice(0, 30);
    }
    return (ordersSample as any[])
      .filter((o) => {
        const ext = (o.external_id || "").toLowerCase();
        const city = (o.customers?.city || "").toLowerCase();
        const state = (o.customers?.state || "").toLowerCase();
        return ext.includes(qTerm) || city.includes(qTerm) || state.includes(qTerm);
      })
      .slice(0, 30);
  });

/* --------------------------------- analysis -------------------------------- */

export const submitReturn = createServerFn({ method: "POST" })
  .validator((d: unknown) =>
    z
      .object({
        orderId: z.string().uuid(),
        reason: reasonEnum,
        condition: conditionEnum,
        description: z.string().max(1000).optional(),
        model: z.enum(["xgboost", "logistic_regression", "decision_tree"]).default("xgboost"),
        image: z
          .object({
            base64: z.string().max(11_000_000),
            contentType: z.enum(["image/jpeg", "image/png", "image/webp", "image/svg+xml"]),
            byteSize: z
              .number()
              .int()
              .positive()
              .max(8 * 1024 * 1024),
          })
          .nullable()
          .optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const supabase = await db();
    const audit: { stage: string; summary: string; payload: Record<string, unknown> }[] = [];

    // 1. Load the order, customer and category context.
    let orderRow: OrderRow | null = null;
    let customerRow: CustomerRow | null = null;
    let categoryRow: CategoryRow | null = null;

    try {
      const { data: order } = await supabase
        .from("orders")
        .select("*")
        .eq("id", data.orderId)
        .maybeSingle();

      if (order) {
        const [{ data: customer }, { data: category }] = await Promise.all([
          supabase.from("customers").select("*").eq("id", order.customer_id).maybeSingle(),
          supabase.from("product_categories").select("*").eq("code", order.category_code).maybeSingle(),
        ]);
        if (customer && category) {
          orderRow = order as unknown as OrderRow;
          customerRow = customer as unknown as CustomerRow;
          categoryRow = category as unknown as CategoryRow;
        }
      }
    } catch {
      // continue to fallback
    }

    if (!orderRow) {
      const foundOrder = (ordersSample as any[]).find(
        (o) => o.id === data.orderId || o.external_id === data.orderId,
      );
      if (foundOrder) {
        const foundCustomer = (customersSample as any[]).find(
          (c) => c.id === foundOrder.customer_id || c.external_id === foundOrder.customer_id,
        );
        const foundCategory = (categoriesSample as any[]).find(
          (c) => c.code === foundOrder.category_code,
        );
        orderRow = foundOrder as unknown as OrderRow;
        customerRow = foundCustomer as unknown as CustomerRow;
        categoryRow = foundCategory as unknown as CategoryRow;

        // Try ensuring they exist in Supabase database so foreign keys on return_requests work
        try {
          if (categoryRow) {
            await supabase.from("product_categories").upsert(categoryRow, { onConflict: "code" });
          }
          if (customerRow) {
            await supabase.from("customers").upsert(customerRow, { onConflict: "external_id" });
          }
          if (orderRow) {
            const { customers: _, ...cleanOrder } = orderRow as any;
            await supabase.from("orders").upsert(cleanOrder, { onConflict: "external_id" });
          }
        } catch {
          // ignore
        }
      }
    }

    if (!orderRow || !customerRow || !categoryRow) {
      throw new Error("Order not found or order context is incomplete");
    }

    audit.push({
      stage: "intake",
      summary: `Return request accepted for order ${orderRow.external_id}.`,
      payload: { reason: data.reason, condition: data.condition, hasImage: Boolean(data.image) },
    });

    // 2. Create the return request row.
    const reference = `TL-${Date.now().toString(36).toUpperCase()}`;
    const { data: created, error: createError } = await supabase
      .from("return_requests")
      .insert({
        reference,
        order_id: orderRow.id,
        reason_code: data.reason,
        claimed_condition: data.condition,
        description: data.description ?? null,
        status: "ANALYSED",
      })
      .select("id, reference")
      .single();
    if (createError) throw new Error(createError.message);
    const returnId = created.id;

    // 3. Feature construction + model inference.
    const features = buildFeatureVector(orderRow, customerRow, categoryRow);
    const model = runModel(features, data.model as ModelKey);
    audit.push({
      stage: "model",
      summary: `${model.modelLabel} scored ${(model.riskScore * 100).toFixed(1)}% return risk (${model.riskLevel}).`,
      payload: { model: model.model, riskScore: model.riskScore },
    });

    // 4. Policy.
    const policy = evaluatePolicy(
      orderRow,
      data.reason as ReasonCode,
      data.condition as ConditionCode,
    );
    audit.push({
      stage: "policy",
      summary: policy.eligible ? "Policy rules passed." : "Policy rules blocked the return.",
      payload: { eligible: policy.eligible, windowDaysRemaining: policy.windowDaysRemaining },
    });

    // 5. Evidence image + vision.
    let vision: VisionResult | null = null;
    let imageId: string | null = null;
    if (data.image) {
      const ext = data.image.contentType.includes("svg") ? "svg" : data.image.contentType.split("/")[1] || "jpg";
      const path = `${returnId}/evidence.${ext}`;
      const rawBase64 = data.image.base64.includes("::")
        ? data.image.base64.split("::")[0]!
        : data.image.base64.includes(",")
          ? data.image.base64.split(",")[1]!
          : data.image.base64;

      try {
        const bytes = Uint8Array.from(atob(rawBase64), (c) => c.charCodeAt(0));
        await supabase.storage
          .from(BUCKET)
          .upload(path, bytes, { contentType: data.image.contentType, upsert: true });
      } catch (uploadErr) {
        console.warn("Storage upload non-fatal warning:", uploadErr);
      }

      const { data: imageRow } = await supabase
        .from("return_images")
        .insert({
          return_id: returnId,
          storage_path: path,
          content_type: data.image.contentType,
          byte_size: data.image.byteSize,
        })
        .select("id")
        .single();
      imageId = imageRow?.id ?? null;

      const { analyseImage } = await import("./vision.server");
      vision = await analyseImage({
        base64: data.image.base64,
        contentType: data.image.contentType,
        reason: data.reason,
        claimedCondition: data.condition,
        productCategory: categoryRow.name,
        description: data.description ?? null,
      });

      await supabase.from("vision_analyses").insert({
        return_id: returnId,
        image_id: imageId,
        provider: vision.provider,
        model: vision.model,
        is_fallback: vision.isFallback,
        observed_condition: vision.observedCondition,
        damage_score: vision.damageScore,
        matches_claim: vision.matchesClaim,
        findings: json(vision.findings),
        summary: vision.summary,
      });
      audit.push({
        stage: "vision",
        summary: vision.isFallback
          ? "Image analysis unavailable; photo not assessed."
          : `Image analysed: ${vision.summary}`,
        payload: { matchesClaim: vision.matchesClaim, damageScore: vision.damageScore },
      });
    }

    // 6. Behaviour.
    const behaviour = analyseBehaviour(customerRow, orderRow);
    audit.push({
      stage: "behaviour",
      summary: `Account behaviour concern ${(behaviour.behaviourScore * 100).toFixed(0)}%.`,
      payload: { behaviourScore: behaviour.behaviourScore },
    });

    // 7. Fusion + decision.
    const fusion = fuseEvidence({
      model,
      policy,
      behaviour,
      vision,
      reason: data.reason as ReasonCode,
    });
    const decision = decide({
      fusion,
      policy,
      model,
      vision,
      orderValue: Number(orderRow.total_price),
    });
    audit.push({
      stage: "fusion",
      summary: `Trust score ${fusion.trustScore}/100 with ${(fusion.agreement * 100).toFixed(0)}% source agreement.`,
      payload: { trustScore: fusion.trustScore, conflicts: fusion.conflicts.length },
    });
    audit.push({
      stage: "decision",
      summary: `System decision: ${decision.outcome}.`,
      payload: { outcome: decision.outcome, confidence: decision.confidence },
    });

    // 8. Persist every stage.
    await Promise.all([
      supabase.from("predictions").insert({
        return_id: returnId,
        model_key: model.model,
        model_label: model.modelLabel,
        risk_score: model.riskScore,
        risk_level: model.riskLevel,
        confidence: model.confidence,
        contributions: json(model.contributions),
        feature_vector: json(features),
      }),
      supabase.from("policy_evaluations").insert({
        return_id: returnId,
        eligible: policy.eligible,
        window_days_remaining: policy.windowDaysRemaining,
        rules: json(policy.rules),
      }),
      supabase.from("behaviour_signals").insert({
        return_id: returnId,
        behaviour_score: behaviour.behaviourScore,
        signals: json(behaviour.signals),
      }),
      supabase.from("fusion_results").insert({
        return_id: returnId,
        trust_score: fusion.trustScore,
        agreement: fusion.agreement,
        evidence: json(fusion.evidence),
        conflicts: json(fusion.conflicts),
      }),
      supabase.from("decisions").insert({
        return_id: returnId,
        outcome: decision.outcome,
        source: "SYSTEM",
        confidence: decision.confidence,
        rationale: json(decision.rationale),
      }),
    ]);

    await supabase
      .from("return_requests")
      .update({
        status: decision.outcome === "MANUAL_REVIEW" ? "IN_REVIEW" : "ANALYSED",
        updated_at: new Date().toISOString(),
      })
      .eq("id", returnId);

    await supabase.from("audit_events").insert(
      audit.map((a) => ({
        return_id: returnId,
        stage: a.stage,
        summary: a.summary,
        payload: json(a.payload),
      })),
    );

    return { returnId, reference: created.reference, outcome: decision.outcome };
  });

/* ------------------------------- trust passport ----------------------------- */

export const getReturn = createServerFn({ method: "GET" })
  .validator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const supabase = await db();
    const { data: request, error } = await supabase
      .from("return_requests")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!request) return null;

    // Attach order, customer, and category context
    const foundOrder = (ordersSample as any[]).find((o) => o.id === request.order_id);
    const foundCustomer = foundOrder
      ? (customersSample as any[]).find((c) => c.id === foundOrder.customer_id)
      : null;
    const foundCategory = foundOrder
      ? (categoriesSample as any[]).find((c) => c.code === foundOrder.category_code)
      : null;

    (request as any).orders = foundOrder
      ? {
          ...foundOrder,
          customers: foundCustomer,
          product_categories: foundCategory,
        }
      : null;

    const [prediction, policy, behaviour, fusion, decisions, vision, images, reviews, events] =
      await Promise.all([
        supabase
          .from("predictions")
          .select("*")
          .eq("return_id", data.id)
          .order("created_at")
          .limit(1)
          .maybeSingle(),
        supabase.from("policy_evaluations").select("*").eq("return_id", data.id).maybeSingle(),
        supabase.from("behaviour_signals").select("*").eq("return_id", data.id).maybeSingle(),
        supabase.from("fusion_results").select("*").eq("return_id", data.id).maybeSingle(),
        supabase
          .from("decisions")
          .select("*")
          .eq("return_id", data.id)
          .order("created_at", { ascending: false }),
        supabase.from("vision_analyses").select("*").eq("return_id", data.id).maybeSingle(),
        supabase.from("return_images").select("*").eq("return_id", data.id),
        supabase
          .from("human_reviews")
          .select("*")
          .eq("return_id", data.id)
          .order("created_at", { ascending: false }),
        supabase.from("audit_events").select("*").eq("return_id", data.id).order("created_at"),
      ]);

    let imageUrl: string | null = null;
    const path = images.data?.[0]?.storage_path;
    if (path) {
      try {
        const { data: signed } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60 * 30);
        imageUrl = signed?.signedUrl ?? null;
      } catch {
        // storage fallback
      }
    }

    return {
      request,
      prediction: prediction.data,
      policy: policy.data,
      behaviour: behaviour.data,
      fusion: fusion.data,
      decisions: decisions.data ?? [],
      vision: vision.data,
      imageUrl,
      reviews: reviews.data ?? [],
      events: events.data ?? [],
    };
  });

/* --------------------------------- queues ---------------------------------- */

export const listReturns = createServerFn({ method: "GET" })
  .validator((d: unknown) =>
    z
      .object({
        onlyReviewable: z.boolean().default(false),
        limit: z.number().int().min(1).max(100).default(50),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const supabase = await db();
    const { data: rows, error } = await supabase
      .from("return_requests")
      .select(
        "id, reference, reason_code, claimed_condition, status, created_at, order_id, predictions(risk_score, risk_level, model_label), fusion_results(trust_score, agreement), decisions(outcome, source, confidence, created_at)",
      )
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (error) throw new Error(error.message);

    const mapped = (rows ?? []).map((r) => {
      const order = (ordersSample as any[]).find((o) => o.id === (r as any).order_id);
      const decisions = [
        ...((r.decisions as {
          outcome: string;
          source: string;
          confidence: number;
          created_at: string;
        }[]) ?? []),
      ].sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
      return {
        id: r.id,
        reference: r.reference,
        reason: r.reason_code,
        condition: r.claimed_condition,
        status: r.status,
        createdAt: r.created_at,
        orderRef: order?.external_id ?? "",
        orderValue: Number(order?.total_price ?? 0),
        riskScore: Number((r.predictions as { risk_score: number }[] | null)?.[0]?.risk_score ?? 0),
        riskLevel: (r.predictions as { risk_level: string }[] | null)?.[0]?.risk_level ?? "LOW",
        trustScore: Number(
          (r.fusion_results as { trust_score: number }[] | null)?.[0]?.trust_score ?? 0,
        ),
        currentDecision: decisions[0]?.outcome ?? "MANUAL_REVIEW",
        decisionSource: decisions[0]?.source ?? "SYSTEM",
        decidedByHuman: decisions.some((d) => d.source === "HUMAN"),
      };
    });

    return data.onlyReviewable
      ? mapped.filter((m) => m.currentDecision === "MANUAL_REVIEW" && !m.decidedByHuman)
      : mapped;
  });

/* --------------------------------- review ---------------------------------- */

export const submitReview = createServerFn({ method: "POST" })
  .validator((d: unknown) =>
    z
      .object({
        returnId: z.string().uuid(),
        reviewerName: z.string().min(2).max(60),
        verdict: z.enum(["AUTO_APPROVE", "MANUAL_REVIEW", "REFUND_ON_INSPECTION", "DECLINE"]),
        notes: z.string().max(1000).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const supabase = await db();
    const { data: current } = await supabase
      .from("decisions")
      .select("id, outcome")
      .eq("return_id", data.returnId)
      .eq("is_current", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const agreed = current?.outcome === data.verdict;

    await supabase.from("human_reviews").insert({
      return_id: data.returnId,
      reviewer_name: data.reviewerName,
      verdict: data.verdict,
      agreed_with_system: agreed,
      notes: data.notes ?? null,
    });

    if (current) {
      await supabase.from("decisions").update({ is_current: false }).eq("id", current.id);
    }
    await supabase.from("decisions").insert({
      return_id: data.returnId,
      outcome: data.verdict,
      source: "HUMAN",
      confidence: 1,
      rationale: [
        `${data.reviewerName} ${agreed ? "confirmed" : "overrode"} the system decision${current ? ` (${current.outcome})` : ""}.`,
        ...(data.notes ? [data.notes] : []),
      ],
      is_current: true,
    });

    await supabase
      .from("return_requests")
      .update({ status: "RESOLVED", updated_at: new Date().toISOString() })
      .eq("id", data.returnId);

    await supabase.from("audit_events").insert({
      return_id: data.returnId,
      stage: "human_review",
      actor: "HUMAN",
      actor_name: data.reviewerName,
      summary: `${agreed ? "Confirmed" : "Overrode"} the system decision with ${data.verdict}.`,
      payload: { verdict: data.verdict, agreed },
    });

    return { agreed };
  });

/* -------------------------------- overview --------------------------------- */

export const getOverview = createServerFn({ method: "GET" }).handler(async () => {
  const supabase = await db();
  const [orders, customers, returns, decisions, reviews, predictions, fusions, policies] = await Promise.all([
    supabase.from("orders").select("id", { count: "exact", head: true }),
    supabase.from("customers").select("id", { count: "exact", head: true }),
    supabase
      .from("return_requests")
      .select("id, created_at")
      .order("created_at", { ascending: false })
      .limit(500),
    supabase.from("decisions").select("outcome, source, is_current").eq("is_current", true),
    supabase.from("human_reviews").select("agreed_with_system"),
    supabase.from("predictions").select("risk_score, risk_level"),
    supabase.from("fusion_results").select("conflicts"),
    supabase.from("policy_evaluations").select("eligible"),
  ]);

  const decisionRows = decisions.data ?? [];
  const counts: Record<string, number> = {
    AUTO_APPROVE: 0,
    MANUAL_REVIEW: 0,
    REFUND_ON_INSPECTION: 0,
    DECLINE: 0,
  };
  for (const d of decisionRows) counts[d.outcome] = (counts[d.outcome] ?? 0) + 1;

  const reviewRows = reviews.data ?? [];
  const agreementRate = reviewRows.length
    ? reviewRows.filter((r) => r.agreed_with_system).length / reviewRows.length
    : null;

  const predictionRows = predictions.data ?? [];
  const riskBands: Record<string, number> = { LOW: 0, MEDIUM: 0, HIGH: 0 };
  for (const p of predictionRows) riskBands[p.risk_level] = (riskBands[p.risk_level] ?? 0) + 1;

  const conflictCount = (fusions.data ?? []).filter(
    (f) => Array.isArray(f.conflicts) && f.conflicts.length > 0,
  ).length;

  const policyViolations = (policies.data ?? []).filter((p) => p.eligible === false).length;

  const histOrders =
    orders.count && orders.count > 0 ? orders.count : (ordersSample as any[]).length;
  const histCustomers =
    customers.count && customers.count > 0 ? customers.count : (customersSample as any[]).length;

  return {
    historicalOrders: histOrders,
    historicalCustomers: histCustomers,
    totalReturns: returns.data?.length ?? 0,
    decisionCounts: counts,
    automationRate: decisionRows.length
      ? (counts["AUTO_APPROVE"]! + counts["DECLINE"]!) / decisionRows.length
      : null,
    humanReviews: reviewRows.length,
    agreementRate,
    riskBands,
    avgRisk: predictionRows.length
      ? predictionRows.reduce((a, p) => a + Number(p.risk_score), 0) / predictionRows.length
      : null,
    evidenceConflicts: conflictCount,
    policyViolations,
    humanEscalations: counts["MANUAL_REVIEW"] ?? 0,
  };
});
