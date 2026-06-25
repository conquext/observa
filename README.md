# AI Token Observatory

Framework-agnostic TypeScript SDK for tracking AI/LLM token usage, costs, and performance with pre-built Grafana dashboards.

## Quick Start

```bash
npm install @conquext/core @conquext/loki @conquext/openai
```

```typescript
import { Observatory } from '@conquext/core';
import { LokiBackend } from '@conquext/loki';
import { openaiAdapter } from '@conquext/openai';

const observatory = new Observatory({
  backend: new LokiBackend({ url: 'http://loki:3100' }),
});

// Track a call
const result = await observatory.track(
  () => openai.chat.completions.create({ model: 'gpt-4o', messages }),
  { provider: openaiAdapter, context: { user: { id: 'u1' } } }
);

// Or instrument the entire client
const ai = observatory.instrument(openai, openaiAdapter);
const result = await ai.chat.completions.create({ model: 'gpt-4o', messages });
```

## Packages

| Package | Description |
|---------|-------------|
| `@conquext/core` | Core SDK — Observatory class, types, schemas, pricing, budgets |
| `@conquext/loki` | Loki storage backend + Grafana dashboards |
| `@conquext/pg` | PostgreSQL storage backend + dashboards |
| `@conquext/clickhouse` | ClickHouse storage backend + dashboards |
| `@conquext/openai` | OpenAI provider adapter |
| `@conquext/anthropic` | Anthropic provider adapter |
| `@conquext/google` | Google Gemini provider adapter |
| `@conquext/bedrock` | AWS Bedrock provider adapter |
| `@conquext/azure-openai` | Azure OpenAI provider adapter |
| `@conquext/openrouter` | OpenRouter provider adapter |
| `@conquext/cli` | CLI for dashboard management |

## License

MIT
