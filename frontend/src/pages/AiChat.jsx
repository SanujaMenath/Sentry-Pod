import React from 'react';
import { Bot, Send } from 'lucide-react';

export default function AiChat() {
  return (
    <section>
      <h1>AI Chat Console</h1>
      <p className="page-subtitle">Natural language network management and configuration</p>

      <div className="chat-card">
        <div className="chat-body">
          <div className="bot-badge"><Bot size={20} /></div>
          <div className="message-bubble">
            <div>
              <strong>AI Assistant</strong>
              <span>10:48:11 PM</span>
            </div>
            <p>
              Hello! I&apos;m your AI Network Assistant. I can help you configure devices,
              analyze logs, troubleshoot issues, and answer questions about your network.
              What would you like to do today?
            </p>
          </div>
        </div>

        <div className="chat-composer">
          <div className="quick-prompts">
            <button>High CPU devices</button>
            <button>Configure VLAN</button>
            <button>Security analysis</button>
          </div>
          <div className="input-row">
            <input placeholder="Type your command or question... (Press Enter to send)" />
            <button><Send size={20} /></button>
          </div>
        </div>
      </div>
    </section>
  );
}
