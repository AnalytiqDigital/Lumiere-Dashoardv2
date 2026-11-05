export class AdminWebhookConfigurationError extends Error {}

export class AdminWebhookRequestError extends Error {
  constructor(readonly status: number) {
    super(`n8n admin webhook returned HTTP ${status}`);
  }
}

export async function sendAdminWebhookAction(payload: {
  action: "reply" | "close";
  handoffId: string;
  actionId: string;
  text?: string;
}): Promise<void> {
  const url = process.env.N8N_ADMIN_WEBHOOK_URL;
  const headerName = process.env.N8N_ADMIN_HEADER_NAME;
  const secret = process.env.N8N_ADMIN_SECRET;

  if (!url || !headerName || !secret) {
    throw new AdminWebhookConfigurationError(
      "N8N_ADMIN_WEBHOOK_URL, N8N_ADMIN_HEADER_NAME, and N8N_ADMIN_SECRET must be configured"
    );
  }

  const headers = new Headers({ "Content-Type": "application/json" });
  headers.set(headerName, secret);
  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new AdminWebhookRequestError(response.status);
  }
}
