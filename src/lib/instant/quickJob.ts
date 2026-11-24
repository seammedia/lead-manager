// Quick jobs (25 Nov 2026): the odd-jobs Meta ads send people to seammedia.com.au/quick-jobs
// (via /api/leads/guide with offer "quick-job"). One-off work at a fixed price, so these leads get their own reply and
// alert, no guide, package or SMS follow-up. Wording and rules: quickJobCopy.ts.

import { getServiceSupabase } from "@/lib/supabase";
import { alertHeath, createDraft, getGmail, sendNow } from "./deliver";
import type { InstantLeadForm } from "./form";
import { QUICK_JOB_PLAN, looksLikeFinanceBroker, quickJobAlert, quickJobAutoSend, quickJobMessages, type QuickJob } from "./quickJobCopy";
import { getMode } from "./run";

export async function processQuickJobLead(id: string, utm: { ad: string | null }, q: QuickJob) {
  const db = getServiceSupabase();
  const touch = (patch: Record<string, unknown>) => db.from("lead_enrichments").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", id);
  const { data: row, error } = await db.from("lead_enrichments").select("id, lead_id, form").eq("id", id).single();
  if (error || !row) throw new Error(`Quick job lead ${id} not found`);
  const form = row.form as InstantLeadForm;
  const finance = looksLikeFinanceBroker(form, q);
  const { subject, email } = quickJobMessages(form, q);
  const now = new Date().toISOString();

  try {
    const mode = await getMode();
    const ctx = await getGmail();
    const autoSend = quickJobAutoSend(mode, finance);
    if (autoSend) {
      const s = await sendNow(ctx, form.email, subject, email);
      await touch({ status: "sent", mode, sent_at: now, recommended_plan: QUICK_JOB_PLAN, email_subject: subject, email_body: email, gmail_message_id: s.messageId, gmail_thread_id: s.threadId });
    } else {
      const d = await createDraft(ctx, form.email, subject, email);
      await touch({ status: "drafted", mode, recommended_plan: QUICK_JOB_PLAN, email_subject: subject, email_body: email, gmail_draft_id: d.draftId, gmail_message_id: d.messageId, gmail_thread_id: d.threadId });
    }
    if (row.lead_id) await db.from("leads").update({ instant_flow: true, last_contacted: autoSend ? now : undefined, updated_at: now }).eq("id", row.lead_id);
    const sent = autoSend ? "Reply emailed" : "Reply is in Drafts, not sent";
    await alertHeath(quickJobAlert(q, form, utm.ad, sent, finance), ctx).catch((err) => console.error("[quick-job] alert failed", err));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[quick-job] send failed", id, message);
    await touch({ status: "failed", error: message.slice(0, 1000) });
    await alertHeath(quickJobAlert(q, form, utm.ad, "The email FAILED so reply by hand", finance)).catch(() => null);
  }
}
