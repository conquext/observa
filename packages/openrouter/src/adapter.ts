import { openaiAdapter } from '@conquext/observa-openai';
import type { ProviderAdapter } from '@conquext/observa-core';

export const openrouterAdapter: ProviderAdapter = {
  ...openaiAdapter,
  name: 'openrouter',
};
