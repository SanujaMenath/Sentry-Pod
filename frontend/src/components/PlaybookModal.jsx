import React, { useState } from "react";
import { X } from "lucide-react";

function PlaybookModal({ mode, playbookData, onClose, onSave }) {
  const [formData, setFormData] = useState({
    name: "",
    engine_type: "Ansible",
    subnet_scope: "",
    pipeline_status: "Draft",
  });

  React.useEffect(() => {
    if (mode === "edit" && playbookData) {
      setFormData({
        name: playbookData.name || "",
        engine_type: playbookData.engine_type || "Ansible",
        subnet_scope: playbookData.subnet_scope || "",
        pipeline_status: playbookData.pipeline_status || "Draft",
      });
    }
  }, [mode, playbookData]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div 
        className="w-full max-w-md rounded-3xl border border-slate-700/30 shadow-[0_5px_15px_rgba(0,0,0,0.6)] overflow-hidden"
        style={{ backgroundColor: "#1D293DED", fontFamily: '"Inter", sans-serif' }}
      >
        {/* Modal Header */}
        <div className="px-6 py-5 border-b border-slate-800/50 flex items-center justify-between">
          <h4 className="text-sm font-bold text-slate-200">
            {mode === "edit" ? "Modify Playbook Properties" : "Register Automated Blueprint"}
          </h4>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-white p-1">
            <X size={16} />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div className="space-y-1.5">
            <label className="text-[11px] text-slate-400 font-bold uppercase tracking-widest block">
                 Upload Playbook File Blueprint
             </label>
        <div className="relative w-full bg-[#111827]/80 border border-slate-800 rounded-xl px-4 py-2.5 flex items-center justify-between">
             <span className="text-sm text-slate-400 truncate max-w-55">
                {formData.name || "No file selected..."}
            </span>
        <label className="bg-slate-800 hover:bg-slate-700 text-white text-[11px] font-bold px-3 py-1.5 rounded-lg cursor-pointer transition-colors">
             Browse
                  <input
                         type="file"
                         required={mode !== "edit"}
                         className="hidden"
                         onChange={(e) => {
                             const file = e.target.files[0];
                             if (file) {
                             setFormData({ ...formData, name: file.name });
                                  }
                              }}
                          />
                 </label>
            </div>
        </div>

          <div className="space-y-1.5">
            <label className="text-[11px] text-slate-400 font-bold uppercase tracking-widest block">Automation Engine</label>
            <select
              value={formData.engine_type}
              onChange={(e) => setFormData({ ...formData, engine_type: e.target.value })}
              className="w-full text-sm bg-[#111827]/80 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-200 focus:outline-none focus:border-blue-500"
            >
              <option value="Ansible">Ansible (YAML)</option>
              <option value="Puppet">Puppet Equivalents(.pp)</option>
              <option value="Chef">Chef Equivalents(.rb)</option>
              <option value="Python">Python Utility (.py)</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] text-slate-400 font-bold uppercase tracking-widest block">Target Scope Group</label>
            <input
              type="text"
              placeholder="e.g., Access-Switches"
              value={formData.subnet_scope}
              onChange={(e) => setFormData({ ...formData, subnet_scope: e.target.value })}
              className="w-full text-sm bg-[#111827]/80 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] text-slate-400 font-bold uppercase tracking-widest block">Pipeline Status</label>
            <select
              value={formData.pipeline_status}
              onChange={(e) => setFormData({ ...formData, pipeline_status: e.target.value })}
              className="w-full text-sm bg-[#111827]/80 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-200 focus:outline-none focus:border-blue-500"
            >
              <option value="Draft">Draft (Restricted Execution)</option>
              <option value="Verified">Verified (Production Ready)</option>
              <option value="Failed">Failed (Error State)</option>
            </select>
          </div>

          {/* Modal Buttons */}
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
