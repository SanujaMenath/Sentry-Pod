import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Network,
  MessageSquare,
  ShieldAlert,
  Server,
  ClipboardList,
  Users,
  Settings,
  Search,
  Bell,
  CheckCircle2,
  LogOut,
  AlertTriangle,
  X,
  Loader2,
  RefreshCw,
} from "lucide-react";

import logo from "../images/logo.png";
import StatCard from "../components/StatCard";
import DiffViewer from "../components/DiffViewer";
import { getAllHostsDeviceCount } from "../services/inventoryService";
import NetworkTrafficChart from "../components/NetworkTrafficChart";
import PageHeader from "../components/PageHeader";

//  MAIN DASHBOARD
const Dashboard = () => {
  const navigate = useNavigate();

  const [status, setStatus] = useState("pending");
  const [totalDevices, setTotalDevices] = useState("--");
  const [activeDevicesCount, setActiveDevicesCount] = useState(0);
  const [isScanning, setIsScanning] = useState(false);

  const [showNotifications, setShowNotifications] = useState(false);
  const [driftReports, setDriftReports] = useState([]);
  const [isRefreshingDrift, setIsRefreshingDrift] = useState(false);
  const [baselineCount, setBaselineCount] = useState(0);
  const [isRefreshingBaseline, setIsRefreshingBaseline] = useState(false);
  const [isRefreshingGraph, setIsRefreshingGraph] = useState(false);
  const [graphRefreshKey, setGraphRefreshKey] = useState(0);
  const [networkStatus, setNetworkStatus] = useState({ devices: [], online_count: 0, offline_count: 0, degraded_count: 0, total_count: 0, scan_timestamp: null });
  const [isRefreshingNetStatus, setIsRefreshingNetStatus] = useState(false);


  const handleApprove = (e) => {
    e.stopPropagation(); // Stops the card container click from running
    setStatus("deploying");
    setTimeout(() => {
      setStatus("deployed");
    }, 1500);
  };

  const handleReject = (e) => {
    e.stopPropagation(); // Stops the card container click from running
    setStatus("rejected");
  };

  useEffect(() => {
    const fetchAllHostsCount = async () => {
      try {
        const data = await getAllHostsDeviceCount();
        setTotalDevices(String(data.count ?? 0));
      } catch (error) {
        console.error("Failed to load allHosts device count:", error);
        setTotalDevices("0");
      }
    };

    fetchAllHostsCount();
  }, []);

  useEffect(() => {
    const fetchDrift = async () => {
      try {
        const res = await fetch("http://127.0.0.1:8000/playbooks/drift");
        const data = await res.json();
        if (data && data.reports) setDriftReports(data.reports);
      } catch (e) {
        console.error("Failed to load drift reports:", e);
      }
    };

    fetchDrift();
  }, []);

  useEffect(() => {
    const fetchBaseline = async () => {
      try {
        const res = await fetch("http://127.0.0.1:8000/playbooks/baseline");
        const data = await res.json();
        if (data && data.devices) setBaselineCount(data.devices.length);
      } catch (e) {
        console.error("Failed to load baseline count:", e);
      }
    };

    fetchBaseline();
  }, []);

  useEffect(() => {
    const fetchActiveDevices = async () => {
      try {
        const response = await fetch('http://127.0.0.1:8000/api/network/active-devices');
        if (response.ok) {
          const data = await response.json();
          setActiveDevicesCount(data.length || 0);
        }
      } catch (error) {
        console.error('Error fetching active devices:', error);
      }
    };

    fetchActiveDevices();
  }, []);

  useEffect(() => {
    const fetchNetworkStatus = async () => {
      try {
        const res = await fetch('http://127.0.0.1:8000/api/network/device-status');
        if (res.ok) setNetworkStatus(await res.json());
      } catch (e) {
        console.error('Failed to load network status:', e);
      }
    };
    fetchNetworkStatus();
  }, []);

  const handleRefreshDevices = async () => {
    setIsScanning(true);
    try {
      const response = await fetch('http://127.0.0.1:8000/api/network/active-devices/scan', {
        method: 'POST'
      });
      if (response.ok) {
        const result = await response.json();
        setActiveDevicesCount(result.devices_count || 0);
      } else {
        console.error('Scan failed:', response.statusText);
      }
    } catch (error) {
      console.error('Error triggering nmap scan:', error);
    } finally {
      setIsScanning(false);
    }
  };

  const handleRefreshNetStatus = async () => {
    setIsRefreshingNetStatus(true);
    try {
      const res = await fetch('http://127.0.0.1:8000/api/network/device-status/scan', { method: 'POST' });
      if (res.ok) setNetworkStatus(await res.json());
    } catch (e) {
      console.error('Error refreshing network status:', e);
    } finally {
      setIsRefreshingNetStatus(false);
    }
  };

  const handleRefreshDrift = async (e) => {
    if (e) e.stopPropagation();
    setIsRefreshingDrift(true);
    try {
      const response = await fetch('http://127.0.0.1:8000/playbooks/drift/refresh', {
        method: 'POST'
      });
      if (response.ok) {
        const result = await response.json();
        if (result && result.reports) {
          setDriftReports(result.reports);
        }
      } else {
        console.error('Drift refresh failed:', response.statusText);
      }
    } catch (error) {
      console.error('Error triggering drift analysis:', error);
    } finally {
      setIsRefreshingDrift(false);
    }
  };

  const handleRefreshBaseline = async (e) => {
    if (e) e.stopPropagation();
    setIsRefreshingBaseline(true);
    try {
      const response = await fetch('http://127.0.0.1:8000/playbooks/baseline/refresh', {
        method: 'POST'
      });
      if (response.ok) {
        const result = await response.json();
        if (result && result.devices) {
          setBaselineCount(result.devices.length);
        }
      } else {
        console.error('Baseline refresh failed:', response.statusText);
      }
    } catch (error) {
      console.error('Error triggering baseline collection:', error);
    } finally {
      setIsRefreshingBaseline(false);
    }
  };

  const handleRefreshGraph = async () => {
    setIsRefreshingGraph(true);
    try {
      const response = await fetch('http://127.0.0.1:8000/playbooks/baseline-graph/refresh', {
        method: 'POST'
      });
      if (response.ok) {
        // Bump the refresh key so NetworkTrafficChart re-fetches its data
        setGraphRefreshKey((prev) => prev + 1);
      } else {
        console.error('Baseline graph refresh failed:', response.statusText);
      }
    } catch (error) {
      console.error('Error triggering baseline graph refresh:', error);
    } finally {
      setIsRefreshingGraph(false);
    }
  };

  const styles = {
    sidebar: {
      backgroundColor: "#020618ED",
      fontFamily: '"Inter", sans-serif',
    },

    main: {
      background: "linear-gradient(135deg, #F8FAFC 0%, #D1D5DB 100%)",
      backgroundAttachment: "fixed",
      fontFamily: '"Inter", sans-serif',
    },

    card: { backgroundColor: "#1D293DED", fontFamily: '"Inter", sans-serif' },

    headline: {
      color: "#0F172A",
      fontSize: "30px",
      fontWeight: "800",
      fontFamily: '"Inter", sans-serif',
      letterSpacing: "-0.025em",
    },

    subtext: {
      color: "#475569",
      fontSize: "16px",
      fontWeight: "500",
      fontFamily: '"Inter", sans-serif',
    },
  };
  return (
    <div className="flex min-h-screen" style={styles.main}>
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* DASHBOARD CONTENT */}
        <div className="flex-1 overflow-y-auto p-8 space-y-8">
          <PageHeader 
           title="Command Center" 
           description="Network overview and real-time monitoring" 
           />

          {/* ROW STAT CARDS */}
           {/* Total devices */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatCard
              title="Total Devices"
              value={totalDevices}
              subValue="From allHosts inventory"
              icon={Server}
              iconBg="bg-blue-600/20"
              iconColor="text-blue-400"
            />
             {/* Active devices */}
            <div className="bg-[#1D293DED] border border-slate-700/50 rounded-3xl p-6 shadow-[0_5px_15px_rgba(0,0,0,0.6)] overflow-hidden flex flex-col">
              <div className="flex justify-between items-center mb-4">
                <div className="z-10">
                  <p className="text-slate-400 text-sm font-medium mb-2">Active Devices</p>
                  <h3 className="text-4xl font-extrabold text-white drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)] tracking-tight">
                    {isScanning ? "..." : activeDevicesCount}
                  </h3>
                  <p className="text-xs text-slate-500 mt-2 font-medium">via Nmap</p>
                </div>
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center bg-emerald-600/20 text-emerald-400 border border-white/10 shadow-[inset_0_1px_1px_rgba(255,255,255,0.2)]">
                  <CheckCircle2 size={32} strokeWidth={1.5} />
                </div>
              </div>
              <button
                onClick={handleRefreshDevices}
                disabled={isScanning}
                className="flex items-center justify-center gap-2 w-full py-2 px-3 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 text-xs font-bold disabled:opacity-50 transition-all active:scale-95"
              >
                <RefreshCw size={14} className={isScanning ? 'animate-spin' : ''} />
                {isScanning ? 'Scanning...' : 'Refresh'}
              </button>
            </div>
             {/* Config Drift */}
            <div 
              onClick={() => navigate('/drift-reports')}
              className="bg-[#1D293DED] border border-slate-700/50 rounded-3xl p-6 shadow-[0_5px_15px_rgba(0,0,0,0.6)] overflow-hidden flex flex-col cursor-pointer hover:shadow-lg transition-shadow"
            >
              <div className="flex justify-between items-center mb-4">
                <div className="z-10">
                  <p className="text-slate-400 text-sm font-medium mb-2">Configuration Drift Alerts</p>
                  <h3 className="text-4xl font-extrabold text-white drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)] tracking-tight">
                    {isRefreshingDrift ? "..." : String(driftReports.length || 0)}
                  </h3>
                  <p className="text-xs text-slate-500 mt-2 font-medium">
                    {driftReports.length > 0 ? "Updated recently (via Ansible)" : "No drift detected (via Ansible)"}
                  </p>
                </div>
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center bg-[#3E2C23] text-[#EAB308] border border-white/10 shadow-[inset_0_1px_1px_rgba(255,255,255,0.2)]">
                  <ShieldAlert size={32} strokeWidth={1.5} />
                </div>
              </div>
              <button
                onClick={handleRefreshDrift}
                disabled={isRefreshingDrift}
                className="flex items-center justify-center gap-2 w-full py-2 px-3 rounded-lg bg-[#3E2C23] hover:bg-[#4E3C33] text-[#EAB308] text-xs font-bold disabled:opacity-50 transition-all active:scale-95"
              >
                <RefreshCw size={14} className={isRefreshingDrift ? 'animate-spin' : ''} />
                {isRefreshingDrift ? 'Running Drift Analysis...' : 'Refresh'}
              </button>
            </div>
            
            
             {/* Network Baselines */}
            <div 
              className="bg-[#1D293DED] border border-slate-700/50 rounded-3xl p-6 shadow-[0_5px_15px_rgba(0,0,0,0.6)] overflow-hidden flex flex-col"
            >
              <div className="flex justify-between items-center mb-4">
                <div className="z-10">
                  <p className="text-slate-400 text-sm font-medium mb-2">Network Baselines (via Ansible)</p>
                  <h3 className="text-4xl font-extrabold text-white drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)] tracking-tight">
                    {isRefreshingBaseline ? "..." : String(baselineCount)}
                  </h3>
                  <p className="text-xs text-slate-500 mt-2 font-medium">
                    {baselineCount > 0 ? `${baselineCount} devices baselined` : "No devices baselined"}
                  </p>
                </div>
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center bg-cyan-600/20 text-cyan-400 border border-white/10 shadow-[inset_0_1px_1px_rgba(255,255,255,0.2)]">
                  <ClipboardList size={32} strokeWidth={1.5} />
                </div>
              </div>
              <button
                onClick={handleRefreshBaseline}
                disabled={isRefreshingBaseline}
                className="flex items-center justify-center gap-2 w-full py-2 px-3 rounded-lg bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-400 text-xs font-bold disabled:opacity-50 transition-all active:scale-95"
              >
                <RefreshCw size={14} className={isRefreshingBaseline ? 'animate-spin' : ''} />
                {isRefreshingBaseline ? 'Baselining devices...' : 'Refresh'}
              </button>
            </div>
          </div>

          {/* ROW TRAFFIC & AI  */}
          <div className="grid lg:grid-cols-2 gap-6">
         
          {/* Traffic Section */}
            <NetworkTrafficChart
              onRefresh={handleRefreshGraph}
              isRefreshing={isRefreshingGraph}
              refreshKey={graphRefreshKey}
            />

            {/* AI Console Section */}
            <div
              onClick={() => navigate("/ai-chat")}
              className="p-6 rounded-3xl border border-slate-700/30 shadow-[0_5px_15px_rgba(0,0,0,0.6)] relative overflow-hidden"
              style={styles.card}
            >
              <div className="flex items-center justify-between mb-8 text-slate-300">
                <div className="flex items-center gap-2">
                  <MessageSquare size={18} className="text-blue-400" />
                  <h4 className="text-sm font-bold">AI Intent Console Preview</h4>
                </div>
              <span className="text-xs text-blue-400 font-medium opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                Open Console &rarr;
              </span>
              </div>

              <div className="space-y-6">
                <div className="flex items-start gap-4">
                  <div className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center text-[10px] font-bold text-white shrink-0 shadow-lg shadow-blue-600/20">
                    AD
                  </div>
                  <div className="bg-[#2A3B52] border border-slate-700/50 rounded-2xl rounded-tl-none px-5 py-3 text-slate-200 text-sm max-w-lg">
                    Block Social Media on Guest VLAN
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="w-9 h-9 rounded-full bg-[#7C3AED] flex items-center justify-center text-white shrink-0 shadow-lg shadow-purple-600/20">
                    <div className="w-5 h-5 border-2 border-white rounded-sm flex items-center justify-center text-[10px] font-bold">
                      AI
                    </div>
                  </div>
                  <div className="bg-[#111827]/80 border border-slate-800 rounded-2xl rounded-tl-none p-5 w-full">
                    <p className="text-[11px] text-slate-500 mb-4 font-bold uppercase tracking-widest">
                      Generated Configuration:
                    </p>
                    <div className="bg-[#0D121F] rounded-xl p-4 font-mono text-[11px] leading-relaxed text-emerald-400 border border-slate-800">
                      <p>access-list 101 deny tcp any any eq 443</p>
                      <p className="text-emerald-600/60 mb-1">log</p>
                      <p>access-list 101 deny tcp any any eq 80</p>
                      <p className="text-emerald-600/60 mb-2">log</p>
                      <p className="mb-2 text-inter">
                        access-list 101 permit ip any any
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex justify-end mt-8 h-10.5">
                {/* 1. PENDING STATE */}
                {status === "pending" && (
                  <div className="flex gap-3">
                    <button
                      onClick={handleApprove}
                      className="bg-[#10B981]/10 border border-[#10B981]/40 text-[#10B981] px-6 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all active:scale-95 hover:bg-[#10B981]/20"
                    >
                      <CheckCircle2 size={16} /> Approve & Deploy
                    </button>
                    <button
                      onClick={handleReject}
                      className="bg-white text-rose-500 px-6 py-2 rounded-xl text-xs font-bold flex items-center gap-2 border border-slate-200 transition-all active:scale-95 shadow-sm hover:bg-slate-50"
                    >
                      <X size={16} /> Reject
                    </button>
                  </div>
                )}

                {/* 2. DEPLOYING STATE (The Loading Spinner) */}
                {status === "deploying" && (
                  <div className="w-full flex justify-center items-center py-2 bg-blue-500/10 border border-blue-500/40 rounded-xl animate-pulse">
                    <div className="flex items-center gap-2 text-blue-400 font-medium text-sm">
                      <Loader2 size={18} className="animate-spin" />
                      <span>Deploying configuration to hardware...</span>
                    </div>
                  </div>
                )}

                {/* 3. DEPLOYED STATE (The Green Success Badge) */}
                {status === "deployed" && (
                  <div className="w-full flex justify-center items-center py-2 bg-[#10B981]/10 border border-[#10B981]/40 rounded-xl animate-in zoom-in duration-300">
                    <div className="flex items-center gap-2 text-[#10B981] font-medium text-sm">
                      <CheckCircle2 size={18} />
                      <span>Action completed</span>
                    </div>
                  </div>
                )}

                {/* 4. REJECTED STATE */}
                {status === "rejected" && (
                  <div className="w-full flex justify-center items-center py-2 bg-[#F43F5E]/10 border border-[#F43F5E]/40 rounded-xl animate-in zoom-in duration-300">
                    <div className="flex items-center gap-2 text-white font-medium text-sm">
                      <AlertTriangle size={18} className="text-orange-500" />
                      <span>Action rejected</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ROW TABLE - Real-Time Network Status */}
          <div
            className="rounded-3xl border border-slate-700/30 shadow-[0_5px_15px_rgba(0,0,0,0.6)] overflow-hidden"
            style={styles.card}
          >
            <div className="p-6 border-b border-slate-800/50 flex items-center justify-between">
              <h4 className="text-sm font-medium text-slate-300">
                Real-Time Network Status
              </h4>
              <div className="flex items-center gap-3">
                {networkStatus.total_count > 0 && (
                  <span className="text-[11px] text-slate-500 font-medium">
                    <span className="text-emerald-400">{networkStatus.online_count}</span>
                    {' / '}
                    <span className="text-slate-400">{networkStatus.total_count}</span>
                    {' online'}
                    {networkStatus.degraded_count > 0 && (
                      <>
                        {' · '}
                        <span className="text-amber-400">{networkStatus.degraded_count} degraded</span>
                      </>
                    )}
                    {networkStatus.tier_summary && (
                      Object.values(networkStatus.tier_summary).filter(t => !t.healthy).length > 0 && (
                        <>
                          {' · '}
                          <span className="text-amber-400">
                            {Object.values(networkStatus.tier_summary).filter(t => !t.healthy).length} tier{Object.values(networkStatus.tier_summary).filter(t => !t.healthy).length > 1 ? 's' : ''} down
                          </span>
                        </>
                      )
                    )}
                  </span>
                )}
                <button
                  onClick={handleRefreshNetStatus}
                  disabled={isRefreshingNetStatus}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 text-xs font-bold disabled:opacity-50 transition-all active:scale-95"
                >
                  <RefreshCw size={12} className={isRefreshingNetStatus ? 'animate-spin' : ''} />
                  {isRefreshingNetStatus ? 'Scanning...' : 'Refresh'}
                </button>
              </div>
            </div>
            <div className="overflow-x-auto px-6 pb-6">
              <table className="w-full text-left">
                <thead className="text-slate-500 text-[12px] font-medium border-b border-slate-800/30">
                  <tr>
                    <th className="py-5 font-normal">Hostname</th>
                    <th className="py-5 font-normal">Tier</th>
                    <th className="py-5 font-normal">IP Address</th>
                    <th className="py-5 font-normal">Status</th>
                    <th className="py-5 font-normal">Model</th>
                    <th className="py-5 font-normal">Last Check</th>
                  </tr>
                </thead>
                <tbody className="text-[13px]">
                  {networkStatus.devices.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-500 text-sm">
                        No devices loaded. Click Refresh to scan the network.
                      </td>
                    </tr>
                  ) : (
                    [...networkStatus.devices]
                      .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
                      .map((device) => {
                        const tierColors = {
                          edge: "bg-purple-500/10 text-purple-400 border-purple-500/20",
                          core: "bg-blue-500/10 text-blue-400 border-blue-500/20",
                          distribution: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
                          access: "bg-slate-500/10 text-slate-400 border-slate-500/20",
                        };
                        const statusStyles = {
                          online: "bg-emerald-500/10 border-emerald-500/20 text-emerald-400",
                          offline: "bg-rose-500/10 border-rose-500/20 text-rose-400",
                          degraded: "bg-amber-500/10 border-amber-500/20 text-amber-400 border-dashed",
                        };
                        const dotStyles = {
                          online: "bg-emerald-500",
                          offline: "bg-rose-500",
                          degraded: "bg-amber-500",
                        };
                        const status = device.effective_status || (device.online ? "online" : "offline");
                        return (
                          <tr
                            key={device.id}
                            className="border-b border-slate-800/30 hover:bg-slate-800/20 transition-colors last:border-0"
                          >
                            <td className="py-4 font-bold text-slate-200">{device.name}</td>
                            <td className="py-4">
                              <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded border ${tierColors[device.tier] || tierColors.access}`}>
                                {device.tier ? device.tier.charAt(0).toUpperCase() + device.tier.slice(1) : "—"}
                              </span>
                            </td>
                            <td className="py-4 text-slate-400 font-medium">
                              {device.ip}
                            </td>
                            <td className="py-4">
                              <div className="flex flex-col gap-1">
                                <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg border ${statusStyles[status]}`}>
                                  <span className={`w-1 h-1 rounded-full ${dotStyles[status]}`} />
                                  <span className="text-[10px] font-bold uppercase">{status === "degraded" ? "DEG" : status === "offline" ? "DOWN" : "UP"}</span>
                                </div>
                                {device.status_reason && (
                                  <span className="text-[10px] text-amber-500/70 max-w-[160px] leading-tight">
                                    {device.status_reason}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="py-4 text-slate-400 font-medium">
                              {device.model}
                            </td>
                            <td className="py-4 text-slate-500 font-medium">
                              {networkStatus.scan_timestamp
                                ? new Date(networkStatus.scan_timestamp).toLocaleTimeString()
                                : "Never"}
                            </td>
                          </tr>
                        );
                      })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/*ROW DRIFT & SYSLOG */}
          <div className="grid lg:grid-cols-2 gap-6 pb-12">
            {/* DRIFT DETECTION CARD */}
            <div
              className="p-6 rounded-3xl border border-slate-700/30 shadow-[0_5px_15px_rgba(0,0,0,0.6)]"
              style={styles.card}
            >
              <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-2 text-amber-500">
                  <Network size={20} />
                  <h4 className="text-base font-bold text-slate-200">
                    Configuration Drift
                  </h4>
                </div>
                <span className="text-[10px] bg-amber-500/10 text-amber-500 px-3 py-1 rounded-lg border border-amber-500/20 font-bold">
                  {driftReports.length} Alert{driftReports.length !== 1 ? 's' : ''}
                </span>
              </div>

              {driftReports.length > 0 ? (
                <>
                  <div className="mb-4 text-xs text-slate-400">
                    Latest: <span className="text-slate-300 font-semibold">{driftReports[0]?.hostname}</span>
                    {' • '}
                    Updated {driftReports[0] ? new Date(driftReports[0].mtime * 1000).toLocaleTimeString() : '—'}
                  </div>
                  
                  <div className="mb-4 max-h-64 overflow-hidden">
                    {driftReports[0]?.diff_content && (
                      <DiffViewer diffContent={driftReports[0].diff_content} compact={true} maxLines={12} />
                    )}
                  </div>

                  <a href="/drift-reports" className="inline-block text-xs text-amber-300 hover:text-amber-200 underline font-medium">
                    View all drift reports →
                  </a>
                </>
              ) : (
                <div className="text-slate-400 text-sm py-8 text-center">
                  No configuration drift detected
                </div>
              )}
            </div>

            {/* 2. SYSLOG INTELLIGENCE CARD */}
            <div
              className="p-6 rounded-3xl border border-slate-700/30 shadow-[0_5px_15px_rgba(0,0,0,0.6)]"
              style={styles.card}
            >
              <div className="flex items-center gap-2 mb-8 text-orange-500">
                <AlertTriangle size={20} />
                <h4 className="text-base font-bold text-slate-200">
                  Syslog Intelligence
                </h4>
              </div>

              <div className="space-y-4">
                {/* Alert 1 */}
                <div className="bg-rose-500/5 border border-rose-500/10 rounded-2xl p-5 flex gap-4">
                  <div className="w-10 h-10 rounded-xl bg-rose-500/10 flex items-center justify-center shrink-0 border border-rose-500/20">
                    <ShieldAlert className="text-rose-500" size={20} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[9px] font-black bg-rose-500/20 text-rose-500 px-2 py-0.5 rounded border border-rose-500/20">
                        CRITICAL
                      </span>
                      <span className="text-[10px] text-slate-500">
                        2 min ago
                      </span>
                    </div>
                    <p className="text-[13px] font-bold text-slate-200 mb-1">
                      Port Security Violation Detected
                    </p>
                    <p className="text-[11px] text-slate-400 leading-relaxed mb-2">
                      Multiple MAC addresses detected on port Gi1/0/24. Port has
                      been automatically disabled.
                    </p>
                    <p className="text-[10px] text-slate-500 font-medium">
                      Device: access-sw-02
                    </p>
                  </div>
                </div>

                {/* Alert 2 */}
                <div className="bg-amber-500/5 border border-amber-500/10 rounded-2xl p-5 flex gap-4">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0 border border-amber-500/20">
                    <AlertTriangle className="text-amber-500" size={20} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[9px] font-black bg-amber-500/20 text-amber-500 px-2 py-0.5 rounded border border-amber-500/20">
                        WARNING
                      </span>
                      <span className="text-[10px] text-slate-500">
                        15 min ago
                      </span>
                    </div>
                    <p className="text-[13px] font-bold text-slate-200 mb-1">
                      High CPU Utilization
                    </p>
                    <p className="text-[11px] text-slate-400 leading-relaxed mb-2">
                      Core router CPU usage reached 87% for 5 consecutive
                      minutes.
                    </p>
                    <p className="text-[10px] text-slate-500 font-medium">
                      Device: router-edge-01
                    </p>
                  </div>
                </div>

                {/* Alert 3 */}
                <div className="bg-rose-500/5 border border-rose-500/10 rounded-2xl p-5 flex gap-4">
                  <div className="w-10 h-10 rounded-xl bg-rose-500/10 flex items-center justify-center shrink-0 border border-rose-500/20">
                    <ShieldAlert className="text-rose-500" size={20} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[9px] font-black bg-rose-500/20 text-rose-500 px-2 py-0.5 rounded border border-rose-500/20">
                        CRITICAL
                      </span>
                      <span className="text-[10px] text-slate-500">
                        28 min ago
                      </span>
                    </div>
                    <p className="text-[13px] font-bold text-slate-200 mb-1">
                      Spanning Tree Topology Change
                    </p>
                    <p className="text-[11px] text-slate-400 leading-relaxed mb-2">
                      Root bridge election occurred. New root bridge is
                      core-sw-01.
                    </p>
                    <p className="text-[10px] text-slate-500 font-medium">
                      Device: Multiple devices
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
