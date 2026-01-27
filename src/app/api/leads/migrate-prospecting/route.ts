import { NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";

// POST /api/leads/migrate-prospecting - Update clawdcode leads to prospecting source
export async function POST() {
  try {
    const supabase = getServiceSupabase();
    
    // Update all leads where owner is "clawdcode" or "Clawdbot" to have source "prospecting"
    const { data, error } = await supabase
      .from("leads")
      .update({ source: "prospecting" })
      .or("owner.ilike.%clawdcode%,owner.ilike.%clawdbot%")
      .select();

    if (error) {
      console.error("Error migrating leads:", error);
      return NextResponse.json(
        { error: "Failed to migrate leads", details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ 
      success: true, 
      message: `Updated ${data?.length || 0} leads to source: prospecting`,
      updatedLeads: data 
    });
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
