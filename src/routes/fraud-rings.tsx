import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import {
  ShieldAlert,
  Network,
  Users,
  Smartphone,
  MapPin,
  Package,
  RotateCcw,
  DollarSign,
  AlertOctagon,
  Search,
  ExternalLink,
  CheckCircle2,
  BookmarkCheck,
  Eye,
} from "lucide-react";

import { AppShell, PageHeader } from "@/components/trustloop/app-shell";
import { EmptyState, Panel, Pill } from "@/components/trustloop/primitives";
import { RelationshipGraph } from "@/components/trustloop/relationship-graph";
import { listFraudRings } from "@/lib/trustloop/api.functions";
import type { FraudRingSummary } from "@/lib/trustloop/network";

const ringsQuery = queryOptions({
  queryKey: ["fraud-rings"],
  queryFn: () => listFraudRings(),
});

export const Route = createFileRoute("/fraud-rings")({
  head: () => ({
    meta: [
      { title: "Fraud Ring Intelligence — TrustLoop" },
      {
        name: "description",
        content:
          "Detect coordinated return abuse across accounts, devices, products and locations with graph-based relationship intelligence.",
      },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(ringsQuery),
  component: FraudRingsPage,
  errorComponent: ({ error }) => (
    <AppShell>
      <EmptyState title="Could not load fraud rings" body={error.message} />
    </AppShell>
  ),
});

function FraudRingsPage() {
  const { data: rings } = useSuspenseQuery(ringsQuery);
  const [selectedRingId, setSelectedRingId] = useState<string>(rings[0]?.id || "TL-RING-001");
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const currentRing: FraudRingSummary =
    rings.find((r) => r.id === selectedRingId) || rings[0]!;

  const filteredRings = rings.filter((r) => {
    const q = searchQuery.toLowerCase();
    return (
      r.id.toLowerCase().includes(q) ||
      r.name.toLowerCase().includes(q) ||
      r.locationArea.toLowerCase().includes(q) ||
      r.primaryCategory.toLowerCase().includes(q)
    );
  });

  return (
    <AppShell>
      <PageHeader
        eyebrow="RELATIONSHIP INTELLIGENCE"
        title="Fraud Ring Intelligence"
        description="Detect coordinated return abuse across accounts, devices, products and locations. Move beyond single-order scoring into entity relationship graphs."
        action={
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 px-3 py-1 text-xs font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
              DEMO DATA · SYNTHETIC ENRICHMENT
            </span>
          </div>
        }
      />

      {/* Main Graph & Investigation Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Interactive Graph (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Network className="w-5 h-5 text-[#1769E0]" />
              <h2 className="text-base font-bold text-[#0B1F3A]">
                Entity Relationship Graph
              </h2>
              <span className="text-xs text-slate-500">
                ({currentRing.nodes.length} nodes · {currentRing.edges.length} edges)
              </span>
            </div>
            <span className="text-xs font-mono text-slate-400">
              Interactive Canvas · Drag/Zoom Enabled
            </span>
          </div>

          <RelationshipGraph
            nodes={currentRing.nodes}
            edges={currentRing.edges}
            selectedNodeId={selectedNodeId}
            onSelectNode={setSelectedNodeId}
            height={530}
          />

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 text-xs text-slate-600 flex items-start gap-2.5">
            <ShieldAlert className="w-4 h-4 text-[#1769E0] shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-slate-800">
                Graph Intelligence Insight
              </p>
              <p className="mt-0.5 leading-relaxed">
                Clicking any node highlights its 1st-degree shared entities. Nodes with pulsing red halos indicate flagged fraud pivots (such as shared device fingerprints or high-velocity drop addresses).
              </p>
            </div>
          </div>
        </div>

        {/* Right: Ring Investigation Panel (5 cols) */}
        <div className="lg:col-span-5 space-y-5">
          <Panel className="p-5 border-slate-200/90 shadow-sm">
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <span className="font-mono text-xs font-bold text-[#1769E0] tracking-wider uppercase">
                  FRAUD RING #{currentRing.id}
                </span>
                <h3 className="mt-1 text-lg font-bold text-[#0B1F3A] leading-snug">
                  {currentRing.name}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Primary Location: <strong className="text-slate-700">{currentRing.locationArea}</strong> · Category: <strong className="text-slate-700">{currentRing.primaryCategory}</strong>
                </p>
              </div>

              <div className="text-right shrink-0">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                  NETWORK RISK
                </span>
                <span className="font-mono text-2xl font-black text-[#DC2626]">
                  {currentRing.networkRisk}
                  <span className="text-xs font-semibold text-slate-400">/100</span>
                </span>
              </div>
            </div>

            {/* Metric Tiles */}
            <div className="grid grid-cols-3 gap-2.5 py-4 border-b border-slate-100">
              <div className="p-2.5 bg-slate-50 rounded-lg text-center">
                <Users className="w-4 h-4 text-[#4F46E5] mx-auto mb-1" />
                <div className="font-mono text-sm font-bold text-slate-900">{currentRing.accountCount}</div>
                <div className="text-[10px] text-slate-500 uppercase">Accounts</div>
              </div>
              <div className="p-2.5 bg-slate-50 rounded-lg text-center">
                <Smartphone className="w-4 h-4 text-[#9333EA] mx-auto mb-1" />
                <div className="font-mono text-sm font-bold text-slate-900">{currentRing.deviceCount}</div>
                <div className="text-[10px] text-slate-500 uppercase">Devices</div>
              </div>
              <div className="p-2.5 bg-slate-50 rounded-lg text-center">
                <MapPin className="w-4 h-4 text-[#D97706] mx-auto mb-1" />
                <div className="font-mono text-sm font-bold text-slate-900">{currentRing.addressCount}</div>
                <div className="text-[10px] text-slate-500 uppercase">Addresses</div>
              </div>
              <div className="p-2.5 bg-slate-50 rounded-lg text-center">
                <Package className="w-4 h-4 text-[#475569] mx-auto mb-1" />
                <div className="font-mono text-sm font-bold text-slate-900">{currentRing.orderCount}</div>
                <div className="text-[10px] text-slate-500 uppercase">Orders</div>
              </div>
              <div className="p-2.5 bg-slate-50 rounded-lg text-center">
                <RotateCcw className="w-4 h-4 text-[#EA580C] mx-auto mb-1" />
                <div className="font-mono text-sm font-bold text-slate-900">{currentRing.returnCount}</div>
                <div className="text-[10px] text-slate-500 uppercase">Returns</div>
              </div>
              <div className="p-2.5 bg-slate-50 rounded-lg text-center">
                <DollarSign className="w-4 h-4 text-[#DC2626] mx-auto mb-1" />
                <div className="font-mono text-sm font-bold text-slate-900">${currentRing.refundExposure.toLocaleString()}</div>
                <div className="text-[10px] text-slate-500 uppercase">Exposure</div>
              </div>
            </div>

            {/* Why This Ring Was Flagged */}
            <div className="py-4 border-b border-slate-100">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2.5 flex items-center gap-1.5">
                <AlertOctagon className="w-3.5 h-3.5 text-[#DC2626]" />
                Why This Ring Was Flagged
              </h4>
              <ul className="space-y-1.5 text-xs text-slate-600">
                {currentRing.reasons.map((reason, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="text-[#DC2626] font-bold shrink-0">•</span>
                    <span>{reason}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Common Patterns */}
            <div className="py-4 border-b border-slate-100">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                Identified Modus Operandi
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {currentRing.commonPatterns.map((pattern, idx) => (
                  <span
                    key={idx}
                    className="inline-block bg-slate-100 text-slate-700 text-[11px] font-medium px-2.5 py-1 rounded-md"
                  >
                    {pattern}
                  </span>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="pt-4 flex flex-wrap items-center gap-2">
              <button
                onClick={() => toast.success(`Investigation opened for ${currentRing.id}`)}
                className="flex-1 rounded-lg bg-[#1769E0] text-white px-3 py-2 text-xs font-bold hover:bg-[#1558bd] transition-colors shadow-xs"
              >
                Investigate Ring
              </button>
              <button
                onClick={() => toast.info(`Exporting 46 transactions for ${currentRing.id}`)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
              >
                View Transactions
              </button>
              <button
                onClick={() => toast.success(`Ring ${currentRing.id} added to high-frequency monitoring watchlist`)}
                className="rounded-lg border border-slate-300 bg-white p-2 text-slate-600 hover:bg-slate-50 transition-colors"
                title="Mark for Monitoring"
              >
                <BookmarkCheck className="w-4 h-4" />
              </button>
            </div>
          </Panel>
        </div>
      </div>

      {/* Bottom: Ring Directory Table */}
      <div className="mt-10 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold text-[#0B1F3A]">
              Active Fraud Rings Directory
            </h3>
            <p className="text-xs text-slate-500">
              Select any syndicate below to load its full graph and telemetry profile.
            </p>
          </div>

          <div className="relative w-72">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Filter by ID, name or location..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-white focus:outline-hidden focus:ring-2 focus:ring-[#1769E0]"
            />
          </div>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-xs">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 bg-slate-50/75 text-[11px] font-bold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-3">Ring ID</th>
                <th className="px-4 py-3">Syndicate Name</th>
                <th className="px-4 py-3">Location</th>
                <th className="px-4 py-3 text-center">Accounts</th>
                <th className="px-4 py-3 text-center">Devices</th>
                <th className="px-4 py-3 text-center">Returns</th>
                <th className="px-4 py-3 text-right">Exposure</th>
                <th className="px-4 py-3 text-center">Network Risk</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRings.map((ring) => {
                const isSelected = ring.id === selectedRingId;
                return (
                  <tr
                    key={ring.id}
                    onClick={() => setSelectedRingId(ring.id)}
                    className={`cursor-pointer transition-colors ${
                      isSelected ? "bg-blue-50/60 font-medium" : "hover:bg-slate-50/80"
                    }`}
                  >
                    <td className="px-4 py-3 font-mono font-bold text-[#1769E0]">
                      {ring.id}
                    </td>
                    <td className="px-4 py-3 text-slate-900 font-semibold">
                      {ring.name}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{ring.locationArea}</td>
                    <td className="px-4 py-3 text-center font-mono">{ring.accountCount}</td>
                    <td className="px-4 py-3 text-center font-mono">{ring.deviceCount}</td>
                    <td className="px-4 py-3 text-center font-mono text-orange-600 font-semibold">
                      {ring.returnCount}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-slate-900">
                      ${ring.refundExposure.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-block font-mono text-xs font-bold px-2 py-0.5 rounded-full ${
                          ring.networkRisk >= 85
                            ? "bg-red-100 text-red-700"
                            : "bg-amber-100 text-amber-700"
                        }`}
                      >
                        {ring.networkRisk}/100
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedRingId(ring.id);
                        }}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#1769E0] hover:underline"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        Focus Graph
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}
