import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";
import { leadSmsEngine } from "@/lib/leadSms";
import { LEAD_COLS } from "@/lib/leadSms/supabaseStore";

// Lead texting panel in the lead modal (logged-in users only, via middleware).
// GET: the lead's text state and events. POST { action }: "allow" (text this lead; in test mode only
// allowed leads are texted), "booked" (mark booked, stops follow-ups) or "stop" (no more texts).

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getServiceSupabase();
  const [{ data: lead }, { data: events }, mode] = await Promise.all([
    db.from("leads").select(LEAD_COLS).eq("id", id).maybeSingle(),
    db.from("lead_sms_events").select("id, type, created_at, body, detail, price, price_unit, segments").eq("lead_id", id).order("created_at", { ascending: true }).limit(100),
    leadSmsEngine().mode(),
  ]);
  if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  return NextResponse.json({ mode, lead, events: events ?? [] });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { action } = await request.json().catch(() => ({ action: null }));
  const engine = leadSmsEngine();
  if (action === "allow") return NextResponse.json(await engine.queueLead(id, { allow: true }));
  if (action === "booked") { await engine.markBooked(id, "manual"); return NextResponse.json({ ok: true }); }
  if (action === "stop") { await engine.stopTexts(id); return NextResponse.json({ ok: true }); }
  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
