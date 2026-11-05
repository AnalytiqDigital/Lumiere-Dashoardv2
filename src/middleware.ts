import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const session = request.cookies.get("lb_session");
  const { pathname } = request.nextUrl;

  // API handlers verify the signed session themselves.
  if (pathname === "/login" || pathname.startsWith("/api/auth") || pathname.startsWith("/api/integrations")) {
    return NextResponse.next();
  }

  // Protect dashboard routes
  if (!session && (pathname.startsWith("/inbox") || pathname.startsWith("/overview") || pathname.startsWith("/analytics") || pathname.startsWith("/settings"))) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Redirect root authenticated users
  if (session && pathname === "/login") {
    return NextResponse.redirect(new URL("/inbox", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
