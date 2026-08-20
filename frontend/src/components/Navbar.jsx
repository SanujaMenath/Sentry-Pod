import React, { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, Bell, CheckCircle2, Info, Search, X, XCircle } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { clearNotifications, getNotifications, markAllNotificationsRead, markNotificationRead } from "../services/notificationService";
import { getSystemHealth } from "../services/syncService";

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

const searchPlaceholders = {
  "/users": "Search users...",
  "/network-devices": "Search devices...",
  "/audit-logs": "Search audit logs...",
  "/topology": "Search topology nodes...",
  "/ai-chat": "Search AI chats...",
  "/dashboard": "Search dashboard data...",
  "/playbooks": "Search playbooks...",
  "/profile": "Search profile settings...",
};

const playNotificationSound = () => {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const context = new AudioContext();
    [0, 0.14].forEach((start, index) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.frequency.value = index ? 880 : 660;
      gain.gain.setValueAtTime(0.0001, context.currentTime + start);
      gain.gain.exponentialRampToValueAtTime(0.12, context.currentTime + start + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + start + 0.12);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start(context.currentTime + start);
      oscillator.stop(context.currentTime + start + 0.13);
    });
    window.setTimeout(() => context.close(), 400);
  } catch {
    // Browsers can block sound until the user has interacted with the page.
  }
};

export default function Navbar({ search, setSearch }) {
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [vaultOnline, setVaultOnline] = useState(true);
  const notificationMenuRef = useRef(null);
  const initializedRef = useRef(false);
  const knownUnreadIdsRef = useRef(new Set());
  const location = useLocation();
  const navigate = useNavigate();
  const placeholder = searchPlaceholders[location.pathname] || "Search...";
  const [hasApiKey, setHasApiKey] = useState(null);

  const loadNotifications = useCallback(async () => {
    try {
      const { data } = await getNotifications();
      const items = data.items || [];
      const unreadIds = new Set(items.filter((item) => !item.read).map((item) => item.id));
      if (initializedRef.current && data.preferences?.sound_enabled && [...unreadIds].some((id) => !knownUnreadIdsRef.current.has(id))) playNotificationSound();
      initializedRef.current = true;
      knownUnreadIdsRef.current = unreadIds;
      setNotifications(items);
      setUnreadCount(data.unread_count || 0);
    } catch (error) {
      console.error("Failed to load notifications", error);
    }
  }, []);

  useEffect(() => {
    const initialTimer = window.setTimeout(loadNotifications, 0);
    const timer = window.setInterval(loadNotifications, 10000);
    return () => {
      window.clearTimeout(initialTimer);
      window.clearInterval(timer);
    };
  }, [loadNotifications]);

  useEffect(() => {
    const checkApiKey = async () => {
      try {
        const response = await fetch(`${API_BASE}/llm/api-key-status`);
        if (!response.ok) throw new Error("Failed to fetch API key status");
        const data = await response.json();
        setHasApiKey(!!data.has_key);
      } catch (error) {
        console.error("Failed to check API key status", error);
      }
    };
    checkApiKey();
    const timer = window.setInterval(checkApiKey, 10000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const checkHealth = () => {
      getSystemHealth()
        .then(({ data }) => setVaultOnline(!!data.vault))
        .catch(() => setVaultOnline(false));
    };
    checkHealth();
    const timer = window.setInterval(checkHealth, 30000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const closeOnOutsideClick = (event) => {
      if (notificationMenuRef.current && !notificationMenuRef.current.contains(event.target)) setShowNotifications(false);
    };
    const closeOnEscape = (event) => { if (event.key === "Escape") setShowNotifications(false); };
    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, []);

  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsRead();
      setNotifications((items) => items.map((item) => ({ ...item, read: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error("Failed to mark notifications read", error);
    }
  };

  const handleNotificationClick = async (notification) => {
    if (notification.read) return;
    try {
      await markNotificationRead(notification.id);
      setNotifications((items) => items.map((item) => item.id === notification.id ? { ...item, read: true } : item));
      setUnreadCount((count) => Math.max(0, count - 1));
    } catch (error) {
      console.error("Failed to mark notification read", error);
    }
  };

  const handleClear = async () => {
    try {
      await clearNotifications();
      setNotifications([]);
      setUnreadCount(0);
      knownUnreadIdsRef.current = new Set();
      setShowNotifications(false);
    } catch (error) {
      console.error("Failed to clear notifications", error);
    }
  };

  const notificationIcon = (severity) => {
    if (severity === "success") return <CheckCircle2 size={16} className="text-emerald-400" />;
    if (severity === "critical") return <XCircle size={16} className="text-rose-400" />;
    if (severity === "warning") return <AlertTriangle size={16} className="text-amber-400" />;
    return <Info size={16} className="text-blue-400" />;
  };

  const formatTime = (value) => new Date(value).toLocaleString([], {
    month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
  });

  return (
    <header className="h-16 border-b border-slate-800 flex items-center justify-between px-8 shrink-0" style={{ backgroundColor: "#020618ED", fontFamily: '"Inter", sans-serif' }}>
      <div className="relative flex-1 max-w-2xl">
        <Search
          className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500"
          size={18}
        />

        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={placeholder}
          className="w-full bg-[#0D121F] border border-slate-700/50 rounded-xl py-2 pl-12 pr-4 text-sm text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500/30 transition-all"
        />
        {search && (
    <button
      onClick={() => setSearch("")}
      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
    >
      <X size={14} />
    </button>
  )}
      </div>

      <div className="flex items-center gap-6 ml-8">
        {!vaultOnline && (
          <div className="flex items-center gap-2 px-4 py-1.5 bg-amber-500/10 border border-amber-500/30 rounded-full">
            <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            <span className="text-amber-400 text-[11px] font-bold">Vault Offline</span>
          </div>
        )}

        <button
          type="button"
          onClick={() => navigate("/ai-chat")}
          title={hasApiKey === false ? "No API key configured — open AI Chat Console" : "AI Chat Console"}
          className={`hidden xl:flex items-center gap-2 px-4 py-1.5 rounded-full border transition-colors cursor-pointer ${
            hasApiKey === false
              ? "bg-rose-500/5 border-rose-500/30"
              : hasApiKey === true
                ? "bg-[#00D492]/5 border-[#00D492]/20"
                : "bg-slate-500/5 border-slate-500/30"
          }`}
        >
          <div className={`w-1.5 h-1.5 rounded-full ${hasApiKey === null ? "" : "animate-pulse"} ${
            hasApiKey === false ? "bg-rose-500" : hasApiKey === true ? "bg-[#00D492]" : "bg-slate-500"
          }`} />
          <span className={`text-[11px] font-bold ${
            hasApiKey === false ? "text-rose-500" : hasApiKey === true ? "text-[#00D492]" : "text-slate-400"
          }`}>
            {hasApiKey === false ? "AI Offline" : "AI Online"}
          </span>
        </button>

        <div className="relative" ref={notificationMenuRef}>
          <button type="button" onClick={() => setShowNotifications((visible) => !visible)} className={`relative p-2 rounded-lg transition-all ${showNotifications ? "bg-slate-800 text-white" : "text-slate-400 hover:text-white"}`} aria-label="Open notifications">
            <Bell size={20} />
            {unreadCount > 0 && <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 bg-rose-500 border-2 border-[#020618] rounded-full text-[9px] leading-3 text-white text-center">{unreadCount > 99 ? "99+" : unreadCount}</span>}
          </button>

          {showNotifications && (
            <div className="absolute right-0 mt-3 w-80 bg-[#1D293D] border border-slate-700/50 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] z-50 overflow-hidden">
              <div className="p-4 border-b border-slate-800 flex justify-between items-center">
                <span className="text-xs font-bold text-white uppercase tracking-wider">Notifications</span>
                <div className="flex items-center gap-3">
                  <button type="button" onClick={handleClear} disabled={notifications.length === 0} className="text-[10px] text-slate-400 hover:text-white disabled:text-slate-600">Clear</button>
                  <button type="button" onClick={handleMarkAllRead} disabled={unreadCount === 0} className="text-[10px] text-blue-400 hover:underline disabled:text-slate-600 disabled:no-underline">Mark all read</button>
                </div>
              </div>
              <div className="max-h-75 overflow-y-auto">
                {notifications.length === 0 ? <p className="p-6 text-center text-xs text-slate-500">No notifications yet.</p> : notifications.map((notification) => (
                  <button type="button" key={notification.id} onClick={() => handleNotificationClick(notification)} className={`w-full text-left p-4 border-b border-slate-800/50 hover:bg-slate-800/50 transition-colors ${notification.read ? "opacity-70" : "bg-blue-500/5"}`}>
                    <div className="flex gap-2 justify-between items-start mb-1">
                      <div className="flex gap-2"><span className="mt-0.5">{notificationIcon(notification.severity)}</span><p className="text-[13px] font-bold text-slate-200">{notification.title}</p></div>
                      <span className="text-[10px] text-slate-500 shrink-0">{formatTime(notification.created_at)}</span>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-snug pl-6">{notification.message}</p>
                  </button>
                ))}
              </div>
              <div className="p-3 text-center bg-slate-900/50"><span className="text-[11px] font-bold text-slate-500">Live system activity</span></div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 border-l border-slate-800 pl-6 shrink-0">
          <div className="w-9 h-9 bg-blue-600 rounded-full flex items-center justify-center text-[11px] font-bold text-white shadow-lg shadow-blue-600/30">AD</div>
          <div className="text-left leading-tight hidden sm:block"><p className="text-[13px] font-bold text-white">Admin</p><p className="text-[10px] text-slate-500">System Administrator</p></div>
        </div>
      </div>
    </header>
  );
}
