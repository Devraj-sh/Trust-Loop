import { useEffect, useRef, useState, useMemo } from "react";
import type { AreaHotspotMetric } from "@/lib/trustloop/geo";
import { ZoomIn, ZoomOut, RotateCcw, Layers, MapPin, Eye, Satellite, Map as MapIcon } from "lucide-react";

interface HotspotMapProps {
  hotspots: AreaHotspotMetric[];
  selectedState?: string | null;
  onSelectArea?: (area: AreaHotspotMetric | null) => void;
  height?: number;
}

type TileType = "google-streets" | "google-hybrid" | "google-terrain" | "osm";

const TILE_PROVIDERS: Record<
  TileType,
  { name: string; url: string; subdomains: string[]; maxZoom: number; attribution: string }
> = {
  "google-streets": {
    name: "Google Streets",
    url: "https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}",
    subdomains: ["mt0", "mt1", "mt2", "mt3"],
    maxZoom: 20,
    attribution: "&copy; Google Maps",
  },
  "google-hybrid": {
    name: "Google Satellite",
    url: "https://{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}",
    subdomains: ["mt0", "mt1", "mt2", "mt3"],
    maxZoom: 20,
    attribution: "&copy; Google Maps",
  },
  "google-terrain": {
    name: "Google Terrain",
    url: "https://{s}.google.com/vt/lyrs=p&x={x}&y={y}&z={z}",
    subdomains: ["mt0", "mt1", "mt2", "mt3"],
    maxZoom: 20,
    attribution: "&copy; Google Maps",
  },
  osm: {
    name: "OpenStreetMap",
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    subdomains: ["a", "b", "c"],
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap contributors",
  },
};

export function HotspotMap({
  hotspots,
  selectedState,
  onSelectArea,
  height = 560,
}: HotspotMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMapRef = useRef<any>(null);
  const tileLayerRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const circlesRef = useRef<any[]>([]);
  const [activeTile, setActiveTile] = useState<TileType>("google-streets");
  const [tierFilter, setTierFilter] = useState<string>("ALL");
  const [hoveredArea, setHoveredArea] = useState<AreaHotspotMetric | null>(null);
  const [mapReady, setMapReady] = useState(false);

  const filteredHotspots = useMemo(() => {
    if (tierFilter === "ALL") return hotspots;
    return hotspots.filter((h) => h.riskTier === tierFilter);
  }, [hotspots, tierFilter]);

  // Tier visual styles — focused on realistic circular red fraud zones
  const getTierVisuals = (tier: AreaHotspotMetric["riskTier"]) => {
    switch (tier) {
      case "CRITICAL HOTSPOT":
        return {
          strokeColor: "#DC2626",
          fillColor: "#EF4444",
          outerColor: "rgba(239, 68, 68, 0.12)",
          midColor: "rgba(220, 38, 38, 0.32)",
          coreColor: "rgba(185, 28, 28, 0.65)",
          weight: 2.5,
          radius: 72000,
          dashArray: "6 4",
          dotColor: "#DC2626",
          glow: true,
        };
      case "HIGH RISK":
        return {
          strokeColor: "#EA580C",
          fillColor: "#F97316",
          outerColor: "rgba(249, 115, 22, 0.10)",
          midColor: "rgba(234, 88, 12, 0.25)",
          coreColor: "rgba(194, 65, 12, 0.50)",
          weight: 2,
          radius: 56000,
          dashArray: "4 3",
          dotColor: "#EA580C",
          glow: false,
        };
      case "MEDIUM RISK":
        return {
          strokeColor: "#D97706",
          fillColor: "#F59E0B",
          outerColor: "rgba(245, 158, 11, 0.08)",
          midColor: "rgba(217, 119, 6, 0.20)",
          coreColor: "rgba(180, 83, 9, 0.40)",
          weight: 1.5,
          radius: 44000,
          dashArray: undefined,
          dotColor: "#D97706",
          glow: false,
        };
      case "LOW RISK":
      default:
        return {
          strokeColor: "#059669",
          fillColor: "#10B981",
          outerColor: "rgba(16, 185, 129, 0.06)",
          midColor: "rgba(5, 150, 105, 0.16)",
          coreColor: "rgba(4, 120, 87, 0.35)",
          weight: 1.2,
          radius: 36000,
          dashArray: undefined,
          dotColor: "#059669",
          glow: false,
        };
    }
  };

  // Boot Leaflet client-side with Google Maps
  useEffect(() => {
    if (!mapRef.current || leafletMapRef.current) return;

    // Inject Leaflet CSS if not already present
    if (!document.getElementById("leaflet-css")) {
      const link = document.createElement("link");
      link.id = "leaflet-css";
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
    }

    import("leaflet").then((L) => {
      if (!mapRef.current || leafletMapRef.current) return;

      const map = L.map(mapRef.current, {
        center: [21.5, 79.8],
        zoom: 5,
        zoomControl: false,
        attributionControl: true,
      });

      const provider = TILE_PROVIDERS["google-streets"];
      const tileLayer = L.tileLayer(provider.url, {
        attribution: provider.attribution,
        subdomains: provider.subdomains,
        maxZoom: provider.maxZoom,
      }).addTo(map);

      tileLayerRef.current = tileLayer;
      leafletMapRef.current = map;
      setMapReady(true);
    });

    return () => {
      if (leafletMapRef.current) {
        leafletMapRef.current.remove();
        leafletMapRef.current = null;
      }
    };
  }, []);

  // Handle tile switch dynamically without destroying map
  const switchTileLayer = (tileKey: TileType) => {
    if (!leafletMapRef.current) return;
    import("leaflet").then((L) => {
      const map = leafletMapRef.current;
      if (tileLayerRef.current) {
        map.removeLayer(tileLayerRef.current);
      }
      const provider = TILE_PROVIDERS[tileKey];
      const newLayer = L.tileLayer(provider.url, {
        attribution: provider.attribution,
        subdomains: provider.subdomains,
        maxZoom: provider.maxZoom,
      }).addTo(map);
      tileLayerRef.current = newLayer;
      setActiveTile(tileKey);
    });
  };

  // Render circular red fraud zones and pin markers
  useEffect(() => {
    if (!mapReady || !leafletMapRef.current) return;

    import("leaflet").then((L) => {
      const map = leafletMapRef.current;
      if (!map) return;

      // Clean existing layers
      markersRef.current.forEach((m) => m.remove());
      circlesRef.current.forEach((c) => c.remove());
      markersRef.current = [];
      circlesRef.current = [];

      filteredHotspots.forEach((hotspot) => {
        const v = getTierVisuals(hotspot.riskTier);
        const isSelected = selectedState === hotspot.state;

        // 1. Concentric Outer Hazard Perimeter (Translucent Red Gradient Zone)
        const outerPerimeter = L.circle([hotspot.lat, hotspot.lng], {
          radius: v.radius * 1.6,
          stroke: true,
          color: v.strokeColor,
          weight: 1,
          opacity: 0.35,
          fillColor: v.fillColor,
          fillOpacity: 0.09,
          dashArray: v.glow ? "8 6" : undefined,
          interactive: false,
        }).addTo(map);

        // 2. High-Density Fraud / Return Middle Zone
        const middleZone = L.circle([hotspot.lat, hotspot.lng], {
          radius: v.radius,
          stroke: true,
          color: v.strokeColor,
          weight: isSelected ? 3.5 : v.weight,
          opacity: 0.85,
          fillColor: v.fillColor,
          fillOpacity: isSelected ? 0.40 : 0.24,
          dashArray: v.dashArray,
          interactive: true,
        })
          .addTo(map)
          .on("click", () => {
            onSelectArea?.(hotspot);
            setHoveredArea(hotspot);
          })
          .on("mouseover", () => setHoveredArea(hotspot))
          .on("mouseout", () => setHoveredArea(null))
          .bindTooltip(
            `<div style="font-family:system-ui,-apple-system,sans-serif;padding:2px 4px;">
              <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;">
                <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${v.dotColor};"></span>
                <strong style="font-size:13px;color:#0F172A;">${hotspot.name} (${hotspot.state})</strong>
              </div>
              <div style="font-size:11px;color:#475569;line-height:1.4;">
                <div>Return Rate: <strong style="color:#0F172A;">${(hotspot.returnRate * 100).toFixed(1)}%</strong></div>
                <div>Fraud/High-Risk: <strong style="color:#DC2626;">${(hotspot.highRiskRate * 100).toFixed(1)}%</strong></div>
                <div>Refund Pool: <strong style="color:#0F172A;">₹${hotspot.refundExposure.toLocaleString()}</strong></div>
              </div>
              <div style="margin-top:4px;padding-top:4px;border-top:1px solid #E2E8F0;font-size:10px;font-weight:700;color:${v.dotColor};">
                ${hotspot.riskTier}
              </div>
            </div>`,
            { sticky: true, opacity: 0.98, className: "custom-google-tooltip" }
          );

        // 3. Dense Red Danger Core (for critical high-risk zones)
        let coreCircle: any = null;
        if (hotspot.riskTier === "CRITICAL HOTSPOT") {
          coreCircle = L.circle([hotspot.lat, hotspot.lng], {
            radius: v.radius * 0.45,
            stroke: false,
            fillColor: "#B91C1C",
            fillOpacity: 0.45,
            interactive: false,
          }).addTo(map);
        }

        // 4. Custom Realistic Google Map Pin Marker with State Badge & Return Stat
        const isCritical = hotspot.riskTier === "CRITICAL HOTSPOT";
        const pinHtml = `
          <div class="google-hotspot-pin ${isCritical ? "is-critical" : ""}" style="position:relative;display:flex;flex-direction:column;align-items:center;cursor:pointer;">
            ${isCritical ? '<div class="radar-pulse"></div>' : ""}
            <div style="
              background:${v.dotColor};
              border:2.5px solid white;
              border-radius:50%;
              width:${isCritical ? 24 : 18}px;
              height:${isCritical ? 24 : 18}px;
              display:flex;align-items:center;justify-content:center;
              font-family:system-ui,-apple-system,sans-serif;
              font-size:${isCritical ? 9 : 8}px;
              font-weight:900;
              color:white;
              box-shadow:0 2px 8px rgba(0,0,0,0.35), 0 0 0 2px ${v.strokeColor}44;
              z-index:2;
            ">
              ${hotspot.state}
            </div>
            <div style="
              margin-top:2px;
              background:rgba(255,255,255,0.96);
              border:1px solid rgba(0,0,0,0.15);
              border-radius:4px;
              padding:1px 6px;
              font-family:system-ui,-apple-system,sans-serif;
              font-size:10px;
              font-weight:700;
              color:#0F172A;
              white-space:nowrap;
              box-shadow:0 1px 4px rgba(0,0,0,0.18);
              display:flex;align-items:center;gap:3px;
              z-index:2;
            ">
              <span>${hotspot.name}</span>
              <span style="color:${v.dotColor};font-weight:800;">${(hotspot.returnRate * 100).toFixed(0)}%</span>
            </div>
          </div>
        `;

        const icon = L.divIcon({
          html: pinHtml,
          className: "",
          iconSize: [80, 48],
          iconAnchor: [40, isCritical ? 12 : 9],
        });

        const marker = L.marker([hotspot.lat, hotspot.lng], { icon })
          .addTo(map)
          .on("click", () => {
            onSelectArea?.(hotspot);
            setHoveredArea(hotspot);
          });

        circlesRef.current.push(outerPerimeter, middleZone);
        if (coreCircle) circlesRef.current.push(coreCircle);
        markersRef.current.push(marker);
      });
    });
  }, [mapReady, filteredHotspots, selectedState]);

  return (
    <div
      className="relative rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden select-none"
      style={{ height }}
    >
      {/* Top Left: Controls & Filters Toolbar */}
      <div className="absolute top-3 left-3 z-[1000] flex flex-wrap items-center gap-1.5 bg-white/95 backdrop-blur-md p-1.5 rounded-xl border border-slate-200 shadow-md">
        <button
          onClick={() => leafletMapRef.current?.zoomIn()}
          className="p-1.5 rounded-lg text-slate-700 hover:text-slate-900 hover:bg-slate-100 transition-colors"
          title="Zoom In"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          onClick={() => leafletMapRef.current?.zoomOut()}
          className="p-1.5 rounded-lg text-slate-700 hover:text-slate-900 hover:bg-slate-100 transition-colors"
          title="Zoom Out"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <button
          onClick={() => leafletMapRef.current?.setView([21.5, 79.8], 5)}
          className="p-1.5 rounded-lg text-slate-700 hover:text-slate-900 hover:bg-slate-100 transition-colors"
          title="Reset to All India"
        >
          <RotateCcw className="w-4 h-4" />
        </button>

        <div className="h-4 w-px bg-slate-200 mx-1" />

        {/* Tier Filters */}
        {(
          [
            { id: "ALL", label: "All Areas" },
            { id: "CRITICAL HOTSPOT", label: "🔴 Critical Fraud" },
            { id: "HIGH RISK", label: "🟠 High Return" },
            { id: "MEDIUM RISK", label: "🟡 Medium" },
            { id: "LOW RISK", label: "🟢 Low" },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            onClick={() => setTierFilter(t.id)}
            className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-colors ${
              tierFilter === t.id
                ? "bg-[#1769E0] text-white shadow-xs"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Top Right: Google Map Layer Switcher */}
      <div className="absolute top-3 right-3 z-[1000] flex items-center gap-1 bg-white/95 backdrop-blur-md p-1 rounded-xl border border-slate-200 shadow-md">
        <button
          onClick={() => switchTileLayer("google-streets")}
          className={`flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-colors ${
            activeTile === "google-streets"
              ? "bg-slate-900 text-white shadow-xs"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
          }`}
          title="Google Standard Map"
        >
          <MapIcon className="w-3.5 h-3.5" />
          <span>Google Map</span>
        </button>
        <button
          onClick={() => switchTileLayer("google-hybrid")}
          className={`flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-colors ${
            activeTile === "google-hybrid"
              ? "bg-slate-900 text-white shadow-xs"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
          }`}
          title="Google Satellite / Hybrid"
        >
          <Satellite className="w-3.5 h-3.5" />
          <span>Satellite</span>
        </button>
        <button
          onClick={() => switchTileLayer("google-terrain")}
          className={`flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-colors ${
            activeTile === "google-terrain"
              ? "bg-slate-900 text-white shadow-xs"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
          }`}
          title="Google Terrain"
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Terrain</span>
        </button>
      </div>

      {/* Floating Inspector Panel (when area is hovered or clicked) */}
      {hoveredArea && (
        <div
          className="pointer-events-none absolute z-[1000] bg-slate-900/95 text-white p-3.5 rounded-xl shadow-2xl text-xs max-w-xs border border-slate-700/80 backdrop-blur-md transition-all"
          style={{ top: 58, right: 14 }}
        >
          <div className="flex items-center justify-between gap-2 border-b border-slate-700/80 pb-2 mb-2">
            <span className="font-bold text-sm text-slate-100 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-[#38BDF8]" />
              {hoveredArea.name} ({hoveredArea.state})
            </span>
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${
                hoveredArea.riskTier === "CRITICAL HOTSPOT"
                  ? "bg-red-500/25 text-red-400 border border-red-500/40"
                  : hoveredArea.riskTier === "HIGH RISK"
                  ? "bg-orange-500/25 text-orange-400 border border-orange-500/40"
                  : "bg-emerald-500/25 text-emerald-400"
              }`}
            >
              {hoveredArea.riskTier}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2.5 text-[11px]">
            <div>
              <p className="text-slate-400 text-[10px] uppercase font-semibold">Return Rate</p>
              <p className="font-mono font-bold text-slate-100 text-sm">
                {(hoveredArea.returnRate * 100).toFixed(1)}%
              </p>
            </div>
            <div>
              <p className="text-slate-400 text-[10px] uppercase font-semibold">Fraud / Abuse Rate</p>
              <p className="font-mono font-bold text-red-400 text-sm">
                {(hoveredArea.highRiskRate * 100).toFixed(1)}%
              </p>
            </div>
            <div>
              <p className="text-slate-400 text-[10px] uppercase font-semibold">Evidence Conflicts</p>
              <p className="font-semibold text-slate-200">{hoveredArea.evidenceConflicts} claims</p>
            </div>
            <div>
              <p className="text-slate-400 text-[10px] uppercase font-semibold">Refund Exposure</p>
              <p className="font-mono font-bold text-amber-300">
                ₹{hoveredArea.refundExposure.toLocaleString()}
              </p>
            </div>
          </div>

          <div className="mt-2.5 pt-2 border-t border-slate-800 flex items-center justify-between text-[10px] text-slate-400">
            <span>
              Hotspot Severity: <strong className="text-white">{hoveredArea.hotspotScore}/100</strong>
            </span>
            <span>
              Active Fraud Rings: <strong className="text-red-400">{hoveredArea.activeFraudRings}</strong>
            </span>
          </div>
        </div>
      )}

      {/* Bottom Floating Legend */}
      <div className="absolute bottom-3 left-3 z-[1000] hidden sm:flex items-center gap-3 bg-white/95 backdrop-blur-md px-3.5 py-2 rounded-xl border border-slate-200 text-[11px] text-slate-700 shadow-md">
        <span className="font-bold text-slate-900 flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-red-600 animate-ping" />
          Circular Fraud / Return Zones:
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-[#EF4444] border border-[#DC2626]" />
          Critical Fraud Zone
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-[#F97316] border border-[#EA580C]" />
          High Return Zone
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-[#F59E0B] border border-[#D97706]" />
          Medium
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-[#10B981] border border-[#059669]" />
          Low
        </span>
      </div>

      {/* Map DOM Element */}
      <div ref={mapRef} style={{ width: "100%", height: "100%" }} />

      {/* Radar pulse animation for critical circular fraud zones */}
      <style>{`
        .radar-pulse {
          position: absolute;
          top: 0;
          left: 50%;
          transform: translateX(-50%);
          width: 24px;
          height: 24px;
          border-radius: 50%;
          background: rgba(239, 68, 68, 0.4);
          animation: radar-wave 2s infinite ease-out;
          pointer-events: none;
        }
        @keyframes radar-wave {
          0% {
            transform: translateX(-50%) scale(1);
            opacity: 0.9;
          }
          100% {
            transform: translateX(-50%) scale(3.5);
            opacity: 0;
          }
        }
        .custom-google-tooltip {
          background: rgba(255, 255, 255, 0.98) !important;
          border: 1px solid rgba(0, 0, 0, 0.12) !important;
          border-radius: 10px !important;
          color: #0F172A !important;
          box-shadow: 0 8px 30px rgba(0, 0, 0, 0.16) !important;
          padding: 8px 12px !important;
        }
        .custom-google-tooltip::before {
          display: none !important;
        }
      `}</style>
    </div>
  );
}
