import React, { useEffect, useState } from "react";
import {
  Cable,
  Pencil,
  KeyRound,
  PlusCircle,
  Router,
  Save,
  Server,
  Settings2,
  Shield,
  Terminal,
  X,
} from "lucide-react";
import AddDeviceModal from "../components/AddDeviceModal";
import {
  addNetworkDevice,
  fetchNetworkDevices,
  getNetworkTerminalSocketUrl,
  saveDeviceConfiguration,
} from "../services/networkService";

const normalizeDevice = (device) => ({
  ...device,
  status: device.status || (device.online ? "online" : "offline"),
});

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
  const [devices, setDevices] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [terminalDevice, setTerminalDevice] = useState(null);
  const [editDevice, setEditDevice] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchNetworkDevices()
      .then((items) => setDevices(items.map(normalizeDevice)))
      .catch((err) => setError(err.response?.data?.detail || "Unable to load network devices."));
  }, []);

  const addDevice = async (device) => {
    const created = await addNetworkDevice(device);
    setDevices((current) => [normalizeDevice(created), ...current]);
  };

  return (
    <div className="min-h-full bg-gradient-to-br from-[#F8FAFC] to-[#D1D5DB] p-8 font-sans">
      <div className="mb-8 flex items-start justify-between">
  <PageHeader 
    title="Network Devices" 
    description="Monitor and manage all network devices" 
    isSmallSubtext={true}
  />

        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-lg shadow-blue-600/20 active:scale-95 transition-all"
        >
          <PlusCircle size={18} />
          Add Device
        </button>
      </div>

      {error && <p className="mb-4 rounded-xl bg-rose-500/10 px-4 py-3 text-sm font-semibold text-rose-600">{error}</p>}

      <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-6">
        {devices.map((device) => (
          <DeviceCard
            key={device.id}
            device={device}
            onConfigure={setTerminalDevice}
            onEdit={setEditDevice}
          />
        ))}
      </div>

      {showAddModal && (
        <AddDeviceModal
          onClose={() => setShowAddModal(false)}
          onSave={addDevice}
        />
      )}

      {terminalDevice && (
        <TerminalDeviceModal
          device={terminalDevice}
          onClose={() => setTerminalDevice(null)}
        />
      )}

      {editDevice && (
        <EditDeviceModal
          device={editDevice}
          onClose={() => setEditDevice(null)}
        />
      )}
    </div>
  );
}

function UsageBar({ label, value }) {
  const safeValue = Number.isFinite(value) ? value : 0;

  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-[11px] font-bold">
        <span className="text-slate-500 uppercase tracking-wider">{label}</span>
        <span className={safeValue >= 80 ? "text-rose-400" : "text-slate-300"}>{safeValue}%</span>
      </div>
      <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
        <div
          className={`h-full transition-all duration-500 ${getProgressColor(safeValue)}`}
          style={{ width: `${safeValue}%` }}
        />
      </div>
    </div>
  );
}

function DeviceCard({ device, onConfigure, onEdit }) {
  const isOffline = device.status === "offline";
  const Icon = device.type === "router" ? Router : device.type === "firewall" ? Shield : Server;

  return (
    <div className="bg-[#1D293DED] border border-slate-700/50 rounded-lg p-6 flex flex-col h-full transition-all duration-300 ease-out hover:border-blue-500/50 hover:-translate-y-0.5 hover:shadow-[0_20px_40px_rgba(0,0,0,0.4),0_0_15px_rgba(59,130,246,0.1)]">
      <div className="flex justify-between items-start mb-6">
        <div className="flex gap-4">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center border border-white/5 shadow-inner ${isOffline ? "bg-rose-500/10 text-rose-500" : "bg-blue-600/20 text-blue-400"}`}>
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

      <div className="mb-6 grid grid-cols-[auto_1fr] gap-x-5 gap-y-1 text-xs">
        <span className="text-slate-500">Model</span>
        <strong className="text-right font-semibold text-slate-200">{device.model}</strong>
        <span className="text-slate-500">Version</span>
        <strong className="text-right font-semibold text-slate-200">{device.version}</strong>
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

function TerminalDeviceModal({ device, onClose }) {
  const prompt = getPrompt(device);
  const [command, setCommand] = useState("");
  const [connected, setConnected] = useState(false);
  const [socket, setSocket] = useState(null);
  const [lines, setLines] = useState([
    `Opening terminal for ${device.name} (${device.ip})...`,
  ]);

  useEffect(() => {
    const terminalSocket = new WebSocket(getNetworkTerminalSocketUrl(device.id));
    setSocket(terminalSocket);

    terminalSocket.onopen = () => {
      setConnected(true);
    };

    terminalSocket.onmessage = (event) => {
      setLines((current) => [...current, event.data]);
    };

    terminalSocket.onerror = () => {
      setLines((current) => [...current, "\r\nTerminal connection error.\r\n"]);
    };

    terminalSocket.onclose = () => {
      setConnected(false);
      setLines((current) => [...current, "\r\nSSH session closed.\r\n"]);
    };

    return () => {
      terminalSocket.close();
    };
  }, [device.id]);

  const submitCommand = async (event) => {
    event.preventDefault();
    const nextCommand = command;

    if (!nextCommand || socket?.readyState !== WebSocket.OPEN) return;

    setCommand("");
    socket.send(`${nextCommand}\r`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="flex h-[min(720px,calc(100vh-32px))] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-slate-700 bg-[#17182b] shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-700/70 bg-[#202136] px-5 py-3">
          <div>
            <h2 className="text-sm font-bold text-slate-100">Terminal - {device.name}</h2>
            <p className="text-xs font-mono text-slate-400">{device.ip}</p>
          </div>
          <button type="button" onClick={onClose} className="text-slate-500 hover:text-white">
            <X size={18} />
          </button>
        </div>

        <pre className="flex-1 overflow-auto whitespace-pre-wrap bg-[#1f2034] p-5 font-mono text-[15px] leading-6 text-slate-200">
          {lines.join("")}
        </pre>

        <form onSubmit={submitCommand} className="flex items-center gap-2 border-t border-slate-700/70 bg-[#1f2034] px-5 py-4 font-mono">
          <span className="text-slate-200">{connected ? prompt : "..."}</span>
          <input
            value={command}
            onChange={(event) => setCommand(event.target.value)}
            className="min-w-0 flex-1 bg-transparent text-slate-100 outline-none"
            autoFocus
            spellCheck={false}
            disabled={!connected}
          />
          <button type="submit" className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white disabled:bg-slate-700" disabled={!connected}>
            Run
          </button>
        </form>
      </div>
    </div>
  );
}

function getPrompt(device) {
  if (device.type === "router") return "R1#";
  if (device.type === "firewall") return "FW1#";
  if (device.name?.startsWith("core")) return "CORE1#";
  if (device.name?.startsWith("dist")) return "DIST1#";
  return "SW1#";
}

function EditDeviceModal({ device, onClose }) {
  const [form, setForm] = useState({
    sshPort: "22",
    username: "admin",
    authMethod: "password",
    password: "",
    enablePassword: "",
    interfaceName: "GigabitEthernet1/0/1",
    vlanId: "10",
    managementIp: device.ip,
    subnetMask: "255.255.255.0",
    gateway: "",
    snmpCommunity: "",
    syslogServer: "",
    ntpServer: "",
    notes: "",
  });
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  const handleChange = (event) => {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setStatus("");
    setError("");

    try {
      const result = await saveDeviceConfiguration(device.id, form);
      setStatus(result.message);
    } catch (err) {
      setError(err.response?.data?.detail || "Unable to save configuration.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <form onSubmit={handleSubmit} className="max-h-[calc(100vh-32px)] w-full max-w-4xl overflow-auto rounded-2xl border border-slate-700 bg-[#0F172A] shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-800 p-5">
          <div>
            <h2 className="text-white text-base font-bold">Edit {device.name}</h2>
            <p className="mt-1 text-xs font-mono text-slate-500">{device.ip}</p>
          </div>
          <button type="button" onClick={onClose} className="text-slate-500 hover:text-white">
            <X size={18} />
          </button>
        </div>

        <div className="grid gap-4 p-5 md:grid-cols-2">
          <ConfigSection icon={KeyRound} title="SSH Access">
            <div className="grid gap-3 sm:grid-cols-2">
              <ConfigField label="SSH Port"><input name="sshPort" value={form.sshPort} onChange={handleChange} /></ConfigField>
              <ConfigField label="Username"><input name="username" value={form.username} onChange={handleChange} /></ConfigField>
            </div>
            <ConfigField label="Authentication">
              <select name="authMethod" value={form.authMethod} onChange={handleChange}>
                <option value="password">Password</option>
                <option value="key">SSH Key</option>
              </select>
            </ConfigField>
            <div className="grid gap-3 sm:grid-cols-2">
              <ConfigField label="Password"><input name="password" type="password" value={form.password} onChange={handleChange} /></ConfigField>
              <ConfigField label="Enable Secret"><input name="enablePassword" type="password" value={form.enablePassword} onChange={handleChange} /></ConfigField>
            </div>
          </ConfigSection>

          <ConfigSection icon={Cable} title="Interface & VLAN">
            <div className="grid gap-3 sm:grid-cols-2">
              <ConfigField label="Interface"><input name="interfaceName" value={form.interfaceName} onChange={handleChange} /></ConfigField>
              <ConfigField label="VLAN ID"><input name="vlanId" value={form.vlanId} onChange={handleChange} /></ConfigField>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <ConfigField label="Management IP"><input name="managementIp" value={form.managementIp} onChange={handleChange} /></ConfigField>
              <ConfigField label="Subnet Mask"><input name="subnetMask" value={form.subnetMask} onChange={handleChange} /></ConfigField>
            </div>
            <ConfigField label="Default Gateway"><input name="gateway" value={form.gateway} onChange={handleChange} /></ConfigField>
          </ConfigSection>

          <ConfigSection icon={Shield} title="Services" className="md:col-span-2">
            <div className="grid gap-3 sm:grid-cols-3">
              <ConfigField label="SNMP Community"><input name="snmpCommunity" value={form.snmpCommunity} onChange={handleChange} /></ConfigField>
              <ConfigField label="Syslog Server"><input name="syslogServer" value={form.syslogServer} onChange={handleChange} /></ConfigField>
              <ConfigField label="NTP Server"><input name="ntpServer" value={form.ntpServer} onChange={handleChange} /></ConfigField>
            </div>
            <ConfigField label="Change Notes"><textarea name="notes" value={form.notes} onChange={handleChange} /></ConfigField>
          </ConfigSection>
        </div>

        {(error || status) && (
          <div className="px-5 pb-2">
            {error && <p className="rounded-xl bg-rose-500/10 px-4 py-3 text-sm font-semibold text-rose-400">{error}</p>}
            {status && <p className="rounded-xl bg-emerald-500/10 px-4 py-3 text-sm font-semibold text-emerald-400">{status}</p>}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 border-t border-slate-800 p-5">
          <button type="button" onClick={onClose} className="rounded-xl bg-slate-800 text-white py-2.5 text-sm font-bold">
            Cancel
          </button>
          <button type="submit" className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white py-2.5 text-sm font-bold">
            <Save size={15} /> Save Edits
          </button>
        </div>
      </form>
    </div>
  );
}

function ConfigSection({ icon: Icon, title, className = "", children }) {
  return (
    <section className={`rounded-2xl border border-slate-800 bg-slate-900/50 p-4 ${className}`}>
      <h3 className="mb-4 flex items-center gap-2 text-sm font-bold text-slate-100">
        <Icon size={15} />
        {title}
      </h3>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function ConfigField({ label, children }) {
  return (
    <label className="block text-[11px] font-bold uppercase tracking-wide text-slate-500">
      <span>{label}</span>
      <div className="mt-1 [&_input]:w-full [&_select]:w-full [&_textarea]:w-full [&_input]:rounded-lg [&_select]:rounded-lg [&_textarea]:rounded-lg [&_input]:border [&_select]:border [&_textarea]:border [&_input]:border-slate-700 [&_select]:border-slate-700 [&_textarea]:border-slate-700 [&_input]:bg-[#172337] [&_select]:bg-[#172337] [&_textarea]:bg-[#172337] [&_input]:px-3 [&_select]:px-3 [&_textarea]:px-3 [&_input]:py-2.5 [&_select]:py-2.5 [&_textarea]:py-2.5 [&_input]:text-sm [&_select]:text-sm [&_textarea]:text-sm [&_input]:normal-case [&_select]:normal-case [&_textarea]:normal-case [&_input]:tracking-normal [&_select]:tracking-normal [&_textarea]:tracking-normal [&_input]:text-slate-200 [&_select]:text-slate-200 [&_textarea]:text-slate-200 [&_input]:outline-none [&_select]:outline-none [&_textarea]:outline-none focus-within:[&_input]:border-blue-500 focus-within:[&_select]:border-blue-500 focus-within:[&_textarea]:border-blue-500 [&_textarea]:min-h-20">
        {children}
      </div>
    </label>
  );
}
