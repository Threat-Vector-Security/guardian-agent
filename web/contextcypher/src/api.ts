import axios from 'axios';
import { detectServerPort as detectPort } from './utils/portDetection';
import { guardianOperation, runAI } from './services/guardianApi';
export { getGrcMetadata, previewTier3Import, importTier3Catalogue, previewControlSetImport, importControlSet, importControlSetXlsx, fetchFrameworkCatalog, loadBuiltInFramework } from './services/guardianGrcApi';
export type { FrameworkCatalogEntry } from './services/guardianGrcApi';

export const API_BASE_URL = window.location.origin;
export const getApiBaseUrl = (): string => API_BASE_URL;
export const detectServerPort = async (): Promise<string> => (await detectPort()).url;
export const api = axios.create({ baseURL: API_BASE_URL, timeout: 180000, withCredentials: true, headers: { 'Content-Type': 'application/json' } });
api.interceptors.response.use(response => response, error => {
  if (error.response?.status === 401) window.dispatchEvent(new Event('guardian-session-expired'));
  return Promise.reject(new Error(error.response?.data?.error?.message || error.message || 'Guardian request failed'));
});
export const healthCheck = async (): Promise<boolean> => {
  try { await detectPort(); return true; } catch { return false; }
};
export const testServerConnection = async () => ({ success: await healthCheck(), message: 'Guardian connection check completed' });

const formatted = (result: Awaited<ReturnType<typeof runAI>>) => ({
  success: true, response: result.content, analysis: result.content,
  choices: [{ message: { role: 'assistant', content: result.content } }],
  metadata: { provider: result.provider, model: result.model, jobId: result.jobId, timestamp: new Date().toISOString() },
});
export const generateThreatAnalysis = async (diagramData: string, userPrompt: string, settings: any): Promise<string> =>
  (await runAI('analysis', userPrompt || 'Analyse this system for security threats, attack paths, and prioritized mitigations.', { diagramData })).content;
export const generateAssessment = async (diagramData: string, settings: any): Promise<string> =>
  (await runAI('assessment', 'Assess this architecture, its security controls, residual risks and evidence gaps.', { diagramData })).content;

export const testAIProvider = async (providerType: string, config: any, settings: any) => {
  const state = await guardianOperation('ai.providers.list');
  if (state.configuration?.provider !== (providerType === 'local' ? 'ollama' : providerType) ||
      (config.model && state.configuration?.model !== config.model) || config.apiKey) {
    throw new Error('Save this provider configuration in Guardian settings before testing it.');
  }
  await guardianOperation('ai.test');
  return { success: true, message: 'Provider responded successfully' };
};
export const chat = async (message: string, messageHistory: any[] = [], context: any = {}, provider?: string, providerConfig?: any) =>
  formatted(await runAI('chat', message, { ...context, messageHistory }));
export const analyze = async (diagramData: any, messageHistory: any[] = [], context: any = {}, provider?: string) =>
  formatted(await runAI('analysis', 'Analyse the system for security threats, attack paths, trust boundaries and prioritized mitigations. Distinguish observations from assumptions.', { ...context, diagram: diagramData, messageHistory }));

export const cancelDiagramGeneration = async (requestId: string): Promise<{ success: boolean; message?: string; error?: string }> => {
  try { return await guardianOperation('ai.cancel', { requestId }); }
  catch (error) { return { success: false, error: error instanceof Error ? error.message : 'Cancellation failed' }; }
};
export const generateDiagram = async (
  description: string,
  generationType: 'technical' | 'process' | 'hybrid' | 'dfd' | 'auto' = 'technical',
  context: any = {},
  signal?: AbortSignal,
): Promise<{ success: boolean; content?: string; error?: string; generationType?: string; timestamp?: string }> => {
  const result = await runAI('generate', description, { ...context, generationType }, signal);
  return { success: true, content: result.document ? JSON.stringify(result.document) : result.content, generationType, timestamp: new Date().toISOString() };
};
export const analyzeDiagramContext = async (context: string): Promise<{
  success: boolean; analysis?: { estimatedNodeCount: number; complexity: 'low' | 'medium' | 'high' | 'very-high'; recommendedMode: 'technical' | 'process' | 'hybrid'; reasoning: string; hasLargeGroups: boolean; primarySystemType: 'technical' | 'workflow' | 'mixed' }; error?: string;
}> => {
  const result = await runAI('analysis', 'Recommend a diagram style for the supplied context. Return ONLY JSON with estimatedNodeCount (integer), complexity (low/medium/high/very-high), recommendedMode (technical/process/hybrid), reasoning (string), hasLargeGroups (boolean), primarySystemType (technical/workflow/mixed).', { systemDescription: context });
  const analysis = JSON.parse(result.content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim());
  if (!Number.isInteger(analysis.estimatedNodeCount) || !['low','medium','high','very-high'].includes(analysis.complexity) ||
      !['technical','process','hybrid'].includes(analysis.recommendedMode) || typeof analysis.reasoning !== 'string' ||
      typeof analysis.hasLargeGroups !== 'boolean' || !['technical','workflow','mixed'].includes(analysis.primarySystemType)) {
    throw new Error('The model returned an invalid diagram recommendation. Try again or choose a diagram mode manually.');
  }
  return { success: true, analysis };
};

// Live intelligence must come from a configured connector, never fabricated model citations.
export const getThreatIntelligence = (query: string): Promise<any> => guardianOperation('threat-intelligence.search', { query });
export const getVulnerabilityInfo = (cve: string): Promise<any> => guardianOperation('threat-intelligence.cve', { cve });
export const getSecurityAdvisories = (package_name: string): Promise<any> => guardianOperation('threat-intelligence.advisories', { package: package_name });
export default api;
