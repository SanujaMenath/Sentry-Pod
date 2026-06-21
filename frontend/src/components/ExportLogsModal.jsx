import { useState } from 'react';
import { X, Calendar, FileText, FileJson } from 'lucide-react';

export default function ExportLogsModal({ onClose }) {
  const [format, setFormat] = useState('CSV');
  const [activeFilter] = useState('All Logs');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  return (
    <div className="fixed inset-0 z-50 flex">
      

      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative z-20 m-auto bg-[#161b22] border border-[#1e2530] rounded-2xl w-[105] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-[#1e2530]">
          <h2 className="text-white font-semibold text-base">Export Audit Logs</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Date Range */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-400 mb-1.5 block">Start Date</label>
              <div className="relative">
                <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <input
                  type="date"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  className="w-full bg-[#0d1117] border border-[#1e2530] rounded-lg pl-9 pr-3 py-2.5 text-sm text-gray-300 focus:outline-none focus:border-blue-500 scheme-dark"
                />
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1.5 block">End Date</label>
              <div className="relative">
                <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <input
                  type="date"
                  value={endDate}
                  onChange={e => setEndDate(e.target.value)}
                  className="w-full bg-[#0d1117] border border-[#1e2530] rounded-lg pl-9 pr-3 py-2.5 text-sm text-gray-300 focus:outline-none focus:border-blue-500 scheme-dark"
                />
              </div>
            </div>
          </div>

          {/* Log Type */}
          <div>
            <label className="text-xs text-gray-400 mb-1.5 block">Log Type</label>
            <div className="relative">
              <FileText size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <select className="w-full bg-[#0d1117] border border-[#1e2530] rounded-lg pl-9 pr-3 py-2.5 text-sm text-gray-300 focus:outline-none focus:border-blue-500 appearance-none">
                <option value="">All Logs</option>
                <option>Configuration Changes</option>
                <option>Authentication Events</option>
                <option>Alerts & Warnings</option>
                <option>System Events</option>
              </select>
            </div>
          </div>

          {/* Export Format */}
          <div>
            <label className="text-xs text-gray-400 mb-1.5 block">Export Format</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setFormat('CSV')}
                className={`flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium border transition-all
                  ${format === 'CSV'
                    ? 'bg-blue-600 border-blue-500 text-white'
                    : 'bg-[#0d1117] border-[#1e2530] text-gray-400 hover:text-white'
                  }`}
              >
                <FileText size={14} /> CSV
              </button>
              <button
                onClick={() => setFormat('JSON')}
                className={`flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium border transition-all
                  ${format === 'JSON'
                    ? 'bg-blue-600 border-blue-500 text-white'
                    : 'bg-[#0d1117] border-[#1e2530] text-gray-400 hover:text-white'
                  }`}
              >
                <FileJson size={14} /> JSON
              </button>
            </div>
          </div>

          {/* Export Summary */}
          <div className="bg-[#0d1117] border border-[#1e2530] rounded-xl p-4">
            <p className="text-sm font-medium text-white mb-2">Export Summary</p>
            <div className="text-xs text-gray-500 space-y-1">
              <p>Date Range: 2026-03-01 to 2026-03-07</p>
              <p>Log Type: {activeFilter}</p>
              <p>Format: {format}</p>
              <p className="text-green-400 mt-2">Estimated: ~450 log entries</p>
            </div>
          </div>

          {/* Actions */}
          <div className="grid grid-cols-2 gap-3 pt-1">
            <button
              onClick={onClose}
              className="py-2.5 rounded-lg text-sm font-medium bg-[#0d1117] border border-[#1e2530] text-gray-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button className="py-2.5 rounded-lg text-sm font-medium bg-blue-600 hover:bg-blue-500 text-white transition-colors flex items-center justify-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              Export
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}