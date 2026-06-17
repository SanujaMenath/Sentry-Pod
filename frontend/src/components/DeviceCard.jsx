import { Router, Shield, Server, Settings2, Pencil } from "lucide-react";
import UsageBar from "./UsageBar";

const normalizeDevice = (device) => ({
  ...device,
  status: device.status || (device.online ? "online" : "offline"),
});

const getStatusStyles = (status) =>
  status === "online"
    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
    : "bg-rose-500/10 text-rose-400 border-rose-500/20";

function DeviceCard({ device, onConfigure, onEdit }) {
  const isOffline = device.status === "offline";
  const Icon = device.type === "router" ? Router : device.type === "firewall" ? Shield : Server;

  return (
    <div className="bg-[#1D293DED] border border-slate-700/50 rounded-3xl p-6 flex flex-col h-full transition-all duration-300 ease-out hover:border-blue-500/50 hover:-translate-y-1 shadow-[0_5px_15px_rgba(0,0,0,0.6)] hover:shadow-[0_8px_25px_rgba(0,0,0,0.7)]">
      <div className="flex justify-between items-start mb-6">
        <div className="flex gap-4">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center border border-white/5 shadow-inner ${isOffline ? "bg-rose-500/10 text-rose-500" : "bg-blue-600/20 text-blue-400"}`}>
            <Icon size={24} />
          </div>
          <div>
            <h3 className="text-white font-bold text-lg tracking-tight font-mono">{device.name}</h3>
            {device.label && <p className="text-slate-400 text-xs font-medium">{device.label}</p>}
            <p className="text-slate-500 text-xs font-mono">{device.ip}</p>
          </div>
        </div>

        <div className={`px-3 py-1 rounded-full border text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 ${getStatusStyles(device.status)}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${isOffline ? "bg-rose-500" : "bg-emerald-500 animate-pulse"}`} />
          {device.status}
        </div>
      </div>

      <div className="mb-6 grid grid-cols-[auto_1fr] gap-x-5 gap-y-1 text-xs">
        <span className="text-slate-500">Model</span>
        <strong className="text-right font-semibold text-slate-200">{device.model}</strong>
        <span className="text-slate-500">Version</span>
        <strong className="text-right font-semibold text-slate-200">{device.version}</strong>
        <span className="text-slate-500">Layer</span>
        <strong className="text-right">
          <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider border ${
            device.layer === "edge" ? "bg-blue-500/10 text-blue-400 border-blue-500/20"
            : device.layer === "core" ? "bg-purple-500/10 text-purple-400 border-purple-500/20"
            : device.layer === "distribution" ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
            : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
          }`}>
            {device.layer || "access"}
          </span>
        </strong>
        <span className="text-slate-500">Uptime</span>
        <strong className="text-right font-semibold text-slate-200">{device.uptime}</strong>
      </div>

      <div className="flex-1">
        {isOffline ? (
          <div className="bg-rose-500/5 border border-rose-500/10 rounded-2xl p-4 text-center">
            <p className="text-rose-500 text-xs font-bold uppercase tracking-tighter">Connection Lost</p>
            <p className="text-slate-500 text-[10px]">Last seen: 45 min ago</p>
          </div>
        ) : (
          <div className="space-y-4">
            <UsageBar label="CPU Load" value={device.cpu} />
            <UsageBar label="Mem Load" value={device.memory} />
          </div>
        )}
      </div>

      <div className="mt-8 grid grid-cols-2 gap-3">
        <button
          onClick={() => onConfigure(device)}
          className="flex w-full items-center justify-center gap-2 py-2.5 rounded-xl border border-slate-700 bg-slate-800 text-slate-300 text-xs font-bold hover:bg-slate-700 hover:text-white transition-all active:scale-95 disabled:cursor-not-allowed disabled:bg-slate-800/50 disabled:text-slate-500"
          disabled={isOffline}
        >
          <Settings2 size={14} /> Configure
        </button>
        <button
          onClick={() => onEdit(device)}
          className="flex w-full items-center justify-center gap-2 py-2.5 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-500 shadow-lg shadow-blue-600/20 transition-all active:scale-95"
        >
          <Pencil size={14} /> Edit
        </button>
      </div>
    </div>
  );
}

export default DeviceCard;
export { normalizeDevice };
