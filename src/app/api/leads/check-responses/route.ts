import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";
import { listEmails, refreshAccessToken } from "@/lib/gmail";

// This endpoint checks if leads in "contacted_1" stage have responded
// and automatically moves them to "interested" to prevent automatic follow-ups
// Called when: inbox loads, lead modal opens, or manually triggered

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const leadId = searchParams.get("leadId"); // Optional: check specific lead

    const supabase = getServiceSupabase();

    // Get Gmail tokens from database
    const { data: settingsData, error: settingsError } = await supabase
      .from("settings")
      .select("value")
      .eq("key", "gmail_tokens")
      .single();

    if (settingsError || !settingsData) {
      // Gmail not connected - skip silently
      return NextResponse.json({
        message: "Gmail not connected",
        checked: 0,
        advanced: 0,
      });
    }

    const tokens = settingsData.value as {
      access_token: string;
      refresh_token: string;
      expiry_date: number | null;
      email: string;
    };

    let accessToken = tokens.access_token;

    // Refresh token if expired
    if (tokens.expiry_date && Date.now() >= tokens.expiry_date) {
      try {
        const newCredentials = await refreshAccessToken(tokens.refresh_token);
        accessToken = newCredentials.access_token!;

        // Update tokens in database
        await supabase
          .from("settings")
          .update({
            value: {
              ...tokens,
              access_token: newCredentials.access_token,
              expiry_date: newCredentials.expiry_date || null,
            }
          })
          .eq("key", "gmail_tokens");
      } catch (refreshError) {
        console.error("[Check Responses] Error refreshing token:", refreshError);
        return NextResponse.json({
          message: "Gmail token expired",
          checked: 0,
          advanced: 0,
        });
      }
    }

    // Build query for leads to check
    let query = supabase
      .from("leads")
      .select("*")
      .eq("stage", "contacted_1")
      .eq("archived", false)
      .not("last_contacted", "is", null);

    // If specific lead ID provided, only check that one
    if (leadId) {
      query = query.eq("id", leadId);
    }

    const { data: leads, error: leadsError } = await query;

    if (leadsError) {
      console.error("[Check Responses] Error fetching leads:", leadsError);
      return NextResponse.json({ error: "Failed to fetch leads" }, { status: 500 });
    }

    if (!leads || leads.length === 0) {
      return NextResponse.json({
        message: "No leads to check",
        checked: 0,
        advanced: 0,
      });
    }

    console.log(`[Check Responses] Checking ${leads.length} leads for responses`);

    const results = {
      checked: 0,
      advanced: 0,
      advancedLeads: [] as string[],
    };

    // Check each lead for responses
    for (const lead of leads) {
      try {
        results.checked++;

        // Check if the lead has responded (any email FROM them after last_contacted)
        const query = `from:${lead.email}`;
        const responseEmails = await listEmails(accessToken, tokens.refresh_token, {
          maxResults: 5,
          query,
        });

        // Check if any response email is after the last_contacted date
        const lastContacted = new Date(lead.last_contacted);
        const hasResponded = responseEmails.some(email => {
          const emailDate = new Date(email.date);
          return emailDate > lastContacted;
        });

        if (hasResponded) {
          console.log(`[Check Responses] Lead ${lead.name} (${lead.email}) has responded - moving to interested`);

          // Update stage to "interested"
          await supabase
            .from("leads")
            .update({ stage: "interested" })
            .eq("id", lead.id);

          results.advanced++;
          results.advancedLeads.push(lead.name);
        }
      } catch (leadError) {
        console.error(`[Check Responses] Error checking lead ${lead.name}:`, leadError);
        // Continue with next lead
      }
    }

    console.log(`[Check Responses] Completed: checked ${results.checked}, advanced ${results.advanced}`);

    return NextResponse.json({
      message: "Response check completed",
      ...results,
    });

  } catch (error) {
    console.error("[Check Responses] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
