import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import {
  MapPin,
  TrendingUp,
  AlertTriangle,
  DollarSign,
  ShieldCheck,
  Search,
  ExternalLink,
  Flame,
  Layers,
  ArrowRight,
} from "lucide-react";

import { AppShell, PageHeader } from "@/components/trustloop/app-shell";
import { EmptyState, Panel, Pill } from "@/components/trustloop/primitives";
import { HotspotMap } from "@/components/trustloop/hotspot-map";
import { listRiskMapHotspots } from "@/lib/trustloop/api.functions";
import type { AreaHotspotMetric } from "@/lib/trustloop/geo";

const hotspotsQuery = queryOptions({
  queryKey: ["risk-map-hotspots"],
  queryFn: () => listRiskMapHotspots(),
});

export const Route = createFileRoute("/risk-map")({
  head: () => ({
    meta: [
      { title: "Geographical Return Intelligence — TrustLoop" },
      {
        name: "description",
        content:
          "Identify regional logistics corridors and hotspots with statistically elevated return and fraud investigation activity.",
      },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(hotspotsQuery),
  component: RiskMapPage,
  errorComponent: ({ error }) => (
    <AppShell>
      <EmptyState title="Could not load return hotspots" body={error.message} />
    </AppShell>
  ),
});

function RiskMapPage() {
  const { data: hotspots } = useSuspenseQuery(hotspotsQuery);
  const [selectedArea, setSelectedArea] = useState<AreaHotspotMetric>(
    hotspots[0] || {
      areaId: "AREA-SP",
      name: "São Paulo",
      state: "SP",
      lat: -23.5505,
      lng: -46.6333,
      region: "Southeast",
      totalOrders: 2109,
      totalReturns: 284,
      returnRate: 0.135,
      highRiskReturns: 42,
      highRiskRate: 0.148,
      evidenceConflicts: 19,
      evidenceConflictRate: 0.067,
      refundExposure: 52000,
      activeFraudRings: 4,
      hotspotScore: 82,
      riskTier: "CRITICAL HOTSPOT",
      topCategories: ["telephony", "watches_gifts", "computers_accessories"],
      topReturnReasons: ["Arrived Damaged", "Not as Described", "Late Delivery"],
    }
  );
  const [searchQuery, setSearchQuery] = useState("");

  const filteredHotspots = hotspots.filter(
    (h) =>
      h.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      h.state.toLowerCase().includes(searchQuery.toLowerCase()) ||
      h.region.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <AppShell>
      <PageHeader
        eyebrow="GEOGRAPHICAL RETURN INTELLIGENCE"
        title="Geographical Return Hotspots"
        description="Identify regions with statistically elevated return volume, transit delays, and coordinated abuse patterns. All metrics are normalized against total order volume."
        action={
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200 px-3 py-1 text-xs font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              27 REGIONS ANALYZED · 4,981 ORDERS
            </span>
          </div>
        }
      />

      {/* Main Grid: 68% Map + 32% Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Interactive Map */}
        <div className="lg:col-span-8 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MapPin className="w-5 h-5 text-[#1769E0]" />
              <h2 className="text-base font-bold text-[#0B1F3A]">
                Regional Return Risk Map
              </h2>
              <span className="text-xs text-slate-500">
                (Click any node to inspect region)
              </span>
            </div>
            <span className="text-xs text-slate-400 font-mono">
              Vector Centroid Projection · Pan/Zoom
            </span>
          </div>

          <HotspotMap
            hotspots={hotspots}
            selectedState={selectedArea.state}
            onSelectArea={(area) => {
              if (area) setSelectedArea(area);
            }}
            height={540}
          />

          {/* Safety & Non-Discrimination Notice */}
          <div className="p-3.5 bg-blue-50/70 border border-blue-200/80 rounded-xl text-xs text-blue-900 flex items-start gap-2.5">
            <ShieldCheck className="w-4 h-4 text-[#1769E0] shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-blue-950">
                Responsible AI & Geographic Fairness Policy
              </p>
              <p className="mt-0.5 leading-relaxed text-blue-800/90">
                Geography is <strong>never</strong> used as proof of return fraud. It only adjusts investigation priority based on empirical logistics bottlenecks, delivery delays, and cluster density. Maximum geographic contribution is capped at +15 points to prevent systemic bias.
              </p>
            </div>
          </div>
        </div>

        {/* Right: Area Investigation Panel */}
        <div className="lg:col-span-4 space-y-4">
          <Panel className="p-5 border-slate-200/90 shadow-sm">
            <div className="flex items-start justify-between border-b border-slate-100 pb-4">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  AREA INVESTIGATION
                </span>
                <h3 className="mt-1 text-xl font-bold text-[#0B1F3A] flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-[#1769E0]" />
                  {selectedArea.name} ({selectedArea.state})
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Region: {selectedArea.region} · {selectedArea.totalOrders.toLocaleString()} Historical Orders
                </p>
              </div>

              <div className="text-right">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                  HOTSPOT SCORE
                </span>
                <span className="font-mono text-2xl font-black text-slate-900">
                  {selectedArea.hotspotScore}
                  <span className="text-xs font-semibold text-slate-400">/100</span>
                </span>
              </div>
            </div>

            {/* Risk Tier Badge */}
            <div className="py-3 border-b border-slate-100 flex items-center justify-between">
              <span className="text-xs text-slate-600 font-medium">Risk Classification:</span>
              <span
                className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                  selectedArea.riskTier === "CRITICAL HOTSPOT"
                    ? "bg-red-100 text-red-700"
                    : selectedArea.riskTier === "HIGH RISK"
                    ? "bg-orange-100 text-orange-700"
                    : selectedArea.riskTier === "MEDIUM RISK"
                    ? "bg-amber-100 text-amber-700"
                    : "bg-emerald-100 text-emerald-700"
                }`}
              >
                {selectedArea.riskTier}
              </span>
            </div>

            {/* Key Metrics */}
            <div className="grid grid-cols-2 gap-3 py-3 border-b border-slate-100 text-xs">
              <div className="p-2.5 bg-slate-50 rounded-lg">
                <span className="text-slate-500 block">Return Rate</span>
                <span className="text-base font-mono font-bold text-slate-900">
                  {(selectedArea.returnRate * 100).toFixed(1)}%
                </span>
                <span className="text-[10px] text-slate-400 block mt-0.5">
                  {selectedArea.totalReturns} total returns
                </span>
              </div>

              <div className="p-2.5 bg-slate-50 rounded-lg">
                <span className="text-slate-500 block">High-Risk Rate</span>
                <span className="text-base font-mono font-bold text-orange-600">
                  {(selectedArea.highRiskRate * 100).toFixed(1)}%
                </span>
                <span className="text-[10px] text-slate-400 block mt-0.5">
                  {selectedArea.highRiskReturns} high-risk returns
                </span>
              </div>

              <div className="p-2.5 bg-slate-50 rounded-lg">
                <span className="text-slate-500 block">Evidence Conflicts</span>
                <span className="text-base font-mono font-bold text-slate-900">
                  {selectedArea.evidenceConflicts}
                </span>
                <span className="text-[10px] text-slate-400 block mt-0.5">
                  {(selectedArea.evidenceConflictRate * 100).toFixed(1)}% conflict rate
                </span>
              </div>

              <div className="p-2.5 bg-slate-50 rounded-lg">
                <span className="text-slate-500 block">Active Fraud Rings</span>
                <span className="text-base font-mono font-bold text-[#DC2626]">
                  {selectedArea.activeFraudRings}
                </span>
                <span className="text-[10px] text-slate-400 block mt-0.5">
                  linked syndicates
                </span>
              </div>
            </div>

            {/* Refund Exposure */}
            <div className="py-3 border-b border-slate-100 flex items-center justify-between">
              <div>
                <span className="text-xs text-slate-500 block">Refund Exposure</span>
                <span className="text-lg font-mono font-bold text-slate-900">
                  ${selectedArea.refundExposure.toLocaleString()}
                </span>
              </div>
              <span className="text-xs text-slate-500 font-mono">
                Priority: +{Math.min(15, Math.round((selectedArea.hotspotScore / 100) * 15))} pts
              </span>
            </div>

            {/* Top Categories & Reasons */}
            <div className="py-3 border-b border-slate-100 space-y-2 text-xs">
              <div>
                <span className="font-semibold text-slate-700 block mb-1">
                  Top Targeted Categories:
                </span>
                <div className="flex flex-wrap gap-1">
                  {selectedArea.topCategories.map((c) => (
                    <span
                      key={c}
                      className="bg-slate-100 text-slate-700 text-[11px] font-medium px-2 py-0.5 rounded"
                    >
                      {c.replace(/_/g, " ")}
                    </span>
                  ))}
                </div>
              </div>

              <div className="pt-1">
                <span className="font-semibold text-slate-700 block mb-1">
                  Common Return Claims:
                </span>
                <div className="flex flex-wrap gap-1">
                  {selectedArea.topReturnReasons.map((r) => (
                    <span
                      key={r}
                      className="bg-slate-100 text-slate-700 text-[11px] font-medium px-2 py-0.5 rounded"
                    >
                      {r}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Action */}
            <div className="pt-4">
              <Link
                to="/review"
                className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#1769E0] text-white px-3 py-2 text-xs font-bold hover:bg-[#1558bd] transition-colors shadow-xs"
              >
                <span>View Returns From This Area ({selectedArea.totalReturns})</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </Panel>
        </div>
      </div>
    </AppShell>
  );
}
