import { describe, it, expect } from 'vitest';
import { anthropicAdapter } from '../src/adapter.js';

describe('anthropicAdapter', () => {
  it('has correct name and methods', () => {
    expect(anthropicAdapter.name).toBe('anthropic');
    expect(anthropicAdapter.instrumentedMethods).toContain('messages.create');
  });

  describe('extractUsage', () => {
    it('extracts usage from messages response', () => {
      const response = {
        model: 'claude-sonnet-4-20250514',
        usage: { input_tokens: 1000, output_tokens: 500 },
      };
      const usage = anthropicAdapter.extractUsage(response);
      expect(usage.model).toBe('claude-sonnet-4-20250514');
      expect(usage.input_tokens).toBe(1000);
      expect(usage.output_tokens).toBe(500);
    });

    it('extracts cache tokens', () => {
      const response = {
        model: 'claude-sonnet-4-20250514',
        usage: {
          input_tokens: 1000,
          output_tokens: 500,
          cache_read_input_tokens: 800,
          cache_creation_input_tokens: 200,
        },
      };
      const usage = anthropicAdapter.extractUsage(response);
      expect(usage.cache_read_tokens).toBe(800);
      expect(usage.cache_write_tokens).toBe(200);
    });
  });

  describe('extractStreamUsage', () => {
    it('extracts usage from message_delta event', async () => {
      async function* mockStream() {
        yield { type: 'content_block_delta', delta: { text: 'Hello' } };
        yield { type: 'content_block_delta', delta: { text: ' world' } };
        yield { type: 'message_delta', usage: { output_tokens: 10 } };
        yield { type: 'message_start', message: { model: 'claude-sonnet-4-20250514', usage: { input_tokens: 50 } } };
      }

      const tracked = anthropicAdapter.extractStreamUsage(mockStream());
      const chunks: unknown[] = [];
      for await (const chunk of tracked) { chunks.push(chunk); }

      expect(chunks).toHaveLength(4);
      const usage = await tracked.getUsage();
      expect(usage.input_tokens).toBe(50);
      expect(usage.output_tokens).toBe(10);
    });
  });
});
