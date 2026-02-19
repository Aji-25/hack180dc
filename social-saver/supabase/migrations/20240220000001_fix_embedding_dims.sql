-- Fix embedding dimensions: 768 → 3072 (gemini-embedding-001 actual output)
-- Also ensures rate_limits table exists
UPDATE saves
SET embedding = NULL;
ALTER TABLE saves
ALTER COLUMN embedding TYPE vector(3072);
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
CREATE TABLE IF NOT EXISTS rate_limits (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    identifier text NOT NULL,
    endpoint text NOT NULL,
    request_count int DEFAULT 1,
    window_start timestamptz DEFAULT now(),
    created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_rate_limits_lookup ON rate_limits (identifier, endpoint, window_start);