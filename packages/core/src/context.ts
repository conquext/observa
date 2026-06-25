import { AsyncLocalStorage } from 'node:async_hooks';
import type { ObservabilityContext } from './types.js';

const storage = new AsyncLocalStorage<ObservabilityContext>();

export const ContextManager = {
  get(): ObservabilityContext | undefined {
    return storage.getStore();
  },

  run<T>(context: ObservabilityContext, fn: () => T): T {
    return storage.run(context, fn);
  },

  merge(base: ObservabilityContext | undefined, override: ObservabilityContext | undefined): ObservabilityContext {
    if (!base && !override) return {};
    if (!base) return override!;
    if (!override) return base;
    return {
      user: override.user ?? base.user,
      task: override.task ?? base.task,
      session: override.session ?? base.session,
      labels: { ...base.labels, ...override.labels },
    };
  },
};
