import { openaiAdapter } from '@conquext/observa-openai';
import type { ProviderAdapter } from '@conquext/observa-core';

export const azureOpenaiAdapter: ProviderAdapter = {
  ...openaiAdapter,
  name: 'azure-openai',
};
