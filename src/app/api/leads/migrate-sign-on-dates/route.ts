import { NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";

// POST /api/leads/migrate-sign-on-dates - One-time migration to add sign_on_date column and set dates for existing leads
export async function POST() {
  try {
    const supabase = getServiceSupabase();

    // Note: sign_on_date and exit_date columns should be added via SQL migration:
    // ALTER TABLE leads ADD COLUMN IF NOT EXISTS sign_on_date DATE;
    // ALTER TABLE leads ADD COLUMN IF NOT EXISTS exit_date DATE;

    // Get all converted leads to find the ones we need to update
    const { data: convertedLeads, error: fetchError } = await supabase
      .from("leads")
      .select("id, name")
      .eq("stage", "converted");

    if (fetchError) {
      console.error("Error fetching converted leads:", fetchError);
      return NextResponse.json({ error: "Failed to fetch leads" }, { status: 500 });
    }

    // Sign on date mappings (name -> date in YYYY-MM-DD format)
    const signOnDates: Record<string, string> = {
      "Anthony": "2026-01-11",  // Today 11/1/2026
      "Monique": "2026-01-11",  // Today 11/1/2026
      "Paul": "2026-01-05",     // 5/1/2026
      "Steph": "2026-01-10",    // 10/1/2026
      "Steve": "2025-12-18",    // 18/12/2025
    };

    const results: { name: string; success: boolean; date?: string }[] = [];

    // Update each lead with their sign on date
    for (const lead of convertedLeads || []) {
      // Match by first name (case-insensitive)
      const firstName = lead.name.split(" ")[0];
      const signOnDate = Object.entries(signOnDates).find(
        ([name]) => name.toLowerCase() === firstName.toLowerCase()
      )?.[1];

      if (signOnDate) {
        const { error: updateError } = await supabase
          .from("leads")
          .update({ sign_on_date: signOnDate })
          .eq("id", lead.id);

        results.push({
          name: lead.name,
          success: !updateError,
          date: signOnDate,
        });

        if (updateError) {
          console.error(`Error updating ${lead.name}:`, updateError);
        }
      }
    }

    return NextResponse.json({
      message: "Migration completed",
      results,
      totalConverted: convertedLeads?.length || 0,
      updated: results.filter(r => r.success).length,
    });
  } catch (error) {
    console.error("Migration error:", error);
    return NextResponse.json({ error: "Migration failed" }, { status: 500 });
  }
}
