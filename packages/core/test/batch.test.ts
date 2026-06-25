import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BatchProcessor } from '../src/batch.js';
import { MemoryBackend } from '../src/memory-backend.js';
import type { UsageEvent } from '../src/types.js';

const makeEvent = (id = '01ARZ3NDEKTSV4RRFFQ69G5FAV'): UsageEvent => ({
  id,
  timestamp: new Date(),
  model: 'gpt-4o',
  provider: 'openai',
  input_tokens: 100,
  output_tokens: 50,
  total_tokens: 150,
  cost: 0.001,
  latency_ms: 500,
  status: 'success',
});

describe('BatchProcessor', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('flushes when batch size is reached', async () => {
    const backend = new MemoryBackend();
    const batch = new BatchProcessor(backend, { maxSize: 2, flushInterval: 0 });

    await batch.add(makeEvent('1'));
    expect(backend.size).toBe(0);

    await batch.add(makeEvent('2'));
    expect(backend.size).toBe(2);

    await batch.close();
  });

  it('flushes on close', async () => {
    const backend = new MemoryBackend();
    const batch = new BatchProcessor(backend, { maxSize: 100, flushInterval: 0 });

    await batch.add(makeEvent());
    expect(backend.size).toBe(0);
    expect(batch.pending).toBe(1);

    await batch.flush();
    expect(backend.size).toBe(1);
    expect(batch.pending).toBe(0);

    await batch.close();
  });

  it('flushes on interval', async () => {
    const backend = new MemoryBackend();
    const batch = new BatchProcessor(backend, { maxSize: 100, flushInterval: 1000 });

    await batch.add(makeEvent());
    expect(backend.size).toBe(0);

    await vi.advanceTimersByTimeAsync(1000);
    expect(backend.size).toBe(1);

    await batch.close();
  });

  it('tracks pending count', async () => {
    const backend = new MemoryBackend();
    const batch = new BatchProcessor(backend, { maxSize: 100, flushInterval: 0 });

    await batch.add(makeEvent());
    expect(batch.pending).toBe(1);

    await batch.flush();
    expect(batch.pending).toBe(0);

    await batch.close();
  });
});
