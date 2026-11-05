import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

export const SESSION_COOKIE = "lb_session";
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function sign(value: string, secret: string): string {
  return createHmac("sha256", secret).update(value).digest("base64url");
}

export function constantTimeEqual(left: string, right: string): boolean {
  return timingSafeEqual(
    createHash("sha256").update(left).digest(),
    createHash("sha256").update(right).digest()
  );
}

export function createSessionToken(secret: string): string {
  const expiresAt = String(Date.now() + SESSION_TTL_MS);
  return `${expiresAt}.${sign(expiresAt, secret)}`;
}

export function isValidSessionToken(
  token: string | undefined,
  secret: string | undefined
): boolean {
  if (!token || !secret) return false;

  const [expiresAt, signature, extra] = token.split(".");
  if (!expiresAt || !signature || extra || !/^\d+$/.test(expiresAt)) {
    return false;
  }
  if (Number(expiresAt) <= Date.now()) return false;

  return constantTimeEqual(signature, sign(expiresAt, secret));
}

export async function hasValidSession(): Promise<boolean> {
  const cookieStore = await cookies();
  return isValidSessionToken(
    cookieStore.get(SESSION_COOKIE)?.value,
    process.env.NEXTAUTH_SECRET
  );
}
