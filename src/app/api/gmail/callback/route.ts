import { NextRequest, NextResponse } from "next/server";
import { getTokensFromCode, getUserProfile } from "@/lib/gmail";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  if (error) {
    return NextResponse.redirect(
      new URL(`/settings?error=${encodeURIComponent(error)}`, request.url)
    );
  }

  if (!code) {
    return NextResponse.redirect(
      new URL("/settings?error=No authorization code provided", request.url)
    );
  }

  try {
    const tokens = await getTokensFromCode(code);

    // Get user profile
    const profile = await getUserProfile(tokens.access_token!, tokens.refresh_token!);

    // In a real app, you would store these tokens securely in your database
    // For now, we'll redirect with success and you can store them client-side
    // or implement proper session management

    const params = new URLSearchParams({
      success: "true",
      email: profile.email || "",
      name: profile.name || "",
    });

    // Note: In production, store tokens in database and use secure session management
    // The tokens should be encrypted and stored server-side

    return NextResponse.redirect(
      new URL(`/settings?${params.toString()}`, request.url)
    );
  } catch (error) {
    console.error("Error exchanging code for tokens:", error);
    return NextResponse.redirect(
      new URL("/settings?error=Failed to authenticate with Gmail", request.url)
    );
  }
}
