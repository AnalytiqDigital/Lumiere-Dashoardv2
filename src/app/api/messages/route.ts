import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { hasValidSession } from "@/lib/auth";
import {
  AdminWebhookConfigurationError,
  AdminWebhookRequestError,
  sendAdminWebhookAction,
} from "@/lib/n8n-admin";
import { prisma } from "@/lib/prisma";

const replySchema = z.object({
  conversationId: z.string().min(1),
  content: z.string().trim().min(1).max(4000),
});

export async function POST(request: Request) {
  if (!(await hasValidSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let input: z.infer<typeof replySchema>;
  try {
    input = replySchema.parse(await request.json());
  } catch {
    return NextResponse.json(
      { error: "A conversationId and non-empty reply are required" },
      { status: 400 }
    );
  }

  try {
    const conversation = await prisma.conversation.findFirst({
      where: {
        id: input.conversationId,
        business: { slug: "lumiere-belleza" },
      },
      include: {
        handoffs: {
          where: { status: { in: ["OPEN", "ASSIGNED"] } },
          orderBy: { requestedAt: "desc" },
          take: 1,
        },
      },
    });

    if (!conversation) {
      return NextResponse.json(
        { error: "Conversation not found" },
        { status: 404 }
      );
    }

    const handoff = conversation.handoffs[0];
    if (!handoff) {
      return NextResponse.json(
        { error: "This conversation does not have an open handoff" },
        { status: 409 }
      );
    }

    await sendAdminWebhookAction({
      action: "reply",
      handoffId: handoff.id,
      actionId: randomUUID(),
      text: input.content,
    });

    const message = await prisma.message.create({
      data: {
        conversationId: conversation.id,
        direction: "OUTBOUND",
        sender: "AGENT",
        content: input.content,
        status: "sent",
      },
    });
    await prisma.conversation.update({
      where: { id: conversation.id },
      data: {
        status: "HUMAN_HANDLED",
        lastMessageAt: message.createdAt,
        lastMessageText: message.content,
      },
    });

    return NextResponse.json({
      message: {
        id: message.id,
        content: message.content,
        sender: message.sender,
        createdAt: message.createdAt.toISOString(),
        status: message.status,
      },
    });
  } catch (error) {
    if (error instanceof AdminWebhookConfigurationError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    if (error instanceof AdminWebhookRequestError) {
      console.error("[messages] n8n returned an error", error.status);
      return NextResponse.json(
        { error: "n8n could not send the reply" },
        { status: 502 }
      );
    }
    console.error("[messages] reply failed", error);
    return NextResponse.json(
      { error: "Failed to send reply" },
      { status: 500 }
    );
  }
}
