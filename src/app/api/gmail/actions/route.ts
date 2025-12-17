import { NextRequest, NextResponse } from "next/server";
import { getGmailTokens, setGmailTokens, getGmailEmail } from "@/lib/auth-cookies";
import {
  archiveEmail,
  trashEmail,
  starEmail,
  markAsRead,
  markAsUnread,
  refreshAccessToken
} from "@/lib/gmail";

export async function POST(request: NextRequest) {
  try {
    const tokens = await getGmailTokens();

    if (!tokens) {
      return NextResponse.json(
        { error: "Not connected to Gmail" },
        { status: 401 }
      );
    }

    let accessToken = tokens.access_token;

    // Check if token is expired and refresh if needed
    if (tokens.expiry_date && Date.now() >= tokens.expiry_date) {
      try {
        const newCredentials = await refreshAccessToken(tokens.refresh_token);
        accessToken = newCredentials.access_token!;

        const email = await getGmailEmail();
        if (email) {
          await setGmailTokens({
            access_token: newCredentials.access_token!,
            refresh_token: newCredentials.refresh_token || tokens.refresh_token,
            expiry_date: newCredentials.expiry_date || undefined,
          }, email);
        }
      } catch (refreshError) {
        console.error("Error refreshing token:", refreshError);
        return NextResponse.json(
          { error: "Session expired. Please reconnect Gmail." },
          { status: 401 }
        );
      }
    }

    const body = await request.json();
    const { action, emailId, starred } = body;

    if (!action || !emailId) {
      return NextResponse.json(
        { error: "Missing required fields: action, emailId" },
        { status: 400 }
      );
    }

    switch (action) {
      case "archive":
        await archiveEmail(accessToken, tokens.refresh_token, emailId);
        break;
      case "trash":
        await trashEmail(accessToken, tokens.refresh_token, emailId);
        break;
      case "star":
        await starEmail(accessToken, tokens.refresh_token, emailId, starred ?? true);
        break;
      case "markAsRead":
        await markAsRead(accessToken, tokens.refresh_token, emailId);
        break;
      case "markAsUnread":
        await markAsUnread(accessToken, tokens.refresh_token, emailId);
        break;
      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error performing email action:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to perform action: ${errorMessage}` },
      { status: 500 }
    );
  }
}
