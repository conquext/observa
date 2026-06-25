import type { BudgetConfig, BudgetLimits, BudgetWindow, ObservabilityContext, UsageEvent } from './types.js';
import { BudgetExhaustedError } from './errors.js';

export interface BudgetCheckResult {
  exceeded: boolean;
  scope?: 'user' | 'team' | 'task';
  scopeId?: string;
  spent?: number;
  limit?: number;
  window?: BudgetWindow;
  downgrade?: string;
}

interface WindowAccumulator {
  hourly: Map<string, { amount: number; windowStart: number }>;
  daily: Map<string, { amount: number; windowStart: number }>;
  monthly: Map<string, { amount: number; windowStart: number }>;
  total: Map<string, number>;
}

const WINDOW_DURATIONS: Record<string, number> = {
  hourly: 3_600_000,
  daily: 86_400_000,
  monthly: 2_592_000_000, // 30 days
};

export class BudgetEngine {
  private readonly config: BudgetConfig;
  private readonly accumulators = {
    user: createAccumulator(),
    team: createAccumulator(),
    task: createAccumulator(),
  };

  constructor(config: BudgetConfig) {
    this.config = config;
  }

  check(context: ObservabilityContext | undefined, model: string, estimatedCost: number): BudgetCheckResult {
    if (!context) return { exceeded: false };

    // Check user budget
    if (this.config.perUser && context.user?.id) {
      const result = this.checkScope('user', context.user.id, this.config.perUser, model, estimatedCost);
      if (result) return result;
    }

    // Check team budget
    if (this.config.perTeam && context.user?.team) {
      const result = this.checkScope('team', context.user.team, this.config.perTeam, model, estimatedCost);
      if (result) return result;
    }

    // Check task budget
    if (this.config.perTask && context.task?.id) {
      const result = this.checkScope('task', context.task.id, this.config.perTask, model, estimatedCost);
      if (result) return result;
    }

    return { exceeded: false };
  }

  accumulate(event: UsageEvent): void {
    const now = Date.now();

    if (event.context?.user?.id) {
      addToAccumulator(this.accumulators.user, event.context.user.id, event.cost, now);
    }
    if (event.context?.user?.team) {
      addToAccumulator(this.accumulators.team, event.context.user.team, event.cost, now);
    }
    if (event.context?.task?.id) {
      addToAccumulator(this.accumulators.task, event.context.task.id, event.cost, now);
    }
  }

  private checkScope(
    scope: 'user' | 'team' | 'task',
    scopeId: string,
    limits: BudgetLimits,
    model: string,
    estimatedCost: number,
  ): BudgetCheckResult | undefined {
    const acc = this.accumulators[scope];
    const now = Date.now();

    for (const [window, limit] of Object.entries(limits) as [BudgetWindow, number][]) {
      if (limit === undefined) continue;

      const spent = getSpent(acc, scopeId, window, now);
      const projected = spent + estimatedCost;

      if (projected > limit) {
        return this.handleExceeded(scope, scopeId, spent, limit, window, model);
      }

      // Check downgrade threshold
      if (this.config.enforcement === 'downgrade') {
        const threshold = this.config.downgradeThreshold ?? 0.8;
        if (spent / limit >= threshold) {
          const downgradeModel = this.config.downgrades?.[model];
          if (downgradeModel) {
            return { exceeded: false, downgrade: downgradeModel };
          }
        }
      }
    }

    return undefined;
  }

  private handleExceeded(
    scope: 'user' | 'team' | 'task',
    scopeId: string,
    spent: number,
    limit: number,
    window: BudgetWindow,
    model: string,
  ): BudgetCheckResult {
    if (this.config.enforcement === 'hard') {
      throw new BudgetExhaustedError({ scope, scopeId, spent, limit, window });
    }

    if (this.config.enforcement === 'downgrade') {
      const downgradeModel = this.config.downgrades?.[model];
      if (downgradeModel) {
        return { exceeded: true, scope, scopeId, spent, limit, window, downgrade: downgradeModel };
      }
      // No downgrade available — fall back to hard
      throw new BudgetExhaustedError({ scope, scopeId, spent, limit, window });
    }

    // soft
    return { exceeded: true, scope, scopeId, spent, limit, window };
  }
}

function createAccumulator(): WindowAccumulator {
  return {
    hourly: new Map(),
    daily: new Map(),
    monthly: new Map(),
    total: new Map(),
  };
}

function addToAccumulator(acc: WindowAccumulator, key: string, cost: number, now: number): void {
  for (const window of ['hourly', 'daily', 'monthly'] as const) {
    const map = acc[window];
    const entry = map.get(key);
    const duration = WINDOW_DURATIONS[window];

    if (!entry || now - entry.windowStart > duration) {
      map.set(key, { amount: cost, windowStart: now });
    } else {
      entry.amount += cost;
    }
  }

  acc.total.set(key, (acc.total.get(key) ?? 0) + cost);
}

function getSpent(acc: WindowAccumulator, key: string, window: BudgetWindow, now: number): number {
  if (window === 'total') {
    return acc.total.get(key) ?? 0;
  }

  const entry = acc[window].get(key);
  if (!entry) return 0;

  const duration = WINDOW_DURATIONS[window];
  if (now - entry.windowStart > duration) return 0;

  return entry.amount;
}
