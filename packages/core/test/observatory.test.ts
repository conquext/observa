import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Observatory } from '../src/observatory.js';
import { MemoryBackend } from '../src/memory-backend.js';
import { defineAdapter } from '../src/adapter.js';
import type { ObservatoryConfig, ProviderAdapter } from '../src/types.js';

const testAdapter: ProviderAdapter = defineAdapter({
  name: 'test',
  instrumentedMethods: ['create'],
  extractUsage(response: unknown) {
    const r = response as { model: string; usage: { input: number; output: number } };
    return { model: r.model, input_tokens: r.usage.input, output_tokens: r.usage.output };
  },
});

function createObservatory(overrides: Partial<ObservatoryConfig> = {}) {
  const backend = new MemoryBackend();
  const obs = new Observatory({ backend, ...overrides });
  return { obs, backend };
}

describe('Observatory', () => {
  describe('record()', () => {
    it('validates, enriches, and stores an event', async () => {
      const { obs, backend } = createObservatory();
      await obs.record({
        model: 'gpt-4o',
        provider: 'openai',
        input_tokens: 100,
        output_tokens: 50,
        latency_ms: 500,
        status: 'success',
      });
      await obs.flush();

      const events = backend.getAll();
      expect(events).toHaveLength(1);
      expect(events[0].id).toBeDefined();
      expect(events[0].timestamp).toBeInstanceOf(Date);
      expect(events[0].total_tokens).toBe(150);
      expect(events[0].cost).toBeGreaterThan(0);
    });

    it('merges default context', async () => {
      const { obs, backend } = createObservatory({
        defaultContext: { labels: { service: 'api' } },
      });
      await obs.record({
        model: 'gpt-4o',
        provider: 'openai',
        input_tokens: 100,
        output_tokens: 50,
        latency_ms: 500,
        status: 'success',
        context: { user: { id: 'u1' } },
      });
      await obs.flush();

      const event = backend.getAll()[0];
      expect(event.context?.labels?.service).toBe('api');
      expect(event.context?.user?.id).toBe('u1');
    });

    it('flags pricing_miss for unknown models', async () => {
      const { obs, backend } = createObservatory();
      await obs.record({
        model: 'unknown-model',
        provider: 'unknown',
        input_tokens: 100,
        output_tokens: 50,
        latency_ms: 500,
        status: 'success',
      });
      await obs.flush();

      const event = backend.getAll()[0];
      expect(event.pricing_miss).toBe(true);
      expect(event.cost).toBe(0);
    });

    it('preserves caller-supplied cost', async () => {
      const { obs, backend } = createObservatory();
      await obs.record({
        model: 'gpt-4o',
        provider: 'openai',
        input_tokens: 100,
        output_tokens: 50,
        cost: 99.99,
        latency_ms: 500,
        status: 'success',
      });
      await obs.flush();

      expect(backend.getAll()[0].cost).toBe(99.99);
    });
  });

  describe('track()', () => {
    it('calls function and records usage from adapter', async () => {
      const { obs, backend } = createObservatory();
      const mockFn = vi.fn().mockResolvedValue({
        model: 'gpt-4o',
        usage: { input: 100, output: 50 },
      });

      const result = await obs.track(mockFn, {
        provider: testAdapter,
        context: { user: { id: 'u1' } },
      });

      expect(mockFn).toHaveBeenCalledOnce();
      expect(result.model).toBe('gpt-4o');

      await obs.flush();
      const events = backend.getAll();
      expect(events).toHaveLength(1);
      expect(events[0].input_tokens).toBe(100);
      expect(events[0].context?.user?.id).toBe('u1');
    });

    it('records error events on failure', async () => {
      const { obs, backend } = createObservatory();
      const mockFn = vi.fn().mockRejectedValue(new Error('API timeout'));

      await expect(
        obs.track(mockFn, { provider: testAdapter }),
      ).rejects.toThrow('API timeout');

      await obs.flush();
      const events = backend.getAll();
      expect(events).toHaveLength(1);
      expect(events[0].status).toBe('error');
      expect(events[0].error).toBe('API timeout');
    });
  });

  describe('instrument()', () => {
    it('returns a proxy that tracks instrumented method calls', async () => {
      const { obs, backend } = createObservatory();
      const client = {
        create: vi.fn().mockResolvedValue({
          model: 'gpt-4o',
          usage: { input: 200, output: 100 },
        }),
      };

      const tracked = obs.instrument(client, testAdapter);
      const result = await tracked.create({ prompt: 'hello' });

      expect(result.model).toBe('gpt-4o');
      expect(client.create).toHaveBeenCalledWith({ prompt: 'hello' });

      await obs.flush();
      expect(backend.getAll()).toHaveLength(1);
      expect(backend.getAll()[0].input_tokens).toBe(200);
    });
  });

  describe('withContext()', () => {
    it('provides context to tracked calls within scope', async () => {
      const { obs, backend } = createObservatory();
      const client = {
        create: vi.fn().mockResolvedValue({
          model: 'gpt-4o',
          usage: { input: 100, output: 50 },
        }),
      };
      const tracked = obs.instrument(client, testAdapter);

      await obs.withContext({ user: { id: 'u1' }, task: { id: 't1' } }, async () => {
        await tracked.create({ prompt: 'hello' });
      });

      await obs.flush();
      const event = backend.getAll()[0];
      expect(event.context?.user?.id).toBe('u1');
      expect(event.context?.task?.id).toBe('t1');
    });
  });

  describe('disabled mode', () => {
    it('record is a no-op', async () => {
      const { obs, backend } = createObservatory({ disabled: true });
      await obs.record({
        model: 'gpt-4o', provider: 'openai',
        input_tokens: 100, output_tokens: 50,
        latency_ms: 500, status: 'success',
      });
      await obs.flush();
      expect(backend.getAll()).toHaveLength(0);
    });

    it('track calls the function without instrumentation', async () => {
      const { obs } = createObservatory({ disabled: true });
      const mockFn = vi.fn().mockResolvedValue('result');
      const result = await obs.track(mockFn, { provider: testAdapter });
      expect(result).toBe('result');
    });

    it('instrument returns the original client', async () => {
      const { obs } = createObservatory({ disabled: true });
      const client = { create: vi.fn() };
      const tracked = obs.instrument(client, testAdapter);
      expect(tracked).toBe(client);
    });
  });
});
