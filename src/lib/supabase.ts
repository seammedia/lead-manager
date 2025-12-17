import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Service role client for server-side operations (webhooks, etc.)
export function getServiceSupabase() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  }
  return createClient(supabaseUrl, serviceRoleKey);
}

export type LeadStage = "new" | "contacted_1" | "interested" | "contacted_2" | "not_interested" | "converted";
export type LeadSource = "website" | "linkedin" | "referral" | "email" | "instagram" | "meta_ads" | "google_ads" | "other";

export type Database = {
  public: {
    Tables: {
      leads: {
        Row: {
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
          last_contacted: string | null;
          archived: boolean;
          meta_lead_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["leads"]["Row"], "id" | "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["leads"]["Insert"]>;
      };
      email_logs: {
        Row: {
          id: string;
          lead_id: string;
          subject: string;
          body: string;
          sent_at: string;
          gmail_message_id: string | null;
        };
        Insert: Omit<Database["public"]["Tables"]["email_logs"]["Row"], "id">;
        Update: Partial<Database["public"]["Tables"]["email_logs"]["Insert"]>;
      };
      activities: {
        Row: {
          id: string;
          lead_id: string;
          type: "email" | "call" | "meeting" | "note" | "stage_change";
          description: string;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["activities"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["activities"]["Insert"]>;
      };
    };
  };
};
