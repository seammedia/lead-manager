// Website offer, "free until it works" (17 Nov 2026): Heath's front-end offer for trades and local service businesses,
// sold by the NB Meta ads through seammedia.com.au/website-offer (via /api/leads/guide with offer "website-offer").
// It's the Smart Website with these terms (Heath approved "free until 3 enquiries", via the Chief of Staff):
// built in 7 days at no cost, $99 a week + GST from the 3rd real enquiry, month to month, no setup fee, no lock-in,
// walk away owing nothing if it hasn't brought 3 real enquiries within 60 days (the Chief of Staff's default, not yet
// confirmed by Heath). Only for businesses with 10+ Google reviews, not e-commerce. The form asks industry, Google
// reviews and monthly budget; anyone who doesn't qualify gets the email but no call.

import { getServiceSupabase } from "@/lib/supabase";
import { alertHeath, createDraft, getGmail, sendNow } from "./deliver";
import type { InstantLeadForm } from "./form";
import { firstName, type GuideQualifier } from "./guide";
import { getMode } from "./run";

export const WEBSITE_OFFER_URL = "https://www.seammedia.com.au/website-offer";
export const WEBSITE_OFFER_SUBJECT = "Your new website, free until it works";
const WALK_AWAY_DAYS = 60;

export function websiteOfferMessages(form: InstantLeadForm, qual: GuideQualifier) {
  const first = firstName(form);
  const business = form.company.trim();
  const callOk = qual.qualified !== false;
  const fewReviews = !!qual.reviews && !/10 or more/i.test(qual.reviews);
  const ecommerce = qual.industry === "Ecommerce and retail";
  const lines = [
    `Hi ${first || "there"},`,
    "",
    `Thanks for asking about a new website${business ? ` for ${business}` : ""}.`,
    "",
  ];
  if (fewReviews || ecommerce) {
    lines.push(
      fewReviews
        ? "This offer is for established businesses with a Google Business Profile with 10 or more reviews, so it's not one I can do for you just yet."
        : "This offer is for trades and local service businesses rather than online stores, so it's not one I can do for you.",
      "",
      "If you'd like to talk about other ways I can help, just reply to this email.",
    );
  } else {
    lines.push(
      "Here's how it works. I build your website in 7 days at no cost. You only start paying once it's brought you 3 real enquiries. If it doesn't, you don't pay a cent.",
      "",
      "What you get:",
      "",
      "- A website built for your business, set up so you show up on Google",
      "- Missed calls get an automatic text back, so the job doesn't go to the next number on the list",
      "- Every form enquiry gets an instant reply",
      "- Every enquiry (calls, texts, forms and missed calls) is sent to your phone by SMS",
      "",
      "A real enquiry is a form submission, a call or a missed call from a new potential customer through your website. Spam, existing customers and suppliers don't count.",
      "",
      `After the 3rd real enquiry it's $99 a week + GST, month to month, with no setup fee and no lock-in. If it hasn't brought 3 real enquiries within ${WALK_AWAY_DAYS} days, you can walk away owing nothing. I host and manage the website, and I do the work myself, here in Australia.`,
      "",
      "All the details are here:",
      WEBSITE_OFFER_URL,
      "",
      callOk
        ? "I'll give you a quick call within one business day to ask about your business and the work you want more of. If there's a better time, or you'd rather sort it by email, just reply and let me know."
        : "If you'd like to go ahead, or have any questions, just reply to this email.",
    );
  }
  lines.push("", "Thanks,", "Heath");
  return { subject: WEBSITE_OFFER_SUBJECT, email: lines.join("\n") };
}

export async function processWebsiteOfferLead(id: string, utm: { source: string | null; campaign: string | null; ad: string | null }, qual: GuideQualifier) {
  const callOk = qual.qualified !== false;
  const db = getServiceSupabase();
  const touch = (patch: Record<string, unknown>) => db.from("lead_enrichments").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", id);
  const { data: row, error } = await db.from("lead_enrichments").select("id, lead_id, form").eq("id", id).single();
  if (error || !row) throw new Error(`Website offer lead ${id} not found`);
  const form = row.form as InstantLeadForm;
  const who = [form.name, form.company].filter(Boolean).join(", ");
  const extra = [qual.industry, qual.reviews, qual.budget, form.trade && `Does: ${form.trade}`, form.website && `Site: ${form.website}`, utm.ad && `Ad: ${utm.ad}`].filter(Boolean).join(" | ");
  const callLine = `${form.phone ?? "no number"} | ${form.email}${extra ? ` | ${extra}` : ""}`;
  const { subject, email } = websiteOfferMessages(form, qual);
  const now = new Date().toISOString();

  try {
    const mode = await getMode();
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
