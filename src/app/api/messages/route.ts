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

class WhatsAppConfigurationError extends Error {}

class WhatsAppRequestError extends Error {
  constructor(
    message: string,
    readonly hint?: string
  ) {
    super(message);
  }
}

async function sendWhatsAppText(
  phoneNumberId: string,
  token: string,
  to: string,
  text: string
): Promise<void> {
  const response = await fetch(
    `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: { body: text.slice(0, 4000) },
      }),
      cache: "no-store",
    }
  );
  const body = (await response.json().catch(() => ({}))) as {
    error?: { message?: string };
  };
  if (!response.ok) {
    throw new WhatsAppRequestError(
      body.error?.message || "WhatsApp rejected the message",
      "Free-text replies only work within 24h of the customer last messaging you."
    );
  }
}

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
        business: true,
        customer: true,
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
    const customerPhone = conversation.customer.phoneNumber.replace(/\D/g, "");

    if (handoff) {
      await sendAdminWebhookAction({
        action: "reply",
        handoffId: handoff.id,
        actionId: randomUUID(),
        text: input.content,
        customerPhone,
      });
    } else {
      if (!/^\d{8,15}$/.test(customerPhone)) {
        return NextResponse.json(
          { error: "This customer has no valid WhatsApp number" },
          { status: 400 }
        );
      }
      const token = process.env.WHATSAPP_TOKEN;
      const phoneNumberId =
        process.env.WHATSAPP_PHONE_NUMBER_ID ||
        conversation.business.whatsappPhoneNumberId ||
        "";
      if (!token || !phoneNumberId) {
        throw new WhatsAppConfigurationError(
          "Replies without an open handoff require WHATSAPP_TOKEN and WHATSAPP_PHONE_NUMBER_ID to be configured"
        );
      }
      await sendWhatsAppText(
        phoneNumberId,
        token,
        customerPhone,
        input.content
      );
    }

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
    if (error instanceof WhatsAppConfigurationError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    if (error instanceof WhatsAppRequestError) {
      return NextResponse.json(
        { error: error.message, hint: error.hint },
        { status: 502 }
      );
    }
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
