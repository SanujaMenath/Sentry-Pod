import React, { useState } from "react";
import { AlertTriangle, CheckCircle, XCircle } from "lucide-react";

const severityColors = {
  critical: {
    badge: "bg-red-600/20 border-red-600/50 text-red-300",
    icon: "text-red-400",
    button: "bg-red-600/20 border-red-600/50 hover:bg-red-600/30 text-red-300",
  },
  high: {
    badge: "bg-orange-600/20 border-orange-600/50 text-orange-300",
    icon: "text-orange-400",
    button: "bg-orange-600/20 border-orange-600/50 hover:bg-orange-600/30 text-orange-300",
  },
  medium: {
    badge: "bg-yellow-600/20 border-yellow-600/50 text-yellow-300",
    icon: "text-yellow-400",
    button: "bg-yellow-600/20 border-yellow-600/50 hover:bg-yellow-600/30 text-yellow-300",
  },
  low: {
    badge: "bg-blue-600/20 border-blue-600/50 text-blue-300",
    icon: "text-blue-400",
    button: "bg-blue-600/20 border-blue-600/50 hover:bg-blue-600/30 text-blue-300",
  },
};

const severityLabels = {
  critical: "🚨 CRITICAL - PERMANENT CHANGES",
  high: "⚠️ HIGH RISK - Configuration Impact",
  medium: "⚡ MEDIUM RISK - Modify Settings",
  low: "ℹ️ LOW RISK - Minor Changes",
};

export default function PlaybookStagingGate({ playbook, details, onApprove, onReject, isOpen }) {
  const [confirmed, setConfirmed] = useState(false);
  const severity = playbook?.severity || "medium";
  const colors = severityColors[severity];

  if (!isOpen || !playbook) return null;

  const handleApprove = () => {
    if (playbook.severity === "critical" && !confirmed) {
      alert("You must confirm that you understand the permanent nature of this change.");
      return;
    }
    onApprove(playbook.filename);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-2xl bg-[#1D293DED] border border-slate-700/50 shadow-2xl">
        {/* Header */}
        <div className={`border-b border-slate-700/50 p-6 ${colors.badge}`}>
          <div className="flex items-center gap-3">
            <AlertTriangle size={28} className={colors.icon} />
            <div>
              <p className="text-sm font-semibold opacity-80">Deployment Review Required</p>
              <p className="text-lg font-bold">{severityLabels[severity]}</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {/* Playbook Info */}
          <div className="rounded-lg bg-slate-800/30 p-4 border border-slate-700/30">
            <h3 className="text-lg font-bold text-white mb-2">{playbook.name}</h3>
            <p className="text-sm text-slate-300 mb-3">{playbook.description}</p>
            <div className="flex flex-wrap gap-2">
              {playbook.tags.slice(0, 4).map((tag) => (
                <span
                  key={tag}
                  className="inline-block bg-slate-700/50 text-slate-200 rounded px-2 py-1 text-xs"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>

          {/* Target Devices */}
          <div>
            <p className="text-sm font-semibold text-slate-300 mb-2">Target Devices:</p>
            <p className="text-sm text-slate-400">
              {playbook.target_devices.join(", ")}
            </p>
          </div>

          {/* Configuration Details */}
          {details && details.length > 0 && (
            <div>
              <p className="text-sm font-semibold text-slate-300 mb-2">Configuration Details:</p>
              <div className="overflow-hidden rounded-xl bg-[#172231] border border-slate-700/50">
                {details.map((d, i) => (
                  <div
                    key={d.key}
                    className={`flex items-center justify-between gap-4 px-4 py-2.5 ${i > 0 ? "border-t border-slate-700/50" : ""}`}
                  >
                    <span className="text-sm text-slate-400">{d.key}</span>
                    <span className="font-mono text-sm font-bold text-emerald-400 break-all">{d.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Risk Warning */}
          <div className={`rounded-lg border ${colors.badge} p-4`}>
            <p className="text-sm font-semibold text-slate-200">⚠️ Impact of This Change:</p>
            <ul className="mt-2 space-y-1 text-sm text-slate-300 list-disc list-inside">
              {severity === "critical" && (
                <>
                  <li>This playbook writes configurations to NVRAM - changes are PERMANENT</li>
                  <li>Cannot be undone without manual device intervention</li>
                  <li>Will affect ALL targeted devices immediately</li>
                </>
              )}
              {severity === "high" && (
                <>
                  <li>Significant configuration changes to network devices</li>
                  <li>May cause temporary network disruption</li>
                  <li>Should be scheduled during maintenance window</li>
                </>
              )}
              {severity === "medium" && (
                <>
                  <li>Moderate configuration changes to devices</li>
                  <li>May have operational impact</li>
                </>
              )}
              {severity === "low" && (
                <>
                  <li>Minor configuration changes</li>
                  <li>Low risk of network disruption</li>
                </>
              )}
            </ul>
          </div>

          {/* Critical Confirmation */}
          {severity === "critical" && (
            <div className="rounded-lg bg-red-900/20 border border-red-600/30 p-4">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(e) => setConfirmed(e.target.checked)}
                  className="mt-1 w-4 h-4 rounded border-slate-500 bg-slate-700"
                />
                <span className="text-sm text-slate-300">
                  I understand this change is <span className="font-bold text-red-300">PERMANENT</span> and cannot be easily reverted. I have verified the target devices and accept the risks.
                </span>
              </label>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="border-t border-slate-700/50 bg-slate-800/20 p-6 flex gap-3">
          <button
            onClick={() => onReject(playbook.filename)}
            className="flex-1 flex items-center justify-center gap-2 rounded-lg border border-slate-600 bg-slate-700/40 px-4 py-3 text-sm font-bold text-slate-200 transition-colors hover:bg-slate-700/60"
          >
            <XCircle size={18} />
            Cancel & Do Not Execute
          </button>
          <button
            onClick={handleApprove}
            disabled={severity === "critical" && !confirmed}
            className={`flex-1 flex items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${colors.button}`}
          >
            <CheckCircle size={18} />
            Approve & Execute
          </button>
        </div>
      </div>
    </div>
  );
}
