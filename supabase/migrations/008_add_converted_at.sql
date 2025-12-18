-- Migration: Add converted_at column to track when leads were converted
-- Run this in your Supabase SQL Editor

-- Add converted_at column
ALTER TABLE leads ADD COLUMN IF NOT EXISTS converted_at TIMESTAMP WITH TIME ZONE;

-- Create index for converted_at queries
CREATE INDEX IF NOT EXISTS idx_leads_converted_at ON leads(converted_at);

-- Backfill: Set converted_at to NOW() for any existing converted leads that don't have it
UPDATE leads
SET converted_at = NOW()
WHERE stage = 'converted' AND converted_at IS NULL;
