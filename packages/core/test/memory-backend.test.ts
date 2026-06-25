import { describe, it, expect } from 'vitest';
import { MemoryBackend } from '../src/memory-backend.js';
import type { UsageEvent } from '../src/types.js';

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
  ...overrides,
});

describe('MemoryBackend', () => {
  it('writes and queries events', async () => {
    const backend = new MemoryBackend();
    const event = makeEvent();
    await backend.write([event]);

    const results = await backend.query({
      from: new Date('2025-06-01T00:00:00Z'),
      to: new Date('2025-06-02T00:00:00Z'),
    });
    expect(results).toHaveLength(1);
    expect(results[0].model).toBe('gpt-4o');
  });

  it('filters by user', async () => {
    const backend = new MemoryBackend();
    await backend.write([
      makeEvent({ context: { user: { id: 'u1' } } }),
      makeEvent({ context: { user: { id: 'u2' } } }),
    ]);

    const results = await backend.query({
      from: new Date('2025-06-01T00:00:00Z'),
      to: new Date('2025-06-02T00:00:00Z'),
      user: 'u1',
    });
    expect(results).toHaveLength(1);
  });

  it('filters by time range', async () => {
    const backend = new MemoryBackend();
    await backend.write([
      makeEvent({ timestamp: new Date('2025-06-01T10:00:00Z') }),
      makeEvent({ timestamp: new Date('2025-06-01T20:00:00Z') }),
    ]);

    const results = await backend.query({
      from: new Date('2025-06-01T15:00:00Z'),
      to: new Date('2025-06-02T00:00:00Z'),
    });
    expect(results).toHaveLength(1);
  });

  it('filters by labels', async () => {
    const backend = new MemoryBackend();
    await backend.write([
      makeEvent({ context: { labels: { env: 'prod' } } }),
      makeEvent({ context: { labels: { env: 'staging' } } }),
    ]);

    const results = await backend.query({
      from: new Date('2025-06-01T00:00:00Z'),
      to: new Date('2025-06-02T00:00:00Z'),
      labels: { env: 'prod' },
    });
    expect(results).toHaveLength(1);
  });

  it('clears on close', async () => {
    const backend = new MemoryBackend();
    await backend.write([makeEvent()]);
    expect(backend.size).toBe(1);
    await backend.close();
    expect(backend.size).toBe(0);
  });
});
