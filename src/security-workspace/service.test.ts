import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { request } from 'node:http';
import { SecurityStore } from './store.js';
import { SecurityWorkspace } from './service.js';
import { startSecurityServer } from './server.js';
import type { AwsSecurityIntegration, AwsSecurityReport } from './aws-security.js';

const active: Array<{ store: SecurityStore; workspace: SecurityWorkspace; dir: string; closeServer?: () => Promise<void> }> = [];
function setup(aws?: Pick<AwsSecurityIntegration, 'target' | 'check' | 'close'>, config: { entraEnabled?: boolean } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'guardian-context-review-'));
  const store = new SecurityStore(dir);
  const workspace = new SecurityWorkspace(store, { check: vi.fn(), requestScan: vi.fn() }, aws, config);
  const entry = { dir, store, workspace, closeServer: undefined as (() => Promise<void>) | undefined };
  active.push(entry);
  const admin = store.createClient({ name: 'admin', role: 'admin', scopes: ['admin'], expiresAt: Date.now() + 600000 }, 'bootstrap').client;
  return { ...entry, entry, admin };
}
afterEach(async () => {
  for (const item of active.splice(0)) {
    if (item.closeServer) await item.closeServer();
    else await item.workspace.close();
    item.store.close();
    if (!item.dir.startsWith(join(tmpdir(), 'guardian-context-review-'))) throw new Error('Unexpected test path');
    rmSync(item.dir, { recursive: true, force: true });
  }
});

describe('AWS workspace integration boundaries', () => {
  const target = 'aws:123456789012:ap-southeast-2';
  const report = (status: AwsSecurityReport['status'] = 'available'): AwsSecurityReport => ({ accountId: '123456789012', region: 'ap-southeast-2', status, collectedAt: Date.now(), findings: [], coverage: [], errors: [] });
  const awsClient = (check = vi.fn(async () => report())) => ({ target, check, close: vi.fn() });

  it('reports disabled AWS and refuses collection without enrollment', async () => {
    const { workspace, admin, store } = setup();
    await expect(workspace.execute(admin, 'admin', 'aws.status.get', {})).resolves.toEqual({ configured: false, target: undefined, checking: false, report: null });
    await expect(workspace.execute(admin, 'admin', 'aws.check.start', {})).rejects.toMatchObject({ status: 409 });
    expect(store.count('job')).toBe(0);
  });

  it('requires collection scope and refuses project-scoped AWS reads and collection', async () => {
    const aws = awsClient();
    const { workspace, admin, store } = setup(aws);
    const reader = store.createClient({ name: 'reader', role: 'operator', scopes: ['cloud:read'], expiresAt: Date.now() + 600000 }, admin.id).client;
    const project = store.createClient({ name: 'project', role: 'operator', scopes: ['cloud:read', 'cloud:collect'], projectIds: ['limited'], expiresAt: Date.now() + 600000 }, admin.id).client;
    await expect(workspace.execute(reader, 'assistant', 'aws.status.get', {})).resolves.toMatchObject({ target });
    await expect(workspace.execute(reader, 'assistant', 'aws.check.start', {})).rejects.toMatchObject({ status: 403 });
    for (const operation of ['aws.status.get', 'aws.check.start']) await expect(workspace.execute(project, 'assistant', operation, {})).rejects.toMatchObject({ status: 403 });
    expect(aws.check).not.toHaveBeenCalled();
  });

  it('refuses caller-selected AWS target overrides before collecting', async () => {
    const aws = awsClient();
    const { workspace, admin } = setup(aws);
    await expect(workspace.execute(admin, 'admin', 'aws.check.start', { accountId: '999999999999', region: 'us-east-1' })).rejects.toMatchObject({ status: 400 });
    expect(aws.check).not.toHaveBeenCalled();
  });

  it.each(['available', 'degraded', 'unavailable'] as const)('persists target-keyed status and honest %s job result', async status => {
    const value = report(status);
    const aws = awsClient(vi.fn(async () => value));
    const { workspace, admin, store } = setup(aws);
    const job = await workspace.execute(admin, 'admin', 'aws.check.start', {}) as { id: string; target: string };
    expect(job.target).toBe(target);
    await workspace.idle();
    expect(store.get('aws-status', target)).toEqual(value);
    expect(store.get('aws-status', workspace.device.id)).toBeUndefined();
    expect(store.get('job', job.id)).toMatchObject({ operation: 'aws.check', target, state: status === 'unavailable' ? 'failed' : 'succeeded', result: { status } });
    await expect(workspace.execute(admin, 'admin', 'aws.status.get', {})).resolves.toMatchObject({ target, checking: false, report: value });
  });

  it('rejects conflicting AWS starts and keeps other operators from job history', async () => {
    let resolve!: (value: AwsSecurityReport) => void;
    const aws = awsClient(vi.fn(() => new Promise<AwsSecurityReport>(done => { resolve = done; })));
    const { workspace, admin, store } = setup(aws);
    const actor = (name: string) => store.createClient({ name, role: 'operator', scopes: ['security:read', 'cloud:read', 'cloud:collect'], expiresAt: Date.now() + 600000 }, admin.id).client;
    const one = actor('one'); const two = actor('two');
    const job = await workspace.execute(one, 'assistant', 'aws.check.start', {}) as { id: string };
    try {
      await expect(workspace.execute(one, 'assistant', 'aws.check.start', {})).rejects.toMatchObject({ status: 409 });
      await expect(workspace.execute(two, 'assistant', 'aws.check.start', {})).rejects.toMatchObject({ status: 409 });
      await expect(workspace.execute(two, 'assistant', 'jobs.list', {})).resolves.toEqual({ items: [] });
      await expect(workspace.execute(one, 'assistant', 'jobs.list', {})).resolves.toMatchObject({ items: [{ id: job.id }] });
      expect(aws.check).toHaveBeenCalledOnce();
    } finally { resolve(report()); await workspace.idle(); }
  });

  it('coalesces host checks for the owning actor while AWS has its own job', async () => {
    let resolve!: (value: any) => void;
    const { workspace, admin } = setup(awsClient());
    vi.mocked(workspace.collectors.check).mockImplementation(() => new Promise(done => { resolve = done; }));
    const first = await workspace.execute(admin, 'admin', 'host.check.start', {}) as { id: string };
    try {
      await expect(workspace.execute(admin, 'admin', 'host.check.start', {})).resolves.toMatchObject({ id: first.id });
      const cloud = await workspace.execute(admin, 'admin', 'aws.check.start', {}) as { id: string; target: string };
      expect(cloud.id).not.toBe(first.id);
      expect(cloud.target).toBe(target);
      expect(workspace.collectors.check).toHaveBeenCalledOnce();
    } finally { resolve({ findings: [], coverage: [] }); await workspace.idle(); }
  });

  it('does not carry another enrolled AWS target status into the active target', async () => {
    const { workspace, store, admin } = setup(awsClient());
    store.put('aws-status', 'aws:999999999999:us-east-1', { privateData: 'other-account' });
    await expect(workspace.execute(admin, 'admin', 'aws.status.get', {})).resolves.toMatchObject({ target, report: null });
  });

  it('rejects old native approval after the persisted device identity changes', async () => {
    const { workspace, store, admin, entry } = setup();
    const job = await workspace.execute(admin, 'admin', 'native.scan.propose', { scanType: 'quick' }) as { id: string };
    store.put('meta', 'device', { id: workspace.device.id, name: 'different-machine', platform: process.platform });
    await workspace.close(); store.close();
    const replacementStore = new SecurityStore(entry.dir);
    const scan = vi.fn();
    const replacement = new SecurityWorkspace(replacementStore, { check: vi.fn(), requestScan: scan });
    entry.store = replacementStore; entry.workspace = replacement;
    expect(replacement.device.id).not.toBe(workspace.device.id);
    await expect(replacement.execute(admin, 'admin', 'jobs.approve', { id: job.id, reason: 'Approve old proposal' })).rejects.toMatchObject({ status: 409 });
    expect(scan).not.toHaveBeenCalled();
  });

  it.each([false, true])('reports actual Entra configuration %s', async entraEnabled => {
    const { workspace, admin } = setup(undefined, { entraEnabled });
    const result = await workspace.execute(admin, 'admin', 'integrations.list', {}) as { items: Array<{ id: string; status: string }> };
    expect(result.items.find(item => item.id === 'entra')?.status).toBe(entraEnabled ? 'configured' : 'not_configured');
  });

  it('cancels AWS before awaiting idle at shutdown and persists the failed job', async () => {
    let reject!: (error: Error) => void;
    const aws = awsClient(vi.fn(() => new Promise<AwsSecurityReport>((_resolve, fail) => { reject = fail; })));
    aws.close.mockImplementation(() => reject(new Error('AWS collection interrupted')));
    const { workspace, admin, store } = setup(aws);
    const job = await workspace.execute(admin, 'admin', 'aws.check.start', {}) as { id: string };
    await workspace.close();
    expect(aws.close).toHaveBeenCalledOnce();
    expect(store.get('job', job.id)).toMatchObject({ state: 'failed', error: 'AWS collection interrupted' });
  });
});

describe('independent workspace adversarial regressions', () => {
  it('rejects oversized or over-deep connector evidence before any finding is written', async () => {
    const { workspace, store, admin } = setup();
    const actor = store.createClient({ name: 'connector', role: 'operator', scopes: ['findings:ingest'], expiresAt: Date.now() + 600000 }, admin.id).client;
    let nested: Record<string, unknown> = { end: true };
    for (let index = 0; index < 18; index++) nested = { nested };
    const item = { externalId: 'deep', title: 'Untrusted', severity: 'low', observedAt: Date.now(), evidence: nested };
    await expect(workspace.execute(actor, 'assistant', 'findings.ingest', { items: [item] })).rejects.toMatchObject({ status: 400 });
    await expect(workspace.execute(actor, 'assistant', 'findings.ingest', { items: [{ ...item, externalId: 'large', evidence: { value: 'x'.repeat(70 * 1024) } }] })).rejects.toMatchObject({ status: 400 });
    expect(store.count('finding')).toBe(0);
  });

  it('pages complete finding history after project filtering and hides cross-project existence', async () => {
    const { workspace, store, admin } = setup();
    const allowed = (await workspace.execute(admin, 'admin', 'projects.create', { name: 'Allowed' }) as { project: { id: string } }).project.id;
    const other = (await workspace.execute(admin, 'admin', 'projects.create', { name: 'Other' }) as { project: { id: string } }).project.id;
    for (let index = 0; index < 101; index++) store.put('finding', `other-${index}`, { id: `other-${index}`, projectId: other, status: 'open' });
    store.put('finding', 'allowed-oldest', { id: 'allowed-oldest', projectId: allowed, status: 'open' });
    const reader = store.createClient({ name: 'restricted', role: 'operator', scopes: ['security:read', 'findings:write'], projectIds: [allowed], expiresAt: Date.now() + 600000 }, admin.id).client;
    await expect(workspace.execute(reader, 'assistant', 'findings.list', { limit: 1 })).resolves.toMatchObject({ items: [{ id: 'allowed-oldest' }], total: 1, hasMore: false });
    const missing = workspace.execute(reader, 'assistant', 'findings.update', { id: 'missing', status: 'acknowledged', reason: 'Reviewed' });
    const hidden = workspace.execute(reader, 'assistant', 'findings.update', { id: 'other-0', status: 'acknowledged', reason: 'Reviewed' });
    await expect(missing).rejects.toMatchObject({ status: 404, message: 'finding not found' });
    await expect(hidden).rejects.toMatchObject({ status: 404, message: 'finding not found' });
  });

  it('requires project read authority before resolving a finding link and persists expired approvals', async () => {
    const { workspace, store, admin } = setup();
    const project = (await workspace.execute(admin, 'admin', 'projects.create', { name: 'Architecture' }) as { project: { id: string } }).project.id;
    await workspace.execute(admin, 'admin', 'findings.ingest', { items: [{ externalId: 'event', title: 'Event', severity: 'low', observedAt: Date.now() }] });
    const finding = store.list<{ id: string }>('finding')[0];
    const writer = store.createClient({ name: 'finding writer', role: 'operator', scopes: ['findings:write'], expiresAt: Date.now() + 600000 }, admin.id).client;
    for (const candidate of [project, 'missing-project']) {
      await expect(workspace.execute(writer, 'assistant', 'findings.update', { id: finding.id, status: 'acknowledged', reason: 'Reviewed', projectId: candidate })).rejects.toMatchObject({ status: 403, message: 'Linking a finding requires projects:read' });
    }
    await expect(workspace.execute(writer, 'assistant', 'findings.update', { id: finding.id, status: 'acknowledged', reason: 'Reviewed without link' })).resolves.toHaveProperty('finding');
    const linker = store.createClient({ name: 'linker', role: 'operator', scopes: ['findings:write', 'projects:read'], expiresAt: Date.now() + 600000 }, admin.id).client;
    await expect(workspace.execute(linker, 'assistant', 'findings.update', { id: finding.id, status: 'acknowledged', reason: 'Linked', projectId: project })).resolves.toMatchObject({ finding: { projectId: project } });
    const job = await workspace.execute(admin, 'admin', 'native.scan.propose', { scanType: 'quick' }) as SecurityJob;
    store.put('job', job.id, { ...job, expiresAt: Date.now() - 1 });
    await workspace.execute(admin, 'admin', 'jobs.list', {});
    expect(store.get<SecurityJob>('job', job.id)).toMatchObject({ state: 'expired', status: 'expired' });
    expect(store.auditList()).toEqual(expect.arrayContaining([expect.objectContaining({ operation: 'jobs.expired', target: job.id })]));
  });
  it('rechecks revocation after an authenticated HTTP request streams its body', async () => {
    const { entry, store, workspace, admin } = setup();
    const actor = store.createClient({ name: 'worker', role: 'operator', scopes: ['projects:write'], expiresAt: Date.now() + 600000 }, admin.id);
    const server = await startSecurityServer(workspace, { port: 0, webRoot: process.cwd() });
    entry.closeServer = server.close;
    let authenticationSeen!: () => void;
    const authenticated = new Promise<void>(resolve => { authenticationSeen = resolve; });
    const original = store.authenticate.bind(store);
    vi.spyOn(store, 'authenticate').mockImplementation(token => { const result = original(token); authenticationSeen(); return result; });
    const payload = JSON.stringify({ operation: 'projects.create', input: { name: 'Must not exist after revocation' } });
    let clientRequest!: ReturnType<typeof request>;
    const response = new Promise<{ status: number; body: string }>((resolve, reject) => {
      clientRequest = request(server.origin + '/api/v1/operations', { method: 'POST', headers: { Authorization: 'Bearer ' + actor.token, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } }, res => {
        let body = ''; res.on('data', chunk => { body += chunk; }); res.on('end', () => resolve({ status: res.statusCode!, body }));
      });
      clientRequest.on('error', reject);
      clientRequest.write(payload.slice(0, 1));
    });
    await authenticated;
    store.revoke(actor.client.id, admin.id);
    clientRequest.end(payload.slice(1));
    const result = await response;
    expect(result.status).toBe(401);
    expect(store.count('project')).toBe(0);
  });

  it('does not disclose installation network data to a project-scoped reader', async () => {
    const { store, workspace, admin } = setup();
    const actor = store.createClient({ name: 'project reader', role: 'operator', scopes: ['security:read'], projectIds: ['project-one'], expiresAt: Date.now() + 600000 }, admin.id).client;
    store.put('meta', 'status', { network: { data: { connections: [{ RemoteAddress: 'private-other-project' }] } } });
    await expect(workspace.execute(actor, 'assistant', 'status.get', {})).rejects.toMatchObject({ status: 403 });
  });

  it('does not reopen an acknowledged finding when the same observation is replayed', async () => {
    const { store, workspace, admin } = setup();
    const actor = store.createClient({ name: 'connector', role: 'operator', scopes: ['findings:ingest'], expiresAt: Date.now() + 600000 }, admin.id).client;
    const item = { externalId: 'original', title: 'Observed event', severity: 'low', observedAt: Date.now() };
    await workspace.execute(actor, 'assistant', 'findings.ingest', { items: [item] });
    const finding = store.list<{ id: string }>('finding')[0];
    await workspace.execute(admin, 'admin', 'findings.update', { id: finding.id, status: 'acknowledged', reason: 'Reviewed this observation' });
    await workspace.execute(actor, 'assistant', 'findings.ingest', { items: [item] });
    expect(store.get<{ status: string }>('finding', finding.id)?.status).toBe('acknowledged');
  });

  it('rejects a second writer using an obsolete document revision', async () => {
    const { workspace, admin } = setup();
    const created = await workspace.execute(admin, 'admin', 'projects.create', { name: 'Race' }) as { project: { id: string } };
    const input = { id: created.project.id, revision: 1, document: { nodes: [], edges: [], saved: 1 } };
    const outcomes = await Promise.allSettled([workspace.execute(admin, 'admin', 'projects.update', input), workspace.execute(admin, 'admin', 'projects.update', input)]);
    expect(outcomes.filter(item => item.status === 'fulfilled')).toHaveLength(1);
    expect(outcomes.filter(item => item.status === 'rejected')).toHaveLength(1);
  });

  it('atomically rejects removal of linked assets until the finding is explicitly unlinked', async () => {
    const { workspace, admin, store } = setup();
    const content = JSON.stringify({ nodes: [{ id: 'endpoint', type: 'server', data: { label: 'Endpoint' } }], edges: [] });
    const created = await workspace.execute(admin, 'admin', 'projects.import', { name: 'Linked asset', content }) as { project: { id: string; revision: number; document: unknown } };
    await workspace.execute(admin, 'admin', 'findings.ingest', { items: [{ externalId: 'event', title: 'Event', severity: 'low', observedAt: Date.now() }] });
    const finding = store.list<{ id: string }>('finding')[0];
    await workspace.execute(admin, 'admin', 'findings.update', { id: finding.id, status: 'open', reason: 'Connect observation', projectId: created.project.id, assetId: 'endpoint' });
    const deletion = { id: created.project.id, revision: created.project.revision, document: { nodes: [], edges: [] } };
    await expect(workspace.execute(admin, 'admin', 'projects.update', deletion)).rejects.toMatchObject({ status: 409 });
    await expect(workspace.execute(admin, 'admin', 'projects.get', { id: created.project.id })).resolves.toEqual(created);
    expect(store.get('finding', finding.id)).toMatchObject({ assetId: 'endpoint' });
    await workspace.execute(admin, 'admin', 'findings.update', { id: finding.id, status: 'open', reason: 'Remove asset link before deleting', projectId: created.project.id });
    expect(store.get<{ assetId?: string }>('finding', finding.id)?.assetId).toBeUndefined();
    await expect(workspace.execute(admin, 'admin', 'projects.update', deletion)).resolves.toMatchObject({ project: { revision: created.project.revision + 1, document: { nodes: [] } } });
  });

  it('reimports its own Guardian export after accepting a large source document', async () => {
    const { workspace, admin } = setup();
    const content = JSON.stringify({ nodes: [], edges: [], notes: 'x'.repeat(9 * 1024 * 1024) });
    const imported = await workspace.execute(admin, 'admin', 'projects.import', { name: 'Large source', content }) as { project: { id: string } };
    const exported = await workspace.execute(admin, 'admin', 'projects.export', { id: imported.project.id }) as { guardian: string };
    await expect(workspace.execute(admin, 'admin', 'projects.import', { name: 'Roundtrip', content: exported.guardian })).resolves.toHaveProperty('project');
  });
});
