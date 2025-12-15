import { NextRequest, NextResponse } from "next/server";
import { getTokensFromCode, getUserProfile } from "@/lib/gmail";
import { setGmailTokens } from "@/lib/auth-cookies";

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

    if (!tokens.access_token || !tokens.refresh_token) {
      return NextResponse.redirect(
        new URL("/settings?error=Failed to get tokens", request.url)
      );
    }

    // Get user profile
    const profile = await getUserProfile(tokens.access_token, tokens.refresh_token);

    // Store tokens in secure HTTP-only cookies
    await setGmailTokens(
      {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expiry_date: tokens.expiry_date || undefined,
      },
      profile.email || ""
    );

    const params = new URLSearchParams({
      success: "true",
      email: profile.email || "",
    });

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
