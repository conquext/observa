import { openaiAdapter } from '@conquext/openai';
import type { ProviderAdapter } from '@conquext/core';

export const openrouterAdapter: ProviderAdapter = {
  ...openaiAdapter,
  name: 'openrouter',
};
