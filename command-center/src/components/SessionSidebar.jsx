import React, { useState } from "react";
import { MessageSquare, Plus, Trash2, ChevronLeft } from "lucide-react";

function formatRelativeTime(dateStr) {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

export default function SessionSidebar({
  sessions,
  activeSessionId,
  onSelectSession,
  onNewSession,
  onDeleteSession,
  isOpen,
  onToggle,
}) {
  const [deletingId, setDeletingId] = useState(null);

  const handleDelete = (e, sessionId) => {
    e.stopPropagation();
    if (deletingId === sessionId) {
      onDeleteSession(sessionId);
      setDeletingId(null);
    } else {
      setDeletingId(sessionId);
      setTimeout(() => setDeletingId(null), 3000);
    }
  };

  return (
    <>
      <div
        className={`fixed left-0 top-0 z-30 flex h-full flex-col bg-[#1D293D] border-r border-slate-700/50 shadow-2xl transition-all duration-300 ${
          isOpen ? "w-72 translate-x-0" : "w-72 -translate-x-full"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-700/50 px-4 py-4">
          <h2 className="text-sm font-bold text-slate-200">Sessions</h2>
          <button
            onClick={onToggle}
            className="rounded-lg p-1.5 text-slate-400 transition-all hover:bg-slate-700/50 hover:text-white"
            title="Close sidebar"
          >
            <ChevronLeft size={16} />
          </button>
        </div>

        {/* New Chat button */}
        <div className="px-3 py-3">
          <button
            onClick={onNewSession}
            className="flex w-full items-center gap-2 rounded-xl border border-dashed border-slate-600 bg-slate-800/30 px-3 py-2.5 text-sm text-slate-300 transition-all hover:border-blue-500/50 hover:bg-blue-600/10 hover:text-blue-300"
          >
            <Plus size={16} />
            <span>New Chat</span>
          </button>
        </div>

        {/* Session list */}
        <div className="flex-1 overflow-y-auto px-3 pb-4">
          {sessions.length === 0 ? (
            <p className="mt-6 text-center text-xs text-slate-500">No saved sessions yet</p>
          ) : (
            <div className="space-y-1">
              {sessions.map((session) => {
                const isActive = session.session_id === activeSessionId;
                return (
                  <div
                    key={session.session_id}
                    onClick={() => onSelectSession(session.session_id)}
                    className={`group flex cursor-pointer items-start gap-3 rounded-xl px-3 py-2.5 transition-all ${
                      isActive
                        ? "bg-blue-600/15 text-blue-200"
                        : "text-slate-300 hover:bg-slate-700/40 hover:text-white"
                    }`}
                  >
                    <MessageSquare
                      size={15}
                      className={`mt-0.5 shrink-0 ${isActive ? "text-blue-400" : "text-slate-500 group-hover:text-slate-300"}`}
                    />
                    <div className="min-w-0 flex-1">
                      <p className={`truncate text-sm ${isActive ? "font-semibold" : ""}`}>
                        {session.title || "New Chat"}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {formatRelativeTime(session.updated_at)} &middot; {Math.ceil(session.message_count / 2)} exchanges
                      </p>
                    </div>
                    <button
                      onClick={(e) => handleDelete(e, session.session_id)}
                      className={`shrink-0 rounded-lg p-1.5 transition-all ${
                        deletingId === session.session_id
                          ? "bg-red-500/20 text-red-400"
                          : "text-slate-600 opacity-0 group-hover:opacity-100 hover:text-red-400 hover:opacity-100"
                      }`}
                      title={deletingId === session.session_id ? "Click again to confirm" : "Delete session"}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Overlay when sidebar is open on smaller screens */}
      {isOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/30 lg:hidden"
          onClick={onToggle}
        />
      )}
    </>
  );
}
