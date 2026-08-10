import React, { useState, useEffect, useRef, useCallback } from "react";
import { Shield, Lock, Eye, EyeOff, XCircle } from "lucide-react";
import { login } from "../services/authService";

const INACTIVITY_TIMEOUT = 10 * 60 * 1000; // 10 minutes

export default function ConsoleAuthGate({ children }) {
  const [authenticated, setAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [timeLeft, setTimeLeft] = useState(INACTIVITY_TIMEOUT);
  const timerRef = useRef(null);
  const countdownRef = useRef(null);
  const originalTokenRef = useRef(null);

  const lockConsole = useCallback(() => {
    setAuthenticated(false);
    setPassword("");
    setError("Session expired due to inactivity. Please re-enter your password.");
    clearTimeout(timerRef.current);
    clearInterval(countdownRef.current);
  }, []);

  const resetTimer = useCallback(() => {
    clearTimeout(timerRef.current);
    clearInterval(countdownRef.current);
    setTimeLeft(INACTIVITY_TIMEOUT);

    timerRef.current = setTimeout(() => {
      lockConsole();
    }, INACTIVITY_TIMEOUT);

    countdownRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1000) return 0;
        return prev - 1000;
      });
    }, 1000);
  }, [lockConsole]);

  useEffect(() => {
    if (!authenticated) return;

    const events = ["mousemove", "keydown", "mousedown", "touchstart"];
    events.forEach((e) => window.addEventListener(e, resetTimer));
    resetTimer();

    return () => {
      events.forEach((e) => window.removeEventListener(e, resetTimer));
      clearTimeout(timerRef.current);
      clearInterval(countdownRef.current);
    };
  }, [authenticated, resetTimer]);

  const handleSubmit = async () => {
    setIsLoading(true);
    setError("");
    try {
      // Save original token before login overwrites it
      originalTokenRef.current = localStorage.getItem("token");
      const username = JSON.parse(atob(originalTokenRef.current.split(".")[1])).sub;
      await login(username, password);
      // Restore original token so session stays intact
      localStorage.setItem("token", originalTokenRef.current);
      setAuthenticated(true);
      setPassword("");
    } catch {
      setError("Incorrect password. Please try again.");
      // Restore original token if login failed
      if (originalTokenRef.current) {
        localStorage.setItem("token", originalTokenRef.current);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const formatTime = (ms) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  if (authenticated) {
    return (
      <div className="h-full w-full relative">
        {/* Session Timer */}
        <div className="absolute top-2 right-4 z-10 flex items-center gap-2 bg-slate-800/80 border border-slate-700 rounded-lg px-3 py-1.5">
          <Lock size={12} className="text-slate-400" />
          <span className={`text-xs font-mono ${timeLeft < 60000 ? "text-red-400" : "text-slate-400"}`}>
            {formatTime(timeLeft)}
          </span>
        </div>
        {children}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-[#1D293DED] border border-slate-700/50 shadow-2xl">
        {/* Header */}
        <div className="border-b border-slate-700/50 p-6 bg-yellow-600/10">
          <div className="flex items-center gap-3">
            <Shield size={28} className="text-yellow-400" />
            <div>
              <p className="text-sm font-semibold text-yellow-300 opacity-80">
                Privileged Access Required
              </p>
              <p className="text-lg font-bold text-white">
                Console Authentication
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          <div className="rounded-lg bg-slate-800/30 p-4 border border-slate-700/30">
            <p className="text-sm text-slate-300">
              The network console provides direct shell access to network devices.
              Please verify your identity before proceeding.
            </p>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-rose-400 text-xs font-semibold p-3 bg-rose-500/10 rounded-xl border border-rose-500/20">
              <XCircle size={14} />
              {error}
            </div>
          )}

          <div className="space-y-2">
            <label className="text-xs text-slate-400 font-bold uppercase tracking-widest">
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                placeholder="Enter your password"
                className="w-full text-sm bg-[#111827]/80 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500 pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="border-t border-slate-700/50 bg-slate-800/20 p-6">
          <button
            onClick={handleSubmit}
            disabled={isLoading || !password}
            className="w-full flex items-center justify-center gap-2 rounded-lg bg-yellow-600/20 border border-yellow-600/50 hover:bg-yellow-600/30 text-yellow-300 px-4 py-3 text-sm font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Lock size={16} />
            {isLoading ? "Verifying..." : "Authenticate & Open Console"}
          </button>
        </div>
      </div>
    </div>
  );
}