export async function guardianOperation<T = any>(operation: string, input: Record<string, unknown> = {}, signal?: AbortSignal): Promise<T> {
  const response = await fetch('/api/v1/operations', {
    method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ operation, input }), signal,
  });
  const body = await response.json();
  if (!response.ok || body.error) {
    if (response.status === 401) window.dispatchEvent(new Event('guardian-session-expired'));
    throw new Error(body.error?.message || `Guardian request failed (${response.status})`);
  }
  return body.result as T;
}
export interface GuardianAIResult { content: string; model: string; provider: string; document?: Record<string, unknown>; jobId: string }
export interface GuardianAIModel { id: string; name: string; provider: string; contextWindow?: number }
export async function discoverAIModels(provider: string, apiKey?: string, signal?: AbortSignal): Promise<GuardianAIModel[]> {
  const result = await guardianOperation<{ models: GuardianAIModel[] }>('ai.models.discover', { provider, ...(apiKey ? { apiKey } : {}) }, signal);
  if (!Array.isArray(result.models) || result.models.some(model => typeof model.id !== 'string' || !model.id || typeof model.name !== 'string' || model.provider !== provider)) {
    throw new Error('Guardian returned an invalid model list.');
  }
  const unique = new Map(result.models.map(model => [model.id, model]));
  return [...unique.values()].sort((left, right) => left.id.localeCompare(right.id));
}
let activeProject: { projectId: string; revision: number } | null = null;
export function setGuardianProjectContext(project: { projectId: string; revision: number } | null): void {
  activeProject = project ? { ...project } : null;
}
export async function runAI(kind: 'chat' | 'analysis' | 'generate' | 'assessment', prompt: string, context: Record<string, unknown> = {}, signal?: AbortSignal) {
  const project = activeProject ? { ...activeProject } : null;
  if (!project) throw new Error('Open or save a Guardian project before requesting AI analysis or generation.');
  const requestId = crypto.randomUUID();
  const cancel = () => { void guardianOperation('ai.cancel', { requestId }).catch(error => console.error('Guardian could not confirm cancellation:', error)); };
  signal?.throwIfAborted();
  signal?.addEventListener('abort', cancel, { once: true });
  try { return await guardianOperation<GuardianAIResult>('ai.run', { kind, prompt, context, requestId, ...project }, signal); }
  finally { signal?.removeEventListener('abort', cancel); }
}
