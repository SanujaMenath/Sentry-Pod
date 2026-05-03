import React, { useState } from "react";
import {
  PlusCircle,
  Shield,
  Router,
  Server,
  Settings2,
  Info,
} from "lucide-react";
import AddDeviceModal from "../components/AddDeviceModal";

const startingDevices = [
  { id: 1, name: "core-sw-01", ip: "192.168.1.1", status: "online", model: "Cisco Catalyst 9300", version: "17.6.3", uptime: "45d", cpu: 35, memory: 62, type: "switch" },
  { id: 2, name: "router-edge-01", ip: "10.0.0.1", status: "online", model: "Cisco ISR 4451", version: "16.12.5", uptime: "12d", cpu: 87, memory: 71, type: "router" },
  { id: 3, name: "access-sw-02", ip: "192.168.1.12", status: "online", model: "Cisco Catalyst 2960X", version: "15.2(7)", uptime: "89d", cpu: 28, memory: 45, type: "switch" },
  { id: 4, name: "dist-sw-03", ip: "192.168.1.13", status: "online", model: "Cisco Catalyst 2960X", version: "15.2(7)", uptime: "89d", cpu: 28, memory: 45, type: "switch" },
  { id: 5, name: "access-sw-15", ip: "192.168.3.25", status: "offline", model: "Cisco Catalyst 2960", version: "15.0(21)", uptime: "N/A", cpu: null, memory: null, type: "switch" },
  { id: 6, name: "firewall-01", ip: "10.0.0.254", status: "online", model: "Cisco ASA 5525-X", version: "9.16(3)", uptime: "156d", cpu: 55, memory: 68, type: "firewall" },
];

const getStatusStyles = (status) =>
  status === "online"
    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
    : "bg-rose-500/10 text-rose-400 border-rose-500/20";

const getProgressColor = (value) => {
  if (value >= 80) return "bg-rose-500";
  if (value >= 55) return "bg-amber-500";
  return "bg-blue-500";
};

export default function NetworkDevices() {
  const [devices, setDevices] = useState(startingDevices);
  const [showAddModal, setShowAddModal] = useState(false);

  const addDevice = (device) => {
    setDevices((current) => [device, ...current]);
  };

  return (
    <div className="min-h-full bg-gradient-to-br from-[#F8FAFC] to-[#D1D5DB] p-8 font-sans">
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-[#0F172A] text-[30px] font-extrabold tracking-tight">
            Network Devices
          </h1>
          <p className="text-[#475569] text-base font-medium">
            Monitor and manage all network devices
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-lg shadow-blue-600/20 active:scale-95 transition-all"
        >
          <PlusCircle size={18} />
          Add Device
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-6">
        {devices.map((device) => (
          <DeviceCard key={device.id} device={device} />
        ))}
      </div>

      {showAddModal && (
        <AddDeviceModal
          onClose={() => setShowAddModal(false)}
          onSave={addDevice}
        />
      )}
    </div>
  );
}

function UsageBar({ label, value }) {
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-[11px] font-bold">
        <span className="text-slate-500 uppercase tracking-wider">{label}</span>
        <span className={value >= 80 ? "text-rose-400" : "text-slate-300"}>{value}%</span>
      </div>
      <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
        <div
          className={`h-full transition-all duration-500 ${getProgressColor(value)}`}
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}

function DeviceCard({ device }) {
  const isOffline = device.status === "offline";
  const Icon = device.type === "router" ? Router : device.type === "firewall" ? Shield : Server;

  return (
    <div className="bg-[#1D293DED] border border-slate-700/50 rounded-3xl p-6 flex flex-col h-full transition-all duration-300 ease-out hover:border-blue-500/50 hover:-translate-y-0.5 hover:shadow-[0_20px_40px_rgba(0,0,0,0.4),0_0_15px_rgba(59,130,246,0.1)]">
      <div className="flex justify-between items-start mb-6">
        <div className="flex gap-4">
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border border-white/5 shadow-inner ${isOffline ? "bg-rose-500/10 text-rose-500" : "bg-blue-600/20 text-blue-400"}`}>
            <Icon size={24} />
          </div>
          <div>
            <h3 className="text-white font-bold text-lg tracking-tight font-mono">{device.name}</h3>
            <p className="text-slate-500 text-xs font-mono">{device.ip}</p>
          </div>
        </div>

        <div className={`px-3 py-1 rounded-full border text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 ${getStatusStyles(device.status)}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${isOffline ? "bg-rose-500" : "bg-emerald-500 animate-pulse"}`} />
          {device.status}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-6">
        {[
          { label: "Model", value: device.model.split(" ")[2] || device.model },
          { label: "OS", value: device.version },
          { label: "Uptime", value: device.uptime },
        ].map((item) => (
          <div key={item.label} className="bg-[#0d1117]/50 p-2 rounded-xl border border-slate-800/50 text-center">
            <p className="text-[9px] uppercase text-slate-600 font-bold mb-0.5">{item.label}</p>
            <p className="text-[11px] text-slate-300 font-medium truncate">{item.value}</p>
          </div>
        ))}
      </div>

      <div className="h-px bg-slate-800/50 mb-6" />

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

      <div className="grid grid-cols-2 gap-3 mt-8">
        <button className="flex items-center justify-center gap-2 py-2.5 rounded-xl border border-slate-700 bg-slate-800 text-slate-300 text-xs font-bold hover:bg-slate-700 hover:text-white transition-all active:scale-95">
          <Settings2 size={14} /> Configure
        </button>
        <button className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-500 shadow-lg shadow-blue-600/20 transition-all active:scale-95">
          <Info size={14} /> View Details
        </button>
      </div>
    </div>
  );
}

