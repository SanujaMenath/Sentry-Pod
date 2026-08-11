import React, { useState } from "react";
import { X, AlertTriangle } from "lucide-react";

function PlaybookModal({ mode, playbookData, onClose, onSave }) {
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    engine_type: "Ansible",
    subnet_scope: "",
    pipeline_status: "Draft",
    tags: "",
    target_devices: "",
    example_intents: "",
    destructive: false,
    severity: "medium",
    file: null,
  });

  const [errors, setErrors] = useState({});

  React.useEffect(() => {
    if (mode === "edit" && playbookData) {
      setFormData({
        name: playbookData.name || "",
        description: playbookData.description || "",
        engine_type: playbookData.engine_type || "Ansible",
        subnet_scope: playbookData.subnet_scope || "",
        pipeline_status: playbookData.pipeline_status || "Draft",
        tags: Array.isArray(playbookData.tags) ? playbookData.tags.join(", ") : (playbookData.tags || ""),
        target_devices: Array.isArray(playbookData.target_devices) ? playbookData.target_devices.join(", ") : (playbookData.subnet_scope || ""),
        example_intents: Array.isArray(playbookData.example_intents) ? playbookData.example_intents.join("\n") : "",
        destructive: playbookData.destructive || false,
        severity: playbookData.severity || "medium",
        file: null,
      });
    }
  }, [mode, playbookData]);

  const validate = () => {
    const newErrors = {};
    if (!formData.name.trim()) newErrors.name = "Name is required";
    if (!formData.description.trim() && mode === "add") newErrors.description = "Description is required";
    if (!formData.target_devices.trim()) newErrors.subnet_scope = "Target scope is required";
    if (["low", "medium", "high", "critical"].indexOf(formData.severity) === -1) {
      newErrors.severity = "Invalid severity value";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validate()) return;
    onSave(formData);
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (!file.name.endsWith(".yml") && !file.name.endsWith(".yaml")) {
        setErrors((prev) => ({ ...prev, file: "Only .yml and .yaml files are supported" }));
        return;
      }
      setErrors((prev) => ({ ...prev, file: null }));
      setFormData((prev) => ({ ...prev, file, name: file.name }));
    }
  };

  const inputClass = "w-full text-sm bg-[#111827]/80 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500";
  const labelClass = "text-[11px] text-slate-400 font-bold uppercase tracking-widest block";
  const errorClass = "text-[10px] text-rose-400 mt-1";

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div 
        className="w-full max-w-lg rounded-3xl border border-slate-700/30 shadow-[0_5px_15px_rgba(0,0,0,0.6)] overflow-hidden"
        style={{ backgroundColor: "#1D293DED", fontFamily: '"Inter", sans-serif' }}
      >
        <div className="px-6 py-5 border-b border-slate-800/50 flex items-center justify-between">
          <h4 className="text-sm font-bold text-slate-200">
            {mode === "edit" ? "Modify Playbook Properties" : "Register Automated Blueprint"}
          </h4>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-white p-1">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">

          {errors.file && (
            <div className="flex items-center gap-2 text-rose-400 text-xs font-semibold p-2 bg-rose-500/10 rounded-xl">
              <AlertTriangle size={14} /> {errors.file}
            </div>
          )}

          <div className="space-y-1.5">
            <label className={labelClass}>Playbook File <span className="text-rose-400">*</span></label>
            <div className="relative w-full bg-[#111827]/80 border border-slate-800 rounded-xl px-4 py-2.5 flex items-center justify-between">
              <span className="text-sm text-slate-400 truncate max-w-55">
                {formData.file ? formData.file.name : (formData.name || "No file selected...")}
              </span>
              <label className="bg-slate-800 hover:bg-slate-700 text-white text-[11px] font-bold px-3 py-1.5 rounded-lg cursor-pointer transition-colors">
                Browse
                <input
                  type="file"
                  accept=".yml,.yaml"
                  required={mode !== "edit"}
                  className="hidden"
                  onChange={handleFileChange}
                />
              </label>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className={labelClass}>Blueprint Name <span className="text-rose-400">*</span></label>
            <input
              type="text"
              placeholder="e.g., Configure VLANs"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className={`${inputClass} ${errors.name ? "border-rose-500" : ""}`}
            />
            {errors.name && <p className={errorClass}>{errors.name}</p>}
          </div>

          <div className="space-y-1.5">
            <label className={labelClass}>Description {mode === "add" && <span className="text-rose-400">*</span>}</label>
            <textarea
              placeholder="Describe what this playbook does..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
              className={`${inputClass} resize-none ${errors.description ? "border-rose-500" : ""}`}
            />
            {errors.description && <p className={errorClass}>{errors.description}</p>}
          </div>

          <div className="border-t border-slate-800/50 pt-4">
            <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-widest mb-3">Configuration</p>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className={labelClass}>Automation Engine</label>
                <select
                  value={formData.engine_type}
                  onChange={(e) => setFormData({ ...formData, engine_type: e.target.value })}
                  className={inputClass}
                >
                  <option value="Ansible">Ansible (YAML)</option>
                  <option value="Puppet">Puppet Equivalents(.pp)</option>
                  <option value="Chef">Chef Equivalents(.rb)</option>
                  <option value="Python">Python Utility (.py)</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className={labelClass}>Severity</label>
                <select
                  value={formData.severity}
                  onChange={(e) => setFormData({ ...formData, severity: e.target.value })}
                  className={inputClass}
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
                {errors.severity && <p className={errorClass}>{errors.severity}</p>}
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className={labelClass}>Target Scope / Device Groups <span className="text-rose-400">*</span></label>
            <input
              type="text"
              placeholder="e.g., allHosts, Access_Switches, Edge_routers"
              value={formData.target_devices}
              onChange={(e) => setFormData({ ...formData, target_devices: e.target.value })}
              className={`${inputClass} ${errors.subnet_scope ? "border-rose-500" : ""}`}
            />
            {errors.subnet_scope && <p className={errorClass}>{errors.subnet_scope}</p>}
            <p className="text-[10px] text-slate-500">Comma-separated inventory group names</p>
          </div>

          <div className="border-t border-slate-800/50 pt-4">
            <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-widest mb-3">Metadata</p>
            <div className="space-y-1.5">
              <label className={labelClass}>Tags</label>
              <input
                type="text"
                placeholder="e.g., vlan, switching, network, configure"
                value={formData.tags}
                onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                className={inputClass}
              />
              <p className="text-[10px] text-slate-500">Comma-separated keywords for search and suggestions</p>
            </div>
            <div className="space-y-1.5 mt-4">
              <label className={labelClass}>Example Intents</label>
              <textarea
                placeholder="configure vlan&#10;create vlan&#10;set up vlan"
                value={formData.example_intents}
                onChange={(e) => setFormData({ ...formData, example_intents: e.target.value })}
                rows={3}
                className={`${inputClass} resize-none`}
              />
              <p className="text-[10px] text-slate-500">One intent per line for AI matching</p>
            </div>
          </div>

          <div className="border-t border-slate-800/50 pt-4">
            <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-widest mb-3">Pipeline</p>
            <div className="space-y-1.5">
              <label className={labelClass}>Pipeline Status</label>
              <select
                value={formData.pipeline_status}
                onChange={(e) => setFormData({ ...formData, pipeline_status: e.target.value })}
                className={inputClass}
              >
                <option value="Draft">Draft (Restricted Execution)</option>
                <option value="Verified">Verified (Production Ready)</option>
                <option value="Failed">Failed (Error State)</option>
              </select>
            </div>
            <div className="flex items-center gap-3 mt-4">
              <input
                type="checkbox"
                id="destructive"
                checked={formData.destructive}
                onChange={(e) => setFormData({ ...formData, destructive: e.target.checked })}
                className="w-4 h-4 rounded border-slate-700 bg-[#111827] text-blue-600 focus:ring-blue-500"
              />
              <label htmlFor="destructive" className="text-[11px] text-slate-400 font-bold">
                Destructive — modifies device configuration
              </label>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800/50 mt-2">
            <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-200 text-xs font-bold">
              Cancel
            </button>
            <button type="submit" className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2 rounded-xl text-xs font-bold transition-all active:scale-95 shadow-md">
              {mode === "edit" ? "Save Changes" : "Commit Playbook"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default PlaybookModal;
