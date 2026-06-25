import type { CallbackConfig, UsageEvent } from './types.js';

export class CallbackDispatcher {
  private readonly config: CallbackConfig;
  private readonly errorCounts = new Map<string, { errors: number; total: number; windowStart: number }>();

  constructor(config: CallbackConfig) {
    this.config = config;
  }

  dispatch(event: UsageEvent): void {
    try {
      this.config.event?.(event);
    } catch {
      // Swallow callback errors
    }

    if (this.config.costThreshold && event.cost >= this.config.costThreshold.threshold) {
      try {
        this.config.costThreshold.handler(event);
      } catch {
        // Swallow
      }
    }

    if (this.config.errorSpike) {
      this.checkErrorSpike(event);
    }
  }

  private checkErrorSpike(event: UsageEvent): void {
    const cfg = this.config.errorSpike!;
    const windowMs = parseWindow(cfg.window);
    const now = Date.now();
    const key = event.model;

    let entry = this.errorCounts.get(key);
    if (!entry || now - entry.windowStart > windowMs) {
      entry = { errors: 0, total: 0, windowStart: now };
      this.errorCounts.set(key, entry);
    }

    entry.total++;
    if (event.status === 'error') entry.errors++;

    if (entry.total >= 5) {
      const rate = entry.errors / entry.total;
      if (rate >= cfg.threshold) {
        try {
          cfg.handler(event.model, rate);
        } catch {
          // Swallow
        }
      }
    }
  }
}

function parseWindow(window: string): number {
  const match = window.match(/^(\d+)(s|m|h)$/);
  if (!match) return 5 * 60 * 1000; // default 5m
  const [, num, unit] = match;
  const multipliers: Record<string, number> = { s: 1000, m: 60_000, h: 3_600_000 };
  return Number(num) * multipliers[unit];
}
