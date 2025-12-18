import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";

// Source colors for charts
const sourceColors: Record<string, string> = {
  linkedin: "#0077B5",
  referral: "#8B5CF6",
  website: "#10B981",
  email: "#F59E0B",
  instagram: "#E4405F",
  meta_ads: "#1877F2",
  google_ads: "#4285F4",
  other: "#6B7280",
};

const sourceLabels: Record<string, string> = {
  linkedin: "LinkedIn",
  referral: "Referral",
  website: "Website",
  email: "Email",
  instagram: "Instagram",
  meta_ads: "Meta Ads",
  google_ads: "Google Ads",
  other: "Other",
};

// Helper to format date range like "Dec 15-21"
function formatDateRange(start: Date, end: Date): string {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const startMonth = months[start.getMonth()];
  const endMonth = months[end.getMonth()];
  const startDay = start.getDate();
  const endDay = end.getDate();

  if (startMonth === endMonth) {
    return `${startMonth} ${startDay}-${endDay}`;
  }
  return `${startMonth} ${startDay} - ${endMonth} ${endDay}`;
}

// Helper to get Monday of a week
function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff));
}

// GET /api/stats - Fetch stats data
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const period = searchParams.get("period") || "30";
    const customStart = searchParams.get("start");
    const customEnd = searchParams.get("end");

    const supabase = getServiceSupabase();

    const now = new Date();
    let startDate: Date;
    let previousStartDate: Date;
    let days: number;

    // Calculate date ranges based on period type
    if (period === "this_month") {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      previousStartDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      days = Math.ceil((now.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000));
    } else if (period === "last_month") {
      startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
      previousStartDate = new Date(now.getFullYear(), now.getMonth() - 2, 1);
      days = endOfLastMonth.getDate();
    } else if (period === "custom" && customStart && customEnd) {
      startDate = new Date(customStart);
      const endDate = new Date(customEnd);
      days = Math.ceil((endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000));
      previousStartDate = new Date(startDate.getTime() - days * 24 * 60 * 60 * 1000);
    } else {
      days = parseInt(period, 10) || 30;
      startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
      previousStartDate = new Date(startDate.getTime() - days * 24 * 60 * 60 * 1000);
    }

    // Fetch ALL leads (including archived) for accurate stats
    const { data: allLeads, error: leadsError } = await supabase
      .from("leads")
      .select("*");

    if (leadsError) {
      console.error("Error fetching leads:", leadsError);
      return NextResponse.json(
        { error: "Failed to fetch leads" },
        { status: 500 }
      );
    }

    const leads = allLeads || [];

    // Filter by date range
    const currentPeriodLeads = leads.filter(
      (lead) => new Date(lead.created_at) >= startDate
    );
    const previousPeriodLeads = leads.filter(
      (lead) =>
        new Date(lead.created_at) >= previousStartDate &&
        new Date(lead.created_at) < startDate
    );

    // Count ALL conversions (regardless of when lead was created)
    const totalConversions = leads.filter(
      (l) => l.stage === "converted"
    ).length;

    // For comparison, count conversions from leads created in each period
    const currentPeriodConversions = currentPeriodLeads.filter(
      (l) => l.stage === "converted"
    ).length;
    const previousPeriodConversions = previousPeriodLeads.filter(
      (l) => l.stage === "converted"
    ).length;

    // Calculate conversion rate based on all leads
    const convRate = leads.length > 0
      ? (totalConversions / leads.length) * 100
      : 0;
    const previousConvRate = previousPeriodLeads.length > 0
      ? (previousPeriodConversions / previousPeriodLeads.length) * 100
      : 0;

    // Fetch email count
    const { count: emailCount } = await supabase
      .from("email_logs")
      .select("*", { count: "exact", head: true })
      .gte("sent_at", startDate.toISOString());

    const { count: previousEmailCount } = await supabase
      .from("email_logs")
      .select("*", { count: "exact", head: true })
      .gte("sent_at", previousStartDate.toISOString())
      .lt("sent_at", startDate.toISOString());

    // Calculate leads by source
    const leadsBySource: Record<string, number> = {};
    currentPeriodLeads.forEach((lead) => {
      const source = lead.source || "other";
      leadsBySource[source] = (leadsBySource[source] || 0) + 1;
    });

    const leadsSourceBreakdown = Object.entries(leadsBySource)
      .map(([source, count]) => ({
        source: sourceLabels[source] || source,
        count,
        color: sourceColors[source] || sourceColors.other,
      }))
      .sort((a, b) => b.count - a.count);

    // Calculate conversions by source
    const convertedLeads = currentPeriodLeads.filter((l) => l.stage === "converted");
    const conversionsBySource: Record<string, number> = {};
    convertedLeads.forEach((lead) => {
      const source = lead.source || "other";
      conversionsBySource[source] = (conversionsBySource[source] || 0) + 1;
    });

    const conversionsSourceBreakdown = Object.entries(conversionsBySource)
      .map(([source, count]) => ({
        source: sourceLabels[source] || source,
        count,
        color: sourceColors[source] || sourceColors.other,
      }))
      .sort((a, b) => b.count - a.count);

    // Calculate revenue stats
    const totalRevenue = leads
      .filter((l) => l.stage === "converted" && l.revenue)
      .reduce((sum, l) => sum + (l.revenue || 0), 0);

    const currentPeriodRevenue = currentPeriodLeads
      .filter((l) => l.stage === "converted" && l.revenue)
      .reduce((sum, l) => sum + (l.revenue || 0), 0);

    const previousPeriodRevenue = previousPeriodLeads
      .filter((l) => l.stage === "converted" && l.revenue)
      .reduce((sum, l) => sum + (l.revenue || 0), 0);

    // Revenue by source
    const revenueBySource: Record<string, number> = {};
    leads
      .filter((l) => l.stage === "converted" && l.revenue)
      .forEach((lead) => {
        const source = lead.source || "other";
        revenueBySource[source] = (revenueBySource[source] || 0) + (lead.revenue || 0);
      });

    const revenueSourceBreakdown = Object.entries(revenueBySource)
      .map(([source, amount]) => ({
        source: sourceLabels[source] || source,
        amount,
        color: sourceColors[source] || sourceColors.other,
      }))
      .sort((a, b) => b.amount - a.amount);

    // Calculate average deal size
    const convertedWithRevenue = leads.filter((l) => l.stage === "converted" && l.revenue);
    const avgDealSize = convertedWithRevenue.length > 0
      ? totalRevenue / convertedWithRevenue.length
      : 0;

    // Calculate lead growth trend based on period
    const leadsTrend = [];
    const daysNum = parseInt(period, 10);

    if (daysNum <= 14 && !isNaN(daysNum)) {
      // Daily data for 7 or 14 days
      const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      for (let i = daysNum - 1; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        date.setHours(0, 0, 0, 0);

        const nextDate = new Date(date);
        nextDate.setDate(date.getDate() + 1);

        const dayLeads = leads.filter((lead) => {
          const createdAt = new Date(lead.created_at);
          return createdAt >= date && createdAt < nextDate;
        }).length;

        const dayConversions = leads.filter((lead) => {
          const createdAt = new Date(lead.created_at);
          return createdAt >= date && createdAt < nextDate && lead.stage === "converted";
        }).length;

        const label = `${dayNames[date.getDay()]} ${date.getDate()}`;
        leadsTrend.push({
          week: label,
          leads: dayLeads,
          conversions: dayConversions,
        });
      }
    } else {
      // Weekly data for 30 days, this_month, last_month, or custom
      const currentMonday = getMonday(now);
      const weeksToShow = period === "last_month" ? 5 : 4;

      for (let i = weeksToShow - 1; i >= 0; i--) {
        const weekStart = new Date(currentMonday);
        weekStart.setDate(currentMonday.getDate() - (i * 7));
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);

        const weekLeads = leads.filter((lead) => {
          const createdAt = new Date(lead.created_at);
          return createdAt >= weekStart && createdAt <= weekEnd;
        }).length;

        const weekConversions = leads.filter((lead) => {
          const createdAt = new Date(lead.created_at);
          return createdAt >= weekStart && createdAt <= weekEnd && lead.stage === "converted";
        }).length;

        leadsTrend.push({
          week: formatDateRange(weekStart, weekEnd),
          leads: weekLeads,
          conversions: weekConversions,
        });
      }
    }

    return NextResponse.json({
      totalLeads: currentPeriodLeads.length,
      emailsSent: emailCount || 0,
      conversions: totalConversions,
      convRate: Math.round(convRate * 10) / 10,
      previousPeriod: {
        totalLeads: previousPeriodLeads.length,
        emailsSent: previousEmailCount || 0,
        conversions: previousPeriodConversions,
        convRate: Math.round(previousConvRate * 10) / 10,
      },
      leadsTrend,
      leadsSourceBreakdown,
      conversionsSourceBreakdown,
      revenue: {
        total: totalRevenue,
        currentPeriod: currentPeriodRevenue,
        previousPeriod: previousPeriodRevenue,
        avgDealSize: Math.round(avgDealSize),
        bySource: revenueSourceBreakdown,
      },
    });
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
