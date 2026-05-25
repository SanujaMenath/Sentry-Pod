import React, { useState } from "react";
import { useOutletContext } from "react-router-dom";
import {
  FileCode,
  Plus,
  Loader2,
  Play,
  Edit3,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  X,
} from "lucide-react";
import StatCard from "../components/StatCard";
import PageHeader from "../components/PageHeader";

// ==========================================
// 1. POPUP WINDOW FORM COMPONENT (Inlined)
// ==========================================
function PlaybookModal({ mode, playbookData, onClose, onSave }) {
  const [formData, setFormData] = useState({
    name: "",
    type: "Ansible",
    target_scope: "",
    status: "Draft",
  });

  React.useEffect(() => {
    if (mode === "edit" && playbookData) {
      setFormData({
        name: playbookData.name || "",
        type: playbookData.type || "Ansible",
        target_scope: playbookData.target_scope || "",
        status: playbookData.status || "Draft",
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
             <span className="text-sm text-slate-400 truncate max-w-[220px]">
                {formData.name || "No file selected..."}
            </span>
        <label className="bg-slate-800 hover:bg-slate-700 text-white text-[11px] font-bold px-3 py-1.5 rounded-lg cursor-pointer transition-colors">
             Browse
                 <input
                        type="file"
                        required={mode !== "edit"} // Only required for new playbooks
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
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value })}
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
              value={formData.target_scope}
              onChange={(e) => setFormData({ ...formData, target_scope: e.target.value })}
              className="w-full text-sm bg-[#111827]/80 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] text-slate-400 font-bold uppercase tracking-widest block">Pipeline Status</label>
            <select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value })}
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

// ==========================================
// 2. MAIN MANAGEMENT PAGE LAYOUT COMPONENT
// ==========================================
export default function PlaybookManagement() {
  const { search } = useOutletContext() || { search: "" }; 

  const [playbooksList, setPlaybooksList] = useState([
    { id: "pb-1", name: "Cisco_IOS_Hardening.yml", type: "Ansible", status: "Verified", last_run: "2026-05-22T14:30:00Z", target_scope: "Core-Routers" },
    { id: "pb-2", name: "AWS_VPC_Teardown.tf", type: "Puppet", status: "Draft", last_run: null, target_scope: "Staging-Env" },
    { id: "pb-3", name: "Nvidia_Driver_Patch.sh", type: "Chef", status: "Failed", last_run: "2026-05-20T08:15:00Z", target_scope: "GPU-Cluster" },
    { id: "pb-4", name: "BGP_Route_Flap_Mitigation.py", type: "Python", status: "Verified", last_run: "2026-05-23T10:00:00Z", target_scope: "Edge-Gateways" },
  ]);

  const [modalConfig, setModalConfig] = useState({ show: false, mode: "add", data: null });
  const [systemAlert, setSystemAlert] = useState(null);
  const [runningStates, setRunningStates] = useState({});

  const handleRunPlaybook = (id, name) => {
    setSystemAlert(null);
    setRunningStates((prev) => ({ ...prev, [id]: true }));

    setTimeout(() => {
      setRunningStates((prev) => ({ ...prev, [id]: false }));
      setPlaybooksList((prevList) =>
        prevList.map((pb) =>
          pb.id === id ? { ...pb, last_run: new Date().toISOString(), status: "Verified" } : pb
        )
      );
      setSystemAlert({
        type: "success",
        text: `Orchestration playbook "${name}" successfully deployed to network layer.`,
      });
    }, 1500);
  };

  const handleDeletePlaybook = (id, name) => {
    if (!window.confirm(`Are you sure you want to permanently delete "${name}"?`)) return;
    setPlaybooksList((prev) => prev.filter((pb) => pb.id !== id));
    setSystemAlert({ type: "success", text: `Configuration entry "${name}" dropped successfully.` });
  };

  const handleSavePlaybook = (formData) => {
    if (modalConfig.mode === "edit") {
      setPlaybooksList((prev) =>
        prev.map((pb) => (pb.id === modalConfig.data.id ? { ...pb, ...formData } : pb))
      );
    } else {
      setPlaybooksList((prev) => [...prev, { id: `pb-${Date.now()}`, ...formData, last_run: null }]);
    }
    setSystemAlert({ type: "success", text: `Changes applied to "${formData.name}".` });
    setModalConfig({ show: false, mode: "add", data: null });
  };

  const styles = {
    main: {
      background: "linear-gradient(135deg, #F8FAFC 0%, #D1D5DB 100%)",
      backgroundAttachment: "fixed",
      fontFamily: '"Inter", sans-serif',
    },
    card: { backgroundColor: "#1D293DED", fontFamily: '"Inter", sans-serif' },
    headline: { color: "#0F172A", fontSize: "30px", fontWeight: "800", letterSpacing: "-0.025em" },
    subtext: { color: "#475569", fontSize: "16px", fontWeight: "500" },
  };

  const filteredPlaybooks = playbooksList.filter((pb) => {
    const query = search ? search.toLowerCase() : "";
    return (
      pb.name?.toLowerCase().includes(query) ||
      pb.type?.toLowerCase().includes(query) ||
      pb.target_scope?.toLowerCase().includes(query) ||
      pb.status?.toLowerCase().includes(query)
    );
  });

  return (
    <div className="flex min-h-screen" style={styles.main}>
      <main className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto p-8 space-y-8">
          
          {/* Header */}
          <div className="flex items-start justify-between">
            <PageHeader 
                title="Playbook Management" 
                description="Network automated configurations and core code blueprints" 
                isSmallSubtext={true}
            />
            <button
              type="button"
              onClick={() => setModalConfig({ show: true, mode: "add", data: null })}
              className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all active:scale-95 shadow-[0_4px_12px_rgba(37,99,235,0.3)]"
            >
              <Plus size={16} /> Add New Playbook
            </button>
          </div>

          {/* Feedback Alerts Banner */}
          {systemAlert && (
            <div className={`p-4 text-xs font-semibold rounded-2xl border flex items-center justify-between animate-in fade-in duration-200 ${
              systemAlert.type === "error" ? "bg-rose-500/10 border-rose-500/20 text-rose-400" : "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
            }`}>
              <div className="flex items-center gap-2">
                <CheckCircle2 size={16} />
                <span>{systemAlert.text}</span>
              </div>
              <button onClick={() => setSystemAlert(null)} className="opacity-60 hover:opacity-100 p-1">
                <X size={14} />
              </button>
            </div>
          )}

          {/* Dynamic Calculated Cards Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="shadow-[0_5px_15px_rgba(0,0,0,0.6)] rounded-3xl"><StatCard title="Total Playbooks" value={String(playbooksList.length)} subValue="From manifests" icon={FileCode} iconBg="bg-blue-600/20" iconColor="text-blue-400" /></div>
            <div className="shadow-[0_5px_15px_rgba(0,0,0,0.6)] rounded-3xl"><StatCard title="Verified Pipeline" value={String(playbooksList.filter(p => p.status === "Verified").length)} subValue="Deploy ready states" icon={CheckCircle2} iconBg="bg-emerald-600/20" iconColor="text-emerald-400" /></div>
            <div className="shadow-[0_5px_15px_rgba(0,0,0,0.6)] rounded-3xl"><StatCard title="Failed Run Alerts" value={String(playbooksList.filter(p => p.status === "Failed").length)} subValue="Requires rebuilds" icon={AlertTriangle} iconBg="bg-rose-600/20" iconColor="text-rose-400" /></div>
            <div className="shadow-[0_5px_15px_rgba(0,0,0,0.6)] rounded-3xl"><StatCard title="Draft Tasks" value={String(playbooksList.filter(p => p.status === "Draft").length)} subValue="In development workspace" icon={FileCode} iconBg="bg-slate-600/20" iconColor="text-slate-400" /></div>
            </div>

          {/* Data Table View Box */}
          <div className="rounded-3xl border border-slate-700/30 shadow-[0_5px_15px_rgba(0,0,0,0.6)] overflow-hidden" style={styles.card}>
            <div className="p-6 border-b border-slate-800/50">
              <h4 className="text-sm font-medium text-slate-300">Active Automated Blueprints</h4>
            </div>
            
            <div className="overflow-x-auto px-6 pb-6">
              <table className="w-full text-left">
                <thead className="text-slate-500 text-[12px] font-medium border-b border-slate-800/30">
                  <tr>
                    <th className="py-5 font-normal">Playbook Manifest</th>
                    <th className="py-5 font-normal">Engine Type</th>
                    <th className="py-5 font-normal">Subnet Target Scope</th>
                    <th className="py-5 font-normal">Pipeline Status</th>
                    <th className="py-5 font-normal">Last Executed</th>
                    <th className="py-5 font-normal text-right pr-4">Actions</th>
                  </tr>
                </thead>
                <tbody className="text-[13px]">
                  {filteredPlaybooks.map((playbook) => (
                    <tr key={playbook.id} className="border-b border-slate-800/30 hover:bg-slate-800/20 transition-colors last:border-0">
                      {/* 1. Playbook Name */}
                      <td className="py-4 font-bold text-slate-200">
                        <div className="flex items-center gap-2">
                          <FileCode size={16} className="text-blue-400" />
                          <span>{playbook.name}</span>
                        </div>
                      </td>

                      {/* 2. Engine Type */}
                      <td className="py-4 text-slate-400 font-medium">{playbook.type}</td>
                      
                      {/* 3. Subnet Target Scope */}
                      <td className="py-4 text-slate-400 font-mono text-xs">{playbook.target_scope || "global-all"}</td>
                      
                      {/* 4. Pipeline Status Badge */}
                      <td className="py-4">
                        <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-lg border ${
                          playbook.status === "Verified" ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" : playbook.status === "Draft" ? "bg-slate-500/10 border-slate-700/30 text-slate-400" : "bg-rose-500/10 border-rose-500/20 text-rose-400"
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${playbook.status === "Verified" ? "bg-emerald-500" : playbook.status === "Draft" ? "bg-slate-400" : "bg-rose-500"}`} />
                          <span className="text-[11px] font-bold capitalize">{playbook.status}</span>
                        </div>
                      </td>

                      {/* 5. Last Executed Date */}
                      <td className="py-4 text-slate-500 font-medium">
                        {playbook.last_run ? `${new Date(playbook.last_run).toLocaleDateString()} at ${new Date(playbook.last_run).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : "Never Executed"}
                      </td>

                      {/* 6. Action Buttons */}
                      <td className="py-4 text-right pr-4">
                        <div className="inline-flex items-center gap-3">
                          
                          {/* Run Button */}
                          <button
                            type="button"
                            onClick={() => handleRunPlaybook(playbook.id, playbook.name)}
                            disabled={runningStates[playbook.id] || playbook.status === "Draft"}
                            className="bg-[#10B981]/10 border border-[#10B981]/30 hover:bg-[#10B981]/20 text-[#10B981] px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 disabled:opacity-30 disabled:cursor-not-allowed active:scale-95"
                          >
                            {runningStates[playbook.id] ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
                            Run
                          </button>
                          
                          {/* Edit Button */}
                          <button 
                            type="button" 
                            onClick={() => setModalConfig({ show: true, mode: "edit", data: playbook })} 
                            className="bg-blue-500/10 border border-blue-500/30 text-blue-400 p-2 rounded-xl transition-all active:scale-95"
                          >
                            <Edit3 size={13} />
                          </button>
                          
                          {/* Delete Button */}
                          <button 
                            type="button" 
                            onClick={() => handleDeletePlaybook(playbook.id, playbook.name)} 
                            className="bg-rose-500/10 border border-rose-500/30 text-rose-400 p-2 rounded-xl transition-all active:scale-95"
                          >
                            <Trash2 size={13} />
                          </button>

                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredPlaybooks.length === 0 && (
                    <tr>
                      <td colSpan="6" className="text-center py-12 text-slate-500 text-sm font-semibold">
                        No automation manifests matching search parameters found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>

      {/* Render overlay form inline overlay */}
      {modalConfig.show && (
        <PlaybookModal mode={modalConfig.mode} playbookData={modalConfig.data} onClose={() => setModalConfig({ show: false, mode: "add", data: null })} onSave={handleSavePlaybook} />
      )}
    </div>
  );
}