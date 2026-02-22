-- 20240222000001_hash_existing_phones.sql
-- One-time backfill: SHA-256 hash any raw phone numbers that exist in the DB.
-- Matches the hashPhone() function in whatsapp-webhook/index.ts (lowercase + trim → sha256 → hex).
-- The WHERE clause guards against double-hashing (hashes are 64-char hex, not starting with + or "whatsapp:").
-- Safe to run multiple times.
UPDATE saves
SET user_phone = encode(sha256(lower(user_phone)::bytea), 'hex')
WHERE user_phone LIKE 'whatsapp:%'
    OR user_phone LIKE '+%';
UPDATE graph_jobs
SET user_phone = encode(sha256(lower(user_phone)::bytea), 'hex')
WHERE user_phone LIKE 'whatsapp:%'
    OR user_phone LIKE '+%';
UPDATE failed_graph_jobs
SET user_phone = encode(sha256(lower(user_phone)::bytea), 'hex')
WHERE user_phone LIKE 'whatsapp:%'
    OR user_phone LIKE '+%';
-- rate_limits uses 'identifier' column (not 'user_phone')
UPDATE rate_limits
SET identifier = encode(sha256(lower(identifier)::bytea), 'hex')
WHERE identifier LIKE 'whatsapp:%'
    OR identifier LIKE '+%';