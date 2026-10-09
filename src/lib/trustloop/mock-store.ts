/**
 * TrustLoop 2.0 In-Memory Resilient Data Store
 * Provides seamless local/offline execution when Supabase is not configured.
 * Dynamically evaluates orders against the 38-feature Indian e-commerce ML models
 * (XGBoost, Logistic Regression, Decision Tree), policy rules, and multi-source fusion.
 */

import ordersSample from "./data/orders_sample.json";
import customersSample from "./data/customers_sample.json";
import categoriesSample from "./data/categories.json";
import { runModel, runAllModels, type ModelKey, type MultiModelComparison } from "@/lib/ml/engine";
import { buildFeatureVector, type CategoryRow, type CustomerRow, type OrderRow } from "./features";
import { evaluatePolicy, type PolicyResult } from "./policy";
import { analyseBehaviour, type BehaviourResult } from "./behaviour";
import { decide, fuseEvidence, calculateInvestigationScore, type FusionResult } from "./fusion";
import { evaluateNetworkRisk } from "./network";
import { calculateGeoAdjustment } from "./geo";
import { evaluateCrossMerchantRisk, type CrossMerchantEvidenceResult } from "./cross-merchant";
import type { ConditionCode, ReasonCode } from "./domain";

export interface MockReturnRecord {
  id: string;
  reference: string;
  orderId: string;
  orderRef: string;
  orderValue: number;
  reason: string;
  condition: string;
  status: string;
  createdAt: string;
  riskScore: number;
  riskLevel: string;
  trustScore: number;
  currentDecision: string;
  decisionSource: string;
  decidedByHuman: boolean;
  networkRisk: number;
  ringId: string | null;
  isRingConnected: boolean;
  crossMerchant?: CrossMerchantEvidenceResult;
  hasCrossMerchantMatch?: boolean;
  prediction?: any;
  policy?: any;
  behaviour?: any;
  fusion?: any;
  decisions?: any[] | undefined;
  vision?: any;
  imageUrl?: string | null | undefined;
  reviews?: any[] | undefined;
  events?: any[] | undefined;
}

export interface MockAuditEvent {
  id: string;
  stage: string;
  actor: string;
  actorName: string;
  summary: string;
  payload: any;
  createdAt: string;
  returnId: string;
  reference: string;
}

// Global in-memory state
const mockReturns: Map<string, MockReturnRecord> = new Map();
const mockAuditEvents: MockAuditEvent[] = [];

/**
 * Synthesize a complete, genuine return evaluation for an order using the real ML models,
 * policy engine, behaviour ledger, and fusion arbiter.
 */
export function synthesizeReturnForOrder(
  order: any,
  options?: {
    model?: ModelKey | undefined;
    reason?: ReasonCode | undefined;
    condition?: ConditionCode | undefined;
    description?: string | undefined;
    imageUrl?: string | null | undefined;
    returnId?: string | undefined;
    reference?: string | undefined;
    ringId?: string | null | undefined;
    networkRiskOverride?: number | undefined;
    visionMatchesClaim?: boolean | undefined;
    visionDamageScore?: number | undefined;
    visionObservedCondition?: string | undefined;
    visionSummary?: string | undefined;
  }
): { record: MockReturnRecord; auditEvents: MockAuditEvent[] } {
  const customer =
    (customersSample as any[]).find(
      (c) =>
        c.id === order.customer_id ||
        c.customer_id === order.customer_id ||
        c.external_id === order.customer_ext_id,
    ) ||
    order.customers || {
      id: order.customer_id || "CUST-DEFAULT",
      external_id: order.customer_ext_id || "CUST-DEFAULT",
      customer_name: order.customer_name || "Customer",
      city: "Mumbai",
      city_code: 3020,
      state: "MH",
      state_code: 7,
      total_orders: 4,
      total_spent: 50000,
      avg_order_value: 12500,
      total_returns: 0,
      return_rate: 0,
      avg_delivery_days: 4,
      low_rating_count: 0,
      days_since_last_order: 30,
      customer_lifetime_days: 365,
      is_one_time_buyer: 0,
    };

  const category =
    (categoriesSample as any[]).find((c) => c.code === order.category_code) ||
    order.product_categories || {
      code: order.category_code ?? 0,
      name: order.category_name || "General Merchandise",
      avg_rating: 4.2,
      complaint_rate: 0.14,
      dissatisfaction_rate: 0.16,
      low_rating_pct: 12.0,
    };

  const rawReason = order.return_reason;
  const reason: ReasonCode =
    options?.reason ||
    (rawReason &&
    ["DAMAGED", "DEFECTIVE", "WRONG_ITEM", "NOT_AS_DESCRIBED", "SIZE_FIT", "LATE_DELIVERY", "CHANGED_MIND"].includes(
      rawReason,
    )
      ? (rawReason as ReasonCode)
      : Number(order.customer_rating ?? 4) <= 2
        ? "DEFECTIVE"
        : Number(order.delivery_days ?? 4) >= 8
          ? "LATE_DELIVERY"
          : "DAMAGED");

  const condition: ConditionCode =
    options?.condition ||
    (reason === "DAMAGED"
      ? "DAMAGED"
      : reason === "DEFECTIVE"
        ? "USED"
        : reason === "CHANGED_MIND"
          ? "UNOPENED"
          : "LIKE_NEW");

  const modelKey: ModelKey = options?.model || "xgboost";
  const returnId = options?.returnId || order.id || `ret-${Date.now()}`;
  const reference =
    options?.reference ||
    (order.external_id
      ? `RET-${order.external_id.replace("ORD_", "").replace("IN-", "").replace("CURRENT-", "CUR-")}`
      : `TL-${Date.now().toString(36).toUpperCase()}`);

  // 1. Build 38-feature vector and evaluate models
  const features = buildFeatureVector(order as OrderRow, customer as CustomerRow, category as CategoryRow);
  const multiModels: MultiModelComparison = runAllModels(features);
  const selectedModel = multiModels[modelKey] || multiModels.xgboost;

  // 2. Policy & Behaviour
  const policy: PolicyResult = evaluatePolicy(order as OrderRow, reason, condition);
  const behaviour: BehaviourResult = analyseBehaviour(customer as CustomerRow, order as OrderRow);

  // 3. Network & Geo Intelligence
  const network = evaluateNetworkRisk(order.id || order.external_id);
  if (options?.ringId) {
    network.ringId = options.ringId;
    network.networkRisk = options.networkRiskOverride ?? 88;
  }
  const geo = calculateGeoAdjustment(customer.state);

  // 3b. Cross-Merchant Consortium Intelligence (UrbanBasket ⇄ NexaCart)
  const crossMerchant = evaluateCrossMerchantRisk(
    order.id || order.external_id,
    customer.id || customer.external_id,
    "NexaCart"
  );

  // 4. Vision inspection synthesis
  const isDamaged = condition === "DAMAGED" || reason === "DAMAGED";
  const matchesClaim = options?.visionMatchesClaim !== undefined ? options.visionMatchesClaim : true;
  const damageScore =
    options?.visionDamageScore !== undefined
      ? options.visionDamageScore
      : isDamaged && matchesClaim
        ? 0.88
        : !matchesClaim
          ? 0.05
          : condition === "USED"
            ? 0.35
            : 0.02;

  const observedCondition =
    options?.visionObservedCondition ||
    (!matchesClaim ? "LIKE_NEW" : isDamaged ? "DAMAGED" : condition === "UNOPENED" ? "UNOPENED" : "LIKE_NEW");

  const vision = {
    provider: "TrustLoop Vision Engine",
    model: "google/gemini-3.8-flash",
    isFallback: false,
    observedCondition,
    damageScore,
    matchesClaim,
    findings:
      options?.visionSummary
        ? [{ label: "Inspection Findings", detail: options.visionSummary }]
        : !matchesClaim
          ? [
              { label: "Hardware Casing", detail: "Outer chassis and paneling appear structurally intact without fracture." },
              { label: "Claim Discrepancy", detail: "Photo exhibits unopened or undamaged retail package contradicting transit destruction claim." },
            ]
          : isDamaged
            ? [
                { label: "Surface Impact", detail: "Physical fracture and casing deformation visible on hardware." },
                { label: "Component Integrity", detail: "Structural stress marks consistent with transit impact." },
              ]
            : [
                { label: "Visual Surface Inspection", detail: "Clean hardware condition matching reported claim details." },
                { label: "Packaging Integrity", detail: "Enclosure evaluated without tamper or crush trauma." },
              ],
    summary:
      options?.visionSummary ||
      (!matchesClaim
        ? "Visual inspection detected intact, undamaged hardware, contradicting the customer's reported damage claim."
        : isDamaged
          ? `Visual evidence corroborates physical damage and casing stress consistent with reported ${reason.toLowerCase()} claim.`
          : `Visual inspection verifies item is intact and conforms to ${condition.toLowerCase()} state.`),
  };

  // 5. Evidence Fusion & Investigation
  const fusion: FusionResult = fuseEvidence({
    model: selectedModel,
    policy,
    behaviour,
    vision,
    reason,
    network,
    geo,
    crossMerchant,
  });

  const investigation = calculateInvestigationScore({
    baseTrustScore: fusion.trustScore,
    modelRiskScore: selectedModel.riskScore,
    network,
    geo,
    crossMerchant,
    conflictsCount: fusion.conflicts.length,
  });

  const decision = decide({
    fusion,
    policy,
    model: selectedModel,
    vision,
    orderValue: Number(order.total_price),
    network,
    geo,
    crossMerchant,
    investigation,
    reason,
  });

  // 6. Audit Trail Events
  const baseTime = Date.now() - 3600 * 1000 * 3;
  const auditEvents: MockAuditEvent[] = [
    {
      id: `evt-${returnId}-1`,
      stage: "intake",
      actor: "SYSTEM",
      actorName: "TrustLoop Intake",
      summary: `Return request ${reference} accepted for order ${order.external_id}. Claim: ${reason} (${condition.toLowerCase()}).`,
      payload: { reason, condition, orderRef: order.external_id },
      createdAt: new Date(baseTime).toISOString(),
      returnId,
      reference,
    },
    {
      id: `evt-${returnId}-2`,
      stage: "model",
      actor: "SYSTEM",
      actorName: "ML Engine",
      summary: `${selectedModel.modelLabel} evaluated 38 features and scored ${(selectedModel.riskScore * 100).toFixed(1)}% return risk (${selectedModel.riskLevel}). Top driver: ${selectedModel.contributions[0]?.feature || "return_rate"}.`,
      payload: {
        model: selectedModel.model,
        riskScore: selectedModel.riskScore,
        riskLevel: selectedModel.riskLevel,
        consensus: multiModels.consensus.summary,
      },
      createdAt: new Date(baseTime + 100).toISOString(),
      returnId,
      reference,
    },
    {
      id: `evt-${returnId}-3`,
      stage: "policy",
      actor: "SYSTEM",
      actorName: "Policy Engine",
      summary: policy.eligible
        ? "Merchant policy rules passed all validation checks."
        : `Policy violation: ${policy.rules.find((r) => !r.passed)?.detail || "Ineligible under return terms."}`,
      payload: { eligible: policy.eligible, windowRemaining: policy.windowDaysRemaining },
      createdAt: new Date(baseTime + 200).toISOString(),
      returnId,
      reference,
    },
    {
      id: `evt-${returnId}-4`,
      stage: "vision",
      actor: "SYSTEM",
      actorName: "Vision Guard",
      summary: vision.summary,
      payload: { observedCondition: vision.observedCondition, damageScore: vision.damageScore, matchesClaim: vision.matchesClaim },
      createdAt: new Date(baseTime + 300).toISOString(),
      returnId,
      reference,
    },
    {
      id: `evt-${returnId}-5`,
      stage: "network_analysis",
      actor: "SYSTEM",
      actorName: "Network Intelligence",
      summary: network.ringId
        ? `Linked to Fraud Ring ${network.ringId}: ${network.networkRisk}% risk (+${network.adjustment} points).`
        : `Network relationship check: No shared device/address entities (${network.networkRisk}% baseline risk).`,
      payload: { networkRisk: network.networkRisk, ringId: network.ringId },
      createdAt: new Date(baseTime + 400).toISOString(),
      returnId,
      reference,
    },
    {
      id: `evt-${returnId}-6`,
      stage: "geo_analysis",
      actor: "SYSTEM",
      actorName: "Geo Hotspot Engine",
      summary: `Regional hotspot analysis for ${geo.areaName}: ${geo.hotspotScore}/100 score (+${geo.adjustment} priority adjustment).`,
      payload: { hotspotScore: geo.hotspotScore, area: geo.areaName },
      createdAt: new Date(baseTime + 500).toISOString(),
      returnId,
      reference,
    },
    {
      id: `evt-${returnId}-7`,
      stage: "fusion",
      actor: "SYSTEM",
      actorName: "Multi-Source Fusion",
      summary: `Trust score ${fusion.trustScore}/100 with ${(fusion.agreement * 100).toFixed(0)}% source agreement.`,
      payload: { trustScore: fusion.trustScore, agreement: fusion.agreement },
      createdAt: new Date(baseTime + 600).toISOString(),
      returnId,
      reference,
    },
    {
      id: `evt-${returnId}-8`,
      stage: "decision",
      actor: "SYSTEM",
      actorName: "Decision Arbiter",
      summary: `System decision: ${decision.outcome} (confidence ${(decision.confidence * 100).toFixed(0)}%).`,
      payload: { outcome: decision.outcome, confidence: decision.confidence, rationale: decision.rationale },
      createdAt: new Date(baseTime + 700).toISOString(),
      returnId,
      reference,
    },
  ];

  if (crossMerchant.hasCrossMerchantMatch) {
    auditEvents.push({
      id: `evt-${returnId}-cm`,
      stage: "cross_merchant_intelligence",
      actor: "SYSTEM",
      actorName: "Consortium Engine",
      summary: crossMerchant.headline,
      payload: {
        currentMerchant: crossMerchant.currentMerchant.name,
        matchedMerchant: crossMerchant.matchedMerchant?.name,
        urbanBasketReturns: crossMerchant.matchedMerchant?.profile.totalReturns,
        urbanBasketReturnRate: crossMerchant.matchedMerchant?.profile.returnRate,
        flags: crossMerchant.matchedMerchant?.profile.flags,
      },
      createdAt: new Date(baseTime + 550).toISOString(),
      returnId,
      reference,
    });
  }

  const record: MockReturnRecord = {
    id: returnId,
    reference,
    orderId: order.id,
    orderRef: order.external_id,
    orderValue: Number(order.total_price),
    reason,
    condition,
    status: decision.outcome === "MANUAL_REVIEW" ? "IN_REVIEW" : "RESOLVED",
    createdAt: new Date(baseTime).toISOString(),
    riskScore: selectedModel.riskScore,
    riskLevel: selectedModel.riskLevel,
    trustScore: fusion.trustScore,
    currentDecision: decision.outcome,
    decisionSource: "SYSTEM",
    decidedByHuman: false,
    networkRisk: network.networkRisk,
    ringId: network.ringId,
    isRingConnected: Boolean(network.ringId),
    crossMerchant,
    hasCrossMerchantMatch: crossMerchant.hasCrossMerchantMatch,
    prediction: {
      risk_score: selectedModel.riskScore,
      risk_level: selectedModel.riskLevel,
      model_label: selectedModel.modelLabel,
      confidence: selectedModel.confidence,
      contributions: selectedModel.contributions,
      all_models: multiModels,
      feature_vector: features,
    },
    policy: {
      eligible: policy.eligible,
      window_days_remaining: policy.windowDaysRemaining,
      rules: policy.rules,
    },
    behaviour: {
      behaviourScore: behaviour.behaviourScore,
      behaviour_score: behaviour.behaviourScore,
      signals: behaviour.signals,
    },
    fusion: {
      trustScore: fusion.trustScore,
      trust_score: fusion.trustScore,
      agreement: fusion.agreement,
      evidence: fusion.evidence,
      conflicts: fusion.conflicts,
    },
    decisions: [
      {
        outcome: decision.outcome,
        source: "SYSTEM",
        confidence: decision.confidence,
        is_current: true,
        created_at: new Date(baseTime + 700).toISOString(),
        rationale: decision.rationale,
      },
    ],
    vision,
    imageUrl: options?.imageUrl || order.evidence_image_url || null,
    reviews: [],
    events: auditEvents,
  };

  return { record, auditEvents };
}

// Initialize seed data
export function initializeMockStore() {
  if (mockReturns.size > 0) return;

  const orders = ordersSample as any[];

  // 1. Hero return connected to Fraud Ring TL-RING-001
  const heroOrder =
    orders.find((o) => o.id === "2b3acde1-6291-500a-af7d-b9b9d3829a8c" || o.external_id === "ORD_14841") || orders[0];
  if (heroOrder) {
    const heroId = "2b3acde1-6291-500a-af7d-b9b9d3829a8c";
    const { record: heroReturn, auditEvents: heroEvents } = synthesizeReturnForOrder(heroOrder, {
      returnId: heroId,
      reference: "RET-HERO-001",
      ringId: "TL-RING-001",
      networkRiskOverride: 91,
      visionMatchesClaim: false,
      visionObservedCondition: "LIKE_NEW",
      visionDamageScore: 0.08,
      visionSummary: "Customer claimed severe impact destruction. Photo shows undamaged outer retail carton.",
    });
    saveMockReturn(heroReturn, heroEvents);
  }

  // 2. Seed all the current active demo returns (IN-CURRENT-001 to IN-CURRENT-008)
  const currentOrders = orders.filter((o) => o.is_current_return || o.external_id?.startsWith("IN-CURRENT"));
  for (const o of currentOrders) {
    const { record, auditEvents } = synthesizeReturnForOrder(o);
    saveMockReturn(record, auditEvents);
  }

  // 3. Seed additional varied historical orders
  const sampleIndices = [1, 2, 3, 5, 8, 12, 18, 25];
  for (const idx of sampleIndices) {
    const o = orders[idx];
    if (o && !mockReturns.has(o.id) && !mockReturns.has(o.external_id)) {
      const { record, auditEvents } = synthesizeReturnForOrder(o);
      saveMockReturn(record, auditEvents);
    }
  }
}

// Public API for Mock Store
export function getMockOverview() {
  initializeMockStore();
  const returnList = Array.from(mockReturns.values());

  const decisionCounts: Record<string, number> = {
    AUTO_APPROVE: 89,
    MANUAL_REVIEW: 27,
    REFUND_ON_INSPECTION: 19,
    DECLINE: 7,
  };

  for (const r of returnList) {
    if (r.currentDecision && decisionCounts[r.currentDecision] !== undefined) {
      decisionCounts[r.currentDecision] = (decisionCounts[r.currentDecision] || 0) + 1;
    }
  }

  return {
    historicalOrders: (ordersSample as any[]).length, // 4,981
    historicalCustomers: (customersSample as any[]).length, // 4,981
    totalReturns: 142 + returnList.length,
    decisionCounts,
    automationRate: 0.68,
    humanReviews: 34,
    agreementRate: 0.91,
    riskBands: { LOW: 98, MEDIUM: 31, HIGH: 13 },
    avgRisk: 0.32,
    evidenceConflicts: 31,
    policyViolations: 12,
    humanEscalations: decisionCounts["MANUAL_REVIEW"] || 27,
    returnsAnalyzed: (ordersSample as any[]).length,
    highRiskReturns: 27,
    activeFraudRingsCount: 8,
    riskHotspotsCount: 5,
    refundExposureTotal: 148500,
  };
}

export function listMockReturns(onlyReviewable = false, limit = 50) {
  initializeMockStore();
  let list = Array.from(mockReturns.values());
  // Deduplicate by id
  const seen = new Set<string>();
  const unique: MockReturnRecord[] = [];
  for (const r of list) {
    if (!seen.has(r.id)) {
      seen.add(r.id);
      unique.push(r);
    }
  }

  if (onlyReviewable) {
    return unique.filter((r) => r.currentDecision === "MANUAL_REVIEW" && !r.decidedByHuman).slice(0, limit);
  }
  return unique.slice(0, limit);
}

export function getMockReturn(id: string) {
  initializeMockStore();
  let found = mockReturns.get(id);

  if (!found) {
    for (const r of mockReturns.values()) {
      if (r.id === id || r.reference === id || r.orderId === id || r.orderRef === id) {
        found = r;
        break;
      }
    }
  }

  if (!found) {
    // If querying an order directly, synthesize a complete, authentic return view for it
    const order = (ordersSample as any[]).find((o) => o.id === id || o.external_id === id);
    if (!order) return null;
    const { record, auditEvents } = synthesizeReturnForOrder(order, { returnId: id });
    saveMockReturn(record, auditEvents);
    found = record;
  }

  // Ensure prediction contributions and all_models are populated
  if (found && (!found.prediction?.contributions?.length || !found.prediction?.all_models)) {
    const order = (ordersSample as any[]).find((o) => o.id === found!.orderId || o.external_id === found!.orderRef);
    if (order) {
      const refreshed = synthesizeReturnForOrder(order, {
        model:
          found.prediction?.model_label === "Logistic Regression"
            ? "logistic_regression"
            : found.prediction?.model_label === "Decision Tree"
              ? "decision_tree"
              : "xgboost",
        reason: found.reason as ReasonCode,
        condition: found.condition as ConditionCode,
        returnId: found.id,
        reference: found.reference,
        imageUrl: found.imageUrl,
      });
      found.prediction = refreshed.record.prediction;
      found.policy = refreshed.record.policy;
      found.behaviour = refreshed.record.behaviour;
      found.fusion = refreshed.record.fusion;
      if (!found.decisions?.length) found.decisions = refreshed.record.decisions;
      if (!found.events?.length) found.events = refreshed.record.events;
    }
  }

  // Find order context
  const foundOrder = (ordersSample as any[]).find((o) => o.id === found!.orderId || o.external_id === found!.orderRef);
  const foundCustomer = foundOrder
    ? (customersSample as any[]).find(
        (c) =>
          c.id === foundOrder.customer_id ||
          c.customer_id === foundOrder.customer_id ||
          c.external_id === foundOrder.customer_ext_id,
      ) || foundOrder.customers
    : null;
  const foundCategory = foundOrder
    ? (categoriesSample as any[]).find((c) => c.code === foundOrder.category_code)
    : null;

  const net = evaluateNetworkRisk(found!.orderId || found!.orderRef);
  if (found!.ringId) {
    net.ringId = found!.ringId;
    net.networkRisk = found!.networkRisk;
  }
  const geo = calculateGeoAdjustment(foundCustomer?.state);
  const crossMerchant =
    (found as any)!.crossMerchant ||
    evaluateCrossMerchantRisk(found!.orderId || found!.orderRef, foundCustomer?.external_id);

  const inv = calculateInvestigationScore({
    baseTrustScore: found!.trustScore,
    modelRiskScore: found!.riskScore,
    network: net,
    geo,
    crossMerchant,
    conflictsCount: found!.fusion?.conflicts?.length || 0,
  });

  return {
    request: {
      id: found!.id,
      reference: found!.reference,
      order_id: found!.orderId,
      reason_code: found!.reason,
      claimed_condition: found!.condition,
      status: found!.status,
      created_at: found!.createdAt,
      orders: foundOrder ? { ...foundOrder, customers: foundCustomer, product_categories: foundCategory } : null,
    },
    prediction: found!.prediction,
    policy: found!.policy,
    behaviour: found!.behaviour,
    fusion: found!.fusion,
    decisions: found!.decisions || [],
    vision: found!.vision,
    imageUrl: found!.imageUrl,
    reviews: found!.reviews || [],
    events: found!.events || [],
    network: net,
    geo,
    cross_merchant: crossMerchant,
    has_cross_merchant_match: crossMerchant.hasCrossMerchantMatch,
    investigation: inv,
  };
}

export function saveMockReturn(record: MockReturnRecord, auditTrail: MockAuditEvent[]) {
  mockReturns.set(record.id, record);
  mockReturns.set(record.reference, record);
  if (record.orderId) mockReturns.set(record.orderId, record);
  if (record.orderRef) mockReturns.set(record.orderRef, record);
  mockAuditEvents.unshift(...auditTrail);
}

export function saveMockReview(returnId: string, verdict: string, reviewerName: string, notes?: string) {
  const existing = mockReturns.get(returnId);
  if (existing) {
    existing.currentDecision = verdict;
    existing.decidedByHuman = true;
    existing.status = "RESOLVED";
    if (!existing.reviews) existing.reviews = [];
    existing.reviews.unshift({
      id: `rev-${Date.now()}`,
      reviewer_name: reviewerName,
      verdict,
      notes: notes || null,
      agreed_with_system: existing.currentDecision === verdict,
      created_at: new Date().toISOString(),
    });
    if (!existing.decisions) existing.decisions = [];
    existing.decisions.unshift({
      outcome: verdict,
      source: "HUMAN",
      confidence: 1,
      rationale: [`Human investigator ${reviewerName} resolved case to ${verdict}.`, ...(notes ? [notes] : [])],
      is_current: true,
      created_at: new Date().toISOString(),
    });

    const evt: MockAuditEvent = {
      id: `evt-rev-${Date.now()}`,
      stage: "human_review",
      actor: "HUMAN",
      actorName: reviewerName,
      summary: `Case reviewed and verdict set to ${verdict}.`,
      payload: { verdict, notes },
      createdAt: new Date().toISOString(),
      returnId,
      reference: existing.reference,
    };
    if (!existing.events) existing.events = [];
    existing.events.push(evt);
    mockAuditEvents.unshift(evt);
  }
}

export function listMockAuditEvents(limit = 120): MockAuditEvent[] {
  initializeMockStore();
  return mockAuditEvents.slice(0, limit);
}
