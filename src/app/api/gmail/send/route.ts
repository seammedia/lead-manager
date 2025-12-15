import { NextRequest, NextResponse } from "next/server";
import { sendEmail, replyToEmail } from "@/lib/gmail";

export async function POST(request: NextRequest) {
  const accessToken = request.headers.get("x-gmail-access-token");
  const refreshToken = request.headers.get("x-gmail-refresh-token");

  if (!accessToken) {
    return NextResponse.json(
      { error: "Access token is required" },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    const { to, subject, content, threadId, messageId } = body;

    if (!to || !subject || !content) {
      return NextResponse.json(
        { error: "Missing required fields: to, subject, content" },
        { status: 400 }
      );
    }

    let emailId: string;

    if (threadId && messageId) {
      // This is a reply
      emailId = await replyToEmail(
        accessToken,
        refreshToken || undefined,
        threadId,
        messageId,
        to,
        subject,
        content
      );
    } else {
      // This is a new email
      emailId = await sendEmail(
        accessToken,
        refreshToken || undefined,
        to,
        subject,
        content
      );
    }

    return NextResponse.json({ success: true, emailId });
  } catch (error) {
    console.error("Error sending email:", error);
    return NextResponse.json(
      { error: "Failed to send email" },
      { status: 500 }
    );
  }
}
