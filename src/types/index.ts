export type LeadStage = "new" | "interested" | "contacted" | "negotiation" | "demo" | "converted" | "lost";

export type LeadSource = "website" | "linkedin" | "referral" | "email" | "webinar" | "meta_ads" | "google_ads" | "other";

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
  notes: string | null;
  last_contacted: string | null;
  created_at: string;
  updated_at: string;
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

export type TimePeriod = "7" | "14" | "30";
