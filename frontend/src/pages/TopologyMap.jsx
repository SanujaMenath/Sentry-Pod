import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  Handle,
  Position,
  MarkerType,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  Maximize2,
  RefreshCw,
  Router,
  Server,
  Shield,
  X,
  Wifi,
} from "lucide-react";
import PageHeader from "../components/PageHeader";
import Panel from "../components/TopoPanel";
import LegendDot from "../components/LegendDot";
import Stat from "../components/TopoStat";
import { getTopologyGraph, refreshTopology } from "../services/topologyService";
import { useOutletContext } from "react-router-dom";

const TIER_ORDER = ["edge", "core", "distribution", "access"];

const TIER_COLORS = {
  edge: { bg: "#1e3a5f", border: "#3b82f6", text: "#bfdbfe" },
  core: { bg: "#3b0764", border: "#8b5cf6", text: "#e9d5ff" },
  distribution: { bg: "#134e4a", border: "#2dd4bf", text: "#ccfbf1" },
  access: { bg: "#1e293b", border: "#64748b", text: "#cbd5e1" },
  unknown: { bg: "#7f1d1d", border: "#ef4444", text: "#fecaca" },
};

const TIER_ICONS = { edge: Shield, core: Server, distribution: Router, access: Wifi };

function TierNode({ data }) {
  const colors = TIER_COLORS[data.tier] || TIER_COLORS.unknown;
  const Icon = TIER_ICONS[data.tier] || Server;

  return (
    <div
      className="relative cursor-pointer rounded-xl border-2 px-4 py-3 shadow-lg transition-shadow hover:shadow-xl"
      style={{
        background: colors.bg,
        borderColor: colors.border,
        minWidth: 140,
      }}
    >
      <Handle type="target" position={Position.Top} className="!bg-slate-400" />
      <div className="flex items-center gap-2">
        <Icon size={18} style={{ color: colors.border }} />
        <span className="text-sm font-bold truncate" style={{ color: colors.text }}>
          {data.label}
        </span>
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-slate-400" />
    </div>
  );
}

const nodeTypes = { tierNode: TierNode };

function timeAgo(isoString) {
  if (!isoString) return null;
  const now = Date.now();
  const then = new Date(isoString).getTime();
  const diff = Math.floor((now - then) / 1000);
  if (diff < 5) return "just now";
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return new Date(isoString).toLocaleString();
}

function applyLayout(nodes, edges) {
  const TIER_GAP = 150;
  const NODE_WIDTH = 160;
  const H_SPACING = 30;
  const START_Y = 50;
  const PAD_X = 60;

  const tiered = {};
  nodes.forEach((n) => {
    const t = (TIER_ORDER.indexOf(n.data.tier) >= 0) ? n.data.tier : "unknown";
    if (!tiered[t]) tiered[t] = [];
    tiered[t].push(n);
  });

  let maxCount = 0;
  TIER_ORDER.forEach((t) => {
    if (tiered[t] && tiered[t].length > maxCount) maxCount = tiered[t].length;
  });
  if (tiered.unknown && tiered.unknown.length > maxCount) maxCount = tiered.unknown.length;
  const maxWidth = maxCount * (NODE_WIDTH + H_SPACING) - H_SPACING;

  TIER_ORDER.forEach((tier, i) => {
    const tierNodes = tiered[tier] || [];
    const groupWidth = tierNodes.length * (NODE_WIDTH + H_SPACING) - H_SPACING;
    const startX = PAD_X + (maxWidth - groupWidth) / 2;
    tierNodes.forEach((node, j) => {
      node.position = { x: startX + j * (NODE_WIDTH + H_SPACING), y: START_Y + i * TIER_GAP };
    });
  });

  if (tiered.unknown) {
    const i = TIER_ORDER.length;
    const groupWidth = tiered.unknown.length * (NODE_WIDTH + H_SPACING) - H_SPACING;
    const startX = PAD_X + (maxWidth - groupWidth) / 2;
    tiered.unknown.forEach((node, j) => {
      node.position = { x: startX + j * (NODE_WIDTH + H_SPACING), y: START_Y + i * TIER_GAP };
    });
  }

  const edgeNodes = {};
  nodes.forEach((n) => { edgeNodes[n.id] = n; });

  const positionEdges = edges.map((e) => {
    const srcNode = edgeNodes[e.source];
    const tgtNode = edgeNodes[e.target];
    let source = e.source;
    let target = e.target;
    if (srcNode && tgtNode) {
      const srcIdx = TIER_ORDER.indexOf(srcNode.data.tier);
      const tgtIdx = TIER_ORDER.indexOf(tgtNode.data.tier);
      if (tgtIdx < srcIdx) { source = e.target; target = e.source; }
    }
    return {
      ...e,
      id: `${source}--${target}`,
      source,
      target,
      type: "smoothstep",
      markerEnd: { type: MarkerType.ArrowClosed, color: "#64748b" },
      style: { stroke: "#64748b", strokeWidth: 2 },
      label: e.data?.sourceInterface && e.data?.targetInterface
        ? `${e.data.sourceInterface} ↔ ${e.data.targetInterface}`
        : "",
      labelStyle: { fill: "#94a3b8", fontSize: 10, fontWeight: 600 },
      labelBgStyle: { fill: "#1e293b", fillOpacity: 0.8 },
      labelBgPadding: [4, 2],
      labelBgBorderRadius: 4,
    };
  });

  return { positionedNodes: nodes, positionedEdges: positionEdges };
}

export default function TopologyMap() {
  const [rfNodes, setRfNodes, onNodesChange] = useNodesState([]);
  const [rfEdges, setRfEdges, onEdgesChange] = useEdgesState([]);
  const [loading, setLoading] = useState(true);
  const [empty, setEmpty] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedNode, setSelectedNode] = useState(null);
  const [stats, setStats] = useState({ total: 0, edge: 0, core: 0, distribution: 0, access: 0 });
  const [lastRefreshed, setLastRefreshed] = useState(null);
  const { search } = useOutletContext() || { search: "" };
  const [highlightedNodeId, setHighlightedNodeId] = useState(null);
  const baseNodesRef = useRef([]);
  const baseEdgesRef = useRef([]);
  const searchQueryRef = useRef("");
  const highlightRef = useRef(null);
  searchQueryRef.current = search;
  highlightRef.current = highlightedNodeId;

  const syncStyles = useCallback(() => {
    const baseNodes = baseNodesRef.current;
    const baseEdges = baseEdgesRef.current;
    if (!baseNodes.length) return;

    const hn = highlightRef.current;
    const sq = searchQueryRef.current.toLowerCase().trim();
    const searchActive = sq.length > 0;

    const neighborIds = new Set();
    if (hn) {
      neighborIds.add(hn);
      for (const e of baseEdges) {
        if (e.source === hn) neighborIds.add(e.target);
        if (e.target === hn) neighborIds.add(e.source);
      }
    }

    const updatedNodes = baseNodes.map((n) => {
      const searchMatch =
        !searchActive ||
        n.data.label?.toLowerCase().includes(sq) ||
        n.data.tier?.toLowerCase().includes(sq) ||
        n.data.ip?.toLowerCase().includes(sq) ||
        n.data.platform?.toLowerCase().includes(sq);
      const highlightMatch = !hn || neighborIds.has(n.id);
      const dimmed = !searchMatch || !highlightMatch;
      return {
        ...n,
        style: {
          opacity: dimmed ? 0.2 : 1,
          filter:
            hn === n.id && !dimmed
              ? "brightness(1.3) drop-shadow(0 0 6px rgba(59,130,246,0.6))"
              : "none",
        },
      };
    });

    const updatedEdges = baseEdges.map((e) => {
      const searchMatch = !searchActive || e.source.toLowerCase().includes(sq) || e.target.toLowerCase().includes(sq);
      const highlightMatch = !hn || e.source === hn || e.target === hn;
      const dimmed = !searchMatch || !highlightMatch;
      return {
        ...e,
        style: {
          ...e.style,
          opacity: dimmed ? 0.1 : 1,
          strokeWidth: dimmed ? 1 : e.style?.strokeWidth || 2,
        },
      };
    });

    setRfNodes(updatedNodes);
    setRfEdges(updatedEdges);
  }, [setRfNodes, setRfEdges]);

  const fetchGraph = useCallback(async () => {
    try {
      const res = await getTopologyGraph();
      const { nodes: rawNodes, edges: rawEdges, last_refreshed } = res.data;

      setLastRefreshed(last_refreshed || null);

      const nodes = rawNodes.map((n) => ({
        id: n.id,
        type: "tierNode",
        data: { label: n.label, tier: n.tier, ip: n.ip, platform: n.platform },
      }));

      const edges = rawEdges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        data: { sourceInterface: e.source_interface, targetInterface: e.target_interface },
      }));

      const hasData = rawNodes.length > 0;

      if (hasData) {
        const { positionedNodes, positionedEdges } = applyLayout(nodes, edges);
        baseNodesRef.current = positionedNodes;
        baseEdgesRef.current = positionedEdges;
        syncStyles();
      }

      const tierCounts = { total: rawNodes.length, edge: 0, core: 0, distribution: 0, access: 0 };
      rawNodes.forEach((n) => {
        if (tierCounts[n.tier] !== undefined) tierCounts[n.tier]++;
      });
      setStats(tierCounts);
      return hasData;
    } catch (e) {
      console.error("Failed to fetch topology graph", e);
      return false;
    }
  }, [setRfNodes, setRfEdges]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refreshTopology();
      await fetchGraph();
    } catch (e) {
      console.error("Topology refresh failed", e);
    } finally {
      setRefreshing(false);
    }
  }, [fetchGraph]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const hasData = await fetchGraph();
      setEmpty(!hasData);
      setLoading(false);
    })();
  }, [fetchGraph]);

  useEffect(() => {
    if (empty) setLastRefreshed(null);
  }, [empty]);

  useEffect(() => {
  syncStyles();
}, [search, highlightedNodeId, syncStyles]);

  const onNodeClick = useCallback((_, node) => {
    setSelectedNode(node.data);
    setHighlightedNodeId(node.id);
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
    setHighlightedNodeId(null);
  }, []);

  const edgeCount = rfEdges.length;

  return (
    <div
    className="relative min-h-full p-8 font-sans"
    style={{
      background: "linear-gradient(135deg, #F8FAFC 0%, #D1D5DB 100%)",
      backgroundAttachment: "fixed",
    }}
  >
    <div className="flex items-start justify-between mb-5">
      <div>
        <PageHeader
          title="Network Topology Map"
          description="CDP-discovered network topology"
          isSmallSubtext={true}
          textColor="#0F172A"
          subtextColor="#475569"
        />
      </div>
        <div className="flex items-center gap-4">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-2 rounded-xl bg-[#1D293D] px-4 py-3 text-slate-300 transition hover:bg-slate-700"
          >
            <RefreshCw size={18} className={refreshing ? "animate-spin" : ""} />
            <span className="text-sm font-semibold">{refreshing ? "Refreshing..." : "Refresh"}</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_220px] gap-7">
        <div className="h-[600px] rounded-3xl border border-slate-700/30 bg-[#0b1120] shadow-[0_5px_15px_rgba(0,0,0,0.6)]">
          {loading && (
            <div className="flex h-full items-center justify-center text-slate-400">
              <RefreshCw className="mr-2 animate-spin" size={20} />
              Loading...
            </div>
          )}
          {!loading && empty && (
            <div className="flex h-full flex-col items-center justify-center text-center px-8">
              <Shield size={48} className="mb-4 text-slate-600" />
              <p className="text-lg font-semibold text-slate-300 mb-2">No Topology Data</p>
              <p className="text-sm text-slate-500 mb-6 max-w-sm">
                No cached topology found. Click "Refresh" to discover your network via CDP neighbor data.
              </p>
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-white hover:bg-blue-700 transition"
              >
                <RefreshCw size={18} className={refreshing ? "animate-spin" : ""} />
                <span className="text-sm font-semibold">{refreshing ? "Refreshing..." : "Refresh Now"}</span>
              </button>
            </div>
          )}
          {!loading && !empty && (
            <ReactFlow
              nodes={rfNodes}
              edges={rfEdges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onNodeClick={onNodeClick}
              onPaneClick={onPaneClick}
              nodeTypes={nodeTypes}
              fitView
              fitViewOptions={{ padding: 0.3 }}
              minZoom={0.3}
              maxZoom={2}
              proOptions={{ hideAttribution: true }}
            >
              <Background color="#334155" gap={24} />
              <Controls
                className="!rounded-xl !border-slate-700 !bg-[#1D293D] [&_button]:!text-slate-300 [&_button]:!border-slate-600"
              />
              <MiniMap
                nodeColor={(n) => TIER_COLORS[n.data?.tier]?.border || "#64748b"}
                maskColor="rgba(15,23,42,0.7)"
                className="!rounded-xl !border-slate-700"
              />
            </ReactFlow>
          )}
        </div>

        <div className="space-y-5">
          <Panel title="Legend">
            <LegendDot color="bg-blue-500" label="Edge / WAN" />
            <LegendDot color="bg-violet-500" label="Core" />
            <LegendDot color="bg-teal-500" label="Distribution" />
            <LegendDot color="bg-slate-500" label="Access" />
          </Panel>

          <Panel title="Quick Stats">
            <Stat label="Total Nodes" value={String(stats.total)} />
            <Stat label="Edge" value={String(stats.edge)} color="text-blue-400" />
            <Stat label="Core" value={String(stats.core)} color="text-violet-400" />
            <Stat label="Distribution" value={String(stats.distribution)} color="text-teal-400" />
            <Stat label="Access" value={String(stats.access)} color="text-slate-400" />
            <Stat label="Links" value={String(edgeCount)} />
            <Stat
              label="Last Refreshed"
              value={timeAgo(lastRefreshed) || "—"}
              color="text-slate-500"
            />
          </Panel>
        </div>
      </div>

      {selectedNode && (
        <div className="fixed right-0 top-0 z-50 h-full w-80 border-l border-slate-700/50 bg-[#1D293D] p-6 shadow-2xl">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold text-white">{selectedNode.label}</h2>
            <button onClick={() => setSelectedNode(null)} className="text-slate-400 hover:text-white">
              <X size={20} />
            </button>
          </div>
          <div className="space-y-4 text-sm">
            <div>
              <span className="text-slate-400">Tier</span>
              <p className="font-semibold text-white capitalize">{selectedNode.tier}</p>
            </div>
            {selectedNode.ip && (
              <div>
                <span className="text-slate-400">IP Address</span>
                <p className="font-semibold text-white">{selectedNode.ip}</p>
              </div>
            )}
            {selectedNode.platform && (
              <div>
                <span className="text-slate-400">Platform</span>
                <p className="font-semibold text-white">{selectedNode.platform}</p>
              </div>
            )}
            <div>
              <span className="text-slate-400">Connected Links</span>
              <div className="mt-2 space-y-2">
                {rfEdges
                  .filter((e) => e.source === selectedNode.label || e.target === selectedNode.label)
                  .map((e) => {
                    const neighbor = e.source === selectedNode.label ? e.target : e.source;
                    const localIntf = e.source === selectedNode.label ? e.data?.sourceInterface : e.data?.targetInterface;
                    const remoteIntf = e.source === selectedNode.label ? e.data?.targetInterface : e.data?.sourceInterface;
                    return (
                      <div key={e.id} className="rounded-lg bg-slate-800/50 p-2.5">
                        <p className="font-medium text-slate-200">{neighbor}</p>
                        <p className="text-xs text-slate-400">
                          {localIntf} ↔ {remoteIntf}
                        </p>
                      </div>
                    );
                  })}
                {rfEdges.filter((e) => e.source === selectedNode.label || e.target === selectedNode.label).length === 0 && (
                  <p className="text-slate-500 italic">No links in graph</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
