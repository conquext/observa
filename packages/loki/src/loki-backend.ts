import type { StorageBackend, UsageEvent, UsageQuery } from '@conquext/observa-core';

export interface LokiConfig {
  url: string;
  labels?: Record<string, string>;
  auth?: { username: string; password: string } | { token: string };
}

interface LokiStream {
  stream: Record<string, string>;
  values: [string, string, Record<string, string>?][];
}

export class LokiBackend implements StorageBackend {
  private readonly pushUrl: string;
  private readonly staticLabels: Record<string, string>;
  private readonly authHeader?: string;

  constructor(config: LokiConfig) {
    this.pushUrl = `${config.url.replace(/\/$/, '')}/loki/api/v1/push`;
    this.staticLabels = config.labels ?? {};

    if (config.auth) {
      if ('token' in config.auth) {
        this.authHeader = `Bearer ${config.auth.token}`;
      } else {
        this.authHeader = `Basic ${btoa(`${config.auth.username}:${config.auth.password}`)}`;
      }
    }
  }

  async write(events: UsageEvent[]): Promise<void> {
    const streams: LokiStream[] = events.map((event) => this.eventToStream(event));

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.authHeader) headers.Authorization = this.authHeader;

    const response = await fetch(this.pushUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({ streams }),
    });

    if (!response.ok) {
      throw new Error(`Loki push failed: ${response.status} ${response.statusText}`);
    }
  }

  async query(_query: UsageQuery): Promise<UsageEvent[]> {
    throw new Error('query() is not yet implemented for LokiBackend');
  }

  async close(): Promise<void> {
    // No-op: Loki backend uses stateless HTTP via fetch, no persistent connections to close
  }

  private eventToStream(event: UsageEvent): LokiStream {
    // Low-cardinality fields → labels
    const stream: Record<string, string> = {
      job: 'observatory',
      provider: event.provider,
      model: event.model,
      status: event.status,
      ...this.staticLabels,
    };

    if (event.context?.user?.id) stream.user_id = event.context.user.id;
    if (event.context?.user?.team) stream.team = event.context.user.team;
    if (event.context?.task?.type) stream.task_type = event.context.task.type;

    // High-cardinality fields → structured metadata
    const metadata: Record<string, string> = {};
    if (event.context?.task?.id) metadata.task_id = event.context.task.id;
    if (event.context?.session?.id) metadata.session_id = event.context.session.id;
    if (event.context?.session?.conversationId) metadata.conversation_id = event.context.session.conversationId;
    if (event.context?.user?.name) metadata.user_name = event.context.user.name;
    if (event.context?.user?.email) metadata.user_email = event.context.user.email;
    if (event.context?.user?.plan) metadata.user_plan = event.context.user.plan;

    // Token/cost data → log line JSON
    const logLine: Record<string, unknown> = {
      id: event.id,
      input_tokens: event.input_tokens,
      output_tokens: event.output_tokens,
      total_tokens: event.total_tokens,
      cost: event.cost,
      latency_ms: event.latency_ms,
    };
    if (event.error) logLine.error = event.error;
    if (event.streaming) logLine.streaming = event.streaming;
    if (event.time_to_first_token_ms != null) logLine.ttft_ms = event.time_to_first_token_ms;
    if (event.cache_read_tokens != null) logLine.cache_read_tokens = event.cache_read_tokens;
    if (event.cache_write_tokens != null) logLine.cache_write_tokens = event.cache_write_tokens;
    if (event.requested_model) logLine.requested_model = event.requested_model;
    if (event.pricing_miss) logLine.pricing_miss = true;

    // Add custom labels
    if (event.context?.labels) {
      for (const [key, value] of Object.entries(event.context.labels)) {
        logLine[`label_${key}`] = value;
      }
    }

    const timestamp = (event.timestamp.getTime() * 1_000_000).toString(); // nanoseconds

    const values: [string, string, Record<string, string>?][] = Object.keys(metadata).length > 0
      ? [[timestamp, JSON.stringify(logLine), metadata]]
      : [[timestamp, JSON.stringify(logLine)]];

    return { stream, values };
  }
}
