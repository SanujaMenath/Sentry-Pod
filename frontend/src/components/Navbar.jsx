import React, { useState } from 'react';
import { Search, Bell, X } from 'lucide-react';
import { useLocation } from 'react-router-dom';

export default function Navbar({ search, setSearch }) {

  const [showNotifications, setShowNotifications] = useState(false);

  const location = useLocation();

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

  const placeholder =
    searchPlaceholders[location.pathname] || "Search...";
  return (
    <header
      className="h-16 border-b border-slate-800 flex items-center justify-between px-8 shrink-0"
      style={{
        backgroundColor: "#020618ED",
        fontFamily: '"Inter", sans-serif',
      }}
    >
      {/* 1. Long Search Bar */}
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
        {/* AI Online Indicator */}
        <div className="hidden xl:flex items-center gap-2 px-4 py-1.5 bg-[#00D492]/5 border border-[#00D492]/20 rounded-full">
          <div className="w-1.5 h-1.5 rounded-full bg-[#00D492] animate-pulse"></div>
          <span className="text-[#00D492] text-[11px] font-bold">
            AI Online
          </span>
        </div>

        {/* Notification bell */}
        <div className="relative">
          <div
            onClick={() => setShowNotifications(!showNotifications)}
            className={`relative p-2 rounded-lg transition-all cursor-pointer ${showNotifications ? "bg-slate-800 text-white" : "text-slate-400 hover:text-white"}`}
          >
            <Bell size={20} />
            <span className="absolute top-2 right-2 w-2 h-2 bg-rose-500 border-2 border-[#020618] rounded-full"></span>
          </div>

          {/* DROPDOWN MENU */}
          {showNotifications && (
            <div className="absolute right-0 mt-3 w-80 bg-[#1D293D] border border-slate-700/50 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="p-4 border-b border-slate-800 flex justify-between items-center">
                <span className="text-xs font-bold text-white uppercase tracking-wider">
                  Notifications
                </span>
                <span className="text-[10px] text-blue-400 cursor-pointer hover:underline">
                  Mark all read
                </span>
              </div>

              <div className="max-h-75 overflow-y-auto">
                {[
                  {
                    title: "Drift Detected",
                    msg: "VLAN changed on core-sw-01",
                    time: "2m ago",
                  },
                  {
                    title: "Security Alert",
                    msg: "Multiple failed logins detected",
                    time: "15m ago",
                  },
                  {
                    title: "System Update",
                    msg: "New AI model v2.1 deployed",
                    time: "1h ago",
                  },
                ].map((n, i) => (
                  <div
                    key={i}
                    className="p-4 border-b border-slate-800/50 hover:bg-slate-800/50 transition-colors cursor-pointer"
                  >
                    <div className="flex justify-between items-start mb-1">
                      <p className="text-[13px] font-bold text-slate-200">
                        {n.title}
                      </p>
                      <span className="text-[10px] text-slate-500">
                        {n.time}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-snug">
                      {n.msg}
                    </p>
                  </div>
                ))}
              </div>

              <div className="p-3 text-center bg-slate-900/50">
                <button className="text-[11px] font-bold text-slate-400 hover:text-white transition-colors">
                  View All Activity
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Admin Profile Section */}
        <div className="flex items-center gap-3 border-l border-slate-800 pl-6 shrink-0">
          <div className="w-9 h-9 bg-blue-600 rounded-full flex items-center justify-center text-[11px] font-bold text-white shadow-lg shadow-blue-600/30">
            AD
          </div>
          <div className="text-left leading-tight hidden sm:block">
            <p className="text-[13px] font-bold text-white">Admin</p>
            <p className="text-[10px] text-slate-500">System Administrator</p>
          </div>
        </div>
      </div>
    </header>
  );
}
