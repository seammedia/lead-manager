// In-memory Store and mocked Line for the lead texting tests (no Supabase, no TendCall, no Twilio)
import type { Line, LineMessage, SmsEvent, SmsLead, Store } from "../src/lib/leadSms/engine";
import { toMobile } from "../src/lib/leadSms/rules";

export function blankLead(over: Partial<SmsLead> & { id: string }): SmsLead {
  return {
    name: "Test Person", company: "Test Business", email: "test@example.com", phone: "0412 345 678",
    notes: "Asked for the social media guide | Industry: Health | Budget: $500 to $1,000 a month", next_action: null,
    stage: "contacted_1", archived: false, created_at: "2026-11-16T00:00:00Z", sms_allowed: false, sms_state: null, sms_kind: null,
    sms_phone: null, sms_token: null, sms_due_at: null, sms_count: 0, sms_first_sent_at: null, sms_delivery: null, sms_clicked_at: null,
    sms_replied_at: null, sms_opted_out_at: null, sms_booked_at: null, sms_alerted_at: null, sms_cold_at: null, sms_skip_reason: null,
    budget_monthly_min: null, dont_call: false, ...over,
  };
}

export function memoryStore(clock: () => Date) {
  const leads = new Map<string, SmsLead>();
  const events: SmsEvent[] = [];
  const optouts = new Set<string>();
  const settings: Record<string, unknown> = { lead_sms_mode: "off", lead_sms_booking_url: null };
  const emailStatus: Record<string, string> = {};
  let n = 0;
  const store: Store = {
    async getSetting(k) { return settings[k] ?? null; },
    async getLead(id) { const l = leads.get(id); return l ? { ...l } : null; },
    async updateLead(id, patch, where) {
      const l = leads.get(id);
      if (!l) return false;
      for (const [k, v] of Object.entries(where ?? {})) if ((l as unknown as Record<string, unknown>)[k] !== v) return false;
      leads.set(id, { ...l, ...patch });
      return true;
    },
    async activeLeads() { return [...leads.values()].filter((l) => l.sms_state === "queued" || l.sms_state === "sent").map((l) => ({ ...l })); },
    async leadByToken(t) { return [...leads.values()].find((l) => l.sms_token === t) ?? null; },
    async leadsByMobile(e164) {
      return [...leads.values()].filter((l) => l.sms_phone === e164 || toMobile(l.phone) === e164).sort((a, b) => b.created_at.localeCompare(a.created_at));
    },
    async emailReplyStatus(id) { return emailStatus[id] ?? null; },
    async insertEvent(e) { const row = { ...e, id: `ev${++n}`, created_at: e.created_at ?? clock().toISOString() }; events.push(row); return row; },
    async eventBySid(sid) { return events.find((e) => e.twilio_sid === sid && (e.type === "sent" || e.type === "alert")) ?? null; },
    async updateEvent(id, patch) { const e = events.find((x) => x.id === id); if (e) Object.assign(e, patch); },
    async lastEvent(id, type) { return [...events].reverse().find((e) => e.lead_id === id && e.type === type) ?? null; },
    async eventsMissingPrice(older, newer) {
      return events.filter((e) => (e.type === "sent" || e.type === "alert") && e.twilio_sid && (e.price === null || e.price === undefined) && new Date(e.created_at!) <= older && new Date(e.created_at!) >= newer);
    },
    async isOptedOut(p) { return optouts.has(p); },
    async addOptOut(p) { optouts.add(p); },
  };
  return { store, leads, events, optouts, settings, emailStatus };
}

// Mocked TendCall: records what would go to Twilio. "owner" is Heath (number held by TendCall, not here).
export function mockLine() {
  const sends: Array<{ to: string; body: string; sid: string }> = [];
  const state = { fail: false, logged: [] as LineMessage[], prices: {} as Record<string, number> };
  let n = 0;
  const line: Line = {
    async send(to, body) {
      if (state.fail) throw new Error("Twilio 401: account suspended");
      if (to !== "owner" && body.length > 160) throw new Error("lead texts must be 160 characters or fewer");
      const sid = `SM${String(++n).padStart(32, "0")}`;
      sends.push({ to, body, sid });
      return { sid, status: "queued" };
    },
    async prices(sids) { return sids.map((sid) => ({ sid, price: state.prices[sid] ?? null, price_unit: "USD", segments: 1, status: "delivered" })); },
    async sentMessages() { return state.logged; },
  };
  return { line, sends, state };
}
