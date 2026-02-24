/**
 * Watchdog — timestamp-based stall detection for agents.
 *
 * Runs on setInterval. Checks lastActivityMs per agent
 * and transitions stalled agents. Uses exponential backoff on errors.
 */

import type { AgentInstance } from '../agent/types.js';
import { AgentState } from '../agent/types.js';
import type { AgentRegistry } from '../agent/registry.js';
import type { AuditLog } from '../guardian/audit-log.js';
import { getBackoffDelayMs, MAX_RETRIES } from '../util/backoff.js';
import { createLogger } from '../util/logging.js';

const log = createLogger('watchdog');

/** Watchdog check result for a single agent. */
export interface WatchdogResult {
  agentId: string;
  action: 'ok' | 'stalled' | 'retry' | 'killed';
  stalledMs?: number;
  consecutiveErrors?: number;
}

export class Watchdog {
  private registry: AgentRegistry;
  private maxStallDurationMs: number;
  private intervalHandle: ReturnType<typeof setInterval> | null = null;
  private auditLog?: AuditLog;

  constructor(registry: AgentRegistry, maxStallDurationMs: number = 60_000, auditLog?: AuditLog) {
    this.registry = registry;
    this.maxStallDurationMs = maxStallDurationMs;
    this.auditLog = auditLog;
  }

  /** Start the watchdog on a periodic interval. */
  start(intervalMs: number = 10_000): void {
    if (this.intervalHandle) return;
    this.intervalHandle = setInterval(() => {
      this.check();
    }, intervalMs);
  }

  /** Stop the watchdog interval. */
  stop(): void {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
    }
  }

  /**
   * Run a watchdog check on all agents.
   *
   * @param nowMs - Current time for stall/retry calculations
   */
  check(nowMs: number = Date.now()): WatchdogResult[] {
    const results: WatchdogResult[] = [];

    for (const instance of this.registry.getAll()) {
      const result = this.checkAgent(instance, nowMs);
      if (result) {
        results.push(result);
      }
    }

    return results;
  }

  private checkAgent(
    instance: AgentInstance,
    nowMs: number,
  ): WatchdogResult | null {
    const agentId = instance.agent.id;
    const { state } = instance;

    // Only monitor running agents for stalls
    if (state === AgentState.Running) {
      const stalledMs = nowMs - instance.lastActivityMs;
      if (stalledMs > this.maxStallDurationMs) {
        log.warn({ agentId, stalledMs }, 'Agent stalled');
        this.auditLog?.record({
          type: 'agent_stalled',
          severity: 'warn',
          agentId,
          details: { stalledMs, maxStallDurationMs: this.maxStallDurationMs },
        });
        try {
          this.registry.transitionState(agentId, AgentState.Stalled, 'watchdog: no activity');
        } catch {
          // Transition may fail if agent changed state concurrently
        }
        return { agentId, action: 'stalled', stalledMs };
      }
      return { agentId, action: 'ok' };
    }

    // Check errored agents for retry eligibility
    if (state === AgentState.Errored) {
      if (instance.consecutiveErrors >= MAX_RETRIES) {
        log.error({ agentId, consecutiveErrors: instance.consecutiveErrors }, 'Agent exceeded max retries, killing');
        try {
          this.registry.transitionState(agentId, AgentState.Dead, 'watchdog: max retries exceeded');
        } catch {
          // Already dead or transitioning
        }
        return { agentId, action: 'killed', consecutiveErrors: instance.consecutiveErrors };
      }

      if (nowMs >= instance.retryAfterMs) {
        log.info({ agentId, consecutiveErrors: instance.consecutiveErrors }, 'Retrying errored agent');
        try {
          this.registry.transitionState(agentId, AgentState.Ready, 'watchdog: retry');
        } catch (err) {
          log.error({ agentId, err }, 'Failed to retry agent');
        }
        return { agentId, action: 'retry', consecutiveErrors: instance.consecutiveErrors };
      }
    }

    return null;
  }

  /**
   * Record an error for an agent. Updates consecutive error count
   * and calculates next retry time.
   */
  recordError(agentId: string, nowMs: number = Date.now()): void {
    const instance = this.registry.get(agentId);
    if (!instance) return;

    instance.consecutiveErrors++;
    const delay = getBackoffDelayMs(instance.consecutiveErrors);
    instance.retryAfterMs = nowMs + delay;

    log.warn({
      agentId,
      consecutiveErrors: instance.consecutiveErrors,
      retryAfterMs: instance.retryAfterMs,
      delayMs: delay,
    }, 'Agent error recorded');
  }

  /** Reset error count for an agent (on successful invocation). */
  clearErrors(agentId: string): void {
    const instance = this.registry.get(agentId);
    if (!instance) return;

    if (instance.consecutiveErrors > 0) {
      instance.consecutiveErrors = 0;
      instance.retryAfterMs = 0;
    }
  }

  /** Update last activity timestamp for an agent. */
  recordActivity(agentId: string, nowMs: number = Date.now()): void {
    const instance = this.registry.get(agentId);
    if (!instance) return;
    instance.lastActivityMs = nowMs;
  }
}
