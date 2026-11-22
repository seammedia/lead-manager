-- Fix RLS policies for business_context and settings tables
-- These tables should only be accessible via service role (server-side API routes)
-- This migration restricts direct access from anon/authenticated users

-- ============================================
-- Fix business_context table RLS
-- ============================================

-- Drop the existing permissive policy
DROP POLICY IF EXISTS "Service role can manage business_context" ON business_context;

-- Create restrictive policy that blocks direct access
-- Service role bypasses RLS entirely, so API routes will still work
CREATE POLICY "No direct access to business_context" ON business_context
  FOR ALL
  USING (false)
  WITH CHECK (false);

-- ============================================
-- Fix settings table RLS
-- ============================================

-- Enable RLS on settings table (may not have been enabled)
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- Drop any existing permissive policies
DROP POLICY IF EXISTS "Service role can manage settings" ON settings;

-- Create restrictive policy that blocks direct access
-- Service role bypasses RLS entirely, so API routes will still work
CREATE POLICY "No direct access to settings" ON settings
  FOR ALL
  USING (false)
  WITH CHECK (false);

-- ============================================
-- Notes:
-- ============================================
-- - Service role key bypasses RLS completely
-- - All your API routes use service role, so they will continue working
-- - This blocks anyone with just the anon key from accessing these tables
-- - The settings table contains sensitive Gmail tokens, so this is important
