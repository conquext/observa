import type { ObservabilityContext, ProviderAdapter, TrackOptions, MiddlewareOptions } from './types.js';

export class NoopObservatory {
  async record(): Promise<void> {}

  async track<T>(fn: () => Promise<T>): Promise<T> {
    return fn();
  }

  instrument<T extends object>(client: T): T {
    return client;
  }

  async withContext<T>(_ctx: ObservabilityContext, fn: () => T | Promise<T>): Promise<T> {
    return fn();
  }

  middleware() {
    return (_req: unknown, _res: unknown, next: () => void) => next();
  }

  async flush(): Promise<void> {}
  async close(): Promise<void> {}
}
