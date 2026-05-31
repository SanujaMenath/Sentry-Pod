import { X, Copy, Check } from 'lucide-react';
import { useState } from 'react';

const mocha = {
  base: '#1e1e2e',
  mantle: '#181825',
  surface0: '#313244',
  surface1: '#45475a',
  text: '#cdd6f4',
  subtext1: '#bac2de',
  lavender: '#b4befe',
  blue: '#89b4fa',
  green: '#a6e3a1',
  yellow: '#f9e2af',
  red: '#f38ba8',
  peach: '#fab387',
  sapphire: '#74c7ec',
  sky: '#89dceb',
};

const classifyLine = (line) => {
  if (!line.trim()) {
    return { color: mocha.subtext1 };
  }

  if (line.startsWith("PLAY RECAP")) return { color: mocha.lavender, weight: 700 };
  if (line.startsWith("PLAY [")) return { color: mocha.blue, weight: 700 };
  if (line.startsWith("TASK [")) return { color: mocha.sapphire, weight: 700 };
  if (line.startsWith("ok:")) return { color: mocha.green };
  if (line.startsWith("changed:")) return { color: mocha.yellow };
  if (line.startsWith("failed:")) return { color: mocha.red, weight: 700 };
  if (line.startsWith("skipped:")) return { color: mocha.peach };
  if (line.startsWith("fatal:")) return { color: mocha.red, weight: 700 };
  if (line.startsWith("[")) return { color: mocha.subtext1 };

  return { color: mocha.text };
};

export default function AuditLogDetailModal({ log, onClose }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(log.output || '');
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const statusColors = {
    success: 'bg-green-900/60 text-green-400 border border-green-700',
    failed: 'bg-red-900/60 text-red-400 border border-red-700',
    error: 'bg-red-900/60 text-red-400 border border-red-700',
    detected: 'bg-yellow-900/60 text-yellow-400 border border-yellow-700',
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#1D293DED] border border-[#1e2530] rounded-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-[#1e2530]">
          <div>
            <h2 className="text-xl font-bold text-white mb-1">{log.action}</h2>
            <p className="text-sm text-gray-400">
              Playbook: <span className="text-gray-300 font-mono">{log.target}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-[#1e2530] rounded-lg transition-colors"
          >
            <X size={20} className="text-gray-400" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Details Grid */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-500 font-medium mb-1">Log ID</label>
              <p className="text-sm font-mono text-blue-400">{log.id}</p>
            </div>
            <div>
              <label className="block text-xs text-gray-500 font-medium mb-1">Timestamp</label>
              <p className="text-sm text-gray-300">{log.timestamp}</p>
            </div>
            <div>
              <label className="block text-xs text-gray-500 font-medium mb-1">User</label>
              <p className="text-sm text-gray-300">{log.user}</p>
            </div>
            <div>
              <label className="block text-xs text-gray-500 font-medium mb-1">Status</label>
              <span className={`inline-block px-3 py-1 rounded text-xs font-medium ${statusColors[log.status]}`}>
                {log.status.charAt(0).toUpperCase() + log.status.slice(1)}
              </span>
            </div>
          </div>

          {/* Output Section */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="block text-sm font-semibold text-gray-400">Execution Output</label>
              {log.output && (
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-2 rounded-lg bg-[#45475a]/50 px-3 py-1.5 text-xs text-[#cdd6f4] transition-all hover:bg-[#45475a] hover:text-white"
                >
                  {copied ? (
                    <>
                      <Check size={14} />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy size={14} />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              )}
            </div>
            {log.output ? (
              <div className="rounded-lg border border-[#313244] bg-[#181825] p-4 font-mono text-xs leading-5 max-h-96 overflow-auto">
                {log.output.split('\n').map((line, index) => {
                  const style = classifyLine(line);
                  return (
                    <div
                      key={`${index}-${line}`}
                      style={{ color: style.color, fontWeight: style.weight || 400 }}
                      className="whitespace-pre-wrap break-words"
                    >
                      {line}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-lg border border-[#313244] bg-[#181825] p-4 text-sm text-gray-500 italic">
                No execution output available for this log entry.
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-[#1e2530] p-4 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-[#1e2530] text-gray-300 hover:bg-[#313244] transition-colors text-sm font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
