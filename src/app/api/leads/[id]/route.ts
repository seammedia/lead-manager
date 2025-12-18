import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";

// GET /api/leads/[id] - Get a single lead
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const supabase = getServiceSupabase();
    const { data: lead, error } = await supabase
      .from("leads")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !lead) {
      return NextResponse.json(
        { error: "Lead not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ lead });
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// Stages that should auto-archive leads (hidden from main view)
const ARCHIVED_STAGES = ["not_interested", "no_response", "not_qualified"];

// PATCH /api/leads/[id] - Update a lead
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    // Remove fields that shouldn't be updated directly
    const { id: _, created_at, updated_at, ...updates } = body;

    // Auto-archive when stage is set to not_interested, no_response, or not_qualified
    if (updates.stage && ARCHIVED_STAGES.includes(updates.stage)) {
      updates.archived = true;
    }
    // Auto-unarchive when stage changes away from archived stages (unless explicitly setting archived)
    else if (updates.stage && body.archived === undefined) {
      updates.archived = false;
    }

    // Set converted_at timestamp when stage changes to "converted"
    if (updates.stage === "converted") {
      updates.converted_at = new Date().toISOString();
    }
    // Clear converted_at if stage changes away from "converted"
    else if (updates.stage && updates.stage !== "converted") {
      updates.converted_at = null;
    }

    const supabase = getServiceSupabase();
    const { data: lead, error } = await supabase
      .from("leads")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Error updating lead:", error);
      return NextResponse.json(
        { error: `Failed to update lead: ${error.message}` },
        { status: 500 }
      );
    }

    if (!lead) {
      return NextResponse.json(
        { error: "Lead not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ lead });
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE /api/leads/[id] - Delete a lead
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const supabase = getServiceSupabase();
    const { error } = await supabase
      .from("leads")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Error deleting lead:", error);
      return NextResponse.json(
        { error: "Failed to delete lead" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
