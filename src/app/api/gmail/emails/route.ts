import { NextRequest, NextResponse } from "next/server";
import { getGmailTokens, setGmailTokens, getGmailEmail } from "@/lib/auth-cookies";
import { listEmails, refreshAccessToken } from "@/lib/gmail";

export async function GET(request: NextRequest) {
  try {
    const tokens = await getGmailTokens();

    if (!tokens) {
      console.log("[Gmail API] No tokens found in cookies");
      return NextResponse.json(
        { error: "Not connected to Gmail" },
        { status: 401 }
      );
    }

    console.log("[Gmail API] Tokens found, expiry_date:", tokens.expiry_date, "current time:", Date.now());

    const searchParams = request.nextUrl.searchParams;
    const maxResults = parseInt(searchParams.get("maxResults") || "20");
    const query = searchParams.get("query") || undefined;
    // Don't use labelIds when searching with a query (it searches all mail)
    const labelIds = query ? undefined : (searchParams.get("labelIds")?.split(",") || ["INBOX"]);

    let accessToken = tokens.access_token;

    // Check if token is expired and refresh if needed
    if (tokens.expiry_date && Date.now() >= tokens.expiry_date) {
      console.log("[Gmail API] Token expired, attempting refresh...");
      try {
        const newCredentials = await refreshAccessToken(tokens.refresh_token);
        accessToken = newCredentials.access_token!;
        console.log("[Gmail API] Token refreshed successfully");

        // Save the new tokens to cookies
        const email = await getGmailEmail();
        if (email) {
          await setGmailTokens({
            access_token: newCredentials.access_token!,
            refresh_token: newCredentials.refresh_token || tokens.refresh_token,
            expiry_date: newCredentials.expiry_date || undefined,
          }, email);
        }
      } catch (refreshError) {
        console.error("[Gmail API] Error refreshing token:", refreshError);
        return NextResponse.json(
          { error: "Session expired. Please reconnect Gmail." },
          { status: 401 }
        );
      }
    }

    console.log("[Gmail API] Fetching emails with labelIds:", labelIds, "maxResults:", maxResults);

    let emails;
    try {
      emails = await listEmails(accessToken, tokens.refresh_token, {
        maxResults,
        query,
        labelIds,
      });
    } catch (listError) {
      // If listing failed, try refreshing the token and retry
      console.log("[Gmail API] Initial fetch failed, attempting token refresh...", listError);

      try {
        const newCredentials = await refreshAccessToken(tokens.refresh_token);
        accessToken = newCredentials.access_token!;
        console.log("[Gmail API] Token refreshed after error, retrying fetch...");

        // Save the new tokens to cookies
        const email = await getGmailEmail();
        if (email) {
          await setGmailTokens({
            access_token: newCredentials.access_token!,
            refresh_token: newCredentials.refresh_token || tokens.refresh_token,
            expiry_date: newCredentials.expiry_date || undefined,
          }, email);
        }

        emails = await listEmails(accessToken, tokens.refresh_token, {
          maxResults,
          query,
          labelIds,
        });
      } catch (retryError) {
        console.error("[Gmail API] Retry after token refresh also failed:", retryError);
        throw retryError;
      }
    }

    console.log("[Gmail API] Fetched", emails.length, "emails");

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
    console.error("[Gmail API] Error fetching emails:", error);

    // Check for specific error types
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    // Check if it's an auth error
    if (errorMessage.includes("invalid_grant") || errorMessage.includes("Token has been expired or revoked")) {
      return NextResponse.json(
        { error: "Gmail authorization has expired. Please reconnect Gmail." },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { error: `Failed to fetch emails: ${errorMessage}` },
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
