-- 20240222000000_failed_graph_jobs.sql
-- Dead-letter queue for Neo4j graph upsert jobs.
-- When a graph_jobs row fails 3 times (MAX_ATTEMPTS), process-graph-jobs
-- moves it here for manual review rather than silently dropping it.
--
-- Also adds 'dead' to the graph_jobs status constraint so exhausted jobs
-- can be cleanly distinguished from transient errors.
-- 1. Add 'dead' to the graph_jobs status enum
ALTER TABLE graph_jobs DROP CONSTRAINT IF EXISTS graph_jobs_status_check;
ALTER TABLE graph_jobs
ADD CONSTRAINT graph_jobs_status_check CHECK (
        status IN ('pending', 'processing', 'done', 'error', 'dead')
    );
-- 2. Dead-letter table — stores jobs that exceeded MAX_ATTEMPTS
CREATE TABLE IF NOT EXISTS failed_graph_jobs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    original_job_id UUID NOT NULL,
    save_id UUID REFERENCES saves(id) ON DELETE CASCADE,
    user_phone TEXT NOT NULL,
    attempts INT NOT NULL DEFAULT 3,
    last_error TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
-- Fast lookup by save_id (for dedup + admin queries)
CREATE INDEX IF NOT EXISTS idx_failed_graph_jobs_save_id ON failed_graph_jobs (save_id);
-- Fast lookup by phone (for admin dashboards)
CREATE INDEX IF NOT EXISTS idx_failed_graph_jobs_phone ON failed_graph_jobs (user_phone);
COMMENT ON TABLE failed_graph_jobs IS 'Dead-letter queue: Neo4j graph upsert jobs that failed >= 3 times. Requires manual review or requeue.';