/**
 * Rate limiter — admission controller for request throttling.
 *
 * Layer 1 defense: prevents DoS via message flooding or expensive LLM calls.
 * Tracks per-agent request timestamps in sliding windows.
 */

import type { AdmissionController, AdmissionPhase, AdmissionResult, AgentAction } from './guardian.js';

/** Configuration for rate limiting. */
export interface RateLimiterConfig {
  /** Maximum requests per minute per agent (default: 30). */
  maxPerMinute: number;
  /** Maximum requests per hour per agent (default: 500). */
  maxPerHour: number;
  /** Maximum burst requests within 10 seconds (default: 5). */
  burstAllowed: number;
}

const DEFAULT_CONFIG: RateLimiterConfig = {
  maxPerMinute: 30,
  maxPerHour: 500,
  burstAllowed: 5,
};

/**
 * Rate limiter admission controller.
 *
 * Validating phase: checks per-agent request rates across three windows
 * (burst/10s, per-minute, per-hour). Only limits message_dispatch actions.
 */
export class RateLimiter implements AdmissionController {
  readonly name = 'RateLimiter';
  readonly phase: AdmissionPhase = 'validating';

  private windows: Map<string, number[]> = new Map();
  private config: RateLimiterConfig;

  constructor(config?: Partial<RateLimiterConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  check(action: AgentAction): AdmissionResult | null {
    // Only rate-limit message dispatch
    if (action.type !== 'message_dispatch') return null;

    const key = action.agentId;
    const now = Date.now();
    const timestamps = this.windows.get(key) ?? [];

    // Clean timestamps older than 1 hour
    const recent = timestamps.filter(t => now - t < 3_600_000);

    // Check burst (10s window)
    const burstCount = recent.filter(t => now - t < 10_000).length;
    if (burstCount >= this.config.burstAllowed) {
      return {
        allowed: false,
        reason: `Rate limit: burst exceeded (${burstCount}/${this.config.burstAllowed} in 10s)`,
        controller: this.name,
      };
    }

    // Check per-minute
    const minuteCount = recent.filter(t => now - t < 60_000).length;
    if (minuteCount >= this.config.maxPerMinute) {
      return {
        allowed: false,
        reason: `Rate limit: per-minute exceeded (${minuteCount}/${this.config.maxPerMinute})`,
        controller: this.name,
      };
    }

    // Check per-hour
    if (recent.length >= this.config.maxPerHour) {
      return {
        allowed: false,
        reason: `Rate limit: per-hour exceeded (${recent.length}/${this.config.maxPerHour})`,
        controller: this.name,
      };
    }

    // Record this request
    recent.push(now);
    this.windows.set(key, recent);
    return null;
  }

  /** Reset rate limit state for an agent. */
  reset(agentId: string): void {
    this.windows.delete(agentId);
  }

  /** Reset all rate limit state. */
  resetAll(): void {
    this.windows.clear();
  }
}
