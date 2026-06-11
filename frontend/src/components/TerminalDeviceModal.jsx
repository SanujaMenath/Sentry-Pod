import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { getNetworkTerminalSocketUrl } from "../services/networkService";
import Cursor from "./Cursor";

export default function TerminalDeviceModal({ device, onClose }) {
  const [command, setCommand] = useState("");
  const [connected, setConnected] = useState(false);
  const [socket, setSocket] = useState(null);
  const [lines, setLines] = useState([
    `Opening terminal for ${device.name} (${device.ip})...`,
  ]);
  const [commandHistory, setCommandHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const preRef = useRef(null);

  useEffect(() => {
    preRef.current?.focus();
  }, []);

  useEffect(() => {
    if (preRef.current) {
      preRef.current.scrollTop = preRef.current.scrollHeight;
    }
  }, [lines, command]);

  useEffect(() => {
    const terminalSocket = new WebSocket(getNetworkTerminalSocketUrl(device.id));
    setSocket(terminalSocket);

    terminalSocket.onopen = () => {
      setConnected(true);
    };

    terminalSocket.onmessage = (event) => {
      setLines((current) => [...current, event.data]);
    };

    terminalSocket.onerror = () => {
      setLines((current) => [...current, "\r\nTerminal connection error.\r\n"]);
    };

    terminalSocket.onclose = () => {
      setConnected(false);
      setLines((current) => [...current, "\r\nSSH session closed.\r\n"]);
    };

    return () => {
      terminalSocket.close();
    };
  }, [device.id]);

  const handleKeyDown = (e) => {
    if (e.key === "ArrowUp") {
      e.preventDefault();
      if (commandHistory.length > 0 && historyIndex < commandHistory.length - 1) {
        const newIndex = historyIndex + 1;
        setHistoryIndex(newIndex);
        setCommand(commandHistory[commandHistory.length - 1 - newIndex]);
      }
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (historyIndex > 0) {
        const newIndex = historyIndex - 1;
        setHistoryIndex(newIndex);
        setCommand(commandHistory[commandHistory.length - 1 - newIndex]);
      } else if (historyIndex === 0) {
        setHistoryIndex(-1);
        setCommand("");
      }
      return;
    }

    if (e.key === "Enter") {
      e.preventDefault();
      if (command && socket?.readyState === WebSocket.OPEN) {
        setCommandHistory((prev) => [...prev, command]);
        setHistoryIndex(-1);
        socket.send(`${command}\r`);
        setCommand("");
      } else if (socket?.readyState === WebSocket.OPEN) {
        socket.send("\r");
      }
      return;
    }

    if (e.key === " " && !command && socket?.readyState === WebSocket.OPEN) {
      e.preventDefault();
      socket.send(" ");
      return;
    }

    if (e.key === "Backspace") {
      e.preventDefault();
      setCommand((prev) => prev.slice(0, -1));
      return;
    }

    if (e.key.length === 1) {
      e.preventDefault();
      setCommand((prev) => prev + e.key);
    }
  };

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

        <pre
          ref={preRef}
          tabIndex={0}
          onKeyDown={handleKeyDown}
          className="flex flex-1 min-h-0 cursor-text overflow-auto whitespace-pre-wrap bg-[#1f2034] p-5 font-mono text-[15px] leading-6 text-slate-200 terminal-scrollbar focus:outline-none"
        >
          {lines.join("")}{connected ? command : ""}{connected ? <Cursor /> : ""}
        </pre>
      </div>
    </div>
  );
}
