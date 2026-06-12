import { useState, useCallback } from "react";
import { DEFAULT_TERMINAL_CONFIG } from "../config/terminalThemes";

const STORAGE_KEY = "sentry_pod_terminal_config";

function loadConfig() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      return { ...DEFAULT_TERMINAL_CONFIG, ...JSON.parse(raw) };
    }
  } catch {
    /* ignore corrupt data */
  }
  return DEFAULT_TERMINAL_CONFIG;
}

function saveConfig(config) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

export function useTerminalConfig() {
  const [config, setConfig] = useState(loadConfig);

  const updateSshConfig = useCallback((patch) => {
    setConfig((prev) => {
      const next = { ...prev, ssh: { ...prev.ssh, ...patch } };
      saveConfig(next);
      return next;
    });
  }, []);

  const updateConsoleConfig = useCallback((patch) => {
    setConfig((prev) => {
      const next = { ...prev, console: { ...prev.console, ...patch } };
      saveConfig(next);
      return next;
    });
  }, []);

  return {
    sshConfig: config.ssh,
    consoleConfig: config.console,
    updateSshConfig,
    updateConsoleConfig,
  };
}
