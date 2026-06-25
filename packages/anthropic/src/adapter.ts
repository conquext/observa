import { createTrackedStream, defineAdapter } from '@conquext/core';
import type { ExtractedUsage, ProviderAdapter } from '@conquext/core';

interface AnthropicUsage {
  input_tokens: number;
  output_tokens: number;
  cache_read_input_tokens?: number;
  cache_creation_input_tokens?: number;
}

interface AnthropicResponse {
  model: string;
  usage: AnthropicUsage;
}

interface AnthropicStreamEvent {
  type: string;
  message?: { model: string; usage: { input_tokens: number } };
  usage?: { output_tokens: number };
  delta?: { text?: string };
}

function extractFromResponse(response: unknown): ExtractedUsage {
  const r = response as AnthropicResponse;
  return {
    model: r.model,
    input_tokens: r.usage.input_tokens,
    output_tokens: r.usage.output_tokens,
    cache_read_tokens: r.usage.cache_read_input_tokens,
    cache_write_tokens: r.usage.cache_creation_input_tokens,
  };
}

export const anthropicAdapter: ProviderAdapter = defineAdapter({
  name: 'anthropic',
  instrumentedMethods: ['messages.create'],

  extractUsage: extractFromResponse,

  extractStreamUsage(stream: AsyncIterable<unknown>) {
    let model = 'unknown';
    let inputTokens = 0;
    let outputTokens = 0;

    return createTrackedStream(stream, (chunks) => {
      // Anthropic sends usage in message_start (input) and message_delta (output) events
      for (const chunk of chunks) {
        const event = chunk as AnthropicStreamEvent;
        if (event.type === 'message_start' && event.message) {
          model = event.message.model;
          inputTokens = event.message.usage.input_tokens;
        }
        if (event.type === 'message_delta' && event.usage) {
          outputTokens = event.usage.output_tokens;
        }
      }

      return {
        model,
        input_tokens: inputTokens,
        output_tokens: outputTokens,
      };
    });
  },
});
