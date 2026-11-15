"use client";

// Lead texting cost by month (16 November 2026), from Twilio's own prices for each lead text and each
// alert the flow sends Heath. "Sync from Twilio" records texts the lead line sent outside the flow.

import { useEffect, useState } from "react";

interface Month { month: string; leadTexts: number; alerts: number; segments: number; cost: Record<string, number>; unpriced: number }

export function LeadTextingCost() {
  const [months, setMonths] = useState<Month[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const load = async () => {
    try {
      const res = await fetch("/api/lead-sms/cost");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Couldn't load");
      setMonths(json.months);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };
  useEffect(() => { load(); }, []);

  const sync = async () => {
    setSyncing(true);
    try {
      const res = await fetch("/api/lead-sms/cost", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "sync" }) });
      const json = await res.json();
      setNotice(res.ok ? `Checked ${json.checked} texts: ${json.recorded} recorded, ${json.already} already logged, ${json.unmatched} not matched to a lead, ${json.pricesUpdated} prices updated.` : json.error);
      await load();
    } finally {
      setSyncing(false);
    }
  };

  const money = (cost: Record<string, number>) => Object.entries(cost).map(([u, v]) => `${u} ${v.toFixed(2)}`).join(" + ") || "-";

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-center justify-between gap-2 mb-3">
        <h3 className="text-base font-semibold text-gray-900">Lead texting cost</h3>
        <button type="button" onClick={sync} disabled={syncing} className="text-xs px-2 py-1 rounded border border-gray-300 text-gray-700 disabled:opacity-50">
          {syncing ? "Syncing..." : "Sync from Twilio"}
        </button>
      </div>
      {error ? <p className="text-sm text-gray-500">{error}</p> : !months ? <p className="text-sm text-gray-400">Loading...</p> : months.length === 0 ? (
        <p className="text-sm text-gray-500">No lead texts yet.</p>
      ) : (
        <table className="w-full text-sm">
          <thead><tr className="text-left text-gray-500"><th className="py-1">Month</th><th>Lead texts</th><th>Alerts to Heath</th><th>Segments</th><th>Twilio cost</th></tr></thead>
          <tbody>
            {months.map((m) => (
              <tr key={m.month} className="border-t border-gray-100">
                <td className="py-1">{m.month}</td><td>{m.leadTexts}</td><td>{m.alerts}</td><td>{m.segments}</td>
                <td>{money(m.cost)}{m.unpriced ? ` (${m.unpriced} not priced yet)` : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {notice && <p className="text-xs text-gray-500 mt-2">{notice}</p>}
    </div>
  );
}
