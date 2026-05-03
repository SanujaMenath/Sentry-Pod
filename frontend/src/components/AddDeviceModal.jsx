import { useState } from "react";
import { Lock, Network, Server, User, X } from "lucide-react";

const initialForm = {
  name: "core-sw-03",
  ip: "10.0.1.3",
  type: "switch",
  username: "admin",
  password: "",
};

export default function AddDeviceModal({ onClose, onSave }) {
  const [form, setForm] = useState(initialForm);

  const handleChange = (event) => {
    setForm({ ...form, [event.target.name]: event.target.value });
  };

  const handleSave = () => {
    onSave({
      id: Date.now(),
      name: form.name || "new-device",
      ip: form.ip || "0.0.0.0",
      status: "online",
      model: form.type === "router" ? "Cisco ISR 4451" : form.type === "firewall" ? "Cisco ASA 5525-X" : "Cisco Catalyst 9300",
      version: "17.6.3",
      uptime: "New",
      cpu: 12,
      memory: 24,
      type: form.type,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-[360px] rounded-2xl bg-[#0F172A] border border-slate-700 shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-slate-800">
          <h2 className="text-white text-base font-bold">Add Network Device</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-white">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <Field icon={Server} label="Hostname">
            <input name="name" value={form.name} onChange={handleChange} placeholder="core-sw-03" />
          </Field>

          <Field icon={Network} label="IP Address">
            <input name="ip" value={form.ip} onChange={handleChange} placeholder="10.0.1.3" />
          </Field>

          <Field icon={Server} label="Device Type">
            <select name="type" value={form.type} onChange={handleChange}>
              <option value="switch">Switch</option>
              <option value="router">Router</option>
              <option value="firewall">Firewall</option>
            </select>
          </Field>

          <Field icon={User} label="SSH Username">
            <input name="username" value={form.username} onChange={handleChange} placeholder="admin" />
          </Field>

          <Field icon={Lock} label="SSH Password">
            <input name="password" value={form.password} onChange={handleChange} type="password" placeholder="••••••••" />
          </Field>

          <button className="w-full rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-sm font-bold py-2.5">
            Test Connection
          </button>

          <div className="grid grid-cols-2 gap-3 pt-2">
            <button onClick={onClose} className="rounded-xl bg-slate-800 text-white py-2.5 text-sm font-bold">
              Cancel
            </button>
            <button onClick={handleSave} className="rounded-xl bg-blue-600 hover:bg-blue-500 text-white py-2.5 text-sm font-bold">
              Save Device
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ icon: Icon, label, children }) {
  return (
    <label className="block">
      <span className="block text-xs text-slate-400 mb-1.5">{label}</span>
      <div className="relative">
        <Icon size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
        <div className="[&_input]:w-full [&_select]:w-full [&_input]:bg-[#172337] [&_select]:bg-[#172337] [&_input]:border [&_select]:border [&_input]:border-slate-700 [&_select]:border-slate-700 [&_input]:rounded-lg [&_select]:rounded-lg [&_input]:pl-9 [&_select]:pl-9 [&_input]:pr-3 [&_select]:pr-3 [&_input]:py-2.5 [&_select]:py-2.5 [&_input]:text-sm [&_select]:text-sm [&_input]:text-slate-200 [&_select]:text-slate-200 [&_input]:outline-none [&_select]:outline-none focus-within:[&_input]:border-blue-500 focus-within:[&_select]:border-blue-500">
          {children}
        </div>
      </div>
    </label>
  );
}
