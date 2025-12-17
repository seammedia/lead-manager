import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";

const USER_ID = "default"; // In production, this would be the authenticated user ID

// GET /api/settings/business-context - Get business context
export async function GET() {
  try {
    const supabase = getServiceSupabase();
    const { data, error } = await supabase
      .from("business_context")
      .select("*")
      .eq("user_id", USER_ID)
      .single();

    if (error && error.code !== "PGRST116") {
      // PGRST116 = no rows returned
      console.error("Error fetching business context:", error);
      return NextResponse.json(
        { error: "Failed to fetch business context" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      notes: data?.notes || "",
      attachments: data?.attachments || [],
    });
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST /api/settings/business-context - Save business context
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { notes, attachments } = body;

    const supabase = getServiceSupabase();

    // Upsert the business context
    const { data, error } = await supabase
      .from("business_context")
      .upsert(
        {
          user_id: USER_ID,
          notes: notes || "",
          attachments: attachments || [],
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "user_id",
        }
      )
      .select()
      .single();

    if (error) {
      console.error("Error saving business context:", error);
      return NextResponse.json(
        { error: "Failed to save business context" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      notes: data.notes,
      attachments: data.attachments,
    });
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
