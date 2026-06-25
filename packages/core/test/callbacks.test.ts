import { describe, it, expect, vi } from 'vitest';
import { Observatory } from '../src/observatory.js';
import { MemoryBackend } from '../src/memory-backend.js';

describe('Callbacks', () => {
  describe('event callback', () => {
    it('fires on every recorded event', async () => {
      const handler = vi.fn();
      const obs = new Observatory({
        backend: new MemoryBackend(),
        on: { event: handler },
      });

      await obs.record({
        model: 'gpt-4o', provider: 'openai',
        input_tokens: 100, output_tokens: 50,
        latency_ms: 500, status: 'success',
      });
      await obs.flush();

      expect(handler).toHaveBeenCalledOnce();
      expect(handler.mock.calls[0][0].model).toBe('gpt-4o');
    });
  });

  describe('costThreshold callback', () => {
    it('fires when a single call exceeds cost threshold', async () => {
      const handler = vi.fn();
      const obs = new Observatory({
        backend: new MemoryBackend(),
        on: {
          costThreshold: { threshold: 0.01, handler },
        },
      });

      await obs.record({
        model: 'gpt-4o', provider: 'openai',
        input_tokens: 1_000_000, output_tokens: 1_000_000,
        latency_ms: 500, status: 'success',
      });
      await obs.flush();

      expect(handler).toHaveBeenCalledOnce();
    });

    it('does not fire when cost is below threshold', async () => {
      const handler = vi.fn();
      const obs = new Observatory({
        backend: new MemoryBackend(),
        on: {
          costThreshold: { threshold: 1000, handler },
        },
      });

      await obs.record({
        model: 'gpt-4o', provider: 'openai',
        input_tokens: 10, output_tokens: 5,
        latency_ms: 500, status: 'success',
      });
      await obs.flush();

      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('error in callback', () => {
    it('does not propagate to caller', async () => {
      const obs = new Observatory({
        backend: new MemoryBackend(),
        on: {
          event: () => { throw new Error('callback boom'); },
        },
      });

      await expect(obs.record({
        model: 'gpt-4o', provider: 'openai',
        input_tokens: 100, output_tokens: 50,
        latency_ms: 500, status: 'success',
      })).resolves.toBeUndefined();
    });
  });
});
