import { NextResponse } from "next/server";
import { hasValidSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const businessSlug = "lumiere-belleza";

function toUiStatus(status: string) {
  switch (status) {
    case "AI_HANDLED":
      return "ai_chat";
    case "AWAITING_HUMAN":
      return "awaiting_human";
    case "HUMAN_HANDLED":
    case "FOLLOWED_UP":
      return "followed_up";
    case "CLOSED":
      return "closed";
    case "LEAD":
      return "lead";
    default:
      return "open";
  }
}

export async function GET() {
  if (!(await hasValidSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const conversations = await prisma.conversation.findMany({
      where: { business: { slug: businessSlug } },
      include: {
        customer: true,
        handoffs: {
          where: { status: { in: ["OPEN", "ASSIGNED"] } },
          orderBy: { requestedAt: "desc" },
          take: 1,
        },
        messages: {
          where: { sender: "CUSTOMER" },
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { id: true },
        },
      },
      orderBy: { lastMessageAt: "desc" },
      take: 100,
    });

    return NextResponse.json({
      conversations: conversations.map((conversation) => ({
        id: conversation.id,
        name:
          conversation.customer.name ||
          conversation.customer.pushName ||
          conversation.customer.phoneNumber,
        phone: conversation.customer.phoneNumber,
        lastMessage: conversation.lastMessageText || "",
        lastMessageAt: conversation.lastMessageAt.toISOString(),
        status: toUiStatus(conversation.status),
        isUnread: conversation.isUnread,
        lastInboundMessageId: conversation.messages[0]?.id ?? null,
        tags: conversation.customer.tags,
        notes: conversation.customer.notes || "",
        summary: conversation.summary || "",
        handoffId: conversation.handoffs[0]?.id || null,
      })),
    });
  } catch (error) {
    console.error("[conversations] failed to load", error);
    return NextResponse.json(
      { error: "Failed to load conversations" },
      { status: 500 }
    );
  }
}
