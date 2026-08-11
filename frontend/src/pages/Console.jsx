import { useEffect, useRef } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import { useTerminalConfig } from "../hooks/useTerminalConfig";
import { resolveTheme } from "../config/terminalThemes";
import ConsoleAuthGate from "../components/ConsoleAuthGate";

const WS_BASE = import.meta.env.VITE_WS_BASE_URL || "ws://localhost:8000";

function TerminalView() {
  const terminalRef = useRef(null);
  const termRef = useRef(null);
  const socketRef = useRef(null);
  const dimsRef = useRef({ cols: 0, rows: 0 });
  const { consoleConfig: { fontSize, fontFamily, colorScheme, cursorStyle, cursorBlink } } = useTerminalConfig();

  useEffect(() => {
    const scheme = resolveTheme(colorScheme).theme;
    const term = new Terminal({
      cursorBlink,
      cursorStyle,
      fontSize,
      fontFamily,
      allowTransparency: true,
      theme: scheme,
      allowProposedApi: true,
    });
    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(terminalRef.current);
    fitAddon.fit();
    termRef.current = term;

    const socket = new WebSocket(`${WS_BASE}/console/ws`);
    socketRef.current = socket;

    socket.onopen = () => {
      term.focus();
      const proposed = fitAddon.proposeDimensions();
      if (proposed) {
        dimsRef.current = { cols: proposed.cols, rows: proposed.rows };
        socket.send(JSON.stringify({
          type: "resize",
          cols: proposed.cols,
          rows: proposed.rows,
        }));
      }
    };

    socket.onmessage = (event) => term.write(event.data);

    socket.onerror = () => {
      term.writeln("\r\n\x1b[31mWebSocket connection error.\x1b[0m");
    };

    socket.onclose = () => {
      term.writeln("\r\n\x1b[33mConsole session closed.\x1b[0m");
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
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({
            type: "resize",
            cols: proposed.cols,
            rows: proposed.rows,
          }));
        }
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
  }, []);

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
    <div className="h-full w-full bg-[#0d1117]">
      <div
        ref={terminalRef}
        className="h-full w-full p-2"
        style={{ minHeight: "100%" }}
      />
    </div>
  );
}

export default function Console() {
  return (
    <ConsoleAuthGate>
      <TerminalView />
    </ConsoleAuthGate>
  );
}