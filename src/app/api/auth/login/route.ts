import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

const MASTER_PIN = process.env.MASTER_PIN || "202417";
const AUTH_COOKIE_NAME = "seam_auth";
// Cookie lasts 30 days
const COOKIE_MAX_AGE = 30 * 24 * 60 * 60;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { pin } = body;

    if (!pin) {
      return NextResponse.json({ error: "PIN is required" }, { status: 400 });
    }

    if (pin !== MASTER_PIN) {
      return NextResponse.json({ error: "Invalid PIN" }, { status: 401 });
    }

    // Create a simple auth token (in production, use a more secure method)
    const authToken = Buffer.from(`authenticated:${Date.now()}`).toString("base64");

    const cookieStore = await cookies();
    cookieStore.set(AUTH_COOKIE_NAME, authToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: COOKIE_MAX_AGE,
      path: "/",
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
