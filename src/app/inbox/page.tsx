"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChatThread } from "@/components/inbox/ChatThread";
import {
  ConversationList,
  type InboxFilter,
} from "@/components/inbox/ConversationList";
import {
  beep,
  flashTitle,
  notifyNewHandoff,
  readSoundPreference,
  requestNotificationPermission,
  stopTitleFlash,
  writeSoundPreference,
} from "@/lib/alerts";
import { businessConfig } from "@/lib/business-config";
import {
  sortConversations,
  toConversation,
  toMessage,
  type ApiConversation,
  type ApiMessage,
  type SolarConversation,
  type SolarMessage,
} from "@/lib/dashboard";

const REFRESH_MS = 3000;
const SEEN_KEY = "lumiere-seen-handoffs";

type ApiError = { error?: string; hint?: string };

function errorText(data: unknown, fallback: string): string {
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

function redirectToLogin(): void {
  stopTitleFlash();
  window.location.href = "/login";
}

function readSeen(): string[] {
  try {
    const raw = window.localStorage.getItem(SEEN_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export default function InboxPage() {
  const router = useRouter();
  const [rows, setRows] = useState<SolarConversation[]>([]);
  const [messages, setMessages] = useState<SolarMessage[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<InboxFilter>("all");
  const [search, setSearch] = useState("");
  const [sync, setSync] = useState("…");
  const [soundOn, setSoundOn] = useState(true);
  const [banner, setBanner] = useState<{ names: string; id: string } | null>(
    null
  );
  const [sending, setSending] = useState(false);
  const [closing, setClosing] = useState(false);
  const [chatting, setChatting] = useState(false);

  const refreshingConversations = useRef(false);

  const refreshConversations = useCallback(async () => {
    const response = await fetch("/api/conversations", { cache: "no-store" });
    if (response.status === 401) {
      redirectToLogin();
      return;
    }
    const data = (await response.json().catch(() => ({}))) as {
      conversations?: ApiConversation[];
    } & ApiError;
    if (!response.ok || !data.conversations) {
      throw new Error(errorText(data, "Request failed"));
    }

    const next = sortConversations(data.conversations.map(toConversation));
    const stored = window.localStorage.getItem(SEEN_KEY);
    const seen = new Set(readSeen());
    const fresh = next.filter(
      (conversation) => conversation.hasOpen && !seen.has(conversation.id)
    );

    if (fresh.length && stored) {
      const names = fresh
        .map((conversation) => conversation.name || `+${conversation.phone}`)
        .join(", ");
      setBanner({ names, id: fresh[0].id });
      if (readSoundPreference()) beep();
      notifyNewHandoff(names);
      flashTitle();
    }

    window.localStorage.setItem(
      SEEN_KEY,
      JSON.stringify(
        next
          .filter((conversation) => conversation.handoffId)
          .map((conversation) => conversation.id)
          .slice(0, 1000)
      )
    );

    setRows(next);
    setSync(
      `Updated ${new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })}`
    );
  }, []);

  useEffect(() => {
    let active = true;

    const refresh = async () => {
      if (refreshingConversations.current) return;
      refreshingConversations.current = true;
      try {
        await refreshConversations();
      } catch (cause) {
        if (active) {
          const message =
            cause instanceof Error ? cause.message : "Request failed";
          setSync(`Offline: ${message.slice(0, 60)}`);
        }
      } finally {
        refreshingConversations.current = false;
      }
    };

    void refresh();
    const timer = window.setInterval(() => void refresh(), REFRESH_MS);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [refreshConversations]);

  useEffect(() => {
    if (!selectedId) {
      setMessages([]);
      return;
    }

    let active = true;
    let refreshing = false;
    setMessages([]);

    const load = async () => {
      if (refreshing) return;
      refreshing = true;
      try {
        const response = await fetch(
          `/api/conversations/${encodeURIComponent(selectedId)}/messages`,
          { cache: "no-store" }
        );
        if (response.status === 401) {
          redirectToLogin();
          return;
        }
        const data = (await response.json().catch(() => ({}))) as {
          messages?: ApiMessage[];
        } & ApiError;
        if (!response.ok || !data.messages) {
          throw new Error(errorText(data, "Could not load messages"));
        }
        if (active) setMessages(data.messages.map(toMessage));
      } catch (cause) {
        if (active) {
          const message =
            cause instanceof Error ? cause.message : "Could not load messages";
          setSync(`Offline: ${message.slice(0, 60)}`);
        }
      } finally {
        refreshing = false;
      }
    };

    void load();
    const timer = window.setInterval(() => void load(), REFRESH_MS);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [selectedId]);

  useEffect(() => {
    setSoundOn(readSoundPreference());
    requestNotificationPermission();
    return () => stopTitleFlash();
  }, []);

  useEffect(() => {
    if (selectedId && !rows.some((row) => row.id === selectedId)) {
      setSelectedId(null);
      setChatting(false);
    }
  }, [rows, selectedId]);

  const selected = rows.find((row) => row.id === selectedId) || null;
  const openCount = rows.filter((row) => row.hasOpen).length;

  const query = search.trim().toLowerCase();
  const visible = rows.filter((conversation) => {
    if (filter === "open" && !conversation.hasOpen) return false;
    if (
      filter === "lead" &&
      !["lead", "followed_up"].includes(conversation.status)
    ) {
      return false;
    }
    if (filter === "closed" && conversation.status !== "closed") return false;
    return (
      !query ||
      `${conversation.name} ${conversation.phone} ${conversation.last}`
        .toLowerCase()
        .includes(query)
    );
  });

  function toggleSound() {
    const next = !soundOn;
    setSoundOn(next);
    writeSoundPreference(next);
    if (next) beep();
  }

  async function handleLogout() {
    stopTitleFlash();
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      router.push("/login");
    }
  }

  async function handleSend(text: string): Promise<boolean> {
    if (!selectedId) return false;
    setSending(true);
    try {
      const response = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId: selectedId, content: text }),
      });
      if (response.status === 401) {
        redirectToLogin();
        return false;
      }
      const data = (await response.json().catch(() => ({}))) as {
        message?: ApiMessage;
      } & ApiError;
      if (!response.ok || !data.message) {
        const hint = data.hint ? `\n\n${data.hint}` : "";
        window.alert(`${errorText(data, "Could not send reply")}${hint}`);
        return false;
      }
      setMessages((previous) => [...previous, toMessage(data.message!)]);
      void refreshConversations().catch(() => {});
      return true;
    } catch {
      window.alert("Could not send reply");
      return false;
    } finally {
      setSending(false);
    }
  }

  async function handleClose() {
    const row = rows.find((conversation) => conversation.id === selectedId);
    if (!row) return;
    const label = row.name || `+${row.phone}`;
    if (!window.confirm(`Close this chat for ${label}?`)) return;

    setClosing(true);
    try {
      const response = await fetch(
        `/api/conversations/${encodeURIComponent(row.id)}/actions`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "close" }),
        }
      );
      if (response.status === 401) {
        redirectToLogin();
        return;
      }
      const data = (await response.json().catch(() => ({}))) as ApiError;
      if (!response.ok) {
        window.alert(errorText(data, "Could not close chat"));
        return;
      }
      await refreshConversations().catch(() => {});
    } catch {
      window.alert("Could not close chat");
    } finally {
      setClosing(false);
    }
  }

  return (
    <div className={`sa${chatting ? " chatting" : ""}`}>
      <div id="app">
        <header>
          <h1>{businessConfig.name} · Chats</h1>
          <span className={`pill${openCount ? " hot" : ""}`}>
            {`${openCount} open handoff${openCount === 1 ? "" : "s"}`}
          </span>
          <span className="pill" aria-live="polite">
            {sync}
          </span>
          <button
            type="button"
            className="ghost"
            title="Toggle alert sound"
            onClick={toggleSound}
          >
            {soundOn ? "🔔 On" : "🔕 Off"}
          </button>
          <button type="button" className="ghost" onClick={handleLogout}>
            Sign out
          </button>
        </header>

        {banner && (
          <div
            id="banner"
            role="alert"
            onClick={() => {
              setSelectedId(banner.id);
              setChatting(true);
              setBanner(null);
              stopTitleFlash();
            }}
          >
            {`🚨 AI handoff: ${banner.names} needs a human. Click to open.`}
          </div>
        )}

        <main>
          <ConversationList
            conversations={visible}
            selectedId={selectedId}
            filter={filter}
            search={search}
            onSelect={(id) => {
              setSelectedId(id);
              setChatting(true);
            }}
            onFilterChange={setFilter}
            onSearchChange={setSearch}
          />
          <ChatThread
            conversation={selected}
            messages={messages}
            sending={sending}
            closing={closing}
            onSend={handleSend}
            onClose={() => void handleClose()}
            onBack={() => setChatting(false)}
          />
        </main>
      </div>
    </div>
  );
}
