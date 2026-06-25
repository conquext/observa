import { describe, it, expect } from 'vitest';
import { azureOpenaiAdapter } from '../src/adapter.js';

describe('azureOpenaiAdapter', () => {
  it('has correct name', () => {
    expect(azureOpenaiAdapter.name).toBe('azure-openai');
  });

  it('instruments chat.completions.create and embeddings.create', () => {
    expect(azureOpenaiAdapter.instrumentedMethods).toContain('chat.completions.create');
    expect(azureOpenaiAdapter.instrumentedMethods).toContain('embeddings.create');
  });

  describe('extractUsage', () => {
    it('extracts usage from OpenAI-compatible response', () => {
      const response = {
        id: 'chatcmpl-123',
        model: 'gpt-4o-2024-08-06',
        usage: {
          prompt_tokens: 100,
          completion_tokens: 50,
          total_tokens: 150,
        },
      };

      const usage = azureOpenaiAdapter.extractUsage(response);
      expect(usage.model).toBe('gpt-4o-2024-08-06');
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

      const tracked = azureOpenaiAdapter.extractStreamUsage(mockStream());
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
