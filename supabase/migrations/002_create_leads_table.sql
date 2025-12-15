-- Migration: Create leads table with all fields
-- Run this in your Supabase SQL Editor

-- Create leads table if not exists
CREATE TABLE IF NOT EXISTS leads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  company TEXT DEFAULT '',
  email TEXT NOT NULL,
  phone TEXT,
  stage TEXT NOT NULL DEFAULT 'new' CHECK (stage IN ('new', 'interested', 'contacted', 'negotiation', 'demo', 'converted', 'lost')),
  source TEXT NOT NULL DEFAULT 'website' CHECK (source IN ('website', 'linkedin', 'referral', 'email', 'instagram', 'meta_ads', 'google_ads', 'other')),
  owner TEXT NOT NULL DEFAULT 'Heath Maes',
  conversion_probability INTEGER DEFAULT 20,
  revenue DECIMAL(10, 2),
  notes TEXT,
  last_contacted TIMESTAMP WITH TIME ZONE,
  archived BOOLEAN DEFAULT FALSE,
  meta_lead_id TEXT UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_leads_stage ON leads(stage);
CREATE INDEX IF NOT EXISTS idx_leads_source ON leads(source);
CREATE INDEX IF NOT EXISTS idx_leads_owner ON leads(owner);
CREATE INDEX IF NOT EXISTS idx_leads_archived ON leads(archived);
CREATE INDEX IF NOT EXISTS idx_leads_email ON leads(email);

-- Enable Row Level Security
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

-- Allow all operations for authenticated users and service role
CREATE POLICY "Allow all for authenticated users" ON leads
  FOR ALL USING (true);

-- Function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to auto-update updated_at
DROP TRIGGER IF EXISTS update_leads_updated_at ON leads;
CREATE TRIGGER update_leads_updated_at
  BEFORE UPDATE ON leads
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
