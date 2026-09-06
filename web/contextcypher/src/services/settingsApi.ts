import { AIProvider } from '../types/SettingsTypes';
import { loadSettings, saveSettings } from '../settings/settings';
import { guardianOperation } from './guardianApi';

interface ProviderUpdateRequest {
  provider: AIProvider; model?: string; apiKey?: string; testOnly?: boolean;
  baseUrl?: string; organizationId?: string; projectId?: string;
  temperature?: number; maxTokens?: number; reasoningEffort?: string;
  gpuMemoryFraction?: number; numThreads?: number; batchSize?: number; gpuOverhead?: number;
  numParallel?: number; maxLoadedModels?: number; keepAlive?: string; gpuLayers?: number; selectedGPU?: string;
}
interface ProviderUpdateResponse {
  success: boolean; message: string; currentProvider?: AIProvider; error?: string; errorType?: string;
  tokenLimits?: { maxInput?: number; maxOutput?: number };
  configuration?: { provider: string; model: string; hasCredential: boolean; ready: boolean; temperature?: number; maxTokens?: number };
}
let currentUpdateController: AbortController | undefined;
export function cancelProviderUpdate() { currentUpdateController?.abort(); }
export function isProviderUpdateInProgress() { return !!currentUpdateController; }
export async function updateAIProvider(request: ProviderUpdateRequest): Promise<ProviderUpdateResponse> {
  if (currentUpdateController) return { success: false, message: 'A provider operation is already in progress' };
  const controller = new AbortController(); currentUpdateController = controller;
  let configuration: ProviderUpdateResponse['configuration'];
  try {
    const provider = request.provider === 'local' ? 'ollama' : request.provider;
    if (request.testOnly) {
      const state = await guardianOperation('ai.providers.list', {}, controller.signal);
      if (!state.configuration || state.configuration.provider !== provider || (request.model && state.configuration.model !== request.model) || request.apiKey) {
        throw new Error('Save this provider configuration before testing it.');
      }
      await guardianOperation('ai.test', {}, controller.signal);
    } else {
      if (!request.model?.trim()) throw new Error('A model name is required');
      const result = await guardianOperation('ai.configure', { provider, model: request.model.trim(), ...(request.apiKey ? { apiKey: request.apiKey } : {}),
        ...(request.temperature !== undefined ? { temperature: request.temperature } : {}),
        ...(request.maxTokens !== undefined ? { maxTokens: request.maxTokens } : {}) }, controller.signal);
      configuration = result.configuration;
      const settings = loadSettings();
      settings.api.llmMode = provider === 'ollama' ? 'local' : 'public';
      settings.api.provider = request.provider;
      if (provider === 'ollama') settings.api.localLLM.model = request.model;
      else settings.api.providerConfig = { ...settings.api.providerConfig, [provider]: { ...(settings.api.providerConfig as any)[provider], model: request.model } };
      saveSettings(settings);
      window.dispatchEvent(new Event('guardian-ai-configured'));
    }
    return { success: true, currentProvider: request.provider, configuration, message: request.testOnly ? 'The configured model responded successfully.' : 'Model settings saved. The API key stays in Guardian memory only until the backend restarts.' };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Provider operation failed';
    return { success: false, message, error: message };
  } finally { if (currentUpdateController === controller) currentUpdateController = undefined; }
}
export async function validateProviderSettings(request: ProviderUpdateRequest): Promise<boolean> { return (await updateAIProvider({ ...request, testOnly: true })).success; }
export function getCurrentProvider(): AIProvider { return loadSettings().api.provider; }
export function isDevelopment() { return process.env.NODE_ENV === 'development'; }
export function getApiUrl() { return location.origin; }
