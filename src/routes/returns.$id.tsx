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
import {
  Network,
  Flame,
  MapPin,
  AlertOctagon,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ExternalLink,
  Cpu,
  Layers,
  TrendingUp,
  TrendingDown,
  Search,
  Sliders,
  ChevronDown,
  ChevronUp,
  Check,
  Store,
  ArrowDown,
  ShieldCheck,
  RefreshCw,
} from "lucide-react";

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
  const [activeTab, setActiveTab] = useState<"ml" | "policy" | "vision" | "behaviour" | "network" | "geo" | "cross_merchant">("ml");
  const [selectedTraceNode, setSelectedTraceNode] = useState<string | null>(null);
  const [selectedModelKey, setSelectedModelKey] = useState<"xgboost" | "logistic_regression" | "decision_tree">("xgboost");
  const [featureSearchQuery, setFeatureSearchQuery] = useState("");
  const [showAllFeaturesTable, setShowAllFeaturesTable] = useState(false);

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
      delivery_delay_days?: number;
      delivery_days?: number;
      review_score?: number;
      customer_rating?: number;
      num_items: number;
      product_name?: string;
      brand?: string;
      customers: {
        id?: string;
        external_id?: string;
        customer_name?: string;
        city: string;
        state: string;
        total_orders: number;
        total_returns?: number;
        return_rate?: number;
        total_spent: number;
        avg_order_value?: number;
        avg_customer_rating?: number;
        avg_review_score?: number;
        low_rating_count?: number;
        past_orders?: {
          order_id: string;
          order_date: string;
          product_name: string;
          category: string;
          brand: string;
          quantity: number;
          amount_inr: number;
          original_price_inr?: number;
          discount_percent?: number;
          delivery_days: number;
          customer_rating: number;
          payment_method?: string;
          return_status: string;
          return_reason: string | null;
          evidence_image_url?: string | null;
        }[];
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
    all_models?: {
      models: Record<
        string,
        {
          modelLabel: string;
          modelVersion: string;
          riskScore: number;
          riskLevel: string;
          confidence: number;
          contributions: { feature: string; value: number; contribution: number }[];
          rawOutput: Record<string, any>;
        }
      >;
      consensus: {
        agreement_rate: number;
        all_agree: boolean;
        consensus_band: string;
        avg_risk_score: number;
        contributions: { feature: string; value: number; contribution: number }[];
      };
    };
    feature_vector?: Record<string, number>;
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

  const network = data.network;
  const geo = data.geo;
  const crossMerchant = (data as any).cross_merchant || (data as any).crossMerchant;
  const hasCrossMerchantFlag = Boolean(crossMerchant?.hasCrossMerchantMatch && crossMerchant.riskLevel !== "CLEAN");
  const investigation = data.investigation;

  // Evidence conflict detection
  const hasConflict = Boolean(
    hasCrossMerchantFlag ||
      (fusion?.conflicts && fusion.conflicts.length > 0) ||
      (vision && vision.matches_claim === false && (request.reason_code === "DAMAGED" || request.reason_code === "DEFECTIVE")),
  );

  const isAligned = !hasConflict && fusion && fusion.agreement >= 0.55 && policy?.eligible;
  const isInsufficient = !vision || vision.is_fallback;

  const maxContribution = Math.max(
    ...(prediction?.contributions ?? []).map((c) => Math.abs(c.contribution)),
    0.0001,
  );

  const multiModels = prediction?.all_models;
  const activeModel =
    multiModels?.models?.[selectedModelKey] || {
      modelLabel: prediction?.model_label || "XGBoost Return-Risk (139 Trees)",
      modelVersion: "2.1.0",
      riskScore: prediction?.risk_score ?? 0.35,
      riskLevel: prediction?.risk_level ?? "MEDIUM",
      confidence: prediction?.confidence ?? 0.85,
      contributions: prediction?.contributions ?? [],
      rawOutput: {},
    };

  const activeContributions = activeModel.contributions || [];
  const maxModelContribution = Math.max(
    ...activeContributions.map((c) => Math.abs(c.contribution)),
    0.0001,
  );

  const riskDrivers = activeContributions.filter((c) => c.contribution > 0);
  const trustFactors = activeContributions.filter((c) => c.contribution < 0);

  const featureVectorData = prediction?.feature_vector || {};
  const allFeatureEntries = Object.entries(featureVectorData).map(([key, val]) => {
    const matchedContrib = activeContributions.find((c) => c.feature === key);
    return {
      key,
      label: featureLabel(key),
      value: val,
      contribution: matchedContrib?.contribution ?? 0,
    };
  });

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
              Customer: <span className="text-white font-medium">{order?.customers?.customer_name || (order as any)?.customer_name || "Customer"} ({order?.customers?.city ?? "Unknown"}, {order?.customers?.state ?? ""})</span> ·{" "}
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
            <span className="text-slate-500 uppercase text-[10px] block">ORDER & ITEM</span>
            <span className="text-slate-200 font-semibold block truncate">
              {order?.product_name || order?.external_id || "Direct reference"}
            </span>
            <span className="text-[10px] text-slate-400 font-normal">
              {order?.external_id}
            </span>
          </div>
          <div>
            <span className="text-slate-500 uppercase text-[10px] block">ORDER VALUE</span>
            <span className="text-slate-200 font-semibold">{order ? formatCurrency(Number(order.total_price)) : "—"}</span>
          </div>
          <div>
            <span className="text-slate-500 uppercase text-[10px] block">CUSTOMER HISTORICAL RETURN RATE</span>
            <span className={`font-semibold ${Number(order?.customers?.return_rate ?? 0) > 0.3 ? "text-rose-400" : "text-emerald-400"}`}>
              {((Number(order?.customers?.return_rate ?? 0)) * 100).toFixed(1)}% ({order?.customers?.total_returns ?? 0} returns)
            </span>
          </div>
          <div>
            <span className="text-slate-500 uppercase text-[10px] block">LIFETIME ORDERS & SPEND</span>
            <span className="text-slate-200 font-semibold">
              {order?.customers?.total_orders ?? 14} orders · {formatCurrency(Number(order?.customers?.total_spent ?? order?.total_price ?? 0))}
            </span>
          </div>
        </div>
      </section>

      {/* TrustLoop 2.0: Connected to Fraud Ring Alert Banner */}
      {network?.ringId && (
        <div className="mb-8 rounded-2xl border-2 border-red-500 bg-red-50/90 p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="p-2.5 rounded-xl bg-red-100 text-red-600">
                <Network className="w-6 h-6 animate-pulse" />
              </span>
              <div>
                <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-red-700 block">
                  CONNECTED TO FRAUD RING
                </span>
                <h3 className="text-lg font-bold text-red-950">
                  Syndicate: {network.ringName || network.ringId}
                </h3>
                <p className="text-xs text-red-800/90 mt-0.5">
                  <strong>{network.metrics.connectedAccounts} connected accounts</strong> share {network.metrics.sharedDevices} device fingerprints & {network.metrics.sharedAddresses} drop addresses.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="text-right">
                <span className="text-[10px] font-mono uppercase text-red-700 block font-bold">
                  NETWORK RISK
                </span>
                <span className="text-2xl font-mono font-black text-red-600">
                  {network.networkRisk}<span className="text-xs font-semibold text-slate-400">/100</span>
                </span>
              </div>
              <Link
                to="/fraud-rings"
                className="rounded-xl bg-red-600 text-white px-3.5 py-2 text-xs font-bold hover:bg-red-700 transition-colors shadow-xs"
              >
                Investigate Ring &rarr;
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* TrustLoop 2.0: 6-Pillar Risk Breakdown */}
      <div className="mb-8">
        <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-500 mb-3">
          TRUSTLOOP 2.0 MULTI-PILLAR RISK BREAKDOWN
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <Stat
            label="ML Return Risk"
            value={prediction ? `${(Number(prediction.risk_score) * 100).toFixed(0)}` : "—"}
            hint={prediction ? `${prediction.model_label} · ${prediction.risk_level}` : undefined}
          />
          <Stat
            label="Policy Engine"
            value={policy ? (policy.eligible ? "PASS" : "BLOCK") : "—"}
            hint={policy?.eligible ? "Rules compliant" : "Rule violation"}
          />
          <Stat
            label="Behaviour"
            value={behaviour ? `${(Number(behaviour.behaviour_score) * 100).toFixed(0)}` : "—"}
            hint="Customer velocity vector"
          />
          <Stat
            label="Vision Damage"
            value={
              vision
                ? vision.is_fallback
                  ? "Fallback"
                  : vision.damage_score !== null
                  ? `${Math.round(vision.damage_score * 100)}`
                  : vision.matches_claim === false
                  ? "0 (Pristine)"
                  : "Corroborates"
                : "No photo"
            }
            hint={vision?.observed_condition ?? "Image analysis"}
          />
          <Stat
            label="Network Risk"
            value={network ? `${network.networkRisk}` : "14"}
            hint={network?.ringId ? `Linked to ${network.ringId}` : "Single account"}
          />
          <Stat
            label="Geo Hotspot"
            value={geo ? `${geo.hotspotScore}` : "45"}
            hint={geo ? `${geo.areaName.split(" ")[0]} · ${geo.riskTier.split(" ")[0]}` : "Normalized area"}
          />
        </div>
      </div>

      {/* TrustLoop 2.0: WHY THIS RETURN IS FLAGGED */}
      <div className="mb-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-3">
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2">
            <AlertOctagon className="w-4 h-4 text-[#1769E0]" />
            Why This Return Is Flagged
          </h3>
          <span className="text-xs font-mono text-slate-500">
            Multi-Signal Cross Examination
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-slate-50">
            <span className="text-emerald-600 font-bold shrink-0 mt-0.5">✓</span>
            <div>
              <p className="font-semibold text-slate-800">ML Return Risk Assessment</p>
              <p className="text-slate-500 mt-0.5">
                Baseline predictive model calculated {prediction ? (Number(prediction.risk_score) * 100).toFixed(1) : 42}% probability based on logistics and customer features.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-slate-50">
            {hasConflict ? (
              <span className="text-[#DC2626] font-bold shrink-0 mt-0.5">⚠</span>
            ) : (
              <span className="text-emerald-600 font-bold shrink-0 mt-0.5">✓</span>
            )}
            <div>
              <p className="font-semibold text-slate-800">Evidence Conflict Status</p>
              <p className="text-slate-500 mt-0.5">
                {hasConflict
                  ? "Customer claimed physical transit damage, but visual AI detected undamaged hardware."
                  : "Submitted photo evidence aligns with reported defect."}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-slate-50">
            {network?.ringId ? (
              <span className="text-[#DC2626] font-bold shrink-0 mt-0.5">⚠</span>
            ) : (
              <span className="text-emerald-600 font-bold shrink-0 mt-0.5">✓</span>
            )}
            <div>
              <p className="font-semibold text-slate-800">Relationship Network Clustering</p>
              <p className="text-slate-500 mt-0.5">
                {network?.ringId
                  ? `Connected to suspicious syndicate ${network.ringId} across ${network.metrics.connectedAccounts} accounts and ${network.metrics.sharedDevices} shared devices.`
                  : "No shared device fingerprints or suspicious cross-account linkage detected."}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-slate-50">
            {geo && geo.hotspotScore >= 55 ? (
              <span className="text-orange-500 font-bold shrink-0 mt-0.5">⚠</span>
            ) : (
              <span className="text-emerald-600 font-bold shrink-0 mt-0.5">✓</span>
            )}
            <div>
              <p className="font-semibold text-slate-800">Regional Hotspot Context</p>
              <p className="text-slate-500 mt-0.5">
                {geo && geo.hotspotScore >= 55
                  ? `Located in elevated return hotspot ${geo.areaName} (+${geo.adjustment} priority adjustment).`
                  : `Normal return density area (${geo?.areaName ?? "India"} with ${(geo?.metrics.returnRate ?? 0.12) * 100}% return rate).`}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* TrustLoop 2.0: GEOGRAPHICAL CONTEXT & NETWORK CONTEXT Modules */}
      <div className="mb-8 grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Geographical Context Module */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-3">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-[#F97316]" />
              <h3 className="text-sm font-bold text-[#0B1F3A]">Geographical Context</h3>
            </div>
            <Link
              to="/risk-map"
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#1769E0] hover:underline"
            >
              <span>View Hotspot</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Current Area:</span>
              <strong className="text-slate-900">{geo?.areaName ?? "Maharashtra (MH)"}</strong>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Return Rate:</span>
              <strong className="text-slate-900 font-mono">
                {geo ? (geo.metrics.returnRate * 100).toFixed(1) : "13.5"}%
              </strong>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">High-Risk Return Rate:</span>
              <strong className="text-orange-600 font-mono">
                {geo ? (geo.metrics.highRiskRate * 100).toFixed(1) : "14.8"}%
              </strong>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Regional Hotspot Score:</span>
              <strong className="text-slate-900 font-mono">{geo?.hotspotScore ?? 82} / 100</strong>
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <span className="text-slate-500">Investigation Contribution:</span>
              <strong className="text-[#1769E0] font-mono font-bold">
                +{geo?.adjustment ?? 8} priority points
              </strong>
            </div>
          </div>
        </div>

        {/* Network Context Module */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-3">
            <div className="flex items-center gap-2">
              <Network className="w-4 h-4 text-[#9333EA]" />
              <h3 className="text-sm font-bold text-[#0B1F3A]">Network Context</h3>
            </div>
            <Link
              to="/fraud-rings"
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#1769E0] hover:underline"
            >
              <span>Investigate Network</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Connected Accounts:</span>
              <strong className="text-slate-900 font-mono">
                {network?.metrics.connectedAccounts ?? 1}
              </strong>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Shared Devices:</span>
              <strong className="text-slate-900 font-mono">
                {network?.metrics.sharedDevices ?? 1}
              </strong>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Shared Addresses:</span>
              <strong className="text-slate-900 font-mono">
                {network?.metrics.sharedAddresses ?? 1}
              </strong>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Network Risk:</span>
              <strong className="text-[#DC2626] font-mono font-bold">
                {network?.networkRisk ?? 14} / 100
              </strong>
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <span className="text-slate-500">Associated Syndicate:</span>
              <strong className="text-slate-800 font-mono">
                {network?.ringId ?? "None (Isolated Case)"}
              </strong>
            </div>
          </div>
        </div>
      </div>

      {/* CROSS-MERCHANT CONSORTIUM INTELLIGENCE BANNER */}
      {hasCrossMerchantFlag && crossMerchant && (
        <section className="mb-8 rounded-2xl border-2 border-red-500 bg-red-500/10 p-6 shadow-md dark:bg-red-950/40">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="size-3.5 rounded-full bg-red-500 animate-ping" />
              <div>
                <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-red-700 dark:text-red-300 block">
                  CROSS-MERCHANT NETWORK CONSORTIUM ALERT · URBANBASKET ⇄ NEXACART
                </span>
                <h2 className="font-display text-lg font-bold text-red-900 dark:text-red-100">
                  {crossMerchant.headline}
                </h2>
              </div>
            </div>
            <span className="rounded bg-red-500/20 text-red-800 dark:text-red-200 font-mono text-xs font-bold px-3 py-1 border border-red-500/40 uppercase">
              Action: Reverse Logistics Inspection Mandated
            </span>
          </div>

          {/* 3-Pillar Cross-Merchant Flow Diagram */}
          <div className="mt-5 grid gap-4 lg:grid-cols-3 pt-2">
            {/* Merchant 1: UrbanBasket */}
            <div className="rounded-xl border border-red-500/30 bg-card p-4 text-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm text-foreground flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-red-500" />
                  URBANBASKET
                </span>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300">
                  SUSPICIOUS HISTORY
                </span>
              </div>
              <p className="text-muted-foreground text-[11px]">
                Matching customer profile stored in demo merchant system:
              </p>
              <div className="grid grid-cols-2 gap-2 font-mono text-[11px] pt-1 border-t border-border/60">
                <div>
                  <span className="text-muted-foreground block text-[10px]">Orders / Returns</span>
                  <span className="font-bold text-foreground">
                    {crossMerchant.matchedMerchant?.profile.totalOrders} orders · {crossMerchant.matchedMerchant?.profile.totalReturns} returns
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[10px]">Return Rate</span>
                  <span className="font-bold text-red-600 dark:text-red-400">
                    {((crossMerchant.matchedMerchant?.profile.returnRate ?? 0.667) * 100).toFixed(1)}%
                  </span>
                </div>
              </div>
              <div className="text-[11px] text-red-700 dark:text-red-300 bg-red-500/10 p-2 rounded-lg font-medium">
                ⚠ {crossMerchant.matchedMerchant?.profile.flags[0]}
              </div>
            </div>

            {/* Merchant 2: NexaCart */}
            <div className="rounded-xl border border-amber-500/30 bg-card p-4 text-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm text-foreground flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  NEXACART (Current)
                </span>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300">
                  NORMAL HISTORY
                </span>
              </div>
              <p className="text-muted-foreground text-[11px]">
                Customer initiates return request on NexaCart:
              </p>
              <div className="grid grid-cols-2 gap-2 font-mono text-[11px] pt-1 border-t border-border/60">
                <div>
                  <span className="text-muted-foreground block text-[10px]">Orders / Returns</span>
                  <span className="font-bold text-foreground">
                    {crossMerchant.currentMerchant.profile.orders} order · {crossMerchant.currentMerchant.profile.returns} returns
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[10px]">Local Return Rate</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">0.0% (Clean)</span>
                </div>
              </div>
              <div className="text-[11px] text-muted-foreground bg-muted/40 p-2 rounded-lg">
                Without consortium intelligence, NexaCart would naively auto-approve this high-value return claim.
              </div>
            </div>

            {/* Pillar 3: TrustLoop Cross-Merchant Consortium */}
            <div className="rounded-xl border border-primary/40 bg-card p-4 text-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm text-primary flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-primary" />
                  TRUSTLOOP ENGINE
                </span>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-primary/10 text-primary">
                  CONSORTIUM EVIDENCE
                </span>
              </div>
              <p className="text-muted-foreground text-[11px]">
                Multi-pillar intelligence combines with Cross-Merchant Evidence:
              </p>
              <ul className="space-y-1 text-[11px] text-foreground font-medium pt-1 border-t border-border/60">
                <li className="flex items-center gap-1.5">✓ Existing ML Model (XGBoost)</li>
                <li className="flex items-center gap-1.5">✓ Existing Behaviour & Policy Engine</li>
                <li className="flex items-center gap-1.5">✓ Existing Vision Evidence Analysis</li>
                <li className="flex items-center gap-1.5 text-red-600 dark:text-red-400 font-bold">
                  ★ NEW CROSS-MERCHANT EVIDENCE (+25 Points)
                </li>
              </ul>
            </div>
          </div>
        </section>
      )}

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
                    <span className={Number(order?.total_price ?? 0) >= 25000 ? "text-amber-600 dark:text-amber-400 font-bold" : "text-foreground font-bold"}>
                      {Number(order?.total_price ?? 0) >= 25000 ? "YES (≥ ₹25,000)" : "NO (< ₹25,000)"}
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
                  <div className="rounded-lg border border-border p-2 bg-muted/20">
                    <span className="text-muted-foreground block text-[10px]">CROSS-MERCHANT MATCH?</span>
                    <span className={hasCrossMerchantFlag ? "text-destructive font-bold" : "text-emerald-600 dark:text-emerald-400 font-bold"}>
                      {hasCrossMerchantFlag ? "YES (UrbanBasket Abuse)" : "NO (Clean Consortium)"}
                    </span>
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
              <button
                type="button"
                onClick={() => setActiveTab("network")}
                className={`rounded-lg px-3 py-1.5 transition-colors ${
                  activeTab === "network" ? "bg-primary text-primary-foreground font-semibold" : "text-muted-foreground hover:bg-muted"
                }`}
              >
                05 FRAUD RING GRAPH
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("geo")}
                className={`rounded-lg px-3 py-1.5 transition-colors ${
                  activeTab === "geo" ? "bg-primary text-primary-foreground font-semibold" : "text-muted-foreground hover:bg-muted"
                }`}
              >
                06 GEO HOTSPOT
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("cross_merchant")}
                className={`rounded-lg px-3 py-1.5 transition-colors relative flex items-center gap-1.5 ${
                  activeTab === "cross_merchant"
                    ? "bg-primary text-primary-foreground font-semibold"
                    : "text-muted-foreground hover:bg-muted"
                }`}
              >
                <span>07 CROSS-MERCHANT INTEL</span>
                {hasCrossMerchantFlag && (
                  <span className="size-2 rounded-full bg-red-500 animate-pulse" />
                )}
              </button>
            </div>

            {/* TAB 1: ML Model & 38 Features (XGBoost, Logistic Regression, Decision Tree) */}
            {activeTab === "ml" && (
              <div className="pt-4 space-y-6">
                {/* 1. Multi-Model Consensus & Algorithm Switcher */}
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Cpu className="w-4 h-4 text-[#1769E0]" />
                      <span className="font-mono text-xs font-bold uppercase tracking-wider text-foreground">
                        MULTI-MODEL RETURN-RISK CONSENSUS ENGINE
                      </span>
                    </div>
                    {multiModels?.consensus && (
                      <div className="flex items-center gap-2">
                        <span
                          className={`font-mono text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${
                            multiModels.consensus.all_agree
                              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                              : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30"
                          }`}
                        >
                          {multiModels.consensus.all_agree
                            ? `✓ Consensus: 3/3 Models Agree (${multiModels.consensus.consensus_band} BAND)`
                            : `⚠ Split Consensus (${(multiModels.consensus.agreement_rate * 100).toFixed(0)}% Agreement)`}
                        </span>
                        <span className="font-mono text-[11px] text-muted-foreground">
                          Avg Risk: {(multiModels.consensus.avg_risk_score * 100).toFixed(1)}%
                        </span>
                      </div>
                    )}
                  </div>

                  {/* 3 Model Selection Cards */}
                  <div className="grid gap-3 sm:grid-cols-3">
                    {[
                      {
                        key: "xgboost" as const,
                        label: "XGBoost (139 Trees)",
                        badge: "PRIMARY PROD",
                        desc: "Cover-weighted gradient boosted decision trees with cover path attribution",
                        model: multiModels?.models?.["xgboost"] || activeModel,
                      },
                      {
                        key: "logistic_regression" as const,
                        label: "Logistic Regression",
                        badge: "L2 REGULARIZED",
                        desc: "Standardized beta coefficients with monotonic log-odds margins",
                        model: multiModels?.models?.["logistic_regression"],
                      },
                      {
                        key: "decision_tree" as const,
                        label: "Decision Tree (CART)",
                        badge: "INTERPRETABLE",
                        desc: "Orthogonal binary recursive partitioning tree with Gini splits",
                        model: multiModels?.models?.["decision_tree"],
                      },
                    ].map((item) => {
                      const isSelected = selectedModelKey === item.key;
                      const score = item.model ? (item.model.riskScore * 100).toFixed(1) : "—";
                      const band = item.model?.riskLevel ?? "MEDIUM";
                      return (
                        <button
                          key={item.key}
                          type="button"
                          onClick={() => setSelectedModelKey(item.key)}
                          className={`p-3.5 rounded-xl border text-left transition-all relative overflow-hidden ${
                            isSelected
                              ? "border-[#1769E0] bg-[#1769E0]/5 ring-2 ring-[#1769E0]/30 shadow-xs"
                              : "border-border/80 bg-card hover:border-slate-300 dark:hover:border-slate-700"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1 mb-1">
                            <span className="font-mono text-[10px] font-bold text-[#1769E0] uppercase tracking-wider">
                              {item.badge}
                            </span>
                            <span
                              className={`font-mono text-[10px] font-bold px-1.5 py-0.2 rounded ${
                                band === "HIGH"
                                  ? "bg-destructive/10 text-destructive"
                                  : band === "LOW"
                                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                    : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                              }`}
                            >
                              {band}
                            </span>
                          </div>
                          <div className="font-semibold text-foreground text-xs">{item.label}</div>
                          <div className="mt-2 flex items-baseline gap-2">
                            <span className="font-mono text-xl font-bold text-foreground">{score}%</span>
                            <span className="text-[11px] text-muted-foreground font-mono">risk prob.</span>
                          </div>
                          <p className="mt-1 text-[10px] text-muted-foreground line-clamp-2 leading-relaxed">
                            {item.desc}
                          </p>
                          {isSelected && (
                            <div className="absolute top-2 right-2 size-2 rounded-full bg-[#1769E0]" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 2. Selected Model Metadata Card */}
                <div className="rounded-xl border border-border/70 bg-muted/20 p-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-2.5 text-xs">
                    <div>
                      <span className="font-mono text-muted-foreground">Active Model Architecture: </span>
                      <strong className="font-mono text-foreground font-semibold">
                        {activeModel.modelLabel}
                      </strong>
                    </div>
                    <div className="flex items-center gap-3 font-mono text-[11px]">
                      <span>Confidence: {(Number(activeModel.confidence) * 100).toFixed(0)}%</span>
                      <span>Version: {activeModel.modelVersion}</span>
                      <span>Features: 38 Dimensions</span>
                    </div>
                  </div>

                  {/* Mathematical details based on model */}
                  <div className="text-xs text-muted-foreground leading-relaxed">
                    {selectedModelKey === "xgboost" && (
                      <p>
                        <strong className="text-foreground">XGBoost Decision Trace: </strong>
                        Evaluated across 139 shallow boosted trees. Log-odds margin:{" "}
                        <span className="font-mono text-foreground font-semibold">
                          {activeModel.rawOutput?.["margin"] !== undefined
                            ? Number(activeModel.rawOutput["margin"]).toFixed(4)
                            : "calculated"}
                        </span>
                        . Passed through sigmoid transform to yield{" "}
                        <span className="font-mono text-foreground font-semibold">
                          {(activeModel.riskScore * 100).toFixed(2)}%
                        </span>{" "}
                        posterior risk probability. Feature attributions represent cover-weighted split gains along decision paths.
                      </p>
                    )}
                    {selectedModelKey === "logistic_regression" && (
                      <p>
                        <strong className="text-foreground">Logistic Regression Decision Trace: </strong>
                        Standardized linear summation:{" "}
                        <span className="font-mono text-foreground font-semibold">
                          z = β₀ + Σ(βᵢ · xᵢ) ={" "}
                          {activeModel.rawOutput?.["z"] !== undefined
                            ? Number(activeModel.rawOutput["z"]).toFixed(4)
                            : "calculated"}
                        </span>
                        . Evaluated via standard logistic sigmoid function. Feature contributions correspond to individual signed beta terms (βᵢ · xᵢ).
                      </p>
                    )}
                    {selectedModelKey === "decision_tree" && (
                      <p>
                        <strong className="text-foreground">CART Decision Tree Trace: </strong>
                        Traversed orthogonal binary splits down to leaf node ID:{" "}
                        <span className="font-mono text-foreground font-semibold">
                          {activeModel.rawOutput?.["leaf_id"] ?? "terminal"}
                        </span>
                        . Tree depth: {activeModel.rawOutput?.["depth"] ?? 8} levels. Leaf risk probability calculated by empirical training distribution.
                      </p>
                    )}
                  </div>
                </div>

                {/* 3. Dual-Directional Feature Attribution (Risk Drivers vs Mitigating Trust Factors) */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">
                        Feature Attribution Spectrum ({activeModel.modelLabel.split(" ")[0]})
                      </h4>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Deconstruction of positive drivers that escalated risk vs. mitigating signals that lowered risk.
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    {/* Column 1: Risk Escalators */}
                    <div className="rounded-xl border border-destructive/20 bg-destructive/[0.02] p-3.5 space-y-3">
                      <div className="flex items-center justify-between border-b border-destructive/15 pb-2">
                        <span className="font-mono text-xs font-bold text-destructive flex items-center gap-1.5">
                          <TrendingUp className="w-3.5 h-3.5" />
                          Risk Escalators (+Risk)
                        </span>
                        <span className="font-mono text-[10px] text-muted-foreground">
                          {riskDrivers.length} features
                        </span>
                      </div>

                      {riskDrivers.length === 0 ? (
                        <p className="text-xs text-muted-foreground py-2 text-center">
                          No significant positive risk drivers detected.
                        </p>
                      ) : (
                        <div className="space-y-2.5">
                          {riskDrivers.slice(0, 6).map((c) => {
                            const magnitude = Math.min(
                              100,
                              Math.round((Math.abs(c.contribution) / maxModelContribution) * 100),
                            );
                            return (
                              <div key={c.feature} className="text-xs space-y-1">
                                <div className="flex items-center justify-between">
                                  <span className="font-medium text-foreground text-[11px]">
                                    {featureLabel(c.feature)}
                                  </span>
                                  <span className="font-mono text-destructive text-[11px] font-semibold">
                                    +{(c.contribution * 100).toFixed(1)}%
                                  </span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden flex">
                                    <div
                                      className="h-full rounded-full bg-destructive transition-all duration-300"
                                      style={{ width: `${Math.max(6, magnitude)}%` }}
                                    />
                                  </div>
                                  <span className="font-mono text-[10px] text-muted-foreground shrink-0 w-14 text-right">
                                    {typeof c.value === "number"
                                      ? c.value >= 1000
                                        ? `₹${c.value.toLocaleString("en-IN")}`
                                        : c.value % 1 === 0
                                          ? c.value
                                          : c.value.toFixed(2)
                                      : c.value}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Column 2: Mitigating Trust Factors */}
                    <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.02] p-3.5 space-y-3">
                      <div className="flex items-center justify-between border-b border-emerald-500/15 pb-2">
                        <span className="font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                          <TrendingDown className="w-3.5 h-3.5" />
                          Mitigating Trust Factors (-Risk)
                        </span>
                        <span className="font-mono text-[10px] text-muted-foreground">
                          {trustFactors.length} features
                        </span>
                      </div>

                      {trustFactors.length === 0 ? (
                        <p className="text-xs text-muted-foreground py-2 text-center">
                          No significant mitigating factors detected.
                        </p>
                      ) : (
                        <div className="space-y-2.5">
                          {trustFactors.slice(0, 6).map((c) => {
                            const magnitude = Math.min(
                              100,
                              Math.round((Math.abs(c.contribution) / maxModelContribution) * 100),
                            );
                            return (
                              <div key={c.feature} className="text-xs space-y-1">
                                <div className="flex items-center justify-between">
                                  <span className="font-medium text-foreground text-[11px]">
                                    {featureLabel(c.feature)}
                                  </span>
                                  <span className="font-mono text-emerald-600 dark:text-emerald-400 text-[11px] font-semibold">
                                    {(c.contribution * 100).toFixed(1)}%
                                  </span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden flex">
                                    <div
                                      className="h-full rounded-full bg-emerald-500 transition-all duration-300"
                                      style={{ width: `${Math.max(6, magnitude)}%` }}
                                    />
                                  </div>
                                  <span className="font-mono text-[10px] text-muted-foreground shrink-0 w-14 text-right">
                                    {typeof c.value === "number"
                                      ? c.value >= 1000
                                        ? `₹${c.value.toLocaleString("en-IN")}`
                                        : c.value % 1 === 0
                                          ? c.value
                                          : c.value.toFixed(2)
                                      : c.value}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* 4. Complete 38-Engineered Feature Vector Explorer */}
                <div className="rounded-xl border border-border bg-card p-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-2">
                        <Layers className="w-3.5 h-3.5 text-[#1769E0]" />
                        Indian E-Commerce 38-Feature Vector Explorer
                      </h4>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Inspect all engineered feature values computed specifically for this order.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowAllFeaturesTable(!showAllFeaturesTable)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-muted/30 hover:bg-muted font-mono text-xs font-semibold text-foreground transition-colors"
                    >
                      <span>{showAllFeaturesTable ? "Collapse Table" : "Inspect All 38 Features"}</span>
                      {showAllFeaturesTable ? (
                        <ChevronUp className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>

                  {showAllFeaturesTable && (
                    <div className="pt-2 space-y-3 border-t border-border/60">
                      {/* Search bar */}
                      <div className="relative">
                        <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <input
                          type="text"
                          value={featureSearchQuery}
                          onChange={(e) => setFeatureSearchQuery(e.target.value)}
                          placeholder="Filter features by name or key (e.g. return_rate, delivery, amount)..."
                          className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-border bg-background focus:outline-none focus:ring-1 focus:ring-[#1769E0]"
                        />
                      </div>

                      {/* Feature Table */}
                      <div className="overflow-x-auto max-h-80 border border-border rounded-lg">
                        <table className="w-full text-xs">
                          <thead className="sticky top-0 bg-muted/80 backdrop-blur-xs z-10">
                            <tr className="border-b border-border text-left font-mono uppercase text-[10px] text-muted-foreground">
                              <th className="py-2 px-3 font-semibold">Feature Dimension</th>
                              <th className="py-2 px-3 font-semibold">Feature Key</th>
                              <th className="py-2 px-3 font-semibold text-right">Computed Value</th>
                              <th className="py-2 px-3 font-semibold text-right">Active Model Impact</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border/60 font-mono text-[11px]">
                            {allFeatureEntries
                              .filter(
                                (f) =>
                                  !featureSearchQuery ||
                                  f.label.toLowerCase().includes(featureSearchQuery.toLowerCase()) ||
                                  f.key.toLowerCase().includes(featureSearchQuery.toLowerCase()),
                              )
                              .map((f) => {
                                const isPositive = f.contribution > 0;
                                const isNegative = f.contribution < 0;
                                return (
                                  <tr key={f.key} className="hover:bg-muted/30">
                                    <td className="py-2 px-3 font-sans font-medium text-foreground">
                                      {f.label}
                                    </td>
                                    <td className="py-2 px-3 text-muted-foreground text-[10px]">
                                      {f.key}
                                    </td>
                                    <td className="py-2 px-3 text-right font-semibold text-foreground">
                                      {typeof f.value === "number"
                                        ? f.value >= 1000
                                          ? `₹${f.value.toLocaleString("en-IN")}`
                                          : f.value % 1 === 0
                                            ? f.value
                                            : f.value.toFixed(4)
                                        : String(f.value)}
                                    </td>
                                    <td className="py-2 px-3 text-right">
                                      {isPositive ? (
                                        <span className="text-destructive font-semibold">
                                          +{(f.contribution * 100).toFixed(1)}% (Risk)
                                        </span>
                                      ) : isNegative ? (
                                        <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                                          {(f.contribution * 100).toFixed(1)}% (Trust)
                                        </span>
                                      ) : (
                                        <span className="text-muted-foreground">Neutral</span>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>

                {/* 5. Responsible AI Fairness Disclosure */}
                <div className="rounded-xl border border-border/80 bg-muted/40 p-3.5 text-xs text-muted-foreground">
                  <span className="font-bold text-foreground font-mono uppercase text-[10px] block">
                    RESPONSIBLE AI: MODEL ATTRIBUTION ≠ AUTOMATIC DECLINE
                  </span>
                  <p className="mt-1 leading-relaxed">
                    XGBoost, Logistic Regression, and CART trees output probabilistic risk attributions based on statistical distributions. 
                    These signals are never used in isolation to automatically decline claims without corroborating policy evaluations and visual inspection proofs.
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

            {/* TAB 4: Behaviour Signals & Customer Historical Ledger */}
            {activeTab === "behaviour" && (
              <div className="pt-4 space-y-5 text-xs">
                {/* Account Profile Header Cards */}
                <div className="rounded-xl border border-border bg-card p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-border/60">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-foreground text-sm">
                          {order?.customers?.customer_name || (order as any)?.customer_name || "Customer Record"}
                        </span>
                        <span className="font-mono text-[11px] text-muted-foreground">
                          ({order?.customers?.external_id || (order as any)?.customer_id || "CUST-IN"})
                        </span>
                      </div>
                      <p className="text-muted-foreground mt-0.5 font-mono text-[11px]">
                        Location: {order?.customers?.city}, {order?.customers?.state} · Prime Member: {order?.customers ? "Yes" : "Standard"}
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <span className="font-mono text-[10px] text-muted-foreground uppercase block">Account Concern Score</span>
                        <span className={`font-mono text-base font-bold ${
                          ((behaviour?.behaviour_score ?? (behaviour as any)?.behaviourScore ?? 0) > 0.35)
                            ? "text-destructive"
                            : "text-emerald-600 dark:text-emerald-400"
                        }`}>
                          {Math.round(((behaviour?.behaviour_score ?? (behaviour as any)?.behaviourScore ?? 0) * 100))}%
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3 text-muted-foreground">
                    <div className="rounded-lg bg-muted/30 p-2 border border-border/40">
                      <span className="text-[10px] uppercase font-mono block">Lifetime Orders</span>
                      <span className="text-sm font-semibold text-foreground font-mono">
                        {order?.customers?.total_orders ?? 14} orders
                      </span>
                    </div>
                    <div className="rounded-lg bg-muted/30 p-2 border border-border/40">
                      <span className="text-[10px] uppercase font-mono block">Lifetime Returns</span>
                      <span className={`text-sm font-semibold font-mono ${
                        Number(order?.customers?.return_rate ?? 0) > 0.3 ? "text-destructive" : "text-emerald-600 dark:text-emerald-400"
                      }`}>
                        {order?.customers?.total_returns ?? 0} ({((Number(order?.customers?.return_rate ?? 0)) * 100).toFixed(1)}%)
                      </span>
                    </div>
                    <div className="rounded-lg bg-muted/30 p-2 border border-border/40">
                      <span className="text-[10px] uppercase font-mono block">Total GMV Spend</span>
                      <span className="text-sm font-semibold text-foreground font-mono">
                        {formatCurrency(Number(order?.customers?.total_spent ?? order?.total_price ?? 0))}
                      </span>
                    </div>
                    <div className="rounded-lg bg-muted/30 p-2 border border-border/40">
                      <span className="text-[10px] uppercase font-mono block">Customer Feedback</span>
                      <span className="text-sm font-semibold text-foreground font-mono">
                        {order?.customers?.avg_customer_rating ? `${Number(order.customers.avg_customer_rating).toFixed(1)}/5.0` : "4.0/5.0"}
                      </span>
                      <span className="text-[10px] text-muted-foreground block font-mono">
                        {order?.customers?.low_rating_count ?? 0} low rating claims
                      </span>
                    </div>
                  </div>
                </div>

                {/* Behavioral Risk Signals */}
                <div className="space-y-2.5">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground font-mono">
                    Extracted Behavioral Risk Signals (Dynamic Account Telemetry)
                  </h4>
                  {(behaviour?.signals ?? []).map((s, i) => (
                    <div key={i} className="p-3 rounded-xl border border-border bg-card space-y-1">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className={s.direction === "risk" ? "text-destructive font-bold" : s.direction === "trust" ? "text-emerald-600 dark:text-emerald-400 font-bold" : "text-muted-foreground font-bold"}>
                            {s.direction === "risk" ? "▲" : s.direction === "trust" ? "✓" : "•"}
                          </span>
                          <span className="font-semibold text-foreground">{s.label}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[10px] text-muted-foreground">
                            Weight: {(s.weight * 100).toFixed(0)}%
                          </span>
                          <Pill tone={s.direction === "risk" ? "caution" : s.direction === "trust" ? "positive" : "neutral"} className="text-[10px]">
                            {s.direction === "risk" ? "+Concern" : s.direction === "trust" ? "Trust Factor" : "Neutral"}
                          </Pill>
                        </div>
                      </div>
                      <div className="font-mono text-muted-foreground text-[11px] pl-4">
                        Observation: {s.value}
                      </div>
                      <p className="text-muted-foreground text-xs pl-4 pt-0.5">
                        {s.detail}
                      </p>
                    </div>
                  ))}
                </div>

                {/* Customer Prior Purchase History (Chronological Ledger) */}
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground font-mono">
                        Prior Purchase History & Return Record ({order?.customers?.past_orders?.length ?? 14} Chronological Orders)
                      </h4>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Chronological record of transactions preceding this claim. Informs behavioural score and ML model predictions.
                      </p>
                    </div>
                    <span className="rounded bg-primary/10 text-primary font-mono text-[10px] font-bold px-2 py-0.5">
                      AUDIT VERIFIED
                    </span>
                  </div>

                  {order?.customers?.past_orders && order.customers.past_orders.length > 0 ? (
                    <div className="overflow-x-auto rounded-xl border border-border">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-muted/40 font-mono uppercase text-[10px] text-muted-foreground border-b border-border">
                          <tr>
                            <th className="py-2 px-3 font-semibold">Date</th>
                            <th className="py-2 px-3 font-semibold">Order Ref</th>
                            <th className="py-2 px-3 font-semibold">Product & Category</th>
                            <th className="py-2 px-3 font-semibold">Amount (INR)</th>
                            <th className="py-2 px-3 font-semibold">Delivery</th>
                            <th className="py-2 px-3 font-semibold">Rating</th>
                            <th className="py-2 px-3 font-semibold">Outcome</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/60 font-mono text-[11px]">
                          {order.customers.past_orders.map((p, idx) => {
                            const wasReturned = p.return_status === "Returned";
                            return (
                              <tr key={idx} className={wasReturned ? "bg-rose-500/5 hover:bg-rose-500/10" : "hover:bg-muted/30"}>
                                <td className="py-2 px-3 text-muted-foreground whitespace-nowrap">
                                  {p.order_date}
                                </td>
                                <td className="py-2 px-3 font-semibold text-foreground whitespace-nowrap">
                                  {p.order_id}
                                </td>
                                <td className="py-2 px-3 text-foreground font-sans">
                                  <span className="font-semibold block">{p.product_name}</span>
                                  <span className="text-[10px] text-muted-foreground font-mono">{p.brand} · {p.category}</span>
                                </td>
                                <td className="py-2 px-3 text-foreground whitespace-nowrap font-semibold">
                                  {formatCurrency(p.amount_inr)}
                                </td>
                                <td className="py-2 px-3 text-muted-foreground whitespace-nowrap">
                                  {p.delivery_days}d
                                </td>
                                <td className="py-2 px-3 whitespace-nowrap">
                                  <span className={p.customer_rating <= 2 ? "text-destructive font-bold" : "text-amber-500 font-bold"}>
                                    {"★".repeat(p.customer_rating)}
                                  </span>
                                  <span className="text-muted-foreground ml-1">({p.customer_rating}/5)</span>
                                </td>
                                <td className="py-2 px-3 whitespace-nowrap">
                                  {wasReturned ? (
                                    <span className="inline-flex items-center gap-1 rounded bg-rose-500/15 text-rose-700 dark:text-rose-300 px-2 py-0.5 text-[10px] font-bold">
                                      Returned {p.return_reason ? `(${p.return_reason})` : ""}
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 rounded bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 text-[10px] font-bold">
                                      ✓ Kept
                                    </span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed border-border p-4 text-center text-muted-foreground">
                      No prior purchase history found for this account record.
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB 5: Fraud Ring Graph */}
            {activeTab === "network" && (
              <div className="pt-4 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
                  <div>
                    <span className="text-muted-foreground">Syndicate: </span>
                    <span className="font-semibold text-foreground">{network?.ringId ?? "None (Isolated Case)"}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Network Risk: </span>
                    <span className="font-semibold text-destructive">{network?.networkRisk ?? 14}/100</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Shared Devices: </span>
                    <span className="font-semibold text-foreground">{network?.metrics.sharedDevices ?? 1}</span>
                  </div>
                </div>

                <div className="rounded-xl border border-border bg-card p-4 space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                    <Network className="w-4 h-4 text-primary" />
                    Entity Linkage & Shared Infrastructure
                  </h4>
                  <ul className="space-y-1.5 text-xs text-muted-foreground">
                    {(network?.reasons ?? ["No suspicious device sharing or cross-account connections detected."]).map((r, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="text-destructive font-bold">•</span>
                        <span>{r}</span>
                      </li>
                    ))}
                  </ul>

                  <div className="pt-2 flex justify-end">
                    <Link
                      to="/fraud-rings"
                      className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                    >
                      <span>Open Full Network Graph & Investigation Panel</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 6: Regional Hotspot */}
            {activeTab === "geo" && (
              <div className="pt-4 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
                  <div>
                    <span className="text-muted-foreground">Region: </span>
                    <span className="font-semibold text-foreground">{geo?.areaName ?? "São Paulo (SP)"}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Hotspot Score: </span>
                    <span className="font-semibold text-foreground">{geo?.hotspotScore ?? 82}/100</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Priority Contribution: </span>
                    <span className="font-semibold text-primary">+{geo?.adjustment ?? 8} pts</span>
                  </div>
                </div>

                <div className="rounded-xl border border-border bg-card p-4 space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                    <MapPin className="w-4 h-4 text-orange-500" />
                    Regional Return Normalization & Logistics Analytics
                  </h4>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {geo?.reason ?? "Return originated from an area with elevated normalized return-risk."}
                  </p>

                  <div className="pt-2 flex justify-end">
                    <Link
                      to="/risk-map"
                      className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                    >
                      <span>Open Regional Hotspots Map</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 7: Cross-Merchant Consortium Intelligence */}
            {activeTab === "cross_merchant" && (
              <div className="pt-4 space-y-5">
                {/* Header overview */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-3">
                  <div className="flex items-center gap-2">
                    <Store className="w-4 h-4 text-red-500" />
                    <span className="font-mono text-xs font-bold uppercase tracking-wider text-foreground">
                      CROSS-MERCHANT CONSORTIUM INTELLIGENCE
                    </span>
                  </div>
                  <div className="flex items-center gap-2 font-mono text-[11px]">
                    <span className="text-muted-foreground">Match Type:</span>
                    <span className="font-semibold text-primary px-2 py-0.5 rounded bg-primary/10">
                      {crossMerchant?.matchIdentifierType ?? "SHA256_HASHED_PHONE"}
                    </span>
                  </div>
                </div>

                {/* Workflow Architecture Visualizer */}
                <div className="rounded-2xl border-2 border-red-500/40 bg-gradient-to-b from-card to-muted/20 p-5 space-y-4 shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-red-600 dark:text-red-400">
                      CONSORTIUM DATA FLOW & ARBITRATION
                    </span>
                    <span className="font-mono text-[10px] text-muted-foreground">
                      Privacy-Preserving SHA-256 Token
                    </span>
                  </div>

                  <div className="grid gap-3 md:grid-cols-3">
                    {/* Box 1: UrbanBasket */}
                    <div className="rounded-xl border border-red-500/40 bg-red-500/5 p-3.5 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-foreground">URBANBASKET</span>
                        <span className="text-[10px] font-bold font-mono text-red-600 dark:text-red-400">
                          SUSPICIOUS HISTORY
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground leading-relaxed">
                        Stored in demo merchant database: 6 returns out of 9 orders (66.7% rate), 3 serial empty-box claims, ₹58,400 refund exposure.
                      </p>
                    </div>

                    {/* Box 2: NexaCart */}
                    <div className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-3.5 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-foreground">NEXACART</span>
                        <span className="text-[10px] font-bold font-mono text-emerald-600 dark:text-emerald-400">
                          NORMAL HISTORY
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground leading-relaxed">
                        Same customer requests return on NexaCart: 1 order, 0 prior returns. Appears clean if viewed in isolation!
                      </p>
                    </div>

                    {/* Box 3: TrustLoop */}
                    <div className="rounded-xl border border-primary/40 bg-primary/5 p-3.5 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-primary">TRUSTLOOP</span>
                        <span className="text-[10px] font-bold font-mono text-primary">
                          CONSORTIUM MATCH
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground leading-relaxed">
                        Existing ML + Behaviour + Policy + Vision + <strong>NEW CROSS-MERCHANT EVIDENCE</strong> intercepts the claim!
                      </p>
                    </div>
                  </div>

                  {/* The Exact User Quotation Verdict */}
                  <div className="rounded-xl border border-red-500 bg-red-600 text-white p-3.5 text-center shadow-xs">
                    <span className="font-mono text-[10px] uppercase font-bold tracking-widest text-red-100 block mb-0.5">
                      GENERATED CONSORTIUM EVIDENCE VERDICT
                    </span>
                    <p className="font-display text-sm font-bold tracking-wide">
                      &quot;Matching customer found on UrbanBasket. Suspicious return behaviour detected there.&quot;
                    </p>
                  </div>
                </div>

                {/* UrbanBasket Abusive Claims Log */}
                {crossMerchant?.matchedMerchant?.profile.recentReturnClaims && (
                  <div className="rounded-xl border border-border bg-card p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-foreground">
                        UrbanBasket Audit Log (Consortium Shared Intelligence)
                      </span>
                      <span className="text-[10px] font-mono text-red-600 dark:text-red-400 font-semibold">
                        {crossMerchant.matchedMerchant.profile.flags.length} Active Abuse Flags
                      </span>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="border-b border-border/80 font-mono uppercase text-[10px] text-muted-foreground">
                          <tr>
                            <th className="py-2 pr-3">Timeline</th>
                            <th className="py-2 pr-3">Product Claimed</th>
                            <th className="py-2 pr-3 text-right">Value</th>
                            <th className="py-2 pr-3">Customer Claim</th>
                            <th className="py-2">Merchant Investigation Finding</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/60 font-mono text-[11px]">
                          {crossMerchant.matchedMerchant.profile.recentReturnClaims.map((claim: any, idx: number) => (
                            <tr key={idx}>
                              <td className="py-2.5 pr-3 text-muted-foreground whitespace-nowrap">{claim.date}</td>
                              <td className="py-2.5 pr-3 font-semibold text-foreground font-sans">{claim.product}</td>
                              <td className="py-2.5 pr-3 text-right font-bold text-foreground">₹{claim.value.toLocaleString()}</td>
                              <td className="py-2.5 pr-3 text-red-600 dark:text-red-400 font-semibold">{claim.claimedReason}</td>
                              <td className="py-2.5 text-muted-foreground font-sans">{claim.finding}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Privacy Preservation Note */}
                <div className="rounded-xl border border-border bg-muted/40 p-3.5 text-xs text-muted-foreground space-y-1">
                  <span className="font-bold text-foreground font-mono uppercase text-[10px] block">
                    RESPONSIBLE AI: ZERO RAW PII SHARING
                  </span>
                  <p className="leading-relaxed">
                    TrustLoop consortium cross-checks use one-way HMAC-SHA256 salted hashes of customer identifiers. 
                    NexaCart and UrbanBasket never see each other&apos;s customer lists, raw contact details, or proprietary sales volumes. 
                    Only standardized behavioral risk telemetry and verified fraud signals are synthesized.
                  </p>
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
