CREATE SCHEMA IF NOT EXISTS observatory;

CREATE TABLE IF NOT EXISTS observatory.usage_events (
  id TEXT PRIMARY KEY,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  model TEXT NOT NULL,
  provider TEXT NOT NULL,
  requested_model TEXT,
  input_tokens INTEGER NOT NULL,
  output_tokens INTEGER NOT NULL,
  total_tokens INTEGER NOT NULL,
  cost NUMERIC(12, 6) NOT NULL DEFAULT 0,
  latency_ms NUMERIC(10, 2) NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('success', 'error')),
  error TEXT,
  streaming BOOLEAN,
  time_to_first_token_ms NUMERIC(10, 2),
  cache_read_tokens INTEGER,
  cache_write_tokens INTEGER,
  pricing_miss BOOLEAN,
  user_id TEXT,
  user_name TEXT,
  user_email TEXT,
  user_team TEXT,
  user_plan TEXT,
  task_id TEXT,
  task_title TEXT,
  task_type TEXT,
  task_priority TEXT,
  session_id TEXT,
  conversation_id TEXT,
  parent_call_id TEXT,
  labels JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
) PARTITION BY RANGE (timestamp);

-- Create initial monthly partitions (3 months)
DO $$
DECLARE
  start_date DATE := DATE_TRUNC('month', CURRENT_DATE);
BEGIN
  FOR i IN 0..2 LOOP
    EXECUTE format(
      'CREATE TABLE IF NOT EXISTS observatory.usage_events_%s PARTITION OF observatory.usage_events FOR VALUES FROM (%L) TO (%L)',
      TO_CHAR(start_date + (i || ' months')::INTERVAL, 'YYYY_MM'),
      start_date + (i || ' months')::INTERVAL,
      start_date + ((i + 1) || ' months')::INTERVAL
    );
  END LOOP;
END $$;

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_usage_events_user_id ON observatory.usage_events (user_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_usage_events_model ON observatory.usage_events (model, timestamp);
CREATE INDEX IF NOT EXISTS idx_usage_events_provider ON observatory.usage_events (provider, timestamp);
CREATE INDEX IF NOT EXISTS idx_usage_events_task_id ON observatory.usage_events (task_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_usage_events_team ON observatory.usage_events (user_team, timestamp);
