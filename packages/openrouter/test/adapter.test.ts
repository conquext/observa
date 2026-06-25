import { describe, it, expect } from 'vitest';
import { openrouterAdapter } from '../src/adapter.js';

describe('openrouterAdapter', () => {
  it('has correct name', () => {
    expect(openrouterAdapter.name).toBe('openrouter');
  });

  it('instruments chat.completions.create and embeddings.create', () => {
    expect(openrouterAdapter.instrumentedMethods).toContain('chat.completions.create');
    expect(openrouterAdapter.instrumentedMethods).toContain('embeddings.create');
  });

  describe('extractUsage', () => {
    it('extracts usage from OpenAI-compatible response', () => {
      const response = {
        id: 'gen-123',
        model: 'anthropic/claude-3.5-sonnet',
        usage: {
          prompt_tokens: 100,
          completion_tokens: 50,
          total_tokens: 150,
        },
      };

      const usage = openrouterAdapter.extractUsage(response);
      expect(usage.model).toBe('anthropic/claude-3.5-sonnet');
      expect(usage.input_tokens).toBe(100);
      expect(usage.output_tokens).toBe(50);
    });
  });

  describe('extractStreamUsage', () => {
    it('passes chunks through and extracts usage from final chunk', async () => {
      async function* mockStream() {
        yield { choices: [{ delta: { content: 'Hello' } }] };
        yield { choices: [{ delta: { content: ' world' } }] };
        yield { choices: [], usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 } };
      }

      const tracked = openrouterAdapter.extractStreamUsage(mockStream());
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
