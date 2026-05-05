import { isOllamaProviderType } from './provider-metadata.js';
import type { ModelInfo } from './types.js';

export type ModelCapabilitySource = 'api' | 'provider_metadata' | 'model_heuristic' | 'fallback';

export interface ModelSettingCapability {
  supported: boolean;
  source: ModelCapabilitySource;
  values?: string[];
  default?: string | number | boolean;
  note?: string;
}

export interface ModelCapabilities {
  providerType: string;
  model: string;
  liveModelListed: boolean;
  contextWindow?: number;
  settings: {
    maxTokens: ModelSettingCapability;
    temperature: ModelSettingCapability;
    topP: ModelSettingCapability;
    reasoningEffort: ModelSettingCapability;
    reasoningSummary: ModelSettingCapability;
    verbosity: ModelSettingCapability;
    parallelToolCalls: ModelSettingCapability;
    toolChoice: ModelSettingCapability;
    ollamaThink: ModelSettingCapability;
    nativeOllamaOptions: ModelSettingCapability;
  };
}

export function inferModelCapabilities(input: {
  providerType: string;
  model: string;
  liveModels?: readonly ModelInfo[];
}): ModelCapabilities {
  const providerType = input.providerType.trim().toLowerCase();
  const model = input.model.trim();
  const liveModel = input.liveModels?.find((candidate) => candidate.id === model);
  const isOllama = isOllamaProviderType(providerType);
  const isOpenAi = providerType === 'openai';
  const isAnthropic = providerType === 'anthropic';
  const isOpenAiCompatible = [
    'openrouter',
    'nvidia',
    'groq',
    'mistral',
    'deepseek',
    'together',
    'xai',
    'google',
  ].includes(providerType);

  return {
    providerType,
    model,
    liveModelListed: !!liveModel,
    ...(liveModel?.contextWindow ? { contextWindow: liveModel.contextWindow } : {}),
    settings: {
      maxTokens: supported('provider_metadata', 4096),
      temperature: supported('provider_metadata', 0.7),
      topP: isOllama || isOpenAi || isAnthropic || isOpenAiCompatible
        ? supported('provider_metadata')
        : unsupported('fallback', 'No first-class top-p mapping is registered for this provider.'),
      reasoningEffort: inferReasoningEffort(providerType, model),
      reasoningSummary: inferReasoningSummary(providerType, model),
      verbosity: inferVerbosity(providerType, model),
      parallelToolCalls: isOpenAi || isOpenAiCompatible
        ? supported('provider_metadata', true)
        : unsupported('fallback', 'This provider path does not expose a first-class parallel tool-call switch.'),
      toolChoice: isOpenAi || isOpenAiCompatible
        ? supported('provider_metadata', 'auto', undefined, ['auto', 'none', 'required'])
        : unsupported('fallback', 'This provider path does not expose a first-class tool-choice switch.'),
      ollamaThink: isOllama
        ? supported('provider_metadata', 'default', undefined, ['default', 'off', 'on', 'low', 'medium', 'high'])
        : unsupported('provider_metadata', 'Ollama thinking mode is only available on Ollama-family providers.'),
      nativeOllamaOptions: isOllama
        ? supported('provider_metadata')
        : unsupported('provider_metadata', 'Native Ollama options are only available on Ollama-family providers.'),
    },
  };
}

function supported(
  source: ModelCapabilitySource,
  defaultValue?: string | number | boolean,
  note?: string,
  values?: string[],
): ModelSettingCapability {
  return {
    supported: true,
    source,
    ...(values ? { values } : {}),
    ...(defaultValue !== undefined ? { default: defaultValue } : {}),
    ...(note ? { note } : {}),
  };
}

function unsupported(source: ModelCapabilitySource, note: string): ModelSettingCapability {
  return {
    supported: false,
    source,
    note,
  };
}

function inferReasoningEffort(providerType: string, model: string): ModelSettingCapability {
  const normalizedModel = model.trim().toLowerCase();
  if (isOllamaProviderType(providerType)) {
    return supported(
      'provider_metadata',
      'default',
      'Mapped to Ollama think mode for Ollama-family models.',
      ['default', 'off', 'on', 'low', 'medium', 'high'],
    );
  }
  if (providerType === 'openai' && /^(?:o\d(?:-|$)|gpt-5(?:[.-]|$)|gpt-4\.1(?:[.-]|$))/.test(normalizedModel)) {
    return supported('model_heuristic', 'medium', undefined, ['minimal', 'low', 'medium', 'high']);
  }
  return unsupported(
    'fallback',
    'The provider model catalog did not advertise a first-class reasoning effort control for this model.',
  );
}

function inferReasoningSummary(providerType: string, model: string): ModelSettingCapability {
  const reasoning = inferReasoningEffort(providerType, model);
  if (!reasoning.supported || isOllamaProviderType(providerType)) {
    return unsupported(
      reasoning.source,
      'No separate reasoning summary control is exposed for this provider/model path.',
    );
  }
  return supported(reasoning.source, 'auto', undefined, ['auto', 'concise', 'detailed', 'none']);
}

function inferVerbosity(providerType: string, model: string): ModelSettingCapability {
  if (providerType === 'openai' && /^gpt-5(?:[.-]|$)/i.test(model.trim())) {
    return supported('model_heuristic', 'medium', undefined, ['low', 'medium', 'high']);
  }
  return unsupported(
    'fallback',
    'No first-class verbosity control is registered for this provider/model path.',
  );
}
