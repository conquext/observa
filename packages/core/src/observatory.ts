import { ulid } from 'ulid';
import type {
  ObservatoryConfig,
  UsageEventInput,
  UsageEvent,
  TrackOptions,
  ObservabilityContext,
  ProviderAdapter,
  MiddlewareOptions,
  StorageBackend,
} from './types.js';
import { UsageEventInputSchema } from './schemas.js';
import { PricingEngine } from './pricing.js';
import { BatchProcessor } from './batch.js';
import { ContextManager } from './context.js';
import { CallbackDispatcher } from './callbacks.js';

export class Observatory {
  private readonly backend: StorageBackend;
  private readonly pricing: PricingEngine;
  private readonly batch: BatchProcessor;
  private readonly defaultContext?: ObservabilityContext;
  private readonly disabled: boolean;
  private readonly callbacks?: CallbackDispatcher;

  constructor(config: ObservatoryConfig) {
    this.disabled = config.disabled ?? false;
    this.backend = config.backend;
    this.pricing = new PricingEngine(config.pricing ?? 'builtin');
    this.batch = new BatchProcessor(config.backend, config.batching);
    this.defaultContext = config.defaultContext;
    this.callbacks = config.on ? new CallbackDispatcher(config.on) : undefined;
  }

  async record(input: UsageEventInput): Promise<void> {
    if (this.disabled) return;

    const validated = UsageEventInputSchema.parse(input);

    const pricingMiss = this.pricing.isPricingMiss(validated.model);
    const cost = validated.cost ?? (pricingMiss ? 0 : this.pricing.calculateCost(validated));

    const resolvedContext = ContextManager.merge(this.defaultContext, validated.context);

    const event: UsageEvent = {
      ...validated,
      id: ulid(),
      timestamp: new Date(),
      total_tokens: validated.total_tokens ?? validated.input_tokens + validated.output_tokens,
      cost,
      pricing_miss: pricingMiss || undefined,
      context: Object.keys(resolvedContext).length > 0 ? resolvedContext : undefined,
    };

    await this.batch.add(event);
    this.callbacks?.dispatch(event);
  }

  async track<T>(fn: () => Promise<T>, opts: TrackOptions): Promise<T> {
    if (this.disabled) return fn();

    const start = performance.now();
    let result: T;

    try {
      result = await fn();
    } catch (err) {
      const latency_ms = performance.now() - start;
      await this.record({
        model: 'unknown',
        provider: opts.provider.name,
        input_tokens: 0,
        output_tokens: 0,
        latency_ms,
        status: 'error',
        error: err instanceof Error ? err.message : String(err),
        context: opts.context,
      });
      throw err;
    }

    const latency_ms = performance.now() - start;
    const usage = opts.provider.extractUsage(result);

    const mergedContext = ContextManager.merge(ContextManager.get(), opts.context);

    await this.record({
      model: usage.model,
      provider: opts.provider.name,
      input_tokens: usage.input_tokens,
      output_tokens: usage.output_tokens,
      cache_read_tokens: usage.cache_read_tokens,
      cache_write_tokens: usage.cache_write_tokens,
      latency_ms,
      status: 'success',
      context: mergedContext,
    });

    return result;
  }

  instrument<T extends object>(client: T, adapter: ProviderAdapter): T {
    if (this.disabled) return client;

    const obs = this;
    const handler: ProxyHandler<T> = {
      get(target, prop, receiver) {
        const value = Reflect.get(target, prop, receiver);

        if (typeof prop === 'string' && adapter.instrumentedMethods.includes(prop) && typeof value === 'function') {
          return (...args: unknown[]) => {
            return obs.track(
              () => value.apply(target, args),
              { provider: adapter, context: ContextManager.get() },
            );
          };
        }

        // Handle nested objects (e.g., openai.chat.completions.create)
        if (typeof value === 'object' && value !== null) {
          return new Proxy(value as object, makeNestedHandler(obs, adapter, prop));
        }

        return value;
      },
    };

    return new Proxy(client, handler);
  }

  async withContext<T>(ctx: ObservabilityContext, fn: () => T | Promise<T>): Promise<T> {
    if (this.disabled) return fn();
    return ContextManager.run(ctx, fn) as Promise<T>;
  }

  middleware(opts: MiddlewareOptions) {
    const obs = this;
    return (req: unknown, _res: unknown, next: () => void) => {
      const ctx = opts.extractContext(req);
      return ContextManager.run(ctx, next);
    };
  }

  async flush(): Promise<void> {
    await this.batch.flush();
  }

  async close(): Promise<void> {
    await this.batch.close();
  }
}

function makeNestedHandler(obs: Observatory, adapter: ProviderAdapter, parentPath: string): ProxyHandler<object> {
  return {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);
      const fullPath = `${parentPath}.${String(prop)}`;

      if (typeof prop === 'string' && adapter.instrumentedMethods.includes(fullPath) && typeof value === 'function') {
        return (...args: unknown[]) => {
          return obs.track(
            () => value.apply(target, args),
            { provider: adapter, context: ContextManager.get() },
          );
        };
      }

      if (typeof value === 'object' && value !== null) {
        return new Proxy(value as object, makeNestedHandler(obs, adapter, fullPath));
      }

      return value;
    },
  };
}
