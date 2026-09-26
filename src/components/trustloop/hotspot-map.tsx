import { useState, useMemo } from "react";
import type { AreaHotspotMetric } from "@/lib/trustloop/geo";
import { ZoomIn, ZoomOut, RotateCcw, MapPin, AlertTriangle, ShieldCheck, Flame } from "lucide-react";

interface HotspotMapProps {
  hotspots: AreaHotspotMetric[];
  selectedState?: string | null;
  onSelectArea?: (area: AreaHotspotMetric | null) => void;
  height?: number;
}

// Coordinate projection from Brazil bounding box to SVG coordinates
function projectLatLng(lat: number, lng: number, width = 760, height = 520) {
  const minLng = -73.5;
  const maxLng = -34.0;
  const minLat = -33.8;
  const maxLat = 5.2;

  const x = ((lng - minLng) / (maxLng - minLng)) * (width - 120) + 60;
  const y = ((maxLat - lat) / (maxLat - minLat)) * (height - 100) + 50;

  return { x, y };
}

export function HotspotMap({
  hotspots,
  selectedState,
  onSelectArea,
  height = 540,
}: HotspotMapProps) {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [hoveredArea, setHoveredArea] = useState<AreaHotspotMetric | null>(null);
  const [tierFilter, setTierFilter] = useState<string>("ALL");

  const projectedHotspots = useMemo(() => {
    return hotspots.map((h) => {
      const pos = projectLatLng(h.lat, h.lng);
      return {
        ...h,
        x: pos.x,
        y: pos.y,
      };
    });
  }, [hotspots]);

  const filteredHotspots = useMemo(() => {
    if (tierFilter === "ALL") return projectedHotspots;
    return projectedHotspots.filter((h) => h.riskTier === tierFilter);
  }, [projectedHotspots, tierFilter]);

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
  };

  const handleMouseUp = () => setIsDragging(false);

  const getTierColor = (tier: AreaHotspotMetric["riskTier"]) => {
    switch (tier) {
      case "CRITICAL HOTSPOT":
        return { fill: "#EF4444", stroke: "#DC2626", halo: "rgba(239, 68, 68, 0.25)" };
      case "HIGH RISK":
        return { fill: "#F97316", stroke: "#EA580C", halo: "rgba(249, 115, 22, 0.20)" };
      case "MEDIUM RISK":
        return { fill: "#F59E0B", stroke: "#D97706", halo: "rgba(245, 158, 11, 0.15)" };
      case "LOW RISK":
      default:
        return { fill: "#10B981", stroke: "#059669", halo: "rgba(16, 185, 129, 0.15)" };
    }
  };

  return (
    <div className="relative rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden select-none">
      {/* Top Map Toolbar */}
      <div className="absolute top-3 left-3 z-10 flex flex-wrap items-center gap-1.5 bg-white/95 backdrop-blur-xs p-1.5 rounded-xl border border-slate-200 shadow-xs">
        <button
          onClick={() => setZoom((z) => Math.min(2.5, z + 0.2))}
          className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
          title="Zoom In"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          onClick={() => setZoom((z) => Math.max(0.6, z - 0.2))}
          className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
          title="Zoom Out"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <button
          onClick={() => {
            setZoom(1);
            setPan({ x: 0, y: 0 });
          }}
          className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
          title="Reset View"
        >
          <RotateCcw className="w-4 h-4" />
        </button>

        <div className="h-4 w-px bg-slate-200 mx-1" />

        {/* Tier Filters */}
        <div className="flex items-center gap-1">
          {["ALL", "CRITICAL HOTSPOT", "HIGH RISK", "MEDIUM RISK", "LOW RISK"].map((tier) => (
            <button
              key={tier}
              onClick={() => setTierFilter(tier)}
              className={`px-2 py-0.5 text-[11px] font-semibold rounded-md transition-colors ${
                tierFilter === tier
                  ? "bg-[#1769E0] text-white"
                  : "text-slate-500 hover:text-slate-800 hover:bg-slate-100"
              }`}
            >
              {tier === "CRITICAL HOTSPOT"
                ? "Critical"
                : tier === "HIGH RISK"
                ? "High"
                : tier === "MEDIUM RISK"
                ? "Medium"
                : tier === "LOW RISK"
                ? "Low"
                : "All Areas"}
            </button>
          ))}
        </div>
      </div>

      {/* Floating Hover Card */}
      {hoveredArea && (
        <div
          className="pointer-events-none absolute z-20 bg-slate-900/95 text-white p-3 rounded-xl shadow-xl text-xs max-w-xs border border-slate-700/80 backdrop-blur-xs transition-all duration-100"
          style={{
            top: 60,
            right: 16,
          }}
        >
          <div className="flex items-center justify-between gap-2 border-b border-slate-700 pb-1.5 mb-2">
            <span className="font-bold text-sm text-slate-100 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-[#38BDF8]" />
              {hoveredArea.name} ({hoveredArea.state})
            </span>
            <span
              className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                hoveredArea.riskTier === "CRITICAL HOTSPOT"
                  ? "bg-red-500/20 text-red-400 border border-red-500/30"
                  : hoveredArea.riskTier === "HIGH RISK"
                  ? "bg-orange-500/20 text-orange-400 border border-orange-500/30"
                  : "bg-emerald-500/20 text-emerald-400"
              }`}
            >
              {hoveredArea.riskTier}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <div>
              <p className="text-slate-400">Return Rate</p>
              <p className="font-semibold text-slate-200">
                {(hoveredArea.returnRate * 100).toFixed(1)}%
              </p>
            </div>
            <div>
              <p className="text-slate-400">High-Risk Rate</p>
              <p className="font-semibold text-slate-200">
                {(hoveredArea.highRiskRate * 100).toFixed(1)}%
              </p>
            </div>
            <div>
              <p className="text-slate-400">Evidence Conflicts</p>
              <p className="font-semibold text-slate-200">{hoveredArea.evidenceConflicts} cases</p>
            </div>
            <div>
              <p className="text-slate-400">Refund Exposure</p>
              <p className="font-semibold text-slate-200">${hoveredArea.refundExposure.toLocaleString()}</p>
            </div>
          </div>

          <div className="mt-2.5 pt-2 border-t border-slate-800 flex items-center justify-between text-[10px] text-slate-400">
            <span>Hotspot Score: <strong className="text-white">{hoveredArea.hotspotScore}/100</strong></span>
            <span>{hoveredArea.activeFraudRings} active rings</span>
          </div>
        </div>
      )}

      {/* Map Legend */}
      <div className="absolute bottom-3 left-3 z-10 hidden sm:flex items-center gap-3 bg-white/95 backdrop-blur-xs px-3 py-1.5 rounded-xl border border-slate-200 text-[10px] text-slate-600 shadow-xs">
        <span className="font-semibold text-slate-800">Risk Zones:</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#10B981]" /> Low Risk</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#F59E0B]" /> Medium Risk</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#F97316]" /> High Risk</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#EF4444] animate-pulse" /> Critical Hotspot</span>
      </div>

      {/* SVG Map Canvas */}
      <svg
        width="100%"
        height={height}
        viewBox="0 0 760 520"
        className="w-full h-full bg-[#F8FAFC] cursor-grab active:cursor-grabbing"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <defs>
          <pattern id="map-grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#E2E8F0" strokeWidth="0.8" />
          </pattern>
        </defs>

        <rect width="100%" height="100%" fill="url(#map-grid)" />

        <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
          {/* Brazil Outline / Background Landmass */}
          <path
            d="M 280 60 Q 360 40 440 90 T 560 140 Q 640 180 620 240 T 580 320 Q 560 380 480 430 T 400 470 Q 360 490 320 440 T 260 370 Q 200 310 160 250 T 180 160 Q 200 90 280 60 Z"
            fill="#EDF2F7"
            stroke="#CBD5E1"
            strokeWidth="1.5"
            strokeDasharray="6 3"
          />

          {/* Connectors between key commercial shipping corridors */}
          <line x1="495" y1="360" x2="520" y2="350" stroke="#CBD5E1" strokeWidth="1" strokeDasharray="3 3" />
          <line x1="495" y1="360" x2="510" y2="310" stroke="#CBD5E1" strokeWidth="1" strokeDasharray="3 3" />
          <line x1="495" y1="360" x2="440" y2="390" stroke="#CBD5E1" strokeWidth="1" strokeDasharray="3 3" />

          {/* Regional Centroid Hotspots */}
          {filteredHotspots.map((h) => {
            const isSelected = selectedState?.toUpperCase() === h.state.toUpperCase();
            const colors = getTierColor(h.riskTier);
            const radius = Math.max(14, Math.min(28, (h.hotspotScore / 100) * 28));

            return (
              <g
                key={h.areaId}
                transform={`translate(${h.x}, ${h.y})`}
                className="cursor-pointer group"
                onClick={() => onSelectArea?.(isSelected ? null : h)}
                onMouseEnter={() => setHoveredArea(h)}
                onMouseLeave={() => setHoveredArea(null)}
              >
                {/* Heat Halo */}
                <circle
                  r={radius + (h.riskTier === "CRITICAL HOTSPOT" ? 14 : 8)}
                  fill={colors.halo}
                  className={h.riskTier === "CRITICAL HOTSPOT" ? "animate-ping opacity-60" : ""}
                />

                {/* Selection border */}
                {isSelected && (
                  <circle
                    r={radius + 6}
                    fill="none"
                    stroke="#0B1F3A"
                    strokeWidth={2.5}
                    strokeDasharray="4 2"
                  />
                )}

                {/* Main Hotspot Node */}
                <circle
                  r={radius}
                  fill={colors.fill}
                  stroke={colors.stroke}
                  strokeWidth={2}
                  className="transition-transform group-hover:scale-115 drop-shadow-sm"
                />

                {/* State Label */}
                <text
                  textAnchor="middle"
                  dy="4"
                  fill="#FFFFFF"
                  fontSize="10"
                  fontWeight="800"
                  fontFamily="system-ui, sans-serif"
                >
                  {h.state}
                </text>

                {/* Area Name Tag */}
                <text
                  textAnchor="middle"
                  dy={radius + 14}
                  fill="#334155"
                  fontSize="10"
                  fontWeight="600"
                  fontFamily="system-ui, sans-serif"
                >
                  {h.name}
                </text>
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
}
