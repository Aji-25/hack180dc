-- 20240222000004_hnsw_index_and_sha256.sql
-- Three improvements:
-- 1. HNSW vector index — O(log n) similarity search (was full table scan)
-- 2. SHA-256 url_hash — stronger collision resistance than MD5
-- 3. match_saves hardened with SET search_path + CTE refactor
-- ── 1. Enable pgcrypto (required for sha256 / encode) ────────────────────────
CREATE EXTENSION IF NOT EXISTS pgcrypto;
-- ── 2. HNSW vector index ──────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_saves_embedding ON saves USING hnsw (embedding vector_cosine_ops);
-- ── 3. SHA-256 url_hash ───────────────────────────────────────────────────────
-- Generated columns cannot be altered in place — must drop + recreate.
-- Drop UNIQUE index first, then column, then recreate both.
DROP INDEX IF EXISTS idx_saves_user_url;
ALTER TABLE saves DROP COLUMN IF EXISTS url_hash;
ALTER TABLE saves
ADD COLUMN url_hash TEXT GENERATED ALWAYS AS (encode(sha256(url::bytea), 'hex')) STORED;
CREATE UNIQUE INDEX idx_saves_user_url ON saves (user_phone, url_hash);
-- ── 4. Hardened match_saves with search_path + CTE ───────────────────────────
-- The CTE avoids computing the distance expression 3x per row.
CREATE OR REPLACE FUNCTION match_saves (
        query_embedding vector(1536),
        match_threshold float,
        match_count int
    ) RETURNS TABLE (
        id uuid,
        title text,
        url text,
        category text,
        summary text,
        similarity float
    ) LANGUAGE plpgsql
SET search_path = '' AS $$ BEGIN RETURN QUERY WITH ranked AS (
        SELECT saves.id,
            saves.title,
            saves.url,
            saves.category,
            saves.summary,
            1 - (saves.embedding <=> query_embedding) AS similarity
        FROM saves
        WHERE saves.embedding IS NOT NULL
    )
SELECT ranked.id,
    ranked.title,
    ranked.url,
    ranked.category,
    ranked.summary,
    ranked.similarity
FROM ranked
WHERE ranked.similarity > match_threshold
ORDER BY ranked.similarity DESC
LIMIT match_count;
END;
$$;