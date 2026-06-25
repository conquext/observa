import { describe, it, expect } from 'vitest';
import { ContextManager } from '../src/context.js';

describe('ContextManager', () => {
  it('returns undefined when no context is set', () => {
    expect(ContextManager.get()).toBeUndefined();
  });

  it('provides context within run scope', () => {
    const ctx = { user: { id: 'u1' } };
    ContextManager.run(ctx, () => {
      expect(ContextManager.get()).toEqual(ctx);
    });
  });

  it('context is not available outside run scope', () => {
    ContextManager.run({ user: { id: 'u1' } }, () => {});
    expect(ContextManager.get()).toBeUndefined();
  });

  it('supports nested contexts', async () => {
    const outer = { user: { id: 'u1' } };
    const inner = { user: { id: 'u2' }, task: { id: 't1' } };

    await ContextManager.run(outer, async () => {
      expect(ContextManager.get()?.user?.id).toBe('u1');

      await ContextManager.run(inner, async () => {
        expect(ContextManager.get()?.user?.id).toBe('u2');
      });

      expect(ContextManager.get()?.user?.id).toBe('u1');
    });
  });

  describe('merge', () => {
    it('returns override when base is undefined', () => {
      const result = ContextManager.merge(undefined, { user: { id: 'u1' } });
      expect(result.user?.id).toBe('u1');
    });

    it('returns base when override is undefined', () => {
      const result = ContextManager.merge({ user: { id: 'u1' } }, undefined);
      expect(result.user?.id).toBe('u1');
    });

    it('override fields take precedence', () => {
      const result = ContextManager.merge(
        { user: { id: 'u1' }, task: { id: 't1' } },
        { user: { id: 'u2' } },
      );
      expect(result.user?.id).toBe('u2');
      expect(result.task?.id).toBe('t1');
    });

    it('merges labels', () => {
      const result = ContextManager.merge(
        { labels: { env: 'prod', service: 'api' } },
        { labels: { env: 'staging' } },
      );
      expect(result.labels).toEqual({ env: 'staging', service: 'api' });
    });
  });
});
