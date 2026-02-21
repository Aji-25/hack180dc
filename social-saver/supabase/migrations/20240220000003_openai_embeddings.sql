-- Fix embedding dimensions: 3072 (gemini-embedding-001) → 1536 (text-embedding-3-small)
-- Clears all existing embeddings and resizes the column + match function.
UPDATE saves
SET embedding = NULL;
ALTER TABLE saves
ALTER COLUMN embedding TYPE vector(1536);
DROP FUNCTION IF EXISTS match_saves;
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