import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getLeadGenForms, getFormLeads, parseLeadData } from "@/lib/meta";

function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error("Supabase credentials not configured");
  }

  return createClient(supabaseUrl, supabaseServiceKey);
}

export async function POST() {
  try {
    const supabase = getSupabaseClient();

    // Get all Meta connections
    const { data: connections, error: connectionsError } = await supabase
      .from("meta_connections")
      .select("*");

    if (connectionsError) {
      throw new Error("Failed to fetch Meta connections");
    }

    if (!connections || connections.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No Meta connections found",
        leadsImported: 0,
      });
    }

    let totalLeadsImported = 0;

    for (const connection of connections) {
      try {
        // Get lead gen forms for this page
        const forms = await getLeadGenForms(
          connection.page_id,
          connection.page_access_token
        );

        for (const form of forms) {
          // Get leads from each form (last 50)
          const leads = await getFormLeads(
            form.id,
            connection.page_access_token,
            50
          );

          for (const lead of leads) {
            const parsedLead = parseLeadData(lead);

            // Check if lead already exists
            const { data: existingLead } = await supabase
              .from("leads")
              .select("id")
              .eq("meta_lead_id", lead.id)
              .single();

            if (existingLead) {
              continue; // Skip existing leads
            }

            // Insert new lead
            const { error: insertError } = await supabase.from("leads").insert({
              name: parsedLead.name,
              email: parsedLead.email,
              phone: parsedLead.phone,
              company: parsedLead.company || "Unknown",
              stage: "contacted_1",
              source: "meta_ads",
              owner: "Heath Maes",
              conversion_probability: 30,
              notes: `Lead from Meta Ads - Form: ${form.name}${
                parsedLead.campaign_name
                  ? ` - Campaign: ${parsedLead.campaign_name}`
                  : ""
              }`,
              meta_lead_id: lead.id,
              created_at: parsedLead.created_at,
              updated_at: new Date().toISOString(),
            });

            if (!insertError) {
              totalLeadsImported++;
            }
          }
        }
      } catch (pageError) {
        console.error(
          `Error syncing leads for page ${connection.page_name}:`,
          pageError
        );
      }
    }

    return NextResponse.json({
      success: true,
      message: `Successfully synced leads from Meta`,
      leadsImported: totalLeadsImported,
    });
  } catch (error) {
    console.error("Error syncing Meta leads:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to sync leads",
      },
      { status: 500 }
    );
  }
}
