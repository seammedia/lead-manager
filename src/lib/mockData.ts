import { Lead, StatsData } from "@/types";

export const mockLeads: Lead[] = [
  {
    id: "1",
    name: "Tony Stark",
    company: "Stark Industries",
    email: "tony@stark.com",
    phone: "+1 555-0101",
    stage: "negotiation",
    source: "referral",
    owner: "Heath Maes",
    conversion_probability: 90,
    revenue: null,
    notes: "Very interested in our enterprise solution",
    last_contacted: "2023-10-26",
    created_at: "2023-09-15",
    updated_at: "2023-10-26",
  },
  {
    id: "2",
    name: "Pepper Potts",
    company: "Stark Industries",
    email: "pepper@stark.com",
    phone: "+1 555-0102",
    stage: "interested",
    source: "email",
    owner: "Heath Maes",
    conversion_probability: 60,
    revenue: null,
    notes: "Following up after initial demo",
    last_contacted: "2023-10-24",
    created_at: "2023-09-20",
    updated_at: "2023-10-24",
  },
  {
    id: "3",
    name: "Steve Rogers",
    company: "Shield Ops",
    email: "steve@shield.gov",
    phone: "+1 555-0103",
    stage: "new",
    source: "website",
    owner: "Heath Maes",
    conversion_probability: 26,
    revenue: null,
    notes: "Downloaded whitepaper",
    last_contacted: "2023-10-20",
    created_at: "2023-10-18",
    updated_at: "2023-10-20",
  },
  {
    id: "4",
    name: "Natasha Romanoff",
    company: "Black Widow Inc",
    email: "natasha@blackwidow.com",
    phone: "+1 555-0104",
    stage: "contacted",
    source: "linkedin",
    owner: "Heath Maes",
    conversion_probability: 45,
    revenue: null,
    notes: "Connected on LinkedIn, scheduled call",
    last_contacted: "2023-10-23",
    created_at: "2023-10-01",
    updated_at: "2023-10-23",
  },
  {
    id: "5",
    name: "Bruce Banner",
    company: "Gamma Labs",
    email: "bruce@gammalabs.com",
    phone: "+1 555-0105",
    stage: "demo",
    source: "instagram",
    owner: "Heath Maes",
    conversion_probability: 75,
    revenue: null,
    notes: "Reached out via Instagram DM",
    last_contacted: "2023-10-26",
    created_at: "2023-09-28",
    updated_at: "2023-10-26",
  },
  {
    id: "6",
    name: "Peter Parker",
    company: "Daily Bugle",
    email: "peter@dailybugle.com",
    phone: "+1 555-0106",
    stage: "new",
    source: "website",
    owner: "Heath Maes",
    conversion_probability: 19,
    revenue: null,
    notes: "Signed up for newsletter",
    last_contacted: "2023-10-19",
    created_at: "2023-10-17",
    updated_at: "2023-10-19",
  },
  {
    id: "7",
    name: "Thor Odinson",
    company: "Asgard Corp",
    email: "thor@asgard.com",
    phone: "+1 555-0107",
    stage: "interested",
    source: "referral",
    owner: "Heath Maes",
    conversion_probability: 55,
    revenue: null,
    notes: "Referred by Tony Stark",
    last_contacted: "2023-10-25",
    created_at: "2023-10-10",
    updated_at: "2023-10-25",
  },
  {
    id: "8",
    name: "Wanda Maximoff",
    company: "Hex Industries",
    email: "wanda@hex.com",
    phone: "+1 555-0108",
    stage: "contacted",
    source: "email",
    owner: "Heath Maes",
    conversion_probability: 40,
    revenue: null,
    notes: "Cold email response received",
    last_contacted: "2023-10-22",
    created_at: "2023-10-05",
    updated_at: "2023-10-22",
  },
];

export const mockStatsData: StatsData = {
  totalLeads: 142,
  emailsSent: 850,
  conversions: 42,
  avgRate: 29.5,
  previousPeriod: {
    totalLeads: 127,
    emailsSent: 785,
    conversions: 43,
    avgRate: 33.9,
  },
  leadsTrend: [
    { week: "Wk 1", count: 25 },
    { week: "Wk 2", count: 32 },
    { week: "Wk 3", count: 45 },
    { week: "Wk 4", count: 52 },
  ],
  sourceBreakdown: [
    { source: "LinkedIn", count: 45, color: "#4F46E5" },
    { source: "Referral", count: 35, color: "#8B5CF6" },
    { source: "Website", count: 62, color: "#10B981" },
  ],
};

export function getTopOpportunities(leads: Lead[]): Lead[] {
  return [...leads]
    .sort((a, b) => b.conversion_probability - a.conversion_probability)
    .slice(0, 5);
}

export function calculateStats(leads: Lead[], days: number): StatsData {
  const now = new Date();
  const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  const previousStartDate = new Date(startDate.getTime() - days * 24 * 60 * 60 * 1000);

  const currentLeads = leads.filter(
    (lead) => new Date(lead.created_at) >= startDate
  );
  const previousLeads = leads.filter(
    (lead) =>
      new Date(lead.created_at) >= previousStartDate &&
      new Date(lead.created_at) < startDate
  );

  const conversions = currentLeads.filter((l) => l.stage === "converted").length;
  const previousConversions = previousLeads.filter((l) => l.stage === "converted").length;

  return {
    totalLeads: currentLeads.length || mockStatsData.totalLeads,
    emailsSent: mockStatsData.emailsSent,
    conversions: conversions || mockStatsData.conversions,
    avgRate: currentLeads.length > 0
      ? (conversions / currentLeads.length) * 100
      : mockStatsData.avgRate,
    previousPeriod: {
      totalLeads: previousLeads.length || mockStatsData.previousPeriod.totalLeads,
      emailsSent: mockStatsData.previousPeriod.emailsSent,
      conversions: previousConversions || mockStatsData.previousPeriod.conversions,
      avgRate: previousLeads.length > 0
        ? (previousConversions / previousLeads.length) * 100
        : mockStatsData.previousPeriod.avgRate,
    },
    leadsTrend: mockStatsData.leadsTrend,
    sourceBreakdown: mockStatsData.sourceBreakdown,
  };
}
