"use client";

import { cn, formatRelativeTime } from "@/lib/utils";

export type ConversationPreview = {
  id: string;
  name: string;
  phone: string;
  lastMessage: string;
  lastMessageAt: string;
  status: "followed_up" | "ai_chat" | "closed" | "open" | "lead" | "awaiting_human";
  isUnread?: boolean;
  tags?: string[];
  notes?: string;
  summary?: string;
  handoffId?: string | null;
  lastInboundMessageId?: string | null;
};

const statusStyles: Record<string, string> = {
  followed_up: "bg-accent text-navy-950",
  ai_chat: "bg-navy-600 text-gray-300",
  closed: "bg-emerald-600/80 text-white",
  open: "bg-blue-600/80 text-white",
  lead: "bg-purple-600/80 text-white",
  awaiting_human: "bg-orange-500 text-white",
};

const statusLabels: Record<string, string> = {
  followed_up: "followed up",
  ai_chat: "AI chat",
  closed: "closed",
  open: "open",
  lead: "lead",
  awaiting_human: "handoff",
};

interface Props {
  conversations: ConversationPreview[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  filter: string;
  onFilterChange: (f: string) => void;
  search: string;
  onSearchChange: (s: string) => void;
}

export function ConversationList({
  conversations,
  selectedId,
  onSelect,
  filter,
  onFilterChange,
  search,
  onSearchChange,
}: Props) {
  const filters = [
    { key: "all", label: "All" },
    { key: "awaiting_human", label: "Open handoffs" },
    { key: "lead", label: "Leads" },
    { key: "closed", label: "Closed" },
  ];

  return (
    <div className="flex flex-col h-full border-r border-navy-700 bg-navy-900/50">
      {/* Search */}
      <div className="p-3 border-b border-navy-700">
        <input
          type="text"
          placeholder="Search name, number or message"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full rounded-lg bg-navy-800 border border-navy-600 px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-accent"
        />
      </div>

      {/* Filters */}
      <div className="flex gap-1.5 px-3 py-2 border-b border-navy-700 overflow-x-auto">
        {filters.map((f) => (
          <button
            key={f.key}
            onClick={() => onFilterChange(f.key)}
            className={cn(
              "px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition",
              filter === f.key
                ? "bg-accent text-navy-950"
                : "bg-navy-700 text-gray-300 hover:bg-navy-600"
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {conversations.length === 0 ? (
          <div className="p-6 text-center text-gray-500 text-sm">
            No conversations found
          </div>
        ) : (
          conversations.map((c) => (
            <button
              key={c.id}
              onClick={() => onSelect(c.id)}
              className={cn(
                "w-full text-left px-3 py-3 border-b border-navy-800 hover:bg-navy-800/60 transition",
                selectedId === c.id && "bg-navy-800"
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-white text-sm truncate">
                      {c.name}
                    </span>
                    {c.isUnread && (
                      <span className="w-2 h-2 rounded-full bg-accent shrink-0" />
                    )}
                    <span
                      className={cn(
                        "text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0",
                        statusStyles[c.status] || statusStyles.open
                      )}
                    >
                      {statusLabels[c.status] || c.status}
                    </span>
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5">{c.phone}</div>
                  <div className="text-xs text-gray-500 mt-1 truncate">
                    {c.lastMessage}
                  </div>
                </div>
                <span className="text-[10px] text-gray-500 shrink-0">
                  {formatRelativeTime(c.lastMessageAt)}
                </span>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
