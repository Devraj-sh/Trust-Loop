import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";

import { AppShell, PageHeader } from "@/components/trustloop/app-shell";
import { EmptyState, Meter, Panel, Pill, Stat, riskTone } from "@/components/trustloop/primitives";
import { listReturns, submitReview } from "@/lib/trustloop/api.functions";
import {
  DECISION_LABELS,
  DECISION_TONE,
  formatCurrency,
  type DecisionOutcome,
} from "@/lib/trustloop/domain";

const allQuery = queryOptions({
  queryKey: ["returns", "all"],
  queryFn: () => listReturns({ data: { onlyReviewable: false, limit: 100 } }),
});

export const Route = createFileRoute("/review")({
  head: () => ({
    meta: [
      { title: "Review Queue — TrustLoop Operations" },
      {
        name: "description",
        content:
          "Trust & Safety return review console. Human verification with AI Copilot assistance for conflicting or uncertain returns.",
      },
      { property: "og:title", content: "Review Queue — TrustLoop Operations" },
      {
        property: "og:description",
        content: "Enterprise review console for human verification of return claims.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(allQuery),
  component: ReviewQueue,
  errorComponent: ({ error }) => (
    <AppShell>
      <EmptyState title="The queue could not load" body={error.message} />
    </AppShell>
  ),
  notFoundComponent: () => (
    <AppShell>
      <EmptyState title="Not found" body="That page does not exist." />
    </AppShell>
  ),
});

function ReviewQueue() {
  const { data } = useSuspenseQuery(allQuery);
  const queryClient = useQueryClient();
  const reviewFn = useServerFn(submitReview);

  const [filter, setFilter] = useState<"awaiting" | "high_risk" | "verified" | "all">("awaiting");
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(() => {
    const pendingCase = data.find((r) => r.currentDecision === "MANUAL_REVIEW" && !r.decidedByHuman);
    return pendingCase ? pendingCase.id : data[0]?.id ?? null;
  });

  const [reviewerName, setReviewerName] = useState("Agent #42 (Trust & Safety)");
  const [reviewVerdict, setReviewVerdict] = useState<DecisionOutcome>("AUTO_APPROVE");
  const [reviewNotes, setReviewNotes] = useState("");

  const awaitingList = data.filter((r) => r.currentDecision === "MANUAL_REVIEW" && !r.decidedByHuman);
  const highRiskList = data.filter((r) => r.riskLevel === "HIGH");
  const verifiedList = data.filter((r) => r.decidedByHuman);

  let displayedRows = data;
  if (filter === "awaiting") displayedRows = awaitingList;
  else if (filter === "high_risk") displayedRows = highRiskList;
  else if (filter === "verified") displayedRows = verifiedList;

  const activeCase = data.find((r) => r.id === selectedCaseId) ?? displayedRows[0];

  const reviewMutation = useMutation({
    mutationFn: () => {
      if (!activeCase) throw new Error("No case selected for review");
      return reviewFn({
        data: {
          returnId: activeCase.id,
          reviewerName,
          verdict: reviewVerdict,
          notes: reviewNotes || undefined,
        },
      });
    },
    onSuccess: (result) => {
      const ref = activeCase?.reference ?? "Case";
      toast.success(
        result.agreed
          ? `Human verdict confirmed for Case ${ref}`
          : `System verdict overridden for Case ${ref}`,
      );
      setReviewNotes("");
      void queryClient.invalidateQueries({ queryKey: ["returns"] });
      void queryClient.invalidateQueries({ queryKey: ["overview"] });
    },
    onError: (err: Error) => toast.error(err.message || "Could not record review"),
  });

  return (
    <AppShell>
      <PageHeader
        eyebrow="Human Operations Console"
        title="Review Queue & Decision Copilot"
        description="Every claim flagged by evidence conflicts, policy edge-cases, or high risk values routes here. Reviewers are assisted by the AI Copilot but maintain final decision authority."
      />

      {/* Queue Stat Counters */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        <Stat
          label="Needs Review"
          value={awaitingList.length}
          hint="Awaiting human verification"
        />
        <Stat
          label="High Risk Cases"
          value={highRiskList.length}
          hint="XGBoost risk band &ge; 60%"
        />
        <Stat
          label="Human Verified"
          value={verifiedList.length}
          hint="Decided by operators"
        />
        <Stat
          label="Total Cases"
          value={data.length}
          hint="Total analyzed database records"
        />
      </div>

      {/* Filter Tabs */}
      <div
        className="mb-6 inline-flex rounded-full border border-slate-200/80 bg-white p-1 shadow-xs"
        role="tablist"
        aria-label="Queue filter"
      >
        {(
          [
            { key: "awaiting", label: `Awaiting Review (${awaitingList.length})` },
            { key: "high_risk", label: `High Risk (${highRiskList.length})` },
            { key: "verified", label: `Verified (${verifiedList.length})` },
            { key: "all", label: `All Cases (${data.length})` },
          ] as const
        ).map((tab) => (
          <button
            key={tab.key}
            role="tab"
            aria-selected={filter === tab.key}
            onClick={() => setFilter(tab.key)}
            className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-all ${
              filter === tab.key
                ? "bg-[#EAF3FF] text-[#1769E0] shadow-xs"
                : "text-slate-600 hover:text-[#0B1F3A] hover:bg-slate-100/70"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {displayedRows.length === 0 ? (
        <EmptyState
          title="No cases in this view"
          body="All returns matching this filter have been processed. Launch a new analysis to see cases appear here."
          action={
            <Link
              to="/returns/new"
              search={{ scenario: "scenario-4-conflict" }}
              className="inline-flex items-center rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 px-4 py-2 text-xs font-bold"
            >
              Run Winning Demo (Evidence Conflict)
            </Link>
          }
        />
      ) : (
        /* Operations Split Layout: Left Table + Right Copilot/Verification */
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_420px]">
          {/* Left: Queue Table */}
          <Panel
            title="Return Cases Queue"
            description="Select any case to open its instant decision console and review copilot."
          >
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border/80 text-left font-mono uppercase text-muted-foreground">
                    <th className="py-2.5 pr-3 font-semibold">Case</th>
                    <th className="py-2.5 pr-3 font-semibold">Risk %</th>
                    <th className="py-2.5 pr-3 font-semibold">Trust</th>
                    <th className="py-2.5 pr-3 font-semibold">Reason</th>
                    <th className="py-2.5 pr-3 font-semibold">Value</th>
                    <th className="py-2.5 pr-3 font-semibold">Status</th>
                    <th className="py-2.5 font-semibold">Select</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {displayedRows.map((r) => {
                    const isSelected = activeCase?.id === r.id;
                    return (
                      <tr
                        key={r.id}
                        onClick={() => setSelectedCaseId(r.id)}
                        className={`cursor-pointer transition-colors ${
                          isSelected
                            ? "bg-primary/10 font-semibold"
                            : "hover:bg-muted/50"
                        }`}
                      >
                        <td className="py-3 pr-3 font-mono">
                          <span className="font-bold text-foreground">{r.reference}</span>
                          <span className="block text-[10px] text-muted-foreground font-normal">
                            {r.orderRef.slice(0, 10)}…
                          </span>
                        </td>
                        <td className="py-3 pr-3">
                          <Pill tone={riskTone(r.riskLevel)} className="text-[11px] py-0.5 px-2">
                            {(r.riskScore * 100).toFixed(0)}%
                          </Pill>
                        </td>
                        <td className="py-3 pr-3 font-mono font-medium tabular-nums">
                          {r.trustScore}/100
                        </td>
                        <td className="py-3 pr-3 text-muted-foreground capitalize">
                          {r.reason.replace(/_/g, " ").toLowerCase()}
                        </td>
                        <td className="py-3 pr-3 font-medium tabular-nums">
                          {formatCurrency(r.orderValue)}
                        </td>
                        <td className="py-3 pr-3">
                          <Pill
                            tone={DECISION_TONE[r.currentDecision as DecisionOutcome]}
                            className="text-[10px] py-0 px-1.5"
                          >
                            {DECISION_LABELS[r.currentDecision as DecisionOutcome]}
                          </Pill>
                        </td>
                        <td className="py-3">
                          <span
                            className={`rounded px-2 py-0.5 font-mono text-[10px] uppercase ${
                              isSelected
                                ? "bg-primary text-primary-foreground font-bold"
                                : "text-muted-foreground hover:text-foreground"
                            }`}
                          >
                            {isSelected ? "ACTIVE" : "Review"}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Panel>

          {/* Right: Review Copilot & Verification Console */}
          {activeCase && (
            <aside className="space-y-6 lg:sticky lg:top-24 lg:self-start">
              <Panel
                title="Review Copilot"
                description={`AI-Assisted Investigation for Case ${activeCase.reference}`}
                action={
                  <Link
                    to="/returns/$id"
                    params={{ id: activeCase.id }}
                    className="text-xs font-semibold text-primary hover:underline"
                  >
                    Open Full Passport &rarr;
                  </Link>
                }
              >
                <div className="space-y-3.5 text-xs">
                  {/* AI Recommendation Card */}
                  <div className="rounded-xl border border-primary/30 bg-primary/5 p-3.5">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[10px] font-bold uppercase text-primary">
                        SYSTEM RECOMMENDATION
                      </span>
                      <span className="font-mono text-[10px] text-muted-foreground">
                        {activeCase.decidedByHuman ? "HUMAN VERIFIED" : "AWAITING HUMAN"}
                      </span>
                    </div>
                    <p className="font-display text-sm font-bold text-foreground mt-0.5">
                      {DECISION_LABELS[activeCase.currentDecision as DecisionOutcome]}
                    </p>
                    <p className="mt-1 text-muted-foreground">
                      Model Risk: {(activeCase.riskScore * 100).toFixed(1)}% · Trust Score: {activeCase.trustScore}/100.
                    </p>
                  </div>

                  {/* Summary of Signals */}
                  <div className="rounded-xl border border-border bg-card p-3 space-y-2">
                    <span className="font-mono uppercase text-[10px] text-muted-foreground font-semibold block">
                      Case Evidence Summary
                    </span>
                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                      <div>
                        <span className="text-muted-foreground block text-[10px]">CLAIM REASON:</span>
                        <span className="font-medium capitalize">{activeCase.reason.replace(/_/g, " ").toLowerCase()}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block text-[10px]">ORDER VALUE:</span>
                        <span className="font-medium font-mono">{formatCurrency(activeCase.orderValue)}</span>
                      </div>
                    </div>
                    <div className="pt-2 border-t border-border/50 text-[11px] text-muted-foreground">
                      <p>
                        Review photo evidence and policy parameters in the Trust Passport before overriding.
                      </p>
                    </div>
                  </div>

                  {/* Human Decision Form */}
                  <div className="rounded-xl border border-border/80 bg-muted/20 p-3.5 space-y-3">
                    <span className="font-mono uppercase text-[10px] font-bold text-foreground block">
                      Human Verification Verdict
                    </span>

                    <div>
                      <label className="text-[10px] uppercase font-mono text-muted-foreground block mb-1">
                        Reviewer Agent
                      </label>
                      <input
                        value={reviewerName}
                        onChange={(e) => setReviewerName(e.target.value)}
                        className="w-full rounded-lg border border-input bg-background px-3 py-1.5 text-xs outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] uppercase font-mono text-muted-foreground block mb-1.5">
                        Verdict Selection
                      </label>
                      <div className="grid grid-cols-1 gap-1.5">
                        <button
                          type="button"
                          onClick={() => setReviewVerdict("AUTO_APPROVE")}
                          className={`p-2 rounded-lg border text-left font-semibold transition-all ${
                            reviewVerdict === "AUTO_APPROVE"
                              ? "border-emerald-500 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 shadow-[0_2px_0_0_#059669]"
                              : "border-slate-200 bg-white shadow-[0_1.5px_0_0_#E2E8F0] hover:bg-slate-50"
                          }`}
                        >
                          ✓ APPROVE RETURN (Instant Refund)
                        </button>
                        <button
                          type="button"
                          onClick={() => setReviewVerdict("REFUND_ON_INSPECTION")}
                          className={`p-2 rounded-lg border text-left font-semibold transition-all ${
                            reviewVerdict === "REFUND_ON_INSPECTION"
                              ? "border-[#1769E0] bg-[#EAF3FF] text-[#1769E0] shadow-[0_2px_0_0_#1769E0]"
                              : "border-slate-200 bg-white shadow-[0_1.5px_0_0_#E2E8F0] hover:bg-slate-50"
                          }`}
                        >
                          ⟳ REFUND ON WAREHOUSE INSPECTION
                        </button>
                        <button
                          type="button"
                          onClick={() => setReviewVerdict("DECLINE")}
                          className={`p-2 rounded-lg border text-left font-semibold transition-all ${
                            reviewVerdict === "DECLINE"
                              ? "border-destructive bg-destructive/15 text-destructive shadow-[0_2px_0_0_#DC2626]"
                              : "border-slate-200 bg-white shadow-[0_1.5px_0_0_#E2E8F0] hover:bg-slate-50"
                          }`}
                        >
                          ✕ DECLINE RETURN (Reject Claim)
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] uppercase font-mono text-muted-foreground block mb-1">
                        Operator Notes / Rationale
                      </label>
                      <textarea
                        rows={2}
                        value={reviewNotes}
                        onChange={(e) => setReviewNotes(e.target.value)}
                        placeholder="State reason for confirmation or override…"
                        className="w-full rounded-lg border border-input bg-background p-2 text-xs outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      />
                    </div>

                    <button
                      type="button"
                      disabled={reviewMutation.isPending}
                      onClick={() => reviewMutation.mutate()}
                      className="btn-3d-primary w-full rounded-full py-3.5 text-sm disabled:opacity-50"
                    >
                      {reviewMutation.isPending ? "Recording verdict…" : "CONFIRM VERIFIED DECISION"}
                    </button>
                  </div>
                </div>
              </Panel>
            </aside>
          )}
        </div>
      )}
    </AppShell>
  );
}
