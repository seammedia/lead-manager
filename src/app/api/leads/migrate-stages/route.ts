import { NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";

// Stage mapping from old to new
const stageMapping: Record<string, string> = {
  new: "contacted_1", // "new" stage removed, map to contacted_1
  contacted: "contacted_1",
  interested: "interested",
  negotiation: "contacted_2",
  demo: "contacted_2",
  converted: "converted",
  lost: "not_interested",
};

// POST /api/leads/migrate-stages - Migrate leads to new stage system
export async function POST() {
  try {
    const supabase = getServiceSupabase();

    // Get all leads
    const { data: leads, error: fetchError } = await supabase
      .from("leads")
      .select("id, stage");

    if (fetchError) {
      console.error("Error fetching leads:", fetchError);
      return NextResponse.json(
        { error: "Failed to fetch leads" },
        { status: 500 }
      );
    }

    let migratedCount = 0;
    const errors: string[] = [];

    // Update each lead with the new stage
    for (const lead of leads || []) {
      const newStage = stageMapping[lead.stage];

      if (newStage && newStage !== lead.stage) {
        const { error: updateError } = await supabase
          .from("leads")
          .update({ stage: newStage })
          .eq("id", lead.id);

        if (updateError) {
          errors.push(`Failed to update lead ${lead.id}: ${updateError.message}`);
        } else {
          migratedCount++;
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: `Migrated ${migratedCount} leads to new stage system`,
      totalLeads: leads?.length || 0,
      migratedCount,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
