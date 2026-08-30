import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;

  // Allow static files, api auth endpoints, and internal assets
  if (
    path.startsWith("/_next") ||
    path.startsWith("/api/auth/login") ||
    path === "/favicon.ico"
  ) {
    return NextResponse.next();
  }

  const sessionCookie = req.cookies.get("auth_session");
  let isAuthenticated = false;

  if (sessionCookie?.value) {
    try {
      const raw = Buffer.from(sessionCookie.value, "base64").toString("utf-8");
      const data = JSON.parse(raw);
      if (data.expiresAt && Date.now() < data.expiresAt) {
        isAuthenticated = true;
      }
    } catch {
      isAuthenticated = false;
    }
  }

  // If user is trying to access /login while already authenticated, redirect to /orders
  if (path === "/login") {
    if (isAuthenticated) {
      return NextResponse.redirect(new URL("/orders", req.url));
    }
    return NextResponse.next();
  }

  // If user is not authenticated, redirect to /login
  if (!isAuthenticated) {
    const loginUrl = new URL("/login", req.url);
    if (path !== "/") {
      loginUrl.searchParams.set("from", path);
    }
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
