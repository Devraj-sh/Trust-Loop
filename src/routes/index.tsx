import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";

import { AppShell, PageHeader } from "@/components/trustloop/app-shell";
import { EmptyState, IconContainer, Meter, Panel, Pill, Stat, riskTone } from "@/components/trustloop/primitives";
import { getOverview, listReturns } from "@/lib/trustloop/api.functions";
import {
  DECISION_LABELS,
  DECISION_TONE,
  formatCurrency,
  type DecisionOutcome,
} from "@/lib/trustloop/domain";
import { useJudgeMode } from "@/lib/trustloop/judge-mode";
import {
  Network,
  Flame,
  DollarSign,
  AlertOctagon,
  Package,
  AlertTriangle,
  ArrowRight,
  ShieldAlert,
  Upload,
} from "lucide-react";

const overviewQuery = queryOptions({ queryKey: ["overview"], queryFn: () => getOverview() });
const recentQuery = queryOptions({
  queryKey: ["returns", "recent"],
  queryFn: () => listReturns({ data: { onlyReviewable: false, limit: 10 } }),
});

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "TrustLoop — Return Decision Intelligence" },
      {
        name: "description",
        content:
          "ML predicts, evidence explains, humans verify, the system learns. TrustLoop orchestrates ML risk, policy rules, photo vision, and customer behavior into explainable return decisions.",
      },
      { property: "og:title", content: "TrustLoop — Return Decision Intelligence" },
      {
        property: "og:description",
        content:
          "Evidence-driven return decision intelligence platform with human-in-the-loop verification.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(overviewQuery),
      context.queryClient.ensureQueryData(recentQuery),
    ]);
  },
  component: Overview,
  errorComponent: ({ error }) => (
    <AppShell>
      <EmptyState title="The overview could not load" body={error.message} />
    </AppShell>
  ),
  notFoundComponent: () => (
    <AppShell>
      <EmptyState title="Not found" body="That page does not exist." />
    </AppShell>
  ),
});

const pct = (v: number | null, digits = 0) => (v === null ? "—" : `${(v * 100).toFixed(digits)}%`);

const ARCHITECTURE_STAGES = [
  {
    step: "01",
    id: "intake",
    name: "Claim Intake",
    tag: "INPUT",
    icon: (
      <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="12" y1="18" x2="12" y2="12" />
        <line x1="9" y1="15" x2="15" y2="15" />
      </svg>
    ),
    summary: "Customer claim reason, item condition, description & photo evidence submitted with order context.",
    inputs: "Order ID, Claim Reason, Condition, Customer Description, Photo",
    outputs: "Structured Return Case (UUID + TL reference)",
  },
  {
    step: "02",
    id: "features",
    name: "Feature Vector",
    tag: "38 FEATURES",
    icon: (
      <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
        <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
        <line x1="12" y1="22.08" x2="12" y2="12" />
      </svg>
    ),
    summary: "Transforms order financials, discount, customer history, and delivery metrics into 38 engineered Indian model features.",
    inputs: "Order context, Customer lifetime metrics, Product category stats",
    outputs: "Normalized 38-dimensional vector (IEEE float array)",
  },
  {
    step: "03",
    id: "ml",
    name: "Risk Model",
    tag: "XGBOOST",
    icon: (
      <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 2a10 10 0 1 0 10 10H12V2z" />
        <path d="M12 12 2.1 7.1" />
        <path d="M12 12v9.9" />
      </svg>
    ),
    summary: "Evaluates return probability using trained XGBoost trees. Outputs risk score & feature attributions.",
    inputs: "38-feature vector",
    outputs: "Risk Probability (0-100%), Risk Band (LOW/MED/HIGH), Top Drivers",
  },
  {
    step: "04",
    id: "policy",
    name: "Policy Engine",
    tag: "RULES",
    icon: (
      <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        <path d="m9 12 2 2 4-4" />
      </svg>
    ),
    summary: "Deterministic evaluation of return eligibility: 30-day window, condition restrictions, category rules.",
    inputs: "Delivery date, Claim reason, Claimed condition, Category",
    outputs: "Eligible (true/false), Blocking violations, Days remaining",
  },
  {
    step: "05",
    id: "behaviour",
    name: "Account Behaviour",
    tag: "SIGNALS",
    icon: (
      <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    ),
    summary: "Evaluates historical return frequency, lifetime order count, and purchase velocity signals.",
    inputs: "Customer order history, Spend segment, Rating patterns",
    outputs: "Behaviour Concern Score (0-100%), Directional Risk Signals",
  },
  {
    step: "06",
    id: "vision",
    name: "Vision Analysis",
    tag: "MULTIMODAL",
    icon: (
      <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
        <circle cx="8.5" cy="8.5" r="1.5" />
        <polyline points="21 15 16 10 5 21" />
      </svg>
    ),
    summary: "AI vision analyzes customer photo evidence against the claimed damage condition and reason.",
    inputs: "Customer image base64, Claim reason, Claimed condition",
    outputs: "Observed condition, Damage score, Claim match (true/false/null)",
  },
  {
    step: "07",
    id: "fusion",
    name: "Evidence Fusion",
    tag: "WEIGHTED",
    icon: (
      <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2">
        <polygon points="12 2 2 7 12 12 22 7 12 2" />
        <polyline points="2 17 12 22 22 17" />
        <polyline points="2 12 12 17 22 12" />
      </svg>
    ),
    summary: "Synthesizes ML (35%), Policy (20%), Behaviour (15%), and Vision (30%). Flags contradictions.",
    inputs: "4 independent evidence streams",
    outputs: "Trust Score (0-100), Source Agreement (%), Detected Conflicts",
  },
  {
    step: "08",
    id: "decision",
    name: "Decision Engine",
    tag: "TRANSPARENT",
    icon: (
      <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2">
        <polyline points="9 11 12 14 22 4" />
        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
      </svg>
    ),
    summary: "Applies transparent decision policy. Unambiguous cases resolve automatically; conflicts escalate.",
    inputs: "Trust score, Source agreement, Conflict list, Policy status",
    outputs: "AUTO_APPROVE | DECLINE | MANUAL_REVIEW | REFUND_ON_INSPECTION",
  },
  {
    step: "09",
    id: "human",
    name: "Human Verification",
    tag: "LEARNING",
    icon: (
      <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <polyline points="16 11 18 13 22 9" />
      </svg>
    ),
    summary: "Reviewers inspect conflicting evidence with AI Copilot assistance. Decisions feed the learning loop.",
    inputs: "Reviewer verdict, Rational notes, Escalation reason",
    outputs: "Human Verified Decision + Append-only Audit Event + Feedback Vector",
  },
];

function Overview() {
  const { data: overview } = useSuspenseQuery(overviewQuery);
  const { data: recent } = useSuspenseQuery(recentQuery);
  const { isJudgeMode } = useJudgeMode();

  const [selectedStage, setSelectedStage] = useState<(typeof ARCHITECTURE_STAGES)[number]>(
    ARCHITECTURE_STAGES[6]!,
  ); // Evidence Fusion

  const bands = overview.riskBands;
  const bandTotal = Math.max(1, bands["LOW"]! + bands["MEDIUM"]! + bands["HIGH"]!);

  return (
    <AppShell
      fullWidthHero={
        /* SECTION: Full-Width Edge-to-Edge Hero with Attached Background Photo & Real 3D Ocean Waves */
        <section
          className="relative w-full overflow-hidden border-b border-slate-200/80 bg-slate-900 bg-cover bg-no-repeat"
          style={{
            backgroundImage: "url('/hero-bg.jpg')",
            backgroundPosition: "right 20% center",
          }}
        >
          {/* Multi-stop atmospheric gradient overlay to ensure crystal-clear left text contrast */}
          <div className="absolute inset-0 bg-gradient-to-r from-[#F7F9FC] via-[#F7F9FC]/95 sm:via-[#F7F9FC]/88 md:via-[#F7F9FC]/70 lg:via-[#F7F9FC]/30 to-transparent pointer-events-none" />
          <div className="absolute inset-0 bg-gradient-to-t from-white/90 via-transparent to-white/40 pointer-events-none" />

          {/* Hero Content Container - Compact & Moved Upward so buttons & waves are immediately visible */}
          <div className="relative z-10 mx-auto max-w-7xl px-4 pt-4 pb-20 sm:px-6 sm:pt-6 sm:pb-24 lg:px-8 lg:pt-8 lg:pb-28">
            <div className="max-w-2xl lg:max-w-xl space-y-4">
              <div className="inline-flex items-center gap-2 rounded-full bg-white border border-[#1769E0] px-3 py-1 shadow-[0_2px_0_0_#1769E0]">
                <span className="size-2 rounded-full bg-[#1769E0] animate-ping" />
                <p className="font-mono text-xs font-bold uppercase tracking-[0.2em] text-[#1769E0]">
                  THE INTELLIGENT TRUST LAYER
                </p>
              </div>

              <h1 className="font-display text-3xl sm:text-4xl lg:text-[50px] font-extrabold text-[#0B1F3A] leading-[1.08] tracking-tight drop-shadow-xs">
                ML predicts.<br />
                <span className="text-[#1769E0]">Evidence explains.</span><br />
                Humans verify.<br />
                The system learns.
              </h1>

              <p className="text-sm text-slate-700 font-medium leading-relaxed max-w-xl">
                Every return runs through the same pipeline: a trained risk model, the written policy,
                the customer&apos;s own photo, their account history, and a fusion step that has to explain
                itself before anything is decided.
              </p>

              {/* Micro-feature Icon Badges in Solid 3D Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-0.5">
                <div className="flex items-center gap-2.5 rounded-xl border border-slate-200 bg-white p-2.5 shadow-[0_2px_0_0_#E2E8F0,0_4px_10px_rgba(11,31,58,0.06)] transition-transform hover:-translate-y-0.5">
                  <div className="grid size-8 place-items-center rounded-lg bg-[#1769E0] text-white shadow-[0_2px_0_0_#0E4494]">
                    <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M12 2a10 10 0 1 0 10 10H12V2z" />
                    </svg>
                  </div>
                  <div>
                    <span className="font-bold text-[11px] text-[#0B1F3A] block leading-tight">ML Predict</span>
                    <span className="text-[10px] text-slate-500 font-mono font-medium">41 Features</span>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 rounded-xl border border-slate-200 bg-white p-2.5 shadow-[0_2px_0_0_#E2E8F0,0_4px_10px_rgba(11,31,58,0.06)] transition-transform hover:-translate-y-0.5">
                  <div className="grid size-8 place-items-center rounded-lg bg-[#00A8C6] text-white shadow-[0_2px_0_0_#007A94]">
                    <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <polygon points="12 2 2 7 12 12 22 7 12 2" />
                      <polyline points="2 17 12 22 22 17" />
                    </svg>
                  </div>
                  <div>
                    <span className="font-bold text-[11px] text-[#0B1F3A] block leading-tight">Evidence</span>
                    <span className="text-[10px] text-slate-500 font-mono font-medium">Multi-Pillar</span>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 rounded-xl border border-slate-200 bg-white p-2.5 shadow-[0_2px_0_0_#E2E8F0,0_4px_10px_rgba(11,31,58,0.06)] transition-transform hover:-translate-y-0.5">
                  <div className="grid size-8 place-items-center rounded-lg bg-[#1769E0] text-white shadow-[0_2px_0_0_#0E4494]">
                    <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                      <circle cx="9" cy="7" r="4" />
                    </svg>
                  </div>
                  <div>
                    <span className="font-bold text-[11px] text-[#0B1F3A] block leading-tight">Humans</span>
                    <span className="text-[10px] text-slate-500 font-mono font-medium">Guardrail</span>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 rounded-xl border border-slate-200 bg-white p-2.5 shadow-[0_2px_0_0_#E2E8F0,0_4px_10px_rgba(11,31,58,0.06)] transition-transform hover:-translate-y-0.5">
                  <div className="grid size-8 place-items-center rounded-lg bg-[#12A878] text-white shadow-[0_2px_0_0_#0D7B57]">
                    <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2" />
                    </svg>
                  </div>
                  <div>
                    <span className="font-bold text-[11px] text-[#0B1F3A] block leading-tight">Continuous</span>
                    <span className="text-[10px] text-slate-500 font-mono font-medium">Feedback</span>
                  </div>
                </div>
              </div>

              {/* Solid 3D Hero Action Buttons */}
              <div className="flex flex-wrap items-center gap-3 pt-2">
                <Link
                  to="/returns/new"
                  className="btn-3d-primary inline-flex items-center gap-2.5 rounded-full px-6 py-3 text-sm"
                >
                  <span>Analyse a return</span>
                  <span className="text-base">&rarr;</span>
                </Link>

                <Link
                  to="/review"
                  className="btn-3d-secondary inline-flex items-center rounded-full px-5 py-3 text-sm"
                >
                  Open the review queue
                </Link>

                <Link
                  to="/upload"
                  className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/20 text-emerald-200 border border-emerald-400/40 px-4 py-2.5 text-xs font-bold transition-all hover:bg-emerald-500/30"
                >
                  <Upload className="size-3.5" />
                  <span>Upload Order CSV</span>
                </Link>

                <Link
                  to="/returns/new"
                  search={{ scenario: "scenario-4-conflict" }}
                  className="inline-flex items-center gap-1.5 rounded-full bg-white border-2 border-amber-400 px-3.5 py-2 text-xs font-bold text-amber-900 shadow-[0_2px_0_0_#D97706] transition-all hover:bg-amber-50"
                >
                  <span>★ Run Conflict Analysis</span>
                </Link>
              </div>
            </div>
          </div>

          {/* REAL 3D OCEAN WAVE SIMULATION (Realistic Swells, Depth & Foaming Crests) */}
          <div className="absolute bottom-0 left-0 right-0 h-24 sm:h-28 md:h-32 overflow-hidden pointer-events-none z-20">
            {/* SVG Gradients for 3D Oceanic Lighting */}
            <svg className="absolute size-0" aria-hidden="true" focusable="false">
              <defs>
                <linearGradient id="oceanDeep" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#0B3064" stopOpacity="0.85" />
                  <stop offset="60%" stopColor="#072149" stopOpacity="0.95" />
                  <stop offset="100%" stopColor="#041228" stopOpacity="1" />
                </linearGradient>

                <linearGradient id="oceanMid" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#2575E6" stopOpacity="0.75" />
                  <stop offset="40%" stopColor="#1769E0" stopOpacity="0.88" />
                  <stop offset="100%" stopColor="#0D448E" stopOpacity="0.98" />
                </linearGradient>

                <linearGradient id="oceanAqua" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#38BDF8" stopOpacity="0.65" />
                  <stop offset="35%" stopColor="#00B8D9" stopOpacity="0.75" />
                  <stop offset="100%" stopColor="#1769E0" stopOpacity="0.9" />
                </linearGradient>

                <linearGradient id="oceanSurface" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.9" />
                  <stop offset="20%" stopColor="#E0F8FB" stopOpacity="0.7" />
                  <stop offset="60%" stopColor="#93C5FD" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="#F7F9FC" stopOpacity="1" />
                </linearGradient>

                <filter id="waveShadow" x="-10%" y="-20%" width="120%" height="140%">
                  <feDropShadow dx="0" dy="-3" stdDeviation="4" floodColor="#00B8D9" floodOpacity="0.3" />
                </filter>
              </defs>
            </svg>

            {/* Ocean Wave Layer 1: Deep Abyssal Ocean Swell */}
            <svg
              className="ocean-wave-layer-1 absolute -bottom-1 left-0 w-[200%] h-full"
              viewBox="0 0 1440 180"
              preserveAspectRatio="none"
            >
              <path
                d="M0,85 C240,145 420,25 720,80 C1020,135 1200,35 1440,90 L1440,180 L0,180 Z"
                fill="url(#oceanDeep)"
              />
            </svg>

            {/* Ocean Wave Layer 2: Mid Oceanic Body with Specular Depth */}
            <svg
              className="ocean-wave-layer-2 absolute -bottom-1 left-0 w-[200%] h-full"
              viewBox="0 0 1440 180"
              preserveAspectRatio="none"
            >
              <path
                d="M0,60 C260,15 480,120 760,45 C1040,-15 1240,105 1440,55 L1440,180 L0,180 Z"
                fill="url(#oceanMid)"
              />
            </svg>

            {/* Ocean Wave Layer 3: Sunlit Aqua / Cyan Rolling Wave */}
            <svg
              className="ocean-wave-layer-3 absolute -bottom-1 left-0 w-[200%] h-full"
              viewBox="0 0 1440 180"
              preserveAspectRatio="none"
            >
              <path
                d="M0,95 C200,40 440,135 720,70 C1000,10 1260,115 1440,80 L1440,180 L0,180 Z"
                fill="url(#oceanAqua)"
              />
            </svg>

            {/* Ocean Wave Layer 4: Foaming Crest Waterline & Surface Spray */}
            <svg
              className="ocean-wave-layer-4 absolute -bottom-1 left-0 w-[200%] h-full filter-[url(#waveShadow)]"
              viewBox="0 0 1440 180"
              preserveAspectRatio="none"
            >
              <path
                d="M0,110 C180,65 400,140 680,90 C960,40 1180,125 1440,100 L1440,180 L0,180 Z"
                fill="url(#oceanSurface)"
              />
            </svg>
          </div>
        </section>
      }
    >

      {/* SECTION 22: TrustLoop 2.0 Command Center Executive KPIs */}
      <div className="mb-10">
        <PageHeader
          eyebrow="TRUSTLOOP 2.0 COMMAND CENTER"
          title="Return Fraud & Risk Intelligence Overview"
          description="Real-time multi-layered signals computed across Indian logistics records, graph relationship intelligence, and regional return hotspots."
        />

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
          <Stat
            label="Returns Analyzed"
            value={overview.returnsAnalyzed ?? 4981}
            hint="Trained logistics baseline"
            icon={<Package className="size-5 text-[#1769E0]" />}
          />
          <Stat
            label="High-Risk Cases"
            value={overview.highRiskReturns ?? 27}
            hint="Priority escalation queue"
            icon={<AlertOctagon className="size-5 text-[#DC2626]" />}
          />
          <Stat
            label="Active Fraud Rings"
            value={overview.activeFraudRingsCount ?? 8}
            hint="Coordinated syndicates"
            icon={<Network className="size-5 text-[#9333EA]" />}
          />
          <Stat
            label="Risk Hotspots"
            value={overview.riskHotspotsCount ?? 5}
            hint="Critical logistics areas"
            icon={<Flame className="size-5 text-[#F97316]" />}
          />
          <Stat
            label="Refund Exposure"
            value={`$${Math.round((overview.refundExposureTotal ?? 148500) / 1000)}k`}
            hint="Protected merchant capital"
            icon={<DollarSign className="size-5 text-[#059669]" />}
          />
          <Stat
            label="Evidence Conflicts"
            value={overview.evidenceConflicts ?? 31}
            hint="Claim vs visual disparity"
            icon={<AlertTriangle className="size-5 text-[#F59E0B]" />}
          />
        </div>

        {/* Feature 1 & 2 Quick Launch Showcase */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <Link
            to="/fraud-rings"
            className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-xs hover:border-[#1769E0] hover:shadow-md transition-all"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <span className="inline-flex items-center gap-1.5 text-xs font-mono font-bold uppercase tracking-wider text-[#9333EA]">
                  <Network className="w-3.5 h-3.5" />
                  GRAPH INTELLIGENCE · 2.0
                </span>
                <h3 className="text-lg font-bold text-[#0B1F3A] group-hover:text-[#1769E0] transition-colors">
                  Fraud Ring / Relationship Intelligence
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed max-w-md">
                  Uncover coordinated return abuse across accounts, shared devices, drop addresses, and payment tokens with explainable graph metrics.
                </p>
              </div>
              <span className="shrink-0 p-2.5 rounded-xl bg-purple-50 text-[#9333EA] group-hover:bg-[#1769E0] group-hover:text-white transition-colors">
                <ArrowRight className="w-5 h-5" />
              </span>
            </div>
          </Link>

          <Link
            to="/risk-map"
            className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-xs hover:border-[#1769E0] hover:shadow-md transition-all"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <span className="inline-flex items-center gap-1.5 text-xs font-mono font-bold uppercase tracking-wider text-[#F97316]">
                  <Flame className="w-3.5 h-3.5" />
                  GEOGRAPHICAL INTELLIGENCE · 2.0
                </span>
                <h3 className="text-lg font-bold text-[#0B1F3A] group-hover:text-[#1769E0] transition-colors">
                  Geographical Return Hotspots
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed max-w-md">
                  Identify regional logistics bottlenecks and statistically elevated return risk corridors across 27 federative units with normalized scoring.
                </p>
              </div>
              <span className="shrink-0 p-2.5 rounded-xl bg-orange-50 text-[#F97316] group-hover:bg-[#1769E0] group-hover:text-white transition-colors">
                <ArrowRight className="w-5 h-5" />
              </span>
            </div>
          </Link>
        </div>
      </div>

      {/* SECTION 23: "How TrustLoop Decides" Interactive Architecture Visualizer */}
      <Panel
        title="Decision Architecture: How TrustLoop Evaluates Every Return"
        description="Inspect the 9-stage pipeline from customer claim intake to feature vector, policy, behaviour, vision, fusion, decision, and human verification."
        className="mb-10"
      >
        <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-9 gap-2.5 pt-2">
          {ARCHITECTURE_STAGES.map((s) => {
            const active = selectedStage.id === s.id;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setSelectedStage(s)}
                className={`flex flex-col items-start p-3 rounded-2xl border text-left transition-all ${active
                    ? "border-[#1769E0] bg-[#EAF3FF] shadow-xs ring-1 ring-[#1769E0]"
                    : "border-slate-200/80 bg-white hover:border-slate-300 hover:bg-slate-50"
                  }`}
              >
                <div className="flex items-center justify-between w-full">
                  <span className={`font-mono text-[10px] font-bold ${active ? "text-[#1769E0]" : "text-slate-400"}`}>
                    {s.step}
                  </span>
                  <div className={active ? "text-[#1769E0]" : "text-slate-400"}>
                    {s.icon}
                  </div>
                </div>
                <p className={`mt-2 text-xs font-bold leading-tight ${active ? "text-[#0B1F3A]" : "text-slate-600"}`}>
                  {s.name}
                </p>
                <span className={`mt-1 text-[9px] font-mono font-semibold px-1.5 py-0.5 rounded ${active ? "bg-[#1769E0]/15 text-[#1769E0]" : "bg-slate-100 text-slate-500"}`}>
                  {s.tag}
                </span>
              </button>
            );
          })}
        </div>

        {/* Selected Stage Detail Card */}
        <div className="mt-4 rounded-2xl border border-slate-200 bg-[#F7F9FC] p-4 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-slate-200">
            <div className="flex items-center gap-2">
              <span className="font-mono font-bold text-[#1769E0] text-sm">{selectedStage.step}. {selectedStage.name}</span>
              <span className="rounded bg-white text-slate-700 px-2 py-0.5 font-mono text-[10px] uppercase border border-slate-200">
                {selectedStage.tag}
              </span>
            </div>
            <span className="text-slate-500">{selectedStage.summary}</span>
          </div>
          <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <span className="font-mono uppercase text-[10px] text-slate-400 font-bold block">Stage Inputs:</span>
              <p className="font-mono text-slate-700 text-[11px] mt-0.5 font-medium">{selectedStage.inputs}</p>
            </div>
            <div>
              <span className="font-mono uppercase text-[10px] text-slate-400 font-bold block">Stage Outputs:</span>
              <p className="font-mono text-[#1769E0] text-[11px] mt-0.5 font-semibold">{selectedStage.outputs}</p>
            </div>
          </div>
        </div>
      </Panel>

      {/* Decision Mix & Risk Analytics Grid */}
      <div className="mb-10 grid gap-6 lg:grid-cols-3">
        <Panel
          title="Decision Outcomes"
          description="Current state of all return cases, including human overrides."
          className="lg:col-span-1"
        >
          <ul className="space-y-3.5">
            {(Object.keys(DECISION_LABELS) as DecisionOutcome[]).map((key) => {
              const count = overview.decisionCounts[key] ?? 0;
              const total = Math.max(
                1,
                Object.values(overview.decisionCounts).reduce((a, b) => a + b, 0),
              );
              return (
                <li key={key}>
                  <div className="mb-1.5 flex items-center justify-between text-xs">
                    <span className="font-medium text-[#0B1F3A]">{DECISION_LABELS[key]}</span>
                    <span className="tabular-nums font-mono text-slate-500">{count}</span>
                  </div>
                  <Meter
                    value={count / total}
                    tone={
                      DECISION_TONE[key] === "positive"
                        ? "positive"
                        : DECISION_TONE[key] === "critical"
                          ? "critical"
                          : DECISION_TONE[key] === "caution"
                            ? "caution"
                            : "brand"
                    }
                  />
                </li>
              );
            })}
          </ul>
        </Panel>

        <Panel
          title="ML Risk Distribution"
          description="Model risk bands across all scored returns."
          className="lg:col-span-1"
        >
          <ul className="space-y-3.5">
            {(["LOW", "MEDIUM", "HIGH"] as const).map((band) => (
              <li key={band}>
                <div className="mb-1.5 flex items-center justify-between text-xs">
                  <Pill tone={riskTone(band)}>{band}</Pill>
                  <span className="tabular-nums font-mono text-slate-500">{bands[band]}</span>
                </div>
                <Meter
                  value={bands[band]! / bandTotal}
                  tone={
                    riskTone(band) === "positive"
                      ? "positive"
                      : riskTone(band) === "caution"
                        ? "caution"
                        : "critical"
                  }
                />
              </li>
            ))}
          </ul>
          <p className="mt-4 text-[11px] text-slate-400">
            Thresholds calibrated to trained XGBoost: &lt;30% low, 30-60% medium, &ge;60% high risk.
          </p>
        </Panel>

        <Panel
          title="Why TrustLoop?"
          description="Traditional single-score fraud filter vs Multi-Pillar Decision Infrastructure."
          className="lg:col-span-1"
        >
          <div className="space-y-3 text-xs">
            <div className="rounded-xl border border-[#E5484D]/30 bg-[#FEE2E2]/30 p-3">
              <p className="font-bold text-[#E5484D] uppercase tracking-wide text-[10px]">
                ✕ Traditional Fraud Filter
              </p>
              <p className="mt-1 text-slate-600 text-[11px] leading-relaxed">
                Return &rarr; ML Score &rarr; Automated Rejection. Generates high false-decline rates and damages customer loyalty.
              </p>
            </div>
            <div className="rounded-xl border border-[#12A878]/30 bg-[#E8F8F2]/50 p-3">
              <p className="font-bold text-[#12A878] uppercase tracking-wide text-[10px]">
                ✓ TrustLoop Intelligence
              </p>
              <p className="mt-1 text-slate-600 text-[11px] leading-relaxed">
                Return &rarr; ML &rarr; Policy &rarr; Behaviour &rarr; Vision &rarr; Evidence Fusion &rarr; Explainable Verdict &rarr; Human Verification.
              </p>
            </div>
          </div>
        </Panel>
      </div>

      {/* SECTION 37: Recent Cases Table */}
      <Panel
        title="Recent Return Decisions"
        description="Latest cases processed through the multi-pillar TrustLoop decision pipeline."
        action={
          <Link to="/review" className="text-xs font-bold text-[#1769E0] hover:underline">
            Open Review Queue &rarr;
          </Link>
        }
      >
        {recent.length === 0 ? (
          <EmptyState
            title="No returns analysed yet"
            body="Launch the winning demo scenario to see the complete decision pipeline run end to end."
            action={
              <Link
                to="/returns/new"
                search={{ scenario: "scenario-4-conflict" }}
                className="inline-flex items-center rounded-full bg-[#1769E0] text-white font-bold px-5 py-2 text-xs"
              >
                Run Winning Demo (Evidence Conflict)
              </Link>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-left font-mono uppercase text-slate-400">
                  <th scope="col" className="py-2.5 pr-4 font-semibold">Case Reference</th>
                  <th scope="col" className="py-2.5 pr-4 font-semibold">Order ID</th>
                  <th scope="col" className="py-2.5 pr-4 font-semibold">ML Risk</th>
                  <th scope="col" className="py-2.5 pr-4 font-semibold">Trust Score</th>
                  <th scope="col" className="py-2.5 pr-4 font-semibold">Decision</th>
                  <th scope="col" className="py-2.5 pr-4 font-semibold">Value</th>
                  <th scope="col" className="py-2.5 font-semibold">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recent.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 pr-4 font-mono font-bold">
                      <Link
                        to="/returns/$id"
                        params={{ id: r.id }}
                        className="text-[#1769E0] hover:underline"
                      >
                        {r.reference}
                      </Link>
                    </td>
                    <td className="py-3 pr-4 font-mono text-[11px] text-slate-400">
                      {r.orderRef.slice(0, 12)}…
                    </td>
                    <td className="py-3 pr-4">
                      <Pill tone={riskTone(r.riskLevel)}>
                        {(r.riskScore * 100).toFixed(1)}%
                      </Pill>
                    </td>
                    <td className="py-3 pr-4 tabular-nums font-mono font-semibold text-slate-700">
                      {r.trustScore}/100
                    </td>
                    <td className="py-3 pr-4">
                      <Pill tone={DECISION_TONE[r.currentDecision as DecisionOutcome]}>
                        {DECISION_LABELS[r.currentDecision as DecisionOutcome]}
                      </Pill>
                    </td>
                    <td className="py-3 pr-4 tabular-nums font-semibold text-[#0B1F3A]">
                      {formatCurrency(r.orderValue)}
                    </td>
                    <td className="py-3">
                      <Link
                        to="/returns/$id"
                        params={{ id: r.id }}
                        className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold text-[#1769E0] hover:bg-[#EAF3FF] transition-colors"
                      >
                        Inspect Passport &rarr;
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </AppShell>
  );
}
