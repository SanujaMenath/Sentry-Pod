import { useState } from 'react';
import { Download, FileText, CheckCircle, AlertTriangle, XCircle, ChevronDown, Calendar } from 'lucide-react';
import ExportLogsModal from '../components/ExportLogsModal';

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
  success: 'bg-green-900/60 text-green-400 border border-green-700',
  blocked: 'bg-red-900/60 text-red-400 border border-red-700',
  detected: 'bg-yellow-900/60 text-yellow-400 border border-yellow-700',
  failed: 'bg-red-900/60 text-red-400 border border-red-700',
};

export default function AuditLogs() {
  const [showExport, setShowExport] = useState(false);

  return (
    <div className="flex-1 bg-[#f0f2f5] p-6 overflow-auto">
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
      <div className="grid grid-cols-4 gap-4 mb-6">
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
          type="text"
          placeholder="Search logs..."
          className="flex-1 bg-[#0d1117] border border-[#1e2530] rounded-lg px-3 py-2 text-sm text-gray-300 placeholder-gray-600 focus:outline-none focus:border-blue-500"
        />
        <button className="flex items-center gap-2 bg-[#0d1117] border border-[#1e2530] rounded-lg px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors min-w-32.5 justify-between">
          Action Type <ChevronDown size={14} />
        </button>
        <button className="flex items-center gap-2 bg-[#0d1117] border border-[#1e2530] rounded-lg px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors min-w-30 justify-between">
          Severity <ChevronDown size={14} />
        </button>
        <button className="flex items-center gap-2 bg-[#0d1117] border border-[#1e2530] rounded-lg px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors">
          <Calendar size={14} /> Date Range
        </button>
      </div>

      {/* Table */}
      <div className="bg-[#161b22] border border-[#1e2530] rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[#1e2530]">
          <h2 className="text-sm font-semibold text-white">Recent Activity</h2>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#1e2530]">
              {['Log ID', 'Timestamp', 'User', 'Action', 'Target', 'Status', 'Details'].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs text-gray-500 font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {logs.map((log, i) => (
              <tr key={log.id} className={`border-b border-[#1e2530] hover:bg-[#1e2530]/50 transition-colors ${i % 2 === 0 ? '' : ''}`}>
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
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showExport && <ExportLogsModal onClose={() => setShowExport(false)} />}
    </div>
  );
}