// Quick job reply wording and rules (pure, so `npm test` can load it). Sending lives in quickJob.ts.
// Leads from seammedia.com.au/quick-jobs (offer "quick-job", 25 Nov 2026): one-off work at a fixed price.
// Never mentions packages, month to month or any price other than the "from" price for the job they picked.
// The lead's own description is never echoed in the email (the form is public, and the email goes to whatever
// address was typed); it goes to Heath in the alert and the lead's notes.

import type { InstantLeadForm } from "./form";
import { businessPhrase, firstName } from "./leadName";
import { FINANCE_CHECK } from "./websiteOfferCopy";

export const QUICK_JOB_PLAN = "Quick job";
export const QUICK_JOB_SUBJECT = "Your job, and what happens next";

// Keep the jobs and prices in step with lib/quick-jobs.ts on seammedia.com.au. All + GST (Heath, 25 Nov 2026).
export const QUICK_JOBS: Record<string, { label: string; ask: string; from: string | null }> = {
  website: { label: "Website redesign", ask: "a website redesign", from: "Website redesigns start from $1,490 + GST." },
  shopify: { label: "Move to Shopify", ask: "a move to Shopify", from: "Moves to Shopify start from $1,490 + GST." },
  crm: { label: "CRM clean-up and follow-ups", ask: "a CRM clean-up and follow-ups", from: "CRM clean-ups and follow-ups start from $690 + GST." },
  small: { label: "Small job", ask: "a small job", from: "Small jobs start from $290 + GST." },
  other: { label: "Something else", ask: "a one-off job", from: null },
};

export interface QuickJob { job: string; label: string; budget: string | null; timing: string | null; link: string | null; details: string }

export function readQuickJob(body: Record<string, unknown>): QuickJob {
  // One line, no pipes: the lead's notes are split on "|"
  const str = (k: string, max: number) => (typeof body[k] === "string" ? (body[k] as string).replace(/\s+/g, " ").replace(/\|/g, "/").trim().slice(0, max) : "");
  const job = Object.hasOwn(QUICK_JOBS, str("job", 20)) ? str("job", 20) : "other";
  return { job, label: QUICK_JOBS[job].label, budget: str("budget", 60) || null, timing: str("timing", 60) || null, link: str("website", 200) || null, details: str("details", 1500) };
}

// Everything except "Under $300" qualifies ("Not sure" included). Worked out here too, not only on the website.
export const quickJobCallOk = (q: QuickJob) => !/^under \$?300\b/i.test(q.budget ?? "");

// Seam doesn't take finance or mortgage brokers, and the form doesn't ask for an industry. Checked against the
// business name, email domain and link only, so "our finance page is broken" doesn't trip it.
export function looksLikeFinanceBroker(form: Pick<InstantLeadForm, "company" | "emailDomain" | "website">, q: QuickJob) {
  const host = (s: string | null) => (s ?? "").replace(/^https?:\/\//i, "").split("/")[0];
  const haystack = [form.company, form.emailDomain ?? "", host(form.website), host(q.link)].join(" ");
  return /mortgage|financ(e|ial)|home ?loans?|lending|\bloans?\b/i.test(haystack) || /\b(mortgage|finance|loan) broker/i.test(q.details);
}

export const FINANCE_FLAG = "POSSIBLE FINANCE OR MORTGAGE BROKER - check by hand";

// The reply only goes out without Heath in auto mode, and never to a possible finance broker
export const quickJobAutoSend = (mode: string, finance: boolean) => mode === "auto" && !finance;

export function quickJobMessages(form: InstantLeadForm, q: QuickJob) {
  const { ask, from } = QUICK_JOBS[q.job];
  const email = [
    `Hi ${firstName(form) || "there"},`,
    "",
    `Thanks for sending through your job. You asked about ${ask}${businessPhrase(form)}.`,
    "",
    "I'll take a look and reply within one business day, with a fixed price or a question if I need to know more.",
    "",
    ...(from ? [`${from} I'll confirm the final price before any work starts.`] : ["I'll confirm the price before any work starts."]),
    "",
    "If there's anything else that would help, like a link or a photo of the problem, just reply to this email.",
    "",
    "Thanks,",
    "Heath",
  ].join("\n");
  return { subject: QUICK_JOB_SUBJECT, email };
}

// Starts with "Quick job:", which is also how later follow-ups know to leave this lead alone (isQuickJobLead)
export function quickJobNote(q: QuickJob, finance: boolean) {
  return [
    `Quick job: ${q.label}`,
    finance && FINANCE_FLAG,
    !quickJobCallOk(q) && "DON'T CALL (budget under $300). Email only",
    q.budget && `Budget: ${q.budget}`,
    q.timing && `Timing: ${q.timing}`,
    q.link && `Link: ${q.link}`,
    q.details && `Details: ${q.details}`,
  ].filter(Boolean).join(" | ");
}

export function quickJobNextAction(q: QuickJob, finance: boolean): string | null {
  if (finance) return `${FINANCE_FLAG}. ${FINANCE_CHECK} The reply is held as a Gmail draft, not sent.`;
  return quickJobCallOk(q) ? "Reply with a fixed price or a question within one business day." : "Don't call: budget under $300. Email only, reply with a fixed price or a question within one business day.";
}

// The guide follow-up (48 h) and the lead texts must never go to someone who asked for a one-off job
export const isQuickJobLead = (notes: string | null | undefined) => /(^|\| )Quick job: /.test(notes ?? "");

// Details go last: text alerts are cut at 600 characters, and the full details are on the lead
export function quickJobAlert(q: QuickJob, form: InstantLeadForm, ad: string | null, sent: string, finance: boolean) {
  const head = finance ? `${FINANCE_FLAG}: quick job lead` : `Quick job lead, ${quickJobCallOk(q) ? "price it" : "email only, DON'T CALL"}`;
  const bits = [
    q.label, q.budget && `Budget: ${q.budget}`, q.timing && `Timing: ${q.timing}`,
    form.phone ?? "no number", form.email, q.link && `Link: ${q.link}`, ad && `Ad: ${ad}`,
  ].filter(Boolean).join(" | ");
  return `${head}: ${[form.name, form.company].filter(Boolean).join(", ")}. ${bits}. ${sent}. ${FINANCE_CHECK}${q.details ? ` Details: ${q.details}` : ""}`;
}
