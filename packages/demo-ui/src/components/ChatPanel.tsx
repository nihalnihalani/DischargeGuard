"use client";

import { useState, useRef, useEffect, useCallback } from "react";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  isDemo?: boolean;
  timestamp: Date;
}

const SUGGESTED_PROMPTS = [
  "Conduct day-3 check-in for Maria Garcia",
  "Show risk dashboard",
  "Calculate readmission risk for patient 12345",
  "Reconcile medications for Maria Garcia",
];

function renderMarkdown(text: string): string {
  return text
    .replace(/^## (.+)$/gm, '<h2 class="text-sm font-bold text-blue-300 mt-3 mb-1">$1</h2>')
    .replace(/^### (.+)$/gm, '<h3 class="text-xs font-bold text-blue-200 mt-2 mb-0.5">$1</h3>')
    .replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold text-white">$1</strong>')
    .replace(/🚨/g, '<span class="text-red-400">🚨</span>')
    .replace(/✅/g, '<span class="text-green-400">✅</span>')
    .replace(/🔴/g, '<span class="text-red-400">🔴</span>')
    .replace(/🟠/g, '<span class="text-orange-400">🟠</span>')
    .replace(/🟡/g, '<span class="text-yellow-400">🟡</span>')
    .replace(/🟢/g, '<span class="text-green-400">🟢</span>')
    .replace(/\n/g, "<br/>");
}

function MessageBubble({ msg }: { msg: Message }) {
  const isUser = msg.role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} mb-3`}>
      {!isUser && (
        <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center text-xs mr-2 flex-shrink-0 mt-0.5">
          🎯
        </div>
      )}
      <div
        className={`max-w-[85%] rounded-xl px-3 py-2 text-xs leading-relaxed ${
          isUser
            ? "bg-blue-600 text-white rounded-br-sm"
            : "bg-slate-700 text-slate-200 rounded-bl-sm"
        }`}
      >
        {isUser ? (
          <span>{msg.content}</span>
        ) : (
          <div
            className="prose-chat"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }}
          />
        )}
        {msg.isDemo && (
          <span className="text-[9px] text-slate-400 mt-1 block">
            ⚡ Demo response — start agents for live data
          </span>
        )}
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex justify-start mb-3">
      <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center text-xs mr-2 flex-shrink-0">
        🎯
      </div>
      <div className="bg-slate-700 rounded-xl rounded-bl-sm px-3 py-2">
        <div className="flex gap-1 items-center h-4">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce"
              style={{ animationDelay: `${i * 150}ms` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export function ChatPanel() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content: `Welcome to **DischargeGuard** — Post-Discharge Care Coordination

I coordinate 4 AI agents to monitor patients for 30 days after hospital discharge:

- 🩺 **Monitoring Agent** — Diagnosis-specific check-ins
- 📊 **Risk Scoring Agent** — LACE + composite risk scoring
- 🚨 **Escalation Agent** — Care team tasks + FHIR Communications
- 🎯 **Orchestrator** (me) — Pipeline coordination

Try one of the suggested prompts below, or type your own.`,
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionId] = useState(() => crypto.randomUUID());
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: trimmed,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const resp = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed, sessionId }),
      });

      const data = (await resp.json()) as { response: string; demo?: boolean; error?: string };

      const assistantMsg: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: data.response,
        isDemo: data.demo,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: "Connection error. Make sure the orchestrator agent is running (`npm run dev:orchestrator`).",
          timestamp: new Date(),
        },
      ]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }, [loading, sessionId]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void sendMessage(input);
    }
  };

  return (
    <div className="flex flex-col bg-slate-800 rounded-xl border border-slate-700 overflow-hidden" style={{ height: "520px" }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700 bg-slate-800/80">
        <div className="flex items-center gap-2">
          <span className="text-lg">🎯</span>
          <div>
            <h2 className="text-sm font-semibold text-slate-200">Orchestrator Chat</h2>
            <p className="text-[10px] text-slate-500">DischargeGuard A2A Pipeline</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          <span className="text-[11px] text-slate-500">A2A</span>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4">
        {messages.map((msg) => (
          <MessageBubble key={msg.id} msg={msg} />
        ))}
        {loading && <TypingIndicator />}
        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Prompts */}
      {messages.length <= 2 && !loading && (
        <div className="px-4 pb-2">
          <p className="text-[10px] text-slate-600 mb-1.5">Suggested:</p>
          <div className="flex flex-wrap gap-1.5">
            {SUGGESTED_PROMPTS.map((prompt) => (
              <button
                key={prompt}
                onClick={() => void sendMessage(prompt)}
                className="text-[10px] bg-slate-700 hover:bg-blue-600/30 border border-slate-600 hover:border-blue-500/50 text-slate-300 px-2 py-1 rounded-full transition-colors"
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="px-3 py-3 border-t border-slate-700 bg-slate-800/80">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message or try a suggested prompt..."
            disabled={loading}
            className="flex-1 bg-slate-700 border border-slate-600 focus:border-blue-500 rounded-lg px-3 py-2 text-xs text-slate-200 placeholder-slate-500 outline-none transition-colors disabled:opacity-50"
          />
          <button
            onClick={() => void sendMessage(input)}
            disabled={!input.trim() || loading}
            className="bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-lg px-3 py-2 text-xs font-medium transition-colors"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
