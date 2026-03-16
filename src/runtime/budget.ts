/**
 * Compute budget tracking.
 *
 * Measures per-agent per-invocation wall-clock consumption and records overruns.
 * Also tracks token usage for rate limiting.
 */

import { performance } from 'node:perf_hooks';

/** Record of a single invocation's budget usage. */
export interface BudgetRecord {
  agentId: string;
  invocationType: string;
  budgetMs: number;
  usedMs: number;
  overrun: boolean;
}

/** Token usage record for rate limiting. */
export interface TokenRecord {
  agentId: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  timestamp: number;
  principalId?: string;
  provider?: string;
  scheduleId?: string;
}

export interface TokenUsageScope {
  agentId?: string;
  principalId?: string;
  provider?: string;
  scheduleId?: string;
}

export class BudgetTracker {
  private active: Map<string, { startMs: number; budgetMs: number; invocationType: string }> = new Map();
  private overruns: BudgetRecord[] = [];
  private tokenHistory: TokenRecord[] = [];
  private concurrentCounts: Map<string, number> = new Map();
  private maxOverrunHistory: number;

  constructor(maxOverrunHistory: number = 1000) {
    this.maxOverrunHistory = maxOverrunHistory;
  }

  /** Start tracking budget for an agent invocation. Increments concurrent count. */
  startInvocation(agentId: string, budgetMs: number, invocationType: string): void {
    this.active.set(agentId, {
      startMs: performance.now(),
      budgetMs,
      invocationType,
    });
    this.concurrentCounts.set(agentId, (this.concurrentCounts.get(agentId) ?? 0) + 1);
  }

  /**
   * End tracking for an agent invocation.
   * Returns the budget record with usage info.
   */
  endInvocation(agentId: string): BudgetRecord | null {
    const tracking = this.active.get(agentId);
    if (!tracking) return null;

    this.active.delete(agentId);
    const current = this.concurrentCounts.get(agentId) ?? 0;
    if (current > 0) this.concurrentCounts.set(agentId, current - 1);
    const usedMs = performance.now() - tracking.startMs;
    const overrun = usedMs > tracking.budgetMs;

    const record: BudgetRecord = {
      agentId,
      invocationType: tracking.invocationType,
      budgetMs: tracking.budgetMs,
      usedMs,
      overrun,
    };

    if (overrun) {
      this.overruns.push(record);
      if (this.overruns.length > this.maxOverrunHistory) {
        this.overruns.shift();
      }
    }

    return record;
  }

  /** Check if an agent is currently over budget. */
  isOverBudget(agentId: string): boolean {
    const tracking = this.active.get(agentId);
    if (!tracking) return false;
    return (performance.now() - tracking.startMs) > tracking.budgetMs;
  }

  /** Get elapsed time for an active agent (ms). */
  elapsed(agentId: string): number {
    const tracking = this.active.get(agentId);
    if (!tracking) return 0;
    return performance.now() - tracking.startMs;
  }

  /** Record token usage for an agent. */
  recordTokenUsage(
    agentId: string,
    promptTokens: number,
    completionTokens: number,
    context?: { principalId?: string; provider?: string; scheduleId?: string },
  ): void {
    this.tokenHistory.push({
      agentId,
      promptTokens,
      completionTokens,
      totalTokens: promptTokens + completionTokens,
      timestamp: Date.now(),
      principalId: context?.principalId,
      provider: context?.provider,
      scheduleId: context?.scheduleId,
    });

    // Keep only last 24 hours of records for budget windows.
    const oneDayAgo = Date.now() - 86_400_000;
    this.tokenHistory = this.tokenHistory.filter(r => r.timestamp > oneDayAgo);
  }

  /** Get tokens used in the last minute for an agent. */
  getTokensPerMinute(agentId: string): number {
    const oneMinuteAgo = Date.now() - 60_000;
    return this.tokenHistory
      .filter(r => r.agentId === agentId && r.timestamp > oneMinuteAgo)
      .reduce((sum, r) => sum + r.totalTokens, 0);
  }

  /** Get tokens used over the last 24 hours for a scoped actor/provider/schedule slice. */
  getDailyTokenUsage(scope: TokenUsageScope): number {
    const oneDayAgo = Date.now() - 86_400_000;
    return this.tokenHistory
      .filter((record) => {
        if (record.timestamp <= oneDayAgo) return false;
        if (scope.agentId && record.agentId !== scope.agentId) return false;
        if (scope.principalId && record.principalId !== scope.principalId) return false;
        if (scope.provider && record.provider !== scope.provider) return false;
        if (scope.scheduleId && record.scheduleId !== scope.scheduleId) return false;
        return true;
      })
      .reduce((sum, record) => sum + record.totalTokens, 0);
  }

  isDailyCapExceeded(scope: TokenUsageScope, cap: number): boolean {
    if (cap <= 0) return false;
    return this.getDailyTokenUsage(scope) >= cap;
  }

  /** Get recent budget overruns. */
  getOverruns(): readonly BudgetRecord[] {
    return this.overruns;
  }

  /** Get overrun count for a specific agent. */
  getOverrunCount(agentId: string): number {
    return this.overruns.filter(r => r.agentId === agentId).length;
  }

  /** Clear overrun history. */
  clearOverruns(): void {
    this.overruns = [];
  }

  /** Get current concurrent invocation count for an agent. */
  getConcurrentCount(agentId: string): number {
    return this.concurrentCounts.get(agentId) ?? 0;
  }
}
