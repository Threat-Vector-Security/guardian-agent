/**
 * LLM provider factory.
 *
 * Creates the appropriate provider instance based on configuration.
 * Uses ProviderRegistry internally — all providers are built-in,
 * no external plugin loading.
 */

import type { LLMProvider } from './types.js';
import type { LLMConfig, FailoverConfig } from '../config/types.js';
import { ProviderRegistry } from './provider-registry.js';
import { FailoverProvider } from './failover-provider.js';

/** Shared registry instance. */
let sharedRegistry: ProviderRegistry | undefined;

/** Get or create the shared provider registry. */
export function getProviderRegistry(): ProviderRegistry {
  if (!sharedRegistry) {
    sharedRegistry = new ProviderRegistry();
  }
  return sharedRegistry;
}

/** Set the shared provider registry (for testing). */
export function setProviderRegistry(registry: ProviderRegistry): void {
  sharedRegistry = registry;
}

/** Create an LLM provider from configuration. */
export function createProvider(config: LLMConfig): LLMProvider {
  return getProviderRegistry().createProvider(config);
}

/** Create all providers from a config map. */
export function createProviders(
  configs: Record<string, LLMConfig>,
): Map<string, LLMProvider> {
  return getProviderRegistry().createProviders(
    Object.fromEntries(
      Object.entries(configs).filter(([, config]) => config.enabled !== false),
    ),
  );
}

/**
 * Create a FailoverProvider that wraps all configured providers
 * with circuit breakers and priority-based failover.
 */
export function createFailoverProvider(
  configs: Record<string, LLMConfig>,
  failoverConfig?: FailoverConfig,
): FailoverProvider {
  const registry = getProviderRegistry();
  const providerEntries = Object.entries(configs)
    .filter(([, config]) => config.enabled !== false)
    .map(([name, config]) => ({
      name,
      provider: registry.createProvider(config),
      priority: config.priority ?? 10,
    }));

  return new FailoverProvider(providerEntries, {
    failureThreshold: failoverConfig?.failureThreshold ?? 3,
    resetTimeoutMs: failoverConfig?.resetTimeoutMs ?? 30_000,
  });
}
