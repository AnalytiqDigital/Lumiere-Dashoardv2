"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ConversationList, type ConversationPreview } from "@/components/inbox/ConversationList";
import { ChatThread, type ChatMessage } from "@/components/inbox/ChatThread";
import { CustomerPanel } from "@/components/inbox/CustomerPanel";
import { businessConfig } from "@/lib/business-config";
import { Bell, LogOut } from "lucide-react";

const REFRESH_INTERVAL_MS = 3000;

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
  const [alertsEnabled, setAlertsEnabled] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [toast, setToast] = useState("");
  const [toastTitle, setToastTitle] = useState("");
  const seenConversations = useRef<Map<string, { lastInboundMessageId: string | null; status: string }> | null>(null);
  const alertAudio = useRef<AudioContext | null>(null);

  const loadConversations = useCallback(async () => {
    const response = await fetch("/api/conversations", { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(responseError(data, "Could not load conversations"));
    }
    const next = data.conversations as ConversationPreview[];
    const previous = seenConversations.current;
    if (previous) {
      const newMessages = next.filter((conversation) => {
        const prior = previous.get(conversation.id);
        return (
          conversation.lastInboundMessageId &&
          (!prior || prior.lastInboundMessageId !== conversation.lastInboundMessageId)
        );
      });
      const newHandoffs = next.filter((conversation) => {
        const prior = previous.get(conversation.id);
        return conversation.status === "awaiting_human" && prior?.status !== "awaiting_human";
      });
      if (newMessages.length || newHandoffs.length) {
        const hasNewHandoff = newHandoffs.length > 0;
        const count = Math.max(newMessages.length, newHandoffs.length);
        const title = hasNewHandoff ? "New handoff" : "New WhatsApp message";
        const body = hasNewHandoff
          ? `${newHandoffs[0].name} needs your attention.`
          : `${newMessages[0].name}: ${newMessages[0].lastMessage}`;
        setToastTitle(title);
        setToast(body);
        if (alertsEnabled && "Notification" in window && Notification.permission === "granted") {
          new Notification(title, { body, tag: `lumiere-${newMessages[0]?.id ?? newHandoffs[0]?.id}` });
          const audio = alertAudio.current;
          if (audio?.state === "running") {
            const oscillator = audio.createOscillator();
            const gain = audio.createGain();
            oscillator.frequency.value = 880;
            gain.gain.setValueAtTime(0.0001, audio.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.08, audio.currentTime + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + 0.25);
            oscillator.connect(gain);
            gain.connect(audio.destination);
            oscillator.start();
            oscillator.stop(audio.currentTime + 0.25);
          }
        }
        if (count > 1) setToast(`${count} new conversations need your attention.`);
      }
    }
    seenConversations.current = new Map(
      next.map((conversation) => [
        conversation.id,
        { lastInboundMessageId: conversation.lastInboundMessageId ?? null, status: conversation.status },
      ]),
    );
    setConversations(next);
    setUpdatedAt(new Date());
  }, [alertsEnabled]);

  useEffect(() => {
    let active = true;
    let refreshing = false;
    const refresh = async () => {
      if (refreshing) return;
      refreshing = true;
      try {
        await loadConversations();
        if (active) setError("");
      } catch (cause) {
        if (active) {
          setError(cause instanceof Error ? cause.message : "Could not load conversations");
        }
      } finally {
        refreshing = false;
        if (active) setLoadingConversations(false);
      }
    };
    void refresh();
    const timer = window.setInterval(() => void refresh(), REFRESH_INTERVAL_MS);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [loadConversations]);

  useEffect(() => {
    if (!selectedId) {
      setMessages([]);
      return;
    }

    let active = true;
    let refreshing = false;
    setMessages([]);
    const refresh = async () => {
      if (refreshing) return;
      refreshing = true;
      try {
        const response = await fetch(`/api/conversations/${encodeURIComponent(selectedId)}/messages`, {
          cache: "no-store",
        });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(responseError(data, "Could not load messages"));
        }
        if (active) setMessages(data.messages);
      } catch (cause) {
        if (active) {
          setError(cause instanceof Error ? cause.message : "Could not load messages");
        }
      } finally {
        refreshing = false;
      }
    };
    void refresh();
    const timer = window.setInterval(() => void refresh(), REFRESH_INTERVAL_MS);

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [selectedId]);

  useEffect(() => {
    if ("Notification" in window && Notification.permission === "granted") {
      setAlertsEnabled(localStorage.getItem("lumiere-alerts-enabled") === "true");
    }
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 6000);
    return () => window.clearTimeout(timer);
  }, [toast]);

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

  async function enableAlerts() {
    if (!("Notification" in window)) {
      setError("This browser does not support desktop notifications.");
      return;
    }
    const permission =
      Notification.permission === "granted"
        ? "granted"
        : await Notification.requestPermission();
    if (permission !== "granted") {
      setError("Allow notifications in your browser settings to receive message and handoff alerts.");
      return;
    }
    try {
      if ("AudioContext" in window) {
        const audio = alertAudio.current ?? new window.AudioContext();
        await audio.resume();
        alertAudio.current = audio;
      }
      localStorage.setItem("lumiere-alerts-enabled", "true");
      setAlertsEnabled(true);
      setError("");
    } catch {
      setError("Notifications are enabled, but this browser could not enable alert sounds.");
      setAlertsEnabled(true);
    }
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
          <span className="hidden md:inline" aria-live="polite">
            {updatedAt
              ? `Updated ${updatedAt.toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`
              : "Syncing…"}
          </span>
          <button
            onClick={enableAlerts}
            className="flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-navy-700"
            aria-label={alertsEnabled ? "Message and handoff alerts enabled" : "Enable message and handoff alerts"}
          >
            <Bell className="w-3.5 h-3.5" />
            {alertsEnabled ? "Alerts on" : "Enable alerts"}
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
      {toast && (
        <div role="status" aria-live="polite" className="absolute right-4 top-14 z-50 max-w-sm rounded-lg border border-accent bg-navy-800 px-4 py-3 text-sm text-white shadow-xl">
          <strong className="block">{toastTitle}</strong>
          <span>{toast}</span>
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
