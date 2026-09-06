import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SecurityStore } from './store.js';
import { SecurityWorkspace, type SecurityJob } from './service.js';
import { openSQLiteDatabase } from '../runtime/sqlite-driver.js';

describe('security store durability and service ownership', () => {
  let directory: string;
  const opened = new Set<SecurityStore>();
  const workspaces = new Set<SecurityWorkspace>();
  const open = () => { const store = new SecurityStore(directory); opened.add(store); return store; };
  const openLimited = (limits: ConstructorParameters<typeof SecurityStore>[1]) => { const store = new SecurityStore(directory, limits); opened.add(store); return store; };
  const close = (store: SecurityStore) => { store.close(); opened.delete(store); };

  beforeEach(() => { directory = mkdtempSync(join(tmpdir(), 'guardian-security-store-')); });
  afterEach(async () => {
    for (const workspace of workspaces) await workspace.close();
    workspaces.clear();
    for (const store of opened) store.close();
    opened.clear();
    if (!resolve(directory).startsWith(resolve(tmpdir()) + sep)) throw new Error('Unsafe fixture cleanup path');
    rmSync(directory, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it('persists one administrator credential with only its hash in SQLite and refuses accidental rebootstrap', () => {
    const store = open();
    const path = join(directory, 'admin-token.txt');
    store.bootstrapAdministrator(path);
    const token = readFileSync(path, 'utf8').trim();
    expect(token).toMatch(/^guardian_/);
    const principal = store.authenticate(token)!;
    expect(principal.role).toBe('admin');
    const rows = store.db.prepare('SELECT hash,body FROM clients').all();
    expect(JSON.stringify(rows)).not.toContain(token);
    expect(() => store.bootstrapAdministrator(path)).toThrow('already exists');
    expect(readFileSync(path, 'utf8').trim()).toBe(token);
    expect(store.clients()).toHaveLength(1);
    close(store);
    const reopened = open();
    expect(reopened.authenticate(token)?.id).toBe(principal.id);
  });

  it('rolls back inserted administrator and audit state when the token file cannot be written', () => {
    const store = open();
    expect(() => store.bootstrapAdministrator(join(directory, 'missing-parent', 'admin-token.txt'))).toThrow();
    expect(store.clients()).toEqual([]);
    expect(store.auditList()).toEqual([]);
    const goodPath = join(directory, 'admin-token.txt');
    store.bootstrapAdministrator(goodPath);
    expect(store.authenticate(readFileSync(goodPath, 'utf8').trim())?.role).toBe('admin');
  });

  it('rotates credentials explicitly, preserves the previous token file and revokes the old database credential', () => {
    const store = open();
    const path = join(directory, 'admin-token.txt');
    store.bootstrapAdministrator(path);
    const original = readFileSync(path, 'utf8');
    const previousPrincipal = store.authenticate(original.trim())!;
    store.bootstrapAdministrator(path, true);
    const replacement = readFileSync(path, 'utf8').trim();
    expect(replacement).not.toBe(original.trim());
    expect(store.authenticate(replacement)?.role).toBe('admin');
    expect(store.authenticate(original.trim())).toBeUndefined();
    expect(store.client(previousPrincipal.id)?.revoked).toBe(true);
    const backups = readdirSync(directory).filter(name => name.startsWith('admin-token.txt.previous-'));
    expect(backups).toHaveLength(1);
    expect(readFileSync(join(directory, backups[0]), 'utf8')).toBe(original);
    expect(store.clients().filter(client => !client.revoked)).toHaveLength(1);
  });

  it('retains the valid previous credential and its backup when rotation fails after file output', () => {
    const store = open();
    const path = join(directory, 'admin-token.txt');
    store.bootstrapAdministrator(path);
    const original = readFileSync(path, 'utf8');
    const priorAudit = store.auditList();
    const audit = vi.spyOn(store, 'audit').mockImplementationOnce(() => { throw new Error('Simulated durable audit failure'); });
    expect(() => store.bootstrapAdministrator(path, true)).toThrow('Simulated durable audit failure');
    audit.mockRestore();
    expect(store.clients()).toHaveLength(1);
    expect(store.authenticate(original.trim())?.role).toBe('admin');
    expect(readFileSync(path, 'utf8')).toBe(original);
    expect(store.auditList()).toEqual(priorAudit);
    const backups = readdirSync(directory).filter(name => name.startsWith('admin-token.txt.previous-'));
    expect(backups).toHaveLength(1);
    expect(readFileSync(join(directory, backups[0]), 'utf8')).toBe(original);
  });

  it('removes an unregistered bootstrap token when the initial transaction fails after file output', () => {
    const store = open();
    const path = join(directory, 'admin-token.txt');
    const audit = vi.spyOn(store, 'audit').mockImplementationOnce(() => { throw new Error('Simulated bootstrap audit failure'); });
    expect(() => store.bootstrapAdministrator(path)).toThrow('Simulated bootstrap audit failure');
    audit.mockRestore();
    expect(existsSync(path)).toBe(false);
    expect(store.clients()).toEqual([]);
    expect(store.auditList()).toEqual([]);
    store.bootstrapAdministrator(path);
    expect(store.authenticate(readFileSync(path, 'utf8').trim())?.role).toBe('admin');
  });

  it('enforces exclusive service ownership across real SQLite connections and releases it only for its owner', () => {
    const first = open();
    const second = open();
    first.acquireServiceOwnership();
    expect(() => second.acquireServiceOwnership()).toThrow('Another Guardian service owns');
    close(second);
    const third = open();
    expect(() => third.acquireServiceOwnership()).toThrow('Another Guardian service owns');
    close(first);
    expect(() => third.acquireServiceOwnership()).not.toThrow();
    const fourth = open();
    expect(() => fourth.acquireServiceOwnership()).toThrow('Another Guardian service owns');
  });

  it('rejects unsupported or incomplete existing schemas before changing tables or journal mode', () => {
    const path = join(directory, 'guardian-security.sqlite');
    const future = openSQLiteDatabase(path, {})!;
    future.exec('CREATE TABLE meta (key TEXT PRIMARY KEY,value TEXT NOT NULL)');
    future.prepare('INSERT INTO meta(key,value) VALUES(?,?)').run('schema', '2');
    future.close();
    expect(() => new SecurityStore(directory)).toThrow('Unsupported security database schema 2');
    const inspect = openSQLiteDatabase(path, {})!;
    expect(inspect.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all()).toEqual([{ name: 'meta' }]);
    expect(inspect.prepare('PRAGMA journal_mode').get()).toMatchObject({ journal_mode: 'delete' });
    inspect.close();
  });

  it('marks interrupted jobs for verification after close/reopen without replaying native actions or pending approvals', async () => {
    const collectors = {
      check: vi.fn(async () => { throw new Error('Recovery must not invoke a collector'); }),
      requestScan: vi.fn(async (_type: 'quick' | 'full') => { throw new Error('Recovery must not invoke a native scan'); }),
    };
    const first = open();
    const original = new SecurityWorkspace(first, collectors); workspaces.add(original);
    const template: SecurityJob = {
      id: 'interrupted', actorId: 'historical-actor', operation: 'native.scan', input: { scanType: 'full' }, target: original.device.id,
      state: 'running', status: 'running', createdAt: 1, updatedAt: 1, expiresAt: Date.now() + 60000,
    };
    first.put('job', template.id, template);
    first.put('job', 'pending', { ...template, id: 'pending', state: 'awaiting_approval', status: 'awaiting_approval' });
    first.put('job', 'requested', { ...template, id: 'requested', state: 'requested', status: 'requested' });
    await original.close(); workspaces.delete(original); close(first);
    const reopened = open();
    const recovered = new SecurityWorkspace(reopened, collectors); workspaces.add(recovered);
    await recovered.idle();
    expect(recovered.device.id).toBe(original.device.id);
    expect(reopened.get<SecurityJob>('job', 'interrupted')).toMatchObject({ state: 'interrupted', status: 'interrupted' });
    expect(reopened.get<SecurityJob>('job', 'interrupted')?.error).toMatch(/requires verification.*will not be replayed/);
    expect(reopened.get<SecurityJob>('job', 'pending')?.state).toBe('awaiting_approval');
    expect(reopened.get<SecurityJob>('job', 'requested')?.state).toBe('requested');
    expect(collectors.check).not.toHaveBeenCalled();
    expect(collectors.requestScan).not.toHaveBeenCalled();
    expect(reopened.auditList()).toEqual(expect.arrayContaining([expect.objectContaining({ operation: 'jobs.interrupted', target: 'interrupted' })]));
  });

  it('enforces record, kind and aggregate byte quotas atomically while accounting for replacement deltas', () => {
    const store = openLimited({ totalRecordBytes: 220, reservedFreeBytes: 0, recordBytes: { test: 160 }, kindBytes: { test: 200 } });
    store.put('test', 'one', { value: 'x'.repeat(60) });
    const before = store.recordBytes('test');
    expect(() => store.transaction(() => {
      store.put('test', 'two', { value: 'y'.repeat(60) });
      store.put('test', 'three', { value: 'z'.repeat(60) });
    })).toThrow(/quota/);
    expect(store.count('test')).toBe(1);
    expect(store.recordBytes('test')).toBe(before);
    expect(() => store.put('test', 'one', { value: 'shorter' })).not.toThrow();
    expect(store.recordBytes('test')).toBeLessThan(before);
  });

  it('pages records by stable row cursor, filters projects before limits and projects only metadata', () => {
    const store = open();
    store.put('finding', 'oldest', { id: 'oldest', projectId: 'allowed' });
    store.put('finding', 'middle', { id: 'middle', projectId: 'other' });
    store.put('finding', 'newest', { id: 'newest', projectId: 'other' });
    const first = store.page<{ id: string }>('finding', 1, undefined, ['other']);
    expect(first).toMatchObject({ items: [{ id: 'newest' }], hasMore: true, total: 2 });
    store.put('finding', 'later', { id: 'later', projectId: 'other' });
    expect(store.page<{ id: string }>('finding', 1, first.nextCursor, ['other'])).toMatchObject({ items: [{ id: 'middle' }], hasMore: false, total: 3 });
    expect(store.page<{ id: string }>('finding', 1, undefined, ['allowed']).items).toEqual([{ id: 'oldest', projectId: 'allowed' }]);
    store.put('project', 'project-one', { id: 'project-one', name: 'Summary', revision: 2, createdAt: 1, updatedAt: 2, envelope: { large: 'x'.repeat(1024 * 1024) } });
    expect(store.projectSummaries()).toEqual([{ id: 'project-one', name: 'Summary', revision: 2, createdAt: 1, updatedAt: 2 }]);
  });

  it('bounds audit payloads, pages the immutable sequence and prunes only resolved terminal jobs', () => {
    const store = open();
    store.audit('actor', 'x'.repeat(5000), undefined, { payload: 'y'.repeat(20000) });
    store.audit('actor', 'second');
    const first = store.auditPage(1);
    expect(first).toMatchObject({ hasMore: true, total: 2, items: [{ operation: 'second' }] });
    const older = store.auditPage(1, first.nextCursor);
    expect(older.hasMore).toBe(false);
    expect(older.items[0]).toMatchObject({ details: { truncated: true, bytes: expect.any(Number), sha256: expect.stringMatching(/^[a-f0-9]{64}$/) } });
    expect(Buffer.byteLength(String((older.items[0] as { operation: string }).operation))).toBeLessThanOrEqual(256);
    for (let index = 0; index < 5; index++) store.put('job', `done-${index}`, { id: `done-${index}`, state: 'succeeded' });
    for (const state of ['running', 'awaiting_approval', 'interrupted', 'unknown', 'requested']) store.put('job', state, { id: state, state });
    for (let index = 0; index < 3; index++) store.put('job', `expired-${index}`, { id: `expired-${index}`, state: 'expired' });
    store.pruneTerminalJobs(2);
    expect(store.list<{ state: string }>('job', 20).filter(job => ['succeeded', 'expired'].includes(job.state))).toHaveLength(2);
    for (const state of ['running', 'awaiting_approval', 'interrupted', 'unknown', 'requested']) expect(store.get('job', state)).toBeDefined();
  });
});
