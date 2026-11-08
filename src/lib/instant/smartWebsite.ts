// Smart Website ($99 a week, Heath's entry package for trades, 8 Nov 2026).
// Leads from seammedia.com.au/smart-website (via /api/leads/guide with offer "smart-website") and any Meta
// instant form, campaign or ad named "smart website" get this reply instead of the Claude-written email,
// which only knows the Foundation, Growth and Complete Growth plans and would pitch them $140+.
//
// Only quote what Heath has confirmed (8 Nov 2026): $99 a week + GST, no setup fee, month to month.
// Page count and what SEO covers are still open, so the email doesn't mention them.

import { getServiceSupabase } from "@/lib/supabase";
import { alertHeath, createDraft, getGmail, sendNow } from "./deliver";
import type { InstantLeadForm } from "./form";
import { firstName, textLead, toMobile } from "./guide";
import { getMode } from "./run";

export const SMART_WEBSITE_URL = "https://www.seammedia.com.au/smart-website";
export const SMART_WEBSITE_PRICE = "$99 a week + GST";
export const SMART_WEBSITE_SUBJECT = "Your smart website enquiry";

export function isSmartWebsiteLead(form: InstantLeadForm) {
  return [form.formName, form.campaignName, form.adsetName, form.adName].some((v) => v && /smart\s*web/i.test(v));
}

export function smartWebsiteMessages(form: InstantLeadForm) {
  const first = firstName(form);
  const business = form.company.trim();
  const email = [
    `Hi ${first || "there"},`,
    "",
    `Thanks for asking about a smart website${business ? ` for ${business}` : ""}.`,
    "",
    `Here's what you get for ${SMART_WEBSITE_PRICE}:`,
    "",
    "- A website built for your business, set up so you show up on Google",
    "- Missed calls get an automatic text back, so the job doesn't go to the next number on the list",
    "- Every form enquiry gets an instant reply",
    "- Every enquiry (calls, texts, forms and missed calls) is sent to your phone by SMS",
    "",
    "There's no setup fee, it's month to month, and I do the work myself, here in Australia.",
    "",
    "Here's how it works:",
    SMART_WEBSITE_URL,
    "",
    "I'll give you a quick call within one business day to ask about your business and what you'd like the website to do. If there's a better time, or you'd rather sort it by email, just reply and let me know.",
    "",
    "Thanks,",
    "Heath",
  ].join("\n");
  const sms = `Hi ${first || "there"}, it's Heath from Seam Media. Thanks for asking about a smart website. I'll give you a quick call within one business day. Reply STOP to opt out.`;
  return { subject: SMART_WEBSITE_SUBJECT, email, sms };
}

export async function processSmartWebsiteLead(id: string, utm: { source: string | null; campaign: string | null; ad: string | null }) {
  const db = getServiceSupabase();
  const touch = (patch: Record<string, unknown>) => db.from("lead_enrichments").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", id);
  const { data: row, error } = await db.from("lead_enrichments").select("id, lead_id, form").eq("id", id).single();
  if (error || !row) throw new Error(`Smart website lead ${id} not found`);
  const form = row.form as InstantLeadForm;
  const who = [form.name, form.company].filter(Boolean).join(", ");
  const extra = [form.trade && `Does: ${form.trade}`, form.website && `Site: ${form.website}`, utm.ad && `Ad: ${utm.ad}`].filter(Boolean).join(" | ");
  const callLine = `${form.phone ?? "no number"} | ${form.email}${extra ? ` | ${extra}` : ""}`;
  const { subject, email, sms } = smartWebsiteMessages(form);
  const now = new Date().toISOString();

  try {
    const mode = await getMode();
    const ctx = await getGmail();
    if (mode === "auto") {
      const s = await sendNow(ctx, form.email, subject, email);
      await touch({ status: "sent", mode, sent_at: now, recommended_plan: "Smart Website", email_subject: subject, email_body: email, gmail_message_id: s.messageId, gmail_thread_id: s.threadId });
    } else {
      const d = await createDraft(ctx, form.email, subject, email);
      await touch({ status: "drafted", mode, recommended_plan: "Smart Website", email_subject: subject, email_body: email, gmail_draft_id: d.draftId, gmail_message_id: d.messageId, gmail_thread_id: d.threadId });
    }
    if (row.lead_id) await db.from("leads").update({ instant_flow: true, last_contacted: mode === "auto" ? now : undefined, updated_at: now }).eq("id", row.lead_id);

    const mobile = toMobile(form.phone);
    const texted = mobile && mode === "auto" ? await textLead(mobile, sms).catch((err) => { console.error("[smart-website] lead text failed", err); return false; }) : false;
    const sent = mode === "auto" ? `Reply ${texted ? "emailed and texted" : "emailed"}` : "Reply is in Drafts";
    await alertHeath(`Smart Website lead ($99/wk), call them: ${who}. ${callLine}. ${sent}.`, ctx).catch((err) => console.error("[smart-website] alert failed", err));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[smart-website] send failed", id, message);
    await touch({ status: "failed", error: message.slice(0, 1000) });
    await alertHeath(`Smart Website lead, the email FAILED so reply by hand: ${who}. ${callLine}.`).catch(() => null);
  }
}
