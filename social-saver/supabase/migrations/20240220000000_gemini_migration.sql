-- Migration: Switch from OpenAI embeddings (1536 dims) to Gemini embeddings (3072 dims)
-- Also adds rate_limits table for usage tracking
-- 1. Clear existing OpenAI embeddings (will be regenerated with Gemini)
UPDATE saves
SET embedding = NULL;
-- 2. Alter the embedding column to use 3072 dimensions (Gemini embedding-001)
ALTER TABLE saves
ALTER COLUMN embedding TYPE vector(3072);
-- 3. Update match_saves function for new dimensions
DROP FUNCTION IF EXISTS match_saves;
CREATE OR REPLACE FUNCTION match_saves (
        query_embedding vector(3072),
        match_threshold float,
        match_count int
    ) RETURNS TABLE (
        id uuid,
        title text,
        url text,
        category text,
        summary text,
        similarity float
    ) LANGUAGE plpgsql AS $$ BEGIN RETURN QUERY
SELECT saves.id,
    saves.title,
    saves.url,
    saves.category,
    saves.summary,
    1 - (saves.embedding <=> query_embedding) as similarity
FROM saves
WHERE saves.embedding IS NOT NULL
    AND 1 - (saves.embedding <=> query_embedding) > match_threshold
ORDER BY saves.embedding <=> query_embedding
LIMIT match_count;
END;
$$;
-- 4. Create rate_limits table
CREATE TABLE IF NOT EXISTS rate_limits (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    identifier text NOT NULL,
    endpoint text NOT NULL,
    request_count int DEFAULT 1,
    window_start timestamptz DEFAULT now(),
    created_at timestamptz DEFAULT now()
);
-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_rate_limits_lookup ON rate_limits (identifier, endpoint, window_start);