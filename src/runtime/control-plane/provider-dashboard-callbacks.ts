import type { DashboardCallbacks, DashboardProviderInfo } from '../../channels/web-types.js';
import type { LLMConfig } from '../../config/types.js';
import { getProviderRegistry } from '../../llm/provider.js';
import { inferModelCapabilities } from '../../llm/model-capabilities.js';
import type { ModelInfo } from '../../llm/types.js';

type ProviderDashboardCallbacks = Pick<
  DashboardCallbacks,
  | 'onProviders'
  | 'onProviderTypes'
  | 'onProvidersStatus'
  | 'onProviderModels'
>;

interface ProviderRegistryLike {
  listProviderTypes(): Array<{
    name: string;
    displayName: string;
    compatible: boolean;
    locality: 'local' | 'external';
    tier: 'local' | 'managed_cloud' | 'frontier';
    requiresCredential: boolean;
    defaultBaseUrl?: string;
  }>;
  hasProvider(name: string): boolean;
  createProvider(config: LLMConfig): {
    listModels(): Promise<ModelInfo[]>;
  };
}

interface ProviderDashboardCallbackOptions {
  getProviderInfoSnapshot: () => DashboardProviderInfo[];
  buildProviderInfo: (withConnectivity: boolean, healthOptions?: { force?: boolean }) => Promise<DashboardProviderInfo[]>;
  resolveCredentialForProviderInput: (credentialRef: string | undefined, apiKey: string | undefined) => string | undefined;
  getDefaultModelForProviderType: (providerType: string) => string;
  getDefaultBaseUrlForProviderType: (providerType: string) => string | undefined;
  providerRegistry?: ProviderRegistryLike;
}

export function createProviderDashboardCallbacks(
  options: ProviderDashboardCallbackOptions,
): ProviderDashboardCallbacks {
  const providerRegistry = options.providerRegistry ?? getProviderRegistry();

  return {
    onProviders: () => options.getProviderInfoSnapshot(),

    onProviderTypes: () => providerRegistry.listProviderTypes(),

    onProvidersStatus: async (input) => options.buildProviderInfo(true, { force: input?.force === true }),

    onProviderModels: async (input) => {
      const providerType = input.providerType.trim().toLowerCase();
      const providerTypeInfo = providerRegistry.listProviderTypes().find((type) => type.name === providerType);
      if (!providerRegistry.hasProvider(providerType)) {
        throw new Error(`Unknown provider type '${providerType}'`);
      }
      if (!providerTypeInfo) {
        throw new Error(`Provider metadata for '${providerType}' is unavailable`);
      }

      const apiKey = options.resolveCredentialForProviderInput(input.credentialRef, input.apiKey);
      const providerConfig: LLMConfig = {
        provider: providerType,
        model: input.model?.trim() || options.getDefaultModelForProviderType(providerType),
        baseUrl: input.baseUrl?.trim() || options.getDefaultBaseUrlForProviderType(providerType),
        apiKey,
      };

      if (providerTypeInfo.requiresCredential && !providerConfig.apiKey) {
        throw new Error('Provide an API key or credential ref to load models for this provider.');
      }

      let models: ModelInfo[] = [];
      let modelDiscoveryError: string | undefined;
      try {
        models = await providerRegistry.createProvider(providerConfig).listModels();
      } catch (err) {
        modelDiscoveryError = err instanceof Error ? err.message : String(err);
      }
      const modelIds = models.map((model) => model.id);
      const activeModel = providerConfig.model;
      const capabilities = inferModelCapabilities({
        providerType,
        model: activeModel,
        liveModels: models,
      });
      return {
        models: modelIds,
        capabilities,
        capabilitiesByModel: Object.fromEntries(
          models.map((model) => [
            model.id,
            inferModelCapabilities({
              providerType,
              model: model.id,
              liveModels: models,
            }),
          ]),
        ),
        ...(modelDiscoveryError ? { modelDiscoveryError } : {}),
      };
    },
  };
}
