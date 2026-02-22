-- 20240222000003_rls_service_role_only.sql
-- Lock saves table so ONLY service_role (edge functions) can read/write.
-- The anon key (browser) will be blocked from all direct DB access.
-- All UI reads must go through get-saves edge function (service_role).
-- All UI writes must go through update-save / delete-save edge functions.
-- Drop all existing saves policies (covers both old open and previous tightened versions)
DROP POLICY IF EXISTS "Allow public read" ON saves;
DROP POLICY IF EXISTS "reads_open" ON saves;
DROP POLICY IF EXISTS "Service role insert" ON saves;
DROP POLICY IF EXISTS "inserts_service_role_only" ON saves;
DROP POLICY IF EXISTS "service_role_insert" ON saves;
DROP POLICY IF EXISTS "Service role update" ON saves;
DROP POLICY IF EXISTS "updates_service_role_only" ON saves;
DROP POLICY IF EXISTS "service_role_update" ON saves;
DROP POLICY IF EXISTS "Allow delete" ON saves;
DROP POLICY IF EXISTS "deletes_service_role_only" ON saves;
DROP POLICY IF EXISTS "service_role_delete" ON saves;
DROP POLICY IF EXISTS "service_role_select" ON saves;
-- New: all operations restricted to service_role only
-- Edge functions use SUPABASE_SERVICE_ROLE_KEY → allowed
-- Browser anon key → blocked for everything
CREATE POLICY "service_role_select" ON saves FOR
SELECT USING (auth.role() = 'service_role');
CREATE POLICY "service_role_insert" ON saves FOR
INSERT WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "service_role_update" ON saves FOR
UPDATE USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "service_role_delete" ON saves FOR DELETE USING (auth.role() = 'service_role');