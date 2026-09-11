import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { queryOptions, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";

import { AppShell, PageHeader } from "@/components/trustloop/app-shell";
import { EmptyState, Meter, Panel, Pill, Stat, riskTone } from "@/components/trustloop/primitives";
import { getReturn, submitReview } from "@/lib/trustloop/api.functions";
import { featureLabel } from "@/lib/trustloop/features";
import {
  DECISION_LABELS,
  DECISION_TONE,
  formatCurrency,
  type Conflict,
  type DecisionOutcome,
  type EvidenceItem,
  type RuleResult,
  type Signal,
} from "@/lib/trustloop/domain";
import { useJudgeMode } from "@/lib/trustloop/judge-mode";

const passportQuery = (id: string) =>
  queryOptions({ queryKey: ["return", id], queryFn: () => getReturn({ data: { id } }) });

export const Route = createFileRoute("/returns/$id")({
  head: () => ({
    meta: [
      { title: "Trust Passport — TrustLoop" },
      {
        name: "description",
        content:
          "The complete evidence record behind one return decision: model, policy, photo, history, fusion and human verdict.",
      },
      { property: "og:title", content: "Trust Passport — TrustLoop" },
      {
        property: "og:description",
        content: "Every piece of evidence behind a single return decision.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: async ({ context, params }) => {
    const data = await context.queryClient.ensureQueryData(passportQuery(params.id));
    if (!data) throw notFound();
  },
  component: TrustPassport,
  errorComponent: ({ error }) => (
    <AppShell>
      <EmptyState title="This trust passport could not load" body={error.message} />
    </AppShell>
  ),
  notFoundComponent: () => (
    <AppShell>
      <EmptyState title="Return not found" body="No return request exists with that reference." />
    </AppShell>
  ),
});

function TrustPassport() {
  const { id } = Route.useParams();
  const { data } = useSuspenseQuery(passportQuery(id));
  const queryClient = useQueryClient();
  const review = useServerFn(submitReview);
  const { isJudgeMode } = useJudgeMode();

  const [reviewer, setReviewer] = useState("Agent #42 (Trust & Safety)");
  const [verdict, setVerdict] = useState<DecisionOutcome>("AUTO_APPROVE");
  const [notes, setNotes] = useState("");
  const [activeTab, setActiveTab] = useState<"ml" | "policy" | "vision" | "behaviour" | "trace">("ml");
  const [selectedTraceNode, setSelectedTraceNode] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () =>
      review({
        data: { returnId: id, reviewerName: reviewer, verdict, notes: notes || undefined },
      }),
    onSuccess: (result) => {
      toast.success(result.agreed ? "Human decision confirmed & audit logged" : "System decision overridden & audit logged");
      setNotes("");
      void queryClient.invalidateQueries();
    },
    onError: (error: Error) => toast.error(error.message || "The review could not be saved"),
  });

  if (!data) return null;

  const request = data.request as unknown as {
    reference: string;
    reason_code: string;
    claimed_condition: string;
    description: string | null;
    created_at: string;
    status: string;
    orders: {
      external_id: string;
      total_price: number;
      delivered_at: string | null;
      delivery_delay_days: number;
      review_score: number;
      num_items: number;
      customers: {
        city: string;
        state: string;
        total_orders: number;
        total_spent: number;
        avg_review_score: number;
      };
      product_categories: { name: string };
    } | null;
  };

  const order = request.orders;
  const prediction = data.prediction as unknown as {
    model_label: string;
    risk_score: number;
    risk_level: string;
    confidence: number;
    contributions: { feature: string; value: number; contribution: number }[];
  } | null;

  const policy = data.policy as unknown as {
    eligible: boolean;
    window_days_remaining: number | null;
    rules: RuleResult[];
  } | null;

  const behaviour = data.behaviour as unknown as {
    behaviour_score: number;
    signals: Signal[];
  } | null;

  const fusion = data.fusion as unknown as {
    trust_score: number;
    agreement: number;
    evidence: EvidenceItem[];
    conflicts: Conflict[];
  } | null;

  const vision = data.vision as unknown as {
    provider: string;
    model: string;
    is_fallback: boolean;
    observed_condition: string | null;
    damage_score: number | null;
    matches_claim: boolean | null;
    findings: { label: string; detail: string }[];
    summary: string;
  } | null;

  const decisions = (data.decisions ?? []) as unknown as {
    id: string;
    outcome: DecisionOutcome;
    source: string;
    confidence: number;
    rationale: string[];
    created_at: string;
  }[];

  const current = decisions[0];
  const originalSystemDecision = decisions.find((d) => d.source === "SYSTEM") ?? current;

  const reviews = (data.reviews ?? []) as unknown as {
    id: string;
    reviewer_name: string;
    verdict: DecisionOutcome;
    agreed_with_system: boolean;
    notes: string | null;
    created_at: string;
  }[];
  const latestReview = reviews[0];

  const events = (data.events ?? []) as unknown as {
    id: string;
    stage: string;
    actor: string;
    actor_name: string | null;
    summary: string;
    created_at: string;
  }[];

  // Evidence conflict detection
  const hasConflict = Boolean(
    (fusion?.conflicts && fusion.conflicts.length > 0) ||
      (vision && vision.matches_claim === false && (request.reason_code === "DAMAGED" || request.reason_code === "DEFECTIVE")),
  );

  const isAligned = !hasConflict && fusion && fusion.agreement >= 0.55 && policy?.eligible;
  const isInsufficient = !vision || vision.is_fallback;

  const maxContribution = Math.max(
    ...(prediction?.contributions ?? []).map((c) => Math.abs(c.contribution)),
    0.0001,
  );

  return (
    <AppShell>
      {/* Hero Passport Banner */}
      <section className="mb-8 rounded-3xl border border-slate-200/80 bg-gradient-to-r from-[#0B1F3A] via-[#102A4E] to-[#0B1F3A] text-white p-6 sm:p-8 shadow-lift relative overflow-hidden">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="font-mono text-xs font-bold uppercase tracking-widest text-[#00B8D9]">
                TRUST PASSPORT · IMMUTABLE CASE FILE
              </span>
              <span className="rounded bg-white/10 text-white font-mono text-[10px] px-2.5 py-0.5 border border-white/20">
                {request.status}
              </span>
            </div>

            <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Return #{request.reference}
            </h1>

            <p className="mt-2 text-sm text-slate-300 max-w-2xl">
              Claim: <span className="font-semibold text-white">{request.reason_code.replace(/_/g, " ")}</span> ({request.claimed_condition.toLowerCase()}) ·{" "}
              Customer: <span className="text-white">{order?.customers?.city ?? "Unknown"}, {order?.customers?.state ?? ""}</span> ·{" "}
              Submitted {new Date(request.created_at).toLocaleString()}
            </p>
          </div>

          <div className="flex flex-col items-end gap-2">
            {current && (
              <div className="text-right">
                <span className="text-[10px] font-mono uppercase text-slate-400 block mb-1">
                  CURRENT VERDICT ({current.source === "HUMAN" ? "HUMAN VERIFIED" : "SYSTEM GENERATED"})
                </span>
                <Pill
                  tone={DECISION_TONE[current.outcome]}
                  className="text-sm font-bold px-3.5 py-1.5 shadow-md"
                >
                  {DECISION_LABELS[current.outcome]}
                </Pill>
              </div>
            )}
          </div>
        </div>

        {/* Quick Meta Grid */}
        <div className="mt-6 pt-5 border-t border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs font-mono">
          <div>
            <span className="text-slate-500 uppercase text-[10px] block">ORDER ID</span>
            <span className="text-slate-200 font-semibold">{order?.external_id ?? "Direct reference"}</span>
          </div>
          <div>
            <span className="text-slate-500 uppercase text-[10px] block">ORDER VALUE</span>
            <span className="text-slate-200 font-semibold">{order ? formatCurrency(Number(order.total_price)) : "—"}</span>
          </div>
          <div>
            <span className="text-slate-500 uppercase text-[10px] block">CATEGORY</span>
            <span className="text-slate-200 font-semibold">{order?.product_categories?.name ?? "General merchandise"}</span>
          </div>
          <div>
            <span className="text-slate-500 uppercase text-[10px] block">LIFETIME ORDERS</span>
            <span className="text-slate-200 font-semibold">{order?.customers?.total_orders ?? 1} historical order(s)</span>
          </div>
        </div>
      </section>

      {/* Top Evidence Stat Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6 mb-8">
        <Stat
          label="ML Return Risk"
          value={prediction ? `${(Number(prediction.risk_score) * 100).toFixed(1)}%` : "—"}
          hint={prediction ? `${prediction.model_label} · ${prediction.risk_level}` : undefined}
        />
        <Stat
          label="Policy Engine"
          value={policy ? (policy.eligible ? "Eligible" : "Blocked") : "—"}
          hint={policy?.eligible ? "All blocking rules passed" : "Blocking policy rule failed"}
        />
        <Stat
          label="Account Concern"
          value={behaviour ? `${(Number(behaviour.behaviour_score) * 100).toFixed(0)}%` : "—"}
          hint="Behavioral signal vector"
        />
        <Stat
          label="Vision Evidence"
          value={
            vision
              ? vision.is_fallback
                ? "Fallback"
                : vision.matches_claim === false
                  ? "Contradicts"
                  : vision.matches_claim === true
                    ? "Corroborates"
                    : "Inconclusive"
              : "No photo"
          }
          hint={vision?.observed_condition ? `Condition: ${vision.observed_condition}` : "Not analyzed"}
        />
        <Stat
          label="Fused Trust Score"
          value={fusion ? `${fusion.trust_score}/100` : "—"}
          hint="Weighted cross-examination"
        />
        <Stat
          label="Source Agreement"
          value={fusion ? `${(Number(fusion.agreement) * 100).toFixed(0)}%` : "—"}
          hint={hasConflict ? "Contradictions detected" : "Coherent evidence"}
        />
      </div>

      {/* SECTION 21 & 22: Prominent Evidence Alignment Hero Banner */}
      {hasConflict ? (
        <section className="mb-8 rounded-2xl border-2 border-amber-500 bg-amber-500/10 p-6 shadow-md dark:bg-amber-950/40">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="size-3.5 rounded-full bg-amber-500 animate-ping" />
              <h2 className="font-display text-lg font-bold text-amber-900 dark:text-amber-200">
                ⚠ EVIDENCE CONFLICT DETECTED
              </h2>
            </div>
            <span className="rounded bg-amber-500/20 text-amber-800 dark:text-amber-300 font-mono text-xs font-bold px-2.5 py-1 border border-amber-500/30 uppercase">
              Action: Human Investigation
            </span>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 pt-2">
            <div className="rounded-xl border border-amber-500/30 bg-card p-3.5 text-xs">
              <span className="font-mono text-[10px] uppercase text-muted-foreground block">Customer Claim</span>
              <p className="font-semibold text-foreground mt-1">&quot;{request.reason_code.replace(/_/g, " ")}&quot;</p>
              <p className="text-muted-foreground mt-0.5">{request.description || "Reported severe product damage"}</p>
            </div>

            <div className="rounded-xl border border-amber-500/30 bg-card p-3.5 text-xs">
              <span className="font-mono text-[10px] uppercase text-muted-foreground block">Physical Vision Evidence</span>
              <p className="font-semibold text-destructive mt-1">
                {vision?.matches_claim === false ? "✕ Photo Contradicts Claim" : "Inconclusive visual proof"}
              </p>
              <p className="text-muted-foreground mt-0.5">
                {vision?.summary || "Observed condition does not exhibit claimed defects"}
              </p>
            </div>

            <div className="rounded-xl border border-amber-500/30 bg-card p-3.5 text-xs">
              <span className="font-mono text-[10px] uppercase text-muted-foreground block">ML Risk Prediction</span>
              <p className="font-semibold text-foreground mt-1">
                {prediction ? `${(prediction.risk_score * 100).toFixed(1)}% (${prediction.risk_level} BAND)` : "—"}
              </p>
              <p className="text-muted-foreground mt-0.5">Top driver: {prediction?.contributions[0]?.feature ?? "delivery_delay"}</p>
            </div>

            <div className="rounded-xl border border-amber-500/30 bg-card p-3.5 text-xs">
              <span className="font-mono text-[10px] uppercase text-muted-foreground block">Policy Engine</span>
              <p className="font-semibold text-emerald-600 dark:text-emerald-400 mt-1">
                {policy?.eligible ? "✓ Policy Compliant" : "✕ Blocked by Rule"}
              </p>
              <p className="text-muted-foreground mt-0.5">{policy?.window_days_remaining ?? 24} days remaining in return window</p>
            </div>
          </div>

          <div className="mt-5 rounded-xl border border-amber-500/40 bg-amber-500/15 p-4 text-xs">
            <h3 className="font-bold text-amber-900 dark:text-amber-200 uppercase tracking-wider font-mono text-[11px]">
              WHY THIS MATTERS · RESPONSIBLE AI PRINCIPLE
            </h3>
            <p className="mt-1 text-amber-950 dark:text-amber-100 text-sm leading-relaxed">
              The customer&apos;s claim and the visual photo evidence directly disagree. Rather than executing an automated 
              rejection based solely on the model risk score, TrustLoop recognizes this internal contradiction and routes 
              the case to human review. Blind automation in conflicting cases causes customer alienation and false declines.
            </p>
          </div>
        </section>
      ) : isAligned ? (
        <section className="mb-8 rounded-2xl border border-emerald-500/50 bg-emerald-500/10 p-5 dark:bg-emerald-950/30">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="size-2.5 rounded-full bg-emerald-500" />
              <h2 className="font-display text-base font-bold text-emerald-900 dark:text-emerald-200">
                ✓ EVIDENCE ALIGNED
              </h2>
            </div>
            <span className="rounded bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 font-mono text-xs font-bold px-2.5 py-0.5">
              Coherent Signals ({Math.round((fusion?.agreement ?? 0.8) * 100)}% Agreement)
            </span>
          </div>
          <p className="mt-2 text-xs text-emerald-950 dark:text-emerald-200 leading-relaxed">
            All four independent evidence sources (ML risk model, policy rules, customer history, and physical evidence) 
            agree without contradictory signals. The automated decision is fully supported by multi-pillar evidence.
          </p>
        </section>
      ) : (
        <section className="mb-8 rounded-2xl border border-border bg-muted/40 p-5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="size-2.5 rounded-full bg-slate-400" />
              <h2 className="font-display text-base font-semibold text-foreground">
                ℹ INSUFFICIENT EVIDENCE (INCOMPLETE SIGNALS)
              </h2>
            </div>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Visual inspection could not be completed or no photo was submitted. The system does not treat absence of evidence as proof of fraud.
          </p>
        </section>
      )}

      {/* Main Grid: Evidence Matrix & Explainability vs Human Verification */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_400px]">
        <div className="space-y-6">
          {/* SECTION 20: Evidence Summary Matrix */}
          <Panel
            title="Evidence Summary Matrix"
            description="Four independent evidence pillars cross-examined with inspectable weighting."
          >
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border/80 text-left font-mono uppercase text-muted-foreground">
                    <th className="py-2.5 pr-4 font-semibold">Evidence Pillar</th>
                    <th className="py-2.5 pr-4 font-semibold">Weight</th>
                    <th className="py-2.5 pr-4 font-semibold">Support</th>
                    <th className="py-2.5 pr-4 font-semibold">Observed Finding</th>
                    <th className="py-2.5 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {(fusion?.evidence ?? []).map((e) => (
                    <tr key={e.source} className={e.available ? "" : "opacity-50"}>
                      <td className="py-3 pr-4 font-semibold text-foreground">
                        {e.label}
                      </td>
                      <td className="py-3 pr-4 font-mono text-muted-foreground">
                        {(e.weight * 100).toFixed(0)}%
                      </td>
                      <td className="py-3 pr-4 min-w-[120px]">
                        <div className="flex items-center gap-2">
                          <Meter
                            value={e.support}
                            tone={e.support >= 0.7 ? "positive" : e.support >= 0.4 ? "caution" : "critical"}
                          />
                          <span className="font-mono text-[10px] text-muted-foreground tabular-nums">
                            {Math.round(e.support * 100)}%
                          </span>
                        </div>
                      </td>
                      <td className="py-3 pr-4 text-foreground font-medium">
                        {e.verdict}
                      </td>
                      <td className="py-3 font-mono text-[11px] text-muted-foreground">
                        {e.available ? (
                          <span className="text-emerald-600 dark:text-emerald-400 font-semibold">✓ EVALUATED</span>
                        ) : (
                          <span className="text-amber-600 dark:text-amber-400">UNAVAILABLE</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="mt-4 text-[11px] text-muted-foreground border-t border-border/60 pt-2 font-mono">
              * Evidence weighting configured for the return-risk prototype: ML (35%), Policy (20%), Behaviour (15%), Vision (30%).
            </p>
          </Panel>

          {/* SECTION 29 & 30: Decision Engine Rationale & Explanation */}
          <Panel
            title="Decision Engine Transparency"
            description="Transparent, inspectable rule evaluations behind the system verdict."
          >
            {current ? (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-border/60">
                  <div className="flex items-center gap-2">
                    <Pill tone={DECISION_TONE[current.outcome]} className="text-xs font-bold">
                      {DECISION_LABELS[current.outcome]}
                    </Pill>
                    <span className="text-xs text-muted-foreground font-mono">
                      Confidence: {(Number(current.confidence) * 100).toFixed(0)}% · {current.source === "HUMAN" ? "Verified by human agent" : "Automated policy evaluation"}
                    </span>
                  </div>
                </div>

                {/* Explicit Rule Conditions Checklist */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs font-mono">
                  <div className="rounded-lg border border-border p-2 bg-muted/20">
                    <span className="text-muted-foreground block text-[10px]">POLICY BLOCK?</span>
                    <span className={policy?.eligible ? "text-emerald-600 dark:text-emerald-400 font-bold" : "text-destructive font-bold"}>
                      {policy?.eligible ? "NO (Passed)" : "YES (Blocked)"}
                    </span>
                  </div>
                  <div className="rounded-lg border border-border p-2 bg-muted/20">
                    <span className="text-muted-foreground block text-[10px]">EVIDENCE CONFLICT?</span>
                    <span className={hasConflict ? "text-amber-600 dark:text-amber-400 font-bold" : "text-emerald-600 dark:text-emerald-400 font-bold"}>
                      {hasConflict ? "YES (Contradiction)" : "NO (Aligned)"}
                    </span>
                  </div>
                  <div className="rounded-lg border border-border p-2 bg-muted/20">
                    <span className="text-muted-foreground block text-[10px]">VISION CONTRADICTION?</span>
                    <span className={vision?.matches_claim === false ? "text-destructive font-bold" : "text-emerald-600 dark:text-emerald-400 font-bold"}>
                      {vision?.matches_claim === false ? "YES (Disagrees)" : "NO (Corroborates)"}
                    </span>
                  </div>
                  <div className="rounded-lg border border-border p-2 bg-muted/20">
                    <span className="text-muted-foreground block text-[10px]">HIGH VALUE THRESHOLD?</span>
                    <span className={Number(order?.total_price ?? 0) >= 500 ? "text-amber-600 dark:text-amber-400 font-bold" : "text-foreground font-bold"}>
                      {Number(order?.total_price ?? 0) >= 500 ? "YES (&ge; $500)" : "NO (< $500)"}
                    </span>
                  </div>
                  <div className="rounded-lg border border-border p-2 bg-muted/20">
                    <span className="text-muted-foreground block text-[10px]">TRUST SCORE</span>
                    <span className="text-foreground font-bold">{fusion?.trust_score ?? 0} / 100</span>
                  </div>
                  <div className="rounded-lg border border-border p-2 bg-muted/20">
                    <span className="text-muted-foreground block text-[10px]">SOURCE AGREEMENT</span>
                    <span className="text-foreground font-bold">{Math.round((fusion?.agreement ?? 0) * 100)}%</span>
                  </div>
                </div>

                {/* Section 30: "Why this decision?" rationale list */}
                <div className="pt-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground font-mono mb-2">
                    Why This Decision? (Explicit Rationale)
                  </h4>
                  <ul className="space-y-2 text-xs text-foreground">
                    {(current.rationale ?? []).map((line, i) => (
                      <li key={i} className="flex items-start gap-2.5">
                        <span className="mt-1 size-1.5 shrink-0 rounded-full bg-primary" />
                        <span>{line}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Sections 39 & 40: Why not auto-reject? & Why not auto-approve? */}
                {current.outcome === "MANUAL_REVIEW" && (
                  <div className="mt-4 grid sm:grid-cols-2 gap-3 pt-2 border-t border-border/60 text-xs">
                    <div className="rounded-xl border border-border bg-card p-3">
                      <span className="font-semibold text-foreground block mb-1">
                        Why not auto-reject this claim?
                      </span>
                      <p className="text-muted-foreground text-[11px] leading-relaxed">
                        • Policy rules were compliant.<br />
                        • Visual evidence contradicts the high ML risk or vice versa.<br />
                        • Human verification is safer than an irreversible automated decline.
                      </p>
                    </div>
                    <div className="rounded-xl border border-border bg-card p-3">
                      <span className="font-semibold text-foreground block mb-1">
                        Why not auto-approve this claim?
                      </span>
                      <p className="text-muted-foreground text-[11px] leading-relaxed">
                        • Evidence sources disagree with each other.<br />
                        • Trust score is below the 75/100 auto-approval threshold.<br />
                        • Damage claim was not corroborated by visual inspection.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">No decision recorded.</p>
            )}
          </Panel>

          {/* Interactive Technical Decision Trace & Deep Pillar Inspector */}
          <Panel
            title="Technical Decision Trace & Deep Pillar Inspector"
            description="Explore the internal vector states and rule evaluations across each stage of the pipeline."
          >
            {/* Tab buttons */}
            <div className="flex items-center gap-1.5 overflow-x-auto border-b border-border/80 pb-3 text-xs font-mono">
              <button
                type="button"
                onClick={() => setActiveTab("ml")}
                className={`rounded-lg px-3 py-1.5 transition-colors ${
                  activeTab === "ml" ? "bg-primary text-primary-foreground font-semibold" : "text-muted-foreground hover:bg-muted"
                }`}
              >
                01 ML MODEL & 41 FEATURES
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("policy")}
                className={`rounded-lg px-3 py-1.5 transition-colors ${
                  activeTab === "policy" ? "bg-primary text-primary-foreground font-semibold" : "text-muted-foreground hover:bg-muted"
                }`}
              >
                02 POLICY ENGINE
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("vision")}
                className={`rounded-lg px-3 py-1.5 transition-colors ${
                  activeTab === "vision" ? "bg-primary text-primary-foreground font-semibold" : "text-muted-foreground hover:bg-muted"
                }`}
              >
                03 VISION INSPECTION
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("behaviour")}
                className={`rounded-lg px-3 py-1.5 transition-colors ${
                  activeTab === "behaviour" ? "bg-primary text-primary-foreground font-semibold" : "text-muted-foreground hover:bg-muted"
                }`}
              >
                04 BEHAVIOUR SIGNALS
              </button>
            </div>

            {/* TAB 1: ML Model & 41 Features */}
            {activeTab === "ml" && (
              <div className="pt-4 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
                  <div>
                    <span className="text-muted-foreground">Algorithm: </span>
                    <span className="font-semibold text-foreground">{prediction?.model_label ?? "XGBoost"}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Engineered Features: </span>
                    <span className="font-semibold text-foreground">41 Dimensions</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Calculated Risk: </span>
                    <span className="font-semibold text-foreground">
                      {prediction ? `${(prediction.risk_score * 100).toFixed(2)}%` : "—"}
                    </span>
                  </div>
                </div>

                {/* Section 24: Horizontal contribution bars */}
                <div className="space-y-3 pt-2">
                  <p className="text-xs font-semibold text-foreground">
                    Top Feature Contributions (Shapley / Tree Attributions)
                  </p>
                  {(prediction?.contributions ?? []).slice(0, 7).map((c) => {
                    const isRisk = c.contribution > 0;
                    const magnitude = Math.min(100, Math.round((Math.abs(c.contribution) / maxContribution) * 100));
                    return (
                      <div key={c.feature} className="text-xs space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-foreground">{featureLabel(c.feature)}</span>
                          <span className="font-mono text-muted-foreground">
                            Val: {Number(c.value).toFixed(2)} · {isRisk ? "+Risk" : "-Risk"} ({(c.contribution * 100).toFixed(1)}%)
                          </span>
                        </div>
                        <div className="h-2 w-full rounded-full bg-muted overflow-hidden flex">
                          <div
                            className={`h-full rounded-full ${isRisk ? "bg-destructive" : "bg-emerald-500"}`}
                            style={{ width: `${Math.max(4, magnitude)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Responsible AI Fairness Disclosure */}
                <div className="rounded-xl border border-border/80 bg-muted/40 p-3.5 text-xs text-muted-foreground">
                  <span className="font-bold text-foreground font-mono uppercase text-[10px] block">
                    MODEL CONTRIBUTION ≠ PROOF OF FRAUD
                  </span>
                  <p className="mt-1">
                    These are statistical model signals that influenced the risk score. They do not constitute proof of customer wrongdoing 
                    and are never used in isolation without corroborating policy and visual evidence.
                  </p>
                </div>
              </div>
            )}

            {/* TAB 2: Policy Engine Rules */}
            {activeTab === "policy" && (
              <div className="pt-4 space-y-3">
                <p className="text-xs text-muted-foreground">
                  Deterministic business rules evaluated before machine learning inference:
                </p>
                <div className="space-y-2">
                  {(policy?.rules ?? []).map((r) => (
                    <div
                      key={r.id}
                      className={`p-3 rounded-xl border text-xs flex flex-wrap items-start justify-between gap-3 ${
                        r.passed ? "border-emerald-500/30 bg-emerald-500/5" : "border-destructive/30 bg-destructive/5"
                      }`}
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className={r.passed ? "text-emerald-600 dark:text-emerald-400 font-bold" : "text-destructive font-bold"}>
                            {r.passed ? "✓ PASSED" : "✕ FAILED"}
                          </span>
                          <span className="font-semibold text-foreground">{r.label}</span>
                          {r.blocking && (
                            <span className="rounded bg-destructive/15 text-destructive font-mono text-[9px] px-1.5 py-0.5 uppercase">
                              Blocking Rule
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-muted-foreground">{r.detail}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAB 3: Vision Inspection */}
            {activeTab === "vision" && (
              <div className="pt-4 space-y-4">
                {vision ? (
                  <div className="space-y-4 text-xs">
                    <div className="grid sm:grid-cols-2 gap-4">
                      {data.imageUrl ? (
                        <img
                          src={data.imageUrl}
                          alt="Physical evidence"
                          className="w-full max-h-56 rounded-xl border border-border object-contain bg-slate-950"
                        />
                      ) : (
                        <div className="h-44 rounded-xl border border-dashed border-border flex items-center justify-center text-muted-foreground">
                          Photo stored in evidence repository
                        </div>
                      )}

                      <div className="space-y-2.5">
                        <div>
                          <span className="text-[10px] font-mono text-muted-foreground uppercase block">Observed Condition</span>
                          <span className="font-semibold text-foreground text-sm font-mono">
                            {vision.observed_condition ?? "LIKE_NEW"}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] font-mono text-muted-foreground uppercase block">Detected Damage Score</span>
                          <span className="font-semibold text-foreground font-mono">
                            {vision.damage_score !== null ? `${(vision.damage_score * 100).toFixed(0)}%` : "0%"}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] font-mono text-muted-foreground uppercase block">Corroborates Claim?</span>
                          <Pill
                            tone={vision.matches_claim ? "positive" : vision.matches_claim === false ? "critical" : "caution"}
                          >
                            {vision.matches_claim === true ? "Supports Claim" : vision.matches_claim === false ? "Contradicts Claim" : "Inconclusive"}
                          </Pill>
                        </div>
                        <div>
                          <span className="text-[10px] font-mono text-muted-foreground uppercase block">Vision Provider</span>
                          <span className="text-muted-foreground font-mono">{vision.provider} ({vision.model})</span>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-xl border border-border bg-card p-3">
                      <span className="font-semibold text-foreground block mb-1">Visual Inspection Findings:</span>
                      <p className="text-muted-foreground mb-2">{vision.summary}</p>
                      <ul className="space-y-1 text-muted-foreground font-mono text-[11px]">
                        {(vision.findings ?? []).map((f, i) => (
                          <li key={i}>
                            • <span className="text-foreground font-semibold">{f.label}:</span> {f.detail}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">No image attached to this return case.</p>
                )}
              </div>
            )}

            {/* TAB 4: Behaviour Signals */}
            {activeTab === "behaviour" && (
              <div className="pt-4 space-y-3 text-xs">
                <div className="flex items-center justify-between pb-2 border-b border-border/60">
                  <span className="font-mono text-muted-foreground">Account Concern Score:</span>
                  <span className="font-mono font-bold text-foreground">
                    {behaviour ? `${(behaviour.behaviour_score * 100).toFixed(0)}%` : "—"}
                  </span>
                </div>
                <div className="space-y-2">
                  {(behaviour?.signals ?? []).map((s, i) => (
                    <div key={i} className="p-2.5 rounded-lg border border-border bg-card flex items-center justify-between">
                      <span className="font-medium text-foreground">{s.label}</span>
                      <Pill tone={s.direction === "risk" ? "caution" : "positive"}>
                        {s.direction === "risk" ? "+Concern" : "Clean"}
                      </Pill>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Panel>
        </div>

        {/* Right Column: Review Copilot & Human Verification Console */}
        <aside className="space-y-6 lg:sticky lg:top-24 lg:self-start">
          {/* Review Copilot Panel */}
          <Panel
            title="Review Copilot"
            description="AI-assisted guidance for human operations."
          >
            <div className="space-y-3.5 text-xs">
              <div className="rounded-xl border border-primary/30 bg-primary/5 p-3.5">
                <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-primary block">
                  AI RECOMMENDATION
                </span>
                <p className="font-display text-sm font-bold text-foreground mt-0.5">
                  {originalSystemDecision ? DECISION_LABELS[originalSystemDecision.outcome] : "No decision recorded"}
                </p>
                <p className="mt-1 text-muted-foreground">
                  {hasConflict
                    ? "Escalated due to conflicting visual evidence and return claim."
                    : "Supported by consistent multi-signal evidence."}
                </p>
              </div>

              <div>
                <span className="font-mono text-[10px] uppercase text-muted-foreground block font-semibold">
                  Suggested Action
                </span>
                <p className="mt-1 text-foreground leading-relaxed">
                  {hasConflict
                    ? "Contact consumer to request uncompressed photo showing specific fracture, or accept return on physical inspection condition."
                    : "Proceed with standard return label generation."}
                </p>
              </div>
            </div>
          </Panel>

          {/* SECTION 35: Human Verification Action Box */}
          <Panel
            title="Human Verification Console"
            description="Record final human operator verdict. Overrides system recommendations cleanly."
          >
            {latestReview && (
              <div className="mb-4 rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3 text-xs">
                <div className="flex items-center justify-between font-mono">
                  <span className="font-bold text-emerald-800 dark:text-emerald-300">
                    ✓ HUMAN DECISION LOGGED
                  </span>
                  <span className="text-muted-foreground text-[10px]">
                    {new Date(latestReview.created_at).toLocaleTimeString()}
                  </span>
                </div>
                <p className="mt-1 text-foreground">
                  Reviewer <span className="font-semibold">{latestReview.reviewer_name}</span> decided:{" "}
                  <span className="font-bold">{DECISION_LABELS[latestReview.verdict]}</span>
                </p>
                <div className="mt-2 flex items-center gap-2 font-mono text-[11px]">
                  <span className="text-muted-foreground">AI Agreement:</span>
                  <Pill tone={latestReview.agreed_with_system ? "positive" : "caution"}>
                    {latestReview.agreed_with_system ? "AGREED WITH AI" : "OVERRODE AI"}
                  </Pill>
                </div>
              </div>
            )}

            <div className="space-y-4 text-xs">
              <div>
                <label className="font-semibold text-muted-foreground block mb-1 font-mono uppercase text-[10px]">
                  Reviewer Identity
                </label>
                <input
                  value={reviewer}
                  onChange={(e) => setReviewer(e.target.value)}
                  className="w-full rounded-xl border border-input bg-background px-3 py-2 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>

              <div>
                <label className="font-semibold text-muted-foreground block mb-2 font-mono uppercase text-[10px]">
                  Select Human Verdict
                </label>
                <div className="grid grid-cols-1 gap-2">
                  <button
                    type="button"
                    onClick={() => setVerdict("AUTO_APPROVE")}
                    className={`p-2.5 rounded-xl border text-left font-semibold transition-all ${
                      verdict === "AUTO_APPROVE"
                        ? "border-emerald-500 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 shadow-[0_3px_0_0_#059669]"
                        : "border-slate-200 bg-white shadow-[0_2px_0_0_#E2E8F0] hover:bg-slate-50"
                    }`}
                  >
                    ✓ APPROVE RETURN (Issue Instant Refund)
                  </button>
                  <button
                    type="button"
                    onClick={() => setVerdict("REFUND_ON_INSPECTION")}
                    className={`p-2.5 rounded-xl border text-left font-semibold transition-all ${
                      verdict === "REFUND_ON_INSPECTION"
                        ? "border-[#1769E0] bg-[#EAF3FF] text-[#1769E0] shadow-[0_3px_0_0_#1769E0]"
                        : "border-slate-200 bg-white shadow-[0_2px_0_0_#E2E8F0] hover:bg-slate-50"
                    }`}
                  >
                    ⟳ REFUND ON WAREHOUSE INSPECTION
                  </button>
                  <button
                    type="button"
                    onClick={() => setVerdict("DECLINE")}
                    className={`p-2.5 rounded-xl border text-left font-semibold transition-all ${
                      verdict === "DECLINE"
                        ? "border-destructive bg-destructive/15 text-destructive shadow-[0_3px_0_0_#DC2626]"
                        : "border-slate-200 bg-white shadow-[0_2px_0_0_#E2E8F0] hover:bg-slate-50"
                    }`}
                  >
                    ✕ DECLINE RETURN (Reject Claim)
                  </button>
                </div>
              </div>

              <div>
                <label className="font-semibold text-muted-foreground block mb-1 font-mono uppercase text-[10px]">
                  Investigation Notes / Rationale
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Photo inspection confirmed pristine housing; customer offered partial store credit."
                  className="w-full rounded-xl border border-input bg-background p-2.5 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>

              <button
                type="button"
                disabled={mutation.isPending}
                onClick={() => mutation.mutate()}
                className="btn-3d-primary w-full rounded-full px-6 py-3.5 text-sm disabled:opacity-50"
              >
                {mutation.isPending ? "Recording verdict…" : "CONFIRM VERIFIED DECISION"}
              </button>
            </div>
          </Panel>

          {/* Audit Events for this Case */}
          <Panel title="Case Timeline & Audit Trail">
            <ol className="relative space-y-3 border-l border-border pl-4 text-xs font-mono">
              {events.map((e) => (
                <li key={e.id} className="relative">
                  <span className="absolute -left-[21px] top-1 size-2 rounded-full bg-primary" />
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                    <span className="uppercase font-semibold text-foreground">{e.stage}</span>
                    <span>{new Date(e.created_at).toLocaleTimeString()}</span>
                  </div>
                  <p className="text-muted-foreground text-[11px] mt-0.5">{e.summary}</p>
                </li>
              ))}
            </ol>
          </Panel>
        </aside>
      </div>
    </AppShell>
  );
}
