import { NextRequest, NextResponse } from "next/server";
import { leadSmsEngine } from "@/lib/leadSms";

// Vercel Cron, every 10 minutes (vercel.json): queued first texts (8 am to 8 pm Melbourne), booking
// checks, day 1 alerts to Heath, day 3 final texts (live mode only) and Twilio price backfill.
// Does nothing but the price backfill while settings.lead_sms_mode is "off".

export const maxDuration = 120;

export async function GET(request: NextRequest) {
  if (request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    return NextResponse.json(await leadSmsEngine().runDue());
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
