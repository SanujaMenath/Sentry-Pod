import React, { useState } from "react";
import { Bot, Send } from "lucide-react";

export default function AiChat() {
  const [messages, setMessages] = useState([
    {
      role: "ai",
      text: "Hello! I'm your AI Network Assistant. I can help you configure devices, analyze logs, troubleshoot issues, and answer questions about your network. What would you like to do today?",
      time: "10:48:11 PM",
    },
  ]);
  const [input, setInput] = useState("");

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

      <div className="flex min-h-[525px] flex-col overflow-hidden rounded-3xl bg-[#1D293DED] border border-slate-700/50 shadow-lg">
        <div className="flex-1 space-y-5 p-6">
          {messages.map((message, index) => (
            <div key={index} className={`flex gap-4 ${message.role === "user" ? "justify-end" : ""}`}>
              {message.role === "ai" && (
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-violet-600 text-white">
                  <Bot size={20} />
                </div>
              )}

              <div className={`max-w-3xl rounded-2xl px-5 py-4 text-sm leading-relaxed ${message.role === "user" ? "bg-blue-600 text-white" : "bg-[#0F172A] text-slate-300"}`}>
                {message.role === "ai" && (
                  <div className="mb-2 flex items-center gap-2">
                    <span className="rounded-lg bg-blue-600/30 px-2 py-1 text-xs font-bold text-blue-200">AI Assistant</span>
                    <span className="text-xs text-slate-500">{message.time}</span>
                  </div>
                )}
                {message.text}
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
