import { useEffect, useState } from "react";
import { X, RefreshCw, Loader2, Check, AlertCircle, Database, ArrowDownToLine, ArrowUpFromLine, Trash2, GitCompareArrows } from "lucide-react";
import { getSyncStatus, runSyncNow, resolveSync } from "../services/syncService";

const actionMeta = [
  { key: "incoming", label: "Import from Atlas", icon: ArrowDownToLine, color: "text-sky-400" },
  { key: "local_only", label: "Push to Atlas", icon: ArrowUpFromLine, color: "text-emerald-400" },
  { key: "conflicts", label: "Conflicts", icon: GitCompareArrows, color: "text-amber-400" },
  { key: "deletions", label: "Deletions", icon: Trash2, color: "text-rose-400" },
  { key: "delete_vs_modify", label: "Delete vs Modify", icon: Trash2, color: "text-orange-400" },
];

const summaryText = (doc) => {
  if (!doc || typeof doc !== "object") return "(no summary)";
  const keys = Object.keys(doc).filter((k) => !["id", "password"].includes(k));
  if (keys.length === 0) return "(empty)";
  const preferred = ["username", "name", "email", "full_name", "title", "action_name"];
  for (const p of preferred) {
    if (doc[p] !== undefined) return `${p}: ${String(doc[p])}`;
  }
  return `${keys[0]}: ${String(doc[keys[0]])}`;
};

export default function SyncModal({ onClose, onSynced }) {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [decisions, setDecisions] = useState({});
  const [deleteVsModify, setDeleteVsModify] = useState({});

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const { data } = await getSyncStatus();
      setStatus(data);
      if (!data.atlas_reachable) setError(data.last_error || "Atlas is unreachable — running local only.");
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to load sync status");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const total = (list) => (list || []).length;

  const handleSyncNow = async () => {
    setRunning(true);
    setError("");
    try {
      await runSyncNow();
      await load();
      setSuccess("Scan complete");
      setTimeout(() => setSuccess(""), 2000);
    } catch (err) {
      setError(err.response?.data?.detail || "Sync scan failed");
    } finally {
      setRunning(false);
    }
  };

  const handleApply = async () => {
    setApplying(true);
    setError("");
    try {
      const conflicts = Object.entries(decisions).map(([key, action]) => {
        const [collection, id] = key.split("::");
        return { collection, id, action };
      });
      const dv = Object.entries(deleteVsModify).map(([key, action]) => {
        const [collection, id] = key.split("::");
        return { collection, id, action };
      });
      await resolveSync({ conflicts, delete_vs_modify: dv });
      setSuccess("Sync applied and converged");
      await load();
      onSynced?.();
      setTimeout(() => setSuccess(""), 2500);
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to apply sync");
    } finally {
      setApplying(false);
    }
  };

  const pending = status?.pending || {};
  const totalPending =
    total(pending.incoming) + total(pending.local_only) + total(pending.conflicts) +
    total(pending.deletions) + total(pending.delete_vs_modify);

  const picker = (key, kind, entry) => {
    const current = (kind === "dvm" ? deleteVsModify : decisions)[`${entry.collection}::${entry.id}`];
    const options = [
      { value: "incoming", label: kind === "dvm" ? "Delete locally (Atlas wins)" : "Use Atlas" },
      { value: "local", label: kind === "dvm" ? "Keep local (push back)" : "Use Local" },
    ];
    return (
      <div className="flex gap-2 mt-2">
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => {
              const updater = kind === "dvm" ? setDeleteVsModify : setDecisions;
              updater((prev) => {
                const next = { ...prev };
                const k = `${entry.collection}::${entry.id}`;
                if (current === opt.value) delete next[k];
                else next[k] = opt.value;
                return next;
              });
            }}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-colors ${
              current === opt.value
                ? "bg-blue-600/30 border-blue-500/60 text-blue-300"
                : "bg-slate-800/40 border-slate-700/40 text-slate-400 hover:text-slate-200"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    );
  };

  const renderSection = (kind, entries) => {
    if (!entries || entries.length === 0) return null;
    const meta = actionMeta.find((m) => m.key === kind);
    const Icon = meta.icon;
    return (
      <div className="mb-4">
        <h4 className={`flex items-center gap-2 text-xs font-bold uppercase tracking-wider mb-2 ${meta.color}`}>
          <Icon size={13} /> {meta.label} <span className="text-slate-500">({entries.length})</span>
        </h4>
        <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
          {entries.map((entry, i) => (
            <div key={i} className="rounded-lg border border-slate-700/40 bg-slate-900/40 px-3 py-2">
              {kind === "conflicts" ? (
                <>
                  <div className="text-[12px] text-slate-300 font-medium">
                    {entry.collection} · {entry.id.slice(-6)}
                    {entry.by_key ? <span className="ml-2 text-[10px] text-amber-400">duplicate key</span> : null}
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-1.5 text-[11px]">
                    <div className="rounded bg-sky-500/10 border border-sky-500/20 p-1.5 text-slate-400">
                      <span className="text-sky-400">Atlas:</span> {summaryText(entry.atlas)}
                    </div>
                    <div className="rounded bg-emerald-500/10 border border-emerald-500/20 p-1.5 text-slate-400">
                      <span className="text-emerald-400">Local:</span> {summaryText(entry.vault)}
                    </div>
                  </div>
                  {picker(entry.id, "conflict", entry)}
                </>
              ) : kind === "delete_vs_modify" ? (
                <>
                  <div className="text-[12px] text-slate-300 font-medium">
                    {entry.collection} · {entry.id.slice(-6)}
                  </div>
                  <div className="mt-1 text-[11px] text-slate-400">
                    Deleted in Atlas but modified locally — {summaryText(entry.vault)}
                  </div>
                  {picker(entry.id, "dvm", entry)}
                </>
              ) : (
                <div className="text-[12px] text-slate-300 font-medium flex justify-between">
                  <span>{entry.collection} · {entry.id.slice(-6)}</span>
                  <span className="text-slate-500 truncate max-w-[55%]">{summaryText(entry.summary || entry.vault)}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative z-10 m-auto bg-[#161b22] border border-[#1e2530] rounded-2xl w-160 shadow-2xl max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-[#1e2530] shrink-0">
          <div className="flex items-center gap-2">
            <Database size={18} className="text-sky-400" />
            <h2 className="text-white font-semibold text-base">Atlas Sync</h2>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white"><X size={18} /></button>
        </div>

        <div className="p-5 overflow-y-auto flex-1">
          {loading ? (
            <div className="flex items-center justify-center gap-2 text-gray-400 py-10">
              <Loader2 size={18} className="animate-spin" /> Loading…
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 mb-4">
                <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${status?.atlas_reachable ? "bg-green-500/20 text-green-300 border border-green-500/30" : "bg-amber-500/20 text-amber-300 border border-amber-500/30"}`}>
                  {status?.atlas_reachable ? "Atlas reachable" : "Atlas unreachable — local only"}
                </span>
                {status?.last_sync && (
                  <span className="text-[11px] text-slate-500">Last scan: {new Date(status.last_sync).toLocaleString()}</span>
                )}
              </div>

              {error && (
                <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-red-500/20 border border-red-500/30 text-red-300 text-xs mb-4">
                  <AlertCircle size={14} className="mt-0.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}
              {success && (
                <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-green-500/20 border border-green-500/30 text-green-300 text-xs mb-4">
                  <Check size={14} className="mt-0.5 shrink-0" />
                  <span>{success}</span>
                </div>
              )}

              {totalPending === 0 ? (
                <div className="py-10 text-center text-slate-500 text-sm">
                  All collections are in sync. Nothing pending.
                </div>
              ) : (
                <div className="mb-4 px-3 py-2 rounded-lg bg-slate-800/40 text-xs text-slate-300">
                  <span className="font-bold text-white">{totalPending}</span> pending change{totalPending === 1 ? "" : "s"} across{" "}
                  {Object.keys(status?.collections || {}).length} synced collections.
                </div>
              )}

              {renderSection("incoming", pending.incoming)}
              {renderSection("local_only", pending.local_only)}
              {renderSection("conflicts", pending.conflicts)}
              {renderSection("deletions", pending.deletions)}
              {renderSection("delete_vs_modify", pending.delete_vs_modify)}
            </>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 p-5 border-t border-[#1e2530] shrink-0">
          <button
            type="button"
            onClick={handleSyncNow}
            disabled={running || loading}
            className="px-3 py-2 rounded-lg border border-slate-600 bg-slate-700/40 text-white text-xs font-medium hover:bg-slate-700/60 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 transition-all"
          >
            {running ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
            Scan now
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="py-2.5 px-4 bg-[#0d1117] border border-[#1e2530] text-gray-400 rounded-lg text-xs font-medium hover:text-gray-300 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleApply}
              disabled={applying || loading || totalPending === 0}
              className="py-2.5 px-4 bg-sky-600 hover:bg-sky-500 text-white rounded-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed text-xs font-medium transition-all"
            >
              {applying && <Loader2 size={14} className="animate-spin" />}
              Apply Sync
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}