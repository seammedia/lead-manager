import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";

// GET /api/leads - Fetch all leads
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const archived = searchParams.get("archived") === "true";

    const supabase = getServiceSupabase();
    const { data: leads, error } = await supabase
      .from("leads")
      .select("*")
      .eq("archived", archived)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching leads:", error);
      return NextResponse.json(
        { error: "Failed to fetch leads" },
        { status: 500 }
      );
    }

    return NextResponse.json({ leads });
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST /api/leads - Create a new lead
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate required fields
    if (!body.name || !body.email) {
      return NextResponse.json(
        { error: "Name and email are required" },
        { status: 400 }
      );
    }

    const newLead = {
      name: body.name,
      email: body.email.toLowerCase(),
      company: body.company || "",
      phone: body.phone || null,
      stage: body.stage || "new",
      source: body.source || "website",
      owner: body.owner || "Heath Maes",
      conversion_probability: body.conversion_probability || 20,
      revenue: body.revenue || null,
      notes: body.notes || null,
      archived: false,
    };

    const supabase = getServiceSupabase();
    const { data: lead, error } = await supabase
      .from("leads")
      .insert(newLead)
      .select()
      .single();

    if (error) {
      console.error("Error creating lead:", error);
      return NextResponse.json(
        { error: "Failed to create lead" },
        { status: 500 }
      );
    }

    return NextResponse.json({ lead }, { status: 201 });
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
