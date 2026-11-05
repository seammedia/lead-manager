// Sends the free guide to someone who asked for it on the website, and tells Heath to call them.

import { getServiceSupabase } from "@/lib/supabase";
import { alertHeath, createDraft, getGmail, sendNow } from "./deliver";
import type { InstantLeadForm } from "./form";
import { getMode } from "./run";

export const GUIDE_URL = "https://www.seammedia.com.au/guides/social-media-enquiries-guide.pdf";
const GUIDE_SUBJECT = "Your guide: why your socials get likes but no enquiries";

function firstName(form: InstantLeadForm) {
  const n = form.name.trim().split(/\s+/)[0] ?? "";
  return n && !/[|&@\d]/.test(n) ? n.charAt(0).toUpperCase() + n.slice(1) : "";
}

export function guideMessages(form: InstantLeadForm) {
  const first = firstName(form);
  const business = form.company.trim();
  const email = [
    `Hi ${first || "there"},`,
    "",
    "Here's the guide you asked for:",
    GUIDE_URL,
    "",
    "If you only have 10 minutes, do the profile test on page 4. It's free to fix, and it helps every post you've ever published.",
    "",
    `I'll give you a quick call to see what you're after${business ? ` for ${business}` : ""}. If there's a better time, or you'd rather I didn't call, just reply and let me know.`,
    "",
    "Thanks,",
    "Heath",
  ].join("\n");
  const sms = `Hi ${first || "there"}, it's Heath from Seam Media. Here's your guide: ${GUIDE_URL} I'll give you a quick call about it soon. Reply STOP to opt out.`;
  return { subject: GUIDE_SUBJECT, email, sms };
}

// Australian mobiles only: 04xx or +614xx
function toMobile(phone: string | null) {
  const p = (phone ?? "").replace(/[\s()-]/g, "");
  if (/^04\d{8}$/.test(p)) return `+61${p.slice(1)}`;
  if (/^\+?614\d{8}$/.test(p)) return `+${p.replace(/^\+/, "")}`;
  return null;
}

// Needs the same Twilio values as Heath's text alerts. Without them the lead gets the email only.
async function textLead(to: string, body: string) {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.OWNER_ALERT_FROM;
  if (!sid || !token || !from) return false;
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: { Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ From: from, To: to, Body: body }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`Twilio ${res.status}`);
  return true;
}

export async function processGuideLead(id: string, utm: { source: string | null; campaign: string | null; ad: string | null }) {
  const db = getServiceSupabase();
  const touch = (patch: Record<string, unknown>) => db.from("lead_enrichments").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", id);
  const { data: row, error } = await db.from("lead_enrichments").select("id, lead_id, form").eq("id", id).single();
  if (error || !row) throw new Error(`Guide lead ${id} not found`);
  const form = row.form as InstantLeadForm;
  const who = [form.name, form.company].filter(Boolean).join(", ");
  const callLine = `${form.phone ?? "no number"} | ${form.email}${utm.ad ? ` | Ad: ${utm.ad}` : ""}`;
  const { subject, email, sms } = guideMessages(form);
  const now = new Date().toISOString();

  try {
    const mode = await getMode();
    const ctx = await getGmail();
    if (mode === "auto") {
      const s = await sendNow(ctx, form.email, subject, email);
      await touch({ status: "sent", mode, sent_at: now, email_subject: subject, email_body: email, gmail_message_id: s.messageId, gmail_thread_id: s.threadId });
    } else {
      const d = await createDraft(ctx, form.email, subject, email);
      await touch({ status: "drafted", mode, email_subject: subject, email_body: email, gmail_draft_id: d.draftId, gmail_message_id: d.messageId, gmail_thread_id: d.threadId });
    }
    if (row.lead_id) await db.from("leads").update({ last_contacted: now, updated_at: now }).eq("id", row.lead_id);

    const mobile = toMobile(form.phone);
    const texted = mobile && mode === "auto" ? await textLead(mobile, sms).catch((err) => { console.error("[guide] lead text failed", err); return false; }) : false;
    const sent = mode === "auto" ? `Guide ${texted ? "emailed and texted" : "emailed"}` : "Guide email is in Drafts";
    await alertHeath(`Guide lead, call them: ${who}. ${callLine}. ${sent}.`, ctx).catch((err) => console.error("[guide] alert failed", err));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[guide] send failed", id, message);
    await touch({ status: "failed", error: message.slice(0, 1000) });
    await alertHeath(`Guide lead, the email FAILED so send it by hand: ${who}. ${callLine}. Guide: ${GUIDE_URL}`).catch(() => null);
  }
}
