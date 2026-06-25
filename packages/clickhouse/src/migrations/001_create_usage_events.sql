CREATE TABLE IF NOT EXISTS observatory.usage_events (
  id String,
  timestamp DateTime64(3, 'UTC'),
  model LowCardinality(String),
  provider LowCardinality(String),
  requested_model Nullable(String),
  input_tokens UInt32,
  output_tokens UInt32,
  total_tokens UInt32,
  cost Decimal64(6),
  latency_ms Float32,
  status LowCardinality(String),
  error Nullable(String),
  streaming Nullable(UInt8),
  time_to_first_token_ms Nullable(Float32),
  cache_read_tokens Nullable(UInt32),
  cache_write_tokens Nullable(UInt32),
  pricing_miss Nullable(UInt8),
  user_id Nullable(String),
  user_team Nullable(LowCardinality(String)),
  task_id Nullable(String),
  task_type Nullable(LowCardinality(String)),
  session_id Nullable(String),
  labels Map(String, String)
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(timestamp)
ORDER BY (timestamp, provider, model)
TTL timestamp + INTERVAL 1 YEAR;
