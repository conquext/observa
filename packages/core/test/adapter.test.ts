import { describe, it, expect } from 'vitest';
import { defineAdapter, createTrackedStream } from '../src/adapter.js';

describe('defineAdapter', () => {
  it('creates a valid adapter from config', () => {
    const adapter = defineAdapter({
      name: 'test-provider',
      instrumentedMethods: ['complete'],
      extractUsage(response: unknown) {
        const r = response as { model: string; tokens: { in: number; out: number } };
        return { model: r.model, input_tokens: r.tokens.in, output_tokens: r.tokens.out };
      },
    });

    expect(adapter.name).toBe('test-provider');
    expect(adapter.instrumentedMethods).toEqual(['complete']);

    const usage = adapter.extractUsage({
      model: 'test-model',
      tokens: { in: 100, out: 50 },
    });
    expect(usage.model).toBe('test-model');
    expect(usage.input_tokens).toBe(100);
    expect(usage.output_tokens).toBe(50);
  });
});

describe('createTrackedStream', () => {
  it('passes chunks through and collects usage', async () => {
    async function* source() {
      yield { text: 'Hello' };
      yield { text: ' world' };
    }

    const tracked = createTrackedStream(source(), (chunks) => ({
      model: 'test',
      input_tokens: 10,
      output_tokens: chunks.length * 5,
    }));

    const collected: unknown[] = [];
    for await (const chunk of tracked) {
      collected.push(chunk);
    }

    expect(collected).toHaveLength(2);

    const usage = await tracked.getUsage();
    expect(usage.model).toBe('test');
    expect(usage.output_tokens).toBe(10);
  });
});
