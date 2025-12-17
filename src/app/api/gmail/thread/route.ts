import { NextRequest, NextResponse } from "next/server";
import { getGmailTokens, setGmailTokens, getGmailEmail } from "@/lib/auth-cookies";
import { getGmailClient, refreshAccessToken } from "@/lib/gmail";

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
    const threadId = searchParams.get("threadId");

    if (!threadId) {
      return NextResponse.json(
        { error: "threadId is required" },
        { status: 400 }
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
        console.error("[Gmail Thread] Error refreshing token:", refreshError);
        return NextResponse.json(
          { error: "Session expired. Please reconnect Gmail." },
          { status: 401 }
        );
      }
    }

    const gmail = getGmailClient(accessToken, tokens.refresh_token);
    const connectedEmail = await getGmailEmail();

    // Get the thread
    const thread = await gmail.users.threads.get({
      userId: "me",
      id: threadId,
      format: "full",
    });

    const messages = thread.data.messages || [];

    // Format messages
    const formattedMessages = messages.map((message) => {
      const headers = message.payload?.headers || [];
      const fromHeader = headers.find((h) => h.name === "From")?.value || "";
      const dateHeader = headers.find((h) => h.name === "Date")?.value || "";

      // Parse from field
      const fromMatch = fromHeader.match(/^(.+?)\s*<(.+?)>$/);
      const fromName = fromMatch ? fromMatch[1].replace(/"/g, "") : fromHeader;
      const fromEmail = fromMatch ? fromMatch[2] : fromHeader;

      // Get body - try multiple extraction methods
      let body = extractEmailBody(message.payload);

      // Clean up the body - remove quoted text from previous messages
      const cleanBody = cleanEmailBody(body);

      // Check if this message is from the connected user
      const isFromMe = connectedEmail ? fromEmail.toLowerCase().includes(connectedEmail.toLowerCase()) : false;

      return {
        id: message.id,
        from: fromName,
        fromEmail,
        date: formatEmailDate(new Date(dateHeader)),
        body: cleanBody,
        isFromMe,
      };
    });

    return NextResponse.json({ messages: formattedMessages });
  } catch (error) {
    console.error("[Gmail Thread] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch thread" },
      { status: 500 }
    );
  }
}

// Recursively extract body from email parts
function extractEmailBody(payload: any): string {
  if (!payload) return "";

  // Direct body data
  if (payload.body?.data) {
    return Buffer.from(payload.body.data, "base64").toString("utf-8");
  }

  // Check parts
  if (payload.parts && payload.parts.length > 0) {
    // First try to find text/plain
    for (const part of payload.parts) {
      if (part.mimeType === "text/plain" && part.body?.data) {
        return Buffer.from(part.body.data, "base64").toString("utf-8");
      }
    }

    // Then try text/html and strip tags
    for (const part of payload.parts) {
      if (part.mimeType === "text/html" && part.body?.data) {
        const html = Buffer.from(part.body.data, "base64").toString("utf-8");
        return stripHtml(html);
      }
    }

    // Try nested parts (multipart/alternative, etc.)
    for (const part of payload.parts) {
      if (part.parts) {
        const nestedBody = extractEmailBody(part);
        if (nestedBody) return nestedBody;
      }
    }

    // Last resort - try any part with body data
    for (const part of payload.parts) {
      if (part.body?.data) {
        return Buffer.from(part.body.data, "base64").toString("utf-8");
      }
    }
  }

  return "";
}

// Strip HTML tags and decode entities
function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function cleanEmailBody(body: string): string {
  if (!body) return "";

  let cleaned = body.trim();

  // Remove quoted lines (starting with >)
  const lines = cleaned.split("\n");
  const cleanedLines: string[] = [];
  let inQuotedBlock = false;

  for (const line of lines) {
    // Check if this line starts a quoted section
    if (line.match(/^On .+? wrote:$/)) {
      inQuotedBlock = true;
      continue;
    }

    // Skip quoted lines
    if (line.trim().startsWith(">") || line.trim().startsWith(">>")) {
      continue;
    }

    // Skip if we're in a quoted block
    if (inQuotedBlock) {
      continue;
    }

    cleanedLines.push(line);
  }

  cleaned = cleanedLines.join("\n").trim();

  // Remove trailing "---------- Original Message ----------" sections
  const originalMsgMatch = cleaned.match(/\n\n-{3,}\s*Original Message\s*-{3,}/i);
  if (originalMsgMatch && originalMsgMatch.index) {
    cleaned = cleaned.substring(0, originalMsgMatch.index).trim();
  }

  return cleaned;
}

function formatEmailDate(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const oneDay = 24 * 60 * 60 * 1000;

  if (diff < oneDay && date.getDate() === now.getDate()) {
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  }

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}
