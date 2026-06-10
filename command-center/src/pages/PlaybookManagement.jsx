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

import { 
  getPlaybookDashboardData, 
  addPlaybook, 
  deletePlaybook,
  executePlaybook 
} from "../services/inventoryService";

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

// ==========================================
// 2. MAIN MANAGEMENT PAGE LAYOUT COMPONENT
// ==========================================
export default function PlaybookManagement() {
  const { search } = useOutletContext() || { search: "" }; 

 // Initialize with an empty structure that matches your FastAPI backend template
  const [dashboardMetrics, setDashboardMetrics] = useState({
    total_playbooks: 0,
    verified_pipeline: 0,
    failed_run_alerts: 0,
    draft_tasks: 0,
    blueprints: []
  });

  // Track if the page is still waiting to receive data from the database
  const [loading, setLoading] = useState(true);

  const [modalConfig, setModalConfig] = useState({ show: false, mode: "add", data: null });
  const [systemAlert, setSystemAlert] = useState(null);
  const [runningStates, setRunningStates] = useState({});

  // 1. Core synchronization hook to fetch fresh metrics from the database
  const fetchMetrics = async () => {
    try {
      const data = await getPlaybookDashboardData();
      setDashboardMetrics(data);
    } catch (err) {
      console.error("Dashboard failed to sync with control server:", err);
      setSystemAlert({ type: "error", text: "Unable to establish live link with control center API endpoints." });
    } finally {
      setLoading(false);
    }
  };

  // 2. Fetch metrics on initial lifecycle render load
  React.useEffect(() => {
    fetchMetrics();
  }, []);

  // 3. Simulated execution deployment action
  const handleRunPlaybook = (id, name) => {
    setSystemAlert(null);
    setRunningStates((prev) => ({ ...prev, [id]: true }));

    setTimeout(() => {
      setRunningStates((prev) => ({ ...prev, [id]: false }));
      setDashboardMetrics((prev) => ({
        ...prev,
        blueprints: prev.blueprints.map((pb) =>
          (pb.id === id || pb._id === id) ? { ...pb, last_run: new Date().toISOString(), pipeline_status: "Verified", status: "Verified" } : pb
        )
      }));
      setSystemAlert({
        type: "success",
        text: `Orchestration playbook "${name}" successfully deployed to network layer.`,
      });
    }, 1500);
  };

  // 4. Delete playbooks configuration wrapper layout
  const handleDeletePlaybook = async (id, name) => {
  
    if (!window.confirm(`Are you sure you want to permanently delete "${name}"?`)) return;
    
    try {

      await deletePlaybook(id); 
      
      setSystemAlert({ type: "success", text: `Configuration entry "${name}" dropped successfully.` });
      

      fetchMetrics(); 
    } catch (err) {
      console.error("Deletion transaction dropped:", err);
      setSystemAlert({ type: "error", text: `Failed to remove playbook from database layer.` });
    }
  };


  const handleSavePlaybook = async (formData) => {
    try {
      if (modalConfig.mode === "edit") {
        setSystemAlert({ type: "success", text: `Changes applied to "${formData.name}".` });
      } else {

        await addPlaybook({
          name: formData.name,
          engine_type: formData.engine_type,
          subnet_scope: formData.subnet_scope,
          pipeline_status: formData.pipeline_status
        });
        
        setSystemAlert({ 
          type: "success", 
          text: `Successfully committed blueprint "${formData.name}" to MongoDB database environment cluster.` 
        });
      }
      setModalConfig({ show: false, mode: "add", data: null });
      fetchMetrics(); 
    } catch (err) {
      console.error("Failed to commit asset entry:", err);
      setSystemAlert({ type: "error", text: `Asset commit validation error: ${err.message || err}` });
    }
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

  const filteredPlaybooks = (dashboardMetrics.blueprints || []).filter((pb) => {
    const query = search ? search.toLowerCase() : "";
    const nameVal = pb.name || "";
    const engineVal = pb.engine_type || pb.type || "";
    const scopeVal = pb.subnet_scope || pb.target_scope || "";
    const statusVal = pb.pipeline_status || pb.status || "";

    return (
      nameVal.toLowerCase().includes(query) ||
      engineVal.toLowerCase().includes(query) ||
      scopeVal.toLowerCase().includes(query) ||
      statusVal.toLowerCase().includes(query)
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
            <div className="shadow-[0_5px_15px_rgba(0,0,0,0.6)] rounded-3xl">
              <StatCard title="Total Playbooks" value={String(dashboardMetrics.total_playbooks)} subValue="From manifests" icon={FileCode} iconBg="bg-blue-600/20" iconColor="text-blue-400" />
            </div>
            <div className="shadow-[0_5px_15px_rgba(0,0,0,0.6)] rounded-3xl">
              <StatCard title="Verified Pipeline" value={String(dashboardMetrics.verified_pipeline)} subValue="Deploy ready states" icon={CheckCircle2} iconBg="bg-emerald-600/20" iconColor="text-emerald-400" />
            </div>
            <div className="shadow-[0_5px_15px_rgba(0,0,0,0.6)] rounded-3xl">
              <StatCard title="Failed Run Alerts" value={String(dashboardMetrics.failed_run_alerts)} subValue="Requires rebuilds" icon={AlertTriangle} iconBg="bg-rose-600/20" iconColor="text-rose-400" />
            </div>
            <div className="shadow-[0_5px_15px_rgba(0,0,0,0.6)] rounded-3xl">
              <StatCard title="Draft Tasks" value={String(dashboardMetrics.draft_tasks)} subValue="In development workspace" icon={FileCode} iconBg="bg-slate-600/20" iconColor="text-slate-400" />
            </div>
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
                  {filteredPlaybooks.map((playbook) => {
                    const currentEngine = playbook.engine_type || playbook.type || "Ansible";
                    const currentScope = playbook.subnet_scope || playbook.target_scope || "global-all";
                    const currentStatus = playbook.pipeline_status || playbook.status || "Draft";
                    const rowId = playbook.id || playbook._id || `pb-${Math.random()}`;

                    return (
                      <tr key={rowId} className="border-b border-slate-800/30 hover:bg-slate-800/20 transition-colors last:border-0">
                        <td className="py-4 font-bold text-slate-200">
                          <div className="flex items-center gap-2">
                            <FileCode size={16} className="text-blue-400" />
                            <span>{playbook.name}</span>
                          </div>
                        </td>

                        <td className="py-4 text-slate-400 font-medium">{currentEngine}</td>
                        <td className="py-4 text-slate-400 font-mono text-xs">{currentScope}</td>
                        
                        <td className="py-4">
                          <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-lg border ${
                            currentStatus === "Verified" ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" : currentStatus === "Draft" ? "bg-slate-500/10 border-slate-700/30 text-slate-400" : "bg-rose-500/10 border-rose-500/20 text-rose-400"
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${currentStatus === "Verified" ? "bg-emerald-500" : currentStatus === "Draft" ? "bg-slate-400" : "bg-rose-500"}`} />
                            <span className="text-[11px] font-bold capitalize">{currentStatus}</span>
                          </div>
                        </td>

                        <td className="py-4 text-slate-500 font-medium">
                          {playbook.last_run ? `${new Date(playbook.last_run).toLocaleDateString()} at ${new Date(playbook.last_run).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : "Never Executed"}
                        </td>

                        <td className="py-4 text-right pr-4">
                          <div className="inline-flex items-center gap-3">
                            <button
                              type="button"
                              onClick={() => handleRunPlaybook(rowId, playbook.name)}
                              disabled={runningStates[rowId] || currentStatus === "Draft"}
                              className="bg-[#10B981]/10 border border-[#10B981]/30 hover:bg-[#10B981]/20 text-[#10B981] px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 disabled:opacity-30 disabled:cursor-not-allowed active:scale-95"
                            >
                              {runningStates[rowId] ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
                              Run
                            </button>
                            
                            <button 
                              type="button" 
                              onClick={() => setModalConfig({ show: true, mode: "edit", data: playbook })} 
                              className="bg-blue-500/10 border border-blue-500/30 text-blue-400 p-2 rounded-xl transition-all active:scale-95"
                            >
                              <Edit3 size={13} />
                            </button>
                            
                            <button 
                              type="button" 
                              onClick={() => handleDeletePlaybook(rowId, playbook.name)} 
                              className="bg-rose-500/10 border border-rose-500/30 text-rose-400 p-2 rounded-xl transition-all active:scale-95"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
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