"use client";

import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Send } from "lucide-react";

export type ChatMessage = {
  id: string;
  content: string;
  sender: "CUSTOMER" | "AI" | "AGENT" | "SYSTEM";
  createdAt: string;
  status?: string;
};

interface Props {
  conversation: {
    id: string;
    name: string;
    phone: string;
    status: string;
    summary?: string;
  } | null;
  messages: ChatMessage[];
  onSend: (text: string) => Promise<boolean>;
  onClose?: () => void;
}

export function ChatThread({ conversation, messages, onSend, onClose }: Props) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (!conversation) {
    return (
      <div className="flex-1 flex items-center justify-center bg-navy-950 text-gray-500">
        <p>Pick a conversation from the list.</p>
      </div>
    );
  }

  async function handleSend() {
    if (!text.trim() || sending) return;
    setSending(true);
    try {
      if (await onSend(text.trim())) {
        setText("");
      }
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex flex-col h-full bg-navy-950">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-navy-700 bg-navy-900/80">
        {onClose && (
          <button
            onClick={onClose}
            className="md:hidden p-1.5 rounded-lg hover:bg-navy-700 text-gray-300"
          >
            ←
          </button>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="font-medium text-white truncate">{conversation.name}</h2>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-accent text-navy-950 font-medium">
              {conversation.status.replace("_", " ")}
            </span>
          </div>
          <p className="text-xs text-gray-400 truncate">
            {conversation.phone}
            {conversation.summary ? ` · ${conversation.summary}` : ""}
          </p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.map((m) => (
          <div
            key={m.id}
            className={cn(
              "flex flex-col",
              m.sender === "AGENT" || m.sender === "AI" ? "items-start" : "items-start",
              m.sender === "AGENT" && "items-end"
            )}
          >
            <div
              className={cn(
                m.sender === "AI" && "bubble-ai",
                m.sender === "CUSTOMER" && "bubble-customer",
                m.sender === "AGENT" && "bubble-admin",
                m.sender === "SYSTEM" && "text-xs text-gray-500 italic"
              )}
            >
              {m.content}
            </div>
            <span className="text-[10px] text-gray-500 mt-1 px-1">
              {m.sender === "AI" && "AI · "}
              {m.sender === "AGENT" && "Admin (dashboard) · "}
              {m.sender === "CUSTOMER" && "Customer · "}
              {new Date(m.createdAt).toLocaleTimeString("en-NG", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Composer */}
      <div className="border-t border-navy-700 p-3 bg-navy-900/50">
        <p className="text-[11px] text-gray-500 mb-2">
          Sends straight to the customer. Does not change the team handoff or alerts.
        </p>
        <div className="flex gap-2">
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
            placeholder="Reply to customer..."
            className="flex-1 rounded-lg bg-navy-800 border border-navy-600 px-4 py-2.5 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-accent"
          />
          <button
            onClick={handleSend}
            disabled={!text.trim() || sending}
            className="rounded-lg bg-accent hover:bg-accent-hover text-navy-950 font-medium px-4 py-2.5 disabled:opacity-50 transition flex items-center gap-1.5"
          >
            <Send className="w-4 h-4" />
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
