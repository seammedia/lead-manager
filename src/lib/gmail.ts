import { google } from "googleapis";

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

export function getAuthUrl() {
  const scopes = [
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/gmail.send",
    "https://www.googleapis.com/auth/gmail.compose",
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/userinfo.profile",
  ];

  return oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: scopes,
    prompt: "consent",
  });
}

export async function getTokensFromCode(code: string) {
  const { tokens } = await oauth2Client.getToken(code);
  return tokens;
}

export function setCredentials(tokens: { access_token?: string; refresh_token?: string }) {
  oauth2Client.setCredentials(tokens);
  return oauth2Client;
}

export async function refreshAccessToken(refreshToken: string) {
  oauth2Client.setCredentials({ refresh_token: refreshToken });
  const { credentials } = await oauth2Client.refreshAccessToken();
  return credentials;
}

export function getGmailClient(accessToken: string, refreshToken?: string) {
  oauth2Client.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken,
  });
  return google.gmail({ version: "v1", auth: oauth2Client });
}

export interface Email {
  id: string;
  threadId: string;
  from: string;
  fromEmail: string;
  to: string;
  subject: string;
  snippet: string;
  body: string;
  date: Date;
  isRead: boolean;
  hasAttachment: boolean;
  labels: string[];
}

export async function listEmails(
  accessToken: string,
  refreshToken?: string,
  options: { maxResults?: number; labelIds?: string[]; query?: string } = {}
): Promise<Email[]> {
  const gmail = getGmailClient(accessToken, refreshToken);

  const response = await gmail.users.messages.list({
    userId: "me",
    maxResults: options.maxResults || 20,
    labelIds: options.labelIds || ["INBOX"],
    q: options.query,
  });

  const messages = response.data.messages || [];
  const emails: Email[] = [];

  for (const message of messages) {
    const fullMessage = await gmail.users.messages.get({
      userId: "me",
      id: message.id!,
      format: "full",
    });

    const headers = fullMessage.data.payload?.headers || [];
    const fromHeader = headers.find((h) => h.name === "From")?.value || "";
    const toHeader = headers.find((h) => h.name === "To")?.value || "";
    const subjectHeader = headers.find((h) => h.name === "Subject")?.value || "";
    const dateHeader = headers.find((h) => h.name === "Date")?.value || "";

    // Parse from field
    const fromMatch = fromHeader.match(/^(.+?)\s*<(.+?)>$/);
    const fromName = fromMatch ? fromMatch[1].replace(/"/g, "") : fromHeader;
    const fromEmail = fromMatch ? fromMatch[2] : fromHeader;

    // Get body
    let body = "";
    if (fullMessage.data.payload?.body?.data) {
      body = Buffer.from(fullMessage.data.payload.body.data, "base64").toString("utf-8");
    } else if (fullMessage.data.payload?.parts) {
      const textPart = fullMessage.data.payload.parts.find(
        (part) => part.mimeType === "text/plain"
      );
      if (textPart?.body?.data) {
        body = Buffer.from(textPart.body.data, "base64").toString("utf-8");
      }
    }

    // Check for attachments
    const hasAttachment =
      fullMessage.data.payload?.parts?.some(
        (part) => part.filename && part.filename.length > 0
      ) || false;

    emails.push({
      id: message.id!,
      threadId: message.threadId!,
      from: fromName,
      fromEmail,
      to: toHeader,
      subject: subjectHeader,
      snippet: fullMessage.data.snippet || "",
      body,
      date: new Date(dateHeader),
      isRead: !fullMessage.data.labelIds?.includes("UNREAD"),
      hasAttachment,
      labels: fullMessage.data.labelIds || [],
    });
  }

  return emails;
}

export async function sendEmail(
  accessToken: string,
  refreshToken: string | undefined,
  to: string,
  subject: string,
  body: string
): Promise<string> {
  const gmail = getGmailClient(accessToken, refreshToken);

  const message = [
    `To: ${to}`,
    `Subject: ${subject}`,
    "Content-Type: text/html; charset=utf-8",
    "",
    body,
  ].join("\n");

  const encodedMessage = Buffer.from(message)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  const response = await gmail.users.messages.send({
    userId: "me",
    requestBody: {
      raw: encodedMessage,
    },
  });

  return response.data.id!;
}

export async function replyToEmail(
  accessToken: string,
  refreshToken: string | undefined,
  threadId: string,
  messageId: string,
  to: string,
  subject: string,
  body: string
): Promise<string> {
  const gmail = getGmailClient(accessToken, refreshToken);

  const message = [
    `To: ${to}`,
    `Subject: Re: ${subject}`,
    `In-Reply-To: ${messageId}`,
    `References: ${messageId}`,
    "Content-Type: text/html; charset=utf-8",
    "",
    body,
  ].join("\n");

  const encodedMessage = Buffer.from(message)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  const response = await gmail.users.messages.send({
    userId: "me",
    requestBody: {
      raw: encodedMessage,
      threadId,
    },
  });

  return response.data.id!;
}

export async function getEmailById(
  accessToken: string,
  refreshToken: string | undefined,
  emailId: string
): Promise<Email | null> {
  const gmail = getGmailClient(accessToken, refreshToken);

  try {
    const fullMessage = await gmail.users.messages.get({
      userId: "me",
      id: emailId,
      format: "full",
    });

    const headers = fullMessage.data.payload?.headers || [];
    const fromHeader = headers.find((h) => h.name === "From")?.value || "";
    const toHeader = headers.find((h) => h.name === "To")?.value || "";
    const subjectHeader = headers.find((h) => h.name === "Subject")?.value || "";
    const dateHeader = headers.find((h) => h.name === "Date")?.value || "";

    const fromMatch = fromHeader.match(/^(.+?)\s*<(.+?)>$/);
    const fromName = fromMatch ? fromMatch[1].replace(/"/g, "") : fromHeader;
    const fromEmail = fromMatch ? fromMatch[2] : fromHeader;

    let body = "";
    if (fullMessage.data.payload?.body?.data) {
      body = Buffer.from(fullMessage.data.payload.body.data, "base64").toString("utf-8");
    } else if (fullMessage.data.payload?.parts) {
      const textPart = fullMessage.data.payload.parts.find(
        (part) => part.mimeType === "text/plain"
      );
      if (textPart?.body?.data) {
        body = Buffer.from(textPart.body.data, "base64").toString("utf-8");
      }
    }

    const hasAttachment =
      fullMessage.data.payload?.parts?.some(
        (part) => part.filename && part.filename.length > 0
      ) || false;

    return {
      id: emailId,
      threadId: fullMessage.data.threadId!,
      from: fromName,
      fromEmail,
      to: toHeader,
      subject: subjectHeader,
      snippet: fullMessage.data.snippet || "",
      body,
      date: new Date(dateHeader),
      isRead: !fullMessage.data.labelIds?.includes("UNREAD"),
      hasAttachment,
      labels: fullMessage.data.labelIds || [],
    };
  } catch {
    return null;
  }
}

export async function markAsRead(
  accessToken: string,
  refreshToken: string | undefined,
  emailId: string
): Promise<void> {
  const gmail = getGmailClient(accessToken, refreshToken);

  await gmail.users.messages.modify({
    userId: "me",
    id: emailId,
    requestBody: {
      removeLabelIds: ["UNREAD"],
    },
  });
}

export async function getUserProfile(accessToken: string, refreshToken?: string) {
  const oauth2 = google.oauth2({ version: "v2", auth: setCredentials({ access_token: accessToken, refresh_token: refreshToken }) });
  const response = await oauth2.userinfo.get();
  return response.data;
}
