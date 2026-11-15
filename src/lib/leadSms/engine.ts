// Lead texting engine (16 November 2026). Works against two small interfaces so the whole flow can be
// tested without Supabase or Twilio: Store (the database) and Line (TendCall's /api/seam-lead-line,
// which holds the Twilio account and the Seam lead line, +61 468 171 514).
//
// Flow per lead: queued -> sent (first text, 8 am to 8 pm Melbourne) -> day 1 "call this lead" alert to
// Heath (budget $500+ a month, weekdays 9 to 5) -> day 3 final text -> cold. A reply, booking, opt-out,
// call back, email reply or stage change stops it. Never more than 2 texts per lead.

import {
  ALERT_AFTER_MS, ALERT_MIN_BUDGET, FINAL_AFTER_MS, MAX_TEXTS_PER_LEAD, budgetText, displayMobile, finalText,
  firstName, firstText, guideKind, inBusinessHours, inSendWindow, isBot, isDontCall, isOptOutText, melbourneLabel,
  melbourneMonth, newToken, nextSendTime, parseBudgetMin, parseMode, toMobile, type SmsMode,
} from "./rules";

export type SmsState = "queued" | "sent" | "replied" | "booked" | "opted_out" | "cold" | "stopped" | "skipped" | "failed";

export interface SmsLead {
  id: string;
  name: string | null;
  company: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
  next_action: string | null;
  stage: string;
  archived: boolean | null;
  created_at: string;
  sms_allowed: boolean;
  sms_state: SmsState | null;
  sms_kind: string | null;
  sms_phone: string | null;
  sms_token: string | null;
  sms_due_at: string | null;
  sms_count: number;
  sms_first_sent_at: string | null;
  sms_delivery: string | null;
  sms_clicked_at: string | null;
  sms_replied_at: string | null;
  sms_opted_out_at: string | null;
  sms_booked_at: string | null;
  sms_alerted_at: string | null;
  sms_cold_at: string | null;
  sms_skip_reason: string | null;
  budget_monthly_min: number | null;
  dont_call: boolean;
}

export type EventType = "queued" | "skipped" | "sent" | "delivered" | "failed" | "clicked" | "replied" | "opted_out" | "called" | "alert" | "booked" | "cold" | "stopped";

export interface SmsEvent {
  id?: string;
  lead_id: string | null;
  type: EventType;
  created_at?: string;
  twilio_sid?: string | null;
  body?: string | null;
  detail?: Record<string, unknown> | null;
  price?: number | null;
  price_unit?: string | null;
  segments?: number | null;
}

export interface Store {
  getSetting(key: string): Promise<unknown>;
  getLead(id: string): Promise<SmsLead | null>;
  // Applies the patch only when every `where` field still matches (optimistic lock). True if a row changed.
  updateLead(id: string, patch: Partial<SmsLead>, where?: Partial<SmsLead>): Promise<boolean>;
  activeLeads(): Promise<SmsLead[]>; // sms_state queued or sent
  leadByToken(token: string): Promise<SmsLead | null>;
  leadsByMobile(e164: string): Promise<SmsLead[]>; // newest first; matched on sms_phone, then on phone
  emailReplyStatus(leadId: string): Promise<string | null>; // latest lead_enrichments status
  insertEvent(e: SmsEvent): Promise<SmsEvent>;
  eventBySid(sid: string): Promise<SmsEvent | null>;
  updateEvent(id: string, patch: Partial<SmsEvent>): Promise<void>;
  lastEvent(leadId: string, type: EventType): Promise<SmsEvent | null>;
  eventsMissingPrice(olderThan: Date, newerThan: Date): Promise<SmsEvent[]>;
  isOptedOut(e164: string): Promise<boolean>;
  addOptOut(e164: string, leadId: string | null, source: string): Promise<void>;
}

export interface SendResult { sid: string; status: string }
export interface Line {
  // to: an AU mobile in E.164, or "owner" for Heath's own mobile (TendCall holds that number)
  send(to: string, body: string): Promise<SendResult>;
  prices(sids: string[]): Promise<Array<{ sid: string; price: number | null; price_unit: string | null; segments: number | null; status: string | null }>>;
  // Texts the lead line sent to anyone but Heath in the last `days` days (Twilio's message log)
  sentMessages(days: number): Promise<LineMessage[]>;
}

export interface LineMessage { sid: string; to: string; body: string; date_sent: string | null; status: string | null; price: number | null; price_unit: string | null; segments: number | null }

export interface Deps {
  store: Store;
  line: Line;
  now?: () => Date;
  linkBase: string; // e.g. https://seam-media-lead-manager.vercel.app
  bookingUrl?: () => Promise<string | null>;
  bookingCheck?: (lead: SmsLead) => Promise<boolean>; // Gmail "appointment booked" match
  fallbackAlert?: (message: string) => Promise<unknown>; // email to Heath when a text alert can't go
  random?: (n: number) => Uint8Array;
}

const DONE: SmsState[] = ["replied", "booked", "opted_out", "cold", "stopped", "skipped", "failed"];
const EMAIL_STOP = ["replied", "opted_out", "not_a_lead"];

export function createEngine(deps: Deps) {
  const { store, line } = deps;
  const now = deps.now ?? (() => new Date());
  const random = deps.random ?? ((n: number) => crypto.getRandomValues(new Uint8Array(n)));

  const mode = async (): Promise<SmsMode> => parseMode(await store.getSetting("lead_sms_mode"));
  const bookingUrl = async () => (deps.bookingUrl ? await deps.bookingUrl() : null);
  const label = (l: SmsLead) => [l.name, l.company].map((s) => (s ?? "").trim()).filter(Boolean).join(", ") || "a lead";
  const iso = (d: Date) => d.toISOString();

  async function alertHeath(leadId: string | null, message: string) {
    try {
      const r = await line.send("owner", message);
      await store.insertEvent({ lead_id: leadId, type: "alert", twilio_sid: r.sid, body: message });
      return true;
    } catch (err) {
      await store.insertEvent({ lead_id: leadId, type: "alert", body: message, detail: { error: errText(err), via: "email fallback" } });
      if (deps.fallbackAlert) await deps.fallbackAlert(message).catch(() => null);
      return false;
    }
  }

  // Why this lead should get no more texts, or null if it's fine to carry on
  async function stopReason(l: SmsLead): Promise<string | null> {
    if (l.sms_state && DONE.includes(l.sms_state)) return `state ${l.sms_state}`;
    if (l.archived) return "lead archived";
    if (l.stage !== "contacted_1") return `stage changed to ${l.stage}`;
    if (l.sms_replied_at || l.sms_booked_at || l.sms_opted_out_at) return "replied, booked or opted out";
    const email = await store.emailReplyStatus(l.id);
    if (email && EMAIL_STOP.includes(email)) return `email ${email}`;
    if (l.sms_phone && (await store.isOptedOut(l.sms_phone))) return "number opted out";
    return null;
  }

  // Puts a lead in the queue. New guide leads in live mode; in test mode only leads Heath allowed.
  async function queueLead(leadId: string, opts: { allow?: boolean } = {}) {
    const m = await mode();
    // Checked first, so nothing touches the lead (or the new columns) while texting is off
    if (m === "off") return { ok: false, reason: "lead texting is off (settings.lead_sms_mode)" };
    if (opts.allow) await store.updateLead(leadId, { sms_allowed: true });
    const l = await store.getLead(leadId);
    if (!l) return { ok: false, reason: "lead not found" };
    if (m === "test" && !l.sms_allowed) return { ok: false, reason: "test mode: lead not allowed" };
    if (l.sms_state) return { ok: false, reason: `already ${l.sms_state}` };

    const skip = async (reason: string) => {
      await store.updateLead(l.id, { sms_state: "skipped", sms_skip_reason: reason });
      await store.insertEvent({ lead_id: l.id, type: "skipped", detail: { reason } });
      return { ok: false, reason };
    };
    const kind = guideKind(l.notes);
    if (!kind) return skip("not a guide lead");
    const mobile = toMobile(l.phone);
    if (!mobile) return skip("no Australian mobile number");
    if (await store.isOptedOut(mobile)) return skip("number opted out");
    // Someone already texted on another lead record (a second sign-up) isn't texted again
    const others = (await store.leadsByMobile(mobile)).filter((o) => o.id !== l.id && o.sms_count > 0);
    if (others.length) return skip("number already texted on another lead");

    const due = nextSendTime(now());
    await store.updateLead(l.id, {
      sms_state: "queued", sms_kind: kind, sms_phone: mobile, sms_token: await uniqueToken(), sms_due_at: iso(due),
      budget_monthly_min: parseBudgetMin(budgetText(l.notes)), dont_call: isDontCall(l), sms_skip_reason: null,
    }, { sms_state: null });
    await store.insertEvent({ lead_id: l.id, type: "queued", detail: { due: iso(due), mode: m } });
    const sent = due <= now() ? await sendText(l.id, "first") : null;
    return { ok: true, due: iso(due), sent };
  }

  async function uniqueToken() {
    for (let i = 0; i < 5; i++) {
      const t = newToken(random);
      if (!(await store.leadByToken(t))) return t;
    }
    return newToken(random, 10);
  }

  async function textFor(l: SmsLead, which: "first" | "final") {
    const url = await bookingUrl();
    const input = {
      first: firstName(l.name), kind: l.sms_kind === "website" ? "website" as const : "social" as const,
      dontCall: l.dont_call, link: url && l.sms_token ? `${deps.linkBase.replace(/\/$/, "")}/b/${l.sms_token}` : null,
    };
    return which === "first" ? firstText(input) : finalText(input);
  }

  // The one place a text to a lead is sent. Checks mode, window, stop reasons and the cap, then claims
  // the send with an optimistic lock on sms_count so two runs can never both send.
  async function sendText(leadId: string, which: "first" | "final") {
    const m = await mode();
    const l = await store.getLead(leadId);
    if (!l || !l.sms_phone) return { sent: false, reason: "no lead or number" };
    if (m === "off") return { sent: false, reason: "mode off" };
    if (m === "test" && !l.sms_allowed) return { sent: false, reason: "test mode: lead not allowed" };
    if (which === "final" && m !== "live") return { sent: false, reason: "follow-up texts only in live mode" };
    if (!inSendWindow(now())) return { sent: false, reason: "outside 8 am to 8 pm" };
    if (l.sms_count >= MAX_TEXTS_PER_LEAD) return { sent: false, reason: "2-text cap reached" };
    if (which === "first" && l.sms_count > 0) return { sent: false, reason: "first text already sent" };
    if (which === "final" && l.sms_count !== 1) return { sent: false, reason: "final text needs exactly one earlier text" };
    const reason = await stopReason({ ...l, sms_state: which === "first" && l.sms_state === "queued" ? null : l.sms_state });
    if (reason) return { sent: false, reason };

    const claimed = await store.updateLead(l.id, { sms_count: l.sms_count + 1 }, { sms_count: l.sms_count });
    if (!claimed) return { sent: false, reason: "another run is sending" };

    const body = await textFor(l, which);
    const t = now();
    try {
      const r = await line.send(l.sms_phone, body);
      await store.insertEvent({ lead_id: l.id, type: "sent", twilio_sid: r.sid, body, detail: { which } });
      if (which === "first") {
        await store.updateLead(l.id, { sms_state: "sent", sms_first_sent_at: iso(t), sms_delivery: r.status || "queued", sms_due_at: null });
      } else {
        await store.updateLead(l.id, { sms_state: "cold", sms_cold_at: iso(t), sms_delivery: r.status || "queued" });
        await store.insertEvent({ lead_id: l.id, type: "cold", detail: { after: "final text, no reply or booking" } });
      }
      return { sent: true, sid: r.sid, body };
    } catch (err) {
      // The count stays used: never risk a third text by retrying something that may have gone out
      await store.insertEvent({ lead_id: l.id, type: "failed", body, detail: { which, error: errText(err) } });
      await store.updateLead(l.id, { sms_state: "failed", sms_delivery: "failed" });
      await alertHeath(l.id, `Seam lead line: the ${which === "first" ? "instant" : "final"} text to ${label(l)} (${displayMobile(l.sms_phone)}) couldn't be sent: ${errText(err).slice(0, 120)}. It won't be retried.`);
      return { sent: false, reason: `send failed: ${errText(err)}` };
    }
  }

  // Every 10 minutes (Vercel cron): due first texts, booking checks, day 1 alerts, day 3 texts, prices
  async function runDue() {
    const t = now();
    const m = await mode();
    const out = { mode: m, firstSent: 0, alerts: 0, finalSent: 0, booked: 0, stopped: 0, pricesUpdated: 0, notes: [] as string[] };
    out.pricesUpdated = await backfillPrices().catch((e) => { out.notes.push(`prices: ${errText(e)}`); return 0; });
    if (m === "off") return out;

    for (const lead of await store.activeLeads()) {
      if (m === "test" && !lead.sms_allowed) continue;
      try {
        if (lead.sms_state === "queued") {
          if (lead.sms_due_at && new Date(lead.sms_due_at) <= t) {
            const r = await sendText(lead.id, "first");
            if (r.sent) out.firstSent++;
            else if (!/outside 8 am/.test(r.reason ?? "")) out.notes.push(`${lead.id}: ${r.reason}`);
          }
          continue;
        }
        // sent: one text out, waiting on them
        const reason = await stopReason({ ...lead, sms_state: null });
        if (reason) {
          await store.updateLead(lead.id, { sms_state: "stopped" }, { sms_state: "sent" });
          await store.insertEvent({ lead_id: lead.id, type: "stopped", detail: { reason } });
          out.stopped++;
          continue;
        }
        if (deps.bookingCheck && (await deps.bookingCheck(lead).catch(() => false))) {
          await markBooked(lead.id, "gmail");
          out.booked++;
          continue;
        }
        const first = lead.sms_first_sent_at ? new Date(lead.sms_first_sent_at) : null;
        if (!first) continue;
        const age = t.getTime() - first.getTime();
        if (!lead.sms_alerted_at && !lead.dont_call && (lead.budget_monthly_min ?? 0) >= ALERT_MIN_BUDGET && age >= ALERT_AFTER_MS && inBusinessHours(t)) {
          const claimed = await store.updateLead(lead.id, { sms_alerted_at: iso(t) }, { sms_alerted_at: null });
          if (claimed) {
            const budget = budgetText(lead.notes);
            await alertHeath(lead.id, `Seam lead line: call ${label(lead)} today, ${displayMobile(lead.sms_phone)}. Guide lead${budget ? `, budget ${budget}` : ""}. No reply or booking since the text ${melbourneLabel(first)}.`);
            out.alerts++;
          }
        }
        if (age >= FINAL_AFTER_MS && m === "live") {
          const r = await sendText(lead.id, "final");
          if (r.sent) out.finalSent++;
        }
      } catch (err) {
        out.notes.push(`${lead.id}: ${errText(err)}`);
      }
    }
    return out;
  }

  async function backfillPrices() {
    const t = now();
    const rows = await store.eventsMissingPrice(new Date(t.getTime() - 10 * 60_000), new Date(t.getTime() - 7 * 86_400_000));
    const sids = rows.map((r) => r.twilio_sid).filter((s): s is string => Boolean(s)).slice(0, 50);
    if (!sids.length) return 0;
    let n = 0;
    for (const p of await line.prices(sids)) {
      if (p.price === null) continue;
      const row = rows.find((r) => r.twilio_sid === p.sid);
      if (row?.id) {
        await store.updateEvent(row.id, { price: Math.abs(p.price), price_unit: p.price_unit, segments: p.segments });
        n++;
      }
    }
    return n;
  }

  async function markBooked(leadId: string, via: "gmail" | "manual") {
    const t = iso(now());
    await store.updateLead(leadId, { sms_state: "booked", sms_booked_at: t, sms_due_at: null });
    await store.insertEvent({ lead_id: leadId, type: "booked", detail: { via } });
  }

  async function stopTexts(leadId: string) {
    await store.updateLead(leadId, { sms_state: "stopped", sms_due_at: null });
    await store.insertEvent({ lead_id: leadId, type: "stopped", detail: { reason: "stopped by Heath" } });
  }

  async function matchLead(from: string) {
    const mobile = toMobile(from);
    if (!mobile) return null;
    const leads = await store.leadsByMobile(mobile);
    return leads.find((l) => l.sms_count > 0) ?? leads[0] ?? null;
  }

  // Events from TendCall: Twilio delivery status, inbound texts and calls to the lead line.
  // Returns the alert TendCall should text Heath (null = TendCall sends its own generic one).
  async function handleEvent(e: { type: string; sid?: string; status?: string; error_code?: string | number | null; price?: number | string | null; price_unit?: string | null; segments?: number | string | null; from?: string; body?: string }) {
    if (e.type === "status" && e.sid) {
      const ev = await store.eventBySid(e.sid);
      if (!ev) return { matched: false, alert: null };
      if (e.price !== undefined && e.price !== null && e.price !== "") {
        await store.updateEvent(ev.id!, { price: Math.abs(Number(e.price)), price_unit: e.price_unit ?? null, segments: e.segments ? Number(e.segments) : null });
      }
      if (ev.type !== "sent" || !ev.lead_id) return { matched: true, alert: null };
      const l = await store.getLead(ev.lead_id);
      if (!l) return { matched: true, alert: null };
      const terminal = ["delivered", "undelivered", "failed"];
      if (e.status && !(terminal.includes(l.sms_delivery ?? "") && !terminal.includes(e.status))) {
        await store.updateLead(l.id, { sms_delivery: e.status });
      }
      if (e.status === "delivered") {
        await store.insertEvent({ lead_id: l.id, type: "delivered", twilio_sid: e.sid });
      } else if (e.status === "undelivered" || e.status === "failed") {
        await store.insertEvent({ lead_id: l.id, type: "failed", twilio_sid: e.sid, detail: { status: e.status, error_code: e.error_code ?? null } });
        return { matched: true, alert: `Seam lead line: the text to ${label(l)} (${displayMobile(l.sms_phone)}) didn't deliver (Twilio ${e.error_code ?? e.status}). Email or call them instead.` };
      }
      return { matched: true, alert: null };
    }

    if (e.type === "inbound" && e.from) {
      const l = await matchLead(e.from);
      const mobile = toMobile(e.from);
      const body = String(e.body ?? "").slice(0, 1600);
      if (isOptOutText(body)) {
        if (mobile) await store.addOptOut(mobile, l?.id ?? null, "sms");
        if (!l) return { matched: false, alert: null };
        await store.updateLead(l.id, { sms_state: "opted_out", sms_opted_out_at: iso(now()), sms_due_at: null });
        await store.insertEvent({ lead_id: l.id, type: "opted_out", body });
        return { matched: true, alert: `Seam lead line: ${label(l)} (${displayMobile(mobile)}) replied STOP. Opted out and recorded, no more texts will go to them.` };
      }
      if (!l) return { matched: false, alert: null };
      const keepBooked = l.sms_state === "booked" || l.sms_state === "opted_out";
      await store.updateLead(l.id, { ...(keepBooked ? {} : { sms_state: "replied" as SmsState }), sms_replied_at: l.sms_replied_at ?? iso(now()), sms_due_at: null });
      await store.insertEvent({ lead_id: l.id, type: "replied", body });
      const text = body.replace(/\s+/g, " ").trim();
      return { matched: true, alert: `Seam lead line: reply from ${label(l)} (${displayMobile(mobile)}):\n"${text.length > 400 ? `${text.slice(0, 400)}...` : text}"` };
    }

    if (e.type === "call" && e.from) {
      const l = await matchLead(e.from);
      if (!l) return { matched: false, label: null };
      if (l.sms_count > 0 && !["booked", "opted_out"].includes(l.sms_state ?? "")) {
        await store.updateLead(l.id, { sms_state: "replied", sms_replied_at: l.sms_replied_at ?? iso(now()), sms_due_at: null });
      }
      await store.insertEvent({ lead_id: l.id, type: "called" });
      return { matched: true, label: label(l) };
    }
    return { matched: false, alert: null };
  }

  // The short booking link: log a click (people, not link previews), then send them to the booking page
  async function click(token: string, userAgent: string | null) {
    const url = (await bookingUrl()) || "https://www.seammedia.com.au/";
    const l = /^[A-Za-z0-9]{6,12}$/.test(token) ? await store.leadByToken(token) : null;
    if (!l || isBot(userAgent)) return { url, counted: false };
    const last = await store.lastEvent(l.id, "clicked");
    if (!last?.created_at || now().getTime() - new Date(last.created_at).getTime() > 10 * 60_000) {
      await store.insertEvent({ lead_id: l.id, type: "clicked", detail: { ua: String(userAgent).slice(0, 160) } });
    }
    if (!l.sms_clicked_at) await store.updateLead(l.id, { sms_clicked_at: iso(now()) });
    return { url, counted: true };
  }

  // Texts sent from the lead line outside this flow (for example by hand in the Twilio console) are
  // matched to leads by number from Twilio's message log and recorded, so they count toward the 2-text
  // cap and replies match. Nothing is sent. Matched leads are allowed, so test mode tracks them.
  async function backfillFromLine(days = 14) {
    const out = { checked: 0, recorded: 0, unmatched: 0, already: 0 };
    const msgs = (await line.sentMessages(days)).sort((a, b) => String(a.date_sent).localeCompare(String(b.date_sent)));
    for (const msg of msgs) {
      out.checked++;
      if (await store.eventBySid(msg.sid)) { out.already++; continue; }
      const l = await matchLead(msg.to);
      if (!l) { out.unmatched++; continue; }
      const sentAt = msg.date_sent ? new Date(msg.date_sent) : now();
      await store.insertEvent({
        lead_id: l.id, type: "sent", twilio_sid: msg.sid, body: msg.body, created_at: iso(sentAt),
        price: msg.price === null ? null : Math.abs(msg.price), price_unit: msg.price_unit, segments: msg.segments,
        detail: { which: l.sms_count > 0 ? "final" : "first", backfilled: "Twilio message log" },
      });
      if (msg.status === "delivered") await store.insertEvent({ lead_id: l.id, type: "delivered", twilio_sid: msg.sid, created_at: iso(sentAt) });
      const mobile = toMobile(msg.to);
      const kind = guideKind(l.notes);
      await store.updateLead(l.id, {
        sms_allowed: true,
        sms_count: Math.min(MAX_TEXTS_PER_LEAD, l.sms_count + 1),
        sms_phone: l.sms_phone ?? mobile,
        sms_kind: l.sms_kind ?? kind ?? "social",
        sms_token: l.sms_token ?? (await uniqueToken()),
        sms_first_sent_at: l.sms_first_sent_at ?? iso(sentAt),
        sms_delivery: msg.status,
        sms_state: !l.sms_state || l.sms_state === "queued" || l.sms_state === "skipped" ? "sent" : l.sms_state,
        sms_due_at: null,
        budget_monthly_min: l.budget_monthly_min ?? parseBudgetMin(budgetText(l.notes)),
        dont_call: l.dont_call || isDontCall(l),
      });
      out.recorded++;
    }
    return out;
  }

  return { mode, queueLead, sendText, runDue, handleEvent, click, markBooked, stopTexts, backfillPrices, backfillFromLine, alertHeath };
}

function errText(err: unknown) {
  return err instanceof Error ? err.message : String(err);
}

// Monthly SMS cost of the lead texting (lead texts and the alerts this flow sends Heath), from Twilio's own prices
export function monthlyCost(events: Array<Pick<SmsEvent, "type" | "created_at" | "price" | "price_unit" | "segments">>) {
  const months = new Map<string, { month: string; leadTexts: number; alerts: number; segments: number; cost: Record<string, number>; unpriced: number }>();
  for (const e of events) {
    if ((e.type !== "sent" && e.type !== "alert") || !e.created_at) continue;
    const key = melbourneMonth(new Date(e.created_at));
    const m = months.get(key) ?? { month: key, leadTexts: 0, alerts: 0, segments: 0, cost: {}, unpriced: 0 };
    if (e.type === "sent") m.leadTexts++;
    else m.alerts++;
    m.segments += e.segments ?? 0;
    if (e.price === null || e.price === undefined) m.unpriced++;
    else {
      const unit = (e.price_unit || "USD").toUpperCase();
      m.cost[unit] = Math.round(((m.cost[unit] ?? 0) + Number(e.price)) * 100000) / 100000;
    }
    months.set(key, m);
  }
  return [...months.values()].sort((a, b) => b.month.localeCompare(a.month));
}
