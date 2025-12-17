import { NextRequest, NextResponse } from "next/server";
import { getGmailTokens, setGmailTokens, getGmailEmail } from "@/lib/auth-cookies";
import { sendEmail, replyToEmail, refreshAccessToken } from "@/lib/gmail";
import { getServiceSupabase } from "@/lib/supabase";

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
        console.error("Error refreshing token:", refreshError);
        return NextResponse.json(
          { error: "Session expired. Please reconnect Gmail." },
          { status: 401 }
        );
      }
    }

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
        tokens.refresh_token,
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
        tokens.refresh_token,
        to,
        subject,
        content
      );
    }

    // Update lead's last_contacted and log the email
    try {
      const supabase = getServiceSupabase();
      const recipientEmail = to.toLowerCase();

      // Find the lead by email
      const { data: lead } = await supabase
        .from("leads")
        .select("id")
        .ilike("email", recipientEmail)
        .single();

      // Update last_contacted if lead found
      if (lead) {
        await supabase
          .from("leads")
          .update({ last_contacted: new Date().toISOString() })
          .eq("id", lead.id);
      }

      // Log the email to email_logs table
      const { error: logError } = await supabase
        .from("email_logs")
        .insert({
          lead_id: lead?.id || null,
          subject: subject,
          body: content,
          gmail_message_id: emailId,
          thread_id: threadId || null,
          is_sent: true,
          sent_at: new Date().toISOString(),
        });

      if (logError) {
        console.log("Failed to log email:", logError.message);
      }
    } catch (updateError) {
      // Don't fail the request if lead update fails
      console.error("Error updating lead/logging email:", updateError);
    }

    return NextResponse.json({ success: true, emailId });
  } catch (error) {
    console.error("Error sending email:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to send email: ${errorMessage}` },
      { status: 500 }
    );
  }
}
