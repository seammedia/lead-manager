// Reading a lead's reply to an instant email.

// Unsubscribe, "remove me/my wife from your list", "stop emailing", "not interested", "wrong person"
export const OPT_OUT = /\bunsubscribe\b|\bremove (?:me|us|him|her|them|my \w+)\b[^.]{0,60}\b(?:list|contacts?|emails?|database|mailing)|\btake (?:me|us|him|her|them) off\b|\bstop (?:emailing|contacting|sending|messaging)\b|\b(?:do not|don'?t) (?:contact|email|call)\b|\b(?:not|no longer) interested\b|\bwrong (?:person|email|number)\b|\bdidn'?t (?:fill|sign up|enquire|request|ask)\b/i;

export type Part = { mimeType?: string | null; body?: { data?: string | null } | null; parts?: Part[] | null };
export function plainText(part: Part | undefined): string {
  if (!part) return "";
  if (part.mimeType === "text/plain" && part.body?.data) return Buffer.from(part.body.data, "base64url").toString("utf8");
  for (const p of part.parts ?? []) {
    const t = plainText(p);
    if (t) return t;
  }
  return "";
}
// The lead's own words, without the quoted email underneath
export function replyText(raw: string) {
  const cut = raw.split(/\r?\n[^\n]*\bOn .{0,200}wrote:|\r?\n-{2,} ?Original Message|\r?\nFrom: /)[0];
  return cut.split(/\r?\n/).filter((l) => !l.trim().startsWith(">")).join(" ");
}

export const isOptOut = (text: string) => OPT_OUT.test(text);
