/**
 * Failover LLM provider — tries providers in priority order with circuit breakers.
 *
 * When the primary provider fails with a transient/quota/timeout error,
 * the request is retried with the next available provider.
 */

import type { LLMProvider, ChatMessage, ChatResponse, ChatChunk, ChatOptions, ModelInfo } from './types.js';
import { CircuitBreaker } from './circuit-breaker.js';
import type { CircuitState } from './circuit-breaker.js';
import { createLogger } from '../util/logging.js';

const log = createLogger('failover-provider');

/** Per-provider circuit state for monitoring. */
export interface ProviderCircuitState {
  name: string;
  state: CircuitState;
  failureCount: number;
  lastFailureTime: number;
}

/** Configuration for the failover provider. */
export interface FailoverProviderConfig {
  failureThreshold?: number;
  resetTimeoutMs?: number;
}

/** Error classes that should trigger failover to next provider. */
const FAILOVER_ERRORS = new Set(['transient', 'quota', 'timeout']);

/**
 * LLM provider that wraps multiple providers with circuit breakers
 * and fails over to the next available provider on transient errors.
 */
export class FailoverProvider implements LLMProvider {
  readonly name = 'failover';
  private readonly providers: Array<{ name: string; provider: LLMProvider; breaker: CircuitBreaker }>;

  constructor(
    providers: Array<{ name: string; provider: LLMProvider; priority: number }>,
    config?: FailoverProviderConfig,
  ) {
    // Sort by priority (lower = higher priority)
    const sorted = [...providers].sort((a, b) => a.priority - b.priority);

    this.providers = sorted.map(({ name, provider }) => ({
      name,
      provider,
      breaker: new CircuitBreaker({
        failureThreshold: config?.failureThreshold ?? 3,
        resetTimeoutMs: config?.resetTimeoutMs ?? 30_000,
      }),
    }));
  }

  async chat(messages: ChatMessage[], options?: ChatOptions): Promise<ChatResponse> {
    const errors: Array<{ name: string; error: unknown }> = [];

    for (const entry of this.providers) {
      if (!entry.breaker.canRequest()) {
        log.debug({ provider: entry.name }, 'Circuit open, skipping provider');
        continue;
      }

      try {
        const response = await entry.provider.chat(messages, options);
        entry.breaker.recordSuccess();
        return response;
      } catch (error) {
        const errorClass = entry.breaker.recordFailure(error);
        errors.push({ name: entry.name, error });

        log.warn(
          { provider: entry.name, errorClass, error: error instanceof Error ? error.message : String(error) },
          'Provider failed, attempting failover',
        );

        // Only fail over on transient errors
        if (!FAILOVER_ERRORS.has(errorClass)) {
          throw error; // Auth or permanent errors don't benefit from failover
        }
      }
    }

    // All providers exhausted
    const lastError = errors[errors.length - 1]?.error;
    throw lastError ?? new Error('All LLM providers exhausted');
  }

  async *stream(messages: ChatMessage[], options?: ChatOptions): AsyncGenerator<ChatChunk> {
    const errors: Array<{ name: string; error: unknown }> = [];

    for (const entry of this.providers) {
      if (!entry.breaker.canRequest()) {
        continue;
      }

      try {
        const gen = entry.provider.stream(messages, options);

        for await (const chunk of gen) {
          yield chunk;
        }

        // If we got here, stream completed successfully
        entry.breaker.recordSuccess();
        return;
      } catch (error) {
        const errorClass = entry.breaker.recordFailure(error);
        errors.push({ name: entry.name, error });

        log.warn(
          { provider: entry.name, errorClass },
          'Stream failed, attempting failover',
        );

        if (!FAILOVER_ERRORS.has(errorClass)) {
          throw error;
        }
      }
    }

    const lastError = errors[errors.length - 1]?.error;
    throw lastError ?? new Error('All LLM providers exhausted');
  }

  async listModels(): Promise<ModelInfo[]> {
    const allModels: ModelInfo[] = [];

    for (const entry of this.providers) {
      if (!entry.breaker.canRequest()) continue;

      try {
        const models = await entry.provider.listModels();
        allModels.push(...models);
        entry.breaker.recordSuccess();
      } catch (error) {
        entry.breaker.recordFailure(error);
        log.debug({ provider: entry.name }, 'Failed to list models');
      }
    }

    return allModels;
  }

  /** Get the circuit state for all providers (for monitoring). */
  getCircuitStates(): ProviderCircuitState[] {
    return this.providers.map(({ name, breaker }) => ({
      name,
      ...breaker.getInfo(),
    }));
  }
}
