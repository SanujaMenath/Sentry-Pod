import React, { useEffect, useState, useCallback } from "react";
import { Bot, Send, Zap, Shield, Wrench, BarChart3, ChevronDown, ChevronUp, Copy, Check, Play, Settings, MessageSquare } from "lucide-react";
import { logAction } from "../services/auditService";
import { generateText, proposeModification, approveModification } from "../services/llmService";
import { listSessions, getSession, createSession, deleteSession } from "../services/sessionService";
import PlaybookStagingGate from "../components/PlaybookStagingGate";
import ApiKeyModal from "../components/ApiKeyModal";
import PageHeader from "../components/PageHeader";
import SessionSidebar from "../components/SessionSidebar";
import ExpandableOutput from "../components/ExpandableOutput";
import PlaybookSuggestions from "../components/PlaybookSuggestions";
import PlaybookModificationCard from "../components/PlaybookModificationCard";
import { useOutletContext } from 'react-router-dom';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

const GREETING = "Hello! I'm your AI Network Assistant. I can help you configure devices, analyze logs, troubleshoot issues, and answer questions about your network. What would you like to do today?";
const THINKING = "Thinking...";
const ANONYMOUS_USER = "Anonymous User";
const QUICK_PROMPTS = ["High CPU devices", "Configure VLAN", "Security analysis"];
const MODEL_ESTIMATES = {
  "deepseek-ai/DeepSeek-R1:novita": "30-60 seconds",
  "google/gemma-4-31B-it:novita": "10-20 seconds",
};
const DEFAULT_ESTIMATE = "5-10 seconds";

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





export default function AiChat() {
  const { search } = useOutletContext() || { search: "" };
  const [messages, setMessages] = useState([
    { role: "ai", text: GREETING, time: "Now" },
  ]);
  const [input, setInput] = useState("");
  const [executingAction, setExecutingAction] = useState(null);
  const [pendingPlaybook, setPendingPlaybook] = useState(null);
  const [playbookMetadata, setPlaybookMetadata] = useState({});
  const [selectedModel, setSelectedModel] = useState(() => localStorage.getItem("hf_model") || "deepseek-ai/DeepSeek-R1:novita");
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [sessions, setSessions] = useState([]);
  const [activeSessionId, setActiveSessionId] = useState(() => localStorage.getItem("active_session_id") || null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loadingSession, setLoadingSession] = useState(false);
  const [isPreparingModification, setIsPreparingModification] = useState(false);

  useEffect(() => {
    const fetchCatalog = async () => {
      try {
        const res = await fetch(`${API_BASE}/playbooks/catalog`);
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

  useEffect(() => {
    const fetchSessions = async () => {
      try {
        const sessionList = await listSessions();
        setSessions(sessionList);

        // Determine which session to load
        let targetId = activeSessionId;
        if (targetId && !sessionList.some((s) => s.session_id === targetId)) {
          targetId = null;
        }
        if (!targetId && sessionList.length > 0) {
          targetId = sessionList[0].session_id;
        }

        if (targetId) {
          await loadSessionMessages(targetId);
        } else {
          setActiveSessionId(null);
          localStorage.removeItem("active_session_id");
        }
      } catch (err) {
        console.error("Failed to fetch sessions:", err);
      }
    };
    fetchSessions();
  }, []);

  const hfModels = [
    { id: "deepseek-ai/DeepSeek-R1:novita", label: "DeepSeek R1 (Best reasoning)" },
    { id: "google/gemma-4-31B-it:novita", label: "Gemma 4 31B (Faster chat)" },
    { id: "Qwen/Qwen3.5-4B", label: "Qwen 3.5-4B (Balanced)" },
    { id: "meta-llama/Llama-3.1-8B-Instruct:novita", label: "Llama-3.1-8B-Instruct (Fastest)" },
  ];

  const quickActions = [
    { id: "backup", name: "Backup Devices", description: "Create backups of all network device configurations", icon: Zap, color: "bg-blue-600/20 border-blue-600/50 hover:bg-blue-600/30", iconColor: "text-blue-400", playbook: "collect_golden_config.yml" },
    { id: "security", name: "Apply Security Policies", description: "Deploy security patches and policies across devices", icon: Shield, color: "bg-red-600/20 border-red-600/50 hover:bg-red-600/30", iconColor: "text-red-400", playbook: "configure_syslog.yml" },
    { id: "config", name: "Update Configuration", description: "Push configuration updates to network devices", icon: Wrench, color: "bg-amber-600/20 border-amber-600/50 hover:bg-amber-600/30", iconColor: "text-amber-400", playbook: "configure_default_gateway.yml" },
    { id: "compliance", name: "Run Compliance Check", description: "Perform compliance validation and report on device status", icon: BarChart3, color: "bg-emerald-600/20 border-emerald-600/50 hover:bg-emerald-600/30", iconColor: "text-emerald-400", playbook: "check_config_drift.yml" },
  ];

  const executePlaybook = (actionName, playbookName) => {
    setExecutingAction(playbookName.replace(/\.(yml|yaml)$/, ""));

    let outputLines = [];
    let finalStatus = "pending";
    let userMessageAdded = false;

    try {
      const eventSource = new EventSource(`${API_BASE}/playbooks/execute-stream/${playbookName}`);

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
                  updated[updated.length - 1] = { ...lastAIMessage, output: outputLines.join("\n") };
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
            updated[updated.length - 1] = { ...lastAIMessage, text: finalStatus === "success" ? `✅ ${actionName} completed successfully!` : `❌ ${actionName} failed!` };
          }
          return updated;
        });

        setExecutingAction(null);
      };

      const checkCompletion = setInterval(() => {
        if (finalStatus !== "pending") {
          clearInterval(checkCompletion);

          const username = localStorage.getItem("username") || ANONYMOUS_USER;
          logAction(actionName, playbookName, finalStatus, outputLines.join("\n"), username).catch((err) =>
            console.error("Failed to log action:", err)
          );

          setMessages((prevMessages) => {
            const updated = [...prevMessages];
            const lastAIMessage = updated[updated.length - 1];
            if (lastAIMessage && lastAIMessage.role === "ai") {
              updated[updated.length - 1] = { ...lastAIMessage, text: finalStatus === "success" ? `✅ ${actionName} completed successfully!` : `❌ ${actionName} failed!` };
            }
            return updated;
          });

          setExecutingAction(null);
        }
      }, 100);
    } catch (error) {
      const username = localStorage.getItem("username") || ANONYMOUS_USER;
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

  const loadSessionMessages = useCallback(async (sessionId) => {
    setLoadingSession(true);
    try {
      const session = await getSession(sessionId);
      const loaded = (session.messages || []).map((msg) => {
        if (msg.role === "user") {
          return { role: "user", text: msg.content, time: msg.created_at || "Now" };
        }
        return {
          role: "ai",
          text: msg.content,
          reasoning: msg.reasoning || null,
          model: msg.model || null,
          playbook_suggestions: msg.playbook_suggestions || [],
          time: msg.created_at || "Now",
        };
      });
      setMessages(loaded.length > 0 ? loaded : [{ role: "ai", text: GREETING, time: "Now" }]);
      setActiveSessionId(sessionId);
      localStorage.setItem("active_session_id", sessionId);
    } catch (err) {
      console.error("Failed to load session:", err);
    } finally {
      setLoadingSession(false);
    }
  }, []);

  const handleSelectSession = async (sessionId) => {
    setSidebarOpen(false);
    await loadSessionMessages(sessionId);
  };

  const handleNewSession = async () => {
    try {
      const newSession = await createSession();
      setActiveSessionId(newSession.session_id);
      localStorage.setItem("active_session_id", newSession.session_id);
      setMessages([{ role: "ai", text: GREETING, time: "Now" }]);
      setSidebarOpen(false);
      // Refresh session list
      const updatedSessions = await listSessions();
      setSessions(updatedSessions);
    } catch (err) {
      console.error("Failed to create session:", err);
    }
  };

  const handleDeleteSession = async (sessionId) => {
    try {
      await deleteSession(sessionId);
      const updatedSessions = sessions.filter((s) => s.session_id !== sessionId);
      setSessions(updatedSessions);

      if (activeSessionId === sessionId) {
        if (updatedSessions.length > 0) {
          await loadSessionMessages(updatedSessions[0].session_id);
        } else {
          // Create a new session automatically
          await handleNewSession();
        }
      }
    } catch (err) {
      console.error("Failed to delete session:", err);
    }
  };

  const getModelEstimate = (modelId) => MODEL_ESTIMATES[modelId] || DEFAULT_ESTIMATE;

  const handleProposeModification = async (suggestion, modificationText) => {
    const modModel = selectedModel;
    const estimate = getModelEstimate(modModel);

    setIsPreparingModification(true);

    setMessages((prev) => [...prev, {
      role: "ai",
      text: `🔄 Preparing modification for "${suggestion.filename}" using ${modModel}...\n⏱ Estimated time: ${estimate}`,
      time: "Now",
      _isWorking: true,
    }]);

    try {
      const result = await proposeModification(suggestion.filename, modificationText, modModel);

      setMessages((prev) => {
        const updated = [...prev];
        for (let i = updated.length - 1; i >= 0; i--) {
          if (updated[i]._isWorking) {
            updated[i] = {
              role: "ai",
              text: "I've prepared the modification. Please review and approve it below:",
              reasoning: null,
              model: null,
              playbook_suggestions: [],
              modification_proposal: result,
              time: "Now",
            };
            break;
          }
        }
        return updated;
      });
    } catch (err) {
      setMessages((prev) => [...prev, {
        role: "ai",
        text: `❌ Failed to prepare modification: ${err.message}`,
        time: "Now",
      }]);
    } finally {
      setIsPreparingModification(false);
    }
  };

  const handleApproveModification = async (proposal) => {
    const payload = {
      original_name: proposal.original_name,
      proposed_name: proposal.proposed_name,
      modified_content: proposal.modified_content,
      metadata: proposal.metadata,
    };

    setIsPreparingModification(true);

    try {
      const result = await approveModification(payload);
      const filename = result.filename;
      const metadata = proposal.metadata;

      if (metadata && metadata.destructive) {
        setPendingPlaybook({
          filename: filename,
          name: metadata.name || filename,
          description: metadata.description || "",
          tags: metadata.tags || [],
          target_devices: metadata.target_devices || [],
          severity: metadata.severity || "medium",
          _isModified: true,
        });
      }

      setMessages((prev) => {
        const updated = [...prev];
        for (let i = updated.length - 1; i >= 0; i--) {
          if (updated[i].modification_proposal) {
            updated[i] = {
              ...updated[i],
              _saved: true,
              _savedFilename: filename,
            };
            break;
          }
        }
        return updated;
      });

      setMessages((prev) => [...prev, {
        role: "ai",
        text: `✅ "${filename}" saved successfully! Would you like to execute it now?`,
        _showExecutePrompt: true,
        _executeFilename: filename,
        time: "Now",
      }]);
    } catch (err) {
      setMessages((prev) => [...prev, {
        role: "ai",
        text: `❌ Failed to save modification: ${err.message}`,
        time: "Now",
      }]);
    } finally {
      setIsPreparingModification(false);
    }
  };

  const handleRejectModification = () => {
    setMessages((prev) => [...prev, {
      role: "ai",
      text: "Modification cancelled.",
      time: "Now",
    }]);
  };

  const handleExecuteModified = (filename) => {
    const name = filename.replace(/\.(yml|yaml)$/, "");
    executePlaybook(name, filename);
  };

  const sendMessage = async () => {
    if (!input.trim()) return;
    const userText = input.trim();

    setMessages((prev) => [...prev, { role: "user", text: userText, time: "Now" }, { role: "ai", text: THINKING, time: "Now" }]);
    setInput("");

    try {
      const response = await generateText(userText, selectedModel, activeSessionId);
      const cleanText = normalizeAssistantText(response.text);

      // Save the session_id from the response if we didn't have one
      if (response.session_id && response.session_id !== activeSessionId) {
        setActiveSessionId(response.session_id);
        localStorage.setItem("active_session_id", response.session_id);
        // Refresh session list to show the new session
        try {
          const updatedSessions = await listSessions();
          setSessions(updatedSessions);
        } catch {
          // Session refresh is best-effort
        }
      }

      setMessages((prev) => {
        const updated = [...prev];
        for (let i = updated.length - 1; i >= 0; i--) {
          if (updated[i].role === "ai" && updated[i].text === THINKING) {
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
          if (updated[i].role === "ai" && updated[i].text === THINKING) {
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

  const query = search ? search.trim().toLowerCase() : "";

  const filteredMessages = messages.filter((msg) => {
    if (!query) return true;
    return msg.text?.toLowerCase().includes(query);
  });

  const filteredSessions = sessions.filter((session) => {
    if (!query) return true;
    return session.title?.toLowerCase().includes(query);
  });

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

      <SessionSidebar
        sessions={filteredSessions}
        activeSessionId={activeSessionId}
        onSelectSession={handleSelectSession}
        onNewSession={handleNewSession}
        onDeleteSession={handleDeleteSession}
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
      />

      {/* Main content area — shifts right when sidebar is open on large screens */}
      <div className={`transition-all duration-300 ${sidebarOpen ? "lg:ml-72" : "ml-0"}`}>
        <div className="flex items-start justify-between mb-6">
          <PageHeader 
            title="AI Chat Console" 
            description="Interact with your AI Network Assistant. Ask questions, run commands, and manage your network with natural language!" 
            isSmallSubtext={true}
          />
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className={`flex items-center gap-2 rounded-xl border px-4 py-2 font-medium text-sm transition-all shadow-md hover:shadow-lg ${
                sidebarOpen
                  ? "border-blue-500/50 bg-blue-600/20 text-blue-300 hover:bg-blue-600/30"
                  : "border-slate-600 bg-[#1D293D] text-slate-300 hover:bg-[#2A3A52] hover:text-white"
              }`}
              title="Toggle sessions panel"
            >
              <MessageSquare size={18} />
              <span>Sessions</span>
            </button>
            <button
              onClick={() => setShowApiKeyModal(true)}
              className="flex items-center gap-2 rounded-xl border border-slate-600 bg-[#1D293D] px-4 py-2 font-medium text-sm text-slate-300 transition-all shadow-md hover:bg-[#2A3A52] hover:text-white hover:shadow-lg"
              title="Manage Hugging Face API Key"
            >
              <Settings size={18} />
              <span>API Key</span>
            </button>
          </div>
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

        {/* LARGE GRAY CHAT BOX (Updated shadow classes here) */}
        <div className="flex min-h-131.25 flex-col overflow-hidden rounded-3xl border border-slate-700/50 bg-[#1D293DED] shadow-2xl shadow-black/50">
          <div className="flex-1 space-y-5 p-6">
           {loadingSession ? (
              <div className="flex items-center justify-center py-20 text-slate-400">
                <div className="animate-pulse text-sm">Loading session...</div>
              </div>
            ) : filteredMessages.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                <p className="text-sm">
                  {query ? `No chat messages matching "${search}"` : "No messages in this chat."}
                </p>
              </div>
            ) : (
              filteredMessages.map((message, index) => (
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
                      <PlaybookSuggestions
                        suggestions={message.playbook_suggestions}
                        onExecute={handleExecuteSuggestedPlaybook}
                        onModify={(suggestion) => {
                          const lastUserMsg = [...messages].reverse().find(m => m.role === "user");
                          const modificationText = lastUserMsg?.text || `Modify ${suggestion.filename}`;
                          handleProposeModification(suggestion, modificationText);
                        }}
                      />
                    )}
                    {message.modification_proposal && (
                      <PlaybookModificationCard
                        modification={message.modification_proposal}
                        onApprove={() => handleApproveModification(message.modification_proposal)}
                        onReject={handleRejectModification}
                        onExecute={() => handleExecuteModified(message._savedFilename || message.modification_proposal.proposed_name)}
                        isSaving={isPreparingModification}
                        isSaved={message._saved}
                      />
                    )}
                    {message._showExecutePrompt && message._executeFilename && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          onClick={() => handleExecuteModified(message._executeFilename)}
                          className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-700"
                        >
                          <Play size={16} />
                          Execute Now
                        </button>
                        <button
                          onClick={() => {
                            setMessages((prev) => {
                              const updated = [...prev];
                              const idx = updated.indexOf(message);
                              if (idx !== -1) updated[idx] = { ...updated[idx], _showExecutePrompt: false };
                              return updated;
                            });
                          }}
                          className="flex items-center gap-2 rounded-lg border border-[#45475a] bg-[#313244] px-4 py-2 text-sm text-[#cdd6f4] transition-colors hover:bg-[#45475a]"
                        >
                          Not Now
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
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
              {QUICK_PROMPTS.map((prompt) => (
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
    </div>
  );
}
