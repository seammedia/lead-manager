import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";
import { listEmails, sendEmail, refreshAccessToken } from "@/lib/gmail";

// This endpoint is called by Vercel Cron to send automated follow-up emails
// It runs every 6 hours and checks for leads that need follow-up

export async function GET(request: NextRequest) {
  try {
    // Verify this is a cron job request (Vercel adds this header)
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      // Also allow manual trigger in development
      if (process.env.NODE_ENV === "production") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    const supabase = getServiceSupabase();

    // Calculate the cutoff date (2 days ago)
    const twoDaysAgo = new Date();
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

    // Find leads that:
    // 1. Are in "contacted_1" stage
    // 2. Were last contacted more than 2 days ago
    // 3. Are not archived
    const { data: leads, error: leadsError } = await supabase
      .from("leads")
      .select("*")
      .eq("stage", "contacted_1")
      .eq("archived", false)
      .lt("last_contacted", twoDaysAgo.toISOString())
      .not("last_contacted", "is", null);

    if (leadsError) {
      console.error("[Follow-up Cron] Error fetching leads:", leadsError);
      return NextResponse.json({ error: "Failed to fetch leads" }, { status: 500 });
    }

    if (!leads || leads.length === 0) {
      console.log("[Follow-up Cron] No leads need follow-up");
      return NextResponse.json({
        message: "No leads need follow-up",
        processed: 0
      });
    }

    console.log(`[Follow-up Cron] Found ${leads.length} leads to check for follow-up`);

    // Get Gmail tokens from database (stored during OAuth callback)
    const { data: settingsData, error: settingsError } = await supabase
      .from("settings")
      .select("value")
      .eq("key", "gmail_tokens")
      .single();

    if (settingsError || !settingsData) {
      console.error("[Follow-up Cron] No Gmail tokens found in database");
      return NextResponse.json({
        error: "Gmail not connected. Please reconnect Gmail in settings."
      }, { status: 401 });
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
        console.error("[Follow-up Cron] Error refreshing token:", refreshError);
        return NextResponse.json({
          error: "Gmail session expired. Please reconnect Gmail in settings."
        }, { status: 401 });
      }
    }

    const results = {
      processed: 0,
      followUpsSent: 0,
      skippedDueToResponse: 0,
      errors: 0,
    };

    // Process each lead
    for (const lead of leads) {
      try {
        console.log(`[Follow-up Cron] Checking lead: ${lead.name} (${lead.email})`);

        // Check if the lead has responded (any email FROM them)
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
          console.log(`[Follow-up Cron] Lead ${lead.name} has responded, skipping follow-up`);

          // Update stage to "interested" since they responded
          await supabase
            .from("leads")
            .update({ stage: "interested" })
            .eq("id", lead.id);

          results.skippedDueToResponse++;
          results.processed++;
          continue;
        }

        // No response - send follow-up email
        const firstName = lead.name.split(" ")[0];
        const subject = `Following up${lead.company ? ` - ${lead.company}` : ""}`;
        const body = `Hi ${firstName},

Just following up on this one and seeing if you needed any further information?

Look forward to hearing from you.

Thanks,

Heath`;

        console.log(`[Follow-up Cron] Sending follow-up to ${lead.name}`);

        await sendEmail(
          accessToken,
          tokens.refresh_token,
          lead.email,
          subject,
          body
        );

        // Update lead: stage to "contacted_2" and last_contacted to now
        await supabase
          .from("leads")
          .update({
            stage: "contacted_2",
            last_contacted: new Date().toISOString()
          })
          .eq("id", lead.id);

        console.log(`[Follow-up Cron] Follow-up sent to ${lead.name}, moved to contacted_2`);
        results.followUpsSent++;
        results.processed++;

      } catch (leadError) {
        console.error(`[Follow-up Cron] Error processing lead ${lead.name}:`, leadError);
        results.errors++;
        results.processed++;
      }
    }

    console.log("[Follow-up Cron] Completed:", results);
    return NextResponse.json({
      message: "Follow-up cron completed",
      ...results,
    });

  } catch (error) {
    console.error("[Follow-up Cron] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
