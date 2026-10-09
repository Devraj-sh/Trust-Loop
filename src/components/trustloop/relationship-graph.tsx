import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import type { GraphNode, GraphEdge, NodeType } from "@/lib/trustloop/network";
import { ZoomIn, ZoomOut, RotateCcw, Filter, Cpu } from "lucide-react";

interface RelationshipGraphProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  selectedNodeId?: string | null;
  onSelectNode?: (nodeId: string | null) => void;
  height?: number;
  interactive?: boolean;
}

const NODE_CONFIG: Record<
  NodeType,
  { fill: string; glow: string; label: string; icon: string }
> = {
  Customer:  { fill: "#2563EB", glow: "#3B82F6", label: "CUS", icon: "👤" },
  Account:   { fill: "#4F46E5", glow: "#818CF8", label: "ACC", icon: "🏦" },
  Device:    { fill: "#9333EA", glow: "#C084FC", label: "DEV", icon: "📱" },
  Address:   { fill: "#D97706", glow: "#FCD34D", label: "ADR", icon: "📍" },
  Phone:     { fill: "#0284C7", glow: "#38BDF8", label: "TEL", icon: "📞" },
  Email:     { fill: "#0891B2", glow: "#67E8F9", label: "EML", icon: "✉️" },
  Payment:   { fill: "#059669", glow: "#34D399", label: "PAY", icon: "💳" },
  Order:     { fill: "#475569", glow: "#94A3B8", label: "ORD", icon: "📦" },
  Product:   { fill: "#0D9488", glow: "#2DD4BF", label: "PRD", icon: "🛍️" },
  Return:    { fill: "#EA580C", glow: "#FB923C", label: "RET", icon: "🔄" },
  Refund:    { fill: "#DC2626", glow: "#F87171", label: "REF", icon: "💸" },
  Courier:   { fill: "#64748B", glow: "#94A3B8", label: "COU", icon: "🚚" },
  Hub:       { fill: "#7C3AED", glow: "#A78BFA", label: "HUB", icon: "🏭" },
};

interface LayoutNode extends GraphNode {
  x: number;
  y: number;
  vx?: number;
  vy?: number;
}

function buildLayout(nodes: GraphNode[], width: number, height: number): LayoutNode[] {
  const cx = width / 2;
  const cy = height / 2;
  const total = nodes.length;
  if (total === 0) return [];

  // Group by role
  const coreTypes: NodeType[] = ["Device", "Address", "Payment", "Phone", "Email"];
  const midTypes: NodeType[] = ["Account", "Customer"];
  const outerTypes: NodeType[] = ["Order", "Product", "Courier", "Hub"];
  const leafTypes: NodeType[] = ["Return", "Refund"];

  let coreIdx = 0, midIdx = 0, outerIdx = 0, leafIdx = 0;
  const corePop = nodes.filter((n) => coreTypes.includes(n.type)).length;
  const midPop = nodes.filter((n) => midTypes.includes(n.type)).length;
  const outerPop = nodes.filter((n) => outerTypes.includes(n.type)).length;
  const leafPop = nodes.filter((n) => leafTypes.includes(n.type)).length;

  const minDim = Math.min(width, height);
  const r = {
    core: minDim * 0.10,
    mid:  minDim * 0.22,
    outer: minDim * 0.35,
    leaf: minDim * 0.46,
  };

  return nodes.map((node) => {
    let radius = r.outer;
    let idx = 0;
    let pop = total;

    if (coreTypes.includes(node.type)) {
      radius = r.core; idx = coreIdx++; pop = corePop;
    } else if (midTypes.includes(node.type)) {
      radius = r.mid; idx = midIdx++; pop = midPop;
    } else if (outerTypes.includes(node.type)) {
      radius = r.outer; idx = outerIdx++; pop = outerPop;
    } else if (leafTypes.includes(node.type)) {
      radius = r.leaf; idx = leafIdx++; pop = leafPop;
    }

    const angle = pop > 1
      ? (idx / pop) * 2 * Math.PI - Math.PI / 2
      : 0;

    // Add slight jitter for realism
    const jitter = radius * 0.12;
    const jx = (Math.random() - 0.5) * jitter;
    const jy = (Math.random() - 0.5) * jitter;

    return {
      ...node,
      x: cx + radius * Math.cos(angle) + jx,
      y: cy + radius * Math.sin(angle) + jy,
    };
  });
}

export function RelationshipGraph({
  nodes,
  edges,
  selectedNodeId,
  onSelectNode,
  height = 520,
  interactive = true,
}: RelationshipGraphProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [activeFilter, setActiveFilter] = useState<string>("ALL");
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const width = 820;

  // Stable layout (recomputed only when nodes change)
  const layoutNodes = useMemo(
    () => buildLayout(nodes, width, height),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [nodes.map((n) => n.id).join(","), height]
  );

  const nodeMap = useMemo(() => {
    const m = new Map<string, LayoutNode>();
    layoutNodes.forEach((n) => m.set(n.id, n));
    return m;
  }, [layoutNodes]);

  const connectedIds = useMemo(() => {
    const set = new Set<string>();
    if (!selectedNodeId && !hoveredNodeId) return set;
    const pivot = selectedNodeId || hoveredNodeId;
    if (pivot) set.add(pivot);
    edges.forEach((e) => {
      if (e.source === pivot) set.add(e.target);
      if (e.target === pivot) set.add(e.source);
    });
    return set;
  }, [selectedNodeId, hoveredNodeId, edges]);

  const filteredNodes = useMemo(() => {
    if (activeFilter === "ALL") return layoutNodes;
    return layoutNodes.filter((n) => n.type === activeFilter || n.isFlagged);
  }, [layoutNodes, activeFilter]);

  const visibleNodeIds = useMemo(() => new Set(filteredNodes.map((n) => n.id)), [filteredNodes]);

  // Mouse handlers for pan
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!interactive || (e.target as Element).closest(".node-group")) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
  };
  const handleMouseUp = () => setIsDragging(false);

  // Unique filter ids
  const uniqueId = useMemo(() => Math.random().toString(36).slice(2), []);

  return (
    <div
      className="relative rounded-2xl overflow-hidden select-none border border-[#1E293B]"
      style={{ height, background: "linear-gradient(135deg, #060E1A 0%, #0B1628 50%, #0A1520 100%)" }}
    >
      {/* Top Toolbar — dark glass */}
      {interactive && (
        <div className="absolute top-3 left-3 z-10 flex flex-wrap items-center gap-1.5 bg-slate-900/90 backdrop-blur-sm p-1.5 rounded-xl border border-slate-700/80 shadow-xl">
          <button
            onClick={() => setZoom((z) => Math.min(2.5, z + 0.18))}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/80 transition-colors"
            title="Zoom In"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            onClick={() => setZoom((z) => Math.max(0.4, z - 0.18))}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/80 transition-colors"
            title="Zoom Out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/80 transition-colors"
            title="Reset View"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          <div className="h-4 w-px bg-slate-700 mx-1" />

          <Filter className="w-3.5 h-3.5 text-slate-500 ml-1" />
          {["ALL", "Account", "Device", "Address", "Return", "Refund"].map((f) => (
            <button
              key={f}
              onClick={() => setActiveFilter(f)}
              className={`px-2 py-0.5 text-[11px] font-semibold rounded-md transition-colors ${
                activeFilter === f
                  ? "bg-indigo-600 text-white"
                  : "text-slate-400 hover:text-white hover:bg-slate-700/80"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      )}

      {/* Stats Badge */}
      <div className="absolute top-3 right-3 z-10 bg-slate-900/90 backdrop-blur-sm border border-slate-700/80 rounded-xl px-3 py-1.5 text-[11px] text-slate-300 shadow-xl flex items-center gap-2">
        <Cpu className="w-3.5 h-3.5 text-indigo-400" />
        <span><strong className="text-white">{nodes.length}</strong> nodes</span>
        <span className="text-slate-600">·</span>
        <span><strong className="text-white">{edges.length}</strong> edges</span>
      </div>

      {/* SVG Canvas */}
      <svg
        ref={svgRef}
        width="100%"
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className={`w-full h-full ${interactive ? "cursor-grab active:cursor-grabbing" : ""}`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <defs>
          {/* Dot grid background */}
          <pattern id={`dot-grid-${uniqueId}`} width="24" height="24" patternUnits="userSpaceOnUse">
            <circle cx="1" cy="1" r="0.8" fill="#1E293B" />
          </pattern>

          {/* Node glow filters */}
          {(Object.keys(NODE_CONFIG) as NodeType[]).map((type) => (
            <filter key={type} id={`glow-${type}-${uniqueId}`} x="-60%" y="-60%" width="220%" height="220%">
              <feGaussianBlur stdDeviation="4" result="blur1" />
              <feGaussianBlur in="SourceGraphic" stdDeviation="8" result="blur2" />
              <feMerge>
                <feMergeNode in="blur2" />
                <feMergeNode in="blur1" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          ))}

          {/* Flagged node red glow */}
          <filter id={`glow-flag-${uniqueId}`} x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="6" result="blur" />
            <feColorMatrix in="blur" type="matrix"
              values="2 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1.5 0"
              result="redBlur"
            />
            <feMerge><feMergeNode in="redBlur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>

          {/* Edge glow */}
          <filter id={`edge-glow-${uniqueId}`}>
            <feGaussianBlur in="SourceGraphic" stdDeviation="2.5" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>

          {/* Arrow marker */}
          <marker id={`arrow-${uniqueId}`} markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
            <path d="M 0 0 L 6 3 L 0 6 Z" fill="#334155" />
          </marker>
          <marker id={`arrow-hl-${uniqueId}`} markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
            <path d="M 0 0 L 6 3 L 0 6 Z" fill="#6366F1" />
          </marker>
        </defs>

        {/* Background dot grid */}
        <rect width="100%" height="100%" fill={`url(#dot-grid-${uniqueId})`} />

        <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
          {/* Edges */}
          {edges.map((edge) => {
            const src = nodeMap.get(edge.source);
            const tgt = nodeMap.get(edge.target);
            if (!src || !tgt) return null;
            if (!visibleNodeIds.has(src.id) || !visibleNodeIds.has(tgt.id)) return null;

            const pivot = selectedNodeId || hoveredNodeId;
            const isHighlighted = pivot &&
              (edge.source === pivot || edge.target === pivot);
            const isDimmed = pivot && !isHighlighted;

            // Curved path
            const mx = (src.x + tgt.x) / 2 + (tgt.y - src.y) * 0.12;
            const my = (src.y + tgt.y) / 2 - (tgt.x - src.x) * 0.12;

            return (
              <path
                key={edge.id}
                d={`M ${src.x} ${src.y} Q ${mx} ${my} ${tgt.x} ${tgt.y}`}
                fill="none"
                stroke={isHighlighted ? "#6366F1" : "#1E3050"}
                strokeWidth={isHighlighted ? 2.2 : 1}
                strokeDasharray={
                  edge.type?.includes("DEVICE") || edge.type?.includes("PAYMENT")
                    ? "5 3"
                    : undefined
                }
                opacity={isDimmed ? 0.08 : isHighlighted ? 1 : 0.55}
                filter={isHighlighted ? `url(#edge-glow-${uniqueId})` : undefined}
                markerEnd={isHighlighted ? `url(#arrow-hl-${uniqueId})` : `url(#arrow-${uniqueId})`}
                className="transition-all duration-200"
              />
            );
          })}

          {/* Nodes */}
          {filteredNodes.map((node) => {
            const config = NODE_CONFIG[node.type] || NODE_CONFIG.Account;
            const isSelected = selectedNodeId === node.id;
            const isHovered = hoveredNodeId === node.id;
            const pivot = selectedNodeId || hoveredNodeId;
            const isConnected = connectedIds.has(node.id);
            const isDimmed = pivot && !isSelected && !isHovered && !isConnected;
            const r = isSelected || isHovered ? 20 : 16;

            return (
              <g
                key={node.id}
                transform={`translate(${node.x}, ${node.y})`}
                className="node-group cursor-pointer"
                onClick={() => onSelectNode?.(isSelected ? null : node.id)}
                onMouseEnter={() => setHoveredNodeId(node.id)}
                onMouseLeave={() => setHoveredNodeId(null)}
                style={{ opacity: isDimmed ? 0.15 : 1, transition: "opacity 0.2s" }}
              >
                {/* Outer glow ring for flagged */}
                {node.isFlagged && (
                  <>
                    <circle
                      r={r + 14}
                      fill="rgba(239,68,68,0.06)"
                      stroke="rgba(239,68,68,0.25)"
                      strokeWidth={1}
                      strokeDasharray="4 3"
                      className="animate-spin"
                      style={{ animationDuration: "12s" }}
                    />
                    <circle
                      r={r + 8}
                      fill="rgba(239,68,68,0.10)"
                      stroke="rgba(239,68,68,0.5)"
                      strokeWidth={1.5}
                      className="animate-pulse"
                    />
                  </>
                )}

                {/* Selection ring */}
                {isSelected && (
                  <circle
                    r={r + 10}
                    fill="none"
                    stroke="#6366F1"
                    strokeWidth={2}
                    strokeDasharray="5 3"
                    className="animate-spin"
                    style={{ animationDuration: "8s" }}
                  />
                )}

                {/* Hover halo */}
                {isHovered && !isSelected && (
                  <circle r={r + 8} fill={config.glow + "22"} />
                )}

                {/* Node glow backdrop */}
                <circle
                  r={r + 4}
                  fill={config.glow + "18"}
                  filter={`url(#glow-${node.type}-${uniqueId})`}
                />

                {/* Main filled circle */}
                <circle
                  r={r}
                  fill={node.isFlagged ? "#7F1D1D" : config.fill}
                  stroke={node.isFlagged ? "#EF4444" : config.glow}
                  strokeWidth={isSelected || isHovered ? 2.5 : 1.5}
                  filter={node.isFlagged ? `url(#glow-flag-${uniqueId})` : undefined}
                  style={{ transition: "r 0.15s" }}
                />

                {/* Icon label */}
                <text
                  textAnchor="middle"
                  dy="4"
                  fill="#FFFFFF"
                  fontSize={isSelected || isHovered ? 11 : 9}
                  fontWeight="800"
                  fontFamily="system-ui, sans-serif"
                  style={{ pointerEvents: "none" }}
                >
                  {config.label}
                </text>

                {/* Name tag */}
                <text
                  textAnchor="middle"
                  dy={r + 15}
                  fill={isSelected || isHovered ? "#FFFFFF" : "#94A3B8"}
                  fontSize={isSelected || isHovered ? 11 : 9.5}
                  fontWeight={isSelected || isHovered ? "700" : "500"}
                  fontFamily="system-ui, sans-serif"
                  style={{ pointerEvents: "none" }}
                >
                  {node.label.length > 14 ? node.label.slice(0, 13) + "…" : node.label}
                </text>

                {/* Flagged badge */}
                {node.isFlagged && (
                  <g transform={`translate(${r - 6}, ${-(r - 6)})`}>
                    <circle r={7} fill="#DC2626" stroke="#0B1628" strokeWidth={1.5} />
                    <text
                      textAnchor="middle"
                      dy="3.5"
                      fill="white"
                      fontSize="7"
                      fontWeight="900"
                      fontFamily="system-ui"
                    >
                      !
                    </text>
                  </g>
                )}
              </g>
            );
          })}
        </g>
      </svg>

      {/* Legend — dark glass */}
      <div className="absolute bottom-3 left-3 z-10 hidden sm:flex flex-wrap items-center gap-x-3 gap-y-1 bg-slate-900/90 backdrop-blur-sm px-3 py-2 rounded-xl border border-slate-700/80 text-[10px] text-slate-400 shadow-xl">
        <span className="font-bold text-slate-300 mr-1">Entity Types:</span>
        {[
          { label: "Account", color: "#4F46E5" },
          { label: "Device", color: "#9333EA" },
          { label: "Address", color: "#D97706" },
          { label: "Payment", color: "#059669" },
          { label: "Return", color: "#EA580C" },
          { label: "Refund", color: "#DC2626" },
        ].map(({ label, color }) => (
          <span key={label} className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full" style={{ background: color }} />
            {label}
          </span>
        ))}
        <span className="flex items-center gap-1 ml-1 border-l border-slate-700 pl-2">
          <span className="w-2 h-2 rounded-full border border-red-500 bg-red-900/60 animate-pulse" />
          <span className="text-red-400">Flagged pivot</span>
        </span>
      </div>

      {/* Node detail tooltip on hover */}
      {hoveredNodeId && (() => {
        const n = nodeMap.get(hoveredNodeId);
        if (!n) return null;
        const config = NODE_CONFIG[n.type] || NODE_CONFIG.Account;
        return (
          <div
            className="pointer-events-none absolute z-20 bg-slate-900/97 text-white p-3 rounded-xl shadow-2xl text-xs max-w-[220px] border border-slate-700/80 backdrop-blur-sm"
            style={{ top: 56, right: 12 }}
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="text-base">{config.icon}</span>
              <div>
                <p className="font-bold text-white text-sm leading-tight">{n.label}</p>
                <p className="text-[10px]" style={{ color: config.glow }}>{n.type}</p>
              </div>
              {n.isFlagged && (
                <span className="ml-auto bg-red-500/20 text-red-400 text-[9px] font-bold px-1.5 py-0.5 rounded border border-red-500/30">
                  FLAGGED
                </span>
              )}
            </div>
            {n.isFlagged && (
              <div className="flex items-center gap-2 mt-1">
                <span className="text-slate-400">Status:</span>
                <span className="font-mono font-bold text-red-400">HIGH RISK PIVOT</span>
              </div>
            )}
            <p className="text-slate-500 text-[9px] mt-1.5">Click to inspect connections</p>
          </div>
        );
      })()}
    </div>
  );
}
