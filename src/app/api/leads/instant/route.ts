import { NextRequest, NextResponse, after } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";
import { normaliseLeadPayload } from "@/lib/instant/form";
import { autoSendBlockers, prepareEmail, processEnrichment } from "@/lib/instant/run";

// Instant lead email webhook (13 October 2026)
// POST /api/leads/instant, called by Zapier when a Meta lead arrives.
//
// Header: x-api-key: LEAD_INTAKE_KEY (required)
// Body: the Meta lead with its form answers, either mapped fields or Zapier's raw lead
//   (full_name / first_name, email, phone_number, company_name, website, the "what would you most
//   like help with" and "trade or service" answers, ad_name, adset_name, campaign_name, platform).
// Query: ?dry_run=1 runs the checks and writes the email but saves, drafts and texts nothing.
//        ?previously_emailed=1 writes it as a follow-up (while the Zap still sends its standard email).
//
// Responds 202 straight away; the checks, email and text to Heath run after the response.

export const maxDuration = 300;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function readBody(request: NextRequest): Promise<Record<string, unknown>> {
  const type = request.headers.get("content-type") || "";
  if (type.includes("application/x-www-form-urlencoded") || type.includes("multipart/form-data")) {
    return Object.fromEntries((await request.formData()).entries()) as Record<string, unknown>;
  }
  const text = await request.text();
  return text ? JSON.parse(text) : {};
}

export async function POST(request: NextRequest) {
  const key = process.env.LEAD_INTAKE_KEY;
  if (!key || request.headers.get("x-api-key") !== key) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await readBody(request);
  } catch {
    return NextResponse.json({ error: "Body must be JSON or form data" }, { status: 400 });
  }

  const form = normaliseLeadPayload(body);
  // While Zapier still sends its standard email first, the Zap URL carries ?previously_emailed=1 so
  // this email reads as a follow-up (a URL flag lets Zapier's Data box stay empty and send every field)
  if (request.nextUrl.searchParams.get("previously_emailed") === "1") form.previouslyEmailed = true;
  if (!EMAIL_RE.test(form.email)) {
    return NextResponse.json({ error: "A valid email is required" }, { status: 400 });
  }

  if (request.nextUrl.searchParams.get("dry_run") === "1" || body.dry_run === true || body.dry_run === "true") {
    const p = await prepareEmail(form);
    return NextResponse.json({
      form,
      facts: p.checks.facts,
      checks: p.checks.checks,
      errors: p.checks.errors,
      email: p.composed.email,
      validation: p.composed.validation,
      autoSendBlockers: autoSendBlockers(p),
      model: p.composed.model,
      attempts: p.composed.attempts,
      dataforseoUsd: p.checks.costUsd,
      ms: p.ms,
    });
  }

  const supabase = getServiceSupabase();

  // The older Zapier webhook may have created the lead already; match on email
  const { data: existing } = await supabase.from("leads").select("id, notes").eq("email", form.email).order("created_at", { ascending: false }).limit(1);
  let leadId = existing?.[0]?.id as string | undefined;
  const existingNotes = (existing?.[0]?.notes as string | null | undefined) ?? "";
  const summary = [
    form.helpWithRaw && `Wants help with: ${form.helpWithRaw.replace(/_/g, " ")}`,
    form.trade && `Trade: ${form.trade}`,
    form.website && `Website: ${form.website}`,
    form.adsetName && `Ad set: ${form.adsetName}`,
    form.platform && `Platform: ${form.platform}`,
  ].filter(Boolean).join(" | ");

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
        notes: summary || null,
        meta_lead_id: form.metaLeadId,
        archived: false,
      })
      .select("id")
      .single();
    if (error || !lead) {
      console.error("[instant] lead insert failed", error);
      return NextResponse.json({ error: "Failed to save lead" }, { status: 500 });
    }
    leadId = lead.id;
  } else {
    // instant_flow is set once a draft or email exists (processEnrichment), so a failed run still
    // leaves the lead on the old 24-hour follow-up
    if (!existingNotes.trim() && summary) {
      await supabase.from("leads").update({ notes: summary, updated_at: new Date().toISOString() }).eq("id", leadId);
    }
  }

  // Zapier retries on slow responses; don't draft twice for the same lead within 30 minutes
  if (!form.previouslyEmailed) {
    const since = new Date(Date.now() - 30 * 60_000).toISOString();
    const { data: recent } = await supabase.from("lead_enrichments").select("id").eq("lead_id", leadId).gte("created_at", since).limit(1);
    if (recent?.length) {
      return NextResponse.json({ ok: true, duplicate: true, lead_id: leadId, enrichment_id: recent[0].id });
    }
  }

  const { data: enrichment, error: enrichError } = await supabase.from("lead_enrichments").insert({ lead_id: leadId, form, status: "received" }).select("id").single();
  if (enrichError || !enrichment) {
    console.error("[instant] enrichment insert failed", enrichError);
    return NextResponse.json({ error: "Failed to queue lead" }, { status: 500 });
  }

  after(async () => {
    await processEnrichment(enrichment.id).catch((err) => console.error("[instant] processEnrichment crashed", err));
  });

  return NextResponse.json({ ok: true, lead_id: leadId, enrichment_id: enrichment.id }, { status: 202 });
}

export async function GET() {
  return NextResponse.json({
    status: "ok",
    message: "Instant lead email webhook. POST a Meta lead with header x-api-key. Add ?dry_run=1 to preview without saving.",
  });
}
