import type { GuardianAgentConfig } from './types.js';
import { getProviderLocality, getProviderTier } from '../llm/provider-metadata.js';

function isManagedCloudProvider(config: GuardianAgentConfig, providerName: string | undefined): providerName is string {
  const trimmed = providerName?.trim();
  return !!trimmed && getProviderTier(config.llm[trimmed]?.provider) === 'managed_cloud';
}

function isLocalProvider(config: GuardianAgentConfig, providerName: string | undefined): providerName is string {
  const trimmed = providerName?.trim();
  return !!trimmed && getProviderLocality(config.llm[trimmed]?.provider) === 'local';
}

function isFrontierProvider(config: GuardianAgentConfig, providerName: string | undefined): providerName is string {
  const trimmed = providerName?.trim();
  return !!trimmed && getProviderTier(config.llm[trimmed]?.provider) === 'frontier';
}

function listProvidersByTier(config: GuardianAgentConfig, tier: 'managed_cloud' | 'frontier'): string[] {
  return Object.entries(config.llm)
    .filter(([, llmCfg]) => getProviderTier(llmCfg.provider) === tier)
    .map(([name]) => name)
    .sort((left, right) => left.localeCompare(right));
}

function listLocalProviders(config: GuardianAgentConfig): string[] {
  return Object.entries(config.llm)
    .filter(([, llmCfg]) => getProviderLocality(llmCfg.provider) === 'local')
    .map(([name]) => name)
    .sort((left, right) => left.localeCompare(right));
}

export function resolveDerivedDefaultProvider(config: GuardianAgentConfig): string {
  const providerNames = Object.keys(config.llm).sort((left, right) => left.localeCompare(right));
  if (providerNames.length === 0) return '';

  const preferredProviders = config.assistant.tools?.preferredProviders;
  const managedCloudRouting = config.assistant.tools?.modelSelection?.managedCloudRouting;
  const generalManagedCloud = managedCloudRouting?.enabled !== false
    ? managedCloudRouting?.roleBindings?.general
    : undefined;
  const legacyExternal = preferredProviders?.external;

  const candidates = [
    isManagedCloudProvider(config, generalManagedCloud) ? generalManagedCloud : undefined,
    isManagedCloudProvider(config, preferredProviders?.managedCloud) ? preferredProviders?.managedCloud : undefined,
    isManagedCloudProvider(config, legacyExternal) ? legacyExternal : undefined,
    listProvidersByTier(config, 'managed_cloud')[0],
    isLocalProvider(config, preferredProviders?.local) ? preferredProviders?.local : undefined,
    listLocalProviders(config)[0],
    isFrontierProvider(config, preferredProviders?.frontier) ? preferredProviders?.frontier : undefined,
    isFrontierProvider(config, legacyExternal) ? legacyExternal : undefined,
    listProvidersByTier(config, 'frontier')[0],
    providerNames[0],
  ];

  return candidates.find((candidate): candidate is string => !!candidate) ?? '';
}

export function applyDerivedDefaultProvider(config: GuardianAgentConfig): GuardianAgentConfig {
  config.defaultProvider = resolveDerivedDefaultProvider(config);
  return config;
}
