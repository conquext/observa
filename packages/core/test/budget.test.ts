import { describe, it, expect, beforeEach } from 'vitest';
import { BudgetEngine } from '../src/budget.js';
import { BudgetExhaustedError } from '../src/errors.js';
import type { BudgetConfig, UsageEvent } from '../src/types.js';

const makeEvent = (overrides: Partial<UsageEvent> = {}): UsageEvent => ({
  id: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
  timestamp: new Date(),
  model: 'gpt-4o',
  provider: 'openai',
  input_tokens: 100,
  output_tokens: 50,
  total_tokens: 150,
  cost: 5.00,
  latency_ms: 500,
  status: 'success',
  context: { user: { id: 'u1', team: 'eng' }, task: { id: 't1' } },
  ...overrides,
});

describe('BudgetEngine', () => {
  describe('hard enforcement', () => {
    it('throws BudgetExhaustedError when user daily limit exceeded', () => {
      const config: BudgetConfig = {
        perUser: { daily: 10.00 },
        enforcement: 'hard',
      };
      const engine = new BudgetEngine(config);

      // Accumulate $8 spent
      engine.accumulate(makeEvent({ cost: 8.00 }));

      // Next call estimated at $5 → total would be $13 > $10
      expect(() => {
        engine.check({ user: { id: 'u1' } }, 'gpt-4o', 5.00);
      }).toThrow(BudgetExhaustedError);
    });

    it('allows call when under budget', () => {
      const config: BudgetConfig = {
        perUser: { daily: 100.00 },
        enforcement: 'hard',
      };
      const engine = new BudgetEngine(config);
      engine.accumulate(makeEvent({ cost: 5.00 }));

      expect(() => {
        engine.check({ user: { id: 'u1' } }, 'gpt-4o', 5.00);
      }).not.toThrow();
    });

    it('enforces team budgets', () => {
      const config: BudgetConfig = {
        perTeam: { daily: 10.00 },
        enforcement: 'hard',
      };
      const engine = new BudgetEngine(config);
      engine.accumulate(makeEvent({ cost: 8.00 }));

      expect(() => {
        engine.check({ user: { id: 'u1', team: 'eng' } }, 'gpt-4o', 5.00);
      }).toThrow(BudgetExhaustedError);
    });

    it('enforces task budgets', () => {
      const config: BudgetConfig = {
        perTask: { total: 10.00 },
        enforcement: 'hard',
      };
      const engine = new BudgetEngine(config);
      engine.accumulate(makeEvent({ cost: 8.00 }));

      expect(() => {
        engine.check({ user: { id: 'u1' }, task: { id: 't1' } }, 'gpt-4o', 5.00);
      }).toThrow(BudgetExhaustedError);
    });
  });

  describe('soft enforcement', () => {
    it('does not throw, returns exceeded info', () => {
      const config: BudgetConfig = {
        perUser: { daily: 10.00 },
        enforcement: 'soft',
      };
      const engine = new BudgetEngine(config);
      engine.accumulate(makeEvent({ cost: 8.00 }));

      const result = engine.check({ user: { id: 'u1' } }, 'gpt-4o', 5.00);
      expect(result.exceeded).toBe(true);
      expect(result.scope).toBe('user');
    });
  });

  describe('downgrade enforcement', () => {
    it('returns downgrade model when approaching threshold', () => {
      const config: BudgetConfig = {
        perUser: { daily: 10.00 },
        enforcement: 'downgrade',
        downgrades: { 'gpt-4o': 'gpt-4o-mini' },
        downgradeThreshold: 0.8,
      };
      const engine = new BudgetEngine(config);
      engine.accumulate(makeEvent({ cost: 8.50 })); // 85% > 80% threshold

      const result = engine.check({ user: { id: 'u1' } }, 'gpt-4o', 1.00);
      expect(result.downgrade).toBe('gpt-4o-mini');
    });

    it('throws when downgrade model not available and over limit', () => {
      const config: BudgetConfig = {
        perUser: { daily: 10.00 },
        enforcement: 'downgrade',
        downgrades: {},
      };
      const engine = new BudgetEngine(config);
      engine.accumulate(makeEvent({ cost: 11.00 }));

      expect(() => {
        engine.check({ user: { id: 'u1' } }, 'gpt-4o', 1.00);
      }).toThrow(BudgetExhaustedError);
    });
  });

  describe('window tracking', () => {
    it('tracks separate windows independently', () => {
      const config: BudgetConfig = {
        perUser: { hourly: 5.00, daily: 50.00 },
        enforcement: 'hard',
      };
      const engine = new BudgetEngine(config);
      engine.accumulate(makeEvent({ cost: 4.50 }));

      // Under daily ($4.50 < $50) but hourly would be exceeded ($4.50 + $1 > $5)
      expect(() => {
        engine.check({ user: { id: 'u1' } }, 'gpt-4o', 1.00);
      }).toThrow(BudgetExhaustedError);
    });
  });
});
