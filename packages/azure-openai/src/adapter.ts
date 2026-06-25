import { openaiAdapter } from '@observatory/openai';
import type { ProviderAdapter } from '@observatory/core';

export const azureOpenaiAdapter: ProviderAdapter = {
  ...openaiAdapter,
  name: 'azure-openai',
};
