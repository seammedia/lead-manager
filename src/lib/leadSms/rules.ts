// Lead texting rules (16 November 2026): pure functions only, no database or network, so they can be
// unit-tested with `npm test`. See README "Lead texting" for the whole flow.

export type SmsMode = "off" | "test" | "live";
export type GuideKind = "social" | "website";

export const MAX_TEXTS_PER_LEAD = 2;
export const SEND_START_HOUR = 8; // 8:00 am Melbourne
export const SEND_END_HOUR = 20; // 8:00 pm Melbourne
export const ALERT_AFTER_MS = 24 * 3_600_000; // day 1: one "call this lead" alert to Heath
export const FINAL_AFTER_MS = 72 * 3_600_000; // day 3: one final text, then Cold
export const ALERT_MIN_BUDGET = 500; // dollars a month
const TZ = "Australia/Melbourne";

export function parseMode(v: unknown): SmsMode {
  return v === "test" || v === "live" ? v : "off";
}

// Australian mobiles only: 04xx xxx xxx, 614xx..., +614xx... -> +614xxxxxxxx
export function toMobile(phone: string | null | undefined): string | null {
  const p = String(phone ?? "").replace(/[\s().-]/g, "");
  if (/^04\d{8}$/.test(p)) return `+61${p.slice(1)}`;
  if (/^\+?614\d{8}$/.test(p)) return `+${p.replace(/^\+/, "")}`;
  if (/^00614\d{8}$/.test(p)) return `+${p.slice(2)}`;
  return null;
}

// +61412345678 -> 0412 345 678
export function displayMobile(e164: string | null | undefined) {
  const m = String(e164 ?? "").match(/^\+61(4\d{2})(\d{3})(\d{3})$/);
  return m ? `0${m[1]} ${m[2]} ${m[3]}` : String(e164 ?? "");
}

// Twilio's standard opt-out words, plus a few plain-English ones
export function isOptOutText(body: string | null | undefined) {
  return /^\s*(stop|stopall|stop all|unsubscribe|cancel|end|quit|optout|opt out|opt-out|remove me|stop texting( me)?|no more texts?|don'?t text( me)?)\s*[.!]*\s*$/i.test(String(body ?? ""));
}

// ---------- Melbourne time ----------

function parts(date: Date) {
  const f = new Intl.DateTimeFormat("en-AU", {
    timeZone: TZ, year: "numeric", month: "numeric", day: "numeric", weekday: "short",
    hour: "numeric", minute: "numeric", hourCycle: "h23", timeZoneName: "longOffset",
  }).formatToParts(date);
  const get = (t: string) => f.find((p) => p.type === t)?.value ?? "";
  const off = get("timeZoneName").match(/GMT([+-])(\d{2}):?(\d{2})?/);
  const offsetMin = off ? (off[1] === "-" ? -1 : 1) * (Number(off[2]) * 60 + Number(off[3] ?? 0)) : 0;
  return { y: Number(get("year")), m: Number(get("month")), d: Number(get("day")), weekday: get("weekday"), hour: Number(get("hour")), minute: Number(get("minute")), offsetMin };
}

// The instant of hh:00 Melbourne time on the Melbourne calendar day of `date` plus `addDays`
function melbourneAt(date: Date, hour: number, addDays = 0) {
  const p = parts(date);
  const utcGuess = Date.UTC(p.y, p.m - 1, p.d + addDays, hour, 0) - p.offsetMin * 60_000;
  const real = parts(new Date(utcGuess)).offsetMin; // daylight saving may differ on the target day
  return new Date(Date.UTC(p.y, p.m - 1, p.d + addDays, hour, 0) - real * 60_000);
}

export function melbourneHour(date: Date) {
  const p = parts(date);
  return p.hour + p.minute / 60;
}

export function inSendWindow(date: Date) {
  const h = melbourneHour(date);
  return h >= SEND_START_HOUR && h < SEND_END_HOUR;
}

// Now if it's between 8 am and 8 pm Melbourne time, otherwise 8 am the next morning
export function nextSendTime(date: Date): Date {
  if (inSendWindow(date)) return date;
  return melbourneHour(date) < SEND_START_HOUR ? melbourneAt(date, SEND_START_HOUR) : melbourneAt(date, SEND_START_HOUR, 1);
}

// Heath's alerts: weekdays 9 am to 5 pm Melbourne time (the same hours as the guide follow-up email)
export function inBusinessHours(date: Date) {
  const p = parts(date);
  const h = p.hour + p.minute / 60;
  return !["Sat", "Sun"].includes(p.weekday) && h >= 9 && h < 17;
}

export function nextBusinessTime(date: Date): Date {
  if (inBusinessHours(date)) return date;
  for (let add = 0; add < 8; add++) {
    const t = melbourneAt(date, 9, add);
    if (t > date && inBusinessHours(t)) return t;
  }
  return date;
}

export function melbourneLabel(date: Date) {
  const f = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-AU", { timeZone: TZ, ...o }).format(date);
  return `${f({ hour: "numeric", minute: "2-digit", hour12: true }).replace(/\s/g, " ").toLowerCase()} ${f({ weekday: "short" })} ${f({ day: "numeric", month: "short" })}`;
}

export function melbourneMonth(date: Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit" }).format(date); // YYYY-MM
}

// ---------- Reading the lead record ----------

export interface LeadFacts {
  name: string | null;
  company: string | null;
  notes: string | null;
  next_action: string | null;
}

// "Budget: $500 to $1,000 a month" in the guide notes (lead manager 8b18da5, 10 Nov 2026)
export function budgetText(notes: string | null | undefined): string | null {
  const m = String(notes ?? "").match(/Budget:\s*([^|]+)/i);
  return m ? m[1].trim() : null;
}

export function parseBudgetMin(budget: string | null | undefined): number | null {
  const s = String(budget ?? "").toLowerCase();
  if (!s.trim()) return null;
  if (/under|less than|below|^\s*<|nothing|none|no budget|not sure|unsure/.test(s)) return 0;
  const n = s.match(/\$?\s*(\d[\d,]*)(\s*k\b)?/);
  if (!n) return null;
  const v = Number(n[1].replace(/,/g, ""));
  return n[2] ? v * 1000 : v;
}

export function guideKind(notes: string | null | undefined): GuideKind | null {
  const s = String(notes ?? "");
  if (/tradie website guide/i.test(s)) return "website";
  if (/social media guide/i.test(s)) return "social";
  return null;
}

// Guide opt-ins that said "just the guide" or "under $250 a month" (guide.ts qualifierNote / next_action)
export function isDontCall(lead: LeadFacts) {
  return /DON'?T CALL/i.test(lead.notes ?? "") || /^\s*don'?t call/i.test(lead.next_action ?? "");
}

export function firstName(name: string | null | undefined) {
  const w = String(name ?? "").trim().split(/\s+/)[0] ?? "";
  if (!w || !/^[A-Za-z][A-Za-z'-]{0,24}$/.test(w)) return "there";
  return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
}

// ---------- The two texts ----------
// Heath, 16 Nov 2026: each text must fit ONE segment (160 GSM characters) to keep Twilio spend down.
// Each text has variants from fullest to leanest; the first that fits wins. A long name falls back to
// "there", and if the booking link can't fit, the no-link wording is used (reply with a time).

export const SEGMENT_LIMIT = 160;

export interface TextInput {
  first: string;
  kind: GuideKind;
  dontCall: boolean;
  link: string | null; // the tracked booking link, or null when no booking page is set
}

const STOP = "Reply STOP to opt out";

type Variant = (name: string) => string;

// Preference order: the booking link (it books calls and tracks clicks), then their first name, then the
// fuller wording. Groups are tried in order; inside a group every variant is tried with the name first.
function pick(groups: Variant[][], first: string) {
  const names = first === "there" ? ["there"] : [first, "there"];
  for (const group of groups) {
    for (const name of names) {
      for (const v of group) {
        const t = v(name);
        if (t.length <= SEGMENT_LIMIT && isGsm(t)) return t;
      }
    }
  }
  throw new Error("no text variant fits one segment");
}

export function firstText({ first, kind, dontCall, link }: TextInput) {
  const topic = kind === "website" ? "website" : "ads";
  if (dontCall) {
    return pick([[
      (n) => `Hi ${n}, Heath from Seam Media. Thanks for grabbing the guide. Any questions about it, just reply to this text. ${STOP}`,
      (n) => `Hi ${n}, Heath from Seam Media. Thanks for grabbing the guide. Any questions, just reply. ${STOP}`,
    ]], first);
  }
  const withLink: Variant[] = link ? [
    (n) => `Hi ${n}, Heath from Seam Media. Thanks for grabbing the guide. Book a 15 min call about your ${topic}: ${link} or reply with a time. ${STOP}`,
    (n) => `Hi ${n}, Heath from Seam Media. Book a 15 min call about your ${topic}: ${link} or reply with a time. ${STOP}`,
    (n) => `Hi ${n}, Heath from Seam Media. Book a 15 min call: ${link} or reply with a time. ${STOP}`,
  ] : [];
  const noLink: Variant[] = [
    (n) => `Hi ${n}, Heath from Seam Media. Thanks for grabbing the guide. Happy to do a quick 15 min call about your ${topic}, just reply with a time. ${STOP}`,
    (n) => `Hi ${n}, Heath from Seam Media. Thanks for grabbing the guide. Keen for a 15 min call about your ${topic}? Reply with a time. ${STOP}`,
  ];
  return pick([withLink, noLink], first);
}

export function finalText({ first, dontCall, link }: TextInput) {
  if (dontCall) {
    return pick([[
      (n) => `Hi ${n}, Heath from Seam Media again. Hope the guide helped. Any questions, just reply here. I won't text again. ${STOP}`,
      (n) => `Hi ${n}, Heath from Seam Media again. Hope the guide helped. Any questions, just reply. ${STOP}`,
    ]], first);
  }
  const withLink: Variant[] = link ? [
    (n) => `Hi ${n}, Heath from Seam Media again. If a 15 min call would help, book here: ${link} If not, no worries. ${STOP}`,
    (n) => `Hi ${n}, Heath from Seam Media again. Keen on a 15 min call? ${link} If not, no worries. ${STOP}`,
  ] : [];
  const noLink: Variant[] = [
    (n) => `Hi ${n}, Heath from Seam Media again. If a quick 15 min call would help, just reply with a time. If not, no worries, I won't text again. ${STOP}`,
    (n) => `Hi ${n}, Heath from Seam Media again. If a 15 min call would help, reply with a time. If not, no worries. ${STOP}`,
  ];
  return pick([withLink, noLink], first);
}

// GSM-7 only, so a text is billed at 160 (or 153 when split) characters a segment, not 70
export function isGsm(text: string) {
  return /^[A-Za-z0-9 @£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ!"#¤%&'()*+,\-./:;<=>?¡ÄÖÑÜ§¿äöñüà^{}\\[~\]|€]*$/.test(text);
}

export function segments(text: string) {
  return text.length <= 160 ? 1 : Math.ceil(text.length / 153);
}

// ---------- Short links ----------

const ALPHABET = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export function newToken(random: (n: number) => Uint8Array, length = 7) {
  return Array.from(random(length), (b) => ALPHABET[b % ALPHABET.length]).join("");
}

// Link previews (Google Messages, iMessage, WhatsApp, social apps) and scanners fetch links without a
// person tapping them, so they aren't counted as clicks.
export function isBot(userAgent: string | null | undefined) {
  const ua = String(userAgent ?? "");
  return !ua || /bot|crawl|spider|preview|fetch|facebookexternalhit|whatsapp|telegram|slack|discord|skype|google-pagerenderer|googleother|bingpreview|headless|curl|wget|python|node|axios|go-http|java\/|okhttp|scanner|proofpoint|mimecast|barracuda/i.test(ua);
}
