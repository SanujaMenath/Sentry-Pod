import React, { useState } from "react";
import { ChevronDown, ChevronUp, Check, Copy, AlertTriangle, Play, X } from "lucide-react";
import DiffViewer from "./DiffViewer";
import { useCopyToClipboard } from "../hooks/useCopyToClipboard";

const severityColors = {
  critical: "bg-red-600/20 border-red-600/50 text-red-400",
  high: "bg-orange-600/20 border-orange-600/50 text-orange-400",
  medium: "bg-yellow-600/20 border-yellow-600/50 text-yellow-400",
  low: "bg-blue-600/20 border-blue-600/50 text-blue-400",
};

export default function PlaybookModificationCard({
  modification,
  onApprove,
  onReject,
  onExecute,
  isSaving,
  isSaved,
}) {
  const [showDiff, setShowDiff] = useState(false);
  const { copied, handleCopy } = useCopyToClipboard();

  const {
    proposed_name,
    diff,
    metadata,
    plain_explanation,
  } = modification;

  const severity = metadata?.severity || "medium";
  const destructive = metadata?.destructive || false;

  return (
    <div className="mt-3 rounded-xl border border-violet-500/30 bg-[#1e1e2e] p-4 shadow-inner shadow-black/20">
      <div className="mb-3 flex items-center gap-2">
        <span className="rounded-lg bg-violet-600/30 px-2 py-1 text-xs font-bold text-violet-200">
          Proposed Modification
        </span>
        {destructive && (
          <span className="flex items-center gap-1 rounded-lg bg-red-600/30 px-2 py-1 text-xs font-bold text-red-200">
            <AlertTriangle size={12} />
            Destructive
          </span>
        )}
      </div>

      <p className="mb-3 text-sm text-[#cdd6f4]">{plain_explanation}</p>

      <div className="mb-3 flex flex-wrap gap-2">
        <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${severityColors[severity]}`}>
          {severity}
        </span>
        {(metadata?.tags || []).slice(0, 4).map((tag) => (
          <span key={tag} className="rounded-full border border-sky-600/30 bg-sky-600/10 px-2.5 py-0.5 text-xs text-sky-300">
            {tag}
          </span>
        ))}
        {(metadata?.target_devices || []).slice(0, 3).map((dev) => (
          <span key={dev} className="rounded-full border border-emerald-600/30 bg-emerald-600/10 px-2.5 py-0.5 text-xs text-emerald-300">
            {dev}
          </span>
        ))}
      </div>

      <div className="mb-3 flex items-center gap-2">
        <span className="text-xs text-[#a6adc8]">Save as:</span>
        <code className="rounded bg-[#313244] px-2 py-0.5 text-xs text-[#f5c2e7]">{proposed_name}</code>
      </div>

      <button
        onClick={() => setShowDiff(!showDiff)}
        className="mb-3 flex w-full items-center justify-between rounded-lg border border-[#45475a] bg-[#181825] px-3 py-2 text-sm text-[#cdd6f4] transition-colors hover:bg-[#313244]"
      >
        <span className="font-mono text-xs">View YAML diff</span>
        {showDiff ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>

      {showDiff && diff && (
        <div className="mb-3 max-h-80 overflow-auto rounded-lg border border-[#313244] bg-[#181825]">
          <DiffViewer diffContent={diff} />
        </div>
      )}

      {isSaved ? (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={onExecute}
            className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-700"
          >
            <Play size={16} />
            Execute Now
          </button>
          <button
            onClick={onReject}
            className="flex items-center gap-2 rounded-lg border border-[#45475a] bg-[#313244] px-4 py-2 text-sm text-[#cdd6f4] transition-colors hover:bg-[#45475a]"
          >
            Not Now
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={onApprove}
            disabled={isSaving}
            className="flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSaving ? (
              <>
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Saving...
              </>
            ) : (
              <>
                <Check size={16} />
                Approve & Save
              </>
            )}
          </button>
          <button
            onClick={onReject}
            disabled={isSaving}
            className="flex items-center gap-2 rounded-lg border border-[#45475a] bg-[#313244] px-4 py-2 text-sm text-[#cdd6f4] transition-colors hover:bg-[#45475a] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <X size={16} />
            Reject
          </button>
          <button
            onClick={() => handleCopy(diff || "")}
            className="flex items-center gap-2 rounded-lg border border-[#45475a] bg-[#313244] px-3 py-2 text-xs text-[#cdd6f4] transition-colors hover:bg-[#45475a]"
            title="Copy diff to clipboard"
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
            <span>Copy Diff</span>
          </button>
        </div>
      )}
    </div>
  );
}
