import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { getNetworkTerminalSocketUrl } from "../services/networkService";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import { useTerminalConfig } from "../hooks/useTerminalConfig";
import { resolveTheme } from "../config/terminalThemes";

export default function TerminalDeviceModal({ device, onClose }) {
  const [connected, setConnected] = useState(false);
  const terminalRef = useRef(null);
  const termRef = useRef(null);
  const dimsRef = useRef({ cols: 0, rows: 0 });
  const { sshConfig: { fontSize, fontFamily, colorScheme, cursorStyle, cursorBlink } } = useTerminalConfig();

  // eslint-disable react-hooks/exhaustive-deps
  useEffect(() => {
    const scheme = resolveTheme(colorScheme).theme;

    const term = new Terminal({
      cursorBlink,
      cursorStyle,
      fontSize,
      fontFamily,
      allowTransparency: true,
      theme: scheme,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(terminalRef.current);
    fitAddon.fit();
    termRef.current = term;

    const socket = new WebSocket(getNetworkTerminalSocketUrl(device.id));

    socket.onopen = () => {
      setConnected(true);
      term.focus();
    };

    socket.onmessage = (event) => {
      term.write(event.data);
    };

    socket.onerror = () => {
      term.writeln("\r\n\x1b[31mTerminal connection error.\x1b[0m");
    };

    socket.onclose = () => {
      setConnected(false);
      term.writeln("\r\n\x1b[33mSSH session closed.\x1b[0m");
    };

    term.onData((data) => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(data);
      }
    });

    const resizeObserver = new ResizeObserver(() => {
      try {
        const proposed = fitAddon.proposeDimensions();
        if (!proposed) return;
        if (proposed.cols === dimsRef.current.cols && proposed.rows === dimsRef.current.rows) return;
        fitAddon.fit();
        dimsRef.current = { cols: proposed.cols, rows: proposed.rows };
      } catch {
        /* ignore */
      }
    });

    resizeObserver.observe(terminalRef.current);

    return () => {
      resizeObserver.disconnect();
      socket.close();
      term.dispose();
    };
  }, [device.id, device.name, device.ip]);
  // eslint-enable react-hooks/exhaustive-deps

  useEffect(() => {
    const term = termRef.current;
    if (!term) return;
    const scheme = resolveTheme(colorScheme).theme;
    term.options.cursorBlink = cursorBlink;
    term.options.cursorStyle = cursorStyle;
    term.options.fontSize = fontSize;
    term.options.fontFamily = fontFamily;
    term.options.theme = scheme;
  }, [colorScheme, cursorBlink, cursorStyle, fontSize, fontFamily]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="flex h-[min(720px,calc(100vh-32px))] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-slate-700 bg-[#17182b] shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-700/70 bg-[#202136] px-5 py-3">
          <div className="flex items-center gap-3">
            <div>
              <h2 className="text-sm font-bold text-slate-100">Terminal - {device.name}</h2>
              <p className="text-xs font-mono text-slate-400">{device.ip}</p>
            </div>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider ${connected ? "bg-emerald-500/20 text-emerald-400" : "bg-rose-500/20 text-rose-400"}`}>
              {connected ? "Connected" : "Disconnected"}
            </span>
          </div>
          <button type="button" onClick={onClose} className="text-slate-500 hover:text-white">
            <X size={18} />
          </button>
        </div>

        <div ref={terminalRef} className="flex-1 min-h-0 p-1" />
      </div>
    </div>
  );
}
