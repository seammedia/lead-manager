// Social media manager (19 Nov 2026): the SM Meta ads send people to seammedia.com.au/social-media-manager
// (via /api/leads/guide with offer "social-manager"). It sells Local Marketing Foundation at its live price,
// $140 a week + GST, with the "no photos needed" angle Heath approved on 19 Nov 2026: posts made from the business's
// website, Google reviews and past jobs, phone snaps optional. The form asks industry, trade and suburb, website,
// their Instagram or Facebook page (for the free 3-post redesign) and monthly budget; under $250 or "just looking"
// gets the email but no call.

import { getServiceSupabase } from "@/lib/supabase";
import { alertHeath, createDraft, getGmail, sendNow } from "./deliver";
import type { InstantLeadForm } from "./form";
import type { GuideQualifier } from "./guide";
import { businessPhrase, firstName } from "./leadName";
import { getMode } from "./run";

export const SOCIAL_MANAGER_URL = "https://www.seammedia.com.au/social-media-manager";
export const SOCIAL_MANAGER_SUBJECT = "Your social media, done for you";

export function socialManagerMessages(form: InstantLeadForm, qual: GuideQualifier) {
  const first = firstName(form);
  const callOk = qual.qualified !== false;
  const lines = [
    `Hi ${first || "there"},`,
    "",
    `Thanks for asking about social media${businessPhrase(form)}.`,
    "",
    "Here's how it works. I run your Facebook and Instagram, and make the posts from what you already have: your website, your Google reviews and your past jobs. Phone snaps are welcome, but you never have to send them.",
    "",
    "What you get:",
    "",
    "- Branded posts and captions, made in your colours and logo",
    "- Posts scheduled on Facebook and Instagram, which you approve in your own client portal",
    "- Reel editing, agreed in your scope",
    "- An email every Monday with your reach and engagement",
    "",
    "It's $140 a week + GST (Local Marketing Foundation), billed weekly, month to month, with no lock-in. I do the work myself, here in Australia.",
    "",
    "All the details are here:",
    SOCIAL_MANAGER_URL,
    "",
    callOk
      ? "I'll give you a quick call within one business day. If it looks like a fit, I'll redesign 3 of your current posts for free first, so you can see the difference before you decide. If there's a better time, or you'd rather sort it by email, just reply and let me know."
      : "If you'd like to go ahead, or have any questions, just reply to this email.",
    "",
    "Thanks,",
    "Heath",
  ];
  return { subject: SOCIAL_MANAGER_SUBJECT, email: lines.join("\n") };
}

export async function processSocialManagerLead(id: string, utm: { source: string | null; campaign: string | null; ad: string | null }, qual: GuideQualifier, social: string | null) {
  const callOk = qual.qualified !== false;
  const db = getServiceSupabase();
  const touch = (patch: Record<string, unknown>) => db.from("lead_enrichments").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", id);
  const { data: row, error } = await db.from("lead_enrichments").select("id, lead_id, form").eq("id", id).single();
  if (error || !row) throw new Error(`Social manager lead ${id} not found`);
  const form = row.form as InstantLeadForm;
  const who = [form.name, form.company].filter(Boolean).join(", ");
  const extra = [qual.industry, qual.budget, form.trade && `Does: ${form.trade}`, form.website && `Site: ${form.website}`, social && `Social: ${social}`, utm.ad && `Ad: ${utm.ad}`].filter(Boolean).join(" | ");
  const callLine = `${form.phone ?? "no number"} | ${form.email}${extra ? ` | ${extra}` : ""}`;
  const { subject, email } = socialManagerMessages(form, qual);
  const now = new Date().toISOString();

  try {
    const mode = await getMode();
    const ctx = await getGmail();
    if (mode === "auto") {
      const s = await sendNow(ctx, form.email, subject, email);
      await touch({ status: "sent", mode, sent_at: now, recommended_plan: "Foundation (social media manager)", email_subject: subject, email_body: email, gmail_message_id: s.messageId, gmail_thread_id: s.threadId });
    } else {
      const d = await createDraft(ctx, form.email, subject, email);
      await touch({ status: "drafted", mode, recommended_plan: "Foundation (social media manager)", email_subject: subject, email_body: email, gmail_draft_id: d.draftId, gmail_message_id: d.messageId, gmail_thread_id: d.threadId });
    }
    if (row.lead_id) await db.from("leads").update({ instant_flow: true, last_contacted: mode === "auto" ? now : undefined, updated_at: now }).eq("id", row.lead_id);
    const sent = mode === "auto" ? "Reply emailed" : "Reply is in Drafts";
    const redesign = callOk && social ? " Free redesign: 3 of their posts." : "";
    await alertHeath(`Social media manager lead, ${callOk ? "call them" : "email only, DON'T CALL"}: ${who}. ${callLine}. ${sent}.${redesign}`, ctx).catch((err) => console.error("[social-manager] alert failed", err));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[social-manager] send failed", id, message);
    await touch({ status: "failed", error: message.slice(0, 1000) });
    await alertHeath(`Social media manager lead, the email FAILED so reply by hand: ${who}. ${callLine}.`).catch(() => null);
  }
}
