import { NextResponse } from "next/server";
import { clearGmailTokens } from "@/lib/auth-cookies";

export async function POST() {
  try {
    await clearGmailTokens();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error disconnecting Gmail:", error);
    return NextResponse.json(
      { error: "Failed to disconnect" },
      { status: 500 }
    );
  }
}
