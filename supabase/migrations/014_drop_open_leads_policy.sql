-- Close public access to leads (23 Nov 2026)
-- The "Allow all for authenticated users" policy applied to every role (USING true), so the public anon key
-- could read, change and delete every lead. The app reads and writes leads only through the service role,
-- which bypasses RLS, so dropping it changes nothing for the app. Applied to production 23 Nov 2026.
DROP POLICY IF EXISTS "Allow all for authenticated users" ON public.leads;
