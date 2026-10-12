// Gmail drafts and sends for the instant lead emails, plus Heath's text alerts.
// Emails go from contact@seammedia.com.au with Heath's own Gmail signature (read from send-as
// settings), because messages created through the API don't get the signature automatically.

import { google, type gmail_v1 } from "googleapis";
import { getServiceSupabase } from "@/lib/supabase";

type GmailTokens = { access_token: string; refresh_token: string; expiry_date: number | null; email: string };

export interface GmailContext {
  gmail: gmail_v1.Gmail;
  from: string; // "Heath Maes <contact@seammedia.com.au>"
  address: string;
  signatureHtml: string;
}

export async function getGmail(): Promise<GmailContext> {
  const supabase = getServiceSupabase();
  const { data, error } = await supabase.from("settings").select("value").eq("key", "gmail_tokens").single();
  if (error || !data) throw new Error("Gmail is not connected in the lead manager");
  const tokens = data.value as GmailTokens;
  // A client per call: the shared client in lib/gmail.ts holds module-level credentials
  const auth = new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET, process.env.GOOGLE_REDIRECT_URI);
  auth.setCredentials({ refresh_token: tokens.refresh_token, access_token: tokens.access_token, expiry_date: tokens.expiry_date ?? undefined });
  const gmail = google.gmail({ version: "v1", auth });

  const sendAs = (await gmail.users.settings.sendAs.list({ userId: "me" })).data.sendAs ?? [];
  const primary = sendAs.find((s) => s.isDefault) ?? sendAs[0];
  const address = primary?.sendAsEmail ?? tokens.email;
  const name = primary?.displayName || "Heath Maes";
  return { gmail, from: `${encodeHeader(name)} <${address}>`, address, signatureHtml: primary?.signature ?? "" };
}

function encodeHeader(s: string) {
  return /^[\x20-\x7e]*$/.test(s) ? (/[",]/.test(s) ? `"${s.replace(/"/g, "'")}"` : s) : `=?UTF-8?B?${Buffer.from(s).toString("base64")}?=`;
}

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Plain text in, Gmail-style HTML out: one <div> per line, <div><br></div> for blank lines, URLs left
// as plain text (Gmail links them itself), per Heath's email formatting guide.
export function textToGmailHtml(text: string, signatureHtml: string) {
  const lines = text.replace(/\r\n/g, "\n").split("\n").map((l) => (l.trim() ? `<div>${escapeHtml(l)}</div>` : "<div><br></div>"));
  const sig = signatureHtml ? `<div><br></div><div dir="ltr" class="gmail_signature" data-smartmail="gmail_signature">${signatureHtml}</div>` : "";
  return `<div dir="ltr">${lines.join("")}${sig}</div>`;
}

function buildMime(ctx: GmailContext, to: string, subject: string, text: string) {
  const boundary = `seam_${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
  const html = textToGmailHtml(text, ctx.signatureHtml);
  const textWithSig = `${text}\n\nSeam Media | 0402 642 746 | seammedia.com.au`;
  const b64 = (s: string) => Buffer.from(s, "utf8").toString("base64").replace(/(.{76})/g, "$1\r\n");
  const mime = [
    `From: ${ctx.from}`,
    `To: ${to}`,
    `Subject: ${encodeHeader(subject)}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    b64(textWithSig),
    `--${boundary}`,
    "Content-Type: text/html; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    b64(html),
    `--${boundary}--`,
    "",
  ].join("\r\n");
  return Buffer.from(mime).toString("base64url");
}

export async function createDraft(ctx: GmailContext, to: string, subject: string, text: string) {
  const res = await ctx.gmail.users.drafts.create({ userId: "me", requestBody: { message: { raw: buildMime(ctx, to, subject, text) } } });
  return { draftId: res.data.id ?? null, messageId: res.data.message?.id ?? null, threadId: res.data.message?.threadId ?? null };
}

export async function sendNow(ctx: GmailContext, to: string, subject: string, text: string) {
  const res = await ctx.gmail.users.messages.send({ userId: "me", requestBody: { raw: buildMime(ctx, to, subject, text) } });
  return { messageId: res.data.id ?? null, threadId: res.data.threadId ?? null };
}

// Alert to Heath: a text through Twilio when TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, OWNER_ALERT_FROM
// and OWNER_ALERT_TO are set (the AI receptionist's values are marked sensitive in Vercel, so they
// can't be copied across), otherwise an email to INSTANT_ALERT_EMAIL (default contact+leads@...),
// which arrives as a new inbox message and notifies on the phone.
export async function alertHeath(message: string, ctx?: GmailContext): Promise<string | null> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.OWNER_ALERT_FROM;
  const to = process.env.OWNER_ALERT_TO;
  if (sid && token && from && to) {
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: "POST",
      headers: { Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ From: from, To: to, Body: message.slice(0, 600) }),
      signal: AbortSignal.timeout(15_000),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`Twilio ${res.status}: ${data?.message ?? "send failed"}`);
    return data.sid ?? null;
  }
  const g = ctx ?? (await getGmail());
  const address = process.env.INSTANT_ALERT_EMAIL || g.address.replace("@", "+leads@");
  const subject = `Lead alert: ${message.replace(/\s+/g, " ").slice(0, 70)}`;
  const text = `${message}\n\nDrafts: https://mail.google.com/mail/u/0/#drafts`;
  const raw = Buffer.from(
    [`From: ${g.from}`, `To: ${address}`, `Subject: ${encodeHeader(subject)}`, "MIME-Version: 1.0", "Content-Type: text/plain; charset=UTF-8", "", text].join("\r\n")
  ).toString("base64url");
  const res = await g.gmail.users.messages.send({ userId: "me", requestBody: { raw } });
  return res.data.id ?? null;
}
