// Names for the instant reply templates. No imports beyond types, so `npm test` can load it without Supabase or Gmail.

import type { InstantLeadForm } from "./form";

type NameFields = Pick<InstantLeadForm, "name" | "company">;

export function firstName(form: Pick<InstantLeadForm, "name">) {
  const n = form.name.trim().split(/\s+/)[0] ?? "";
  return n && !/[|&@\d]/.test(n) ? n.charAt(0).toUpperCase() + n.slice(1) : "";
}

const words = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}\s'-]/gu, " ").split(/\s+/).filter(Boolean);

// True when the business name field holds the lead's own name (23 Nov 2026: a lead typed her first name as the
// business, and the reply thanked her for asking "about a new website for <her name>"). Matches the first name,
// the full name or any part of it, case-insensitive.
export function businessIsPersonName(form: NameFields) {
  const business = words(form.company);
  const person = new Set(words(form.name));
  return business.length > 0 && person.size > 0 && business.every((w) => person.has(w));
}

// The business name to print in a reply, or "" when it's missing or is really the lead's own name
export function businessName(form: NameFields) {
  return businessIsPersonName(form) ? "" : form.company.trim();
}

// " for Acme Plumbing", " for your business" (the name field was a person's name) or "" (no business given)
export function businessPhrase(form: NameFields, prep = "for") {
  const business = businessName(form);
  if (business) return ` ${prep} ${business}`;
  return form.company.trim() ? ` ${prep} your business` : "";
}
