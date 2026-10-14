// Runs the instant lead email for one stored lead: checks, live prices, Claude email, then a Gmail
// draft (or a send, in auto mode when the email is confident and clean) and a text to Heath.

import { getServiceSupabase } from "@/lib/supabase";
import { runChecks, type CheckResults } from "./checks";
import { composeEmail, type ComposeResult } from "./compose";
import { createDraft, getGmail, sendNow, alertHeath } from "./deliver";
import type { InstantLeadForm } from "./form";
import { fetchLivePackages, PACKAGES_URL, type LivePackage } from "./packages";

export type InstantMode = "draft" | "auto" | "off";

export interface PreparedEmail {
  checks: CheckResults;
  packages: LivePackage[] | null;
  packagesError: string | null;
  composed: ComposeResult;
  ms: number;
}

export async function getMode(): Promise<InstantMode> {
  const { data } = await getServiceSupabase().from("settings").select("value").eq("key", "instant_email_mode").maybeSingle();
  const v = (data?.value as string | undefined) ?? process.env.INSTANT_EMAIL_MODE ?? "draft";
  return v === "auto" || v === "off" ? v : "draft";
}

function melbourneToday() {
  return new Intl.DateTimeFormat("en-AU", { timeZone: "Australia/Melbourne", weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date());
}

export async function prepareEmail(form: InstantLeadForm): Promise<PreparedEmail> {
  const start = Date.now();
  const [checks, pkg] = await Promise.all([
    runChecks(form),
    fetchLivePackages().then((p) => ({ packages: p.packages, error: null as string | null })).catch((e) => ({ packages: null, error: e instanceof Error ? e.message : String(e) })),
  ]);
  const composed = await composeEmail(form, checks.facts, pkg.packages, melbourneToday(), checks.checks.gbp?.region ?? null);
  return { checks, packages: pkg.packages, packagesError: pkg.error, composed, ms: Date.now() - start };
}

// Auto mode only sends what needs no judgement call; everything else becomes a draft for Heath
export function autoSendBlockers(p: PreparedEmail): string[] {
  const e = p.composed.email;
  const blockers: string[] = [];
  if (!p.composed.validation.ok) blockers.push(`validation: ${p.composed.validation.errors[0]}`);
  if (!p.packages) blockers.push("live prices unavailable");
  if (e.confidence !== "high") blockers.push(`confidence ${e.confidence}`);
  if (e.fit !== "good") blockers.push(`fit ${e.fit}`);
  if (p.checks.facts.some((f) => f.area === "identity")) blockers.push("business identity unconfirmed");
  return blockers;
}

function firstNameGuess(form: InstantLeadForm) {
  const n = form.name.trim();
  if (!n || /[|&@\d]/.test(n) || n.split(/\s+/).length > 3) {
    const c = form.company.trim();
    return c && c.split(/\s+/).length <= 2 && !/[|&@\d]/.test(c) ? c.split(/\s+/)[0] : "";
  }
  return n.split(/\s+/)[0];
}

// Used when the checks or Claude fail, so the lead still gets a reply from Heath
export function fallbackEmail(form: InstantLeadForm) {
  const first = firstNameGuess(form);
  const business = form.businessCandidates[0] || "your business";
  const what = form.helpWith.includes("social_media") ? "social media" : form.helpWith.includes("website") ? "your website" : "marketing";
  return {
    subject: `Your enquiry about ${what}`,
    body: [
      `Hi ${first || "there"},`,
      "",
      `Thanks for reaching out about ${what} for ${business}.`,
      "",
      "I'm having a look at your Google profile, website and socials now, and I'll send through the first few things I'd focus on. I do all the work myself, here in Australia.",
      "",
      "In the meantime, here's what's included in each plan:",
      PACKAGES_URL,
      "",
      "What's the main thing you'd like more of at the moment?",
      "",
      "Thanks,",
      "Heath",
    ].join("\n"),
  };
}

export async function processEnrichment(id: string) {
  const db = getServiceSupabase();
  const touch = (patch: Record<string, unknown>) => db.from("lead_enrichments").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", id);
  const { data: row, error } = await db.from("lead_enrichments").select("id, lead_id, form").eq("id", id).single();
  if (error || !row) throw new Error(`Enrichment ${id} not found`);
  const form = row.form as InstantLeadForm;
  const business = form.businessCandidates[0] || form.company || form.name;
  const what = form.helpWithRaw ? form.helpWithRaw.replace(/_/g, " ") : form.helpWith.join(", ").replace(/_/g, " ");

  const mode = await getMode();
  if (mode === "off") {
    await touch({ status: "skipped", mode });
    return;
  }
  await touch({ status: "checking", mode });

  try {
    const p = await prepareEmail(form);
    const e = p.composed.email;
    const blockers = autoSendBlockers(p);
    const send = mode === "auto" && blockers.length === 0;
    const ctx = await getGmail();
    const now = new Date().toISOString();
    const common = {
      facts: { facts: p.checks.facts, checks: p.checks.checks, errors: p.checks.errors, packagesError: p.packagesError, autoSendBlockers: blockers },
      email_subject: e.subject,
      email_body: e.body,
      recommended_plan: e.recommended_plan,
      fit: e.fit,
      confidence: e.confidence,
      notes_for_heath: e.notes_for_heath,
      validation: p.composed.validation,
      cost_usd: Math.round(p.checks.costUsd * 10000) / 10000,
      timings: { totalMs: p.ms, checksMs: p.checks.timingsMs, claude: { model: p.composed.model, attempts: p.composed.attempts, usage: p.composed.usage } },
    };

    if (send) {
      const s = await sendNow(ctx, form.email, e.subject, e.body);
      await touch({ ...common, status: "sent", sent_at: now, gmail_message_id: s.messageId, gmail_thread_id: s.threadId });
      if (row.lead_id) await db.from("leads").update({ instant_flow: true, last_contacted: now, updated_at: now }).eq("id", row.lead_id);
      await alertHeath(`Sent to ${business} (wants ${what}): "${e.subject}". ${e.notes_for_heath}`).catch((err) => console.error("[instant] text failed", err));
    } else {
      const d = await createDraft(ctx, form.email, e.subject, e.body);
      await touch({ ...common, status: "drafted", gmail_draft_id: d.draftId, gmail_message_id: d.messageId, gmail_thread_id: d.threadId });
      if (row.lead_id) await db.from("leads").update({ instant_flow: true, updated_at: now }).eq("id", row.lead_id);
      const check = p.composed.validation.ok ? "" : ` CHECK before sending: ${p.composed.validation.errors[0]}`;
      await alertHeath(`New Meta lead: ${business} wants ${what}. Draft ready in Gmail: "${e.subject}". ${e.notes_for_heath}${check}`).catch((err) => console.error("[instant] text failed", err));
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[instant] run failed", id, message);
    await touch({ status: "failed", error: message.slice(0, 1000) });
    try {
      const fb = fallbackEmail(form);
      const ctx = await getGmail();
      const d = await createDraft(ctx, form.email, fb.subject, fb.body);
      await touch({ status: "drafted", email_subject: fb.subject, email_body: fb.body, gmail_draft_id: d.draftId, gmail_message_id: d.messageId, gmail_thread_id: d.threadId, error: `fallback draft: ${message}`.slice(0, 1000) });
      if (row.lead_id) await db.from("leads").update({ instant_flow: true }).eq("id", row.lead_id);
      await alertHeath(`New Meta lead: ${business} wants ${what}. The automatic check failed, so a plain draft is in Gmail. Add a finding before sending.`).catch(() => null);
    } catch (fallbackErr) {
      // Leave instant_flow false so the old 24-hour follow-up still covers this lead
      console.error("[instant] fallback draft failed", fallbackErr);
      await alertHeath(`New Meta lead: ${business} (${form.email}). The automatic email failed completely. Please reply by hand.`).catch(() => null);
    }
  }
}
