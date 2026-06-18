import React from "react";
import { Maximize2, Router, Search, Server, Shield, ZoomIn } from "lucide-react";
import PageHeader from "../components/PageHeader";
import Panel from "../components/TopoPanel";
import LegendDot from "../components/LegendDot";
import LegendIcon from "../components/LegendIcon";
import Stat from "../components/TopoStat";

const nodes = [
  { label: "Firewall-01", icon: Shield, position: "left-1/2 top-[40px] -translate-x-1/2", online: true },
  { label: "Router-Edge-01", icon: Router, position: "left-1/2 top-[105px] -translate-x-1/2", online: true },
  { label: "Core-SW-01", icon: Server, position: "left-1/2 top-[178px] -translate-x-1/2", online: true },
  { label: "Dist-SW-01", icon: Server, position: "left-[24%] top-[285px] -translate-x-1/2", online: true },
  { label: "Dist-SW-02", icon: Server, position: "left-[76%] top-[285px] -translate-x-1/2", online: true },
  { label: "Access-SW-01", icon: Server, position: "left-[14%] top-[370px] -translate-x-1/2", online: true },
  { label: "Access-SW-02", icon: Server, position: "left-[34%] top-[370px] -translate-x-1/2", online: true },
  { label: "Access-SW-03", icon: Server, position: "left-[66%] top-[370px] -translate-x-1/2", online: true },
  { label: "Access-SW-04", icon: Server, position: "left-[86%] top-[370px] -translate-x-1/2", online: false },
];

export default function TopologyMap() {
  return (
    <div className="min-h-full bg-linear-to-br from-[#F8FAFC] to-[#D1D5DB] p-8 font-sans">
      <div className="flex items-start justify-between mb-5">
        <div>
          <PageHeader 
            title="Network Topology Map" 
            description="Interactive visualization of network infrastructure" 
            isSmallSubtext={true}
          />
        </div>

        <div className="flex items-center gap-4 text-slate-500">
          <button className="p-3 rounded-xl bg-[#1D293D] text-white"><Search size={18} /></button>
          <span className="text-sm font-bold">100%</span>
          <button className="p-3 rounded-xl bg-[#1D293D] text-white"><ZoomIn size={18} /></button>
          <button className="p-3 rounded-xl bg-[#1D293D] text-white"><Maximize2 size={18} /></button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_240px] gap-7">
        <div className="rounded-3xl bg-[#1D293DED]/40 border border-slate-700/30 p-6 shadow-[0_5px_15px_rgba(0,0,0,0.6)] backdrop-blur-sm">
          <div className="relative h-115 overflow-hidden rounded-2xl bg-[#223148]">
            <svg className="absolute inset-0 h-full w-full" viewBox="0 0 900 460" preserveAspectRatio="none">
              <g stroke="#64748B" strokeOpacity="0.38" strokeWidth="2">
                <line x1="450" y1="74" x2="450" y2="180" />
                <line x1="450" y1="230" x2="260" y2="300" />
                <line x1="450" y1="230" x2="640" y2="300" />
                <line x1="260" y1="320" x2="640" y2="320" />
                <line x1="260" y1="320" x2="130" y2="385" />
                <line x1="260" y1="320" x2="315" y2="385" />
                <line x1="640" y1="320" x2="585" y2="385" />
                <line x1="640" y1="320" x2="770" y2="385" />
              </g>
            </svg>

            {nodes.map(({ label, icon: Icon, position, online }) => (
              <div key={label} className={`absolute ${position} flex w-28 flex-col items-center text-center`}>
                <span className={`mb-1 h-2 w-2 rounded-full ${online ? "bg-emerald-400" : "bg-rose-500"}`} />
                <Icon className={online ? "text-slate-200" : "text-rose-400"} size={36} strokeWidth={1.5} />
                <span className="mt-1 text-[10px] font-bold text-slate-200">{label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-5">
          <Panel title="Legend">
            <LegendDot color="bg-emerald-400" label="Online" />
            <LegendDot color="bg-rose-500" label="Offline" />
            <div className="my-4 h-px bg-slate-600/40" />
            <LegendIcon label="Core Switch" />
            <LegendIcon label="Distribution" />
            <LegendIcon label="Access Switch" />
          </Panel>

          <Panel title="Quick Stats">
            <Stat label="Total Nodes" value="9" />
            <Stat label="Online" value="8" color="text-emerald-400" />
            <Stat label="Offline" value="1" color="text-rose-400" />
            <Stat label="Connections" value="9" />
          </Panel>
        </div>
      </div>
    </div>
  );
}


