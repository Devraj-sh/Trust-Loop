import { createFileRoute } from "@tanstack/react-router";
import { 
  Database, 
  FileText, 
  UserCheck, 
  Camera, 
  Layers, 
  AlertCircle,
  Clock,
  Calendar,
  Sparkles
} from "lucide-react";

import { AppShell, PageHeader } from "@/components/trustloop/app-shell";
import { EmptyState, Panel, Pill, IconContainer } from "@/components/trustloop/primitives";
import { FEATURE_MEDIANS } from "@/lib/ml/engine";
import { featureLabel } from "@/lib/trustloop/features";
import { CONDITIONS, REASON_CODES } from "@/lib/trustloop/domain";

export const Route = createFileRoute("/data")({
  head: () => ({
    meta: [
      { title: "Data requirements — TrustLoop" },
      {
        name: "description",
        content:
          "Exactly which customer, order, category and return details the company must supply for the TrustLoop decision pipeline to run correctly.",
      },
      { property: "og:title", content: "Data requirements — TrustLoop" },
      {
        property: "og:description",
        content: "The customer, order and return fields TrustLoop needs, and what happens if one is missing.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DataRequirements,
  errorComponent: ({ error }) => (
    <AppShell>
      <EmptyState title="This page could not load" body={error.message} />
    </AppShell>
  ),
  notFoundComponent: () => (
    <AppShell>
      <EmptyState title="Not found" body="That page does not exist." />
    </AppShell>
  ),
});

type Group = {
  title: string;
  source: string;
  used: string;
  fields: string[];
};

const GROUPS: Group[] = [
  {
    title: "Customer record",
    source: "Uploaded by the company or ingested via CSV upload",
    used: "Account behaviour signals and historical risk scoring",
    fields: [
      "customer_city",
      "customer_state",
      "total_orders",
      "total_spent",
      "avg_order_value",
      "total_returns",
      "return_rate",
      "average_discount",
      "avg_delivery_days",
      "avg_customer_rating",
      "low_rating_count",
      "days_since_last_order",
      "customer_lifetime_days",
      "is_one_time_buyer",
      "orders_last_7_days",
      "orders_last_30_days",
      "returns_last_7_days",
      "returns_last_30_days",
      "return_value_last_30_days",
      "previous_return_count",
      "previous_return_rate",
    ],
  },
  {
    title: "Order record",
    source: "Uploaded by the company from its order and delivery systems (INR)",
    used: "Indian ML model scoring and return-window policy check",
    fields: [
      "order_amount",
      "original_price",
      "discount_percent",
      "delivery_days",
      "customer_rating",
      "is_prime_member",
      "is_festival_sale",
      "payment_method",
      "order_month",
      "order_day_of_week",
      "value_to_avg_spend_ratio",
    ],
  },
  {
    title: "Product category statistics",
    source: "Derived by the company across its Indian product catalogue",
    used: "Puts the order in context against similar products and categories",
    fields: [
      "category_code",
      "category_complaint_rate",
      "category_dissatisfaction_rate",
      "category_avg_rating",
      "category_low_rating_pct",
    ],
  },
  {
    title: "Cross-feature interaction signals",
    source: "Calculated by TrustLoop from the fields above",
    used: "XGBoost Indian return-risk model scoring",
    fields: ["discount_return_cross", "rating_delivery_cross"],
  },
];

function DataRequirements() {
  return (
    <AppShell>
      <PageHeader
        eyebrow="Data requirements"
        title="What the company needs to supply"
        description="Every return is scored against the customer's own history and the order it belongs to. Those records come from the company's systems. The consumer only supplies the return request itself and a photo."
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <Panel 
          title="From the consumer" 
          description="Collected at the moment a return request is raised."
          className="h-fit"
        >
          <ul className="space-y-4 text-sm mt-1">
            <li className="flex items-start gap-3 rounded-xl border border-slate-100 bg-[#F7F9FC]/70 p-3">
              <IconContainer tone="blue" className="size-8 shrink-0">
                <FileText className="size-4" />
              </IconContainer>
              <div>
                <span className="font-bold text-[#0B1F3A]">Order reference</span>
                <p className="text-xs text-slate-500 mt-0.5">Identifies which order is being returned.</p>
              </div>
            </li>
            <li className="flex items-start gap-3 rounded-xl border border-slate-100 bg-[#F7F9FC]/70 p-3">
              <IconContainer tone="cyan" className="size-8 shrink-0">
                <Layers className="size-4" />
              </IconContainer>
              <div>
                <span className="font-bold text-[#0B1F3A]">Reason for return</span>
                <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                  One of: {REASON_CODES.map((r) => r.label).join(", ")}.
                </p>
              </div>
            </li>
            <li className="flex items-start gap-3 rounded-xl border border-slate-100 bg-[#F7F9FC]/70 p-3">
              <IconContainer tone="amber" className="size-8 shrink-0">
                <AlertCircle className="size-4" />
              </IconContainer>
              <div>
                <span className="font-bold text-[#0B1F3A]">Claimed item condition</span>
                <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                  One of: {CONDITIONS.map((c) => c.label).join(", ")}.
                </p>
              </div>
            </li>
            <li className="flex items-start gap-3 rounded-xl border border-slate-100 bg-[#F7F9FC]/70 p-3">
              <IconContainer tone="blue" className="size-8 shrink-0">
                <FileText className="size-4" />
              </IconContainer>
              <div>
                <span className="font-bold text-[#0B1F3A]">Description</span>
                <p className="text-xs text-slate-500 mt-0.5">Free text, optional but recommended.</p>
              </div>
            </li>
            <li className="flex items-start gap-3 rounded-xl border border-slate-100 bg-[#F7F9FC]/70 p-3">
              <IconContainer tone="green" className="size-8 shrink-0">
                <Camera className="size-4" />
              </IconContainer>
              <div>
                <span className="font-bold text-[#0B1F3A]">Photo of the item</span>
                <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                  JPEG, PNG or WebP up to 8 MB. Required for any damage or wrong-item claim, otherwise
                  the image check is skipped and the case leans on the remaining evidence.
                </p>
              </div>
            </li>
          </ul>
        </Panel>

        <Panel
          className="lg:col-span-2"
          title="From the company"
          description="Loaded in advance, per customer and per order. Anything missing falls back to a dataset-wide typical value, which weakens the score for that case."
        >
          <div className="space-y-6">
            {GROUPS.map((group) => (
              <div key={group.title} className="rounded-xl border border-slate-100 bg-[#F7F9FC]/40 p-4 transition-all hover:bg-white hover:shadow-xs">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/60 pb-3">
                  <div className="flex items-center gap-2.5">
                    <IconContainer tone="blue" className="size-8">
                      <Database className="size-4" />
                    </IconContainer>
                    <div>
                      <h3 className="text-sm font-bold text-[#0B1F3A]">{group.title}</h3>
                      <p className="text-[11px] text-slate-500">{group.source}</p>
                    </div>
                  </div>
                  <Pill tone="brand">{group.fields.length} fields</Pill>
                </div>
                <div className="mt-2 text-xs font-medium text-slate-500">
                  <span className="font-semibold text-slate-700">Used for:</span> {group.used}
                </div>
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full min-w-[28rem] text-sm">
                    <thead>
                      <tr className="border-b border-slate-200/80 text-left text-[11px] uppercase tracking-wider text-slate-400 font-mono">
                        <th className="py-2.5 pr-4 font-semibold">Detail</th>
                        <th className="py-2.5 pr-4 font-semibold">Field name</th>
                        <th className="py-2.5 font-semibold">Fallback if missing</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {group.fields.map((f) => (
                        <tr key={f} className="transition-colors hover:bg-slate-50/80">
                          <td className="py-2 pr-4 font-medium text-[#0B1F3A]">{featureLabel(f)}</td>
                          <td className="py-2 pr-4 font-mono text-xs text-slate-500">
                            <span className="rounded bg-slate-100 px-1.5 py-0.5">{f}</span>
                          </td>
                          <td className="py-2 tabular-nums text-xs font-semibold text-slate-600">
                            {FEATURE_MEDIANS[f] ?? "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <Panel
        className="mt-6"
        title="Why each part matters"
        description="A missing group does not stop the pipeline, but it removes a line of evidence from the decision."
      >
        <dl className="grid gap-4 sm:grid-cols-2">
          {[
            {
              term: "No customer history",
              body: "Account behaviour signals go blank, so a first-time and a repeat returner look identical.",
              tone: "amber" as const,
              icon: UserCheck,
            },
            {
              term: "No delivery dates",
              body: "The return window cannot be checked and late-delivery context is lost.",
              tone: "blue" as const,
              icon: Calendar,
            },
            {
              term: "No category statistics",
              body: "The order loses its comparison against similar products.",
              tone: "cyan" as const,
              icon: Layers,
            },
            {
              term: "No photo",
              body: "The image check is skipped and damage claims cannot be corroborated.",
              tone: "red" as const,
              icon: Camera,
            },
          ].map(({ term, body, tone, icon: Icon }) => (
            <div key={term} className="flex items-start gap-3.5 rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs transition-all hover:border-[#BFDBFE] hover:shadow-panel">
              <IconContainer tone={tone} className="size-9 shrink-0">
                <Icon className="size-4.5" />
              </IconContainer>
              <div>
                <dt className="text-sm font-bold text-[#0B1F3A]">{term}</dt>
                <dd className="mt-1 text-xs text-slate-500 leading-relaxed">{body}</dd>
              </div>
            </div>
          ))}
        </dl>
      </Panel>
    </AppShell>
  );
}
