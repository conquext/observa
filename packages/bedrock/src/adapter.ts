import { defineAdapter } from '@conquext/core';
import type { ProviderAdapter } from '@conquext/core';

interface BedrockResponse {
  $metadata: { httpStatusCode: number };
  body: unknown;
  contentType: string;
}

interface BedrockParsedResponse {
  model?: string;
  amazon_bedrock_invocationMetrics?: {
    inputTokenCount: number;
    outputTokenCount: number;
  };
  usage?: { input_tokens: number; output_tokens: number };
}

export const bedrockAdapter: ProviderAdapter = defineAdapter({
  name: 'bedrock',
  instrumentedMethods: ['invokeModel', 'invokeModelWithResponseStream', 'send'],

  extractUsage(response: unknown) {
    const r = response as BedrockParsedResponse;
    const metrics = r.amazon_bedrock_invocationMetrics ?? r.usage;
    if (!metrics) {
      return { model: r.model ?? 'bedrock-unknown', input_tokens: 0, output_tokens: 0 };
    }
    if ('inputTokenCount' in metrics) {
      return {
        model: r.model ?? 'bedrock-unknown',
        input_tokens: metrics.inputTokenCount,
        output_tokens: metrics.outputTokenCount,
      };
    }
    return {
      model: r.model ?? 'bedrock-unknown',
      input_tokens: metrics.input_tokens,
      output_tokens: metrics.output_tokens,
    };
  },
});
