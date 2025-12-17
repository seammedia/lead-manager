import { NextRequest, NextResponse } from "next/server";
import { getLeadDetails, parseLeadData, verifyWebhookSignature } from "@/lib/meta";
import { createClient } from "@supabase/supabase-js";

// Initialize Supabase client
function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error("Supabase credentials not configured");
  }

  return createClient(supabaseUrl, supabaseServiceKey);
}

// GET - Webhook verification (Meta sends this to verify your endpoint)
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;

  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  const verifyToken = process.env.META_WEBHOOK_VERIFY_TOKEN;

  if (mode === "subscribe" && token === verifyToken) {
    console.log("Meta webhook verified successfully");
    return new NextResponse(challenge, { status: 200 });
  }

  console.error("Meta webhook verification failed");
  return new NextResponse("Forbidden", { status: 403 });
}

// POST - Receive lead notifications
export async function POST(request: NextRequest) {
  try {
    const payload = await request.text();
    const signature = request.headers.get("x-hub-signature-256") || "";

    // Verify webhook signature in production
    if (process.env.NODE_ENV === "production") {
      if (!verifyWebhookSignature(signature, payload)) {
        console.error("Invalid webhook signature");
        return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
      }
    }

    const data = JSON.parse(payload);
    console.log("Received Meta webhook:", JSON.stringify(data, null, 2));

    // Process leadgen entries
    if (data.object === "page") {
      for (const entry of data.entry || []) {
        for (const change of entry.changes || []) {
          if (change.field === "leadgen") {
            const leadgenId = change.value.leadgen_id;
            const pageId = change.value.page_id;
            const formId = change.value.form_id;

            console.log(`New lead received: ${leadgenId} from page ${pageId}, form ${formId}`);

            // Queue lead for processing
            await processNewLead(leadgenId, pageId);
          }
        }
      }
    }

    // Always return 200 to acknowledge receipt
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Error processing webhook:", error);
    // Still return 200 to prevent Meta from retrying
    return NextResponse.json({ received: true, error: "Processing failed" });
  }
}

async function processNewLead(leadId: string, pageId: string) {
  try {
    const supabase = getSupabaseClient();

    // Get the stored page access token
    const { data: metaConnection } = await supabase
      .from("meta_connections")
      .select("page_access_token")
      .eq("page_id", pageId)
      .single();

    if (!metaConnection?.page_access_token) {
      console.error(`No access token found for page ${pageId}`);
      return;
    }

    // Fetch lead details from Meta
    const leadData = await getLeadDetails(leadId, metaConnection.page_access_token);
    const parsedLead = parseLeadData(leadData);

    // Check if lead already exists
    const { data: existingLead } = await supabase
      .from("leads")
      .select("id")
      .eq("meta_lead_id", leadId)
      .single();

    if (existingLead) {
      console.log(`Lead ${leadId} already exists, skipping`);
      return;
    }

    // Insert new lead into database
    const { error: insertError } = await supabase.from("leads").insert({
      name: parsedLead.name,
      email: parsedLead.email,
      phone: parsedLead.phone,
      company: parsedLead.company || "Unknown",
      stage: "contacted_1",
      source: "meta_ads",
      owner: "Heath Maes", // Default owner
      conversion_probability: 30, // Default for ad leads
      notes: `Lead from Meta Ads${parsedLead.campaign_name ? ` - Campaign: ${parsedLead.campaign_name}` : ""}${parsedLead.ad_name ? ` - Ad: ${parsedLead.ad_name}` : ""}`,
      meta_lead_id: leadId,
      created_at: parsedLead.created_at,
      updated_at: new Date().toISOString(),
    });

    if (insertError) {
      console.error("Error inserting lead:", insertError);
    } else {
      console.log(`Successfully added lead: ${parsedLead.name} (${parsedLead.email})`);
    }
  } catch (error) {
    console.error("Error processing lead:", error);
  }
}
