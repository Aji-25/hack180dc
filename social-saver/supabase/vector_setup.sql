-- 1. Enable pgvector extension to work with embeddings
create extension if not exists vector;
-- 2. Add embedding column to saves table
-- text-embedding-3-small has 1536 dimensions
alter table saves
add column if not exists embedding vector(1536);
-- 3. Create a function to search for saves
create or replace function match_saves (
        query_embedding vector(1536),
        match_threshold float,
        match_count int
    ) returns table (
        id uuid,
        title text,
        summary text,
        category text,
        url text,
        similarity float
    ) language plpgsql as $$ begin return query
select saves.id,
    saves.title,
    saves.summary,
    saves.category,
    saves.url,
    1 - (saves.embedding <=> query_embedding) as similarity
from saves
where 1 - (saves.embedding <=> query_embedding) > match_threshold
order by saves.embedding <=> query_embedding
limit match_count;
end;
$$;