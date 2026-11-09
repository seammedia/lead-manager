// Sends the free guide to someone who asked for it on the website, and tells Heath to call them.

import { getServiceSupabase } from "@/lib/supabase";
import { alertHeath, createDraft, getGmail, sendInThread, sendNow, type GmailContext } from "./deliver";
import type { InstantLeadForm } from "./form";
import { getMode } from "./run";

export const GUIDE_URL = "https://www.seammedia.com.au/guides/social-media-enquiries-guide.pdf";
export const OFFER_URL = "https://www.seammedia.com.au/social-media-guide/thanks";
const GUIDE_SUBJECT = "Your guide: why your socials get likes but no enquiries";
const FOLLOW_UP_AFTER_MS = 48 * 3_600_000;

// Two lead magnets share this flow: the social media guide (5 Nov 2026) and the tradie website guide, which leads
// with the Smart Website (8 Nov 2026). The follow-up cron tells them apart by the email subject.
export type GuideKind = "social" | "website";
export const GUIDES: Record<GuideKind, {
  subject: string; url: string; offer: string; summary: string; label: string;
  tip: string; rather: string; callAbout: string; followTip: string; followRather: string; followQuestion: string;
}> = {
  social: {
    subject: GUIDE_SUBJECT,
    url: GUIDE_URL,
    offer: OFFER_URL,
    summary: "Asked for the social media guide",
    label: "Guide lead",
    tip: "If you only have 10 minutes, do the profile test on page 4. It's free to fix, and it helps every post you've ever published.",
    rather: "If you'd rather have me do this for you, here's how it works:",
    callAbout: "what you're after",
    followTip: "If it's still sitting in your inbox, start with the profile test on page 4. It only takes 10 minutes.",
    followRather: "If you'd rather I took care of it, here's how I work:",
    followQuestion: "What's the main thing you'd like more of from Facebook and Instagram at the moment?",
  },
  website: {
    subject: "Your guide: stop losing jobs to missed calls and slow replies",
    url: "https://www.seammedia.com.au/guides/tradie-website-guide.pdf",
    offer: "https://www.seammedia.com.au/website-guide/thanks",
    summary: "Asked for the tradie website guide",
    label: "Website guide lead",
    tip: "If you only have 5 minutes, do the phone test on page 4. Most of what it finds is quick to fix.",
    rather: "If you'd rather I set it up for you, here's how the Smart Website works:",
    callAbout: "how calls and enquiries come in at the moment",
    followTip: "If it's still sitting in your inbox, start with the phone test on page 4. It only takes 5 minutes.",
    followRather: "If you'd rather I set it up for you, here's how the Smart Website works:",
    followQuestion: "What happens to your calls at the moment when you're on a job and can't pick up?",
  },
};
const kindOfSubject = (subject: string | null | undefined): GuideKind => (subject === GUIDES.website.subject ? "website" : "social");

export function firstName(form: InstantLeadForm) {
  const n = form.name.trim().split(/\s+/)[0] ?? "";
  return n && !/[|&@\d]/.test(n) ? n.charAt(0).toUpperCase() + n.slice(1) : "";
}

// Guide opt-ins ask industry and monthly marketing budget (10 Nov 2026). "Just the free guide for now" and
// "Under $250 a month" come through as qualified "no": they get the guide and the follow-up, but no call.
export type GuideQualifier = { industry: string | null; budget: string | null; qualified: boolean | null };
export function readQualifier(body: Record<string, unknown>): GuideQualifier {
  const str = (k: string) => (typeof body[k] === "string" && (body[k] as string).trim() ? (body[k] as string).trim().slice(0, 60) : null);
  const q = str("qualified");
  return { industry: str("industry"), budget: str("budget"), qualified: q === "yes" ? true : q === "no" ? false : null };
}
export function qualifierNote(q: GuideQualifier) {
  return [
    q.industry && `Industry: ${q.industry}`,
    q.budget && `Budget: ${q.budget}`,
    q.qualified === false && "DON'T CALL (said just the guide, or under $250 a month). Email follow-up only",
  ].filter(Boolean).join(" | ");
}

export function guideMessages(form: InstantLeadForm, kind: GuideKind = "social", callOk = true) {
  const g = GUIDES[kind];
  const first = firstName(form);
  const business = form.company.trim();
  const email = [
    `Hi ${first || "there"},`,
    "",
    "Here's the guide you asked for:",
    g.url,
    "",
    g.tip,
    "",
    g.rather,
    g.offer,
    "",
    !callOk
      ? "If you'd like a hand with any of it later, just reply to this email."
      : kind === "social"
      ? `I'll give you a quick call to see what you're after${business ? ` for ${business}` : ""}. If there's a better time, or you'd rather I didn't call, just reply and let me know.`
      : `I'll give you a quick call to ask ${g.callAbout}${business ? ` at ${business}` : ""}. If there's a better time, or you'd rather I didn't call, just reply and let me know.`,
    "",
    "Thanks,",
    "Heath",
  ].join("\n");
  const sms = `Hi ${first || "there"}, it's Heath from Seam Media. Here's your guide: ${g.url} I'll give you a quick call about it soon. Reply STOP to opt out.`;
  return { subject: g.subject, email, sms };
}

// Australian mobiles only: 04xx or +614xx
export function toMobile(phone: string | null) {
  const p = (phone ?? "").replace(/[\s()-]/g, "");
  if (/^04\d{8}$/.test(p)) return `+61${p.slice(1)}`;
  if (/^\+?614\d{8}$/.test(p)) return `+${p.replace(/^\+/, "")}`;
  return null;
}

// Needs the same Twilio values as Heath's text alerts. Without them the lead gets the email only.
export async function textLead(to: string, body: string) {
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

export async function processGuideLead(id: string, utm: { source: string | null; campaign: string | null; ad: string | null }, kind: GuideKind = "social", qual: GuideQualifier = { industry: null, budget: null, qualified: null }) {
  const callOk = qual.qualified !== false;
  const g = GUIDES[kind];
  const db = getServiceSupabase();
  const touch = (patch: Record<string, unknown>) => db.from("lead_enrichments").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", id);
  const { data: row, error } = await db.from("lead_enrichments").select("id, lead_id, form").eq("id", id).single();
  if (error || !row) throw new Error(`Guide lead ${id} not found`);
  const form = row.form as InstantLeadForm;
  const who = [form.name, form.company].filter(Boolean).join(", ");
  const callLine = [`${form.phone ?? "no number"} | ${form.email}`, qual.industry, qual.budget, utm.ad && `Ad: ${utm.ad}`].filter(Boolean).join(" | ");
  const { subject, email, sms } = guideMessages(form, kind, callOk);
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
    await alertHeath(`${g.label}, ${callOk ? "call them" : "email only, DON'T CALL"}: ${who}. ${callLine}. ${sent}.`, ctx).catch((err) => console.error("[guide] alert failed", err));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[guide] send failed", id, message);
    await touch({ status: "failed", error: message.slice(0, 1000) });
    await alertHeath(`${g.label}, the email FAILED so send it by hand: ${who}. ${callLine}. Guide: ${g.url}`).catch(() => null);
  }
}

export function guideFollowUp(form: InstantLeadForm, kind: GuideKind = "social") {
  const g = GUIDES[kind];
  const first = firstName(form);
  return [
    `Hi ${first || "there"},`,
    "",
    "Did you get a chance to look at the guide?",
    "",
    g.followTip,
    "",
    g.followRather,
    g.offer,
    "",
    g.followQuestion,
    "",
    "If you'd rather I didn't follow up, just reply and let me know.",
    "",
    "Thanks,",
    "Heath",
  ].join("\n");
}

type GuideRow = { id: string; form: unknown; facts: unknown; gmail_thread_id: string | null; gmail_message_id: string | null; email_subject?: string | null };

export async function sendGuideFollowUp(ctx: GmailContext, row: GuideRow) {
  if (!row.gmail_thread_id || !row.gmail_message_id) throw new Error("No thread to follow up in");
  const form = row.form as InstantLeadForm;
  const db = getServiceSupabase();
  const now = new Date().toISOString();
  // Marked first: a failed send is flagged rather than retried every 10 minutes
  const facts = { ...((row.facts as Record<string, unknown> | null) ?? {}), guide_followup_at: now };
  await db.from("lead_enrichments").update({ facts, updated_at: now }).eq("id", row.id);
  const kind = kindOfSubject(row.email_subject);
  await sendInThread(ctx, form.email, `Re: ${GUIDES[kind].subject}`, guideFollowUp(form, kind), row.gmail_thread_id, row.gmail_message_id);
}

function isBusinessHours() {
  const parts = new Intl.DateTimeFormat("en-AU", { timeZone: "Australia/Melbourne", weekday: "short", hour: "numeric", hourCycle: "h23" }).formatToParts(new Date());
  const day = parts.find((p) => p.type === "weekday")?.value ?? "";
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  return !["Sat", "Sun"].includes(day) && hour >= 9 && hour < 17;
}

// One follow-up, at least 48 hours after the guide, on a weekday between 9 am and 5 pm Melbourne time.
// Only for leads who haven't replied (status still "sent") and whose stage Heath hasn't changed.
export async function sendDueGuideFollowUps(ctx: GmailContext) {
  if (!isBusinessHours() || (await getMode()) !== "auto") return 0;
  const db = getServiceSupabase();
  const now = Date.now();
  const { data: rows } = await db
    .from("lead_enrichments")
    .select("id, lead_id, form, facts, gmail_thread_id, gmail_message_id, email_subject")
    .in("email_subject", [GUIDES.social.subject, GUIDES.website.subject])
    .eq("status", "sent")
    .lte("sent_at", new Date(now - FOLLOW_UP_AFTER_MS).toISOString())
    .gte("sent_at", new Date(now - 14 * 86_400_000).toISOString());
  let sent = 0;
  for (const row of rows ?? []) {
    if ((row.facts as { guide_followup_at?: string } | null)?.guide_followup_at || sent >= 5) continue;
    const { data: lead } = await db.from("leads").select("stage, archived").eq("id", row.lead_id).single();
    if (!lead || lead.archived || lead.stage !== "contacted_1") continue;
    try {
      await sendGuideFollowUp(ctx, row);
      sent++;
    } catch (err) {
      const form = row.form as InstantLeadForm;
      console.error("[guide] follow-up failed", row.id, err);
      await alertHeath(`Guide follow-up to ${form.email} failed. It won't be retried, so email them by hand if you still want to.`, ctx).catch(() => null);
    }
  }
  return sent;
}
