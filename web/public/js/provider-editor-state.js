export function canTestProviderConnection(selectedProfile, providerName) {
  const selected = typeof selectedProfile === 'string' ? selectedProfile.trim() : '';
  const name = typeof providerName === 'string' ? providerName.trim() : '';
  return !!selected && !!name && selected === name;
}

const CAPABILITY_SETTING_LABELS = {
  reasoningEffort: 'Reasoning effort',
  reasoningSummary: 'Reasoning summary',
  reasoningBudget: 'Reasoning budget',
  verbosity: 'Verbosity',
  parallelToolCalls: 'Parallel tool calls',
  toolChoice: 'Tool choice',
  ollamaThink: 'Think mode',
  nativeOllamaOptions: 'Native Ollama options',
};

const CAPABILITY_SOURCE_LABELS = {
  api: 'live model API metadata',
  provider_metadata: 'provider defaults',
  model_heuristic: 'model-family defaults',
  fallback: 'safe fallback defaults',
};

const CAPABILITY_SOURCE_PRIORITY = ['api', 'provider_metadata', 'model_heuristic', 'fallback'];

export function summarizeModelCapabilitySettings(capabilities) {
  if (!capabilities?.settings || typeof capabilities.settings !== 'object') {
    return 'Capability metadata is not loaded yet. Common controls stay available, and unsupported advanced options are left at provider defaults.';
  }

  const settings = capabilities.settings;
  const supportedAdvanced = Object.entries(CAPABILITY_SETTING_LABELS)
    .filter(([key]) => settings[key]?.supported === true)
    .map(([, label]) => label);
  const sources = new Set(Object.values(settings)
    .map((setting) => typeof setting?.source === 'string' ? setting.source : '')
    .filter(Boolean));
  const primarySource = CAPABILITY_SOURCE_PRIORITY.find((source) => sources.has(source)) || 'fallback';
  const sourceLabel = CAPABILITY_SOURCE_LABELS[primarySource] || CAPABILITY_SOURCE_LABELS.fallback;
  const catalogLabel = capabilities.liveModelListed === true
    ? 'Model found in the live catalog'
    : 'Model-specific live catalog data was not returned';
  const controlsLabel = supportedAdvanced.length > 0
    ? `Advanced controls: ${supportedAdvanced.join(', ')}.`
    : 'Advanced controls are limited to common provider defaults.';

  return `${catalogLabel}; using ${sourceLabel}. ${controlsLabel} If a provider rejects a capability option, Guardian retries with the safe baseline.`;
}
