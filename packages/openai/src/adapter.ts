import { createTrackedStream, defineAdapter } from '@conquext/core';
import type { ExtractedUsage, ProviderAdapter } from '@conquext/core';

interface OpenAIUsage {
  prompt_tokens: number;
  completion_tokens?: number;
  total_tokens: number;
  prompt_tokens_details?: { cached_tokens?: number };
}

interface OpenAIResponse {
  model: string;
  usage: OpenAIUsage;
}

interface OpenAIStreamChunk {
  usage?: OpenAIUsage;
  model?: string;
}

function extractFromResponse(response: unknown): ExtractedUsage {
  const r = response as OpenAIResponse;
  return {
    model: r.model,
    input_tokens: r.usage.prompt_tokens,
    output_tokens: r.usage.completion_tokens ?? 0,
    cache_read_tokens: r.usage.prompt_tokens_details?.cached_tokens,
  };
}

export const openaiAdapter: ProviderAdapter = defineAdapter({
  name: 'openai',
  instrumentedMethods: ['chat.completions.create', 'embeddings.create'],

  extractUsage: extractFromResponse,

  extractStreamUsage(stream: AsyncIterable<unknown>) {
    let lastModel = 'unknown';
    let finalUsage: OpenAIUsage | undefined;

    return createTrackedStream(stream, (chunks) => {
      // OpenAI sends usage in the final chunk
      for (const chunk of chunks) {
        const c = chunk as OpenAIStreamChunk;
        if (c.model) lastModel = c.model;
        if (c.usage) finalUsage = c.usage;
      }

      if (finalUsage) {
        return {
          model: lastModel,
          input_tokens: finalUsage.prompt_tokens,
          output_tokens: finalUsage.completion_tokens ?? 0,
          cache_read_tokens: finalUsage.prompt_tokens_details?.cached_tokens,
        };
      }

      return { model: lastModel, input_tokens: 0, output_tokens: 0 };
    });
  },
});
