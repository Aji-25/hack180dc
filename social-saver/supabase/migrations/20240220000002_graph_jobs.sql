-- 20240220000002_graph_jobs.sql
-- Job queue for async Neo4j graph upserts.
-- Allows fire-and-forget from whatsapp-webhook without blocking the TwiML reply.
CREATE TABLE IF NOT EXISTS graph_jobs (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_phone text NOT NULL,
    save_id uuid NOT NULL REFERENCES saves(id) ON DELETE CASCADE,
    status text NOT NULL DEFAULT 'pending' CHECK (
        status IN ('pending', 'processing', 'done', 'error')
    ),
    attempts int NOT NULL DEFAULT 0,
    last_error text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);
-- Index for fast pending-job polling
CREATE INDEX IF NOT EXISTS idx_graph_jobs_pending ON graph_jobs (status, created_at)
WHERE status IN ('pending', 'error');
-- Index for looking up by save_id (dedup checks)
CREATE INDEX IF NOT EXISTS idx_graph_jobs_save_id ON graph_jobs (save_id);