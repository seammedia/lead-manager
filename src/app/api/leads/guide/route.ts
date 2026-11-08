import { NextRequest, NextResponse, after } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";
import { normaliseLeadPayload } from "@/lib/instant/form";
import { getGmail } from "@/lib/instant/deliver";
import { guideFollowUp, guideMessages, processGuideLead, sendGuideFollowUp } from "@/lib/instant/guide";
import { processSmartWebsiteLead, smartWebsiteMessages } from "@/lib/instant/smartWebsite";

// Lead magnet opt-in (5 November 2026)
// POST /api/leads/guide, called by /api/guide-lead on seammedia.com.au when someone asks for the free guide.
//
// Header: x-api-key: LEAD_INTAKE_KEY (required)
// Body: name, company, email, phone_number, and any utm_* values.
//       offer: "smart-website" (from /smart-website, 8 Nov 2026) sends the Smart Website reply instead of the guide,
//       with optional trade and website.
// Query: ?dry_run=1 returns the emails and text without saving or sending anything.
//        ?followup_test=<enrichment id> sends that row's follow-up now (test addresses only).
//
// Saves the lead, responds straight away, then sends the guide and alerts Heath. It uses a lead_enrichments
// row, so /api/cron/instant-replies handles replies and opt-outs as it does for instant lead emails.

export const maxDuration = 60;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: NextRequest) {
  const key = process.env.LEAD_INTAKE_KEY;
  if (!key || request.headers.get("x-api-key") !== key) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const testId = request.nextUrl.searchParams.get("followup_test");
  if (testId) {
    const { data: row } = await getServiceSupabase().from("lead_enrichments").select("id, form, facts, gmail_thread_id, gmail_message_id").eq("id", testId).single();
    if (!row || !String((row.form as { email?: string }).email).includes("+guide-test@")) {
      return NextResponse.json({ error: "Test addresses only" }, { status: 400 });
    }
    await sendGuideFollowUp(await getGmail(), row);
    return NextResponse.json({ ok: true });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body must be JSON" }, { status: 400 });
  }

  const smart = body.offer === "smart-website";
  const form = normaliseLeadPayload(body);
  if (!EMAIL_RE.test(form.email)) {
    return NextResponse.json({ error: "A valid email is required" }, { status: 400 });
  }
  const utm = {
    source: typeof body.utm_source === "string" ? body.utm_source : null,
    campaign: typeof body.utm_campaign === "string" ? body.utm_campaign : null,
    ad: typeof body.utm_content === "string" ? body.utm_content : null,
  };

  if (request.nextUrl.searchParams.get("dry_run") === "1") {
    return NextResponse.json(smart ? { form, utm, ...smartWebsiteMessages(form) } : { form, utm, ...guideMessages(form), followUp: guideFollowUp(form) });
  }

  const supabase = getServiceSupabase();
  const summary = [smart ? "Asked about the Smart Website ($99 a week)" : "Asked for the social media guide", utm.campaign && `Campaign: ${utm.campaign}`, utm.ad && `Ad: ${utm.ad}`].filter(Boolean).join(" | ");

  const { data: existing } = await supabase.from("leads").select("id, notes").eq("email", form.email).order("created_at", { ascending: false }).limit(1);
  let leadId = existing?.[0]?.id as string | undefined;
  if (!leadId) {
    const { data: lead, error } = await supabase
      .from("leads")
      .insert({
        name: form.name || "Unknown",
        email: form.email,
        company: form.company || "",
        phone: form.phone,
        stage: "contacted_1",
        source: "meta_ads",
        owner: "Heath",
        conversion_probability: 30,
        notes: summary,
        instant_flow: true,
        archived: false,
      })
      .select("id")
      .single();
    if (error || !lead) {
      console.error("[guide] lead insert failed", error);
      return NextResponse.json({ error: "Failed to save lead" }, { status: 500 });
    }
    leadId = lead.id;
  } else {
    const notes = (existing?.[0]?.notes as string | null | undefined) ?? "";
    await supabase.from("leads").update({ notes: notes ? `${notes} | ${summary}` : summary, instant_flow: true, updated_at: new Date().toISOString() }).eq("id", leadId);
  }

  // A double submit shouldn't send the guide twice
  const since = new Date(Date.now() - 30 * 60_000).toISOString();
  const { data: recent } = await supabase.from("lead_enrichments").select("id").eq("lead_id", leadId).gte("created_at", since).limit(1);
  if (recent?.length) {
    return NextResponse.json({ ok: true, duplicate: true, lead_id: leadId });
  }

  const { data: row, error: rowError } = await supabase.from("lead_enrichments").insert({ lead_id: leadId, form, status: "received" }).select("id").single();
  if (rowError || !row) {
    console.error("[guide] enrichment insert failed", rowError);
    return NextResponse.json({ error: "Failed to queue lead" }, { status: 500 });
  }

  after(async () => {
    if (smart) await processSmartWebsiteLead(row.id, utm).catch((err) => console.error("[guide] processSmartWebsiteLead crashed", err));
    else await processGuideLead(row.id, utm).catch((err) => console.error("[guide] processGuideLead crashed", err));
  });

  return NextResponse.json({ ok: true, lead_id: leadId }, { status: 202 });
}
