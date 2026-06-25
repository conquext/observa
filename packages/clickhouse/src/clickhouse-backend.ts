import type { StorageBackend, UsageEvent, UsageQuery } from '@conquext/core';

export interface ClickHouseConfig {
  url: string;
  database?: string;
  username?: string;
  password?: string;
}

export class ClickHouseBackend implements StorageBackend {
  private client: unknown;
  private clientPromise: Promise<void> | null = null;
  private readonly database: string;
  private readonly config: ClickHouseConfig;

  constructor(config: ClickHouseConfig) {
    this.database = config.database ?? 'observatory';
    this.config = config;
  }

  private async ensureClient(): Promise<void> {
    if (this.client) return;
    if (!this.clientPromise) {
      this.clientPromise = this.initClient(this.config);
    }
    await this.clientPromise;
  }

  private async initClient(config: ClickHouseConfig): Promise<void> {
    const { createClient } = await import('@clickhouse/client');
    this.client = createClient({
      url: config.url,
      database: this.database,
      username: config.username,
      password: config.password,
    });
  }

  static eventToRow(event: UsageEvent): Record<string, unknown> {
    return {
      id: event.id,
      timestamp: event.timestamp.toISOString(),
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
      streaming: event.streaming ? 1 : null,
      time_to_first_token_ms: event.time_to_first_token_ms ?? null,
      cache_read_tokens: event.cache_read_tokens ?? null,
      cache_write_tokens: event.cache_write_tokens ?? null,
      pricing_miss: event.pricing_miss ? 1 : null,
      user_id: event.context?.user?.id ?? null,
      user_team: event.context?.user?.team ?? null,
      task_id: event.context?.task?.id ?? null,
      task_type: event.context?.task?.type ?? null,
      session_id: event.context?.session?.id ?? null,
      labels: event.context?.labels ?? {},
    };
  }

  async write(events: UsageEvent[]): Promise<void> {
    await this.ensureClient();
    const client = this.client as { insert: (params: unknown) => Promise<void> };
    const rows = events.map(ClickHouseBackend.eventToRow);

    await client.insert({
      table: 'usage_events',
      values: rows,
      format: 'JSONEachRow',
    });
  }

  async query(_query: UsageQuery): Promise<UsageEvent[]> {
    await this.ensureClient();
    throw new Error('query() is not yet implemented for ClickHouseBackend');
  }

  async close(): Promise<void> {
    await this.ensureClient();
    const client = this.client as { close: () => Promise<void> };
    if (client) await client.close();
  }
}
