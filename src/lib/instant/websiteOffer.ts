// Website offer (17 Nov 2026): Heath's pay-on-results website for trades and small businesses, sold by the NB Meta
// ads through seammedia.com.au/website-offer (via /api/leads/guide with offer "website-offer"). It's the Smart Website
// with its own terms. The form asks industry and monthly budget like the guides: under $250 or "just looking" gets the
// email only, no call.
//
// Every line marked PENDING is a placeholder until Heath's agreed offer wording arrives. While PENDING is true the
// reply is always saved as a Gmail draft, never sent, whatever the instant email mode is.

import { getServiceSupabase } from "@/lib/supabase";
import { alertHeath, createDraft, getGmail, sendNow } from "./deliver";
import type { InstantLeadForm } from "./form";
import { firstName, type GuideQualifier } from "./guide";
import { getMode } from "./run";

export const WEBSITE_OFFER_PENDING = true;
export const WEBSITE_OFFER_URL = "https://www.seammedia.com.au/website-offer";
export const WEBSITE_OFFER_SUBJECT = "Your website enquiry";
const OFFER_LINE = "[you don't pay until it brings you enquiries]"; // PENDING
const TERMS_LINE = "[Price once it's working, setup fee and minimum term.]"; // PENDING
const ENQUIRY_RULE = "[What counts as an enquiry, and how many before billing starts.]"; // PENDING

export function websiteOfferMessages(form: InstantLeadForm, callOk = true) {
  const first = firstName(form);
  const business = form.company.trim();
  const email = [
    `Hi ${first || "there"},`,
    "",
    `Thanks for asking about a website${business ? ` for ${business}` : ""}. Here's how it works: I build it, and ${OFFER_LINE}.`,
    "",
    "What you get:",
    "",
    "- A website built for your business, set up so you show up on Google",
    "- Missed calls get an automatic text back, so the job doesn't go to the next number on the list",
    "- Every form enquiry gets an instant reply",
    "- Every enquiry (calls, texts, forms and missed calls) is sent to your phone by SMS",
    "",
    ENQUIRY_RULE,
    "",
    `${TERMS_LINE} I do the work myself, here in Australia.`,
    "",
    "All the details are here:",
    WEBSITE_OFFER_URL,
    "",
    callOk
      ? "I'll give you a quick call within one business day to ask about your business and the work you want more of. If there's a better time, or you'd rather sort it by email, just reply and let me know."
      : "If you'd like to go ahead, or have any questions, just reply to this email.",
    "",
    "Thanks,",
    "Heath",
  ].join("\n");
  return { subject: WEBSITE_OFFER_SUBJECT, email };
}

export async function processWebsiteOfferLead(id: string, utm: { source: string | null; campaign: string | null; ad: string | null }, qual: GuideQualifier) {
  const callOk = qual.qualified !== false;
  const db = getServiceSupabase();
  const touch = (patch: Record<string, unknown>) => db.from("lead_enrichments").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", id);
  const { data: row, error } = await db.from("lead_enrichments").select("id, lead_id, form").eq("id", id).single();
  if (error || !row) throw new Error(`Website offer lead ${id} not found`);
  const form = row.form as InstantLeadForm;
  const who = [form.name, form.company].filter(Boolean).join(", ");
  const extra = [qual.industry, qual.budget, form.trade && `Does: ${form.trade}`, form.website && `Site: ${form.website}`, utm.ad && `Ad: ${utm.ad}`].filter(Boolean).join(" | ");
  const callLine = `${form.phone ?? "no number"} | ${form.email}${extra ? ` | ${extra}` : ""}`;
  const { subject, email } = websiteOfferMessages(form, callOk);
  const now = new Date().toISOString();

  try {
    const mode = WEBSITE_OFFER_PENDING ? "draft" : await getMode();
    const ctx = await getGmail();
    if (mode === "auto") {
      const s = await sendNow(ctx, form.email, subject, email);
      await touch({ status: "sent", mode, sent_at: now, recommended_plan: "Website offer", email_subject: subject, email_body: email, gmail_message_id: s.messageId, gmail_thread_id: s.threadId });
    } else {
      const d = await createDraft(ctx, form.email, subject, email);
      await touch({ status: "drafted", mode, recommended_plan: "Website offer", email_subject: subject, email_body: email, gmail_draft_id: d.draftId, gmail_message_id: d.messageId, gmail_thread_id: d.threadId });
    }
    if (row.lead_id) await db.from("leads").update({ instant_flow: true, last_contacted: mode === "auto" ? now : undefined, updated_at: now }).eq("id", row.lead_id);
    const sent = mode === "auto" ? "Reply emailed" : "Reply is in Drafts";
    await alertHeath(`Website offer lead, ${callOk ? "call them" : "email only, DON'T CALL"}: ${who}. ${callLine}. ${sent}.`, ctx).catch((err) => console.error("[website-offer] alert failed", err));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[website-offer] send failed", id, message);
    await touch({ status: "failed", error: message.slice(0, 1000) });
    await alertHeath(`Website offer lead, the email FAILED so reply by hand: ${who}. ${callLine}.`).catch(() => null);
  }
}
