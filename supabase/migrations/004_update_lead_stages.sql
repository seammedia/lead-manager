-- Migration: Update lead stages to new system
-- Old stages: new, interested, contacted, negotiation, demo, converted, lost
-- New stages: new, contacted_1, interested, contacted_2, not_interested, converted

-- Step 1: Update existing leads to new stage values
UPDATE leads SET stage = 'contacted_1' WHERE stage = 'contacted';
UPDATE leads SET stage = 'contacted_2' WHERE stage = 'negotiation';
UPDATE leads SET stage = 'contacted_2' WHERE stage = 'demo';
UPDATE leads SET stage = 'not_interested' WHERE stage = 'lost';

-- Step 2: Drop old constraint
ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_stage_check;

-- Step 3: Add new constraint with updated stages
ALTER TABLE leads ADD CONSTRAINT leads_stage_check
  CHECK (stage IN ('new', 'contacted_1', 'interested', 'contacted_2', 'not_interested', 'converted'));
