import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

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
          stage: "new" | "interested" | "contacted" | "negotiation" | "demo" | "converted" | "lost";
          source: "website" | "linkedin" | "referral" | "email" | "webinar" | "other";
          owner: string;
          conversion_probability: number;
          notes: string | null;
          last_contacted: string | null;
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
