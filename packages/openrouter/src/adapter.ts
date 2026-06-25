import { openaiAdapter } from '@observatory/openai';
import type { ProviderAdapter } from '@observatory/core';

export const openrouterAdapter: ProviderAdapter = {
  ...openaiAdapter,
  name: 'openrouter',
};
