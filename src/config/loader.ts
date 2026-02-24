/**
 * Configuration loader.
 *
 * Loads from ~/.openagent/config.yaml with ${ENV_VAR} interpolation,
 * deep-merges with defaults, and validates required fields.
 */

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import yaml from 'js-yaml';
import type { GuardianAgentConfig } from './types.js';
import { DEFAULT_CONFIG } from './types.js';

/** Default config file path. */
export const DEFAULT_CONFIG_PATH = join(homedir(), '.openagent', 'config.yaml');

/** Interpolate ${ENV_VAR} references in a string. */
export function interpolateEnvVars(value: string): string {
  return value.replace(/\$\{([^}]+)\}/g, (_match, varName: string) => {
    const envValue = process.env[varName];
    if (envValue === undefined) {
      throw new Error(`Environment variable '${varName}' is not set`);
    }
    return envValue;
  });
}

/** Recursively interpolate env vars in an object. */
function interpolateDeep(obj: unknown): unknown {
  if (typeof obj === 'string') {
    return interpolateEnvVars(obj);
  }
  if (Array.isArray(obj)) {
    return obj.map(interpolateDeep);
  }
  if (obj !== null && typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = interpolateDeep(value);
    }
    return result;
  }
  return obj;
}

/** Deep merge source into target. Source values override target. */
export function deepMerge<T>(target: T, source: Partial<T>): T {
  const result = { ...target } as Record<string, unknown>;
  const src = source as Record<string, unknown>;
  const tgt = target as Record<string, unknown>;

  for (const key of Object.keys(src)) {
    const sourceVal = src[key];
    const targetVal = tgt[key];

    if (
      sourceVal !== null &&
      typeof sourceVal === 'object' &&
      !Array.isArray(sourceVal) &&
      targetVal !== null &&
      typeof targetVal === 'object' &&
      !Array.isArray(targetVal)
    ) {
      result[key] = deepMerge(
        targetVal as Record<string, unknown>,
        sourceVal as Record<string, unknown>,
      );
    } else if (sourceVal !== undefined) {
      result[key] = sourceVal;
    }
  }

  return result as T;
}

/** Validate required configuration fields. */
export function validateConfig(config: GuardianAgentConfig): string[] {
  const errors: string[] = [];

  if (!config.defaultProvider) {
    errors.push('defaultProvider is required');
  }

  if (config.defaultProvider && !config.llm[config.defaultProvider]) {
    errors.push(`defaultProvider '${config.defaultProvider}' not found in llm configuration`);
  }

  for (const [name, llm] of Object.entries(config.llm)) {
    if (!llm.provider) {
      errors.push(`llm.${name}.provider is required`);
    }
    if (!['ollama', 'anthropic', 'openai'].includes(llm.provider)) {
      errors.push(`llm.${name}.provider must be 'ollama', 'anthropic', or 'openai'`);
    }
    if (!llm.model) {
      errors.push(`llm.${name}.model is required`);
    }
    if (llm.provider !== 'ollama' && !llm.apiKey) {
      errors.push(`llm.${name}.apiKey is required for provider '${llm.provider}'`);
    }
  }

  if (config.channels.telegram?.enabled && !config.channels.telegram.botToken) {
    errors.push('channels.telegram.botToken is required when Telegram is enabled');
  }

  return errors;
}

/** Load configuration from a YAML file path. */
export function loadConfigFromFile(filePath: string): GuardianAgentConfig {
  if (!existsSync(filePath)) {
    throw new Error(`Configuration file not found: ${filePath}`);
  }

  const raw = readFileSync(filePath, 'utf-8');
  const parsed = yaml.load(raw) as Partial<GuardianAgentConfig> | null;

  if (!parsed || typeof parsed !== 'object') {
    throw new Error(`Invalid configuration file: ${filePath}`);
  }

  const interpolated = interpolateDeep(parsed) as Partial<GuardianAgentConfig>;
  const merged = deepMerge(DEFAULT_CONFIG, interpolated);

  const errors = validateConfig(merged);
  if (errors.length > 0) {
    throw new Error(`Configuration validation failed:\n  - ${errors.join('\n  - ')}`);
  }

  return merged;
}

/** Load configuration with fallback to defaults. */
export function loadConfig(filePath?: string): GuardianAgentConfig {
  const path = filePath ?? DEFAULT_CONFIG_PATH;

  if (!existsSync(path)) {
    // No config file — return defaults
    return { ...DEFAULT_CONFIG };
  }

  return loadConfigFromFile(path);
}
