# AI Token Observatory

Framework-agnostic TypeScript SDK for tracking AI/LLM token usage, costs, and performance with pre-built Grafana dashboards.

## Quick Start

```bash
npm install @conquext/observa-core @conquext/observa-loki @conquext/observa-openai
```

```typescript
import { Observatory } from '@conquext/observa-core';
import { LokiBackend } from '@conquext/observa-loki';
import { openaiAdapter } from '@conquext/observa-openai';

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
| `@conquext/observa-core` | Core SDK — Observatory class, types, schemas, pricing, budgets |
| `@conquext/observa-loki` | Loki storage backend + Grafana dashboards |
| `@conquext/observa-pg` | PostgreSQL storage backend + dashboards |
| `@conquext/observa-clickhouse` | ClickHouse storage backend + dashboards |
| `@conquext/observa-openai` | OpenAI provider adapter |
| `@conquext/observa-anthropic` | Anthropic provider adapter |
| `@conquext/observa-google` | Google Gemini provider adapter |
| `@conquext/observa-bedrock` | AWS Bedrock provider adapter |
| `@conquext/observa-azure-openai` | Azure OpenAI provider adapter |
| `@conquext/observa-openrouter` | OpenRouter provider adapter |
| `@conquext/observa-cli` | CLI for dashboard management |

## License

MIT
