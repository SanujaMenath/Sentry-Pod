import { useState, useEffect, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Download, FileText, CheckCircle, AlertTriangle, XCircle, ChevronDown, Eye } from 'lucide-react';
import ExportLogsModal from '../components/ExportLogsModal';
import AuditLogDetailModal from '../components/AuditLogDetailModal';
import { getAllAuditLogs, getAuditLogById } from '../services/auditService';
import PageHeader from "../components/PageHeader";
import StatCard from "../components/StatCard";

const statusConfig = {
  success: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
  blocked: 'bg-rose-500/10 text-rose-400 border border-rose-500/20',
  detected: 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
  failed: 'bg-rose-500/10 text-rose-400 border border-rose-500/20',
  error: 'bg-rose-500/10 text-rose-400 border border-rose-500/20',
  pending: 'bg-slate-500/10 text-slate-400 border border-slate-500/20',
};

const formatLogForDisplay = (log) => {
  const output = log.output || null;
  return {
    id: log._id || 'N/A',
    timestamp: log.timestamp ? new Date(log.timestamp).toLocaleString('en-US', { 
      year: 'numeric', 
      month: '2-digit', 
      day: '2-digit', 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit' 
    }) : 'N/A',
    date: log.timestamp ? new Date(log.timestamp) : null,
    user: log.username || 'System',
    action: log.action_name || 'Unknown',
    target: log.playbook_name || 'N/A',
    status: log.status || 'pending',
    details: output ? (output.substring(0, 50) + (output.length > 50 ? '...' : '')) : 'N/A',
    output: output,
    hasOutput: !!output,
  };
};

const severityOf = (status) => {
  if (status === 'success') return 'success';
  if (status === 'detected' || status === 'blocked') return 'warning';
  if (status === 'failed' || status === 'error') return 'critical';
  return 'pending';
};

export default function AuditLogs() {
  const { search, setSearch } = useOutletContext() || { search: "", setSearch: () => {} };
  const [logs, setLogs] = useState([]);
  const [, setLoading] = useState(true);
  const [, setError] = useState(null);
  const [showExport, setShowExport] = useState(false);
  const [selectedLog, setSelectedLog] = useState(null);
  const [loadingLogId, setLoadingLogId] = useState(null);
  const [actionFilter, setActionFilter] = useState("all");
  const [severityFilter, setSeverityFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");

  const actionOptions = useMemo(() => {
    const set = new Set(logs.map((log) => log.action).filter(Boolean));
    return ["all", ...set];
  }, [logs]);

  const filteredLogs = useMemo(() => {
    const query = search ? search.trim().toLowerCase() : "";
    return logs.filter((log) => {
      if (query) {
        const haystack = [log.id, log.user, log.action, log.target, log.status, log.details, log.output]
          .map((field) => (field ? field.toString().toLowerCase() : ""))
          .join(" ");
        if (!haystack.includes(query)) return false;
      }
      if (actionFilter !== "all" && log.action !== actionFilter) return false;
      if (severityFilter !== "all" && severityOf(log.status) !== severityFilter) return false;
      if (dateFilter !== "all") {
        if (!log.date) return false;
        const elapsed = Date.now() - log.date.getTime();
        const DAY = 24 * 3600 * 1000;
        if (dateFilter === "today" && elapsed > DAY) return false;
        if (dateFilter === "7d" && elapsed > 7 * DAY) return false;
        if (dateFilter === "30d" && elapsed > 30 * DAY) return false;
      }
      return true;
    });
  }, [logs, search, actionFilter, severityFilter, dateFilter]);

  const handleViewLog = async (logId) => {
    try {
      setLoadingLogId(logId);
      const response = await getAuditLogById(logId);
      if (response.log) {
        const formattedLog = formatLogForDisplay(response.log);
        setSelectedLog(formattedLog);
      }
    } catch (err) {
      console.error('Failed to fetch log details:', err);
      alert('Failed to load log details: ' + err);
    } finally {
      setLoadingLogId(null);
    }
  };

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

  // Calculate stats from logs
  const stats = {
    total: logs.length,
    success: logs.filter(l => l.status === 'success').length,
    warnings: logs.filter(l => l.status === 'detected' || l.status === 'blocked').length,
    critical: logs.filter(l => l.status === 'failed' || l.status === 'error').length,
  };

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
          <StatCard title="Total Events" value={String(stats.total)} subValue="" icon={FileText} iconBg="bg-blue-600/20" iconColor="text-blue-400" />
          <StatCard title="Success" value={String(stats.success)} subValue="" icon={CheckCircle} iconBg="bg-emerald-600/20" iconColor="text-emerald-400" />
          <StatCard title="Warnings" value={String(stats.warnings)} subValue="" icon={AlertTriangle} iconBg="bg-amber-600/20" iconColor="text-amber-400" />
          <StatCard title="Critical" value={String(stats.critical)} subValue="" icon={XCircle} iconBg="bg-rose-600/20" iconColor="text-rose-400" />
        </div>

        {/* Filter Bar */}
        <div className="p-4 rounded-3xl border border-slate-700/30 shadow-[0_5px_15px_rgba(0,0,0,0.6)] flex items-center gap-3" style={styles.card}>
          <input
            id="search-logs"
            name="search"
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search logs..."
            className="flex-1 bg-[#0D121F] border border-slate-700/50 rounded-xl px-4 py-2 text-sm text-slate-400 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500/30"
          />
          <div className="relative">
            <select
              id="action-filter"
              name="action-type"
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="appearance-none bg-[#0D121F] border border-slate-700/50 rounded-xl pl-3 pr-8 py-2 text-sm text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500/30 hover:text-white transition-colors min-w-[130px]"
            >
              <option value="all">Action Type</option>
              {actionOptions.filter((a) => a !== "all").map((action) => (
                <option key={action} value={action}>{action}</option>
              ))}
            </select>
            <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
          </div>
          <div className="relative">
            <select
              id="severity-filter"
              name="severity"
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              className="appearance-none bg-[#0D121F] border border-slate-700/50 rounded-xl pl-3 pr-8 py-2 text-sm text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500/30 hover:text-white transition-colors min-w-[120px]"
            >
              <option value="all">Severity</option>
              <option value="success">Success</option>
              <option value="warning">Warning</option>
              <option value="critical">Critical</option>
              <option value="pending">Pending</option>
            </select>
            <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
          </div>
          <div className="relative">
            <select
              id="date-filter"
              name="date-range"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="appearance-none bg-[#0D121F] border border-slate-700/50 rounded-xl pl-3 pr-8 py-2 text-sm text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500/30 hover:text-white transition-colors"
            >
              <option value="all">Date Range</option>
              <option value="today">Today</option>
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
            </select>
            <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
          </div>
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
                  {['Log ID', 'Timestamp', 'User', 'Action', 'Target', 'Status', 'Details', 'View'].map(h => (
                    <th key={h} className="py-5 font-normal">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="text-[13px]">
                {filteredLogs.map((log) => (
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
                    <td className="py-4">
                      <button
                        onClick={() => handleViewLog(log.id)}
                        disabled={loadingLogId === log.id}
                        className="flex items-center gap-1 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-600 text-white px-2 py-1 rounded text-xs font-medium transition-colors"
                      >
                        <Eye size={12} />
                        {loadingLogId === log.id ? 'Loading...' : 'View'}
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredLogs.length === 0 && (
                  <tr>
                    <td colSpan="8" className="text-center py-12 text-slate-500 text-sm font-semibold">
                      {search ? `No audit logs matching "${search}"` : "No audit logs matching the selected filters."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
      {showExport && <ExportLogsModal onClose={() => setShowExport(false)} />}
      {selectedLog && <AuditLogDetailModal log={selectedLog} onClose={() => setSelectedLog(null)} />}
    </div>
  );
}