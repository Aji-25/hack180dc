-- 20240222000005_graph_jobs_trigger.sql
-- Deferred fix: graph_jobs table needs an auto-update trigger for updated_at.
-- Without this, updated_at stays frozen at insert time, making job status
-- monitoring and queue debugging unreliable.
CREATE OR REPLACE FUNCTION set_graph_jobs_updated_at() RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now();
RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_graph_jobs_updated_at ON graph_jobs;
CREATE TRIGGER trg_graph_jobs_updated_at BEFORE
UPDATE ON graph_jobs FOR EACH ROW EXECUTE FUNCTION set_graph_jobs_updated_at();