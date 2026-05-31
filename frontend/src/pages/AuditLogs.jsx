 import { useState, useEffect } from 'react';
import { Download, FileText, CheckCircle, AlertTriangle, XCircle, ChevronDown, Calendar } from 'lucide-react';
import ExportLogsModal from '../components/ExportLogsModal';
import AuditLogDetailModal from '../components/AuditLogDetailModal';
import { getAllAuditLogs } from '../services/auditService';
import PageHeader from "../components/PageHeader";

const logs = [
  { id: 'LOG-8934', timestamp: '2026-03-05 14:23:45', user: 'Admin User', action: 'Configuration Change', target: 'access-sw-02', status: 'success', details: 'Applied...' },
  { id: 'LOG-8933', timestamp: '2026-03-05 14:15:22', user: 'John Network', action: 'Device Login', target: 'core-sw-01', status: 'success', details: 'SSH log...' },
  { id: 'LOG-8932', timestamp: '2026-03-05 13:58:10', user: 'System', action: 'Port Security Violation', target: 'access-sw-02 G11/0/24', status: 'blocked', details: 'MAC ac...' },
  { id: 'LOG-8931', timestamp: '2026-03-05 13:45:33', user: 'Sarah Security', action: 'User Role Modified', target: 'Mike Monitor', status: 'success', details: 'Change...' },
  { id: 'LOG-8930', timestamp: '2026-03-05 13:30:18', user: 'Admin User', action: 'Backup Created', target: 'All Devices', status: 'success', details: 'Autom...' },
  { id: 'LOG-8929', timestamp: '2026-03-05 13:12:05', user: 'System', action: 'Configuration Drift', target: 'core-sw-01 G11/0/1', status: 'detected', details: 'VLAN a...' },
  { id: 'LOG-8928', timestamp: '2026-03-05 12:55:42', user: 'John Network', action: 'Device Reboot', target: 'dist-sw-03', status: 'success', details: 'Manual...' },
  { id: 'LOG-8927', timestamp: '2026-03-05 12:20:15', user: 'System', action: 'Failed Login Attempt', target: 'router-edge-01', status: 'failed', details: '3 cons...' },
];

const statusConfig = {
  success: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
  blocked: 'bg-rose-500/10 text-rose-400 border border-rose-500/20',
  detected: 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
  failed: 'bg-rose-500/10 text-rose-400 border border-rose-500/20',
};

export default function AuditLogs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showExport, setShowExport] = useState(false);
  const [selectedLog, setSelectedLog] = useState(null);

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        setLoading(true);
        const response = await getAllAuditLogs(100);
        if (response.logs) {
          const formattedLogs = response.logs.map(formatLogForDisplay);
          setLogs(formattedLogs);
        }
        setError(null);
      } catch (err) {
        console.error('Failed to fetch audit logs:', err);
        setError('Failed to load audit logs. Showing no logs.');
        setLogs([]);
      } finally {
        setLoading(false);
      }
    };

    fetchLogs();
  }, []);

  const styles = {
    main: {
      background: 'linear-gradient(135deg, #F8FAFC 0%, #D1D5DB 100%)',
      backgroundAttachment: 'fixed',
      fontFamily: '"Inter", sans-serif',
      minHeight: '100%',
    },
    card: { backgroundColor: '#1D293DED', fontFamily: '"Inter", sans-serif' },
    headline: { color: '#0F172A', fontSize: '30px', fontWeight: '800', fontFamily: '"Inter", sans-serif', letterSpacing: '-0.025em' },
    subtext: { color: '#475569', fontSize: '16px', fontWeight: '500', fontFamily: '"Inter", sans-serif' }
  };

  return (
    <div style={styles.main}>
      <div className="p-8 space-y-8">

        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 style={styles.headline}>Audit Logs</h1>
            <p style={styles.subtext}>Complete audit trail of all system activities</p>
          </div>
          <button
            onClick={() => setShowExport(true)}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-colors shadow-lg shadow-blue-600/20"
          >
            <Download size={14} />
            Export Logs
          </button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-4 gap-6">
          <div className="p-6 rounded-3xl border border-slate-700/30 shadow-[0_5px_15px_rgba(0,0,0,0.6)] flex items-center justify-between" style={styles.card}>
            <div>
              <p className="text-slate-400 text-sm font-medium mb-2">Total Events</p>
              <h3 className="text-4xl font-extrabold text-white tracking-tight">8,934</h3>
            </div>
            <div className="w-16 h-16 rounded-2xl bg-blue-600/20 flex items-center justify-center border border-white/10">
              <FileText size={32} className="text-blue-400" strokeWidth={1.5} />
            </div>
          </div>
          <div className="p-6 rounded-3xl border border-slate-700/30 shadow-[0_5px_15px_rgba(0,0,0,0.6)] flex items-center justify-between" style={styles.card}>
            <div>
              <p className="text-slate-400 text-sm font-medium mb-2">Success</p>
              <h3 className="text-4xl font-extrabold text-emerald-400 tracking-tight">7,821</h3>
            </div>
            <div className="w-16 h-16 rounded-2xl bg-emerald-600/20 flex items-center justify-center border border-white/10">
              <CheckCircle size={32} className="text-emerald-400" strokeWidth={1.5} />
            </div>
          </div>
          <div className="p-6 rounded-3xl border border-slate-700/30 shadow-[0_5px_15px_rgba(0,0,0,0.6)] flex items-center justify-between" style={styles.card}>
            <div>
              <p className="text-slate-400 text-sm font-medium mb-2">Warnings</p>
              <h3 className="text-4xl font-extrabold text-amber-400 tracking-tight">892</h3>
            </div>
            <div className="w-16 h-16 rounded-2xl bg-amber-600/20 flex items-center justify-center border border-white/10">
              <AlertTriangle size={32} className="text-amber-400" strokeWidth={1.5} />
            </div>
          </div>
          <div className="p-6 rounded-3xl border border-slate-700/30 shadow-[0_5px_15px_rgba(0,0,0,0.6)] flex items-center justify-between" style={styles.card}>
            <div>
              <p className="text-slate-400 text-sm font-medium mb-2">Critical</p>
              <h3 className="text-4xl font-extrabold text-rose-400 tracking-tight">221</h3>
            </div>
            <div className="w-16 h-16 rounded-2xl bg-rose-600/20 flex items-center justify-center border border-white/10">
              <XCircle size={32} className="text-rose-400" strokeWidth={1.5} />
            </div>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="p-4 rounded-3xl border border-slate-700/30 shadow-[0_5px_15px_rgba(0,0,0,0.6)] flex items-center gap-3" style={styles.card}>
          <input
            type="text"
            placeholder="Search logs..."
            className="flex-1 bg-[#0D121F] border border-slate-700/50 rounded-xl px-4 py-2 text-sm text-slate-400 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500/30"
          />
          <button className="flex items-center gap-2 bg-[#0D121F] border border-slate-700/50 rounded-xl px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors min-w-[130px] justify-between">
            Action Type <ChevronDown size={14} />
          </button>
          <button className="flex items-center gap-2 bg-[#0D121F] border border-slate-700/50 rounded-xl px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors min-w-[120px] justify-between">
            Severity <ChevronDown size={14} />
          </button>
          <button className="flex items-center gap-2 bg-[#0D121F] border border-slate-700/50 rounded-xl px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors">
            <Calendar size={14} /> Date Range
          </button>
        </div>

        {/* Table */}
        <div className="rounded-3xl border border-slate-700/30 shadow-[0_5px_15px_rgba(0,0,0,0.6)] overflow-hidden" style={styles.card}>
          <div className="px-6 py-4 border-b border-slate-800/50">
            <h2 className="text-sm font-medium text-slate-300">Recent Activity</h2>
          </div>
          <div className="overflow-x-auto px-6 pb-6">
            <table className="w-full text-left">
              <thead className="text-slate-500 text-[12px] font-medium border-b border-slate-800/30">
                <tr>
                  {['Log ID', 'Timestamp', 'User', 'Action', 'Target', 'Status', 'Details'].map(h => (
                    <th key={h} className="py-5 font-normal">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="text-[13px]">
                {logs.map((log) => (
                  <tr key={log.id} className="border-b border-slate-800/30 hover:bg-slate-800/20 transition-colors last:border-0">
                    <td className="py-4 text-blue-400 font-mono text-xs font-bold">{log.id}</td>
                    <td className="py-4 text-slate-400 font-mono text-xs whitespace-nowrap">{log.timestamp}</td>
                    <td className="py-4 text-slate-300 text-xs font-medium">{log.user}</td>
                    <td className="py-4 text-slate-200 text-xs font-bold">{log.action}</td>
                    <td className="py-4 text-slate-400 font-mono text-xs">{log.target}</td>
                    <td className="py-4">
                      <span className={`px-3 py-1 rounded-lg text-[11px] font-bold ${statusConfig[log.status]}`}>
                        {log.status}
                      </span>
                    </td>
                    <td className="py-4 text-slate-500 text-xs">{log.details}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>
      {showExport && <ExportLogsModal onClose={() => setShowExport(false)} />}
    </div>
  );
}