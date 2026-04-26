import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, Network, MessageSquare, ShieldAlert, 
  Server, ClipboardList, Users, Settings, Search, 
  Bell, CheckCircle2, LogOut, AlertTriangle, X 
} from 'lucide-react';

import logo from '../images/logo.png'; 

const StatCard = ({ title, value, subValue, icon: Icon, iconBg, iconColor }) => (
  <div 
    className="p-6 rounded-3xl border border-slate-700/50 shadow-[0_5px_15px_rgba(0,0,0,0.6)] flex justify-between items-center relative overflow-hidden"
    style={{ backgroundColor: '#1D293DED', fontFamily: '"Inter", sans-serif' }}
  >
    <div className="z-10">
      <p className="text-slate-400 text-sm font-medium mb-2">{title}</p>
      <h3 className="text-4xl font-extrabold text-white drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)] tracking-tight">
        {value}
      </h3>
      <p className="text-xs text-slate-500 mt-2 font-medium">{subValue}</p>
    </div>
    <div className={`w-16 h-16 rounded-2xl flex items-center justify-center border border-white/10 shadow-[inset_0_1px_1px_rgba(255,255,255,0.2)] ${iconBg}`}>
      <Icon className={iconColor} size={32} strokeWidth={1.5} />
    </div>
  </div>
);

const SidebarItem = ({ icon: Icon, label, active = false }) => (
  <div className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-all ${
    active ? 'bg-blue-600 text-white rounded-lg' : 'text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg'
  }`} style={{ fontFamily: '"Inter", sans-serif' }}>
    <Icon size={18} />
    <span className="text-sm font-medium">{label}</span>
  </div>
);

//  MAIN DASHBOARD 
const Dashboard = () => {
  const navigate = useNavigate();
  
  
  const [status, setStatus] = useState('pending');

  
  const [showNotifications, setShowNotifications] = useState(false);

  const styles = {
    sidebar: { backgroundColor: '#020618ED', fontFamily: '"Inter", sans-serif' },
    main: { backgroundColor: '#919CA763', fontFamily: '"Inter", sans-serif' },
    card: { backgroundColor: '#1D293DED', fontFamily: '"Inter", sans-serif' },
    headline: { 
        color: '#000000FA', fontSize: '30px', fontWeight: '800', fontFamily: '"Inter", sans-serif',
        filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.4))'
    },
    subtext: { 
        color: '#5A697E', fontSize: '16px', fontWeight: '500', fontFamily: '"Inter", sans-serif',
        filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.2))'
    }
  };

  return (
    <div className="flex min-h-screen" style={styles.main}>
      
      {/* NAVBAR  */}
      <aside className="w-64 border-r border-slate-800 p-6 hidden lg:flex flex-col shrink-0" style={styles.sidebar}>
        <div className="mb-10 px-2">
          <img src={logo} alt="SentryPod AI" className="h-12 w-auto object-contain" />
        </div>
        <nav className="space-y-2 flex-1">
          <SidebarItem icon={LayoutDashboard} label="Dashboard" active />
          <SidebarItem icon={Network} label="Topology Map" />
          <SidebarItem icon={MessageSquare} label="AI Chat Console" />
          <SidebarItem icon={ShieldAlert} label="Staging Gate" />
          <SidebarItem icon={Server} label="Network Devices" />
          <SidebarItem icon={ClipboardList} label="Audit Logs" />
          <SidebarItem icon={Users} label="RBAC / Users" />
          <SidebarItem icon={Settings} label="Settings" />
        </nav>
        <button onClick={() => navigate('/login')} className="mt-auto flex items-center gap-3 px-4 py-3 text-slate-500 hover:text-rose-400 transition-colors">
          <LogOut size={18} />
          <span className="text-sm font-medium">Logout</span>
        </button>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden">

        {/*TOP_NAVIGATION */}
        <header className="h-16 border-b border-slate-800 flex items-center justify-between px-8 shrink-0" style={styles.sidebar}>
          
          {/* 1. Long Search Bar */}
          <div className="relative flex-1 max-w-200"> 
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
            <input 
              type="text" 
              placeholder="Search devices, logs, configurations..." 
              className="w-full bg-[#0D121F] border border-slate-700/50 rounded-xl py-2 pl-12 pr-4 text-sm text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500/30 transition-all" 
            />
          </div>

  
          <div className="flex items-center gap-6 ml-8">
            
            <div className="hidden xl:flex items-center gap-2 px-4 py-1.5 bg-[#00D492]/5 border border-[#00D492]/20 rounded-full">
              <div className="w-1.5 h-1.5 rounded-full bg-[#00D492] animate-pulse"></div>
              <span className="text-[#00D492] text-[11px] font-bold">AI Online</span>
            </div>

            {/* Notification bell */}
            <div className="relative">
              <div 
                onClick={() => setShowNotifications(!showNotifications)}
                className={`relative p-2 rounded-lg transition-all cursor-pointer ${showNotifications ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'}`}
              >
                <Bell size={20} />
                <span className="absolute top-2 right-2 w-2 h-2 bg-rose-500 border-2 border-[#020618] rounded-full"></span>
              </div>

              {/* DROPDOWN MENU */}
              {showNotifications && (
                <div className="absolute right-0 mt-3 w-80 bg-[#1D293D] border border-slate-700/50 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="p-4 border-b border-slate-800 flex justify-between items-center">
                    <span className="text-xs font-bold text-white uppercase tracking-wider">Notifications</span>
                    <span className="text-[10px] text-blue-400 cursor-pointer hover:underline">Mark all read</span>
                  </div>
                  
                  <div className="max-h-75 overflow-y-auto">
                    {[
                      { title: 'Drift Detected', msg: 'VLAN changed on core-sw-01', time: '2m ago' },
                      { title: 'Security Alert', msg: 'Multiple failed logins detected', time: '15m ago' },
                      { title: 'System Update', msg: 'New AI model v2.1 deployed', time: '1h ago' }
                    ].map((n, i) => (
                      <div key={i} className="p-4 border-b border-slate-800/50 hover:bg-slate-800/50 transition-colors cursor-pointer">
                        <div className="flex justify-between items-start mb-1">
                          <p className="text-[13px] font-bold text-slate-200">{n.title}</p>
                          <span className="text-[10px] text-slate-500">{n.time}</span>
                        </div>
                        <p className="text-[11px] text-slate-400 leading-snug">{n.msg}</p>
                      </div>
                    ))}
                  </div>
                  
                  <div className="p-3 text-center bg-slate-900/50">
                    <button className="text-[11px] font-bold text-slate-400 hover:text-white transition-colors">
                      View All Activity
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Admin Profile Section */}
            <div className="flex items-center gap-3 border-l border-slate-800 pl-6 shrink-0">
              <div className="w-9 h-9 bg-blue-600 rounded-full flex items-center justify-center text-[11px] font-bold text-white shadow-lg shadow-blue-600/30">
                AD
              </div>
              <div className="text-left leading-tight hidden sm:block">
                <p className="text-[13px] font-bold text-white">Admin</p>
                <p className="text-[10px] text-slate-500">System Administrator</p>
              </div>
            </div>
          </div>
        </header>

        {/* DASHBOARD CONTENT */}
        <div className="flex-1 overflow-y-auto p-8 space-y-8">
          <div>
            <h1 style={styles.headline}>Command Center</h1>
            <p style={styles.subtext}>Network overview and real-time monitoring</p>
          </div>

          {/* ROW STAT CARDS */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatCard title="Total Devices" value="247" subValue="+12 this month" icon={Server} iconBg="bg-blue-600/20" iconColor="text-blue-400" />
            <StatCard title="Active Devices" value="242" subValue="98% uptime" icon={CheckCircle2} iconBg="bg-emerald-600/20" iconColor="text-emerald-400" />
            <StatCard title="Configuration Drift Alerts" value="8" subValue="-3 from yesterday" icon={ShieldAlert} iconBg="bg-[#3E2C23]" iconColor="text-[#EAB308]" />
            <StatCard title="Security Status" value="Secure" subValue="All policies active" icon={ShieldAlert} iconBg="bg-cyan-600/20" iconColor="text-cyan-400" />
          </div>

          {/* ROW TRAFFIC & AI  */}
          <div className="grid lg:grid-cols-2 gap-6">

            {/* Traffic Section */}
            <div className="p-6 rounded-3xl border border-slate-700/30 shadow-[0_5px_15px_rgba(0,0,0,0.6)]" style={styles.card}>
              <h4 className="text-sm font-medium text-slate-300 mb-8">Network Traffic (24h)</h4>
              <div className="h-56 relative px-2">
                <div className="absolute inset-0 flex flex-col justify-between border-l border-b border-slate-700/50 text-[10px] text-slate-600 pb-1">
                  <span>100</span><span>75</span><span>50</span><span>25</span><span className="pl-1">0</span>
                </div>
                <svg className="w-full h-full pt-2" viewBox="0 0 100 40" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="trafficGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.3"/>
                      <stop offset="100%" stopColor="#3B82F6" stopOpacity="0"/>
                    </linearGradient>
                  </defs>
                  <path d="M0 22 Q 15 32, 25 18 T 45 8 T 70 12 T 100 18" fill="none" stroke="#3B82F6" strokeWidth="1.2" />
                  <path d="M0 22 Q 15 32, 25 18 T 45 8 T 70 12 T 100 18 V 40 H 0 Z" fill="url(#trafficGrad)" />
                </svg>
                <div className="flex justify-between mt-2 text-[9px] text-slate-600 font-medium px-1">
                  <span>00:00</span><span>04:00</span><span>08:00</span><span>12:00</span><span>16:00</span><span>20:00</span><span>23:59</span>
                </div>
              </div>
            </div>

            {/* AI Console Section */}
            <div className="p-6 rounded-3xl border border-slate-700/30 shadow-[0_5px_15px_rgba(0,0,0,0.6)] relative overflow-hidden" style={styles.card}>
              <div className="flex items-center gap-2 mb-8 text-slate-300">
                <MessageSquare size={18} className="text-blue-400" />
                <h4 className="text-sm font-bold">AI Intent Console Preview</h4>
              </div>
              <div className="space-y-6">
                <div className="flex items-start gap-4">
                  <div className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center text-[10px] font-bold text-white shrink-0 shadow-lg shadow-blue-600/20">AD</div>
                  <div className="bg-[#2A3B52] border border-slate-700/50 rounded-2xl rounded-tl-none px-5 py-3 text-slate-200 text-sm max-w-lg">Block Social Media on Guest VLAN</div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="w-9 h-9 rounded-full bg-[#7C3AED] flex items-center justify-center text-white shrink-0 shadow-lg shadow-purple-600/20">
                    <div className="w-5 h-5 border-2 border-white rounded-sm flex items-center justify-center text-[10px] font-bold">AI</div>
                  </div>
                  <div className="bg-[#111827]/80 border border-slate-800 rounded-2xl rounded-tl-none p-5 w-full">
                    <p className="text-[11px] text-slate-500 mb-4 font-bold uppercase tracking-widest">Generated Configuration:</p>
                    <div className="bg-[#0D121F] rounded-xl p-4 font-mono text-[11px] leading-relaxed text-emerald-400 border border-slate-800">
                      <p>access-list 101 deny tcp any any eq 443</p>
                      <p className="text-emerald-600/60 mb-1">log</p>
                      <p>access-list 101 deny tcp any any eq 80</p>
                      <p className="text-emerald-600/60 mb-2">log</p>
                      <p className="mb-2 text-inter">access-list 101 permit ip any any</p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex justify-end mt-8 h-10.5">
                {status === 'pending' && (
                  <div className="flex gap-3">
                    <button onClick={() => setStatus('deployed')} className="bg-[#10B981]/10 border border-[#10B981]/40 text-[#10B981] px-6 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all active:scale-95"><CheckCircle2 size={16} /> Approve & Deploy</button>
                    <button onClick={() => setStatus('rejected')} className="bg-white text-rose-500 px-6 py-2 rounded-xl text-xs font-bold flex items-center gap-2 border border-slate-200 transition-all active:scale-95 shadow-sm"><X size={16} /> Reject</button>
                  </div>
                )}
                {status === 'deployed' && (
                  <div className="w-full flex justify-center items-center py-2 bg-[#10B981]/10 border border-[#10B981]/40 rounded-xl animate-in zoom-in duration-300">
                    <div className="flex items-center gap-2 text-[#10B981] font-medium text-sm"><CheckCircle2 size={18} /><span>Action completed</span></div>
                  </div>
                )}
                {status === 'rejected' && (
                  <div className="w-full flex justify-center items-center py-2 bg-[#F43F5E]/10 border border-[#F43F5E]/40 rounded-xl animate-in zoom-in duration-300">
                    <div className="flex items-center gap-2 text-white font-medium text-sm"><AlertTriangle size={18} className="text-orange-500" /><span>Action rejected</span></div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ROW TABLE */}
          <div className="rounded-3xl border border-slate-700/30 shadow-[0_5px_15px_rgba(0,0,0,0.6)] overflow-hidden" style={styles.card}>
            <div className="p-6 border-b border-slate-800/50"><h4 className="text-sm font-medium text-slate-300">Real-Time Network Status</h4></div>
            <div className="overflow-x-auto px-6 pb-6">
              <table className="w-full text-left">
                <thead className="text-slate-500 text-[12px] font-medium border-b border-slate-800/30">
                  <tr><th className="py-5 font-normal">Hostname</th><th className="py-5 font-normal">IP Address</th><th className="py-5 font-normal">Status</th><th className="py-5 font-normal">Model</th><th className="py-5 font-normal">Last Check</th></tr>
                </thead>
                <tbody className="text-[13px]">
                  {[
                    { h: 'core-sw-01', ip: '192.168.1.1', s: 'online', m: 'Cisco Catalyst 9300', t: '2 min ago' },
                    { h: 'access-sw-02', ip: '192.168.1.12', s: 'online', m: 'Cisco Catalyst 2960X', t: '5 min ago' },
                    { h: 'access-sw-15', ip: '192.168.1.25', s: 'offline', m: 'Cisco Catalyst 2960', t: '45 min ago' }
                  ].map((row, i) => (
                    <tr key={i} className="border-b border-slate-800/30 hover:bg-slate-800/20 transition-colors last:border-0">
                      <td className="py-4 font-bold text-slate-200">{row.h}</td>
                      <td className="py-4 text-slate-400 font-medium">{row.ip}</td>
                      <td className="py-4">
                        <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-lg border ${row.s === 'online' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-rose-500/10 border-rose-500/20 text-rose-400'}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${row.s === 'online' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                          <span className="text-[11px] font-bold capitalize">{row.s}</span>
                        </div>
                      </td>
                      <td className="py-4 text-slate-400 font-medium">{row.m}</td>
                      <td className="py-4 text-slate-500 font-medium">{row.t}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

        {/*ROW DRIFT & SYSLOG */}
          <div className="grid lg:grid-cols-2 gap-6 pb-12">
            
            {/* DRIFT DETECTION CARD */}
            <div className="p-6 rounded-3xl border border-slate-700/30 shadow-[0_5px_15px_rgba(0,0,0,0.6)]" style={styles.card}>
              <div className="flex justify-between items-center mb-8">
                <div className="flex items-center gap-2 text-amber-500">
                  <Network size={20} />
                  <h4 className="text-base font-bold text-slate-200">Drift Detection</h4>
                </div>
                <span className="text-[10px] bg-amber-500/10 text-amber-500 px-3 py-1 rounded-lg border border-amber-500/20 font-bold">
                  8 Drifts Detected
                </span>
              </div>

              <div className="flex justify-between text-[11px] text-slate-500 mb-4 px-1">
                <span>Device: core-sw-01</span>
                <span>Updated 15 min ago</span>
              </div>

              {/* Side-by-Side Comparison Area */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="space-y-2">
                  <p className="text-[10px] text-slate-500 font-medium ml-1">Baseline Configuration</p>
                  <div className="bg-[#0D121F] rounded-xl p-4 font-mono text-[10px] leading-relaxed text-slate-400 border border-slate-800 h-56 overflow-hidden">
                    <p>interface</p>
                    <p>GigabitEthernet1/0/1</p>
                    <p className="pl-2">switchport mode</p>
                    <p className="pl-2">access</p>
                    <p className="pl-2 text-emerald-500 bg-emerald-500/5">switchport access</p>
                    <p className="pl-2 text-emerald-500 bg-emerald-500/5 font-bold">vlan 10</p>
                    <p className="pl-2">spanning-tree</p>
                    <p className="pl-2">portfast</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <p className="text-[10px] text-slate-500 font-medium ml-1">Current Configuration</p>
                  <div className="bg-[#0D121F] rounded-xl p-4 font-mono text-[10px] leading-relaxed text-slate-400 border border-slate-800 h-56 overflow-hidden">
                    <p>interface</p>
                    <p>GigabitEthernet1/0/1</p>
                    <p className="pl-2">switchport mode</p>
                    <p className="pl-2">access</p>
                    <p className="pl-2 text-rose-400 bg-rose-500/10">switchport access</p>
                    <p className="pl-2 text-rose-400 bg-rose-500/10 font-bold">vlan 20</p>
                    <p className="pl-2">spanning-tree</p>
                    <p className="pl-2">portfast</p>
                  </div>
                </div>
              </div>

              {/* Drift Summary Banner */}
              <div className="bg-[#2A2D35] border border-slate-700/50 rounded-xl p-4 flex items-center gap-4">
                <div className="bg-amber-500/20 text-amber-500 text-[9px] font-black px-2 py-1 rounded">DRIFT</div>
                <div className="text-[12px] text-slate-300">
                  VLAN assignment changed: <span className="text-rose-400 ml-2">- vlan 10</span> <span className="text-emerald-400 ml-1">→ + vlan 20</span>
                </div>
              </div>
            </div>

            {/* 2. SYSLOG INTELLIGENCE CARD */}
            <div className="p-6 rounded-3xl border border-slate-700/30 shadow-[0_5px_15px_rgba(0,0,0,0.6)]" style={styles.card}>
              <div className="flex items-center gap-2 mb-8 text-orange-500">
                <AlertTriangle size={20} />
                <h4 className="text-base font-bold text-slate-200">Syslog Intelligence</h4>
              </div>

              <div className="space-y-4">

                {/* Alert 1 */}
                <div className="bg-rose-500/5 border border-rose-500/10 rounded-2xl p-5 flex gap-4">
                  <div className="w-10 h-10 rounded-xl bg-rose-500/10 flex items-center justify-center shrink-0 border border-rose-500/20">
                    <ShieldAlert className="text-rose-500" size={20} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[9px] font-black bg-rose-500/20 text-rose-500 px-2 py-0.5 rounded border border-rose-500/20">CRITICAL</span>
                      <span className="text-[10px] text-slate-500">2 min ago</span>
                    </div>
                    <p className="text-[13px] font-bold text-slate-200 mb-1">Port Security Violation Detected</p>
                    <p className="text-[11px] text-slate-400 leading-relaxed mb-2">Multiple MAC addresses detected on port Gi1/0/24. Port has been automatically disabled.</p>
                    <p className="text-[10px] text-slate-500 font-medium">Device: access-sw-02</p>
                  </div>
                </div>

                {/* Alert 2 */}
                <div className="bg-amber-500/5 border border-amber-500/10 rounded-2xl p-5 flex gap-4">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0 border border-amber-500/20">
                    <AlertTriangle className="text-amber-500" size={20} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[9px] font-black bg-amber-500/20 text-amber-500 px-2 py-0.5 rounded border border-amber-500/20">WARNING</span>
                      <span className="text-[10px] text-slate-500">15 min ago</span>
                    </div>
                    <p className="text-[13px] font-bold text-slate-200 mb-1">High CPU Utilization</p>
                    <p className="text-[11px] text-slate-400 leading-relaxed mb-2">Core router CPU usage reached 87% for 5 consecutive minutes.</p>
                    <p className="text-[10px] text-slate-500 font-medium">Device: router-edge-01</p>
                  </div>
                </div>
                
                {/* Alert 3 */}
                <div className="bg-rose-500/5 border border-rose-500/10 rounded-2xl p-5 flex gap-4">
                  <div className="w-10 h-10 rounded-xl bg-rose-500/10 flex items-center justify-center shrink-0 border border-rose-500/20">
                    <ShieldAlert className="text-rose-500" size={20} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[9px] font-black bg-rose-500/20 text-rose-500 px-2 py-0.5 rounded border border-rose-500/20">CRITICAL</span>
                      <span className="text-[10px] text-slate-500">28 min ago</span>
                    </div>
                    <p className="text-[13px] font-bold text-slate-200 mb-1">Spanning Tree Topology Change</p>
                    <p className="text-[11px] text-slate-400 leading-relaxed mb-2">Root bridge election occurred. New root bridge is core-sw-01.</p>
                    <p className="text-[10px] text-slate-500 font-medium">Device: Multiple devices</p>
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