import { useState, useMemo } from "react";
import type { GraphNode, GraphEdge, NodeType } from "@/lib/trustloop/network";
import { ZoomIn, ZoomOut, RotateCcw, Filter, ShieldAlert, Layers } from "lucide-react";

interface RelationshipGraphProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  selectedNodeId?: string | null;
  onSelectNode?: (nodeId: string | null) => void;
  height?: number;
  interactive?: boolean;
}

const NODE_COLORS: Record<NodeType, { fill: string; border: string; text: string; bg: string }> = {
  Customer: { fill: "#2563EB", border: "#1D4ED8", text: "#FFFFFF", bg: "#EFF6FF" },
  Account: { fill: "#4F46E5", border: "#4338CA", text: "#FFFFFF", bg: "#EEF2FF" },
  Device: { fill: "#9333EA", border: "#7E22CE", text: "#FFFFFF", bg: "#FAF5FF" },
  Address: { fill: "#D97706", border: "#B45309", text: "#FFFFFF", bg: "#FFFBEB" },
  Phone: { fill: "#0284C7", border: "#0369A1", text: "#FFFFFF", bg: "#F0F9FF" },
  Email: { fill: "#0284C7", border: "#0369A1", text: "#FFFFFF", bg: "#F0F9FF" },
  Payment: { fill: "#059669", border: "#047857", text: "#FFFFFF", bg: "#ECFDF5" },
  Order: { fill: "#475569", border: "#334155", text: "#FFFFFF", bg: "#F8FAFC" },
  Product: { fill: "#0D9488", border: "#0F766E", text: "#FFFFFF", bg: "#F0FDFA" },
  Return: { fill: "#EA580C", border: "#C2410C", text: "#FFFFFF", bg: "#FFF7ED" },
  Refund: { fill: "#DC2626", border: "#B91C1C", text: "#FFFFFF", bg: "#FEF2F2" },
  Courier: { fill: "#64748B", border: "#475569", text: "#FFFFFF", bg: "#F8FAFC" },
  Hub: { fill: "#64748B", border: "#475569", text: "#FFFFFF", bg: "#F8FAFC" },
};

export function RelationshipGraph({
  nodes,
  edges,
  selectedNodeId,
  onSelectNode,
  height = 520,
  interactive = true,
}: RelationshipGraphProps) {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [activeFilter, setActiveFilter] = useState<string>("ALL");

  // Deterministic radial / force-inspired node layout
  const layoutNodes = useMemo(() => {
    const width = 800;
    const h = height;
    const centerX = width / 2;
    const centerY = h / 2;

    const total = nodes.length;
    if (total === 0) return [];

    return nodes.map((node, index) => {
      // Place devices & accounts closer to center; orders & returns outer
      let radius = 160;
      if (node.type === "Device" || node.type === "Address" || node.type === "Payment") {
        radius = 75;
      } else if (node.type === "Account" || node.type === "Customer") {
        radius = 160;
      } else if (node.type === "Order" || node.type === "Product") {
        radius = 240;
      } else if (node.type === "Return" || node.type === "Refund") {
        radius = 300;
      }

      const angle = (index / total) * 2 * Math.PI - Math.PI / 2;
      const x = centerX + radius * Math.cos(angle);
      const y = centerY + radius * Math.sin(angle);

      return {
        ...node,
        x,
        y,
      };
    });
  }, [nodes, height]);

  const nodeMap = useMemo(() => {
    const map = new Map<string, { x: number; y: number } & GraphNode>();
    layoutNodes.forEach((n) => map.set(n.id, n));
    return map;
  }, [layoutNodes]);

  // Connected nodes to selected node
  const connectedIds = useMemo(() => {
    if (!selectedNodeId) return new Set<string>();
    const set = new Set<string>([selectedNodeId]);
    edges.forEach((e) => {
      if (e.source === selectedNodeId) set.add(e.target);
      if (e.target === selectedNodeId) set.add(e.source);
    });
    return set;
  }, [selectedNodeId, edges]);

  const filteredNodes = useMemo(() => {
    if (activeFilter === "ALL") return layoutNodes;
    return layoutNodes.filter((n) => n.type === activeFilter || n.isFlagged);
  }, [layoutNodes, activeFilter]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!interactive) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
  };

  const handleMouseUp = () => setIsDragging(false);

  return (
    <div className="relative rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden select-none">
      {/* Top Toolbar */}
      {interactive && (
        <div className="absolute top-3 left-3 z-10 flex flex-wrap items-center gap-1.5 bg-white/95 backdrop-blur-xs p-1.5 rounded-xl border border-slate-200/90 shadow-xs">
          <button
            onClick={() => setZoom((z) => Math.min(2.0, z + 0.15))}
            className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
            title="Zoom In"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            onClick={() => setZoom((z) => Math.max(0.5, z - 0.15))}
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

          {/* Quick Filter */}
          <div className="flex items-center gap-1">
            <Filter className="w-3.5 h-3.5 text-slate-400 ml-1" />
            {["ALL", "Account", "Device", "Address", "Payment"].map((filter) => (
              <button
                key={filter}
                onClick={() => setActiveFilter(filter)}
                className={`px-2 py-0.5 text-[11px] font-semibold rounded-md transition-colors ${
                  activeFilter === filter
                    ? "bg-[#1769E0] text-white"
                    : "text-slate-500 hover:text-slate-800 hover:bg-slate-100"
                }`}
              >
                {filter}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Legend Badge */}
      <div className="absolute bottom-3 left-3 z-10 hidden sm:flex flex-wrap items-center gap-2 bg-white/95 backdrop-blur-xs px-2.5 py-1.5 rounded-xl border border-slate-200 text-[10px] text-slate-500 shadow-xs">
        <span className="font-semibold text-slate-700">Entity Types:</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-[#4F46E5]" /> Account</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-[#9333EA]" /> Device</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-[#D97706]" /> Address</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-[#059669]" /> Payment</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-[#EA580C]" /> Return</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-[#DC2626]" /> Refund</span>
      </div>

      {/* SVG Canvas */}
      <svg
        width="100%"
        height={height}
        viewBox="0 0 800 520"
        className={`w-full h-full bg-[#FAFCFF] ${interactive ? "cursor-grab active:cursor-grabbing" : ""}`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <defs>
          <pattern id="graph-grid" width="32" height="32" patternUnits="userSpaceOnUse">
            <path d="M 32 0 L 0 0 0 32" fill="none" stroke="#F1F5F9" strokeWidth="1" />
          </pattern>
          <filter id="node-shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.08" floodColor="#0F172A" />
          </filter>
        </defs>

        <rect width="100%" height="100%" fill="url(#graph-grid)" />

        <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
          {/* Edges */}
          {edges.map((edge) => {
            const source = nodeMap.get(edge.source);
            const target = nodeMap.get(edge.target);
            if (!source || !target) return null;

            const isHighlighted =
              selectedNodeId &&
              (edge.source === selectedNodeId || edge.target === selectedNodeId);

            return (
              <line
                key={edge.id}
                x1={source.x}
                y1={source.y}
                x2={target.x}
                y2={target.y}
                stroke={isHighlighted ? "#1769E0" : "#CBD5E1"}
                strokeWidth={isHighlighted ? 2.5 : 1.2}
                strokeDasharray={edge.type.includes("DEVICE") || edge.type.includes("PAYMENT") ? "4 2" : undefined}
                className="transition-all duration-200"
              />
            );
          })}

          {/* Nodes */}
          {filteredNodes.map((node) => {
            const isSelected = selectedNodeId === node.id;
            const isConnected = connectedIds.has(node.id);
            const colors = NODE_COLORS[node.type] || NODE_COLORS.Account;

            const opacity =
              selectedNodeId && !isSelected && !isConnected ? 0.35 : 1;

            return (
              <g
                key={node.id}
                transform={`translate(${node.x}, ${node.y})`}
                className="cursor-pointer transition-opacity duration-200 group"
                onClick={() => onSelectNode?.(isSelected ? null : node.id)}
                style={{ opacity }}
              >
                {/* Flagged halo */}
                {node.isFlagged && (
                  <circle
                    r={26}
                    fill="none"
                    stroke="#EF4444"
                    strokeWidth={2}
                    strokeDasharray="4 2"
                    className="animate-pulse"
                  />
                )}

                {/* Selection ring */}
                {isSelected && (
                  <circle
                    r={28}
                    fill="none"
                    stroke="#1769E0"
                    strokeWidth={3}
                  />
                )}

                {/* Main Node Circle */}
                <circle
                  r={18}
                  fill={colors.fill}
                  stroke={colors.border}
                  strokeWidth={2}
                  filter="url(#node-shadow)"
                  className="transition-transform group-hover:scale-110"
                />

                {/* Node Glyph Letter */}
                <text
                  textAnchor="middle"
                  dy="4"
                  fill="#FFFFFF"
                  fontSize="10"
                  fontWeight="700"
                  fontFamily="system-ui, sans-serif"
                >
                  {node.type[0]}
                </text>

                {/* Label text */}
                <text
                  textAnchor="middle"
                  dy="32"
                  fill="#1E293B"
                  fontSize="11"
                  fontWeight="600"
                  fontFamily="system-ui, sans-serif"
                  className="bg-white/80"
                >
                  {node.label}
                </text>
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
}
