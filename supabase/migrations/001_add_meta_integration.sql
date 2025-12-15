-- Migration: Add Meta Ads Integration
-- Run this in your Supabase SQL Editor

-- Add meta_lead_id to leads table
ALTER TABLE leads ADD COLUMN IF NOT EXISTS meta_lead_id TEXT UNIQUE;

-- Update source constraint to include meta_ads
ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_source_check;
ALTER TABLE leads ADD CONSTRAINT leads_source_check
  CHECK (source IN ('website', 'linkedin', 'referral', 'email', 'webinar', 'meta_ads', 'google_ads', 'other'));

-- Create meta_connections table for storing Facebook/Meta OAuth tokens
CREATE TABLE IF NOT EXISTS meta_connections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL,
  user_name TEXT NOT NULL,
  page_id TEXT UNIQUE NOT NULL,
  page_name TEXT NOT NULL,
  page_access_token TEXT NOT NULL,
  user_access_token TEXT NOT NULL,
  connected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_meta_connections_page_id ON meta_connections(page_id);
CREATE INDEX IF NOT EXISTS idx_leads_meta_lead_id ON leads(meta_lead_id);

-- Enable RLS on meta_connections
ALTER TABLE meta_connections ENABLE ROW LEVEL SECURITY;

-- Allow service role to manage meta_connections (used by webhooks)
CREATE POLICY "Service role can manage meta connections" ON meta_connections
  FOR ALL USING (true);

-- Trigger to auto-update updated_at for meta_connections
CREATE TRIGGER update_meta_connections_updated_at
  BEFORE UPDATE ON meta_connections
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
