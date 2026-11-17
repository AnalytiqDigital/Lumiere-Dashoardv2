"use client";

import {
  formatStatus,
  formatTime,
  type SolarConversation,
} from "@/lib/dashboard";

const TABS = [
  ["all", "All"],
  ["open", "Open handoffs"],
  ["lead", "Leads"],
  ["closed", "Closed"],
] as const;

export type InboxFilter = (typeof TABS)[number][0];

interface Props {
  conversations: SolarConversation[];
  selectedId: string | null;
  filter: InboxFilter;
  search: string;
  onSelect: (id: string) => void;
  onFilterChange: (filter: InboxFilter) => void;
  onSearchChange: (search: string) => void;
}

export function ConversationList({
  conversations,
  selectedId,
  filter,
  search,
  onSelect,
  onFilterChange,
  onSearchChange,
}: Props) {
  return (
    <section id="side">
      <div id="tools">
        <input
          id="q"
          placeholder="Search name, number or message"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
        />
        <div id="tabs">
          {TABS.map(([key, label]) => (
            <button
              key={key}
              type="button"
              className={filter === key ? "on" : undefined}
              onClick={() => onFilterChange(key)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <div id="list">
        {conversations.length ? (
          conversations.map((conversation) => (
            <div
              key={conversation.id}
              className={`row${conversation.id === selectedId ? " sel" : ""}`}
              onClick={() => onSelect(conversation.id)}
            >
              <div className="t">
                <b>{conversation.name || `+${conversation.phone}`}</b>
                <small>{formatTime(conversation.lastAt)}</small>
              </div>
              <div className="t">
                <small>{`+${conversation.phone}`}</small>
                <span className={`tag ${conversation.status}`}>
                  {formatStatus(conversation.status)}
                </span>
              </div>
              <div className="p">{conversation.last}</div>
            </div>
          ))
        ) : (
          <div className="empty">No conversations.</div>
        )}
      </div>
    </section>
  );
}
