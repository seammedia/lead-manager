// Hard rules every instant email must pass before it can be drafted cleanly or sent automatically.
// Mirrors Heath's writing rules (no em dashes, Australian spelling, first person, plain text) and the
// playbook's accuracy rules (only checked facts, only live prices).

import type { Fact } from "./checks";
import type { ComposedEmail } from "./compose";
import type { InstantLeadForm } from "./form";
import { PACKAGES_URL, type LivePackage } from "./packages";

export interface ValidationResult {
  ok: boolean;
  errors: string[];
  wordCount: number;
}

const US_SPELLINGS = /\b(optimiz\w*|organiz\w*|prioritiz\w*|customiz\w*|recogniz\w*|maximiz\w*|minimiz\w*|analyz\w*|realiz\w*|specializ\w*|utiliz\w*|color\w*|favorite\w*|behavior\w*|center|centers|centered|inquir\w*)\b/gi;
const NOT_FIRST_PERSON = /\b(we|we're|we've|we'll|our|ours|us|my team|our team|agency)\b/gi;
const OFF_LIMITS = /\b(guarantee\w*|discount\w*|free trial|trial period|lock-?in|contract)\b/gi;

export function validateEmail(email: ComposedEmail, facts: Fact[], packages: LivePackage[] | null, form: InstantLeadForm, leadInVictoria = false): ValidationResult {
  const errors: string[] = [];
  const body = (email.body || "").replace(/\r\n/g, "\n").trim();
  const subject = (email.subject || "").trim();
  const all = `${subject}\n${body}`;

  if (!subject) errors.push("Subject is empty.");
  if (subject.length > 70) errors.push(`Subject is ${subject.length} characters; keep it under 60.`);
  if (/[\u2014\u2013]/.test(all)) errors.push("Contains an em dash or en dash. Use commas or full stops.");
  if (/\*\*|__|^#{1,6}\s|```/m.test(body)) errors.push("Contains markdown formatting. Plain text only.");
  if (/^[•*]\s/m.test(body)) errors.push('Bullets must start with "- ".');
  if (/[[\]{}<>]/.test(body)) errors.push("Contains a placeholder or bracket character.");
  if ((body.match(/!/g) || []).length > 1) errors.push("Too many exclamation marks.");
  if (/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(all)) errors.push("Contains emoji.");

  if (!body.endsWith("Thanks,\nHeath")) errors.push('Must end with exactly "Thanks," then "Heath" on the next line.');
  // Heath, 15 Oct 2026: always say the work is done by him here in Australia; "local" only for Victorian leads
  if (leadInVictoria) {
    if (!/\blocal\b/i.test(body) || !/Mornington Peninsula/.test(body)) errors.push('The lead is in Victoria: say I\'m local, based on the Mornington Peninsula, and that I do all the work myself, nothing offshored.');
  } else if (!/\bAustralia\b/.test(body)) errors.push("Say once that I do the work myself here in Australia, nothing offshored.");
  if (!leadInVictoria && /\b(I'm|I am) local\b|\blocal to you\b/i.test(body)) errors.push("Don't call me local: the lead isn't in Victoria (or their state is unknown). Keep the Australia line only.");
  if (!body.split("\n").some((l) => l.trim() === PACKAGES_URL)) errors.push(`The packages link ${PACKAGES_URL} must be on its own line.`);

  const us = [...new Set((all.match(US_SPELLINGS) || []).map((w) => w.toLowerCase()))];
  if (us.length) errors.push(`American spelling: ${us.join(", ")}. Use Australian spelling.`);
  const fp = [...new Set((body.match(NOT_FIRST_PERSON) || []).map((w) => w.toLowerCase()))];
  if (fp.length) errors.push(`Write in the first person as Heath. Remove: ${fp.join(", ")}.`);
  const off = [...new Set((body.match(OFF_LIMITS) || []).map((w) => w.toLowerCase()))];
  if (off.length) errors.push(`Don't mention: ${off.join(", ")}.`);

  // Prices must be live weekly prices from the packages page
  const allowed = new Set((packages ?? []).map((p) => p.weekly));
  for (const m of body.matchAll(/\$\s?([\d,]+(?:\.\d+)?)/g)) {
    const n = Number(m[1].replace(/,/g, ""));
    if (!allowed.has(n)) errors.push(`Price $${m[1]} isn't a live weekly price (${[...allowed].map((p) => `$${p}`).join(", ") || "none available"}).`);
  }

  // Facts used must exist and not be low confidence
  const byId = new Map(facts.map((f) => [f.id, f]));
  for (const id of email.facts_used || []) {
    const f = byId.get(id);
    if (!f) errors.push(`Fact ${id} doesn't exist.`);
    else if (f.confidence === "low") errors.push(`Fact ${id} is low confidence; don't use it.`);
  }

  // Never echo the lead's contact details back
  if (form.phone && body.includes(form.phone.replace(/^p:/, ""))) errors.push("Don't include the lead's phone number.");

  const beforeSignOff = body.replace(/Thanks,\nHeath$/, "");
  const wordCount = (beforeSignOff.match(/\S+/g) || []).length;
  if (wordCount < 40) errors.push(`Too short (${wordCount} words).`);
  if (wordCount > 200) errors.push(`Too long (${wordCount} words); keep it under 170.`);

  return { ok: errors.length === 0, errors, wordCount };
}
