import { NextResponse } from "next/server";

const AUTH_USERNAME = process.env.AUTH_USERNAME || "admin";
const AUTH_PASSWORD = process.env.AUTH_PASSWORD || "admin123";

export async function POST(req: Request) {
  try {
    const { username, password } = await req.json();

    if (username === AUTH_USERNAME && password === AUTH_PASSWORD) {
      const sessionData = {
        user: username,
        expiresAt: Date.now() + 8 * 60 * 60 * 1000, // 8 hours from now
      };
      const cookieValue = Buffer.from(JSON.stringify(sessionData)).toString("base64");

      const response = NextResponse.json({ ok: true, expiresAt: sessionData.expiresAt });

      // Set cookie for 8 hours (28800 seconds)
      response.cookies.set({
        name: "auth_session",
        value: cookieValue,
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 8 * 60 * 60,
      });

      return response;
    }

    return NextResponse.json(
      { error: "Incorrect username or password" },
      { status: 401 }
    );
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
