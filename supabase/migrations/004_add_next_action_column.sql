-- Add next_action column to leads table
ALTER TABLE leads ADD COLUMN IF NOT EXISTS next_action TEXT;
