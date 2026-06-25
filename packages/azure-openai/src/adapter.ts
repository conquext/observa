import { openaiAdapter } from '@conquext/openai';
import type { ProviderAdapter } from '@conquext/core';

export const azureOpenaiAdapter: ProviderAdapter = {
  ...openaiAdapter,
  name: 'azure-openai',
};
