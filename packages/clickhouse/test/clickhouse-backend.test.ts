import { describe, it, expect } from 'vitest';
import { ClickHouseBackend } from '../src/clickhouse-backend.js';
import type { UsageEvent } from '@conquext/core';

const makeEvent = (): UsageEvent => ({
  id: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
  timestamp: new Date('2025-06-01T12:00:00Z'),
  model: 'gpt-4o',
  provider: 'openai',
  input_tokens: 100,
  output_tokens: 50,
  total_tokens: 150,
  cost: 0.001,
  latency_ms: 500,
  status: 'success',
  context: {
    user: { id: 'u1', team: 'eng' },
    labels: { env: 'prod' },
  },
});

describe('ClickHouseBackend', () => {
  it('maps UsageEvent to correct row format', () => {
    const row = ClickHouseBackend.eventToRow(makeEvent());
    expect(row.model).toBe('gpt-4o');
    expect(row.user_id).toBe('u1');
    expect(row.labels).toEqual({ env: 'prod' });
    expect(row.streaming).toBeNull();
  });

  it('maps timestamp to ISO string', () => {
    const row = ClickHouseBackend.eventToRow(makeEvent());
    expect(row.timestamp).toBe('2025-06-01T12:00:00.000Z');
  });

  it('maps boolean streaming to 1 or null', () => {
    const event1 = { ...makeEvent(), streaming: true };
    const row1 = ClickHouseBackend.eventToRow(event1);
    expect(row1.streaming).toBe(1);

    const event2 = { ...makeEvent(), streaming: false };
    const row2 = ClickHouseBackend.eventToRow(event2);
    expect(row2.streaming).toBeNull();

    const event3 = makeEvent();
    const row3 = ClickHouseBackend.eventToRow(event3);
    expect(row3.streaming).toBeNull();
  });

  it('maps boolean pricing_miss to 1 or null', () => {
    const event1 = { ...makeEvent(), pricing_miss: true };
    const row1 = ClickHouseBackend.eventToRow(event1);
    expect(row1.pricing_miss).toBe(1);

    const event2 = { ...makeEvent(), pricing_miss: false };
    const row2 = ClickHouseBackend.eventToRow(event2);
    expect(row2.pricing_miss).toBeNull();

    const event3 = makeEvent();
    const row3 = ClickHouseBackend.eventToRow(event3);
    expect(row3.pricing_miss).toBeNull();
  });

  it('extracts nested context fields correctly', () => {
    const event: UsageEvent = {
      ...makeEvent(),
      context: {
        user: { id: 'user123', team: 'platform' },
        task: { id: 'task456', type: 'chat' },
        session: { id: 'sess789' },
        labels: { env: 'staging', region: 'us-west' },
      },
    };

    const row = ClickHouseBackend.eventToRow(event);
    expect(row.user_id).toBe('user123');
    expect(row.user_team).toBe('platform');
    expect(row.task_id).toBe('task456');
    expect(row.task_type).toBe('chat');
    expect(row.session_id).toBe('sess789');
    expect(row.labels).toEqual({ env: 'staging', region: 'us-west' });
  });

  it('handles missing context gracefully', () => {
    const event: UsageEvent = {
      ...makeEvent(),
      context: undefined,
    };

    const row = ClickHouseBackend.eventToRow(event);
    expect(row.user_id).toBeNull();
    expect(row.user_team).toBeNull();
    expect(row.task_id).toBeNull();
    expect(row.task_type).toBeNull();
    expect(row.session_id).toBeNull();
    expect(row.labels).toEqual({});
  });

  it('handles partial context', () => {
    const event: UsageEvent = {
      ...makeEvent(),
      context: {
        user: { id: 'u1' }, // No team
        // No task or session
      },
    };

    const row = ClickHouseBackend.eventToRow(event);
    expect(row.user_id).toBe('u1');
    expect(row.user_team).toBeNull();
    expect(row.task_id).toBeNull();
    expect(row.labels).toEqual({});
  });

  it('handles optional fields correctly', () => {
    const event: UsageEvent = {
      ...makeEvent(),
      requested_model: 'gpt-4-turbo',
      streaming: true,
      time_to_first_token_ms: 123.45,
      cache_read_tokens: 10,
      cache_write_tokens: 20,
      pricing_miss: true,
      error: 'rate limit exceeded',
    };

    const row = ClickHouseBackend.eventToRow(event);
    expect(row.requested_model).toBe('gpt-4-turbo');
    expect(row.streaming).toBe(1);
    expect(row.time_to_first_token_ms).toBe(123.45);
    expect(row.cache_read_tokens).toBe(10);
    expect(row.cache_write_tokens).toBe(20);
    expect(row.pricing_miss).toBe(1);
    expect(row.error).toBe('rate limit exceeded');
  });
});
