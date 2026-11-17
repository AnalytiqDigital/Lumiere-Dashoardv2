export type ApiConversation = {
  id: string;
  name: string;
  phone: string;
  lastMessage: string;
  lastMessageAt: string;
  status: string;
  isUnread?: boolean;
  lastInboundMessageId?: string | null;
  tags?: string[];
  notes?: string;
  summary?: string;
  handoffId?: string | null;
  handoffReason?: string;
};

export type ApiMessage = {
  id: string;
  content: string;
  sender: "CUSTOMER" | "AI" | "AGENT" | "SYSTEM";
  createdAt: string;
  status?: string | null;
};

export type SolarConversation = {
  id: string;
  name: string;
  phone: string;
  status: string;
  reason: string;
  last: string;
  lastAt: number;
  hasOpen: boolean;
  handoffId: string | null;
};

export type SolarMessage = {
  id: string;
  dir: "in" | "out";
  kind: "customer" | "ai" | "admin" | "team" | "system";
  text: string;
  at: number;
};

export function digitsOnly(phone: string): string {
  return String(phone || "").replace(/\D/g, "");
}

function solarStatus(conversation: ApiConversation, hasOpen: boolean): string {
  if (hasOpen) return "open";
  switch (conversation.status) {
    case "closed":
      return "closed";
    case "lead":
      return "lead";
    case "followed_up":
      return "followed_up";
    default:
      // Lumiere's OPEN/AI_HANDLED map to Solar's "AI chat" (status "none").
      return "none";
  }
}

export function toConversation(conversation: ApiConversation): SolarConversation {
  const hasOpen =
    Boolean(conversation.handoffId) && conversation.status !== "closed";
  const lastAt = new Date(conversation.lastMessageAt).getTime();
  return {
    id: conversation.id,
    name: conversation.name || "",
    phone: digitsOnly(conversation.phone),
    status: solarStatus(conversation, hasOpen),
    reason: conversation.handoffReason || conversation.summary || "",
    last: conversation.lastMessage || "",
    lastAt: Number.isFinite(lastAt) ? lastAt : 0,
    hasOpen,
    handoffId: conversation.handoffId || null,
  };
}

export function sortConversations(rows: SolarConversation[]): SolarConversation[] {
  return [...rows].sort(
    (a, b) => Number(b.hasOpen) - Number(a.hasOpen) || b.lastAt - a.lastAt
  );
}

export function toMessage(message: ApiMessage): SolarMessage {
  if (message.sender === "CUSTOMER") {
    return {
      id: message.id,
      dir: "in",
      kind: "customer",
      text: message.content,
      at: new Date(message.createdAt).getTime(),
    };
  }
  if (message.sender === "AI") {
    return {
      id: message.id,
      dir: "out",
      kind: "ai",
      text: message.content,
      at: new Date(message.createdAt).getTime(),
    };
  }
  if (message.sender === "AGENT") {
    return {
      id: message.id,
      dir: "out",
      kind: message.status === "sent" ? "admin" : "team",
      text: message.content,
      at: new Date(message.createdAt).getTime(),
    };
  }
  return {
    id: message.id,
    dir: "out",
    kind: "system",
    text: message.content,
    at: new Date(message.createdAt).getTime(),
  };
}

export function formatStatus(status: string): string {
  return status === "none" ? "AI chat" : status.replace("_", " ");
}

export function formatTime(at: number): string {
  if (!at) return "";
  const date = new Date(at);
  const now = new Date();
  const time = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (date.toDateString() === now.toDateString()) return time;
  return `${date.toLocaleDateString([], { day: "numeric", month: "short" })} ${time}`;
}

export function senderLabel(kind: SolarMessage["kind"]): string {
  switch (kind) {
    case "customer":
      return "Customer";
    case "admin":
      return "Admin (dashboard)";
    case "team":
      return "Team";
    case "system":
      return "System";
    default:
      return "AI";
  }
}

export function bubbleClass(message: SolarMessage): string {
  if (message.dir === "in") return "in";
  if (message.kind === "admin") return "out admin";
  if (message.kind === "team") return "out team";
  return "out";
}
