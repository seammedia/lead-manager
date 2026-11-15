import { NextRequest, NextResponse } from "next/server";
import { leadSmsEngine } from "@/lib/leadSms";

// The short booking link in lead texts: logs the click on the lead, then forwards to Heath's booking page
// (settings.lead_sms_booking_url). Link previews and bots are forwarded without counting.

export async function GET(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  let url = "https://www.seammedia.com.au/";
  try {
    url = (await leadSmsEngine().click(token, request.headers.get("user-agent"))).url;
  } catch (err) {
    console.error("[lead-sms] click failed", err instanceof Error ? err.message : err);
  }
  const res = NextResponse.redirect(url, 302);
  res.headers.set("Cache-Control", "no-store");
  res.headers.set("X-Robots-Tag", "noindex");
  return res;
}
