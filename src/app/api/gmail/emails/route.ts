import { NextRequest, NextResponse } from "next/server";
import { getGmailTokens } from "@/lib/auth-cookies";
import { listEmails, refreshAccessToken } from "@/lib/gmail";

export async function GET(request: NextRequest) {
  try {
    const tokens = await getGmailTokens();

    if (!tokens) {
      return NextResponse.json(
        { error: "Not connected to Gmail" },
        { status: 401 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const maxResults = parseInt(searchParams.get("maxResults") || "20");
    const query = searchParams.get("query") || undefined;
    const labelIds = searchParams.get("labelIds")?.split(",") || ["INBOX"];

    let accessToken = tokens.access_token;

    // Check if token is expired and refresh if needed
    if (tokens.expiry_date && Date.now() >= tokens.expiry_date) {
      try {
        const newCredentials = await refreshAccessToken(tokens.refresh_token);
        accessToken = newCredentials.access_token!;
      } catch (refreshError) {
        console.error("Error refreshing token:", refreshError);
        return NextResponse.json(
          { error: "Session expired. Please reconnect Gmail." },
          { status: 401 }
        );
      }
    }

    const emails = await listEmails(accessToken, tokens.refresh_token, {
      maxResults,
      query,
      labelIds,
    });

    // Transform emails to match the frontend format
    const formattedEmails = emails.map((email) => ({
      id: email.id,
      threadId: email.threadId,
      from: email.from,
      fromEmail: email.fromEmail,
      subject: email.subject,
      preview: email.snippet,
      body: email.body,
      date: formatEmailDate(email.date),
      rawDate: email.date.toISOString(),
      isRead: email.isRead,
      isStarred: email.labels.includes("STARRED"),
      hasAttachment: email.hasAttachment,
    }));

    return NextResponse.json({ emails: formattedEmails });
  } catch (error) {
    console.error("Error fetching emails:", error);
    return NextResponse.json(
      { error: "Failed to fetch emails" },
      { status: 500 }
    );
  }
}

function formatEmailDate(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const oneDay = 24 * 60 * 60 * 1000;

  if (diff < oneDay && date.getDate() === now.getDate()) {
    // Today - show time
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  } else if (diff < 2 * oneDay) {
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.getDate() === yesterday.getDate()) {
      return "Yesterday";
    }
  }
  // Show date
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}
