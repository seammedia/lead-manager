// Wires the lead texting engine to Supabase, TendCall and Gmail for the app's routes.

import { getServiceSupabase } from "@/lib/supabase";
import { alertHeath as emailAlert, getGmail } from "@/lib/instant/deliver";
import { createEngine, type SmsLead } from "./engine";
import { httpLine } from "./line";
import { supabaseStore } from "./supabaseStore";

export const LINK_BASE = process.env.LEAD_SMS_LINK_BASE || "https://seam-media-lead-manager.vercel.app";

export function leadSmsEngine() {
  const db = getServiceSupabase();
  const store = supabaseStore(db);
  return createEngine({
    store,
    line: httpLine(),
    linkBase: LINK_BASE,
    bookingUrl: async () => {
      const v = await store.getSetting("lead_sms_booking_url");
      const url = (typeof v === "string" && v.trim()) || process.env.LEAD_SMS_BOOKING_URL || "";
      return /^https:\/\//.test(url) ? url : null;
    },
    bookingCheck: gmailBookingCheck,
    // When a text alert can't go (for example Twilio is out of credit), email Heath as the lead emails do
    fallbackAlert: (message) => emailAlert(message),
  });
}

// Google Calendar appointment schedules email the organiser when someone books. A notification from
// Google Calendar that names the lead's email after the first text counts as a booking. Unproven until
// the first real booking; the lead's "Booked" button covers anything it misses.
export async function gmailBookingCheck(lead: SmsLead): Promise<boolean> {
  if (!lead.email || !lead.sms_first_sent_at) return false;
  const ctx = await getGmail();
  const after = Math.floor(new Date(lead.sms_first_sent_at).getTime() / 1000) - 3600;
  const q = `from:(calendar-notification@google.com OR calendar-noreply@google.com) "${lead.email.replace(/"/g, "")}" after:${after}`;
  const list = await ctx.gmail.users.messages.list({ userId: "me", q, maxResults: 5 });
  for (const m of list.data.messages ?? []) {
    const meta = await ctx.gmail.users.messages.get({ userId: "me", id: m.id!, format: "metadata", metadataHeaders: ["Subject"] });
    const subject = meta.data.payload?.headers?.find((h) => h.name?.toLowerCase() === "subject")?.value ?? "";
    if (/appointment|booked|booking|invitation/i.test(subject) && !/cancel/i.test(subject)) return true;
  }
  return false;
}
