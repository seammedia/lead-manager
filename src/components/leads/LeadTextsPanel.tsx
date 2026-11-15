"use client";

// Lead texting panel (16 November 2026): the lead's text state, every event (sent, delivered, failed,
// clicked, replied, opted out, booked, cold) and the actions Heath needs.

import { useCallback, useEffect, useState } from "react";
import { Loader2, Smartphone } from "lucide-react";

interface SmsEvent { id: string; type: string; created_at: string; body: string | null; detail: Record<string, unknown> | null; price: number | null; price_unit: string | null }
interface SmsLeadState {
  sms_allowed: boolean; sms_state: string | null; sms_phone: string | null; sms_count: number; sms_due_at: string | null;
  sms_delivery: string | null; sms_skip_reason: string | null; budget_monthly_min: number | null; dont_call: boolean;
}

const STATE_LABEL: Record<string, string> = {
  queued: "Queued", sent: "Texted, waiting", replied: "Replied", booked: "Booked", opted_out: "Opted out",
  cold: "Cold", stopped: "Stopped", skipped: "Not texted", failed: "Text failed",
};
const EVENT_LABEL: Record<string, string> = {
  queued: "Queued", skipped: "Skipped", sent: "Text sent", delivered: "Delivered", failed: "Failed", clicked: "Clicked booking link",
  replied: "Replied", opted_out: "Opted out (STOP)", called: "Called the lead line", alert: "Alert to Heath", booked: "Booked", cold: "Marked cold", stopped: "Stopped",
};
const STATE_COLOUR: Record<string, string> = {
  replied: "bg-green-100 text-green-800", booked: "bg-green-100 text-green-800", opted_out: "bg-red-100 text-red-800",
  failed: "bg-red-100 text-red-800", cold: "bg-gray-200 text-gray-700", sent: "bg-blue-100 text-blue-800", queued: "bg-amber-100 text-amber-800",
};

const when = (iso: string) => new Date(iso).toLocaleString("en-AU", { timeZone: "Australia/Melbourne", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

export function LeadTextsPanel({ leadId }: { leadId: string }) {
  const [data, setData] = useState<{ mode: string; lead: SmsLeadState; events: SmsEvent[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/leads/${leadId}/sms`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Couldn't load texts");
      setData(json);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [leadId]);

  useEffect(() => { load(); }, [load]);

  const act = async (action: "allow" | "booked" | "stop", confirmText: string) => {
    if (!window.confirm(confirmText)) return;
    setBusy(action);
    setNotice(null);
    try {
      const res = await fetch(`/api/leads/${leadId}/sms`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) });
      const json = await res.json();
      if (json.reason) setNotice(json.reason);
      else if (json.sent?.sent) setNotice("Text sent.");
      else if (json.due) setNotice(`Queued for ${when(json.due)}.`);
      await load();
    } finally {
      setBusy(null);
    }
  };

  if (error) return <div className="p-4 border-b border-gray-200 bg-white text-xs text-gray-500">Texts: {error}</div>;
  if (!data) return <div className="p-4 border-b border-gray-200 bg-white"><Loader2 className="w-4 h-4 text-gray-400 animate-spin" /></div>;

  const { lead, events, mode } = data;
  const state = lead.sms_state;
  const cost = events.filter((e) => e.price !== null).reduce((sum, e) => sum + Number(e.price), 0);
  const unit = events.find((e) => e.price_unit)?.price_unit ?? "USD";
  const canAllow = mode !== "off" && (!state || state === "skipped") && lead.sms_count === 0;
  const active = state === "queued" || state === "sent";

  return (
    <div className="p-4 border-b border-gray-200 bg-white max-h-80 overflow-y-auto">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
          <Smartphone className="w-4 h-4" /> Texts
        </h3>
        <span className={`text-xs px-2 py-0.5 rounded-full ${STATE_COLOUR[state ?? ""] ?? "bg-gray-100 text-gray-600"}`}>
          {state ? STATE_LABEL[state] ?? state : "Not texted"}
        </span>
      </div>
      <p className="text-xs text-gray-500 mt-1">
        {lead.sms_count}/2 texts{lead.sms_delivery ? `, last ${lead.sms_delivery}` : ""}{cost ? `, ${unit} ${cost.toFixed(4)}` : ""}
        {lead.dont_call ? ", don't call" : ""}{lead.budget_monthly_min !== null ? `, budget from $${lead.budget_monthly_min}` : ""}
        {state === "queued" && lead.sms_due_at ? `, goes ${when(lead.sms_due_at)}` : ""}
        {state === "skipped" && lead.sms_skip_reason ? ` (${lead.sms_skip_reason})` : ""}
        {mode === "off" ? ". Lead texting is off." : mode === "test" ? ". Test mode." : ""}
      </p>

      {events.length > 0 && (
        <ul className="mt-2 space-y-1">
          {events.map((e) => (
            <li key={e.id} className="text-xs text-gray-700">
              <span className="text-gray-400">{when(e.created_at)}</span> {EVENT_LABEL[e.type] ?? e.type}
              {e.body && ["sent", "replied", "opted_out"].includes(e.type) ? <span className="block text-gray-500 pl-2">&quot;{e.body}&quot;</span> : null}
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap gap-2 mt-3">
        {canAllow && (
          <button type="button" disabled={!!busy} onClick={() => act("allow", "Send this lead the instant text from the Seam lead line?")} className="text-xs px-2 py-1 rounded bg-blue-600 text-white disabled:opacity-50">
            {busy === "allow" ? "Sending..." : "Send instant text"}
          </button>
        )}
        {state !== "booked" && lead.sms_count > 0 && (
          <button type="button" disabled={!!busy} onClick={() => act("booked", "Mark this lead as booked? Follow-up texts stop.")} className="text-xs px-2 py-1 rounded border border-gray-300 text-gray-700 disabled:opacity-50">
            Mark booked
          </button>
        )}
        {active && (
          <button type="button" disabled={!!busy} onClick={() => act("stop", "Stop all texts to this lead?")} className="text-xs px-2 py-1 rounded border border-gray-300 text-gray-700 disabled:opacity-50">
            Stop texts
          </button>
        )}
      </div>
      {notice && <p className="text-xs text-gray-500 mt-2">{notice}</p>}
    </div>
  );
}
