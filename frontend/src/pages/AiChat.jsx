import React, { useEffect, useState } from "react";
import { Bot, Send, Zap, Shield, Wrench, BarChart3, ChevronDown, ChevronUp, Copy, Check, Play, Settings } from "lucide-react";
import { logAction } from "../services/auditService";
import { generateText } from "../services/llmService";
import PlaybookStagingGate from "../components/PlaybookStagingGate";
import ApiKeyModal from "../components/ApiKeyModal";

const mocha = {
  base: "#1e1e2e",
  mantle: "#181825",
  surface0: "#313244",
  surface1: "#45475a",
  text: "#cdd6f4",
  subtext1: "#bac2de",
  lavender: "#b4befe",
  blue: "#89b4fa",
  green: "#a6e3a1",
  yellow: "#f9e2af",
  red: "#f38ba8",
  peach: "#fab387",
  sapphire: "#74c7ec",
  sky: "#89dceb",
};

const classifyLine = (line) => {
  if (!line.trim()) return { color: mocha.subtext1 };
  if (line.startsWith("PLAY RECAP")) return { color: mocha.lavender, weight: 700 };
  if (line.startsWith("PLAY [")) return { color: mocha.blue, weight: 700 };
  if (line.startsWith("TASK [")) return { color: mocha.sapphire, weight: 700 };
  if (line.startsWith("ok:")) return { color: mocha.green };
  if (line.startsWith("changed:")) return { color: mocha.yellow };
  if (line.startsWith("failed:")) return { color: mocha.red, weight: 700 };
  if (line.startsWith("skipped:")) return { color: mocha.peach };
  if (line.startsWith("fatal:")) return { color: mocha.red, weight: 700 };
  if (line.startsWith("[")) return { color: mocha.subtext1 };
  return { color: mocha.text };
};

const normalizeAssistantText = (rawText) => {
  if (!rawText) return "";

  return rawText
    .replace(/\r\n/g, "\n")
    .replace(/^```[a-zA-Z0-9_-]*\s*$/gm, "")
    .replace(/^```\s*$/gm, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^#{1,6}\s*/gm, "")
    .replace(/^[-*]\s+/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
};

const ExpandableOutput = ({ output }) => {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!output) return null;

  const lines = output.split("\n");
  const preview = lines.slice(0, 10);
  const hasMore = lines.length > preview.length;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(output);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  return (
    <div className="mt-3 rounded-xl border border-[#45475a] bg-[#1e1e2e] p-4 shadow-inner shadow-black/20">
      <div className="mb-3 flex items-center justify-between">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-2 text-sm text-[#cdd6f4] transition-colors hover:text-white"
        >
          {hasMore && (expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />)}
          <span className="font-mono text-xs">{lines.length} lines of output</span>
        </button>

        <button
          onClick={handleCopy}
          className="flex items-center gap-2 rounded-lg bg-[#45475a]/50 px-3 py-1.5 text-xs text-[#cdd6f4] transition-all hover:bg-[#45475a] hover:text-white"
          title="Copy output to clipboard"
        >
          {copied ? (
            <>
              <Check size={14} />
              <span>Copied!</span>
            </>
          ) : (
            <>
              <Copy size={14} />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>

      <div className="max-h-72 overflow-auto rounded-lg border border-[#313244] bg-[#181825] p-3 font-mono text-xs leading-5">
        {(expanded ? lines : preview).map((line, index) => {
          const style = classifyLine(line);
          return (
            <div
              key={`${index}-${line}`}
              style={{ color: style.color, fontWeight: style.weight || 400 }}
              className="whitespace-pre-wrap-break-words"
            >
              {line}
            </div>
          );
        })}
        {hasMore && !expanded && (
          <div style={{ color: mocha.subtext1 }} className="mt-2 italic">
            ...expand to view the rest of the playbook output
          </div>
        )}
      </div>
    </div>
  );
};

const PlaybookSuggestions = ({ suggestions, onExecute }) => {
  if (!suggestions || suggestions.length === 0) return null;

  return (
    <div className="mt-4 rounded-xl border border-[#45475a] bg-[#313244]/40 p-4">
      <div className="mb-3 flex items-center gap-2">
        <Zap size={16} className="text-[#f9e2af]" />
        <span className="text-sm font-semibold text-[#f9e2af]">Available Playbooks</span>
      </div>
      <div className="space-y-2">
        {suggestions.map((suggestion) => (
          <div
            key={suggestion.filename}
            className="flex items-start justify-between rounded-lg border border-[#45475a]/50 bg-[#1e1e2e] p-3"
          >
            <div className="flex-1">
              <h4 className="mb-1 text-sm font-semibold text-[#cdd6f4]">{suggestion.name}</h4>
              <p className="mb-2 text-xs text-[#bac2de]">{suggestion.description}</p>
              {suggestion.playbook_preview && (
                <p className="mb-2 text-xs text-[#a6e3a1] italic">{suggestion.playbook_preview}</p>
              )}
              <div className="flex flex-wrap gap-1">
                {(suggestion.tags || []).slice(0, 3).map((tag) => (
                  <span key={tag} className="inline-block rounded bg-[#45475a]/50 px-2 py-0.5 text-xs text-[#89dceb]">
                    {tag}
                  </span>
                ))}
              </div>
              <p className="mt-2 text-xs text-[#6c7086]">Match: {suggestion.reason}</p>
            </div>
            <button
              onClick={() => onExecute(suggestion)}
              className="ml-3 flex items-center gap-2 whitespace-nowrap rounded-lg border border-blue-600/50 bg-blue-600/20 px-3 py-2 text-xs text-blue-300 transition-colors hover:bg-blue-600/30"
            >
              <Play size={14} />
              <span>Run</span>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default function AiChat() {
  const [messages, setMessages] = useState([
    {
      role: "ai",
      text: "Hello! I'm your AI Network Assistant. I can help you configure devices, analyze logs, troubleshoot issues, and answer questions about your network. What would you like to do today?",
      time: "10:48:11 PM",
    },
  ]);
  const [input, setInput] = useState("");
  const [executingAction, setExecutingAction] = useState(null);
  const [pendingPlaybook, setPendingPlaybook] = useState(null);
  const [playbookMetadata, setPlaybookMetadata] = useState({});
  const [selectedModel, setSelectedModel] = useState(() => localStorage.getItem("hf_model") || "deepseek-ai/DeepSeek-R1:novita");
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);

  useEffect(() => {
    const fetchCatalog = async () => {
      try {
        const res = await fetch("http://localhost:8000/playbooks/catalog");
        if (!res.ok) return;

        const data = await res.json();
        const metadata = {};
        (data.catalog || []).forEach((playbook) => {
          metadata[playbook.filename] = {
            destructive: playbook.destructive,
            severity: playbook.severity,
            name: playbook.name,
            description: playbook.description,
            tags: playbook.tags,
            target_devices: playbook.target_devices,
          };
        });
        setPlaybookMetadata(metadata);
      } catch (err) {
        console.error("Failed to fetch playbook catalog:", err);
      }
    };

    fetchCatalog();
  }, []);

  const hfModels = [
    { id: "deepseek-ai/DeepSeek-R1:novita", label: "DeepSeek R1 (Best reasoning)" },
    { id: "google/gemma-4-31B-it:novita", label: "Gemma 4 31B (Faster chat)" },
    { id: "Qwen/Qwen3.5-4B", label: "Qwen 3.5-4B (Balanced)" },
    { id: "meta-llama/Llama-3.1-8B-Instruct:novita", label: "Llama-3.1-8B-Instruct(Fastest)" },
  ];

  const quickActions = [
    { id: "backup", name: "Backup Devices", description: "Create backups of all network device configurations", icon: Zap, color: "bg-blue-600/20 border-blue-600/50 hover:bg-blue-600/30", iconColor: "text-blue-400", playbook: "get_facts.yml" },
    { id: "security", name: "Apply Security Policies", description: "Deploy security patches and policies across devices", icon: Shield, color: "bg-red-600/20 border-red-600/50 hover:bg-red-600/30", iconColor: "text-red-400", playbook: "enableCDP.yml" },
    { id: "config", name: "Update Configuration", description: "Push configuration updates to network devices", icon: Wrench, color: "bg-amber-600/20 border-amber-600/50 hover:bg-amber-600/30", iconColor: "text-amber-400", playbook: "practice1.yml" },
    { id: "compliance", name: "Run Compliance Check", description: "Perform compliance validation and report on device status", icon: BarChart3, color: "bg-emerald-600/20 border-emerald-600/50 hover:bg-emerald-600/30", iconColor: "text-emerald-400", playbook: "HSRP_active.yml" },
  ];

  const executePlaybook = (actionName, playbookName) => {
    setExecutingAction(playbookName.replace(/\.(yml|yaml)$/, ""));

    let outputLines = [];
    let finalStatus = "pending";
    let userMessageAdded = false;

    try {
      const eventSource = new EventSource(`http://localhost:8000/playbooks/execute-stream/${playbookName}`);

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.type === "output") {
            outputLines.push(data.line);

            if (!userMessageAdded) {
              setMessages((prevMessages) => [
                ...prevMessages,
                { role: "user", text: `Execute: ${actionName}`, time: "Now" },
                { role: "ai", text: `🔄 ${actionName} is running...`, output: outputLines.join("\n"), time: "Now" },
              ]);
              userMessageAdded = true;
            } else {
              setMessages((prevMessages) => {
                const updated = [...prevMessages];
                const lastAIMessage = updated[updated.length - 1];
                if (lastAIMessage && lastAIMessage.role === "ai") {
                  lastAIMessage.output = outputLines.join("\n");
                }
                return updated;
              });
            }
          } else if (data.type === "complete") {
            finalStatus = data.status;
            eventSource.close();
          } else if (data.type === "error") {
            finalStatus = "error";
            eventSource.close();
          }
        } catch (parseError) {
          console.error("Error parsing event:", parseError);
        }
      };

      eventSource.onerror = () => {
        eventSource.close();
        finalStatus = "failed";

        setMessages((prevMessages) => {
          const updated = [...prevMessages];
          const lastAIMessage = updated[updated.length - 1];
          if (lastAIMessage && lastAIMessage.role === "ai") {
            lastAIMessage.text = finalStatus === "success" ? `✅ ${actionName} completed successfully!` : `❌ ${actionName} failed!`;
          }
          return updated;
        });

        setExecutingAction(null);
      };

      const checkCompletion = setInterval(() => {
        if (finalStatus !== "pending") {
          clearInterval(checkCompletion);

          const username = localStorage.getItem("username") || "Anonymous User";
          logAction(actionName, playbookName, finalStatus, outputLines.join("\n"), username).catch((err) =>
            console.error("Failed to log action:", err)
          );

          setMessages((prevMessages) => {
            const updated = [...prevMessages];
            const lastAIMessage = updated[updated.length - 1];
            if (lastAIMessage && lastAIMessage.role === "ai") {
              lastAIMessage.text = finalStatus === "success" ? `✅ ${actionName} completed successfully!` : `❌ ${actionName} failed!`;
            }
            return updated;
          });

          setExecutingAction(null);
        }
      }, 100);
    } catch (error) {
      const username = localStorage.getItem("username") || "Anonymous User";
      logAction(actionName, playbookName, "error", error.message, username).catch((err) => console.error("Failed to log action:", err));

      setMessages((prevMessages) => [
        ...prevMessages,
        { role: "user", text: `Execute: ${actionName}`, time: "Now" },
        { role: "ai", text: `❌ Error executing playbook: ${error.message}`, time: "Now" },
      ]);
      setExecutingAction(null);
    }
  };

  const executeAction = (action) => {
    const metadata = playbookMetadata[action.playbook];
    if (metadata && metadata.destructive) {
      setPendingPlaybook({
        filename: action.playbook,
        name: metadata.name,
        description: metadata.description,
        tags: metadata.tags,
        target_devices: metadata.target_devices,
        severity: metadata.severity,
      });
      return;
    }

    executePlaybook(action.name, action.playbook);
  };

  const handleExecuteSuggestedPlaybook = (suggestion) => {
    const metadata = playbookMetadata[suggestion.filename];
    const destructive = suggestion.destructive ?? metadata?.destructive ?? false;

    if (destructive) {
      setPendingPlaybook({
        filename: suggestion.filename,
        name: suggestion.name,
        description: suggestion.description,
        tags: suggestion.tags || metadata?.tags || [],
        target_devices: suggestion.target_devices || metadata?.target_devices || [],
        severity: suggestion.severity || metadata?.severity || "medium",
      });
      return;
    }

    executePlaybook(suggestion.name || metadata?.name || suggestion.filename, suggestion.filename);
  };

  const handleStagingGateApprove = (playbookName) => {
    const staged = pendingPlaybook;
    executePlaybook(staged?.name || playbookMetadata[playbookName]?.name || playbookName, playbookName);
    setPendingPlaybook(null);
  };

  const handleStagingGateReject = () => {
    setPendingPlaybook(null);
    setMessages((prevMessages) => [...prevMessages, { role: "ai", text: "Deployment cancelled.", time: "Now" }]);
  };

  const sendMessage = async () => {
    if (!input.trim()) return;
    const userText = input.trim();

    setMessages((prev) => [...prev, { role: "user", text: userText, time: "Now" }, { role: "ai", text: "Thinking...", time: "Now" }]);
    setInput("");

    try {
      const response = await generateText(userText, selectedModel);
      const cleanText = normalizeAssistantText(response.text);

      setMessages((prev) => {
        const updated = [...prev];
        for (let i = updated.length - 1; i >= 0; i--) {
          if (updated[i].role === "ai" && updated[i].text === "Thinking...") {
            updated[i] = {
              role: "ai",
              text: cleanText,
              reasoning: response.reasoning,
              model: response.model,
              playbook_suggestions: response.playbook_suggestions || [],
              time: "Now",
            };
            break;
          }
        }
        return updated;
      });
    } catch (err) {
      setMessages((prev) => {
        const updated = [...prev];
        for (let i = updated.length - 1; i >= 0; i--) {
          if (updated[i].role === "ai" && updated[i].text === "Thinking...") {
            updated[i] = { role: "ai", text: `❌ Error: ${err.message}`, time: "Now" };
            break;
          }
        }
        return updated;
      });
    }
  };
  const handleModelChange = (modelId) => {
  setSelectedModel(modelId);
  localStorage.setItem("hf_model", modelId);
  };

  return (
    <div className="min-h-full bg-linear-to-br from-[#F8FAFC] to-[#D1D5DB] p-8 font-sans">
      <PlaybookStagingGate playbook={pendingPlaybook} onApprove={handleStagingGateApprove} onReject={handleStagingGateReject} isOpen={!!pendingPlaybook} />

      {showApiKeyModal && (
        <ApiKeyModal
          onClose={() => setShowApiKeyModal(false)}
          onSave={() => {
            // Optional: Refresh anything if needed
          }}
        />
      )}

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-[30px] font-extrabold tracking-tight text-[#0F172A] drop-shadow-sm">AI Chat Console</h1>
          <p className="text-base font-medium text-[#64748B]">Natural language network management and configuration</p>
        </div>
        <button
          onClick={() => setShowApiKeyModal(true)}
          className="flex items-center gap-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 px-4 py-2 font-medium text-sm transition-all shadow-md hover:shadow-lg"
          title="Manage Hugging Face API Key"
        >
          <Settings size={18} />
          <span>API Key</span>
        </button>
      </div>

      <div className="mb-8">
        <h2 className="mb-4 text-lg font-bold text-[#0F172A]">Quick Actions</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.id}
                onClick={() => executeAction(action)}
                disabled={executingAction !== null}
                className={`flex flex-col items-start rounded-2xl border p-5 ${action.color} backdrop-blur-sm transition-all duration-200 hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50`}
              >
                <div className={`mb-3 rounded-lg p-3 ${action.color.split(" ")[0]}`}>
                  <Icon className={action.iconColor} size={24} />
                </div>
                <h3 className="mb-1 text-sm font-bold text-[#0F172A]">{action.name}</h3>
                <p className="text-xs leading-relaxed text-[#64748B]">{action.description}</p>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex min-h-131.25 flex-col overflow-hidden rounded-3xl border border-slate-700/50 bg-[#1D293DED] shadow-lg">
        <div className="flex-1 space-y-5 p-6">
          {messages.map((message, index) => (
            <div key={index} className={`flex gap-4 ${message.role === "user" ? "justify-end" : ""}`}>
              {message.role === "ai" && (
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-violet-600 text-white">
                  <Bot size={20} />
                </div>
              )}

              <div className={`max-w-4xl rounded-2xl px-5 py-4 text-sm leading-relaxed ${message.role === "user" ? "bg-blue-600 text-white" : "bg-[#0F172A] text-slate-300"}`}>
                {message.role === "ai" && (
                  <div className="mb-2 flex items-center gap-2">
                    <span className="rounded-lg bg-blue-600/30 px-2 py-1 text-xs font-bold text-blue-200">
                      {message.model === "google/gemma-4-31B-it:novita" ? "Gemma 4 31B" : "AI Assistant"}
                    </span>
                    <span className="text-xs text-slate-500">{message.time}</span>
                  </div>
                )}

                {message.reasoning && (
                  <div className="mb-4 rounded-lg border border-purple-500/30 bg-purple-900/20 p-3">
                    <p className="mb-2 text-xs font-semibold text-purple-300">Thinking Process:</p>
                    <p className="text-xs text-purple-200/80">{message.reasoning}</p>
                  </div>
                )}

                <div className={message.role === "ai" ? "whitespace-pre-wrap wrap-break-words" : "wrap-break-words"}>
                  {message.text}
                </div>

                {message.output && <ExpandableOutput output={message.output} />}
                {message.playbook_suggestions && message.playbook_suggestions.length > 0 && (
                  <PlaybookSuggestions suggestions={message.playbook_suggestions} onExecute={handleExecuteSuggestedPlaybook} />
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="border-t border-slate-700/50 bg-[#314157] p-5">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <label className="text-sm font-semibold text-slate-300">Model:</label>
            <select
              value={selectedModel}
              onChange={(event) => handleModelChange(event.target.value)}
              className="rounded-lg border border-slate-600 bg-[#0F172A] px-3 py-2 text-sm text-slate-200 outline-none hover:border-slate-500 focus:border-blue-500"
            >
              {hfModels.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.label}
                </option>
              ))}
            </select>
          </div>

          <div className="mb-5 flex flex-wrap gap-3">
            {["High CPU devices", "Configure VLAN", "Security analysis"].map((prompt) => (
              <button
                key={prompt}
                onClick={() => setInput(prompt)}
                className="rounded-xl border border-slate-600 bg-slate-700/40 px-4 py-2 text-sm text-slate-200"
              >
                {prompt}
              </button>
            ))}
          </div>

          <div className="flex gap-3">
            <input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && sendMessage()}
              placeholder="Type your command or question... (Press Enter to send)"
              className="flex-1 rounded-xl bg-[#0F172A] px-4 text-sm text-slate-200 outline-none placeholder:text-slate-500"
            />
            <button
              onClick={sendMessage}
              className="grid h-14 w-14 place-items-center rounded-xl bg-blue-600 text-white shadow-lg shadow-blue-600/25"
            >
              <Send size={20} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
