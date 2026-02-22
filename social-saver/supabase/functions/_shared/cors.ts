// @ts-nocheck
// supabase/functions/_shared/cors.ts
// Shared CORS headers for all edge functions.
// Note: Access-Control-Allow-Origin is intentionally kept as '*' because
// Supabase Edge Functions don't know the caller's origin at module init time.
// Write endpoints (update-save, delete-save) are protected by:
//   1. RLS: only service_role can write to DB (not the anon key)
//   2. Phone hash ownership check: can only mutate rows that match user_phone
//   3. Existing rate limiting in whatsapp-webhook for inbound requests

export const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}
