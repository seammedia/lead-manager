// Supabase implementation of the lead texting Store (service role, server side only)

import type { SupabaseClient } from "@supabase/supabase-js";
import type { EventType, SmsEvent, SmsLead, Store } from "./engine";
import { toMobile } from "./rules";

export const LEAD_COLS = "id, name, company, email, phone, notes, next_action, stage, archived, created_at, sms_allowed, sms_state, sms_kind, sms_phone, sms_token, sms_due_at, sms_count, sms_first_sent_at, sms_delivery, sms_clicked_at, sms_replied_at, sms_opted_out_at, sms_booked_at, sms_alerted_at, sms_cold_at, sms_skip_reason, budget_monthly_min, dont_call";

export function supabaseStore(db: SupabaseClient): Store {
  return {
    async getSetting(key) {
      const { data } = await db.from("settings").select("value").eq("key", key).maybeSingle();
      return data?.value ?? null;
    },
    async getLead(id) {
      const { data } = await db.from("leads").select(LEAD_COLS).eq("id", id).maybeSingle();
      return (data as SmsLead | null) ?? null;
    },
    async updateLead(id, patch, where) {
      let q = db.from("leads").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", id);
      for (const [k, v] of Object.entries(where ?? {})) q = v === null ? q.is(k, null) : q.eq(k, v as string | number | boolean);
      const { data, error } = await q.select("id");
      if (error) throw new Error(`lead update failed: ${error.message}`);
      return (data ?? []).length > 0;
    },
    async activeLeads() {
      const { data } = await db.from("leads").select(LEAD_COLS).in("sms_state", ["queued", "sent"]).order("created_at", { ascending: true }).limit(200);
      return (data as SmsLead[] | null) ?? [];
    },
    async leadByToken(token) {
      const { data } = await db.from("leads").select(LEAD_COLS).eq("sms_token", token).maybeSingle();
      return (data as SmsLead | null) ?? null;
    },
    async leadsByMobile(e164) {
      const { data: direct } = await db.from("leads").select(LEAD_COLS).eq("sms_phone", e164).order("created_at", { ascending: false }).limit(10);
      // Leads never texted have only the number as typed in the form, so compare normalised numbers
      const { data: recent } = await db.from("leads").select(LEAD_COLS).not("phone", "is", null).order("created_at", { ascending: false }).limit(1000);
      const seen = new Set<string>();
      return [...((direct as SmsLead[] | null) ?? []), ...(((recent as SmsLead[] | null) ?? []).filter((l) => toMobile(l.phone) === e164))]
        .filter((l) => (seen.has(l.id) ? false : (seen.add(l.id), true)));
    },
    async emailReplyStatus(leadId) {
      const { data } = await db.from("lead_enrichments").select("status").eq("lead_id", leadId).order("created_at", { ascending: false }).limit(1);
      return (data?.[0]?.status as string | undefined) ?? null;
    },
    async insertEvent(e) {
      const { data, error } = await db.from("lead_sms_events").insert(e).select("*").single();
      if (error) throw new Error(`event insert failed: ${error.message}`);
      return data as SmsEvent;
    },
    async eventBySid(sid) {
      const { data } = await db.from("lead_sms_events").select("*").eq("twilio_sid", sid).in("type", ["sent", "alert"]).order("created_at", { ascending: true }).limit(1);
      return (data?.[0] as SmsEvent | undefined) ?? null;
    },
    async updateEvent(id, patch) {
      await db.from("lead_sms_events").update(patch).eq("id", id);
    },
    async lastEvent(leadId, type: EventType) {
      const { data } = await db.from("lead_sms_events").select("*").eq("lead_id", leadId).eq("type", type).order("created_at", { ascending: false }).limit(1);
      return (data?.[0] as SmsEvent | undefined) ?? null;
    },
    async eventsMissingPrice(olderThan, newerThan) {
      const { data } = await db.from("lead_sms_events").select("*").in("type", ["sent", "alert"]).not("twilio_sid", "is", null).is("price", null)
        .lte("created_at", olderThan.toISOString()).gte("created_at", newerThan.toISOString()).limit(50);
      return (data as SmsEvent[] | null) ?? [];
    },
    async isOptedOut(e164) {
      const { data } = await db.from("sms_optouts").select("phone").eq("phone", e164).maybeSingle();
      return Boolean(data);
    },
    async addOptOut(e164, leadId, source) {
      await db.from("sms_optouts").upsert({ phone: e164, lead_id: leadId, source }, { onConflict: "phone", ignoreDuplicates: true });
    },
  };
}
