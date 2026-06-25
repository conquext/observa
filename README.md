# AI Token Observatory

Framework-agnostic TypeScript SDK for tracking AI/LLM token usage, costs, and performance with pre-built Grafana dashboards.

## Quick Start

```bash
npm install @observatory/core @observatory/loki @observatory/openai
```

```typescript
import { Observatory } from '@observatory/core';
import { LokiBackend } from '@observatory/loki';
import { openaiAdapter } from '@observatory/openai';

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
| `@observatory/core` | Core SDK — Observatory class, types, schemas, pricing, budgets |
| `@observatory/loki` | Loki storage backend + Grafana dashboards |
| `@observatory/pg` | PostgreSQL storage backend + dashboards |
| `@observatory/clickhouse` | ClickHouse storage backend + dashboards |
| `@observatory/openai` | OpenAI provider adapter |
| `@observatory/anthropic` | Anthropic provider adapter |
| `@observatory/google` | Google Gemini provider adapter |
| `@observatory/bedrock` | AWS Bedrock provider adapter |
| `@observatory/azure-openai` | Azure OpenAI provider adapter |
| `@observatory/openrouter` | OpenRouter provider adapter |
| `@observatory/cli` | CLI for dashboard management |

## License

MIT
