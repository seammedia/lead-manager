export type LeadStage = "contacted_1" | "contacted_2" | "called" | "not_interested" | "no_response" | "not_qualified" | "interested" | "onboarding_sent" | "converted";

export type LeadSource = "website" | "linkedin" | "referral" | "email" | "instagram" | "meta_ads" | "google_ads" | "other";

export interface Lead {
  id: string;
  name: string;
  company: string;
  email: string;
  phone: string | null;
  stage: LeadStage;
  source: LeadSource;
  owner: string;
  conversion_probability: number;
  revenue: number | null;
  notes: string | null;
  next_action: string | null;
  last_contacted: string | null;
  created_at: string;
  updated_at: string;
  archived?: boolean;
}

export interface EmailLog {
  id: string;
  lead_id: string;
  subject: string;
  body: string;
  sent_at: string;
  gmail_message_id: string | null;
}

export interface Activity {
  id: string;
  lead_id: string;
  type: "email" | "call" | "meeting" | "note" | "stage_change";
  description: string;
  created_at: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  avatar_url: string | null;
}

export interface StatsData {
  totalLeads: number;
  emailsSent: number;
  conversions: number;
  avgRate: number;
  leadsTrend: { week: string; count: number }[];
  sourceBreakdown: { source: string; count: number; color: string }[];
  previousPeriod: {
    totalLeads: number;
    emailsSent: number;
    conversions: number;
    avgRate: number;
  };
}

export type TimePeriod = "7" | "14" | "30" | "this_month" | "last_month" | "custom";
