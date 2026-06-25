import { describe, it, expect } from 'vitest';
import { PgBackend } from '../src/pg-backend.js';
import type { UsageEvent } from '@observatory/core';

const makeEvent = (overrides: Partial<UsageEvent> = {}): UsageEvent => ({
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
  context: { user: { id: 'u1', team: 'eng' }, task: { id: 't1', type: 'summarize' } },
  ...overrides,
});

describe('PgBackend', () => {
  describe('eventToRow', () => {
    it('maps UsageEvent to correct SQL columns', () => {
      const event = makeEvent();
      const row = PgBackend.eventToRow(event);

      expect(row.id).toBe(event.id);
      expect(row.model).toBe('gpt-4o');
      expect(row.provider).toBe('openai');
      expect(row.user_id).toBe('u1');
      expect(row.user_team).toBe('eng');
      expect(row.task_id).toBe('t1');
      expect(row.task_type).toBe('summarize');
      expect(row.input_tokens).toBe(100);
      expect(row.cost).toBe(0.001);
    });

    it('handles events without context', () => {
      const event = makeEvent({ context: undefined });
      const row = PgBackend.eventToRow(event);

      expect(row.user_id).toBeNull();
      expect(row.task_id).toBeNull();
      expect(row.labels).toEqual({});
    });

    it('serializes labels as JSON', () => {
      const event = makeEvent({
        context: { labels: { env: 'prod', region: 'us-east' } },
      });
      const row = PgBackend.eventToRow(event);
      expect(row.labels).toEqual({ env: 'prod', region: 'us-east' });
    });

    it('maps all optional fields correctly', () => {
      const event = makeEvent({
        requested_model: 'gpt-4o-2024-08-06',
        error: 'rate limit exceeded',
        streaming: true,
        time_to_first_token_ms: 150,
        cache_read_tokens: 20,
        cache_write_tokens: 10,
        pricing_miss: true,
        context: {
          user: { id: 'u1', name: 'John Doe', email: 'john@example.com', team: 'eng', plan: 'pro' },
          task: { id: 't1', title: 'Summarize document', type: 'summarize', priority: 'high' },
          session: { id: 's1', conversationId: 'c1', parentCallId: 'p1' },
        },
      });
      const row = PgBackend.eventToRow(event);

      expect(row.requested_model).toBe('gpt-4o-2024-08-06');
      expect(row.error).toBe('rate limit exceeded');
      expect(row.streaming).toBe(true);
      expect(row.time_to_first_token_ms).toBe(150);
      expect(row.cache_read_tokens).toBe(20);
      expect(row.cache_write_tokens).toBe(10);
      expect(row.pricing_miss).toBe(true);
      expect(row.user_name).toBe('John Doe');
      expect(row.user_email).toBe('john@example.com');
      expect(row.user_plan).toBe('pro');
      expect(row.task_title).toBe('Summarize document');
      expect(row.task_priority).toBe('high');
      expect(row.session_id).toBe('s1');
      expect(row.conversation_id).toBe('c1');
      expect(row.parent_call_id).toBe('p1');
    });

    it('handles partial context objects', () => {
      const event = makeEvent({
        context: {
          user: { id: 'u1' },
          task: { id: 't1' },
          session: { id: 's1' },
        },
      });
      const row = PgBackend.eventToRow(event);

      expect(row.user_id).toBe('u1');
      expect(row.user_name).toBeNull();
      expect(row.task_id).toBe('t1');
      expect(row.task_type).toBeNull();
      expect(row.session_id).toBe('s1');
      expect(row.conversation_id).toBeNull();
    });

    it('preserves timestamp as Date object', () => {
      const timestamp = new Date('2025-06-01T12:00:00Z');
      const event = makeEvent({ timestamp });
      const row = PgBackend.eventToRow(event);

      expect(row.timestamp).toBe(timestamp);
      expect(row.timestamp instanceof Date).toBe(true);
    });

    it('handles numeric precision fields correctly', () => {
      const event = makeEvent({
        cost: 1.234567,
        latency_ms: 1234.56,
        time_to_first_token_ms: 123.45,
      });
      const row = PgBackend.eventToRow(event);

      expect(row.cost).toBe(1.234567);
      expect(row.latency_ms).toBe(1234.56);
      expect(row.time_to_first_token_ms).toBe(123.45);
    });
  });
});
