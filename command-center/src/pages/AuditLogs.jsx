import { useState, useEffect } from 'react';
import { Download, FileText, CheckCircle, AlertTriangle, XCircle, ChevronDown, Calendar, Eye } from 'lucide-react';
import ExportLogsModal from '../components/ExportLogsModal';
import AuditLogDetailModal from '../components/AuditLogDetailModal';
import { getAllAuditLogs, getAuditLogById } from '../services/auditService';

const statusConfig = {
  success: 'bg-green-900/60 text-green-400 border border-green-700',
  blocked: 'bg-red-900/60 text-red-400 border border-red-700',
  detected: 'bg-yellow-900/60 text-yellow-400 border border-yellow-700',
  failed: 'bg-red-900/60 text-red-400 border border-red-700',
};

const formatLogForModal = (log) => {
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
    user: log.username || 'System',
    action: log.action_name || 'Unknown',
    target: log.playbook_name || 'N/A',
    status: log.status || 'pending',
    details: output ? (output.substring(0, 50) + (output.length > 50 ? '...' : '')) : 'N/A',
    output: output,
    hasOutput: !!output,
  };
};

export default function AuditLogs() {
  const [showExport, setShowExport] = useState(false);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedLog, setSelectedLog] = useState(null);
  const [loadingLogId, setLoadingLogId] = useState(null);

  const handleViewLog = async (logId) => {
    try {
      setLoadingLogId(logId);
      const response = await getAuditLogById(logId);
      if (response.log) {
        const formattedLog = formatLogForModal(response.log);
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
        if (response.logs) setLogs(response.logs);
        else if (Array.isArray(response)) setLogs(response);
        setError(null);
      } catch (err) {
        console.error('Failed to fetch audit logs:', err);
        setError('Failed to load audit logs.');
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
      fontFamily: '"Inter", sans-serif' 
    },
    card: { backgroundColor: '#1D293DED', fontFamily: '"Inter", sans-serif' }
  };

  return (
    <div className="flex min-h-screen" style={styles.main}>
     
      <main className="flex-1 flex flex-col overflow-hidden">
        
        {/* MAIN SCROLLABLE CONTENT */}
        <div className="flex-1 overflow-y-auto p-8 space-y-8">

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 mb-1">Audit Logs</h1>
          <p className="text-sm text-gray-500">Complete audit trail of all system activities</p>
        </div>
        <button
          onClick={() => setShowExport(true)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <Download size={14} />
          Export Logs
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-[#161b22] border border-[#1e2530] rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-500 mb-1">Total Events</p>
            <p className="text-2xl font-bold text-white">8,934</p>
          </div>
          <div className="w-10 h-10 bg-blue-900/40 rounded-lg flex items-center justify-center">
            <FileText size={20} className="text-blue-400" />
          </div>
        </div>
        <div className="bg-[#161b22] border border-[#1e2530] rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-500 mb-1">Success</p>
            <p className="text-2xl font-bold text-green-400">7,821</p>
          </div>
          <div className="w-10 h-10 bg-green-900/40 rounded-lg flex items-center justify-center">
            <CheckCircle size={20} className="text-green-400" />
          </div>
        </div>
        <div className="bg-[#161b22] border border-[#1e2530] rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-500 mb-1">Warnings</p>
            <p className="text-2xl font-bold text-yellow-400">892</p>
          </div>
          <div className="w-10 h-10 bg-yellow-900/40 rounded-lg flex items-center justify-center">
            <AlertTriangle size={20} className="text-yellow-400" />
          </div>
        </div>
        <div className="bg-[#161b22] border border-[#1e2530] rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-500 mb-1">Critical</p>
            <p className="text-2xl font-bold text-red-400">221</p>
          </div>
          <div className="w-10 h-10 bg-red-900/40 rounded-lg flex items-center justify-center">
            <XCircle size={20} className="text-red-400" />
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-[#161b22] border border-[#1e2530] rounded-xl p-4 mb-6 flex items-center gap-3">
        <input
          id="search-logs"
          name="search"
          type="text"
          placeholder="Search logs..."
          className="flex-1 bg-[#0d1117] border border-[#1e2530] rounded-lg px-3 py-2 text-sm text-gray-300 placeholder-gray-600 focus:outline-none focus:border-blue-500"
        />
        <button id="action-filter" name="action-type" className="flex items-center gap-2 bg-[#0d1117] border border-[#1e2530] rounded-lg px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors min-w-32.5 justify-between">
          Action Type <ChevronDown size={14} />
        </button>
        <button id="severity-filter" name="severity" className="flex items-center gap-2 bg-[#0d1117] border border-[#1e2530] rounded-lg px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors min-w-30 justify-between">
          Severity <ChevronDown size={14} />
        </button>
        <button id="date-filter" name="date-range" className="flex items-center gap-2 bg-[#0d1117] border border-[#1e2530] rounded-lg px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors">
          <Calendar size={14} /> Date Range
        </button>
      </div>

      {/* Table */}
      <div className="bg-[#161b22] border border-[#1e2530] rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[#1e2530]">
          <h2 className="text-sm font-semibold text-white">Recent Activity</h2>
        </div>
        <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[740px]">
          <thead>
            <tr className="border-b border-[#1e2530]">
              {['Log ID', 'Timestamp', 'User', 'Action', 'Target', 'Status', 'Details', 'View'].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs text-gray-500 font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {logs.map((log, i) => (
              <tr
                key={log.id}
                className={`border-b border-[#1e2530] hover:bg-[#1e2530]/50 transition-colors ${i % 2 === 0 ? '' : ''}`}
              >
                <td className="px-4 py-3 text-blue-400 font-mono text-xs">{log.id}</td>
                <td className="px-4 py-3 text-gray-400 font-mono text-xs whitespace-nowrap">{log.timestamp}</td>
                <td className="px-4 py-3 text-gray-300 text-xs">{log.user}</td>
                <td className="px-4 py-3 text-white text-xs font-medium">{log.action}</td>
                <td className="px-4 py-3 text-gray-400 font-mono text-xs">{log.target}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusConfig[log.status]}`}>
                    {log.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-500 text-xs">{log.details}</td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => handleViewLog(log._id)}
                    disabled={loadingLogId === log._id}
                    className="flex items-center gap-1 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 text-white px-2 py-1 rounded text-xs font-medium transition-colors"
                  >
                    <Eye size={12} />
                    {loadingLogId === log._id ? 'Loading...' : 'View'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>

      </div> 
      </div>
  </main> 

  {showExport && <ExportLogsModal onClose={() => setShowExport(false)} />}
  {selectedLog && <AuditLogDetailModal log={selectedLog} onClose={() => setSelectedLog(null)} />}
</div>
  );
}