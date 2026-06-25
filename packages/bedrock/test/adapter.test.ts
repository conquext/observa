import { describe, it, expect } from 'vitest';
import { bedrockAdapter } from '../src/adapter.js';

describe('bedrockAdapter', () => {
  it('has correct name', () => {
    expect(bedrockAdapter.name).toBe('bedrock');
  });

  it('instruments invokeModel, invokeModelWithResponseStream, and send', () => {
    expect(bedrockAdapter.instrumentedMethods).toContain('invokeModel');
    expect(bedrockAdapter.instrumentedMethods).toContain('invokeModelWithResponseStream');
    expect(bedrockAdapter.instrumentedMethods).toContain('send');
  });

  describe('extractUsage', () => {
    it('extracts usage from amazon_bedrock_invocationMetrics format', () => {
      const response = {
        model: 'amazon.titan-text-express-v1',
        amazon_bedrock_invocationMetrics: {
          inputTokenCount: 100,
          outputTokenCount: 50,
        },
      };
      const usage = bedrockAdapter.extractUsage(response);
      expect(usage.model).toBe('amazon.titan-text-express-v1');
      expect(usage.input_tokens).toBe(100);
      expect(usage.output_tokens).toBe(50);
    });

    it('extracts usage from Anthropic-style usage format', () => {
      const response = {
        model: 'anthropic.claude-3-5-sonnet-20241022-v2:0',
        usage: {
          input_tokens: 200,
          output_tokens: 100,
        },
      };
      const usage = bedrockAdapter.extractUsage(response);
      expect(usage.model).toBe('anthropic.claude-3-5-sonnet-20241022-v2:0');
      expect(usage.input_tokens).toBe(200);
      expect(usage.output_tokens).toBe(100);
    });

    it('handles missing usage metrics', () => {
      const response = {
        model: 'some-model',
      };
      const usage = bedrockAdapter.extractUsage(response);
      expect(usage.model).toBe('some-model');
      expect(usage.input_tokens).toBe(0);
      expect(usage.output_tokens).toBe(0);
    });

    it('handles missing model name', () => {
      const response = {
        amazon_bedrock_invocationMetrics: {
          inputTokenCount: 50,
          outputTokenCount: 25,
        },
      };
      const usage = bedrockAdapter.extractUsage(response);
      expect(usage.model).toBe('bedrock-unknown');
      expect(usage.input_tokens).toBe(50);
      expect(usage.output_tokens).toBe(25);
    });
  });
});
