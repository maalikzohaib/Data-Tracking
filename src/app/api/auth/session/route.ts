import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET() {
  const cookieStore = cookies();
  const sessionCookie = cookieStore.get("auth_session");

  if (!sessionCookie?.value) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  try {
    const raw = Buffer.from(sessionCookie.value, "base64").toString("utf-8");
    const data = JSON.parse(raw);

    if (!data.expiresAt || Date.now() > data.expiresAt) {
      return NextResponse.json({ authenticated: false, reason: "expired" }, { status: 401 });
    }

    return NextResponse.json({
      authenticated: true,
      user: data.user,
      expiresAt: data.expiresAt,
      remainingMs: data.expiresAt - Date.now(),
    });
  } catch {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }
}
