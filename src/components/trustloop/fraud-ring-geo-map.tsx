import { useEffect, useRef, useState, useMemo } from "react";
import type { FraudRingSummary } from "@/lib/trustloop/network";
import {
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Satellite,
  Map as MapIcon,
  Layers,
  MapPin,
  ShieldAlert,
  ArrowRight,
  Smartphone,
  CreditCard,
  Building,
  AlertTriangle,
} from "lucide-react";

interface FraudRingGeoMapProps {
  ring: FraudRingSummary;
  allRings?: FraudRingSummary[];
  onSelectRing?: (ringId: string) => void;
  height?: number;
}

interface GeoFraudNode {
  id: string;
  city: string;
  state: string;
  lat: number;
  lng: number;
  role: "PRIMARY_HUB" | "DEVICE_FARM" | "PAYMENT_PIVOT" | "DROP_ADDRESS" | "TRANSIT_RELAY";
  label: string;
  detail: string;
  exposure: number;
  isFlagged: boolean;
  accounts: number;
}

interface GeoFraudVector {
  from: [number, number];
  to: [number, number];
  label: string;
  type: string;
}

// Geographic data for syndicates across India
const RING_GEO_PROFILES: Record<
  string,
  {
    center: [number, number];
    zoom: number;
    nodes: GeoFraudNode[];
    vectors: GeoFraudVector[];
  }
> = {
  "TL-RING-001": {
    center: [19.2, 73.2],
    zoom: 8,
    nodes: [
      {
        id: "mumbai-hub",
        city: "Mumbai",
        state: "MH",
        lat: 19.076,
        lng: 72.8777,
        role: "PRIMARY_HUB",
        label: "Syndicate Primary Hub",
        detail: "Central hardware return & ₹3.84L refund pool liquidation point",
        exposure: 384000,
        isFlagged: true,
        accounts: 5,
      },
      {
        id: "thane-dev",
        city: "Thane",
        state: "MH",
        lat: 19.2183,
        lng: 72.9781,
        role: "DEVICE_FARM",
        label: "Device Farm Nexus",
        detail: "Shared device fingerprint (c822..44) operating 4 duplicate accounts",
        exposure: 160000,
        isFlagged: true,
        accounts: 4,
      },
      {
        id: "pune-addr",
        city: "Pune",
        state: "MH",
        lat: 18.5204,
        lng: 73.8567,
        role: "DROP_ADDRESS",
        label: "Coordinated Drop Address",
        detail: "High-velocity residential drop with 18 return pickups",
        exposure: 120000,
        isFlagged: true,
        accounts: 3,
      },
      {
        id: "surat-relay",
        city: "Surat",
        state: "GJ",
        lat: 21.1702,
        lng: 72.8311,
        role: "TRANSIT_RELAY",
        label: "Cross-State Forwarding Relay",
        detail: "Inter-state courier forwarding point to evade single-hub flags",
        exposure: 104000,
        isFlagged: false,
        accounts: 2,
      },
    ],
    vectors: [
      { from: [19.076, 72.8777], to: [19.2183, 72.9781], label: "Device Sync Relay", type: "SYNC" },
      { from: [19.076, 72.8777], to: [18.5204, 73.8567], label: "Drop Parcel Dispatch", type: "DISPATCH" },
      { from: [19.076, 72.8777], to: [21.1702, 72.8311], label: "Cross-State Freight", type: "COURIER" },
    ],
  },
  "TL-RING-002": {
    center: [14.5, 77.6],
    zoom: 7,
    nodes: [
      {
        id: "blr-hub",
        city: "Bengaluru",
        state: "KA",
        lat: 12.9716,
        lng: 77.5946,
        role: "PRIMARY_HUB",
        label: "UPI Payment Pivot Hub",
        detail: "Shared UPI VPA tokens (pay..90@okhdfc) executing rapid bursts",
        exposure: 245000,
        isFlagged: true,
        accounts: 5,
      },
      {
        id: "mys-drop",
        city: "Mysuru",
        state: "KA",
        lat: 12.2958,
        lng: 76.6394,
        role: "DROP_ADDRESS",
        label: "Regional Delivery Node",
        detail: "Secondary destination for rapid wardrobing cycle returns",
        exposure: 68000,
        isFlagged: false,
        accounts: 2,
      },
      {
        id: "hyd-nexus",
        city: "Hyderabad",
        state: "TS",
        lat: 17.385,
        lng: 78.4867,
        role: "DEVICE_FARM",
        label: "Remote Device Endpoint",
        detail: "Coordinated app emulation cluster placing automated returns",
        exposure: 98000,
        isFlagged: true,
        accounts: 3,
      },
      {
        id: "chn-relay",
        city: "Chennai",
        state: "TN",
        lat: 13.0827,
        lng: 80.2707,
        role: "TRANSIT_RELAY",
        label: "Wearables Liquidation Point",
        detail: "Unopened box returns rerouted to regional grey markets",
        exposure: 79000,
        isFlagged: true,
        accounts: 2,
      },
    ],
    vectors: [
      { from: [12.9716, 77.5946], to: [12.2958, 76.6394], label: "Same-Day Delivery", type: "LOCAL" },
      { from: [12.9716, 77.5946], to: [17.385, 78.4867], label: "UPI Clearing Loop", type: "PAYMENT" },
      { from: [12.9716, 77.5946], to: [13.0827, 80.2707], label: "Return Hub Corridor", type: "COURIER" },
    ],
  },
  "TL-RING-003": {
    center: [28.5, 77.1],
    zoom: 9,
    nodes: [
      {
        id: "delhi-hub",
        city: "New Delhi",
        state: "DL",
        lat: 28.6139,
        lng: 77.209,
        role: "PRIMARY_HUB",
        label: "Connaught Place Hub",
        detail: "Shared commercial suite address aggregating 9 audio return parcels",
        exposure: 185000,
        isFlagged: true,
        accounts: 4,
      },
      {
        id: "noida-drop",
        city: "Noida",
        state: "UP",
        lat: 28.5355,
        lng: 77.391,
        role: "DROP_ADDRESS",
        label: "NCR Drop Suite",
        detail: "Secondary destination used to bypass account limit rules",
        exposure: 62000,
        isFlagged: true,
        accounts: 3,
      },
      {
        id: "ggn-relay",
        city: "Gurugram",
        state: "HR",
        lat: 28.4595,
        lng: 77.0266,
        role: "DEVICE_FARM",
        label: "Proxy IP Gateway",
        detail: "Residential proxy network masking client connection IPs",
        exposure: 74000,
        isFlagged: true,
        accounts: 4,
      },
      {
        id: "jpr-transit",
        city: "Jaipur",
        state: "RJ",
        lat: 26.9124,
        lng: 75.7873,
        role: "TRANSIT_RELAY",
        label: "Regional Return Depot",
        detail: "Consolidated reverse logistics pickup corridor",
        exposure: 49000,
        isFlagged: false,
        accounts: 2,
      },
    ],
    vectors: [
      { from: [28.6139, 77.209], to: [28.5355, 77.391], label: "Cross-Border NCR Transit", type: "LOCAL" },
      { from: [28.6139, 77.209], to: [28.4595, 77.0266], label: "Proxy Tunneling", type: "IP" },
      { from: [28.6139, 77.209], to: [26.9124, 75.7873], label: "Reverse Depot Link", type: "COURIER" },
    ],
  },
};

type TileType = "google-streets" | "google-hybrid" | "google-terrain";

export function FraudRingGeoMap({
  ring,
  allRings = [],
  onSelectRing,
  height = 540,
}: FraudRingGeoMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMapRef = useRef<any>(null);
  const tileLayerRef = useRef<any>(null);
  const layerGroupRef = useRef<any>(null);
  const [activeTile, setActiveTile] = useState<TileType>("google-streets");
  const [selectedGeoNode, setSelectedGeoNode] = useState<GeoFraudNode | null>(null);
  const [mapReady, setMapReady] = useState(false);

  // Active ring geographic profile
  const profile = useMemo(() => {
    return (
      RING_GEO_PROFILES[ring.id] || {
        center: [21.5, 78.5] as [number, number],
        zoom: 5,
        nodes: [
          {
            id: `${ring.id}-primary`,
            city: ring.locationArea,
            state: "IN",
            lat: 21.0,
            lng: 78.0,
            role: "PRIMARY_HUB" as const,
            label: `${ring.name} Hub`,
            detail: `Targeting ${ring.primaryCategory}`,
            exposure: ring.refundExposure,
            isFlagged: true,
            accounts: ring.accountCount,
          },
        ],
        vectors: [],
      }
    );
  }, [ring]);

  // Boot Leaflet with Google Maps tile layer
  useEffect(() => {
    if (!mapRef.current || leafletMapRef.current) return;

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
        center: profile.center,
        zoom: profile.zoom,
        zoomControl: false,
        attributionControl: true,
      });

      const tileLayer = L.tileLayer("https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}", {
        subdomains: ["mt0", "mt1", "mt2", "mt3"],
        maxZoom: 20,
        attribution: "&copy; Google Maps",
      }).addTo(map);

      const layerGroup = L.layerGroup().addTo(map);

      tileLayerRef.current = tileLayer;
      layerGroupRef.current = layerGroup;
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

  // Update map center and draw nodes when ring changes
  useEffect(() => {
    if (!mapReady || !leafletMapRef.current || !layerGroupRef.current) return;

    import("leaflet").then((L) => {
      const map = leafletMapRef.current;
      const layerGroup = layerGroupRef.current;
      if (!map || !layerGroup) return;

      layerGroup.clearLayers();
      map.flyTo(profile.center, profile.zoom, { duration: 1.2 });

      // 1. Draw Inter-City Fraud Vectors / Arcs
      profile.vectors.forEach((vec) => {
        // Outer glow path
        const glowLine = L.polyline([vec.from, vec.to], {
          color: "#EF4444",
          weight: 4,
          opacity: 0.25,
          lineCap: "round",
        }).addTo(layerGroup);

        // Active dashed pulse corridor
        const vectorLine = L.polyline([vec.from, vec.to], {
          color: "#DC2626",
          weight: 2,
          opacity: 0.85,
          dashArray: "6 6",
        })
          .addTo(layerGroup)
          .bindTooltip(
            `<div style="font-family:system-ui;font-size:11px;font-weight:700;color:#0F172A;">
              ⚡ ${vec.label} (${vec.type})
            </div>`,
            { sticky: true, opacity: 0.95, className: "custom-google-tooltip" }
          );
      });

      // 2. Draw Circular Red Fraud Zones around each city
      profile.nodes.forEach((node) => {
        const isPrimary = node.role === "PRIMARY_HUB";
        const radius = isPrimary ? 32000 : 20000;

        // Concentric outer hazard perimeter
        L.circle([node.lat, node.lng], {
          radius: radius * 1.5,
          stroke: true,
          color: "#DC2626",
          weight: 1,
          opacity: 0.4,
          fillColor: "#EF4444",
          fillOpacity: 0.12,
          dashArray: "6 4",
          interactive: false,
        }).addTo(layerGroup);

        // Core high-risk circular zone
        L.circle([node.lat, node.lng], {
          radius: radius,
          stroke: true,
          color: "#DC2626",
          weight: isPrimary ? 3 : 2,
          opacity: 0.85,
          fillColor: "#EF4444",
          fillOpacity: isPrimary ? 0.35 : 0.22,
          interactive: true,
        })
          .addTo(layerGroup)
          .on("click", () => setSelectedGeoNode(node))
          .bindTooltip(
            `<div style="font-family:system-ui;padding:2px 4px;">
              <div style="font-size:12px;font-weight:bold;color:#0F172A;">${node.city} (${node.state})</div>
              <div style="font-size:11px;color:#DC2626;font-weight:700;">${node.label}</div>
              <div style="font-size:11px;color:#475569;margin-top:2px;">₹${node.exposure.toLocaleString()} Exposure · ${node.accounts} Accounts</div>
            </div>`,
            { sticky: true, opacity: 0.98, className: "custom-google-tooltip" }
          );

        // Marker pin HTML
        const roleIcon =
          node.role === "PRIMARY_HUB"
            ? "🚨"
            : node.role === "DEVICE_FARM"
            ? "📱"
            : node.role === "PAYMENT_PIVOT"
            ? "💳"
            : "📍";

        const pinHtml = `
          <div style="position:relative;display:flex;flex-direction:column;align-items:center;cursor:pointer;">
            ${isPrimary ? '<div class="radar-pulse"></div>' : ""}
            <div style="
              background:${isPrimary ? "#DC2626" : "#4F46E5"};
              border:2.5px solid white;
              border-radius:50%;
              width:${isPrimary ? 26 : 22}px;
              height:${isPrimary ? 26 : 22}px;
              display:flex;align-items:center;justify-content:center;
              font-size:11px;
              box-shadow:0 2px 8px rgba(0,0,0,0.35);
              z-index:2;
            ">
              ${roleIcon}
            </div>
            <div style="
              margin-top:2px;
              background:rgba(255,255,255,0.96);
              border:1px solid rgba(0,0,0,0.15);
              border-radius:4px;
              padding:1px 6px;
              font-family:system-ui,-apple-system,sans-serif;
              font-size:10px;
              font-weight:800;
              color:#0F172A;
              white-space:nowrap;
              box-shadow:0 1px 4px rgba(0,0,0,0.15);
              z-index:2;
            ">
              ${node.city}
            </div>
          </div>
        `;

        const icon = L.divIcon({
          html: pinHtml,
          className: "",
          iconSize: [80, 50],
          iconAnchor: [40, 13],
        });

        L.marker([node.lat, node.lng], { icon })
          .addTo(layerGroup)
          .on("click", () => setSelectedGeoNode(node));
      });
    });
  }, [mapReady, profile, ring.id]);

  // Switch map tile dynamically
  const switchTile = (type: TileType) => {
    if (!leafletMapRef.current) return;
    import("leaflet").then((L) => {
      const map = leafletMapRef.current;
      if (tileLayerRef.current) map.removeLayer(tileLayerRef.current);

      const url =
        type === "google-hybrid"
          ? "https://{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}"
          : type === "google-terrain"
          ? "https://{s}.google.com/vt/lyrs=p&x={x}&y={y}&z={z}"
          : "https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}";

      const newLayer = L.tileLayer(url, {
        subdomains: ["mt0", "mt1", "mt2", "mt3"],
        maxZoom: 20,
        attribution: "&copy; Google Maps",
      }).addTo(map);

      tileLayerRef.current = newLayer;
      setActiveTile(type);
    });
  };

  return (
    <div
      className="relative rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden select-none"
      style={{ height }}
    >
      {/* Top Left Toolbar */}
      <div className="absolute top-3 left-3 z-[1000] flex items-center gap-1.5 bg-white/95 backdrop-blur-md p-1.5 rounded-xl border border-slate-200 shadow-md">
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
          onClick={() =>
            leafletMapRef.current?.flyTo(profile.center, profile.zoom, { duration: 1.0 })
          }
          className="p-1.5 rounded-lg text-slate-700 hover:text-slate-900 hover:bg-slate-100 transition-colors"
          title="Reset to Syndicate Hub"
        >
          <RotateCcw className="w-4 h-4" />
        </button>

        <div className="h-4 w-px bg-slate-200 mx-1" />

        <div className="flex items-center gap-1.5 px-2 py-0.5 text-xs font-bold text-slate-800">
          <span className="w-2 h-2 rounded-full bg-red-600 animate-ping" />
          <span>{ring.name.split("—")[0]}</span>
          <span className="text-[10px] text-slate-500 font-mono">({profile.nodes.length} hubs)</span>
        </div>
      </div>

      {/* Top Right: Google Map Switcher */}
      <div className="absolute top-3 right-3 z-[1000] flex items-center gap-1 bg-white/95 backdrop-blur-md p-1 rounded-xl border border-slate-200 shadow-md">
        <button
          onClick={() => switchTile("google-streets")}
          className={`flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-colors ${
            activeTile === "google-streets"
              ? "bg-slate-900 text-white shadow-xs"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
          }`}
        >
          <MapIcon className="w-3.5 h-3.5" />
          <span>Google Map</span>
        </button>
        <button
          onClick={() => switchTile("google-hybrid")}
          className={`flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-colors ${
            activeTile === "google-hybrid"
              ? "bg-slate-900 text-white shadow-xs"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
          }`}
        >
          <Satellite className="w-3.5 h-3.5" />
          <span>Satellite</span>
        </button>
      </div>

      {/* Detail Overlay Card (when a city node is clicked) */}
      {selectedGeoNode && (
        <div
          className="absolute z-[1000] bg-slate-900/95 text-white p-3.5 rounded-xl shadow-2xl text-xs max-w-xs border border-slate-700/80 backdrop-blur-md transition-all"
          style={{ top: 58, right: 14 }}
        >
          <div className="flex items-center justify-between gap-2 border-b border-slate-700/80 pb-2 mb-2">
            <span className="font-bold text-sm text-slate-100 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-[#38BDF8]" />
              {selectedGeoNode.city}, {selectedGeoNode.state}
            </span>
            <button
              onClick={() => setSelectedGeoNode(null)}
              className="text-slate-400 hover:text-white text-xs px-1"
            >
              ✕
            </button>
          </div>

          <div className="space-y-1.5 text-[11px]">
            <p className="font-semibold text-red-400">{selectedGeoNode.label}</p>
            <p className="text-slate-300 leading-relaxed text-[11px]">{selectedGeoNode.detail}</p>
            <div className="pt-2 border-t border-slate-800 grid grid-cols-2 gap-2 text-[10px]">
              <div>
                <span className="text-slate-400 uppercase">Exposure:</span>
                <p className="font-mono font-bold text-amber-300">
                  ₹{selectedGeoNode.exposure.toLocaleString()}
                </p>
              </div>
              <div>
                <span className="text-slate-400 uppercase">Accounts:</span>
                <p className="font-mono font-bold text-slate-100">
                  {selectedGeoNode.accounts} coordinated
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Floating Legend */}
      <div className="absolute bottom-3 left-3 z-[1000] hidden sm:flex items-center gap-3 bg-white/95 backdrop-blur-md px-3.5 py-2 rounded-xl border border-slate-200 text-[11px] text-slate-700 shadow-md">
        <span className="font-bold text-slate-900 flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-red-600 animate-ping" />
          Syndicate Operations:
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-[#EF4444]" />
          Red Circular Fraud Zone
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-4 h-0.5 border-t-2 border-dashed border-[#DC2626]" />
          Inter-City Abuse Corridor
        </span>
      </div>

      {/* Map DOM Element */}
      <div ref={mapRef} style={{ width: "100%", height: "100%" }} />

      <style>{`
        .radar-pulse {
          position: absolute;
          top: 0;
          left: 50%;
          transform: translateX(-50%);
          width: 26px;
          height: 26px;
          border-radius: 50%;
          background: rgba(239, 68, 68, 0.45);
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
