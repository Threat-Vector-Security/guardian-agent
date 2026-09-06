import { afterEach, describe, expect, it, vi } from 'vitest';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SecurityStore } from './store.js';
import { SecurityWorkspace } from './service.js';
import { SecurityAi, safeAiProviderError, validateGeneratedDocument } from './ai.js';
import type { ChatResponse, LLMProvider } from '../llm/types.js';

const cleanup: Array<() => Promise<void>> = [];
function setup() {
  const directory = mkdtempSync(join(tmpdir(), 'guardian-ai-test-'));
  const store = new SecurityStore(directory);
  const workspace = new SecurityWorkspace(store, { check: vi.fn(), requestScan: vi.fn() });
  const admin = store.createClient({ name: 'admin', role: 'admin', scopes: ['admin'], expiresAt: Date.now() + 600000 }, 'bootstrap').client;
  cleanup.push(async () => { await workspace.close(); store.close(); if (!directory.startsWith(join(tmpdir(), 'guardian-ai-test-'))) throw new Error('Unsafe test path'); rmSync(directory, { recursive: true, force: true }); });
  return { store, workspace, admin };
}
afterEach(async () => { for (const close of cleanup.splice(0)) await close(); });
const response = (content: string): ChatResponse => ({ content, model: 'test', finishReason: 'stop' });
const provider = (chat = vi.fn(async () => response('Review complete.'))): LLMProvider => ({ name: 'test', chat, stream: async function* () {}, listModels: async () => [] });

describe('standalone AI boundaries', () => {
  it.each([
    [{ status: 401 }, 'credential'], [{ status: 403 }, 'denied access'], [{ status: 404 }, 'selected model or endpoint'],
    [{ status: 429, code: 'insufficient_quota' }, 'quota or billing'], [{ status: 429, code: 'rate_limit_exceeded' }, 'rate limit'],
    [{ status: 400, code: 'unsupported_parameter', param: 'temperature' }, 'parameter temperature'],
    [{ status: 400, error: { code: 'context_length_exceeded' } }, 'context limit'],
    [{ status: 500 }, 'server error'], [{ name: 'APIConnectionTimeoutError' }, 'timed out'],
    [{ cause: { code: 'ECONNREFUSED' } }, 'could not connect'], [{ status: 400, param: 'secret-api-key-in-parameter' }, 'no recognized parameter'],
  ])('classifies structured provider diagnostics without leaking raw content (%j)', (metadata, expected) => {
    const error = Object.assign(new Error('Authorization: private-api-key; submitted context: PRIVATE-CUSTOMER-CONTEXT'), metadata);
    const safe = safeAiProviderError(error);
    expect(safe.status).toBe(502);
    expect(safe.message).toContain(expected);
    expect(safe.message).not.toContain('private-api-key');
    expect(safe.message).not.toContain('PRIVATE-CUSTOMER-CONTEXT');
    expect(safe.message).not.toContain('secret-api-key-in-parameter');
  });
  it('requires configuration, separate administrative audience, and explicit invocation scope', async () => {
    const { store, workspace, admin } = setup();
    const reader = store.createClient({ name: 'reader', role: 'operator', scopes: ['projects:read'], expiresAt: Date.now() + 600000 }, admin.id).client;
    await expect(workspace.execute(admin, 'admin', 'ai.run', { kind: 'analysis', prompt: 'Review' })).rejects.toMatchObject({ status: 409 });
    await expect(workspace.execute(admin, 'assistant', 'ai.configure', { provider: 'ollama', model: 'test' })).rejects.toMatchObject({ status: 403 });
    await expect(workspace.execute(reader, 'assistant', 'ai.run', { kind: 'chat', prompt: 'Review' })).rejects.toMatchObject({ status: 403 });
    await expect(workspace.execute(admin, 'admin', 'ai.configure', { provider: 'ollama', model: 'test', baseUrl: 'https://evil.example' })).rejects.toMatchObject({ status: 400 });
    await expect(workspace.execute(admin, 'admin', 'ai.configure', { provider: 'openai', model: 'test' })).rejects.toMatchObject({ status: 400 });
    await expect(workspace.execute(admin, 'assistant', 'ai.models.discover', { provider: 'ollama' })).rejects.toMatchObject({ status: 403 });
    await expect(workspace.execute(reader, 'assistant', 'ai.models.discover', { provider: 'ollama' })).rejects.toMatchObject({ status: 403 });
    await expect(workspace.execute(admin, 'admin', 'ai.configure', { provider: 'ollama', model: 'test', maxTokens: 1000000 })).rejects.toMatchObject({ status: 400 });
  });

  it('discovers draft models without configuration changes, secret files or cross-provider key reuse', async () => {
    const { store } = setup();
    const listModels = vi.fn(async () => [{ id: 'from-account', name: 'Account model', provider: 'openai', contextWindow: 12345 }]);
    const factory = vi.fn(config => ({ ...provider(), name: config.provider, listModels }));
    const ai = new SecurityAi(store, factory);
    await expect(ai.discover({ provider: 'openai', apiKey: 'draft-only-secret' }, 'admin')).resolves.toMatchObject({ models: [{ id: 'from-account', contextWindow: 12345 }] });
    expect(factory).toHaveBeenCalledWith(expect.objectContaining({ provider: 'openai', model: '', apiKey: 'draft-only-secret', baseUrl: 'https://api.openai.com/v1' }));
    expect(listModels).toHaveBeenCalledWith(expect.objectContaining({ limit: 1000, signal: expect.any(AbortSignal) }));
    expect(store.get('ai-config', 'active')).toBeUndefined();
    expect(existsSync(join(store.directory, 'ai-credentials'))).toBe(false);
    expect(JSON.stringify(store.auditPage())).not.toContain('draft-only-secret');
    await expect(ai.discover({ provider: 'openai' }, 'admin')).rejects.toMatchObject({ status: 400 });
    ai.configure({ provider: 'openai', model: 'chosen', apiKey: 'session-only-secret', temperature: 0.7, maxTokens: 2048 }, 'admin');
    const before = store.get('ai-config', 'active');
    await ai.discover({ provider: 'openai' }, 'admin');
    expect(factory).toHaveBeenLastCalledWith(expect.objectContaining({ apiKey: 'session-only-secret' }));
    await expect(ai.discover({ provider: 'anthropic' }, 'admin')).rejects.toMatchObject({ status: 400 });
    expect(store.get('ai-config', 'active')).toEqual(before);
    expect(JSON.stringify(before)).not.toContain('secret');
    const restarted = new SecurityAi(store, factory);
    await expect(restarted.discover({ provider: 'openai' }, 'admin')).rejects.toMatchObject({ status: 400 });
  });

  it('keeps keys out of configuration, audit and completions and redacts outbound context', async () => {
    const { store } = setup();
    const key = 'test-only-credential-value';
    const chat = vi.fn(async () => response(`Provider accidentally echoed ${key}`));
    const ai = new SecurityAi(store, () => provider(chat));
    expect(JSON.stringify(ai.configure({ provider: 'openai', model: 'test', apiKey: key }, 'admin'))).not.toContain(key);
    expect(JSON.stringify(store.get('ai-config', 'active'))).not.toContain(key);
    const result = await ai.run('admin', 'one', 'chat', `Please inspect ${key}`, { value: key });
    expect(result.content).toBe('Provider accidentally echoed [REDACTED]');
    expect(JSON.stringify(chat.mock.calls)).not.toContain(key);
    expect(JSON.stringify(store.auditPage())).not.toContain(key);
    const reloaded = new SecurityAi(store, () => provider(chat));
    expect(reloaded.list().configuration?.hasCredential).toBe(false);
    expect(reloaded.list().configuration?.ready).toBe(false);
    await expect(reloaded.run('admin', 'two', 'chat', 'Check')).rejects.toMatchObject({ status: 409 });
    expect(existsSync(join(store.directory, 'ai-credentials'))).toBe(false);
  });

  it('validates generated graph and rejects incomplete, unsafe or dangling output', async () => {
    const graph = { nodes: [{ id: 'a', type: 'server', position: { x: 0, y: 0 }, data: { label: 'Server' } }], edges: [] };
    expect(validateGeneratedDocument(JSON.stringify(graph))).toEqual(graph);
    for (const invalid of ['not json', JSON.stringify({ ...graph, edges: [{ id: 'e', source: 'a', target: 'missing' }] }), JSON.stringify({ nodes: [{ id: 'a' }], edges: [] }), '{"nodes":[],"edges":[],"__proto__":{}}']) expect(() => validateGeneratedDocument(invalid)).toThrow();
    const { store } = setup();
    const ai = new SecurityAi(store, () => provider(vi.fn(async () => ({ ...response('{}'), finishReason: 'length' }))));
    ai.configure({ provider: 'ollama', model: 'test' }, 'admin');
    await expect(ai.run('admin', 'one', 'generate', 'Create a diagram')).rejects.toMatchObject({ status: 502 });
  });

  it('cancels only owned requests, bounds concurrency and suppresses provider errors', async () => {
    const { store } = setup();
    const ai = new SecurityAi(store, () => provider(vi.fn(() => new Promise(() => {}))));
    ai.configure({ provider: 'ollama', model: 'test' }, 'admin');
    const one = ai.run('a', 'one', 'chat', 'Inspect');
    const two = ai.run('b', 'two', 'chat', 'Inspect');
    await expect(ai.run('c', 'three', 'chat', 'Inspect')).rejects.toMatchObject({ status: 429 });
    expect(() => ai.cancel('b', 'one')).toThrow('not found');
    ai.cancel('a', 'one'); ai.cancel('b', 'two');
    await expect(one).rejects.toMatchObject({ status: 408 });
    await expect(two).rejects.toMatchObject({ status: 408 });
    const failing = new SecurityAi(store, () => provider(vi.fn(async () => { throw new Error('Authorization: secret'); })));
    await expect(failing.run('a', 'three', 'chat', 'Inspect')).rejects.toThrow('AI provider request failed');
  });

  it('enforces project revision and rechecks authorization before delivering or storing results', async () => {
    const { store, workspace, admin } = setup();
    const { project } = await workspace.execute(admin, 'admin', 'projects.create', { name: 'Test' }) as { project: { id: string; revision: number } };
    const actor = store.createClient({ name: 'ai', role: 'operator', scopes: ['ai:invoke', 'projects:read'], projectIds: [project.id], expiresAt: Date.now() + 600000 }, admin.id).client;
    await expect(workspace.execute(actor, 'assistant', 'ai.run', { kind: 'analysis', prompt: 'Review' })).rejects.toMatchObject({ status: 403 });
    await expect(workspace.execute(actor, 'assistant', 'ai.run', { kind: 'analysis', prompt: 'Review', projectId: project.id, revision: 2 })).rejects.toMatchObject({ status: 409 });
    let complete!: (value: { content: string; provider: string; model: string }) => void;
    vi.spyOn(workspace.ai, 'run').mockImplementation(() => new Promise(resolve => { complete = resolve; }));
    const request = workspace.execute(actor, 'assistant', 'ai.run', { kind: 'analysis', prompt: 'Review', projectId: project.id, revision: 1 });
    await Promise.resolve();
    store.revoke(actor.id, admin.id);
    complete({ content: 'PRIVATE RESULT', provider: 'test', model: 'test' });
    await expect(request).rejects.toMatchObject({ status: 401 });
    expect(JSON.stringify(store.list('job'))).not.toContain('PRIVATE RESULT');
  });
});
