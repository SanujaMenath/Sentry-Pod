import { useEffect, useState } from "react";
import { X, Save, Tag, Network, Server, Lock, KeyRound, Layers } from "lucide-react";
import { updateNetworkDevice, saveDeviceConfiguration } from "../services/networkService";
import api from "../services/api";

function Field({ icon: Icon, label, children }) {
  return (
    <label className="block">
      <span className="block text-xs text-slate-400 mb-1.5 font-semibold">{label}</span>
      <div className="relative">
        <Icon size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
        <div className="[&_input]:w-full [&_select]:w-full [&_input]:bg-[#172337] [&_select]:bg-[#172337] [&_input]:border [&_select]:border [&_input]:border-slate-700 [&_select]:border-slate-700 [&_input]:rounded-lg [&_select]:rounded-lg [&_input]:pl-9 [&_select]:pl-9 [&_input]:pr-3 [&_select]:pr-3 [&_input]:py-2.5 [&_select]:py-2.5 [&_input]:text-sm [&_select]:text-sm [&_input]:text-slate-200 [&_select]:text-slate-200 [&_input]:outline-none [&_select]:outline-none focus-within:[&_input]:border-blue-500 focus-within:[&_select]:border-blue-500">
          {children}
        </div>
      </div>
    </label>
  );
}

const DEFAULT_SSH = {
  sshPort: "22",
  username: "admin",
  password: "",
  enablePassword: "",
};

export default function EditDeviceModal({ device, onClose, onSaved }) {
  const [meta, setMeta] = useState({
    name: device.name || "",
    ip: device.ip || "",
    type: device.type || "switch",
    label: device.label || "",
    layer: device.layer || "access",
  });
  const [ssh, setSsh] = useState(DEFAULT_SSH);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    api.get(`/api/network/devices/${device.id}/configuration`)
      .then((res) => {
        const cfg = res.data;
        setSsh({
          sshPort: String(cfg.ssh_port || 22),
          username: cfg.username || "admin",
          password: "",
          enablePassword: "",
        });
      })
      .catch(() => {
        // No saved config — use defaults
      });
  }, [device.id]);

  const handleMetaChange = (e) => {
    setMeta((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSshChange = (e) => {
    setSsh((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setStatus("");
    setError("");

    try {
      await updateNetworkDevice(device.id, {
        name: meta.name || undefined,
        ip: meta.ip || undefined,
        type: meta.type || undefined,
        label: meta.label || undefined,
        layer: meta.layer || undefined,
      });

      await saveDeviceConfiguration(device.id, {
        sshPort: ssh.sshPort || "22",
        username: ssh.username || "admin",
        authMethod: "password",
        password: ssh.password || undefined,
        enablePassword: ssh.enablePassword || undefined,
        interfaceName: "GigabitEthernet1/0/1",
        vlanId: "10",
        managementIp: meta.ip || device.ip,
        subnetMask: "255.255.255.0",
        gateway: "",
        snmpCommunity: "",
        syslogServer: "",
        ntpServer: "",
        notes: "",
      });

      setStatus("Device saved successfully");
      setTimeout(() => {
        onSaved?.();
        onClose();
      }, 800);
    } catch (err) {
      setError(err.response?.data?.detail || "Unable to save changes.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <form onSubmit={handleSubmit} className="w-full max-w-lg rounded-2xl border border-slate-700 bg-[#0F172A] shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-800 p-5">
          <div>
            <h2 className="text-white text-base font-bold">Edit {device.name}</h2>
            <p className="mt-1 text-xs font-mono text-slate-500">{device.ip}</p>
          </div>
          <button type="button" onClick={onClose} className="text-slate-500 hover:text-white">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-5 p-5">
          <div>
            <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">Device Info</h3>
            <div className="space-y-3">
              <Field icon={Tag} label="Hostname">
                <input name="name" value={meta.name} onChange={handleMetaChange} placeholder="core-sw-01" />
              </Field>
              <Field icon={Network} label="IP Address">
                <input name="ip" value={meta.ip} onChange={handleMetaChange} placeholder="10.0.1.1" />
              </Field>
              <Field icon={Server} label="Device Type">
                <select name="type" value={meta.type} onChange={handleMetaChange}>
                  <option value="switch">Switch</option>
                  <option value="router">Router</option>
                  <option value="firewall">Firewall</option>
                </select>
              </Field>
              <Field icon={Tag} label="Label (nickname)">
                <input name="label" value={meta.label} onChange={handleMetaChange} placeholder="Core Switch 1" />
              </Field>
              <Field icon={Layers} label="Layer">
                <select name="layer" value={meta.layer} onChange={handleMetaChange}>
                  <option value="edge">Edge</option>
                  <option value="core">Core</option>
                  <option value="distribution">Distribution</option>
                  <option value="access">Access</option>
                </select>
              </Field>
            </div>
          </div>

          <hr className="border-slate-800" />

          <div>
            <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">SSH Credentials</h3>
            <div className="space-y-3">
              <Field icon={KeyRound} label="SSH Port">
                <input name="sshPort" value={ssh.sshPort} onChange={handleSshChange} placeholder="22" />
              </Field>
              <Field icon={Lock} label="Username">
                <input name="username" value={ssh.username} onChange={handleSshChange} placeholder="admin" />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field icon={Lock} label="Password">
                  <input name="password" type="password" value={ssh.password} onChange={handleSshChange} placeholder="Leave blank to keep" />
                </Field>
                <Field icon={Lock} label="Enable Secret">
                  <input name="enablePassword" type="password" value={ssh.enablePassword} onChange={handleSshChange} placeholder="Leave blank to keep" />
                </Field>
              </div>
            </div>
          </div>
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
          <button
            type="submit"
            disabled={saving}
            className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white py-2.5 text-sm font-bold disabled:opacity-50"
          >
            <Save size={15} /> {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </form>
    </div>
  );
}
