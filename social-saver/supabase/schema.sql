-- ============================================
-- Social Saver Bot — Supabase Schema
-- Run in Supabase SQL Editor
-- ============================================
-- Saves table
CREATE TABLE IF NOT EXISTS saves (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT now(),
    user_phone TEXT NOT NULL,
    url TEXT NOT NULL,
    url_hash TEXT GENERATED ALWAYS AS (md5(url)) STORED,
    source TEXT DEFAULT 'other',
    title TEXT,
    note TEXT,
    raw_text TEXT,
    category TEXT DEFAULT 'Other',
    tags TEXT [] DEFAULT '{}',
    summary TEXT,
    status TEXT DEFAULT 'complete',
    -- 'pending_note' | 'complete' | 'error'
    error_msg TEXT,
    -- stores last error for debugging
    action_steps TEXT [] DEFAULT '{}' -- actionable steps extracted by LLM
);
-- Unique constraint: same user can't save same URL twice (dedup)
CREATE UNIQUE INDEX idx_saves_user_url ON saves (user_phone, url_hash);
-- Query indexes
CREATE INDEX idx_saves_user_created ON saves (user_phone, created_at DESC);
CREATE INDEX idx_saves_category ON saves (category);
CREATE INDEX idx_saves_status ON saves (status);
-- Full-text search (summary + title + note + tags combined)
ALTER TABLE saves
ADD COLUMN IF NOT EXISTS fts tsvector;
-- Create function to update fts
CREATE OR REPLACE FUNCTION handle_new_save() RETURNS trigger AS $$ BEGIN NEW.fts := to_tsvector(
        'english',
        coalesce(NEW.summary, '') || ' ' || coalesce(NEW.title, '') || ' ' || coalesce(NEW.note, '') || ' ' || coalesce(NEW.url, '') || ' ' || array_to_string(NEW.tags, ' ')
    );
RETURN NEW;
END;
$$ LANGUAGE plpgsql;
-- Create trigger to invoke the function
DROP TRIGGER IF EXISTS on_save_created ON saves;
CREATE TRIGGER on_save_created BEFORE
INSERT
    OR
UPDATE ON saves FOR EACH ROW EXECUTE PROCEDURE handle_new_save();
CREATE INDEX IF NOT EXISTS idx_saves_fts ON saves USING GIN (fts);
-- Row Level Security
ALTER TABLE saves ENABLE ROW LEVEL SECURITY;
-- Policy: allow reads only for matching user_phone via query param
-- For hackathon: allow select for everyone (dashboard is phone-filtered client-side)
-- Edge Functions use service_role key which bypasses RLS
CREATE POLICY "Allow public read" ON saves FOR
SELECT USING (true);
CREATE POLICY "Service role insert" ON saves FOR
INSERT WITH CHECK (true);
CREATE POLICY "Service role update" ON saves FOR
UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Allow delete" ON saves FOR DELETE USING (true);
-- Enable realtime for the saves table
ALTER PUBLICATION supabase_realtime
ADD TABLE saves;