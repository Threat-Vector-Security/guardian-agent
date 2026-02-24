/**
 * LLM provider factory.
 *
 * Creates the appropriate provider instance based on configuration.
 */

import type { LLMProvider } from './types.js';
import type { LLMConfig } from '../config/types.js';
import { OllamaProvider } from './ollama.js';
import { AnthropicProvider } from './anthropic.js';
import { OpenAIProvider } from './openai.js';

/** Create an LLM provider from configuration. */
export function createProvider(config: LLMConfig): LLMProvider {
  switch (config.provider) {
    case 'ollama':
      return new OllamaProvider(config);
    case 'anthropic':
      return new AnthropicProvider(config);
    case 'openai':
      return new OpenAIProvider(config);
    default:
      throw new Error(`Unknown LLM provider: ${config.provider as string}`);
  }
}

/** Create all providers from a config map. */
export function createProviders(
  configs: Record<string, LLMConfig>,
): Map<string, LLMProvider> {
  const providers = new Map<string, LLMProvider>();
  for (const [name, config] of Object.entries(configs)) {
    providers.set(name, createProvider(config));
  }
  return providers;
}
