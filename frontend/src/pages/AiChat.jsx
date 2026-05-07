import React, { useState } from "react";
import { Bot, Send, Zap, Shield, Wrench, BarChart3, ChevronDown, ChevronUp, Copy, Check } from "lucide-react";
import { logAction } from "../services/auditService";

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
  if (!line.trim()) {
    return { color: mocha.subtext1 };
  }

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

const ExpandableOutput = ({ output }) => {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  
  if (!output) return null;
  
  const lines = output.split('\n');
  const preview = lines.slice(0, 10);
  const hasMore = lines.length > preview.length;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(output);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
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
            <div key={`${index}-${line}`} style={{ color: style.color, fontWeight: style.weight || 400 }} className="whitespace-pre-wrap break-words">
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

  const quickActions = [
    {
      id: "backup",
      name: "Backup Devices",
      description: "Create backups of all network device configurations",
      icon: Zap,
      color: "bg-blue-600/20 border-blue-600/50 hover:bg-blue-600/30",
      iconColor: "text-blue-400",
      playbook: "get_facts.yml"
    },
    {
      id: "security",
      name: "Apply Security Policies",
      description: "Deploy security patches and policies across devices",
      icon: Shield,
      color: "bg-red-600/20 border-red-600/50 hover:bg-red-600/30",
      iconColor: "text-red-400",
      playbook: "enableCDP.yml"
    },
    {
      id: "config",
      name: "Update Configuration",
      description: "Push configuration updates to network devices",
      icon: Wrench,
      color: "bg-amber-600/20 border-amber-600/50 hover:bg-amber-600/30",
      iconColor: "text-amber-400",
      playbook: "practice1.yml"
    },
    {
      id: "compliance",
      name: "Run Compliance Check",
      description: "Perform compliance validation and report on device status",
      icon: BarChart3,
      color: "bg-emerald-600/20 border-emerald-600/50 hover:bg-emerald-600/30",
      iconColor: "text-emerald-400",
      playbook: "HSRP_active.yml"
    },
  ];

  const executeAction = async (action) => {
    setExecutingAction(action.id);
    
    let outputLines = [];
    let finalStatus = "pending";
    let userMessageAdded = false;

    try {
      const eventSource = new EventSource(
        `http://localhost:8000/playbooks/execute-stream/${action.playbook}`
      );

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.type === "output") {
            outputLines.push(data.line);
            
            if (!userMessageAdded) {
              setMessages((prevMessages) => [
                ...prevMessages,
                {
                  role: "user",
                  text: `Execute: ${action.name}`,
                  time: "Now",
                },
                {
                  role: "ai",
                  text: `🔄 ${action.name} is running...`,
                  output: outputLines.join("\n"),
                  time: "Now",
                },
              ]);
              userMessageAdded = true;
            } else {
              // Update output in real-time
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
            lastAIMessage.text = 
              finalStatus === "success"
                ? `✅ ${action.name} completed successfully!`
                : `❌ ${action.name} failed!`;
          }
          return updated;
        });
        
        setExecutingAction(null);
      };
      
      // Wait a bit for the stream to complete before updating final status
      const checkCompletion = setInterval(() => {
        if (finalStatus !== "pending") {
          clearInterval(checkCompletion);
          
          // Log the action to audit trail
          const username = localStorage.getItem('username') || 'Anonymous User';
          logAction(
            action.name,
            action.playbook,
            finalStatus,
            outputLines.join("\n"),
            username
          ).catch(err => console.error('Failed to log action:', err));
          
          setMessages((prevMessages) => {
            const updated = [...prevMessages];
            const lastAIMessage = updated[updated.length - 1];
            if (lastAIMessage && lastAIMessage.role === "ai") {
              lastAIMessage.text = 
                finalStatus === "success"
                  ? `✅ ${action.name} completed successfully!`
                  : `❌ ${action.name} failed!`;
            }
            return updated;
          });
          
          setExecutingAction(null);
        }
      }, 100);
    } catch (error) {
      const username = localStorage.getItem('username') || 'Anonymous User';
      logAction(
        action.name,
        action.playbook,
        'error',
        error.message,
        username
      ).catch(err => console.error('Failed to log action:', err));
      
      setMessages((prevMessages) => [
        ...prevMessages,
        {
          role: "user",
          text: `Execute: ${action.name}`,
          time: "Now",
        },
        {
          role: "ai",
          text: `❌ Error executing action: ${error.message}`,
          time: "Now",
        },
      ]);
      setExecutingAction(null);
    }
  };

  const sendMessage = () => {
    if (!input.trim()) return;
    setMessages([
      ...messages,
      { role: "user", text: input, time: "Now" },
      { role: "ai", text: "I can stage that configuration change and send it to the Staging Gate for approval.", time: "Now" },
    ]);
    setInput("");
  };

  return (
    <div className="min-h-full bg-gradient-to-br from-[#F8FAFC] to-[#D1D5DB] p-8 font-sans">
      <h1 className="text-[#0F172A] text-[30px] font-extrabold tracking-tight drop-shadow-sm">
        AI Chat Console
      </h1>
      <p className="mb-6 text-[#64748B] text-base font-medium">
        Natural language network management and configuration
      </p>

      <div className="mb-8">
        <h2 className="text-[#0F172A] text-lg font-bold mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.id}
                onClick={() => executeAction(action)}
                disabled={executingAction !== null}
                className={`flex flex-col items-start p-5 rounded-2xl border ${action.color} transition-all duration-200 backdrop-blur-sm disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg`}
              >
                <div className={`p-3 rounded-lg ${action.color.split(" ")[0]} mb-3`}>
                  <Icon className={`${action.iconColor}`} size={24} />
                </div>
                <h3 className="text-[#0F172A] font-bold text-sm mb-1">
                  {action.name}
                </h3>
                <p className="text-[#64748B] text-xs leading-relaxed">
                  {action.description}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex min-h-[525px] flex-col overflow-hidden rounded-3xl bg-[#1D293DED] border border-slate-700/50 shadow-lg">
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
                    <span className="rounded-lg bg-blue-600/30 px-2 py-1 text-xs font-bold text-blue-200">AI Assistant</span>
                    <span className="text-xs text-slate-500">{message.time}</span>
                  </div>
                )}
                {message.text}
                {message.output && <ExpandableOutput output={message.output} />}
              </div>
            </div>
          ))}
        </div>

        <div className="border-t border-slate-700/50 bg-[#314157] p-5">
          <div className="mb-5 flex flex-wrap gap-3">
            {["High CPU devices", "Configure VLAN", "Security analysis"].map((prompt) => (
              <button key={prompt} onClick={() => setInput(prompt)} className="rounded-xl border border-slate-600 bg-slate-700/40 px-4 py-2 text-sm text-slate-200">
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
            <button onClick={sendMessage} className="grid h-14 w-14 place-items-center rounded-xl bg-blue-600 text-white shadow-lg shadow-blue-600/25">
              <Send size={20} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
