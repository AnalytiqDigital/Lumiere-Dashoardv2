"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ConversationList, type ConversationPreview } from "@/components/inbox/ConversationList";
import { ChatThread, type ChatMessage } from "@/components/inbox/ChatThread";
import { CustomerPanel } from "@/components/inbox/CustomerPanel";
import { businessConfig } from "@/lib/business-config";
import { Bell, LogOut } from "lucide-react";

function responseError(data: unknown, fallback: string): string {
  if (
    typeof data === "object" &&
    data !== null &&
    "error" in data &&
    typeof data.error === "string"
  ) {
    return data.error;
  }
  return fallback;
}

export default function InboxPage() {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [conversations, setConversations] = useState<ConversationPreview[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [mobileView, setMobileView] = useState<"list" | "chat" | "customer">("list");
  const [error, setError] = useState("");
  const [loadingConversations, setLoadingConversations] = useState(true);

  const loadConversations = useCallback(async () => {
    const response = await fetch("/api/conversations", { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(responseError(data, "Could not load conversations"));
    }
    setConversations(data.conversations);
  }, []);

  useEffect(() => {
    let active = true;
    fetch("/api/conversations", { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) {
          throw new Error(responseError(data, "Could not load conversations"));
        }
        if (active) setConversations(data.conversations);
      })
      .catch((cause: unknown) => {
        if (active) {
          setError(cause instanceof Error ? cause.message : "Could not load conversations");
        }
      })
      .finally(() => {
        if (active) setLoadingConversations(false);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!selectedId) {
      setMessages([]);
      return;
    }

    let active = true;
    setMessages([]);
    fetch(`/api/conversations/${encodeURIComponent(selectedId)}/messages`, {
      cache: "no-store",
    })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) {
          throw new Error(responseError(data, "Could not load messages"));
        }
        if (active) setMessages(data.messages);
      })
      .catch((cause: unknown) => {
        if (active) {
          setError(cause instanceof Error ? cause.message : "Could not load messages");
        }
      });

    return () => {
      active = false;
    };
  }, [selectedId]);

  const filtered = conversations.filter((conversation) => {
    if (filter !== "all" && conversation.status !== filter) return false;
    if (!search) return true;
    const query = search.toLowerCase();
    return (
      conversation.name.toLowerCase().includes(query) ||
      conversation.phone.includes(query) ||
      conversation.lastMessage.toLowerCase().includes(query)
    );
  });

  const selected = conversations.find((conversation) => conversation.id === selectedId) || null;

  async function handleSend(text: string): Promise<boolean> {
    if (!selectedId) return false;
    setError("");

    try {
      const response = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId: selectedId, content: text }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(responseError(data, "Could not send reply"));
      }
      setMessages((previous) => [...previous, data.message]);
      await loadConversations();
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not send reply");
      return false;
    }
  }

  async function handleAction(action: "takeover" | "close") {
    if (!selectedId) return;
    setError("");

    try {
      const response = await fetch(
        `/api/conversations/${encodeURIComponent(selectedId)}/actions`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        }
      );
      const data = await response.json();
      if (!response.ok) {
        throw new Error(responseError(data, "Could not update conversation"));
      }
      await loadConversations();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not update conversation");
    }
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  return (
    <div className="h-screen flex flex-col bg-navy-950">
      <header className="flex items-center justify-between px-4 py-2.5 border-b border-navy-700 bg-navy-900 shrink-0">
        <h1 className="text-sm font-medium text-white">
          {businessConfig.name} · Chats
        </h1>
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <span className="hidden sm:inline px-2 py-1 rounded-full bg-navy-700">
            {conversations.filter((conversation) => conversation.status === "awaiting_human").length} open handoffs
          </span>
          <span className="hidden md:inline">
            Updated {new Date().toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit" })}
          </span>
          <button className="flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-navy-700">
            <Bell className="w-3.5 h-3.5" />
            On
          </button>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-navy-700 text-gray-300"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign out
          </button>
        </div>
      </header>

      {error && (
        <div role="alert" className="px-4 py-2 bg-red-950 text-red-200 text-sm">
          {error}
        </div>
      )}

      <div className="flex-1 flex overflow-hidden">
        <div
          className={`w-full md:w-[320px] lg:w-[340px] shrink-0 ${
            mobileView !== "list" ? "hidden md:block" : "block"
          }`}
        >
          {loadingConversations && conversations.length === 0 ? (
            <div className="h-full flex items-center justify-center text-sm text-gray-500">
              Loading conversations…
            </div>
          ) : (
            <ConversationList
              conversations={filtered}
              selectedId={selectedId}
              onSelect={(id) => {
                setSelectedId(id);
                setMobileView("chat");
              }}
              filter={filter}
              onFilterChange={setFilter}
              search={search}
              onSearchChange={setSearch}
            />
          )}
        </div>

        <div
          className={`flex-1 min-w-0 ${
            mobileView === "list" ? "hidden md:block" : mobileView === "customer" ? "hidden lg:block" : "block"
          }`}
        >
          <ChatThread
            conversation={
              selected
                ? {
                    id: selected.id,
                    name: selected.name,
                    phone: selected.phone,
                    status: selected.status,
                    summary: selected.summary,
                  }
                : null
            }
            messages={messages}
            onSend={handleSend}
            onClose={() => {
              setMobileView("list");
              setSelectedId(null);
            }}
          />
        </div>

        <div
          className={`${
            mobileView === "customer" ? "block w-full" : "hidden lg:block"
          }`}
        >
          <CustomerPanel
            customer={
              selected
                ? {
                    name: selected.name,
                    phone: selected.phone,
                    status: selected.status,
                    tags: selected.tags,
                    notes: selected.notes,
                    summary: selected.summary,
                  }
                : null
            }
            onClose={() => setMobileView("chat")}
            onTakeover={() => handleAction("takeover")}
            onCloseHandoff={() => handleAction("close")}
          />
        </div>
      </div>
    </div>
  );
}
