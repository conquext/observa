import { describe, it, expect } from 'vitest';
import { googleAdapter } from '../src/adapter.js';

describe('googleAdapter', () => {
  it('has correct name', () => {
    expect(googleAdapter.name).toBe('google');
  });

  it('instruments generateContent and generateContentStream', () => {
    expect(googleAdapter.instrumentedMethods).toContain('generateContent');
    expect(googleAdapter.instrumentedMethods).toContain('generateContentStream');
  });

  describe('extractUsage', () => {
    it('extracts usage from Gemini response', () => {
      const response = {
        candidates: [{ content: { parts: [{ text: 'Hello' }] } }],
        usageMetadata: { promptTokenCount: 100, candidatesTokenCount: 50, totalTokenCount: 150 },
        modelVersion: 'gemini-2.0-flash',
      };
      const usage = googleAdapter.extractUsage(response);
      expect(usage.model).toBe('gemini-2.0-flash');
      expect(usage.input_tokens).toBe(100);
      expect(usage.output_tokens).toBe(50);
    });

    it('handles missing modelVersion', () => {
      const response = {
        candidates: [],
        usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 5, totalTokenCount: 15 },
        modelVersion: undefined,
      };
      const usage = googleAdapter.extractUsage(response);
      expect(usage.model).toBe('gemini-unknown');
      expect(usage.input_tokens).toBe(10);
      expect(usage.output_tokens).toBe(5);
    });
  });

  describe('extractStreamUsage', () => {
    it('passes chunks through and extracts usage from final chunk', async () => {
      async function* mockStream() {
        yield { candidates: [{ content: { parts: [{ text: 'Hello' }] } }] };
        yield { candidates: [{ content: { parts: [{ text: ' world' }] } }] };
        yield {
          candidates: [],
          usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 5, totalTokenCount: 15 },
          modelVersion: 'gemini-2.0-flash',
        };
      }

      const tracked = googleAdapter.extractStreamUsage(mockStream());
      const chunks: unknown[] = [];
      for await (const chunk of tracked) {
        chunks.push(chunk);
      }

      expect(chunks).toHaveLength(3);
      const usage = await tracked.getUsage();
      expect(usage.input_tokens).toBe(10);
      expect(usage.output_tokens).toBe(5);
      expect(usage.model).toBe('gemini-2.0-flash');
    });
  });
});
