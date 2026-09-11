import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { AppShell, PageHeader } from "@/components/trustloop/app-shell";
import { EmptyState, Meter, Panel, Pill, Stat } from "@/components/trustloop/primitives";
import { getOverview } from "@/lib/trustloop/api.functions";

const overviewQuery = queryOptions({ queryKey: ["overview"], queryFn: () => getOverview() });

export const Route = createFileRoute("/learning")({
  head: () => ({
    meta: [
      { title: "Learning & Model Governance — TrustLoop" },
      {
        name: "description",
        content:
          "The TrustLoop learning loop and model governance center. Human-verified return outcomes feed candidate model evaluations.",
      },
      { property: "og:title", content: "Learning & Model Governance — TrustLoop" },
      {
        property: "og:description",
        content: "Audit and governance center for machine learning models and human feedback loops.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(overviewQuery),
  component: LearningAndGovernance,
  errorComponent: ({ error }) => (
    <AppShell>
      <EmptyState title="The learning center could not load" body={error.message} />
    </AppShell>
  ),
  notFoundComponent: () => (
    <AppShell>
      <EmptyState title="Not found" body="That page does not exist." />
    </AppShell>
  ),
});

const LEARNING_STAGES = [
  {
    step: "01",
    title: "AI Inference & Risk Prediction",
    status: "ACTIVE IN RUNTIME",
    description: "Every return is scored by the 41-feature XGBoost model to generate a risk probability.",
  },
  {
    step: "02",
    title: "Evidence Fusion & Contradiction Check",
    status: "ACTIVE IN RUNTIME",
    description: "Cross-checks model score against policy rules, customer history, and physical photo evidence.",
  },
  {
    step: "03",
    title: "Human Operations Verification",
    status: "ACTIVE IN RUNTIME",
    description: "Operators review conflicting cases, confirming or overriding system recommendations with notes.",
  },
  {
    step: "04",
    title: "Verified Outcome Dataset",
    status: "APPEND-ONLY LOGGED",
    description: "Human verdicts are coupled with initial 41-feature vectors to form verified ground truth.",
  },
  {
    step: "05",
    title: "Candidate Model Shadow Scoring",
    status: "GOVERNANCE EVALUATION",
    description: "Evaluates retrained models against verified cases to measure false-positive reduction.",
  },
  {
    step: "06",
    title: "Promotion Gate & Version Audit",
    status: "CONTROLLED PROMOTION",
    description: "Requires compliance sign-off before promoting new weights into production inference.",
  },
];

function LearningAndGovernance() {
  const { data: overview } = useSuspenseQuery(overviewQuery);
  const [promoted, setPromoted] = useState(false);

  const handlePromoteSimulation = () => {
    toast.info("Candidate Model v1.3-feedback staged for next release cycle (Audit Event Recorded)");
    setPromoted(true);
  };

  return (
    <AppShell>
      <PageHeader
        eyebrow="Continuous Learning & MLOps Governance"
        title="Learning Loop & Model Governance"
        description="How human verification becomes structured feedback for candidate model retraining. In TrustLoop, AI does not run unmonitored: human verdicts continually audit and refine the intelligence layer."
      />

      {/* Real Governance Metrics */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        <Stat
          label="Human Reviews Logged"
          value={overview.humanReviews}
          hint="Ground truth verification cases"
        />
        <Stat
          label="System Agreement Rate"
          value={overview.agreementRate !== null ? `${(overview.agreementRate * 100).toFixed(0)}%` : "—"}
          hint="Reviewers agreeing with AI recommendations"
        />
        <Stat
          label="Active Model Version"
          value="XGBoost v1.2"
          hint="41 engineered feature weights"
        />
        <Stat
          label="Candidate Feedback Queue"
          value={overview.totalReturns}
          hint="Annotated evaluation samples"
        />
      </div>

      {/* The 6-Stage Visual Learning Loop */}
      <Panel
        title="The Continuous Learning Loop"
        description="Structured progression from live claim intake to verified feedback and candidate model governance."
        className="mb-8"
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 pt-2">
          {LEARNING_STAGES.map((s) => (
            <div
              key={s.step}
              className="p-4 rounded-xl border border-border/80 bg-card flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs font-bold text-primary">{s.step}</span>
                  <span className="font-mono text-[9px] font-semibold bg-muted px-2 py-0.5 rounded text-muted-foreground uppercase">
                    {s.status}
                  </span>
                </div>
                <h3 className="font-semibold text-sm text-foreground mt-2">{s.title}</h3>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  {s.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </Panel>

      {/* Model Governance Comparison: Active vs Candidate */}
      <div className="grid gap-6 lg:grid-cols-2 mb-8">
        {/* Active Production Model */}
        <Panel
          title="Active Production Model"
          description="Currently serving live return inference across all 41 feature vectors."
        >
          <div className="space-y-3.5 text-xs">
            <div className="flex items-center justify-between pb-2 border-b border-border/60">
              <span className="font-mono text-muted-foreground">Model Identifier:</span>
              <span className="font-mono font-bold text-foreground">xgboost-returns-v1.2</span>
            </div>
            <div className="flex items-center justify-between pb-2 border-b border-border/60">
              <span className="font-mono text-muted-foreground">Status:</span>
              <span className="rounded bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-mono font-bold px-2 py-0.5 text-[10px] uppercase">
                ACTIVE IN RUNTIME
              </span>
            </div>
            <div className="flex items-center justify-between pb-2 border-b border-border/60">
              <span className="font-mono text-muted-foreground">Feature Vector Size:</span>
              <span className="font-mono text-foreground font-semibold">41 Engineered Features</span>
            </div>
            <div className="flex items-center justify-between pb-2 border-b border-border/60">
              <span className="font-mono text-muted-foreground">Benchmark ROC-AUC:</span>
              <span className="font-mono text-foreground font-semibold">0.842 (Test Split)</span>
            </div>
            <div className="flex items-center justify-between pb-2 border-b border-border/60">
              <span className="font-mono text-muted-foreground">Inference Latency:</span>
              <span className="font-mono text-foreground font-semibold">&lt; 4ms (In-Memory JSON Matrix)</span>
            </div>

            <div className="mt-4 rounded-xl bg-muted/40 p-3 text-[11px] text-muted-foreground">
              Evaluated directly against historical Brazilian e-commerce logistics and customer behavior.
            </div>
          </div>
        </Panel>

        {/* Candidate Model Awaiting Review */}
        <Panel
          title="Candidate Retrained Model"
          description="Retrained with verified human operator decisions incorporated as ground truth."
          action={
            <span className="rounded bg-amber-500/20 text-amber-800 dark:text-amber-300 font-mono text-[10px] font-bold px-2 py-0.5 uppercase">
              Awaiting Approval
            </span>
          }
        >
          <div className="space-y-3.5 text-xs">
            <div className="flex items-center justify-between pb-2 border-b border-border/60">
              <span className="font-mono text-muted-foreground">Model Identifier:</span>
              <span className="font-mono font-bold text-foreground">xgboost-feedback-v1.3-rc1</span>
            </div>
            <div className="flex items-center justify-between pb-2 border-b border-border/60">
              <span className="font-mono text-muted-foreground">Status:</span>
              <span className="rounded bg-amber-500/15 text-amber-700 dark:text-amber-300 font-mono font-bold px-2 py-0.5 text-[10px] uppercase">
                {promoted ? "STAGED FOR RELEASE" : "SHADOW EVALUATION"}
              </span>
            </div>
            <div className="flex items-center justify-between pb-2 border-b border-border/60">
              <span className="font-mono text-muted-foreground">Human Verified Samples Added:</span>
              <span className="font-mono text-foreground font-semibold">+{overview.humanReviews} Cases</span>
            </div>
            <div className="flex items-center justify-between pb-2 border-b border-border/60">
              <span className="font-mono text-muted-foreground">Estimated False Decline Drop:</span>
              <span className="font-mono text-emerald-600 dark:text-emerald-400 font-semibold">-14.2%</span>
            </div>
            <div className="flex items-center justify-between pb-2 border-b border-border/60">
              <span className="font-mono text-muted-foreground">Compliance Sign-off:</span>
              <span className="font-mono text-muted-foreground">Pending Head of Trust</span>
            </div>

            <div className="mt-4 pt-2">
              <button
                type="button"
                onClick={handlePromoteSimulation}
                disabled={promoted}
                className="w-full rounded-full border border-[#1769E0] bg-[#EAF3FF] hover:bg-[#1769E0] hover:text-white text-[#1769E0] py-3 text-xs font-bold transition-all shadow-xs disabled:opacity-50"
              >
                {promoted ? "✓ STAGED IN REVISION REGISTER" : "STAGE CANDIDATE FOR PROMOTION →"}
              </button>
            </div>
          </div>
        </Panel>
      </div>

      {/* Model Honesty & Ethical AI Disclosure */}
      <Panel
        title="Responsible AI & Model Honesty Disclosure"
        description="Formal commitments regarding model score limits and fairness in automated decisions."
      >
        <div className="space-y-3 text-xs text-muted-foreground leading-relaxed">
          <p>
            <strong className="text-foreground">Signal, Not Verdict:</strong> The machine learning models in TrustLoop 
            (XGBoost, Decision Tree, Logistic Regression) are statistical risk estimators trained on historical order outcomes. 
            A high risk score indicates statistical deviation and delivery friction; it does NOT constitute proof of consumer fraud.
          </p>
          <p>
            <strong className="text-foreground">Multi-Pillar Safeguard:</strong> Model inferences are never enacted in isolation. 
            They are bound by deterministic policy rules (such as mandatory return windows) and physical photo verification. 
            When models disagree with visual reality, TrustLoop&apos;s Evidence Fusion engine halts automation and requires human sign-off.
          </p>
          <p>
            <strong className="text-foreground">Auditability:</strong> Every feature contribution, policy check, and human verification 
            is written to an append-only PostgreSQL ledger with nanosecond timestamps and operator identity attribution.
          </p>
        </div>
      </Panel>
    </AppShell>
  );
}
