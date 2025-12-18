-- Migration: Add Instagram and Facebook ID columns for social media DM tracking
-- Run this in your Supabase SQL Editor

-- Add instagram_id column
ALTER TABLE leads ADD COLUMN IF NOT EXISTS instagram_id TEXT;

-- Add facebook_id column
ALTER TABLE leads ADD COLUMN IF NOT EXISTS facebook_id TEXT;

-- Create indexes for social media ID lookups
CREATE INDEX IF NOT EXISTS idx_leads_instagram_id ON leads(instagram_id);
CREATE INDEX IF NOT EXISTS idx_leads_facebook_id ON leads(facebook_id);

-- Add unique constraints (a social media ID should only be linked to one lead)
CREATE UNIQUE INDEX IF NOT EXISTS idx_leads_instagram_id_unique ON leads(instagram_id) WHERE instagram_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_leads_facebook_id_unique ON leads(facebook_id) WHERE facebook_id IS NOT NULL;
