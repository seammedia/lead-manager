import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { leadSmsEngine } from "@/lib/leadSms";
import { SECRET_HEADER } from "@/lib/leadSms/line";

// Lead texting events from TendCall (16 November 2026): Twilio delivery status and price, inbound texts
// and calls to the Seam lead line. Header x-seam-lead-line-secret: SEAM_LEAD_LINE_SECRET.
// Responds with { matched, alert } (the text TendCall sends Heath) or { matched, label } for calls.

function authorised(request: NextRequest) {
  const secret = process.env.SEAM_LEAD_LINE_SECRET;
  const given = request.headers.get(SECRET_HEADER) ?? "";
  if (!secret || !given) return false;
  const a = Buffer.from(secret), b = Buffer.from(given);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: NextRequest) {
  if (!authorised(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => null);
  if (!body || typeof body.type !== "string") return NextResponse.json({ error: "Bad request" }, { status: 400 });
  try {
    return NextResponse.json(await leadSmsEngine().handleEvent(body));
  } catch (err) {
    console.error("[lead-sms] event failed", body.type, err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Event failed" }, { status: 500 });
  }
}
