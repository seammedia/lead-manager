-- Migration: Add 'called' and 'onboarding_sent' stages to leads table
-- New stages order: new, contacted_1, contacted_2, called, not_interested, interested, onboarding_sent, converted

-- Step 1: Drop old constraint
ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_stage_check;

-- Step 2: Add new constraint with updated stages
ALTER TABLE leads ADD CONSTRAINT leads_stage_check
  CHECK (stage IN ('new', 'contacted_1', 'contacted_2', 'called', 'not_interested', 'interested', 'onboarding_sent', 'converted'));
