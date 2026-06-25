import { describe, it, expect } from 'vitest';
import { openaiAdapter } from '../src/adapter.js';

describe('openaiAdapter', () => {
  it('has correct name', () => {
    expect(openaiAdapter.name).toBe('openai');
  });

  it('instruments chat.completions.create and embeddings.create', () => {
    expect(openaiAdapter.instrumentedMethods).toContain('chat.completions.create');
    expect(openaiAdapter.instrumentedMethods).toContain('embeddings.create');
  });

  describe('extractUsage', () => {
    it('extracts usage from chat completion response', () => {
      const response = {
        id: 'chatcmpl-123',
        model: 'gpt-4o-2024-08-06',
        usage: {
          prompt_tokens: 100,
          completion_tokens: 50,
          total_tokens: 150,
        },
      };

      const usage = openaiAdapter.extractUsage(response);
      expect(usage.model).toBe('gpt-4o-2024-08-06');
      expect(usage.input_tokens).toBe(100);
      expect(usage.output_tokens).toBe(50);
    });

    it('extracts cached tokens when present', () => {
      const response = {
        model: 'gpt-4o',
        usage: {
          prompt_tokens: 1000,
          completion_tokens: 200,
          total_tokens: 1200,
          prompt_tokens_details: { cached_tokens: 800 },
        },
      };

      const usage = openaiAdapter.extractUsage(response);
      expect(usage.cache_read_tokens).toBe(800);
    });

    it('extracts usage from embeddings response', () => {
      const response = {
        model: 'text-embedding-3-small',
        usage: { prompt_tokens: 500, total_tokens: 500 },
      };

      const usage = openaiAdapter.extractUsage(response);
      expect(usage.model).toBe('text-embedding-3-small');
      expect(usage.input_tokens).toBe(500);
      expect(usage.output_tokens).toBe(0);
    });
  });

  describe('extractStreamUsage', () => {
    it('passes chunks through and extracts usage from final chunk', async () => {
      async function* mockStream() {
        yield { choices: [{ delta: { content: 'Hello' } }] };
        yield { choices: [{ delta: { content: ' world' } }] };
        yield { choices: [], usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 } };
      }

      const tracked = openaiAdapter.extractStreamUsage(mockStream());
      const chunks: unknown[] = [];
      for await (const chunk of tracked) {
        chunks.push(chunk);
      }

      expect(chunks).toHaveLength(3);
      const usage = await tracked.getUsage();
      expect(usage.input_tokens).toBe(10);
      expect(usage.output_tokens).toBe(5);
    });
  });
});
