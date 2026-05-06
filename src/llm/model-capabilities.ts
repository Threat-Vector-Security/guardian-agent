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
  const liveCapabilitySet = buildLiveCapabilitySet(liveModel);
  const liveParameterSet = buildLiveParameterSet(liveModel);
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
      maxTokens: inferRequestParameter(liveParameterSet, {
        parameters: ['max_tokens', 'max_completion_tokens', 'max_output_tokens'],
        defaultValue: 4096,
        fallback: supported('provider_metadata', 4096),
        missingNote: 'The live model API did not advertise a first-class max-token parameter for this model.',
      }),
      temperature: inferRequestParameter(liveParameterSet, {
        parameters: ['temperature'],
        defaultValue: 0.7,
        fallback: supported('provider_metadata', 0.7),
        missingNote: 'The live model API did not advertise a first-class temperature parameter for this model.',
      }),
      topP: isOllama || isOpenAi || isAnthropic || isOpenAiCompatible
        ? inferRequestParameter(liveParameterSet, {
            parameters: ['top_p', 'topP'],
            fallback: supported('provider_metadata'),
            missingNote: 'The live model API did not advertise a first-class top-p parameter for this model.',
          })
        : unsupported('fallback', 'No first-class top-p mapping is registered for this provider.'),
      reasoningEffort: inferReasoningEffort(providerType, model, liveModel, liveCapabilitySet, liveParameterSet),
      reasoningSummary: inferReasoningSummary(providerType, model, liveModel, liveCapabilitySet, liveParameterSet),
      verbosity: inferVerbosity(providerType, model, liveParameterSet),
      parallelToolCalls: isOpenAi || isOpenAiCompatible
        ? inferRequestParameter(liveParameterSet, {
            parameters: ['parallel_tool_calls', 'parallelToolCalls'],
            defaultValue: true,
            fallback: supported('provider_metadata', true),
            missingNote: 'The live model API did not advertise a first-class parallel tool-call switch for this model.',
          })
        : unsupported('fallback', 'This provider path does not expose a first-class parallel tool-call switch.'),
      toolChoice: isOpenAi || isOpenAiCompatible
        ? inferRequestParameter(liveParameterSet, {
            parameters: ['tool_choice', 'toolChoice'],
            defaultValue: 'auto',
            values: ['auto', 'none', 'required'],
            fallback: supported('provider_metadata', 'auto', undefined, ['auto', 'none', 'required']),
            missingNote: 'The live model API did not advertise a first-class tool-choice switch for this model.',
          })
        : unsupported('fallback', 'This provider path does not expose a first-class tool-choice switch.'),
      ollamaThink: isOllama
        ? inferOllamaThink(liveModel, liveCapabilitySet)
        : unsupported('provider_metadata', 'Ollama thinking mode is only available on Ollama-family providers.'),
      nativeOllamaOptions: isOllama
        ? supported('provider_metadata')
        : unsupported('provider_metadata', 'Native Ollama options are only available on Ollama-family providers.'),
    },
  };
}

function buildLiveParameterSet(liveModel: ModelInfo | undefined): Set<string> | undefined {
  if (!liveModel || !Array.isArray(liveModel.supportedParameters)) return undefined;
  return new Set(liveModel.supportedParameters
    .map((parameter) => parameter.trim().toLowerCase())
    .filter(Boolean));
}

function buildLiveCapabilitySet(liveModel: ModelInfo | undefined): Set<string> | undefined {
  if (!liveModel?.capabilities) return undefined;
  const normalized = liveModel.capabilities
    .map((capability) => capability.trim().toLowerCase())
    .filter(Boolean);
  return normalized.length > 0 ? new Set(normalized) : undefined;
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

function inferRequestParameter(
  liveParameters: Set<string> | undefined,
  options: {
    parameters: string[];
    fallback: ModelSettingCapability;
    missingNote: string;
    defaultValue?: string | number | boolean;
    values?: string[];
  },
): ModelSettingCapability {
  if (!liveParameters) return options.fallback;
  if (hasAny(liveParameters, options.parameters)) {
    return supported('api', options.defaultValue, undefined, options.values);
  }
  return unsupported('api', options.missingNote);
}

function hasAny(values: Set<string> | undefined, candidates: string[]): boolean {
  if (!values) return false;
  return candidates.some((candidate) => values.has(candidate.trim().toLowerCase()));
}

function inferReasoningEffort(
  providerType: string,
  model: string,
  liveModel?: ModelInfo,
  liveCapabilities?: Set<string>,
  liveParameters?: Set<string>,
): ModelSettingCapability {
  const normalizedModel = model.trim().toLowerCase();
  if (hasAny(liveParameters, ['reasoning_effort', 'reasoning.effort'])) {
    return supported('api', 'medium', undefined, ['minimal', 'low', 'medium', 'high']);
  }
  if (hasAny(liveParameters, ['reasoning'])) {
    return supported(
      'api',
      'medium',
      'The live model API advertises a reasoning control for this model.',
      ['minimal', 'low', 'medium', 'high'],
    );
  }
  if (liveParameters) {
    return unsupported(
      'api',
      'The live model API did not advertise a first-class reasoning effort control for this model.',
    );
  }
  if (isOllamaProviderType(providerType)) {
    return inferOllamaThink(liveModel, liveCapabilities);
  }
  if (providerType === 'openai' && /^(?:o\d(?:-|$)|gpt-5(?:[.-]|$)|gpt-4\.1(?:[.-]|$))/.test(normalizedModel)) {
    return supported('model_heuristic', 'medium', undefined, ['minimal', 'low', 'medium', 'high']);
  }
  return unsupported(
    'fallback',
    'The provider model catalog did not advertise a first-class reasoning effort control for this model.',
  );
}

function inferOllamaThink(
  liveModel: ModelInfo | undefined,
  liveCapabilities: Set<string> | undefined,
): ModelSettingCapability {
  const values = ['default', 'off', 'on', 'low', 'medium', 'high'];
  if (!liveModel) {
    return supported(
      'provider_metadata',
      'default',
      'Mapped to Ollama think mode for Ollama-family models when the model supports thinking.',
      values,
    );
  }
  if (!liveCapabilities) {
    return supported(
      'provider_metadata',
      'default',
      'The live model catalog did not include per-model capability metadata, so Guardian keeps the provider-level Ollama thinking control available.',
      values,
    );
  }
  if (
    liveCapabilities.has('thinking')
    || liveCapabilities.has('think')
    || liveCapabilities.has('reasoning')
  ) {
    return supported(
      'api',
      'default',
      'The live model API advertises thinking support for this model.',
      values,
    );
  }
  return unsupported(
    'api',
    'The live model API did not advertise thinking support for this model.',
  );
}

function inferReasoningSummary(
  providerType: string,
  model: string,
  liveModel?: ModelInfo,
  liveCapabilities?: Set<string>,
  liveParameters?: Set<string>,
): ModelSettingCapability {
  if (hasAny(liveParameters, ['reasoning_summary', 'reasoning.summary'])) {
    return supported('api', 'auto', undefined, ['auto', 'concise', 'detailed', 'none']);
  }
  const reasoning = inferReasoningEffort(providerType, model, liveModel, liveCapabilities, liveParameters);
  if (!reasoning.supported || isOllamaProviderType(providerType)) {
    return unsupported(
      reasoning.source,
      'No separate reasoning summary control is exposed for this provider/model path.',
    );
  }
  return supported(reasoning.source, 'auto', undefined, ['auto', 'concise', 'detailed', 'none']);
}

function inferVerbosity(
  providerType: string,
  model: string,
  liveParameters?: Set<string>,
): ModelSettingCapability {
  if (hasAny(liveParameters, ['verbosity'])) {
    return supported('api', 'medium', undefined, ['low', 'medium', 'high']);
  }
  if (liveParameters) {
    return unsupported(
      'api',
      'The live model API did not advertise a first-class verbosity control for this model.',
    );
  }
  if (providerType === 'openai' && /^gpt-5(?:[.-]|$)/i.test(model.trim())) {
    return supported('model_heuristic', 'medium', undefined, ['low', 'medium', 'high']);
  }
  return unsupported(
    'fallback',
    'No first-class verbosity control is registered for this provider/model path.',
  );
}
