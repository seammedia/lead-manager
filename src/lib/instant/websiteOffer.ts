// Website offer, "free until it works" (17 Nov 2026): Heath's front-end offer for trades and local service businesses,
// sold by the NB Meta ads through seammedia.com.au/website-offer (via /api/leads/guide with offer "website-offer").
// It's the Smart Website with these terms (Heath approved "free until 3 enquiries", via the Chief of Staff):
// built in 7 days at no cost, $99 a week + GST from the 3rd real enquiry, month to month, no setup fee, no lock-in,
// walk away owing nothing if it hasn't brought 3 real enquiries within 60 days (the Chief of Staff's default, not yet
// confirmed by Heath). Only for businesses with 10+ Google reviews, not e-commerce. The form asks industry, Google
// reviews and monthly budget; anyone who doesn't qualify gets the email but no call.
// Top budget band ($2,500+ a month, 23 Nov 2026): never auto-sent or auto-declined; the reply is held as a draft and
// the alert says HIGH BUDGET - check by hand (see websiteOfferCopy.ts).

import { getServiceSupabase } from "@/lib/supabase";
import { alertHeath, createDraft, getGmail, sendNow } from "./deliver";
import type { InstantLeadForm } from "./form";
import type { GuideQualifier } from "./guide";
import { getMode } from "./run";
import { HIGH_BUDGET_FLAG, isHighBudget, websiteOfferAlert, websiteOfferAutoSend, websiteOfferMessages } from "./websiteOfferCopy";

export { WEBSITE_OFFER_SUBJECT, WEBSITE_OFFER_URL, isHighBudget, websiteOfferMessages } from "./websiteOfferCopy";

export async function processWebsiteOfferLead(id: string, utm: { source: string | null; campaign: string | null; ad: string | null }, qual: GuideQualifier) {
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
    const autoSend = websiteOfferAutoSend(mode, qual);
    if (autoSend) {
      const s = await sendNow(ctx, form.email, subject, email);
      await touch({ status: "sent", mode, sent_at: now, recommended_plan: "Website offer", email_subject: subject, email_body: email, gmail_message_id: s.messageId, gmail_thread_id: s.threadId });
    } else {
      const d = await createDraft(ctx, form.email, subject, email);
      await touch({ status: "drafted", mode, recommended_plan: "Website offer", email_subject: subject, email_body: email, gmail_draft_id: d.draftId, gmail_message_id: d.messageId, gmail_thread_id: d.threadId });
    }
    if (row.lead_id) await db.from("leads").update({ instant_flow: true, last_contacted: autoSend ? now : undefined, updated_at: now }).eq("id", row.lead_id);
    const sent = autoSend ? "Reply emailed" : "Reply is in Drafts";
    await alertHeath(websiteOfferAlert(qual, who, callLine, sent), ctx).catch((err) => console.error("[website-offer] alert failed", err));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[website-offer] send failed", id, message);
    await touch({ status: "failed", error: message.slice(0, 1000) });
    await alertHeath(`${isHighBudget(qual.budget) ? `${HIGH_BUDGET_FLAG}: ` : ""}Website offer lead, the email FAILED so reply by hand: ${who}. ${callLine}.`).catch(() => null);
  }
}
