import { MessageDirection, MessageSender, Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { constantTimeEqual } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const eventSchema = z.object({
  eventKind: z.enum(["message", "handoff_opened", "handoff_closed"]).default("message"),
  type: z.string().min(1),
  messageId: z.string().min(1),
  customerPhone: z.string().min(1),
  customerName: z.string().optional().nullable(),
  content: z.string(),
  messageType: z.string().optional().nullable(),
  supported: z.boolean().optional(),
  isTeam: z.boolean().optional(),
  timestamp: z.string().min(1),
  hasOpenHandoff: z.boolean().optional(),
  // n8n data-table row ids can arrive as numbers; always store them as strings.
  handoffId: z
    .union([z.string(), z.number()])
    .transform((value) => String(value))
    .optional()
    .nullable(),
  handoffReason: z.string().max(300).optional().nullable(),
});

export async function POST(req: NextRequest) {
  const configuredSecret = process.env.N8N_EVENTS_SECRET;
  if (!configuredSecret) {
    return NextResponse.json(
      { error: "N8N_EVENTS_SECRET is not configured" },
      { status: 503 }
    );
  }

  const suppliedSecret = req.headers.get("x-webhook-secret");
  if (!suppliedSecret || !constantTimeEqual(suppliedSecret, configuredSecret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let event: z.infer<typeof eventSchema>;
  try {
    event = eventSchema.parse(await req.json());
  } catch {
    return NextResponse.json(
      { error: "Invalid event payload" },
      { status: 400 }
    );
  }

  const phone = event.customerPhone.replace(/[^\d+]/g, "");
  const whatsappId = phone.replace(/^\+/, "");
  const timestamp = new Date(event.timestamp);
  if (!whatsappId || Number.isNaN(timestamp.getTime())) {
    return NextResponse.json(
      { error: "A valid customerPhone and timestamp are required" },
      { status: 400 }
    );
  }

  try {
    if (event.eventKind === "handoff_opened") {
      const handoffId = event.handoffId;
      if (!handoffId) {
        return NextResponse.json(
          { error: "A handoffId is required for a handoff event" },
          { status: 400 }
        );
      }

      const existingEvent = await prisma.conversationEvent.findUnique({
        where: { id: event.messageId },
        select: { id: true },
      });
      if (existingEvent) {
        return NextResponse.json({ ok: true, duplicate: true });
      }

      await prisma.$transaction(async (transaction) => {
        const business = await transaction.business.upsert({
          where: { slug: "lumiere-belleza" },
          update: {},
          create: {
            name: "Lumiere Belleza",
            slug: "lumiere-belleza",
            description: "Original skincare & cosmetics in Abuja",
          },
        });
        const customer = await transaction.customer.upsert({
          where: {
            businessId_whatsappId: {
              businessId: business.id,
              whatsappId,
            },
          },
          update: {
            phoneNumber: phone,
            ...(event.customerName ? { name: event.customerName } : {}),
            lastSeenAt: timestamp,
          },
          create: {
            businessId: business.id,
            whatsappId,
            phoneNumber: phone,
            name: event.customerName || null,
            lastSeenAt: timestamp,
          },
        });
        let conversation = await transaction.conversation.findFirst({
          where: {
            businessId: business.id,
            customerId: customer.id,
            status: { not: "CLOSED" },
          },
          orderBy: { lastMessageAt: "desc" },
        });
        if (!conversation) {
          conversation = await transaction.conversation.create({
            data: {
              businessId: business.id,
              customerId: customer.id,
              status: "AWAITING_HUMAN",
              isUnread: true,
              lastMessageAt: timestamp,
              lastMessageText: "Customer requested a team member",
            },
          });
        }

        const existingHandoff = await transaction.handoff.findUnique({
          where: { id: handoffId },
        });
        if (existingHandoff && existingHandoff.conversationId !== conversation.id) {
          throw new Error("Handoff is associated with a different conversation");
        }
        if (existingHandoff) {
          await transaction.handoff.update({
            where: { id: existingHandoff.id },
            data: {
              status: "OPEN",
              reason: event.handoffReason || existingHandoff.reason,
              requestedAt: timestamp,
              resolvedAt: null,
              closedAt: null,
            },
          });
        } else {
          await transaction.handoff.create({
            data: {
              id: handoffId,
              conversationId: conversation.id,
              status: "OPEN",
              reason: event.handoffReason || null,
              requestedAt: timestamp,
            },
          });
        }
        await transaction.conversation.update({
          where: { id: conversation.id },
          data: {
            status: "AWAITING_HUMAN",
            isUnread: true,
            lastMessageAt: timestamp,
          },
        });
        await transaction.conversationEvent.create({
          data: {
            id: event.messageId,
            conversationId: conversation.id,
            type: "HANDOFF_OPENED",
            payload: {
              handoffId,
              reason: event.handoffReason || null,
            },
            createdAt: timestamp,
          },
        });
      });

      return NextResponse.json({ ok: true });
    }

    if (event.eventKind === "handoff_closed") {
      // Sent by n8n when a handoff is closed outside the dashboard (team /close on WhatsApp, or the auto-close).
      const handoffId = event.handoffId;
      if (!handoffId) {
        return NextResponse.json(
          { error: "A handoffId is required for a handoff event" },
          { status: 400 }
        );
      }

      const existingEvent = await prisma.conversationEvent.findUnique({
        where: { id: event.messageId },
        select: { id: true },
      });
      if (existingEvent) {
        return NextResponse.json({ ok: true, duplicate: true });
      }

      const handoff = await prisma.handoff.findUnique({
        where: { id: handoffId },
      });
      if (!handoff) {
        return NextResponse.json({ ok: true, ignored: true });
      }

      await prisma.$transaction(async (transaction) => {
        if (handoff.status !== "CLOSED") {
          await transaction.handoff.update({
            where: { id: handoff.id },
            data: { status: "CLOSED", closedAt: timestamp, resolvedAt: timestamp },
          });
        }
        const stillOpen = await transaction.handoff.count({
          where: {
            conversationId: handoff.conversationId,
            id: { not: handoff.id },
            status: { in: ["OPEN", "ASSIGNED"] },
          },
        });
        if (stillOpen === 0) {
          await transaction.conversation.update({
            where: { id: handoff.conversationId },
            data: { status: "CLOSED" },
          });
        }
        await transaction.conversationEvent.create({
          data: {
            id: event.messageId,
            conversationId: handoff.conversationId,
            type: "HANDOFF_CLOSED",
            payload: { handoffId },
            createdAt: timestamp,
          },
        });
      });

      return NextResponse.json({ ok: true });
    }

    const existing = await prisma.message.findUnique({
      where: { externalId: event.messageId },
      select: { id: true },
    });
    if (existing) {
      return NextResponse.json({ ok: true, duplicate: true });
    }

    await prisma.$transaction(async (transaction) => {
      const business = await transaction.business.upsert({
        where: { slug: "lumiere-belleza" },
        update: {},
        create: {
          name: "Lumiere Belleza",
          slug: "lumiere-belleza",
          description: "Original skincare & cosmetics in Abuja",
        },
      });

      const customer = await transaction.customer.upsert({
        where: {
          businessId_whatsappId: {
            businessId: business.id,
            whatsappId,
          },
        },
        update: {
          phoneNumber: phone,
          ...(event.customerName ? { name: event.customerName } : {}),
          lastSeenAt: timestamp,
        },
        create: {
          businessId: business.id,
          whatsappId,
          phoneNumber: phone,
          name: event.customerName || null,
          lastSeenAt: timestamp,
        },
      });

      let conversation = await transaction.conversation.findFirst({
        where: {
          businessId: business.id,
          customerId: customer.id,
          status: { not: "CLOSED" },
        },
        orderBy: { lastMessageAt: "desc" },
      });

      if (!conversation) {
        conversation = await transaction.conversation.create({
          data: {
            businessId: business.id,
            customerId: customer.id,
            status: "OPEN",
            lastMessageAt: timestamp,
          },
        });
      }

      const messageIsOutbound = /sent|outbound|ai|bot/i.test(event.type);
      const sender = event.isTeam
        ? MessageSender.AGENT
        : messageIsOutbound
          ? MessageSender.AI
          : MessageSender.CUSTOMER;
      const nextStatus = event.hasOpenHandoff
        ? "AWAITING_HUMAN"
        : sender === MessageSender.AGENT
          ? "HUMAN_HANDLED"
          : sender === MessageSender.CUSTOMER
            ? "OPEN"
            : "AI_HANDLED";

      await transaction.message.create({
        data: {
          conversationId: conversation.id,
          externalId: event.messageId,
          direction:
            sender === MessageSender.CUSTOMER
              ? MessageDirection.INBOUND
              : MessageDirection.OUTBOUND,
          sender,
          content:
            event.content ||
            (event.messageType ? `[${event.messageType}]` : "[media message]"),
          mediaType: event.messageType || null,
          createdAt: timestamp,
        },
      });

      await transaction.conversation.update({
        where: { id: conversation.id },
        data: {
          status: nextStatus,
          isUnread: true,
          lastMessageAt: timestamp,
          lastMessageText:
            event.content ||
            (event.messageType ? `[${event.messageType}]` : "[media message]"),
        },
      });

      if (event.hasOpenHandoff) {
        const existingHandoff = event.handoffId
          ? await transaction.handoff.findUnique({
              where: { id: event.handoffId },
            })
          : await transaction.handoff.findFirst({
              where: {
                conversationId: conversation.id,
                status: { in: ["OPEN", "ASSIGNED"] },
              },
              orderBy: { requestedAt: "desc" },
            });

        if (
          existingHandoff &&
          existingHandoff.conversationId !== conversation.id
        ) {
          throw new Error("Handoff is associated with a different conversation");
        }

        if (existingHandoff) {
          await transaction.handoff.update({
            where: { id: existingHandoff.id },
            data: { status: "OPEN" },
          });
        } else {
          await transaction.handoff.create({
            data: {
              ...(event.handoffId ? { id: event.handoffId } : {}),
              conversationId: conversation.id,
              status: "OPEN",
              requestedAt: timestamp,
            },
          });
        }
      }
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      if (event.eventKind === "handoff_opened" || event.eventKind === "handoff_closed") {
        const duplicate = await prisma.conversationEvent.findUnique({
          where: { id: event.messageId },
          select: { id: true },
        });
        if (duplicate) {
          return NextResponse.json({ ok: true, duplicate: true });
        }
      }
      const duplicate = await prisma.message.findUnique({
        where: { externalId: event.messageId },
        select: { id: true },
      });
      if (duplicate) {
        return NextResponse.json({ ok: true, duplicate: true });
      }
    }

    console.error("[events] ingestion failed", error);
    return NextResponse.json(
      { error: "Failed to save event" },
      { status: 500 }
    );
  }
}
