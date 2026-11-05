import { NextResponse } from "next/server";
import { hasValidSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
  if (!(await hasValidSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const conversation = await prisma.conversation.findFirst({
      where: { id, business: { slug: "lumiere-belleza" } },
      select: { id: true },
    });

    if (!conversation) {
      return NextResponse.json(
        { error: "Conversation not found" },
        { status: 404 }
      );
    }

    const messages = await prisma.message.findMany({
      where: { conversationId: id },
      orderBy: { createdAt: "asc" },
      take: 500,
    });
    await prisma.conversation.update({
      where: { id },
      data: { isUnread: false },
    });

    return NextResponse.json({
      messages: messages.map((message) => ({
        id: message.id,
        content: message.content,
        sender: message.sender,
        createdAt: message.createdAt.toISOString(),
        status: message.status,
      })),
    });
  } catch (error) {
    console.error("[conversation-messages] failed to load", error);
    return NextResponse.json(
      { error: "Failed to load messages" },
      { status: 500 }
    );
  }
}
