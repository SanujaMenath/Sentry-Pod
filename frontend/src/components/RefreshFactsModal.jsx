import { useEffect, useRef, useState } from "react";
import { X, RefreshCw, CheckCircle, AlertCircle } from "lucide-react";
import { getRefreshFactsUrl } from "../services/networkService";

export default function RefreshFactsModal({ onClose, onComplete }) {
  const [lines, setLines] = useState([]);
  const [status, setStatus] = useState("connecting");
  const [counts, setCounts] = useState(null);
  const [dismissed, setDismissed] = useState(false);
  const logRef = useRef(null);
  const doneRef = useRef(false);

  useEffect(() => {
    const url = getRefreshFactsUrl();
    const source = new EventSource(url);

    source.onopen = () => {
      setStatus("running");
    };

    source.addEventListener("message", (event) => {
      try {
        const data = JSON.parse(event.data);
        switch (data.type) {
          case "output":
            setLines((prev) => [...prev, data.line]);
            break;
          case "status":
            setLines((prev) => [...prev, data.message]);
            break;
          case "counts":
            setCounts(data);
            break;
          case "complete":
            doneRef.current = true;
            setStatus("complete");
            setLines((prev) => [...prev, `\u2713 ${data.message}`]);
            break;
          case "error":
            doneRef.current = true;
            setStatus("error");
            setLines((prev) => [...prev, `\u2717 Error: ${data.message}`]);
            break;
        }
      } catch {
        // ignore malformed events
      }
    });

    source.onerror = () => {
      if (doneRef.current) return;
      doneRef.current = true;
      setStatus("error");
      setLines((prev) => [...prev, "\u2717 Connection lost"]);
      source.close();
    };

    return () => {
      source.close();
    };
  }, []);

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [lines]);

  useEffect(() => {
    if (doneRef.current && dismissed) {
      const timer = setTimeout(() => {
        onComplete?.();
        onClose();
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [dismissed, status]);

  const handleDismiss = () => {
    if (doneRef.current) {
      onComplete?.();
      onClose();
    } else {
      setDismissed(true);
    }
  };

  const isDone = status === "complete" || status === "error";

  const handleDone = () => {
    onComplete?.();
    onClose();
  };

  return (
    <>
      {!dismissed && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="flex h-[480px] w-[640px] flex-col rounded-2xl border border-slate-700 bg-[#0F172A] shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
              <div className="flex items-center gap-3">
                {!isDone ? (
                  <RefreshCw size={20} className="animate-spin text-blue-400" />
                ) : status === "complete" ? (
                  <CheckCircle size={20} className="text-emerald-400" />
                ) : (
                  <AlertCircle size={20} className="text-rose-400" />
                )}
                <div>
                  <h2 className="text-sm font-bold text-white">Refresh Device Facts</h2>
                  <p className="text-xs text-slate-500">
                    {status === "connecting" && "Connecting..."}
                    {status === "running" && "Gathering facts from devices..."}
                    {status === "complete" && "Facts refreshed successfully"}
                    {status === "error" && "Facts refresh failed"}
                  </p>
                </div>
              </div>
              <button onClick={handleDismiss} className="text-slate-500 hover:text-white">
                <X size={18} />
              </button>
            </div>

            <div
              ref={logRef}
              className="flex-1 overflow-y-auto p-4 font-mono text-xs leading-relaxed"
            >
              {lines.length === 0 && status === "connecting" && (
                <p className="text-slate-600">Connecting to server...</p>
              )}
              {lines.map((line, i) => (
                <p key={i} className="text-slate-300">
                  {line}
                </p>
              ))}
            </div>

            {counts && (
              <div className="flex items-center gap-6 border-t border-slate-800 px-5 py-3 text-xs text-slate-400">
                <span>Total: {counts.total}</span>
                <span className="text-emerald-400">Updated: {counts.updated}</span>
                {counts.failed > 0 && <span className="text-rose-400">Failed: {counts.failed}</span>}
              </div>
            )}

            {isDone && (
              <div className="border-t border-slate-800 px-5 py-3">
                <button
                  onClick={handleDone}
                  className="w-full rounded-xl bg-blue-600 py-2.5 text-sm font-bold text-white hover:bg-blue-500"
                >
                  {status === "complete" ? "Done" : "Close"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {dismissed && !isDone && (
        <div className="fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-xl border border-slate-700 bg-[#1D293D] px-4 py-3 shadow-xl">
          <RefreshCw size={16} className="animate-spin text-blue-400" />
          <span className="text-sm font-medium text-slate-200">Refreshing device facts...</span>
        </div>
      )}
    </>
  );
}
