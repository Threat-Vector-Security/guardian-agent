import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { request as httpRequest } from 'node:http';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Client as McpClient } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport, getDefaultEnvironment } from '@modelcontextprotocol/sdk/client/stdio.js';
import { SecurityStore, digest, type Principal } from './store.js';
import { SecurityWorkspace, type SecurityJob } from './service.js';
import { startSecurityServer, type SecurityServerOptions } from './server.js';
import type { EntraIdentity } from './entra-oidc.js';
import { SecurityClient } from './client.js';
import type { CollectorReport, ScanRequestResult } from './collectors.js';
import { ASSISTANT_SCOPES, type Operation } from './operations.js';

const observed = (): CollectorReport => ({
  host: { status: 'available', collectedAt: 100, data: { processes: [] }, errors: [], description: 'Injected test observation' },
  native: { status: 'unavailable', collectedAt: 100, data: null, errors: ['No test scanner'], description: 'No live antivirus invocation' },
  network: { status: 'available', collectedAt: 100, data: { connections: [] }, errors: [], description: 'Injected test observation' },
  findings: [{ id: 'test:host', source: 'host', severity: 'medium', title: 'Test observation', description: 'Fixture only', evidence: { fixture: true }, observedAt: 100 }],
  coverage: [{ id: 'test', name: 'Fixture collector', status: 'partial', description: 'Only synthetic test input' }],
});

interface ApiResponse<T = Record<string, unknown>> {
  status: number;
  value: { result?: T; items?: Operation[]; authenticated?: boolean; principal?: Principal; error?: { message: string } };
  headers: Headers;
}
interface ProjectResult { project: { id: string; revision: number; document: Record<string, unknown> } }

describe('security workspace HTTP and MCP boundary', () => {
  let directory: string;
  let store: SecurityStore;
  let workspace: SecurityWorkspace;
  let running: Awaited<ReturnType<typeof startSecurityServer>>;
  let root: { client: Principal; token: string };
  let assistant: { client: Principal; token: string };
  let cookie: string;
  let collectors: { check: ReturnType<typeof vi.fn<() => Promise<CollectorReport>>>; requestScan: ReturnType<typeof vi.fn<(type: 'quick' | 'full') => Promise<ScanRequestResult>>> };

  async function api<T = Record<string, unknown>>(path: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
    const response = await fetch(`${running.origin}${path}`, { ...options, signal: AbortSignal.timeout(5000) });
    return { status: response.status, value: await response.json() as ApiResponse<T>['value'], headers: response.headers };
  }
  async function operation<T = Record<string, unknown>>(name: string, input: Record<string, unknown> = {}, auth: 'admin' | string = assistant.token) {
    return api<T>('/api/v1/operations', {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...(auth === 'admin' ? { Cookie: cookie, Origin: running.origin } : { Authorization: `Bearer ${auth}` }) },
      body: JSON.stringify({ operation: name, input }),
    });
  }
  async function login(token: string): Promise<ApiResponse> {
    return api('/api/v1/session', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: running.origin }, body: JSON.stringify({ token }) });
  }
  function credential(scopes: string[], options: Partial<Principal> = {}) {
    return store.createClient({ name: 'Restricted assistant', role: 'operator', scopes, expiresAt: Date.now() + 60000, ...options }, root.client.id);
  }
  async function enableEntra() {
    const identity: EntraIdentity = { issuer: 'https://login.microsoftonline.com/test-tenant/v2.0', subject: 'test-subject', name: 'Entra user', role: 'admin' };
    const entra = {
      begin: vi.fn(async () => ({ state: 'a'.repeat(43), url: 'https://login.microsoftonline.com/test-tenant/authorize?state=test' })),
      finish: vi.fn(async (_input: { code: string; state: string; cookieState: string }): Promise<EntraIdentity> => identity),
    } satisfies NonNullable<SecurityServerOptions['entra']>;
    running.server.closeIdleConnections();
    await new Promise<void>((done, reject) => running.server.close(error => error ? reject(error) : done()));
    running = await startSecurityServer(workspace, { port: 0, webRoot: join(directory, 'web'), entra });
    cookie = (await login(root.token)).headers.get('set-cookie')!.split(';')[0];
    return { entra, identity };
  }
  function sessionCookie(response: Response): string {
    return response.headers.getSetCookie().find(value => value.startsWith('guardian_session='))!.split(';')[0];
  }
  function callback(state = 'a'.repeat(43), binder = state) {
    return fetch(`${running.origin}/api/v1/auth/entra/callback?code=provider-code&state=${state}`, {
      redirect: 'manual', headers: binder ? { Cookie: `unrelated=ignored; guardian_oidc=${binder}` } : {}, signal: AbortSignal.timeout(5000),
    });
  }

  beforeEach(async () => {
    directory = mkdtempSync(join(tmpdir(), 'guardian-security-api-'));
    const webRoot = join(directory, 'web');
    mkdirSync(webRoot);
    writeFileSync(join(webRoot, 'index.html'), '<!doctype html><title>Test security shell</title>');
    store = new SecurityStore(join(directory, 'data'));
    root = store.createClient({ name: 'Test administrator', role: 'admin', scopes: ['admin'], expiresAt: Date.now() + 60000 }, 'test-bootstrap');
    assistant = credential([...ASSISTANT_SCOPES]);
    collectors = {
      check: vi.fn(async () => observed()),
      requestScan: vi.fn(async (_type: 'quick' | 'full'): Promise<ScanRequestResult> => ({ state: 'requested', message: 'Test scan request accepted; not a clean result.' })),
    };
    workspace = new SecurityWorkspace(store, collectors);
    running = await startSecurityServer(workspace, { port: 0, webRoot });
    const response = await login(root.token);
    expect(response.status).toBe(200);
    cookie = response.headers.get('set-cookie')!.split(';')[0];
  });

  afterEach(async () => {
    await running?.close();
    store?.close();
    if (directory) {
      if (!resolve(directory).startsWith(resolve(tmpdir()) + sep)) throw new Error('Unsafe fixture cleanup path');
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('opens the local browser by default only through a same-origin browser session exchange', async () => {
    const headers = { 'Content-Type': 'application/json', Origin: running.origin, 'Sec-Fetch-Site': 'same-origin', 'Sec-Fetch-Mode': 'cors', 'Sec-Fetch-Dest': 'empty' };
    expect((await api('/api/v1/operations')).status).toBe(401);
    expect((await api('/api/v1/session/local', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })).status).toBe(403);
    for (const bad of [{ Origin: 'https://attacker.example' }, { 'Sec-Fetch-Site': 'same-site' }, { 'Sec-Fetch-Site': 'cross-site' }, { 'Sec-Fetch-Dest': 'document' }, { Authorization: `Bearer ${assistant.token}` }]) {
      expect((await api('/api/v1/session/local', { method: 'POST', headers: { ...headers, ...bad }, body: '{}' })).status, Object.keys(bad)[0]).toBe(403);
    }
    const hostileHost = await new Promise<number>(done => {
      const req = httpRequest(`${running.origin}/api/v1/session/local`, { method: 'POST', headers: { ...headers, Host: 'attacker.example' } }, response => { response.resume(); done(response.statusCode!); });
      req.end('{}');
    });
    expect(hostileHost).toBe(403);
    const opened = await api('/api/v1/session/local', { method: 'POST', headers, body: '{}' });
    expect(opened.status).toBe(200);
    expect(opened.value.principal).toMatchObject({ id: 'local-browser', role: 'admin' });
    const localCookie = opened.headers.get('set-cookie')!.split(';')[0];
    expect(opened.headers.get('set-cookie')).toContain('HttpOnly; SameSite=Strict');
    const result = await api('/api/v1/operations', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: running.origin, Cookie: localCookie }, body: JSON.stringify({ operation: 'browser-auth.get', input: {} }) });
    expect(result.value.result).toMatchObject({ requireSignIn: false, signInRequired: false });
    expect((await operation('browser-auth.update', { requireSignIn: true })).status).toBe(403);
    expect((await api('/api/v1/operations', { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: localCookie }, body: JSON.stringify({ operation: 'browser-auth.update', input: { requireSignIn: true } }) })).status).toBe(403);
  });

  it('persists opt-in browser authentication, invalidates local sessions and preserves CLI recovery', async () => {
    const headers = { 'Content-Type': 'application/json', Origin: running.origin, 'Sec-Fetch-Site': 'same-origin', 'Sec-Fetch-Mode': 'cors', 'Sec-Fetch-Dest': 'empty' };
    const opened = await api('/api/v1/session/local', { method: 'POST', headers, body: '{}' });
    const localCookie = opened.headers.get('set-cookie')!.split(';')[0];
    expect((await operation('browser-auth.update', { requireSignIn: true }, 'admin')).status).toBe(200);
    expect((await api('/api/v1/session', { headers: { Cookie: localCookie } })).value.authenticated).toBe(false);
    expect((await api('/api/v1/session/local', { method: 'POST', headers, body: '{}' })).status).toBe(403);
    const client = new SecurityClient(running.origin, root.token);
    await client.loginAdmin();
    await expect(client.execute('browser-auth.update', { requireSignIn: false })).resolves.toMatchObject({ signInRequired: false });
    expect((await api('/api/v1/session', { headers: { Cookie: localCookie } })).value.authenticated).toBe(false);
    await client.execute('browser-auth.update', { requireSignIn: true });
    await running.close(); store.close();
    store = new SecurityStore(join(directory, 'data'));
    workspace = new SecurityWorkspace(store, collectors);
    running = await startSecurityServer(workspace, { port: 0, webRoot: join(directory, 'web') });
    expect(workspace.browserAuthentication().signInRequired).toBe(true);
    expect((await api('/api/v1/session/local', { method: 'POST', headers: { ...headers, Origin: running.origin }, body: '{}' })).status).toBe(403);
    expect((await login(root.token)).status).toBe(200);
  });

  it('never uses local convenience access to bypass configured Microsoft Entra sign-in', async () => {
    await enableEntra();
    const response = await api('/api/v1/session/local', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: running.origin, 'Sec-Fetch-Site': 'same-origin', 'Sec-Fetch-Mode': 'cors', 'Sec-Fetch-Dest': 'empty' }, body: '{}' });
    expect(response.status).toBe(403);
    const providers = await api('/api/v1/auth/providers');
    expect(providers.value).toMatchObject({ entra: true, localBrowserAccess: false });
  });

  it('uses a real persistent database, exchanges root credentials only for sessions, and secures cookies', async () => {
    expect(store.db.prepare('SELECT count(*) AS n FROM clients').get()).toMatchObject({ n: 2 });
    const health = await fetch(`${running.origin}/health`);
    expect(health.status).toBe(200);
    expect((await api('/api/v1/operations')).status).toBe(401);
    expect((await api('/api/v1/operations', { headers: { Authorization: `Bearer ${root.token}` } })).status).toBe(401);
    expect((await operation('status.get', {}, root.token)).status).toBe(401);
    const response = await login(root.token);
    expect(response.headers.get('set-cookie')).toMatch(/HttpOnly; SameSite=Strict; Path=\//);
    expect(response.value.principal?.role).toBe('admin');
    expect(JSON.stringify(response.value)).not.toContain(root.token);
    const catalog = await api('/api/v1/operations', { headers: { Cookie: cookie } });
    expect(catalog.value.items?.some(item => item.name === 'clients.create')).toBe(true);
    expect((await login('invalid')).status).toBe(401);
  });

  it('requires matching origin for cookie mutations and logout, then invalidates the session', async () => {
    const payload = JSON.stringify({ operation: 'projects.create', input: { name: 'CSRF attempt' } });
    for (const origin of [undefined, 'https://evil.example']) {
      const headers = { Cookie: cookie, 'Content-Type': 'application/json', ...(origin ? { Origin: origin } : {}) };
      expect((await api('/api/v1/operations', { method: 'POST', headers, body: payload })).status).toBe(403);
      expect((await api('/api/v1/session', { method: 'DELETE', headers })).status).toBe(403);
    }
    expect(store.count('project')).toBe(0);
    expect((await operation('projects.create', { name: 'Allowed' }, 'admin')).status).toBe(200);
    expect((await api('/api/v1/session', { method: 'DELETE', headers: { Cookie: cookie, Origin: running.origin } })).status).toBe(200);
    expect((await api('/api/v1/operations', { headers: { Cookie: cookie } })).status).toBe(401);
  });

  it('rejects cross-origin login, DNS-rebinding Host headers and unsupported content types', async () => {
    expect((await api('/api/v1/session', { method: 'POST', headers: { Origin: 'https://evil.example', 'Content-Type': 'application/json' }, body: JSON.stringify({ token: root.token }) })).status).toBe(403);
    const status = await new Promise<number>((done, reject) => {
      const request = httpRequest(`${running.origin}/health`, { headers: { Host: 'attacker.example' } }, response => { response.resume(); done(response.statusCode!); });
      request.on('error', reject); request.end();
    });
    expect(status).toBe(403);
    expect((await api('/api/v1/session', { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify({ token: root.token }) })).status).toBe(415);
  });

  it('reports disabled Entra discovery and denies unconfigured login routes', async () => {
    const providers = await fetch(`${running.origin}/api/v1/auth/providers`);
    expect(await providers.json()).toEqual({ entra: false, localBrowserAccess: true });
    expect((await api('/api/v1/auth/entra/start')).status).toBe(404);
    expect((await api('/api/v1/auth/entra/callback')).status).toBe(404);
  });

  it('sets a short-lived HttpOnly Lax state binder and advertises enabled Entra', async () => {
    const { entra } = await enableEntra();
    expect(await (await fetch(`${running.origin}/api/v1/auth/providers`)).json()).toEqual({ entra: true, localBrowserAccess: false });
    const response = await fetch(`${running.origin}/api/v1/auth/entra/start`, { redirect: 'manual' });
    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe((await entra.begin.mock.results[0].value).url);
    expect(response.headers.get('set-cookie')).toBe(`guardian_oidc=${'a'.repeat(43)}; HttpOnly; SameSite=Lax; Path=/api/v1/auth/entra; Max-Age=300`);
    expect(response.headers.get('set-cookie')).not.toContain('guardian_session=');
  });

  it.each(['missing', 'mismatched', 'provider-error'] as const)('denies an unverified Entra callback (%s) without issuing a session', async failure => {
    const { entra } = await enableEntra();
    entra.finish.mockRejectedValue(new Error('Untrusted provider response with secret-provider-detail'));
    const binder = failure === 'missing' ? '' : failure === 'mismatched' ? 'b'.repeat(43) : 'a'.repeat(43);
    const response = await callback('a'.repeat(43), binder);
    expect(response.status).toBe(401);
    expect(entra.finish).toHaveBeenCalledExactlyOnceWith({ code: 'provider-code', state: 'a'.repeat(43), cookieState: binder });
    expect(response.headers.getSetCookie()).toEqual(['guardian_oidc=; HttpOnly; SameSite=Lax; Path=/api/v1/auth/entra; Max-Age=0']);
    expect(await response.text()).not.toContain('secret-provider-detail');
    expect(store.clients()).toHaveLength(2);
  });

  it.each(['admin', 'operator', 'viewer'] as const)('creates an Entra %s session only from the verified adapter identity without returning a token', async role => {
    const { entra, identity } = await enableEntra();
    entra.finish.mockResolvedValue({ ...identity, role });
    const response = await callback();
    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe('/');
    expect(await response.text()).toBe('');
    const authenticatedCookie = sessionCookie(response);
    expect(response.headers.getSetCookie()).toContain('guardian_oidc=; HttpOnly; SameSite=Lax; Path=/api/v1/auth/entra; Max-Age=0');
    const session = await api('/api/v1/session', { headers: { Cookie: authenticatedCookie } });
    expect(session.value).toMatchObject({ authenticated: true, principal: { role, name: identity.name } });
    expect(session.value.principal?.id).toBe(`entra:${digest(identity.issuer + '\0' + identity.subject)}`);
    expect(JSON.stringify(session.value)).not.toMatch(/guardian_|access_token|id_token|provider-code/);
    const catalog = await api('/api/v1/operations', { headers: { Cookie: authenticatedCookie } });
    expect(catalog.value.items?.some(operation => operation.admin)).toBe(role === 'admin');
    if (role === 'viewer') expect(catalog.value.items?.every(operation => operation.readOnly)).toBe(true);
    if (role === 'operator') expect(session.value.principal?.scopes).not.toContain('findings:ingest');
  });

  it('removes earlier Entra session privileges when the same identity signs in with a lower role', async () => {
    const { entra, identity } = await enableEntra();
    const privileged = sessionCookie(await callback());
    expect((await api('/api/v1/operations', { headers: { Cookie: privileged } })).value.items?.some(item => item.admin)).toBe(true);
    entra.finish.mockResolvedValue({ ...identity, role: 'viewer' });
    const downgraded = sessionCookie(await callback());
    for (const oldOrNew of [privileged, downgraded]) {
      const session = await api('/api/v1/session', { headers: { Cookie: oldOrNew } });
      expect(session.value.principal?.role).toBe('viewer');
      expect((await api('/api/v1/operations', { headers: { Cookie: oldOrNew } })).value.items?.every(item => !item.admin && item.readOnly)).toBe(true);
      const response = await api('/api/v1/operations', { method: 'POST', headers: { Cookie: oldOrNew, Origin: running.origin, 'Content-Type': 'application/json' }, body: JSON.stringify({ operation: 'clients.list', input: {} }) });
      expect(response.status).toBe(403);
    }
    expect(store.clients().filter(client => client.id.startsWith('entra:'))).toHaveLength(1);
  });

  it('does not let anonymous rate-limit exhaustion lock existing authenticated administrator or assistant sessions', async () => {
    // Root login in beforeEach consumes one anonymous attempt; no sleeps or fake clocks are required.
    let lastStatus = 0;
    for (let index = 0; index < 241; index++) lastStatus = (await api('/api/v1/operations')).status;
    expect(lastStatus).toBe(429);
    expect((await api('/api/v1/operations', { headers: { Cookie: cookie } })).status).toBe(200);
    expect((await operation('clients.list', {}, 'admin')).status).toBe(200);
    expect((await operation('status.get')).status).toBe(200);
    expect((await login(root.token)).status).toBe(200);
  });

  it('reuses one session per principal so an assistant cannot consume administrator capacity', async () => {
    const cookies = new Set<string>();
    for (let index = 0; index < 100; index++) {
      const response = await login(assistant.token);
      expect(response.status).toBe(200);
      cookies.add(response.headers.get('set-cookie')!.split(';')[0]);
    }
    expect(cookies.size).toBe(1);
    expect((await login(root.token)).status).toBe(200);
    expect((await operation('clients.list', {}, 'admin')).status).toBe(200);
  });

  it('rejects oversized operation names before dispatch or denial-audit persistence', async () => {
    const before = store.auditList(1000).length;
    const response = await operation('x'.repeat(129), {});
    expect(response.status).toBe(400);
    expect(response.value.error?.message).toBe('Operation name exceeds 128 bytes');
    expect(store.auditList(1000)).toHaveLength(before);
  });

  it('does not issue or retain a browser session when its audit record cannot be persisted', async () => {
    const original = store.audit.bind(store);
    const audit = vi.spyOn(store, 'audit').mockImplementation((actor, operationName, target, details) => {
      if (operationName === 'session.created') throw new Error('Simulated audit storage failure');
      original(actor, operationName, target, details);
    });
    const response = await login(assistant.token);
    expect(response.status).toBe(500);
    expect(response.headers.getSetCookie().some(value => value.startsWith('guardian_session='))).toBe(false);
    audit.mockRestore();
    expect((await api('/api/v1/operations', { headers: { Authorization: `Bearer ${assistant.token}` } })).status).toBe(200);
  });

  it('keeps administrative operations out of assistant bearer and assistant cookie sessions', async () => {
    const catalog = await api('/api/v1/operations', { headers: { Authorization: `Bearer ${assistant.token}` } });
    expect(catalog.status).toBe(200);
    expect(catalog.value.items?.length).toBeGreaterThan(0);
    expect(catalog.value.items?.every(item => !item.admin)).toBe(true);
    for (const [name, input] of [
      ['clients.create', { name: 'Forged root', scopes: ['admin'] }], ['clients.list', {}], ['audit.list', {}], ['jobs.approve', { id: 'unknown', reason: 'Self-approval' }],
    ] as const) expect((await operation(name, input)).status).toBe(403);
    const response = await login(assistant.token);
    const assistantCookie = response.headers.get('set-cookie')!.split(';')[0];
    const loggedCatalog = await api('/api/v1/operations', { headers: { Cookie: assistantCookie } });
    expect(loggedCatalog.value.items?.every(item => !item.admin)).toBe(true);
    expect((await api('/api/v1/operations', { method: 'POST', headers: { Cookie: assistantCookie, Origin: running.origin, 'Content-Type': 'application/json' }, body: JSON.stringify({ operation: 'clients.list', input: {} }) })).status).toBe(403);
  });

  it('enforces scopes and revokes both bearer and already-issued cookie sessions immediately', async () => {
    const reader = credential(['projects:read']);
    const session = await login(reader.token);
    const readerCookie = session.headers.get('set-cookie')!.split(';')[0];
    expect((await operation('projects.list', {}, reader.token)).status).toBe(200);
    expect((await operation('status.get', {}, reader.token)).status).toBe(403);
    expect((await operation('projects.create', { name: 'Denied' }, reader.token)).status).toBe(403);
    expect((await operation('clients.revoke', { id: reader.client.id }, 'admin')).status).toBe(200);
    expect((await operation('projects.list', {}, reader.token)).status).toBe(401);
    expect((await api('/api/v1/operations', { headers: { Cookie: readerCookie } })).status).toBe(401);
    expect((await login(reader.token)).status).toBe(401);
    expect((await operation('clients.revoke', { id: root.client.id }, 'admin')).status).toBe(403);
  });

  it.each([
    ['projects.create', {}], ['projects.create', { name: 'X', principalRole: 'admin' }],
    ['native.scan.propose', { scanType: 'custom', path: 'C:\\' }], ['status.get', { arbitrary: true }],
    ['projects.update', { id: 'id', revision: 0, document: {} }],
    ['findings.ingest', { items: [{ externalId: 'id', title: 'X', severity: 'critical', observedAt: 1, source: 'Microsoft' }] }],
  ])('rejects invalid or additional input fields for %s before side effects', async (name, input) => {
    expect((await operation(name, input)).status).toBe(400);
    expect(store.count('project')).toBe(0);
    expect(collectors.check).not.toHaveBeenCalled();
    expect(collectors.requestScan).not.toHaveBeenCalled();
  });

  it('rejects malformed JSON, array input and extra request envelope authority', async () => {
    for (const body of ['{', '[]', JSON.stringify({ operation: 'status.get', input: [], principalId: root.client.id }), JSON.stringify({ operation: 'status.get', input: {}, principalRole: 'admin' })]) {
      expect((await api('/api/v1/operations', { method: 'POST', headers: { Authorization: `Bearer ${assistant.token}`, 'Content-Type': 'application/json' }, body })).status).toBe(400);
    }
  });

  it('round trips the exact original ContextCypher import while rejecting conflicting edits', async () => {
    const document = { systemName: 'Workstation', nodes: [{ id: 'endpoint', type: 'server', position: { x: 1, y: 2 }, data: { label: 'Endpoint', unknownPlugin: { retained: true } } }], edges: [], grcWorkspace: { risks: [{ id: 'risk-1', futureField: [1, 'retained'] }] }, drawings: [{ id: 'annotation', text: 'untrusted notes' }], futureDomain: { nested: true } };
    const original = '\ufeff' + JSON.stringify(document, null, 3) + '\r\n';
    const imported = await operation<ProjectResult>('projects.import', { name: 'Imported system', content: original });
    expect(imported.status).toBe(200);
    expect(imported.value.result!.project.document).toEqual(document);
    const id = imported.value.result!.project.id;
    const updated = { ...document, systemName: 'Renamed workstation' };
    expect((await operation('projects.update', { id, revision: 1, document: updated })).status).toBe(200);
    expect((await operation('projects.update', { id, revision: 1, document: { ...updated, systemName: 'Lost update' } })).status).toBe(409);
    const exported = await operation<{ original: string; originalSha256: string; document: unknown }>('projects.export', { id });
    expect(exported.value.result).toMatchObject({ original, originalSha256: digest(original), document: updated });
    expect((await operation<ProjectResult>('projects.get', { id })).value.result!.project.revision).toBe(2);
  });

  it('constrains project credentials to their granted projects and prevents creating broader scope', async () => {
    const first = (await operation<ProjectResult>('projects.create', { name: 'Allowed' })).value.result!.project.id;
    const second = (await operation<ProjectResult>('projects.create', { name: 'Private' })).value.result!.project.id;
    const scoped = credential([...ASSISTANT_SCOPES], { projectIds: [first] });
    expect((await operation<{ items: Array<{ id: string }> }>('projects.list', {}, scoped.token)).value.result!.items.map(p => p.id)).toEqual([first]);
    expect((await operation('projects.get', { id: first }, scoped.token)).status).toBe(200);
    expect((await operation('projects.export', { id: second }, scoped.token)).status).toBe(403);
    expect((await operation('projects.create', { name: 'Escalation' }, scoped.token)).status).toBe(403);
    expect((await operation('status.get', {}, scoped.token)).status).toBe(403);
    expect((await operation('host.check.start', {}, scoped.token)).status).toBe(403);
    expect((await operation('native.scan.propose', { scanType: 'quick' }, scoped.token)).status).toBe(403);
  });

  it('persists collector observations and coverage through a real asynchronous HTTP job', async () => {
    const started = await operation<SecurityJob>('host.check.start');
    expect(started.status).toBe(200);
    await workspace.idle();
    expect(collectors.check).toHaveBeenCalledTimes(1);
    expect(store.get<SecurityJob>('job', started.value.result!.id)?.state).toBe('succeeded');
    const status = await operation<{ coverage: unknown; native: unknown }>('status.get');
    expect(status.value.result).toMatchObject({ coverage: observed().coverage, native: observed().native });
    expect((await operation<{ items: Array<{ id: string }> }>('findings.list')).value.result!.items[0].id).toBe('test:host');
  });

  it('requires separate approval, executes one scan, and prevents replay or another assistant reading the job', async () => {
    const proposed = await operation<SecurityJob>('native.scan.propose', { scanType: 'quick' });
    const id = proposed.value.result!.id;
    expect(proposed.value.result!.state).toBe('awaiting_approval');
    expect(collectors.requestScan).not.toHaveBeenCalled();
    expect((await operation('jobs.approve', { id, reason: 'Model approved itself' })).status).toBe(403);
    const stranger = credential(['security:read']);
    expect((await operation<{ items: unknown[] }>('jobs.list', {}, stranger.token)).value.result!.items).toEqual([]);
    expect((await operation('jobs.approve', { id, reason: 'Administrator reviewed quick scan' }, 'admin')).status).toBe(200);
    await workspace.idle();
    expect(collectors.requestScan).toHaveBeenCalledExactlyOnceWith('quick');
    expect(store.get<SecurityJob>('job', id)?.state).toBe('requested');
    expect((await operation('jobs.approve', { id, reason: 'Replay' }, 'admin')).status).toBe(409);
    expect(collectors.requestScan).toHaveBeenCalledTimes(1);
  });

  it.each(['revoked', 'expired-credential', 'expired', 'wrong-target'] as const)('rejects pending scan approval when the request is %s', async kind => {
    const proposed = await operation<SecurityJob>('native.scan.propose', { scanType: 'full' });
    const job = proposed.value.result!;
    if (kind === 'revoked') await operation('clients.revoke', { id: assistant.client.id }, 'admin');
    else if (kind === 'expired-credential') store.db.prepare('UPDATE clients SET body=? WHERE id=?').run(JSON.stringify({ ...assistant.client, expiresAt: Date.now() - 1 }), assistant.client.id);
    else store.put('job', job.id, { ...job, ...(kind === 'expired' ? { expiresAt: Date.now() - 1 } : { target: 'other-device' }) });
    expect((await operation('jobs.approve', { id: job.id, reason: 'Review stale request' }, 'admin')).status).toBe(409);
    expect(collectors.requestScan).not.toHaveBeenCalled();
  });

  it('preserves unknown native scan outcomes without reporting clean, succeeded, or retrying', async () => {
    collectors.requestScan.mockResolvedValue({ state: 'unknown', message: 'Provider timed out after submission; verify native history.' });
    const id = (await operation<SecurityJob>('native.scan.propose', { scanType: 'quick' })).value.result!.id;
    await operation('jobs.approve', { id, reason: 'Review request' }, 'admin');
    await workspace.idle();
    expect(store.get<SecurityJob>('job', id)).toMatchObject({ state: 'unknown', status: 'unknown', result: { state: 'unknown' } });
    expect((await operation('jobs.approve', { id, reason: 'Retry uncertain submission' }, 'admin')).status).toBe(409);
    expect(collectors.requestScan).toHaveBeenCalledTimes(1);
  });

  it('makes the ordinary CLI client obey the same root/session and revocation boundary', async () => {
    const admin = new SecurityClient(running.origin, root.token);
    await expect(admin.operations()).rejects.toMatchObject({ status: 401 });
    await admin.loginAdmin();
    expect((await admin.operations()).some(op => op.admin)).toBe(true);
    const client = new SecurityClient(running.origin, assistant.token);
    expect((await client.operations()).every(op => !op.admin)).toBe(true);
    await expect(client.execute('clients.list')).rejects.toMatchObject({ status: 403 });
    await admin.execute('clients.revoke', { id: assistant.client.id });
    await expect(client.execute('status.get')).rejects.toMatchObject({ status: 401 });
    expect(() => new SecurityClient('https://example.com', assistant.token)).toThrow('127.0.0.1');
  });

  it('serves real MCP SDK discovery, calls and resources over stdio without administrator authority', async () => {
    const transport = new StdioClientTransport({
      command: process.execPath, args: ['--import', 'tsx', fileURLToPath(new URL('../security-main.ts', import.meta.url)), 'mcp'],
      env: { ...getDefaultEnvironment(), GUARDIAN_URL: running.origin, GUARDIAN_TOKEN: assistant.token }, stderr: 'pipe',
    });
    const client = new McpClient({ name: 'guardian-boundary-test', version: '1.0.0' });
    let stderr = '';
    transport.stderr?.on('data', chunk => { stderr += String(chunk); });
    try {
      await client.connect(transport);
      const listed = await client.listTools();
      expect(listed.tools.some(tool => tool.name === 'guardian_status_get')).toBe(true);
      expect(listed.tools.some(tool => /clients_|jobs_approve|jobs_reject|audit_/.test(tool.name))).toBe(false);
      expect((await client.callTool({ name: 'guardian_status_get', arguments: {} })).isError).not.toBe(true);
      expect((await client.callTool({ name: 'guardian_clients_create', arguments: { name: 'No', scopes: ['admin'] } })).isError).toBe(true);
      expect((await client.callTool({ name: 'guardian_status_get', arguments: { principalRole: 'admin' } })).isError).toBe(true);
      expect((await client.listResources()).resources.map(resource => resource.uri)).toContain('guardian://status');
      expect((await client.readResource({ uri: 'guardian://status' })).contents[0].mimeType).toBe('application/json');
      await operation('clients.revoke', { id: assistant.client.id }, 'admin');
      expect((await client.callTool({ name: 'guardian_status_get', arguments: {} })).isError).toBe(true);
      await expect(client.listTools()).rejects.toThrow();
      expect(collectors.requestScan).not.toHaveBeenCalled();
    } catch (error) {
      throw new Error(`${error instanceof Error ? error.message : String(error)}\nMCP process diagnostics: ${stderr}`);
    } finally {
      await client.close();
      await transport.close();
    }
  }, 20000);

  it('fails closed when a root administrator token is accidentally configured for MCP', async () => {
    const transport = new StdioClientTransport({
      command: process.execPath, args: ['--import', 'tsx', fileURLToPath(new URL('../security-main.ts', import.meta.url)), 'mcp'],
      env: { ...getDefaultEnvironment(), GUARDIAN_URL: running.origin, GUARDIAN_TOKEN: root.token }, stderr: 'pipe',
    });
    const client = new McpClient({ name: 'guardian-root-credential-test', version: '1.0.0' });
    try {
      await client.connect(transport);
      await expect(client.listTools()).rejects.toThrow();
      await expect(client.listResources()).rejects.toThrow();
      expect((await client.callTool({ name: 'guardian_clients_create', arguments: { name: 'Escalation', scopes: ['admin'] } })).isError).toBe(true);
      expect(store.clients()).toHaveLength(2);
    } finally {
      await client.close();
      await transport.close();
    }
  }, 20000);
});
