-- Add content column for full text / transcripts
alter table saves
add column if not exists content text;
-- Optional: Add a function to search within content specifically (if needed later)
-- For now, the existing `match_saves` uses the embedding which will be generated FROM the content.