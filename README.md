# Lumiere Belleza WhatsApp Dashboard

Next.js dashboard for reviewing WhatsApp conversations and handling human handoffs for Lumiere Belleza Store.

## Local setup

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env` and set `DATABASE_URL`, `NEXTAUTH_SECRET`, and `DASHBOARD_PASSWORD`.
3. Configure the n8n variables described below.
4. Run `npm run db:generate` and `npm run db:push`.
5. Start the app with `npm run dev`, then open `http://localhost:3000`.

There is no default dashboard password. The dashboard will reject logins until `DASHBOARD_PASSWORD` and `NEXTAUTH_SECRET` are configured.

## n8n connection

The connected workflow is "Lumière Belleza WhatsApp Support Agent with Human Handoff" (Solar-style handoff flow). It pushes events to this dashboard with the Header Auth credential whose header is `x-webhook-secret`. Configure the following variables in the dashboard hosting environment:

- `N8N_EVENTS_SECRET`: shared with the workflow's `x-webhook-secret` header.
- `N8N_ADMIN_WEBHOOK_URL`: `https://7pq44p57.rpcld.app/webhook/lumiere-dashboard-admin`.
- `N8N_ADMIN_HEADER_NAME`: the header name configured by the workflow's Header Auth credential.
- `N8N_ADMIN_SECRET`: the matching Header Auth value. Keep it in the hosting environment, never in Git.

After deploying the dashboard, set the workflow's `DASHBOARD_EVENTS_URL` to `https://<dashboard-host>/api/integrations/events`. The workflow also needs its `N8N_EVENTS_SECRET` value set to the same value as the dashboard's environment variable.

The inbox refreshes conversations and the selected chat every 3 seconds while open. Click **Enable alerts** once to allow desktop notifications and sound for new customer messages and handoffs.

The incoming event endpoint accepts the workflow fields `type`, `messageId`, `customerPhone`, `customerName`, `content`, `messageType`, `supported`, `isTeam`, `timestamp`, `hasOpenHandoff`, and `handoffId`. It verifies the shared header and deduplicates messages by `messageId`. For a handoff created after the message event, send a second event after the workflow confirms the handoff:

```json
{
  "eventKind": "handoff_opened",
  "type": "handoff",
  "messageId": "handoff:<handoff-id>",
  "customerPhone": "<customer-phone>",
  "customerName": "<customer-name>",
  "content": "",
  "timestamp": "<ISO-8601 timestamp>",
  "handoffId": "<handoff-id>",
  "handoffReason": "<reason>"
}
```

The handoff event updates the dashboard conversation and triggers its alert; it does not duplicate the original customer message.

Handoff ids from the current workflow are prefixed (`hf-12`), so they never collide with handoffs created by the older workflow. `handoffId` may be sent as a string or a number; it is stored as a string.

When a handoff is closed outside the dashboard (the team sends `/close` on WhatsApp, or the workflow's auto-close fires), the workflow sends a `handoff_closed` event so the dashboard stays in sync:

```json
{
  "eventKind": "handoff_closed",
  "type": "handoff",
  "messageId": "handoff-closed:hf-<handoff-id>:<epoch-ms>",
  "customerPhone": "<customer-phone>",
  "customerName": "<customer-name>",
  "content": "",
  "timestamp": "<ISO-8601 timestamp>",
  "handoffId": "hf-<handoff-id>"
}
```

The workflow also sends AI replies (`type: "message.sent.ai"`) and team replies typed on WhatsApp (`type: "message.sent.team"`, `isTeam: true`) so the thread shows the whole conversation. Replies sent from the dashboard are stored by the dashboard itself and are not echoed back.

Dashboard replies and handoff closures are sent server-side as `reply` and `close` actions with `handoffId`, a unique `actionId`, and reply `text` when applicable. The workflow remains responsible for WhatsApp delivery.

## Deployment

Deploy the repository to a Node.js host with PostgreSQL support. Set all required variables from `.env.example` in the hosting provider, run Prisma generation and migrations/schema push as part of deployment, then deploy. Never commit `.env` files or workflow credential values.

`ADMIN_SEED_EMAIL` and `ADMIN_SEED_PASSWORD` are only needed if running the optional Prisma seed script; they are not used for dashboard login.
