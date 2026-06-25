import type { StorageBackend, UsageEvent, UsageQuery } from '@observatory/core';

export interface PgConfig {
  connectionString: string;
  schema?: string;
}

interface PgRow {
  id: string;
  timestamp: Date;
  model: string;
  provider: string;
  requested_model: string | null;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  cost: number;
  latency_ms: number;
  status: string;
  error: string | null;
  streaming: boolean | null;
  time_to_first_token_ms: number | null;
  cache_read_tokens: number | null;
  cache_write_tokens: number | null;
  pricing_miss: boolean | null;
  user_id: string | null;
  user_name: string | null;
  user_email: string | null;
  user_team: string | null;
  user_plan: string | null;
  task_id: string | null;
  task_title: string | null;
  task_type: string | null;
  task_priority: string | null;
  session_id: string | null;
  conversation_id: string | null;
  parent_call_id: string | null;
  labels: Record<string, string>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Sql = any;

export class PgBackend implements StorageBackend {
  private sql: Sql | null;
  private readonly schema: string;
  private readonly connectionString: string;

  constructor(config: PgConfig) {
    this.schema = config.schema ?? 'observatory';
    this.connectionString = config.connectionString;
    this.sql = null;
  }

  private async initSql(): Promise<void> {
    if (this.sql) return;
    const { default: postgres } = await import('postgres');
    this.sql = postgres(this.connectionString);
  }

  static eventToRow(event: UsageEvent): PgRow {
    return {
      id: event.id,
      timestamp: event.timestamp,
      model: event.model,
      provider: event.provider,
      requested_model: event.requested_model ?? null,
      input_tokens: event.input_tokens,
      output_tokens: event.output_tokens,
      total_tokens: event.total_tokens,
      cost: event.cost,
      latency_ms: event.latency_ms,
      status: event.status,
      error: event.error ?? null,
      streaming: event.streaming ?? null,
      time_to_first_token_ms: event.time_to_first_token_ms ?? null,
      cache_read_tokens: event.cache_read_tokens ?? null,
      cache_write_tokens: event.cache_write_tokens ?? null,
      pricing_miss: event.pricing_miss ?? null,
      user_id: event.context?.user?.id ?? null,
      user_name: event.context?.user?.name ?? null,
      user_email: event.context?.user?.email ?? null,
      user_team: event.context?.user?.team ?? null,
      user_plan: event.context?.user?.plan ?? null,
      task_id: event.context?.task?.id ?? null,
      task_title: event.context?.task?.title ?? null,
      task_type: event.context?.task?.type ?? null,
      task_priority: event.context?.task?.priority ?? null,
      session_id: event.context?.session?.id ?? null,
      conversation_id: event.context?.session?.conversationId ?? null,
      parent_call_id: event.context?.session?.parentCallId ?? null,
      labels: event.context?.labels ?? {},
    };
  }

  async write(events: UsageEvent[]): Promise<void> {
    await this.initSql();
    const sql = this.sql!;
    const rows = events.map(PgBackend.eventToRow);

    await sql`
      INSERT INTO ${sql(this.schema)}.usage_events ${sql(rows)}
    `;
  }

  async query(query: UsageQuery): Promise<UsageEvent[]> {
    await this.initSql();
    const sql = this.sql!;

    const rows = await sql`
      SELECT * FROM ${sql(this.schema)}.usage_events
      WHERE timestamp >= ${query.from} AND timestamp <= ${query.to}
      ${query.user ? sql`AND user_id = ${query.user}` : sql``}
      ${query.model ? sql`AND model = ${query.model}` : sql``}
      ${query.provider ? sql`AND provider = ${query.provider}` : sql``}
      ${query.task ? sql`AND task_id = ${query.task}` : sql``}
      ${query.session ? sql`AND session_id = ${query.session}` : sql``}
      ORDER BY timestamp DESC
      LIMIT 1000
    `;

    return rows.map(rowToEvent);
  }

  async close(): Promise<void> {
    if (!this.sql) return;
    const sql = this.sql;
    await sql.end();
  }
}

function rowToEvent(row: Record<string, unknown>): UsageEvent {
  return {
    id: row.id as string,
    timestamp: row.timestamp as Date,
    model: row.model as string,
    provider: row.provider as string,
    requested_model: (row.requested_model as string) || undefined,
    input_tokens: row.input_tokens as number,
    output_tokens: row.output_tokens as number,
    total_tokens: row.total_tokens as number,
    cost: Number(row.cost),
    latency_ms: Number(row.latency_ms),
    status: row.status as 'success' | 'error',
    error: (row.error as string) || undefined,
    streaming: (row.streaming as boolean) || undefined,
    time_to_first_token_ms: row.time_to_first_token_ms ? Number(row.time_to_first_token_ms) : undefined,
    cache_read_tokens: (row.cache_read_tokens as number) || undefined,
    cache_write_tokens: (row.cache_write_tokens as number) || undefined,
    pricing_miss: (row.pricing_miss as boolean) || undefined,
    context: {
      user: row.user_id ? {
        id: row.user_id as string,
        name: (row.user_name as string) || undefined,
        email: (row.user_email as string) || undefined,
        team: (row.user_team as string) || undefined,
        plan: (row.user_plan as string) || undefined,
      } : undefined,
      task: row.task_id ? {
        id: row.task_id as string,
        title: (row.task_title as string) || undefined,
        type: (row.task_type as string) || undefined,
        priority: (row.task_priority as 'low' | 'medium' | 'high' | 'critical') || undefined,
      } : undefined,
      session: row.session_id ? {
        id: row.session_id as string,
        conversationId: (row.conversation_id as string) || undefined,
        parentCallId: (row.parent_call_id as string) || undefined,
      } : undefined,
      labels: (row.labels as Record<string, string>) || undefined,
    },
  };
}
