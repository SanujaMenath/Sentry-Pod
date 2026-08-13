import { X, Copy, Check, FileCode } from 'lucide-react';
import { useCopyToClipboard } from '../hooks/useCopyToClipboard';

const statusColors = {
  Verified: 'bg-green-900/60 text-green-400 border border-green-700',
  Draft: 'bg-slate-900/60 text-slate-400 border border-slate-700',
  Failed: 'bg-red-900/60 text-red-400 border border-red-700',
};

export default function PlaybookDetailModal({ playbook, content, onClose }) {
  const { copied, handleCopy } = useCopyToClipboard();

  const tags = playbook.tags || [];
  const targetDevices = playbook.target_devices || [];
  const intents = playbook.example_intents || [];

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#1D293DED] border border-[#1e2530] rounded-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-[#1e2530]">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/10 border border-blue-500/30 rounded-xl text-blue-400">
              <FileCode size={18} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white mb-1">{playbook.name}</h2>
              <p className="text-sm text-gray-400">
                File: <span className="text-gray-300 font-mono">{playbook.filename || playbook.name}</span>
              </p>
            </div>
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
              <label className="block text-xs text-gray-500 font-medium mb-1">Engine Type</label>
              <p className="text-sm text-gray-300">{playbook.engine_type || 'Ansible'}</p>
            </div>
            <div>
              <label className="block text-xs text-gray-500 font-medium mb-1">Subnet Target Scope</label>
              <p className="text-sm font-mono text-gray-300">{playbook.subnet_scope || 'global-all'}</p>
            </div>
            <div>
              <label className="block text-xs text-gray-500 font-medium mb-1">Pipeline Status</label>
              <span className={`inline-block px-3 py-1 rounded text-xs font-medium ${statusColors[playbook.pipeline_status] || statusColors.Draft}`}>
                {playbook.pipeline_status || 'Draft'}
              </span>
            </div>
            <div>
              <label className="block text-xs text-gray-500 font-medium mb-1">Severity</label>
              <p className="text-sm text-gray-300 capitalize">{playbook.severity || 'medium'}</p>
            </div>
            <div>
              <label className="block text-xs text-gray-500 font-medium mb-1">Destructive</label>
              <p className="text-sm text-gray-300">{playbook.destructive ? 'Yes' : 'No'}</p>
            </div>
            <div>
              <label className="block text-xs text-gray-500 font-medium mb-1">Last Executed</label>
              <p className="text-sm text-gray-300">
                {playbook.last_executed && playbook.last_executed !== "Never Executed" ? playbook.last_executed : "Never Executed"}
              </p>
            </div>
          </div>

          {/* Description */}
          {playbook.description && (
            <div>
              <label className="block text-xs text-gray-500 font-medium mb-1">Description</label>
              <p className="text-sm text-gray-300">{playbook.description}</p>
            </div>
          )}

          {/* Tags */}
          {tags.length > 0 && (
            <div>
              <label className="block text-xs text-gray-500 font-medium mb-2">Tags</label>
              <div className="flex flex-wrap gap-2">
                {tags.map((tag, i) => (
                  <span key={i} className="px-3 py-1 rounded-lg bg-blue-500/10 border border-blue-500/30 text-blue-400 text-xs font-medium">{tag}</span>
                ))}
              </div>
            </div>
          )}

          {/* Target Devices */}
          {targetDevices.length > 0 && (
            <div>
              <label className="block text-xs text-gray-500 font-medium mb-2">Target Devices</label>
              <div className="flex flex-wrap gap-2">
                {targetDevices.map((dev, i) => (
                  <span key={i} className="px-3 py-1 rounded-lg bg-[#45475a]/50 text-[#cdd6f4] text-xs font-mono">{dev}</span>
                ))}
              </div>
            </div>
          )}

          {/* Example Intents */}
          {intents.length > 0 && (
            <div>
              <label className="block text-xs text-gray-500 font-medium mb-2">Example Intents</label>
              <ul className="space-y-1">
                {intents.map((intent, i) => (
                  <li key={i} className="text-sm text-gray-400 flex items-start gap-2">
                    <span className="text-blue-400 mt-0.5">•</span>
                    {intent}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Content Section */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="block text-sm font-semibold text-gray-400">Playbook Content</label>
              {content && (
                <button
                  onClick={() => handleCopy(content)}
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
            {content ? (
              <div className="rounded-lg border border-[#313244] bg-[#181825] p-4 font-mono text-xs leading-5 max-h-96 overflow-auto">
                {content.split('\n').map((line, index) => (
                  <div key={index} className="whitespace-pre-wrap break-words text-[#cdd6f4]">
                    {line}
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-lg border border-[#313244] bg-[#181825] p-4 text-sm text-gray-500 italic">
                No playbook content available for this blueprint.
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