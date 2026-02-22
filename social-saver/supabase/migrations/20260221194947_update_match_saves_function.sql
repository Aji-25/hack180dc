-- Drop existing function to avoid return type conflicts
drop function if exists match_saves;
-- Create a function to search for saves, filtering out soft deletes
create or replace function match_saves (
        query_embedding vector(1536),
        match_threshold float,
        match_count int,
        filter jsonb default '{}'::jsonb
    ) returns table (
        id uuid,
        title text,
        url text,
        category text,
        summary text,
        similarity float
    ) language plpgsql as $$ begin return query
select saves.id,
    saves.title,
    saves.url,
    saves.category,
    saves.summary,
    1 - (saves.embedding <=> query_embedding) as similarity
from saves
where 1 - (saves.embedding <=> query_embedding) > match_threshold
    and is_deleted = COALESCE((filter->>'is_deleted')::boolean, is_deleted)
order by saves.embedding <=> query_embedding
limit match_count;
end;
$$;