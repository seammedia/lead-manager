import { NextResponse } from "next/server";
import { getGmailTokens, getGmailEmail } from "@/lib/auth-cookies";

export async function GET() {
  try {
    const tokens = await getGmailTokens();
    const email = await getGmailEmail();

    if (!tokens || !email) {
      return NextResponse.json({
        connected: false,
        email: null,
      });
    }

    return NextResponse.json({
      connected: true,
      email,
    });
  } catch (error) {
    console.error("Error checking Gmail status:", error);
    return NextResponse.json({
      connected: false,
      email: null,
      error: "Failed to check status",
    });
  }
}
