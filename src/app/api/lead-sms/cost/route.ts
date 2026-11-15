import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";
import { leadSmsEngine } from "@/lib/leadSms";
import { monthlyCost } from "@/lib/leadSms/engine";

// Lead texting cost by month (logged-in users only): lead texts and the alerts this flow sends Heath,
// at Twilio's own prices. POST { action: "sync" } records texts the lead line sent outside the flow
// (for example by hand in the Twilio console) from Twilio's message log, so they count toward the cap.

export async function GET() {
  const since = new Date(Date.now() - 400 * 86_400_000).toISOString();
  const { data, error } = await getServiceSupabase().from("lead_sms_events").select("type, created_at, price, price_unit, segments").in("type", ["sent", "alert"]).gte("created_at", since).limit(5000);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ months: monthlyCost(data ?? []) });
}

export async function POST(request: NextRequest) {
  const { action } = await request.json().catch(() => ({ action: null }));
  if (action !== "sync") return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  try {
    const engine = leadSmsEngine();
    const backfill = await engine.backfillFromLine(14);
    const prices = await engine.backfillPrices();
    return NextResponse.json({ ...backfill, pricesUpdated: prices });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
