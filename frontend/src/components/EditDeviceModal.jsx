import { useState } from "react";
import { X, Save, KeyRound, Cable, Shield } from "lucide-react";
import { saveDeviceConfiguration } from "../services/networkService";
import ConfigSection from "./ConfigSection";
import ConfigField from "./ConfigField";

export default function EditDeviceModal({ device, onClose }) {
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
