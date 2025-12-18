import { NextRequest, NextResponse } from "next/server";
import { getLeadDetails, parseLeadData, verifyWebhookSignature } from "@/lib/meta";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Initialize Supabase client
function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error("Supabase credentials not configured");
  }

  return createClient(supabaseUrl, supabaseServiceKey);
}

// Instagram message types
interface InstagramMessage {
  sender: { id: string };
  recipient: { id: string };
  timestamp: number;
  message?: {
    mid: string;
    text?: string;
    attachments?: Array<{ type: string; payload: { url: string } }>;
  };
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

// POST - Receive lead notifications and Instagram messages
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

    // Process Instagram messages
    if (data.object === "instagram") {
      for (const entry of data.entry || []) {
        const igAccountId = entry.id;
        for (const messagingEvent of entry.messaging || []) {
          await processInstagramMessage(messagingEvent, igAccountId);
        }
      }
    }

    // Process Facebook Page events (leadgen and Messenger)
    if (data.object === "page") {
      for (const entry of data.entry || []) {
        // Handle leadgen events
        for (const change of entry.changes || []) {
          if (change.field === "leadgen") {
            const leadgenId = change.value.leadgen_id;
            const pageId = change.value.page_id;
            const formId = change.value.form_id;

            console.log(`New lead received: ${leadgenId} from page ${pageId}, form ${formId}`);
            await processNewLead(leadgenId, pageId);
          }
        }

        // Handle Messenger events
        for (const messagingEvent of entry.messaging || []) {
          await processMessengerMessage(messagingEvent, entry.id);
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

// Process Instagram DM messages
async function processInstagramMessage(messagingEvent: InstagramMessage, igAccountId: string) {
  try {
    const supabase = getSupabaseClient();
    const senderId = messagingEvent.sender.id;
    const messageText = messagingEvent.message?.text || "";
    const timestamp = new Date(messagingEvent.timestamp).toISOString();

    // Skip if this is an outgoing message (sender is us)
    if (senderId === igAccountId) {
      console.log("Skipping outgoing message");
      return;
    }

    console.log(`Instagram DM from ${senderId}: ${messageText}`);

    // Check if we already have a lead with this Instagram ID
    const { data: existingLead } = await supabase
      .from("leads")
      .select("*")
      .eq("instagram_id", senderId)
      .single();

    if (existingLead) {
      // Update existing lead - they responded!
      console.log(`Existing lead found: ${existingLead.name}`);

      // Log the message activity
      await supabase.from("activities").insert({
        lead_id: existingLead.id,
        type: "note",
        description: `Instagram DM received: "${messageText.substring(0, 100)}${messageText.length > 100 ? "..." : ""}"`,
        created_at: timestamp,
      });

      // If lead was in an early stage, they responded - move to interested
      const earlyStages = ["contacted_1", "contacted_2", "called", "no_response"];
      if (earlyStages.includes(existingLead.stage)) {
        await supabase
          .from("leads")
          .update({
            stage: "interested",
            updated_at: new Date().toISOString(),
            last_contacted: timestamp,
          })
          .eq("id", existingLead.id);

        console.log(`Lead ${existingLead.name} moved to interested (responded via IG DM)`);
      }
    } else {
      // Create new lead from Instagram DM
      const { error: insertError } = await supabase.from("leads").insert({
        name: `Instagram User ${senderId.slice(-6)}`, // Placeholder name
        company: "Unknown",
        email: "", // Will need to be collected
        phone: null,
        stage: "contacted_1",
        source: "instagram",
        owner: "Heath Maes",
        conversion_probability: 25,
        notes: `Lead from Instagram DM. First message: "${messageText.substring(0, 200)}"`,
        instagram_id: senderId,
        created_at: timestamp,
        updated_at: timestamp,
        last_contacted: timestamp,
      });

      if (insertError) {
        console.error("Error creating Instagram lead:", insertError);
      } else {
        console.log(`New Instagram lead created from DM: ${senderId}`);
      }
    }
  } catch (error) {
    console.error("Error processing Instagram message:", error);
  }
}

// Process Facebook Messenger messages
async function processMessengerMessage(messagingEvent: InstagramMessage, pageId: string) {
  try {
    const supabase = getSupabaseClient();
    const senderId = messagingEvent.sender.id;
    const messageText = messagingEvent.message?.text || "";
    const timestamp = new Date(messagingEvent.timestamp).toISOString();

    // Skip if this is an outgoing message (sender is the page)
    if (senderId === pageId) {
      console.log("Skipping outgoing Messenger message");
      return;
    }

    console.log(`Messenger message from ${senderId}: ${messageText}`);

    // Check if we already have a lead with this Facebook ID
    const { data: existingLead } = await supabase
      .from("leads")
      .select("*")
      .eq("facebook_id", senderId)
      .single();

    if (existingLead) {
      // Log the message activity
      await supabase.from("activities").insert({
        lead_id: existingLead.id,
        type: "note",
        description: `Messenger received: "${messageText.substring(0, 100)}${messageText.length > 100 ? "..." : ""}"`,
        created_at: timestamp,
      });

      // If lead was in an early stage, they responded
      const earlyStages = ["contacted_1", "contacted_2", "called", "no_response"];
      if (earlyStages.includes(existingLead.stage)) {
        await supabase
          .from("leads")
          .update({
            stage: "interested",
            updated_at: new Date().toISOString(),
            last_contacted: timestamp,
          })
          .eq("id", existingLead.id);

        console.log(`Lead ${existingLead.name} moved to interested (responded via Messenger)`);
      }
    } else {
      // Create new lead from Messenger
      const { error: insertError } = await supabase.from("leads").insert({
        name: `Facebook User ${senderId.slice(-6)}`,
        company: "Unknown",
        email: "",
        phone: null,
        stage: "contacted_1",
        source: "other", // Could add "messenger" as a source
        owner: "Heath Maes",
        conversion_probability: 25,
        notes: `Lead from Facebook Messenger. First message: "${messageText.substring(0, 200)}"`,
        facebook_id: senderId,
        created_at: timestamp,
        updated_at: timestamp,
        last_contacted: timestamp,
      });

      if (insertError) {
        console.error("Error creating Messenger lead:", insertError);
      } else {
        console.log(`New Messenger lead created: ${senderId}`);
      }
    }
  } catch (error) {
    console.error("Error processing Messenger message:", error);
  }
}
