import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { constantTimeEqual, createSessionToken, SESSION_COOKIE } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const expected = process.env.DASHBOARD_PASSWORD;
    const sessionSecret = process.env.NEXTAUTH_SECRET;

    if (!expected || !sessionSecret) {
      return NextResponse.json(
        { error: "Dashboard authentication is not configured" },
        { status: 503 }
      );
    }
    if (typeof body.password !== "string") {
      return NextResponse.json({ error: "Password is required" }, { status: 400 });
    }

    if (constantTimeEqual(body.password, expected)) {
      const cookieStore = await cookies();
      cookieStore.set(SESSION_COOKIE, createSessionToken(sessionSecret), {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 7, // 7 days
        path: "/",
      });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Invalid password" }, { status: 401 });
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
}
