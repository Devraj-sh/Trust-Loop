import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";

import { AppShell, PageHeader } from "@/components/trustloop/app-shell";
import { EmptyState, Panel, Pill } from "@/components/trustloop/primitives";
import { listAuditEvents } from "@/lib/trustloop/audit.functions";

const auditQuery = queryOptions({
  queryKey: ["audit"],
  queryFn: () => listAuditEvents({ data: { limit: 200 } }),
});

const STAGE_LABEL: Record<string, { label: string; tone: "brand" | "positive" | "caution" | "critical" | "neutral" }> = {
  intake: { label: "Intake", tone: "brand" },
  model: { label: "ML Model (41F)", tone: "brand" },
  policy: { label: "Policy Engine", tone: "caution" },
  vision: { label: "Physical Vision", tone: "positive" },
  behaviour: { label: "Behaviour Vector", tone: "neutral" },
  fusion: { label: "Evidence Fusion", tone: "caution" },
  decision: { label: "Decision Engine", tone: "brand" },
  human_review: { label: "Human Review", tone: "positive" },
};

export const Route = createFileRoute("/audit")({
  head: () => ({
    meta: [
      { title: "Audit Trail — TrustLoop" },
      {
        name: "description",
        content: "Every stage of every return decision, in order, with who or what produced it.",
      },
      { property: "og:title", content: "Audit Trail — TrustLoop" },
      {
        property: "og:description",
        content: "A complete, append-only record of TrustLoop decisions.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(auditQuery),
  component: Audit,
  errorComponent: ({ error }) => (
    <AppShell>
      <EmptyState title="The audit trail could not load" body={error.message} />
    </AppShell>
  ),
  notFoundComponent: () => (
    <AppShell>
      <EmptyState title="Not found" body="That page does not exist." />
    </AppShell>
  ),
});

function Audit() {
  const { data } = useSuspenseQuery(auditQuery);
  const [filterStage, setFilterStage] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const filtered = data.filter((event) => {
    if (filterStage !== "all" && event.stage !== filterStage) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchRef = event.reference?.toLowerCase().includes(q);
      const matchSummary = event.summary?.toLowerCase().includes(q);
      const matchActor = event.actorName?.toLowerCase().includes(q);
      if (!matchRef && !matchSummary && !matchActor) return false;
    }
    return true;
  });

  return (
    <AppShell>
      <PageHeader
        eyebrow="Accountability & Compliance"
        title="Audit Trail & Decision Ledger"
        description="Append-only PostgreSQL decision ledger. Every feature generation, model risk inference, policy rule check, image inspection, and human override writes an immutable trace."
      />

      {/* Filter and Search Bar */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-1.5 overflow-x-auto text-xs font-mono">
          {[
            { key: "all", label: "All Stages" },
            { key: "human_review", label: "Human Overrides" },
            { key: "fusion", label: "Evidence Fusion" },
            { key: "vision", label: "Vision Checks" },
            { key: "model", label: "ML Model" },
            { key: "policy", label: "Policy Checks" },
          ].map((s) => (
            <button
              key={s.key}
              onClick={() => setFilterStage(s.key)}
              className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-all ${
                filterStage === s.key
                  ? "bg-[#EAF3FF] text-[#1769E0] border border-[#BFDBFE] shadow-xs"
                  : "bg-white border border-slate-200 text-slate-600 hover:text-[#0B1F3A] hover:bg-slate-50"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        <div className="w-full sm:w-64">
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by case ref, summary…"
            className="w-full rounded-xl border border-input bg-background px-3 py-1.5 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title="No audit events found"
          body="No events match your current filter. Clear filters or run a return analysis to generate new audit entries."
          action={
            <Link
              to="/returns/new"
              search={{ scenario: "scenario-4-conflict" }}
              className="inline-flex items-center rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 px-4 py-2 text-xs font-bold"
            >
              Run Winning Demo
            </Link>
          }
        />
      ) : (
        <Panel>
          <ol className="relative space-y-6 border-l-2 border-border/80 pl-6 text-xs">
            {filtered.map((event) => {
              const stageInfo = STAGE_LABEL[event.stage] ?? { label: event.stage, tone: "neutral" as const };
              const isHuman = event.actor === "HUMAN";
              return (
                <li key={event.id} className="relative group">
                  <span
                    className={`absolute -left-[31px] top-1 size-3.5 rounded-full ring-4 ring-card transition-transform group-hover:scale-125 ${
                      isHuman ? "bg-amber-500 ring-amber-500/20" : "bg-primary ring-primary/20"
                    }`}
                    aria-hidden="true"
                  />

                  <div className="flex flex-wrap items-center gap-2.5">
                    <Pill tone={stageInfo.tone} className="text-[11px] font-mono font-semibold py-0.5 px-2">
                      {stageInfo.label}
                    </Pill>

                    <span
                      className={`font-mono text-[10px] px-2 py-0.5 rounded font-bold uppercase ${
                        isHuman
                          ? "bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-500/30"
                          : "bg-slate-800 text-slate-300"
                      }`}
                    >
                      {event.actor}
                    </span>

                    {event.returnId && (
                      <Link
                        to="/returns/$id"
                        params={{ id: event.returnId }}
                        className="font-mono font-semibold text-primary hover:underline text-xs"
                      >
                        {event.reference}
                      </Link>
                    )}

                    <time className="font-mono text-[11px] text-muted-foreground ml-auto" dateTime={event.createdAt}>
                      {new Date(event.createdAt).toLocaleDateString()} · {new Date(event.createdAt).toLocaleTimeString()}
                    </time>
                  </div>

                  <p className="mt-1.5 text-sm font-medium text-foreground">
                    {event.summary}
                  </p>

                  {event.actorName && (
                    <p className="text-[11px] text-muted-foreground font-mono mt-0.5">
                      Executed by operator: <span className="text-foreground font-semibold">{event.actorName}</span>
                    </p>
                  )}

                  {/* Expandable Structured Payload Inspector */}
                  {event.payload && Object.keys(event.payload).length > 0 && (
                    <details className="mt-2 text-xs">
                      <summary className="cursor-pointer font-mono text-[10px] text-primary hover:underline uppercase">
                        Inspect Event Metadata Vector &rarr;
                      </summary>
                      <pre className="mt-2 rounded-lg bg-slate-950 p-3 text-[11px] font-mono text-cyan-300 overflow-x-auto border border-slate-800">
                        {JSON.stringify(event.payload, null, 2)}
                      </pre>
                    </details>
                  )}
                </li>
              );
            })}
          </ol>
        </Panel>
      )}
    </AppShell>
  );
}
