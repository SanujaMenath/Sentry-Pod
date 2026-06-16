import React from "react";
import { Lock, X } from "lucide-react";

export default function PermissionModal({ isOpen, onClose, requiredRole }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-xl border border-red-900/30 bg-[#0f172a] p-6 shadow-2xl text-slate-200">
        <div className="flex justify-end">
          <button onClick={onClose} className="text-slate-400 hover:text-white transition">
            <X size={20} />
          </button>
        </div>
        
        <div className="flex flex-col items-center text-center space-y-4">
          <div className="rounded-full bg-red-950/50 p-4 border border-red-500/30 text-red-400">
            <Lock size={40} className="animate-pulse" />
          </div>
          <h2 className="text-xl font-semibold tracking-wide text-white">Access Denied</h2>
          <p className="text-sm text-slate-400">
            Your current account access privileges do not permit viewing this administrative layout space.
          </p>
          <div className="rounded bg-slate-900 px-3 py-1.5 text-xs font-mono text-red-400 border border-slate-800">
            Requires level: {requiredRole}
          </div>
        </div>

        <button 
          onClick={onClose}
          className="mt-6 w-full rounded-lg bg-red-600 py-2.5 text-sm font-medium text-white hover:bg-red-500 transition duration-200"
        >
          Acknowledge & Exit
        </button>
      </div>
    </div>
  );
}