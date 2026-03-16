import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BudgetTracker } from './budget.js';

describe('BudgetTracker', () => {
  let tracker: BudgetTracker;

  beforeEach(() => {
    tracker = new BudgetTracker();
  });

  it('should track agent invocation budget', () => {
    tracker.startInvocation('agent-1', 10, 'message');
    const record = tracker.endInvocation('agent-1');

    expect(record).not.toBeNull();
    expect(record!.agentId).toBe('agent-1');
    expect(record!.budgetMs).toBe(10);
    expect(record!.usedMs).toBeGreaterThanOrEqual(0);
    expect(record!.invocationType).toBe('message');
  });

  it('should return null for untracked agent', () => {
    const record = tracker.endInvocation('nonexistent');
    expect(record).toBeNull();
  });

  it('should record overruns', async () => {
    // Start tracking with a very small budget
    tracker.startInvocation('agent-1', 0.001, 'message');

    // Burn some CPU time
    const start = performance.now();
    while (performance.now() - start < 1) { /* busy wait */ }

    const record = tracker.endInvocation('agent-1');
    expect(record!.overrun).toBe(true);
    expect(tracker.getOverruns().length).toBe(1);
    expect(tracker.getOverrunCount('agent-1')).toBe(1);
  });

  it('should not record non-overruns', () => {
    tracker.startInvocation('agent-1', 1000, 'message'); // Generous budget
    tracker.endInvocation('agent-1');

    expect(tracker.getOverruns().length).toBe(0);
  });

  it('should report elapsed time for active agents', () => {
    tracker.startInvocation('agent-1', 100, 'event');
    expect(tracker.elapsed('agent-1')).toBeGreaterThanOrEqual(0);
  });

  it('should report 0 elapsed for inactive agents', () => {
    expect(tracker.elapsed('nonexistent')).toBe(0);
  });

  it('should limit overrun history size', () => {
    const tracker = new BudgetTracker(3);

    for (let i = 0; i < 5; i++) {
      tracker.startInvocation(`agent-${i}`, 0.0001, 'message');
      const start = performance.now();
      while (performance.now() - start < 0.5) { /* busy wait */ }
      tracker.endInvocation(`agent-${i}`);
    }

    expect(tracker.getOverruns().length).toBeLessThanOrEqual(3);
  });

  it('should clear overrun history', () => {
    tracker.startInvocation('agent-1', 0.001, 'message');
    const start = performance.now();
    while (performance.now() - start < 1) { /* busy wait */ }
    tracker.endInvocation('agent-1');

    expect(tracker.getOverruns().length).toBeGreaterThan(0);
    tracker.clearOverruns();
    expect(tracker.getOverruns().length).toBe(0);
  });

  describe('token usage tracking', () => {
    it('should record and query token usage', () => {
      tracker.recordTokenUsage('agent-1', 100, 50);
      tracker.recordTokenUsage('agent-1', 200, 100);

      const tpm = tracker.getTokensPerMinute('agent-1');
      expect(tpm).toBe(450); // 150 + 300
    });

    it('should return 0 for agents with no usage', () => {
      expect(tracker.getTokensPerMinute('agent-1')).toBe(0);
    });

    it('should aggregate daily usage by scope', () => {
      tracker.recordTokenUsage('agent-1', 100, 50, { principalId: 'principal-a', provider: 'mock' });
      tracker.recordTokenUsage('agent-2', 10, 5, { principalId: 'principal-b', provider: 'mock' });

      expect(tracker.getDailyTokenUsage({ principalId: 'principal-a' })).toBe(150);
      expect(tracker.getDailyTokenUsage({ provider: 'mock' })).toBe(165);
      expect(tracker.isDailyCapExceeded({ principalId: 'principal-a' }, 100)).toBe(true);
    });
  });
});
