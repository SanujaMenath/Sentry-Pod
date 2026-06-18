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
import PlaybookModal from "../components/PlaybookModal";

import { 
  getPlaybookDashboardData, 
  addPlaybook, 
  deletePlaybook,
  executePlaybook,
  updatePlaybook,
  updatePlaybookStatus
} from "../services/inventoryService";

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

  // 3. Execute playbook deployment action via real API call
  const handleRunPlaybook = async (id, name) => {
    setSystemAlert(null);
    setRunningStates((prev) => ({ ...prev, [id]: true }));
    try {
      const result = await executePlaybook(name);
      const newStatus = result.status === "success" ? "Verified" : "Failed";
      await updatePlaybookStatus(id, newStatus);
      setSystemAlert({
        type: "success",
        text: `Orchestration playbook "${name}" successfully deployed to network layer.`,
      });
    } catch (err) {
      setSystemAlert({ type: "error", text: `Execution failed for "${name}": ${err.message || err}` });
    } finally {
      setRunningStates((prev) => ({ ...prev, [id]: false }));
      fetchMetrics();
    }
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
        const payload = {
          name: formData.name,
          description: formData.description,
          engine_type: formData.engine_type,
          subnet_scope: formData.subnet_scope || formData.target_devices,
          pipeline_status: formData.pipeline_status,
          tags: formData.tags ? formData.tags.split(",").map(t => t.trim()).filter(Boolean) : [],
          target_devices: formData.target_devices ? formData.target_devices.split(",").map(d => d.trim()).filter(Boolean) : [],
          example_intents: formData.example_intents ? formData.example_intents.split("\n").map(i => i.trim()).filter(Boolean) : [],
          destructive: formData.destructive,
          severity: formData.severity,
        };
        await updatePlaybook(modalConfig.data.id || modalConfig.data._id, payload);
        setSystemAlert({ type: "success", text: `Changes applied to "${formData.name}".` });
      } else {
        const fd = new FormData();
        fd.append("name", formData.name);
        fd.append("description", formData.description);
        fd.append("engine_type", formData.engine_type);
        fd.append("subnet_scope", formData.target_devices || formData.subnet_scope);
        fd.append("pipeline_status", formData.pipeline_status);
        fd.append("tags", formData.tags || "");
        fd.append("target_devices", formData.target_devices || "");
        fd.append("example_intents", formData.example_intents || "");
        fd.append("destructive", formData.destructive ? "true" : "false");
        fd.append("severity", formData.severity);
        if (formData.file) {
          fd.append("file", formData.file);
        }
        await addPlaybook(fd);
        setSystemAlert({ 
          type: "success", 
          text: `Successfully committed blueprint "${formData.name}".` 
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