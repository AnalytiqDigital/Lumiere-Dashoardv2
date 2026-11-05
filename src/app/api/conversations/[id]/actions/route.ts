import { randomUUID } from "node:crypto";
import { HandoffStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { hasValidSession } from "@/lib/auth";
import {
  AdminWebhookConfigurationError,
  AdminWebhookRequestError,
  sendAdminWebhookAction,
} from "@/lib/n8n-admin";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };
const actionSchema = z.object({
  action: z.enum(["takeover", "close"]),
});

export async function POST(request: Request, { params }: RouteContext) {
  if (!(await hasValidSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let action: z.infer<typeof actionSchema>;
  try {
    action = actionSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  try {
    const { id } = await params;
    const conversation = await prisma.conversation.findFirst({
      where: { id, business: { slug: "lumiere-belleza" } },
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
    if (action.action === "close") {
      if (!handoff) {
        return NextResponse.json(
          { error: "No open handoff exists for this conversation" },
          { status: 409 }
        );
      }

      await sendAdminWebhookAction({
        action: "close",
        handoffId: handoff.id,
        actionId: randomUUID(),
      });

      await prisma.$transaction([
        prisma.handoff.update({
          where: { id: handoff.id },
          data: {
            status: HandoffStatus.CLOSED,
            closedAt: new Date(),
            resolvedAt: new Date(),
          },
        }),
        prisma.conversation.update({
          where: { id },
          data: { status: "CLOSED" },
        }),
      ]);
    } else {
      await prisma.$transaction([
        ...(handoff
          ? [
              prisma.handoff.update({
                where: { id: handoff.id },
                data: { status: HandoffStatus.ASSIGNED },
              }),
            ]
          : []),
        prisma.conversation.update({
          where: { id },
          data: { status: "HUMAN_HANDLED" },
        }),
      ]);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof AdminWebhookConfigurationError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    if (error instanceof AdminWebhookRequestError) {
      console.error("[conversation-action] n8n returned an error", error.status);
      return NextResponse.json(
        { error: "n8n could not process the action" },
        { status: 502 }
      );
    }
    console.error("[conversation-action] failed", error);
    return NextResponse.json(
      { error: "Failed to update conversation" },
      { status: 500 }
    );
  }
}
