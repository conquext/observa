import { createTrackedStream, defineAdapter } from '@observatory/core';
import type { ProviderAdapter } from '@observatory/core';

interface GeminiResponse {
  candidates: unknown[];
  usageMetadata: { promptTokenCount: number; candidatesTokenCount: number; totalTokenCount: number };
  modelVersion: string;
}

export const googleAdapter: ProviderAdapter = defineAdapter({
  name: 'google',
  instrumentedMethods: ['generateContent', 'generateContentStream'],

  extractUsage(response: unknown) {
    const r = response as GeminiResponse;
    return {
      model: r.modelVersion ?? 'gemini-unknown',
      input_tokens: r.usageMetadata.promptTokenCount,
      output_tokens: r.usageMetadata.candidatesTokenCount,
    };
  },

  extractStreamUsage(stream: AsyncIterable<unknown>) {
    let model = 'gemini-unknown';
    let inputTokens = 0;
    let outputTokens = 0;

    return createTrackedStream(stream, (chunks) => {
      for (const chunk of chunks) {
        const c = chunk as Partial<GeminiResponse>;
        if (c.modelVersion) model = c.modelVersion;
        if (c.usageMetadata) {
          inputTokens = c.usageMetadata.promptTokenCount;
          outputTokens = c.usageMetadata.candidatesTokenCount;
        }
      }
      return { model, input_tokens: inputTokens, output_tokens: outputTokens };
    });
  },
});
