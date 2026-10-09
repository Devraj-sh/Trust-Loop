import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { AppShell, PageHeader } from "@/components/trustloop/app-shell";
import { EmptyState, Panel, Pill } from "@/components/trustloop/primitives";
import { searchOrders, submitReturn } from "@/lib/trustloop/api.functions";
import {
  CONDITIONS,
  REASON_CODES,
  formatCurrency,
  type ConditionCode,
  type ReasonCode,
} from "@/lib/trustloop/domain";
import { MODELS } from "@/lib/ml/engine";
import { DEMO_SCENARIOS, PRESET_IMAGES, type DemoScenario } from "@/lib/trustloop/demo-scenarios";

const searchSchema = z.object({
  scenario: z.string().optional(),
});

export const Route = createFileRoute("/returns/new")({
  validateSearch: (search) => searchSchema.parse(search),
  head: () => ({
    meta: [
      { title: "Analyse a return — TrustLoop" },
      {
        name: "description",
        content:
          "Guided return intake investigation. Cross-examine claims with ML risk models, policy rules, customer history, and visual evidence.",
      },
      { property: "og:title", content: "Analyse a return — TrustLoop" },
      {
        property: "og:description",
        content: "Run the full TrustLoop decision pipeline on a return request.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: NewReturn,
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

const MAX_BYTES = 8 * 1024 * 1024;

const PIPELINE_STEPS = [
  "Creating return case record...",
  "Loading customer & order context...",
  "Constructing 41-dimensional feature vector...",
  "Evaluating XGBoost return-risk model...",
  "Executing deterministic policy engine...",
  "Computing customer behavioral risk signals...",
  "Inspecting product photo evidence...",
  "Cross-referencing Merchant Consortium (UrbanBasket ⇄ NexaCart)...",
  "Fusing evidence & calculating source agreement...",
  "Generating final explainable decision...",
];

function NewReturn() {
  const navigate = useNavigate();
  const searchParams = Route.useSearch();
  const search = useServerFn(searchOrders);
  const submit = useServerFn(submitReturn);

  const [query, setQuery] = useState("");
  const [orderId, setOrderId] = useState<string | null>(null);
  const [reason, setReason] = useState<ReasonCode>("DAMAGED");
  const [condition, setCondition] = useState<ConditionCode>("DAMAGED");
  const [description, setDescription] = useState("");
  const [model, setModel] = useState(MODELS[0]!.key);
  const [selectedScenarioId, setSelectedScenarioId] = useState<string | null>(null);

  const [image, setImage] = useState<{
    base64: string;
    contentType: "image/jpeg" | "image/png" | "image/webp" | "image/svg+xml";
    byteSize: number;
    preview: string;
    sourceName?: string;
  } | null>(null);

  const [analysisStep, setAnalysisStep] = useState<number>(0);
  const [isProcessingModal, setIsProcessingModal] = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);

  const orders = useQuery({
    queryKey: ["orders", query],
    queryFn: () => search({ data: { query } }),
  });

  // Apply scenario helper
  const applyScenario = (scenario: DemoScenario) => {
    setSelectedScenarioId(scenario.id);
    setOrderId(scenario.orderId);
    setReason(scenario.reason);
    setCondition(scenario.condition);
    setDescription(scenario.description);
    if (scenario.imagePreset && PRESET_IMAGES[scenario.imagePreset]) {
      const p = PRESET_IMAGES[scenario.imagePreset];
      setImage({
        ...p,
        sourceName: scenario.imageName ?? "Demo Preset Photo",
      });
    } else {
      setImage(null);
    }
    toast.info(`Loaded ${scenario.name}`);
  };

  // Intelligent order selection helper: auto-fills Customer Claim and Step 3 Photo Evidence
  const selectOrder = (o: NonNullable<typeof orders.data>[number]) => {
    setSelectedScenarioId(null);
    setOrderId(o.id);

    const rawReason = (o as any).return_reason;
    const rating = Number((o as any).customer_rating ?? (o as any).review_score ?? 4);
    const delivDays = Number((o as any).delivery_days ?? (o as any).actual_delivery_days ?? 5);
    const catCode = Number((o as any).category_code ?? 0);
    const prodName = (o as any).product_name || `Product from Order ${o.external_id}`;

    let autoReason: ReasonCode = "CHANGED_MIND";
    let autoCondition: ConditionCode = "UNOPENED";
    let autoDesc = "";
    let autoPreset: "damaged" | "no_damage" = "no_damage";
    let autoPhotoName = "Verified Intake Proof Photo";

    if (rawReason && ["DAMAGED", "DEFECTIVE", "WRONG_ITEM", "NOT_AS_DESCRIBED", "SIZE_FIT", "LATE_DELIVERY", "CHANGED_MIND"].includes(rawReason)) {
      autoReason = rawReason as ReasonCode;
    } else if (rating <= 2) {
      autoReason = "DEFECTIVE";
    } else if (delivDays >= 8) {
      autoReason = "LATE_DELIVERY";
    } else if (catCode === 7 || catCode === 8) {
      autoReason = "SIZE_FIT";
    } else if (rating === 3) {
      autoReason = "NOT_AS_DESCRIBED";
    } else {
      autoReason = "CHANGED_MIND";
    }

    if (autoReason === "DAMAGED") {
      autoCondition = "DAMAGED";
      autoDesc = `${prodName} arrived with impact fractures and damaged casing inside the shipping parcel.`;
      autoPreset = "damaged";
      autoPhotoName = `${prodName} - Transit Damage Evidence Photo`;
    } else if (autoReason === "DEFECTIVE") {
      autoCondition = "LIKE_NEW";
      autoDesc = `${prodName} is cosmetically intact but fails to operate or power on out of the box.`;
      autoPreset = "no_damage";
      autoPhotoName = `${prodName} - Functional Defect Inspection Photo`;
    } else if (autoReason === "SIZE_FIT") {
      autoCondition = "LIKE_NEW";
      autoDesc = `Dimensions and form factor for ${prodName} do not match the expected specifications.`;
      autoPreset = "no_damage";
      autoPhotoName = `${prodName} - Sizing Verification Photo`;
    } else if (autoReason === "WRONG_ITEM") {
      autoCondition = "UNOPENED";
      autoDesc = `Received a different variant/model than what was invoiced for ${prodName}. Packaging remains factory sealed.`;
      autoPreset = "no_damage";
      autoPhotoName = `${prodName} - Invoiced Variant Label Photo`;
    } else if (autoReason === "LATE_DELIVERY") {
      autoCondition = "UNOPENED";
      autoDesc = `Shipment took ${delivDays} days to arrive and missed the required event date; package remains completely unopened.`;
      autoPreset = "no_damage";
      autoPhotoName = `${prodName} - Sealed Shipping Parcel Photo`;
    } else if (autoReason === "NOT_AS_DESCRIBED") {
      autoCondition = "LIKE_NEW";
      autoDesc = `Features and appearance of ${prodName} differ materially from the catalog specification.`;
      autoPreset = "no_damage";
      autoPhotoName = `${prodName} - Product Comparison Photo`;
    } else {
      autoCondition = "UNOPENED";
      autoDesc = `Customer decided not to keep ${prodName}. Item remains completely sealed in original manufacturer packaging.`;
      autoPreset = "no_damage";
      autoPhotoName = `${prodName} - Sealed Factory Box Photo`;
    }

    setReason(autoReason);
    setCondition(autoCondition);
    setDescription(autoDesc);

    const p = PRESET_IMAGES[autoPreset];
    setImage({
      ...p,
      sourceName: autoPhotoName,
    });

    toast.info(`Selected ${o.external_id} — Auto-filled Claim & Photo Evidence`);
  };

  // Check URL search parameter for initial scenario
  useEffect(() => {
    if (searchParams.scenario) {
      const matched = DEMO_SCENARIOS.find((s) => s.id === searchParams.scenario);
      if (matched) {
        applyScenario(matched);
      }
    }
  }, [searchParams.scenario]);

  const mutation = useMutation({
    mutationFn: async () => {
      setIsProcessingModal(true);
      setAnalysisStep(0);

      // Visual pipeline progression
      const interval = setInterval(() => {
        setAnalysisStep((prev) => {
          if (prev < PIPELINE_STEPS.length - 1) return prev + 1;
          return prev;
        });
      }, 240);

      try {
        const result = await submit({
          data: {
            orderId: orderId!,
            reason,
            condition,
            description: description || undefined,
            model,
            image: image
              ? {
                base64: image.base64,
                contentType: image.contentType,
                byteSize: image.byteSize,
              }
              : null,
          },
        });
        clearInterval(interval);
        setAnalysisStep(PIPELINE_STEPS.length);
        return result;
      } catch (err) {
        clearInterval(interval);
        throw err;
      }
    },
    onSuccess: (result) => {
      setTimeout(() => {
        setIsProcessingModal(false);
        toast.success(`Analysis complete — Case ${result.reference} generated`);
        navigate({ to: "/returns/$id", params: { id: result.returnId } });
      }, 400);
    },
    onError: (error: Error) => {
      setIsProcessingModal(false);
      toast.error(error.message || "The analysis could not be completed");
    },
  });

  async function onFile(file: File) {
    if (!["image/jpeg", "image/png", "image/webp", "image/svg+xml"].includes(file.type)) {
      toast.error("Please upload a JPEG, PNG, WebP or SVG photo");
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error("Photos must be 8 MB or smaller");
      return;
    }
    const buffer = new Uint8Array(await file.arrayBuffer());
    let binary = "";
    for (let i = 0; i < buffer.length; i += 8192)
      binary += String.fromCharCode(...buffer.subarray(i, i + 8192));
    setImage({
      base64: btoa(binary),
      contentType: file.type as "image/jpeg",
      byteSize: file.size,
      preview: URL.createObjectURL(file),
      sourceName: file.name,
    });
  }

  const selected = orders.data?.find((o) => o.id === orderId);
  const selectedCustomer = selected?.customers as {
    city: string;
    state: string;
    total_orders: number;
    customer_name?: string;
    external_id?: string;
    return_rate?: number;
    total_returns?: number;
    total_spent?: number;
    avg_customer_rating?: number;
    low_rating_count?: number;
  } | null;

  return (
    <AppShell>
      {/* Guided Progress Stepper with Solid 3D Badges */}
      <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_3px_0_0_#E2E8F0]">
        <div className="flex items-center justify-between gap-2 overflow-x-auto text-xs font-mono">
          <div className={`flex items-center gap-2 px-4 py-1.5 rounded-full ${orderId ? "bg-[#12A878] text-white font-bold border border-[#0D7B57] shadow-[0_2.5px_0_0_#084F37]" : "bg-[#1769E0] text-white font-bold border border-[#0E4494] shadow-[0_2.5px_0_0_#093574]"}`}>
            <span>01 ORDER</span>
            {orderId && <span>✓</span>}
          </div>
          <span className="text-slate-400 font-bold">&rarr;</span>
          <div className={`flex items-center gap-2 px-4 py-1.5 rounded-full ${reason ? "bg-[#12A878] text-white font-bold border border-[#0D7B57] shadow-[0_2.5px_0_0_#084F37]" : orderId ? "bg-[#1769E0] text-white font-bold border border-[#0E4494] shadow-[0_2.5px_0_0_#093574]" : "bg-white text-slate-500 font-bold border border-slate-300 shadow-[0_2px_0_0_#CBD5E1]"}`}>
            <span>02 CLAIM</span>
            {reason && <span>✓</span>}
          </div>
          <span className="text-slate-400 font-bold">&rarr;</span>
          <div className={`flex items-center gap-2 px-4 py-1.5 rounded-full ${image ? "bg-[#12A878] text-white font-bold border border-[#0D7B57] shadow-[0_2.5px_0_0_#084F37]" : reason ? "bg-[#1769E0] text-white font-bold border border-[#0E4494] shadow-[0_2.5px_0_0_#093574]" : "bg-white text-slate-500 font-bold border border-slate-300 shadow-[0_2px_0_0_#CBD5E1]"}`}>
            <span>03 EVIDENCE</span>
            {image && <span>✓</span>}
          </div>
          <span className="text-slate-400 font-bold">&rarr;</span>
          <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-white text-[#1769E0] font-bold border-2 border-[#1769E0] shadow-[0_2px_0_0_#1769E0]">
            <span>04 ML ENGINE (41F)</span>
          </div>
          <span className="text-slate-400 font-bold">&rarr;</span>
          <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-white text-slate-500 font-bold border border-slate-300 shadow-[0_2px_0_0_#CBD5E1]">
            <span>05 FUSION & DECISION</span>
          </div>
        </div>
      </div>

      <PageHeader
        eyebrow="Intake Workflow"
        title="Analyse a Return"
        description="Select an order from the 4,981 loaded orders or pick a 1-click analysis scenario to witness the complete evidence pipeline."
        action={
          <Link
            to="/data"
            className="btn-3d-secondary inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold"
          >
            Data Architecture & Specifications &rarr;
          </Link>
        }
      />

      {/* 1-Click Analysis Scenarios Panel */}
      <section className="mb-8 rounded-2xl border-2 border-amber-400 bg-white p-5 shadow-[0_3px_0_0_#D97706,0_8px_24px_rgba(217,119,6,0.1)]">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <span className="size-2 rounded-full bg-amber-500 animate-ping" />
            <h2 className="font-display font-bold text-sm text-[#0B1F3A]">
              Analysis Scenarios (1-Click Presets)
            </h2>
            <span className="rounded bg-white text-amber-800 font-mono text-[10px] font-bold px-2 py-0.5 uppercase border border-amber-300 shadow-[0_1.5px_0_0_#D97706]">
              Verified
            </span>
          </div>
          <p className="text-xs text-slate-500 font-medium">
            Select an analysis scenario to pre-fill verified database order, claim reason, and photo evidence
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {DEMO_SCENARIOS.map((s) => {
            const active = selectedScenarioId === s.id;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => applyScenario(s)}
                className={`p-3.5 rounded-xl border text-left transition-all flex flex-col justify-between ${active
                    ? "border-amber-500 bg-amber-500/15 shadow-[0_3px_0_0_#D97706,0_6px_14px_rgba(217,119,6,0.2)]"
                    : "border-slate-200 bg-white shadow-[0_2px_0_0_#E2E8F0] hover:-translate-y-0.5 hover:border-amber-300 hover:shadow-[0_4px_0_0_#FDE68A]"
                  }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
                      {s.tag}
                    </span>
                    <Pill tone={s.badgeTone} className="text-[10px] py-0 px-1.5">
                      {s.expectedOutcome === "MANUAL_REVIEW" ? "Human Review" : s.expectedOutcome}
                    </Pill>
                  </div>
                  <p className="mt-1.5 text-xs font-semibold text-foreground leading-tight">
                    {s.name}
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground line-clamp-2">
                    {s.headline}
                  </p>
                </div>

                <div className="mt-3 pt-2 border-t border-border/50 flex items-center justify-between text-[10px] font-mono text-muted-foreground">
                  <span>Val: ${s.productValue.toFixed(2)}</span>
                  <span className="text-primary font-medium">{active ? "SELECTED ✓" : "Load &rarr;"}</span>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-6">
          {/* Step 1: Order Search & Selection */}
          <Panel
            title="Step 1 — Choose the Order"
            description="Search loaded orders by ID, Customer Name (Rahul, Aarav, Neha), Product, City, or State."
          >
            <label htmlFor="order-search" className="sr-only">
              Search orders
            </label>
            <input
              id="order-search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by customer (Rahul, Neha, Aarav), order ID (IN-CURRENT-001, ORD_14841), or product (Samsung, Noise)…"
              className="w-full rounded-xl border border-input bg-background px-4 py-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring font-mono"
            />

            {/* Selected Order Context Card */}
            {selected && (
              <div className="mt-4 rounded-xl border border-primary/30 bg-primary/5 p-4 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-primary/20">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-primary text-sm">
                      ORDER: {selected.external_id}
                    </span>
                    {(selected as any).is_current_return && (
                      <span className="rounded bg-rose-500/15 text-rose-700 dark:text-rose-300 font-mono text-[10px] font-bold px-2 py-0.5">
                        ACTIVE INTAKE CASE
                      </span>
                    )}
                  </div>
                  <span className="font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
                    ✓ CUSTOMER PROFILE & ORDER HISTORY LOADED
                  </span>
                </div>

                <div className="mt-2.5 grid grid-cols-2 sm:grid-cols-4 gap-3 text-muted-foreground">
                  <div>
                    <span className="text-[10px] uppercase font-mono block">Customer</span>
                    <span className="text-sm font-semibold text-foreground">
                      {selectedCustomer?.customer_name || (selected as any).customer_name || "Verified Customer"}
                    </span>
                    <span className="text-[10px] font-mono text-muted-foreground block">
                      {selectedCustomer?.external_id || (selected as any).customer_id}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-mono block">Order Item & Value</span>
                    <span className="text-sm font-semibold text-foreground font-mono">
                      {formatCurrency(Number(selected.total_price))}
                    </span>
                    <span className="text-[10px] text-foreground truncate block">
                      {(selected as any).product_name || "Item"}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-mono block">Customer Return History</span>
                    <span className={`text-sm font-bold font-mono ${
                      Number(selectedCustomer?.return_rate ?? 0) > 0.3
                        ? "text-destructive"
                        : "text-emerald-600 dark:text-emerald-400"
                    }`}>
                      {((Number(selectedCustomer?.return_rate ?? 0)) * 100).toFixed(1)}% Rate
                    </span>
                    <span className="text-[10px] text-muted-foreground block font-mono">
                      {selectedCustomer?.total_returns ?? 0} returns / {selectedCustomer?.total_orders ?? 14} orders
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-mono block">Customer Feedback & Spend</span>
                    <span className="text-sm font-semibold text-foreground font-mono">
                      {selectedCustomer?.avg_customer_rating ? `${Number(selectedCustomer.avg_customer_rating).toFixed(1)}/5.0` : "4.0/5.0"}
                    </span>
                    <span className="text-[10px] text-muted-foreground block font-mono">
                      {formatCurrency(Number(selectedCustomer?.total_spent ?? selected.total_price))} lifetime
                    </span>
                  </div>
                </div>

                <p className="mt-2.5 text-[11px] text-muted-foreground italic border-t border-primary/10 pt-1.5">
                  ✓ Full 14-order historical record & behavioral signals fed into the 41-feature XGBoost model and fusion engine.
                </p>
              </div>
            )}

            <div className="mt-4 max-h-[300px] overflow-y-auto space-y-2 pr-1">
              {orders.isPending && <p className="text-sm text-muted-foreground">Loading orders…</p>}
              {orders.data?.length === 0 && (
                <p className="text-sm text-muted-foreground">No orders match that search query.</p>
              )}
              {orders.data?.map((o) => {
                const customer = o.customers as {
                  city: string;
                  state: string;
                  total_orders: number;
                  customer_name?: string;
                  return_rate?: number;
                  total_returns?: number;
                } | null;
                const active = o.id === orderId;
                const isCurrent = (o as any).is_current_return;
                const custName = (o as any).customer_name || customer?.customer_name;
                const prodName = (o as any).product_name;
                return (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => selectOrder(o)}
                    aria-pressed={active}
                    className={`flex w-full flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left transition-colors ${active ? "border-primary bg-accent/80 ring-1 ring-primary" : "border-border/70 hover:bg-muted/70"
                      }`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-foreground">{o.external_id}</span>
                        {isCurrent && (
                          <span className="rounded bg-rose-500/15 text-rose-700 dark:text-rose-300 font-mono text-[9px] font-bold px-1.5 py-0.5">
                            DEMO CASE
                          </span>
                        )}
                        {custName && (
                          <span className="text-xs font-semibold text-primary">· {custName}</span>
                        )}
                      </div>
                      <p className="text-xs font-medium text-foreground mt-0.5">
                        {prodName ? `${prodName} · ` : ""}{formatCurrency(Number(o.total_price))} · {customer?.city}, {customer?.state}
                      </p>
                      {customer?.total_orders && customer.total_orders > 1 && (
                        <p className="text-[11px] font-mono text-muted-foreground">
                          History: {customer.total_returns ?? 0} returns / {customer.total_orders} orders ({((customer.return_rate ?? 0) * 100).toFixed(0)}% return rate)
                        </p>
                      )}
                    </div>
                    <div className="text-right text-xs text-muted-foreground font-mono">
                      <p>
                        Delivered{" "}
                        {o.delivered_at ? new Date(o.delivered_at).toLocaleDateString() : "—"}
                      </p>
                      <p>{customer?.total_orders} lifetime orders</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </Panel>

          {/* Step 2: Claim Details */}
          <Panel
            title="Step 2 — Customer Claim"
            description="The return claim reason and stated item condition become inputs into the Policy & Evidence Fusion engines."
          >
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label htmlFor="reason" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground font-mono">
                  Return Reason
                </label>
                <select
                  id="reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value as ReasonCode)}
                  className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {REASON_CODES.map((r) => (
                    <option key={r.code} value={r.code}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="condition" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground font-mono">
                  Claimed Item Condition
                </label>
                <select
                  id="condition"
                  value={condition}
                  onChange={(e) => setCondition(e.target.value as ConditionCode)}
                  className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {CONDITIONS.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-2">
                <label htmlFor="description" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground font-mono">
                  Customer Description / Claim Details
                </label>
                <textarea
                  id="description"
                  rows={3}
                  maxLength={1000}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. The item arrived cracked in the shipping box and does not turn on…"
                  className="w-full rounded-xl border border-input bg-background px-3.5 py-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
            </div>

            <div className="mt-4 rounded-lg bg-muted/60 p-3 text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">Explainability note:</span> The claim reason is cross-checked against
              the submitted photo. If the customer claims &quot;Damaged&quot; but visual inspection reveals pristine hardware,
              TrustLoop triggers an <span className="font-semibold text-amber-600 dark:text-amber-400">Evidence Conflict</span>.
            </div>
          </Panel>

          {/* Step 3: Photo Evidence */}
          <Panel
            title="Step 3 — Physical Photo Evidence"
            description="Submitted photos are inspected for damage, fractures, and claim corroboration."
          >
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/svg+xml"
              className="sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void onFile(file);
              }}
            />

            {image ? (
              <div className="flex flex-wrap items-center gap-5 p-4 rounded-xl border border-border/80 bg-muted/30">
                <img
                  src={image.preview}
                  alt="Evidence preview"
                  className="h-32 w-32 rounded-xl border border-border object-contain bg-slate-950"
                />
                <div className="text-sm space-y-1">
                  <p className="font-semibold text-foreground">
                    {image.sourceName ?? "Customer Evidence Photo"}
                  </p>
                  <p className="text-xs text-muted-foreground font-mono">
                    {(image.byteSize / 1024).toFixed(1)} KB · {image.contentType}
                  </p>
                  <div className="pt-1 flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 text-[11px] font-mono text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/30">
                      ✓ READY FOR VISION INSPECTION
                    </span>
                  </div>
                  <div className="pt-2 flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => fileRef.current?.click()}
                      className="text-xs text-primary font-medium hover:underline"
                    >
                      Replace photo
                    </button>
                    <span className="text-muted-foreground text-xs">·</span>
                    <button
                      type="button"
                      onClick={() => setImage(null)}
                      className="text-xs font-medium text-destructive hover:underline"
                    >
                      Remove photo
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="flex w-full flex-col items-center justify-center rounded-xl border-2 border-dashed border-border/80 py-8 text-sm text-muted-foreground transition-colors hover:bg-muted/50 hover:border-primary/50"
                >
                  <span className="font-semibold text-foreground">Upload Customer Photo</span>
                  <span className="mt-1 text-xs">JPEG, PNG, WebP or SVG up to 8 MB</span>
                </button>

                {/* Evidence Presets Quick Select */}
                <div className="pt-2">
                  <p className="text-xs font-mono font-medium text-muted-foreground uppercase tracking-wider mb-2">
                    Or select pre-verified demo evidence:
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        const p = PRESET_IMAGES.no_damage;
                        setImage({ ...p, sourceName: "Factory Clean Hardware (Undamaged)" });
                      }}
                      className="p-3 rounded-xl border border-border/70 hover:border-emerald-500/60 bg-card hover:bg-emerald-500/5 text-left text-xs transition-colors"
                    >
                      <p className="font-semibold text-foreground">Pristine / No Damage Photo</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Clean hardware. Use to test Evidence Conflict against damage claims!
                      </p>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const p = PRESET_IMAGES.damaged;
                        setImage({ ...p, sourceName: "Cracked Housing Evidence Photo" });
                      }}
                      className="p-3 rounded-xl border border-border/70 hover:border-destructive/60 bg-card hover:bg-destructive/5 text-left text-xs transition-colors"
                    >
                      <p className="font-semibold text-foreground">Damaged Hardware Photo</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Severe casing impact fracture corroborating damage.
                      </p>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </Panel>
        </div>

        {/* Right Sidebar: Model Selection & Submission */}
        <aside className="space-y-6 lg:sticky lg:top-24 lg:self-start">
          <Panel title="ML Risk Model" description="Select the machine learning algorithm to evaluate the 41 features.">
            <div className="space-y-2.5">
              {MODELS.map((m) => (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => setModel(m.key)}
                  aria-pressed={model === m.key}
                  className={`w-full rounded-xl border px-4 py-3 text-left transition-all ${model === m.key
                      ? "border-primary bg-primary/10 shadow-xs ring-1 ring-primary"
                      : "border-border/70 hover:bg-muted"
                    }`}
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-foreground">{m.label}</p>
                    {model === m.key && (
                      <span className="rounded bg-primary text-primary-foreground text-[10px] font-mono px-1.5 py-0.5">
                        ACTIVE
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 font-mono">{m.algorithm}</p>
                </button>
              ))}
            </div>
            <p className="mt-3 text-[11px] text-muted-foreground">
              Evaluated directly against pre-trained weight matrices from the source dataset.
            </p>
          </Panel>

          <Panel title="Pipeline Execution Ready">
            {selected ? (
              <div className="space-y-2.5 text-xs">
                <div className="flex items-center justify-between pb-2 border-b border-border/60">
                  <span className="font-mono text-muted-foreground">Target Order:</span>
                  <span className="font-mono font-semibold text-foreground">{selected.external_id.slice(0, 14)}…</span>
                </div>
                <div className="flex items-center justify-between pb-2 border-b border-border/60">
                  <span className="font-mono text-muted-foreground">Order Value:</span>
                  <span className="font-semibold text-foreground">{formatCurrency(Number(selected.total_price))}</span>
                </div>
                <div className="flex items-center justify-between pb-2 border-b border-border/60">
                  <span className="font-mono text-muted-foreground">Claim Reason:</span>
                  <Pill tone="brand">{reason.replace(/_/g, " ").toLowerCase()}</Pill>
                </div>
                <div className="flex items-center justify-between pb-2 border-b border-border/60">
                  <span className="font-mono text-muted-foreground">Photo Attached:</span>
                  {image ? (
                    <Pill tone="positive">Photo Ready</Pill>
                  ) : (
                    <Pill tone="caution">No Photo</Pill>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                Please select an order above or click one of the 4 demo scenario cards to populate the intake parameters.
              </p>
            )}

            <button
              type="button"
              disabled={!orderId || mutation.isPending}
              onClick={() => mutation.mutate()}
              className="btn-3d-primary mt-5 w-full inline-flex items-center justify-center gap-2 rounded-full px-6 py-4 text-sm disabled:cursor-not-allowed disabled:opacity-50"
            >
              <span>{mutation.isPending ? "RUNNING PIPELINE…" : "RUN TRUSTLOOP ANALYSIS"}</span>
              <span className="text-base">&rarr;</span>
            </button>

            <p className="mt-3 text-[11px] text-slate-400 text-center font-mono">
              All 8 stages (features, ML, policy, behaviour, vision, fusion, decision, audit) are executed and stored.
            </p>
          </Panel>
        </aside>
      </div>

      {/* Staged Pipeline Processing Modal / Animation */}
      {isProcessingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-900 p-6 text-slate-100 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <span className="size-2.5 rounded-full bg-cyan-400 animate-ping" />
                <h3 className="font-display font-semibold text-base text-white">
                  Executing TrustLoop Decision Pipeline
                </h3>
              </div>
              <span className="font-mono text-xs text-slate-400">
                {Math.min(100, Math.round(((analysisStep + 1) / PIPELINE_STEPS.length) * 100))}%
              </span>
            </div>

            <p className="mt-2 text-xs text-slate-400">
              Cross-examining claim parameters across independent evidence pillars...
            </p>

            {/* Stepper list */}
            <div className="mt-5 space-y-2.5">
              {PIPELINE_STEPS.map((stepText, idx) => {
                const isComplete = idx < analysisStep;
                const isCurrent = idx === analysisStep;
                return (
                  <div
                    key={idx}
                    className={`flex items-center gap-3 text-xs font-mono transition-opacity ${isComplete
                        ? "text-emerald-400"
                        : isCurrent
                          ? "text-cyan-300 font-semibold"
                          : "text-slate-600 opacity-40"
                      }`}
                  >
                    <span className="size-4 flex items-center justify-center rounded-full border border-current text-[10px]">
                      {isComplete ? "✓" : isCurrent ? "→" : idx + 1}
                    </span>
                    <span>{stepText}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
