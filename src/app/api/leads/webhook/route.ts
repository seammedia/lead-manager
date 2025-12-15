import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";

// Webhook endpoint for Zapier to create new leads
// POST /api/leads/webhook
//
// Body:
// {
//   "name": "John Doe",           // Required
//   "email": "john@example.com",  // Required
//   "company": "Acme Inc",        // Optional
//   "phone": "+1234567890",       // Optional
//   "notes": "From Meta Lead Ad"  // Optional
// }
//
// Optional headers:
// - x-api-key: Your API key for authentication (set WEBHOOK_API_KEY in env)

export async function POST(request: NextRequest) {
  try {
    // Optional API key authentication
    const apiKey = process.env.WEBHOOK_API_KEY;
    if (apiKey) {
      const providedKey = request.headers.get("x-api-key");
      if (providedKey !== apiKey) {
        return NextResponse.json(
          { error: "Unauthorized" },
          { status: 401 }
        );
      }
    }

    const body = await request.json();

    // Validate required fields
    if (!body.name || !body.email) {
      return NextResponse.json(
        { error: "Missing required fields: name and email are required" },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(body.email)) {
      return NextResponse.json(
        { error: "Invalid email format" },
        { status: 400 }
      );
    }

    const supabase = getServiceSupabase();

    // Check if lead with this email already exists
    const { data: existingLead } = await supabase
      .from("leads")
      .select("id, email")
      .eq("email", body.email.toLowerCase())
      .single();

    if (existingLead) {
      return NextResponse.json(
        {
          success: true,
          message: "Lead already exists",
          lead: existingLead,
          duplicate: true
        },
        { status: 200 }
      );
    }

    // Create new lead with defaults for Meta Ads
    const newLead = {
      name: body.name,
      email: body.email.toLowerCase(),
      company: body.company || "",
      phone: body.phone || null,
      stage: "new" as const,
      source: "meta_ads" as const,
      owner: "Heath Maes",
      conversion_probability: 20,
      revenue: null,
      notes: body.notes || null,
      archived: false,
      meta_lead_id: body.meta_lead_id || null,
    };

    const { data: lead, error } = await supabase
      .from("leads")
      .insert(newLead)
      .select()
      .single();

    if (error) {
      console.error("Error creating lead:", error);
      return NextResponse.json(
        { error: "Failed to create lead", details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: "Lead created successfully",
        lead
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Webhook error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// GET endpoint to test the webhook is working
export async function GET() {
  return NextResponse.json({
    status: "ok",
    message: "Leads webhook is active. Send a POST request with lead data.",
    required_fields: ["name", "email"],
    optional_fields: ["company", "phone", "notes", "meta_lead_id"],
    defaults: {
      stage: "new",
      source: "meta_ads",
      owner: "Heath Maes"
    }
  });
}
