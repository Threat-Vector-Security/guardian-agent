import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { existsSync, readFileSync, writeFileSync, unlinkSync, copyFileSync, constants, statfsSync } from 'node:fs';
import { mkdirSecureSync } from '../util/secure-fs.js';
import { openSQLiteDatabase, type SQLiteDatabase } from '../runtime/sqlite-driver.js';

export type Role = 'admin' | 'operator' | 'viewer';
export interface Principal {
  id: string;
  name: string;
  role: Role;
  scopes: string[];
  projectIds?: string[];
  expiresAt: number;
  revoked?: boolean;
}
export class WorkspaceError extends Error {
  constructor(public readonly status: number, message: string) { super(message); }
}
export function digest(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

const MIB = 1024 * 1024;
export interface SecurityStoreLimits {
  totalRecordBytes: number;
  reservedFreeBytes: number;
  recordBytes: Record<string, number>;
  kindBytes: Record<string, number>;
}
const DEFAULT_LIMITS: SecurityStoreLimits = {
  totalRecordBytes: 512 * MIB,
  reservedFreeBytes: 64 * MIB,
  recordBytes: { project: 48 * MIB, finding: 64 * 1024, job: 256 * 1024, 'aws-status': 16 * MIB, status: 16 * MIB },
  kindBytes: { project: 384 * MIB, finding: 128 * MIB, job: 16 * MIB },
};
export interface RecordPage<T> { items: T[]; nextCursor?: number; hasMore: boolean; total: number }

/** One local authority; no silent in-memory fallback for protection decisions. */
export class SecurityStore {
  readonly db: SQLiteDatabase;
  private owner?: string;
  private readonly limits: SecurityStoreLimits;
  constructor(readonly directory: string, limits: Partial<SecurityStoreLimits> = {}) {
    this.limits = {
      ...DEFAULT_LIMITS,
      ...limits,
      recordBytes: { ...DEFAULT_LIMITS.recordBytes, ...limits.recordBytes },
      kindBytes: { ...DEFAULT_LIMITS.kindBytes, ...limits.kindBytes },
    };
    mkdirSecureSync(directory);
    const db = openSQLiteDatabase(join(directory, 'guardian-security.sqlite'), {});
    if (!db) throw new Error('Guardian Security requires Node.js 24 with working node:sqlite and a writable data directory.');
    db.enableDefensive?.(true);
    const tableRows = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all() as Array<{ name: string }>;
    const tableNames = new Set(tableRows.map(row => row.name));
    if (tableNames.has('meta')) {
      let version: { value: string } | undefined;
      try { version = db.prepare('SELECT value FROM meta WHERE key=?').get('schema') as { value: string } | undefined; }
      catch { db.close(); throw new Error('Unsupported security database metadata layout; refusing to modify it.'); }
      if (version?.value !== '1') { db.close(); throw new Error(`Unsupported security database schema ${version?.value ?? 'missing'}; refusing to modify it.`); }
      const expected: Record<string, string[]> = {
        records: ['kind', 'id', 'body'], clients: ['id', 'hash', 'body'],
        audit: ['sequence', 'id', 'at', 'actor', 'operation', 'target', 'details', 'previous_hash', 'hash'], meta: ['key', 'value'],
      };
      for (const [table, columns] of Object.entries(expected)) {
        if (!tableNames.has(table)) { db.close(); throw new Error(`Security database schema 1 is missing ${table}; refusing to modify it.`); }
        const actual = (db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>).map(row => row.name);
        if (actual.join('\0') !== columns.join('\0')) { db.close(); throw new Error(`Security database schema 1 has an unsupported ${table} layout; refusing to modify it.`); }
      }
    } else if (tableNames.size) { db.close(); throw new Error('Unversioned security database is not supported; refusing to modify it.'); }
    this.db = db;
    db.exec(`PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS records (kind TEXT NOT NULL,id TEXT NOT NULL,body TEXT NOT NULL,PRIMARY KEY(kind,id));
      CREATE TABLE IF NOT EXISTS clients (id TEXT PRIMARY KEY,hash TEXT UNIQUE NOT NULL,body TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS audit (sequence INTEGER PRIMARY KEY AUTOINCREMENT,id TEXT NOT NULL,at INTEGER NOT NULL,actor TEXT NOT NULL,operation TEXT NOT NULL,target TEXT,details TEXT NOT NULL,previous_hash TEXT NOT NULL,hash TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY,value TEXT NOT NULL);`);
    db.prepare('INSERT OR IGNORE INTO meta(key,value) VALUES(?,?)').run('schema', '1');
  }
  transaction<T>(fn: () => T): T {
    this.db.exec('BEGIN IMMEDIATE');
    try { const result = fn(); this.db.exec('COMMIT'); return result; }
    catch (error) { this.db.exec('ROLLBACK'); throw error; }
  }
  get<T>(kind: string, id: string): T | undefined {
    const row = this.db.prepare('SELECT body FROM records WHERE kind=? AND id=?').get(kind, id) as { body: string } | undefined;
    return row ? JSON.parse(row.body) as T : undefined;
  }
  require<T>(kind: string, id: string): T {
    const value = this.get<T>(kind, id);
    if (!value) throw new WorkspaceError(404, `${kind} not found`);
    return value;
  }
  list<T>(kind: string, limit = 500): T[] {
    return this.db.prepare('SELECT body FROM records WHERE kind=? ORDER BY rowid DESC LIMIT ?').all(kind, limit)
      .map(row => JSON.parse((row as { body: string }).body) as T);
  }
  page<T>(kind: string, limit = 100, before?: number, projectIds?: string[]): RecordPage<T> {
    const bounded = Math.max(1, Math.min(100, limit));
    const where = ['kind=?']; const parameters: Array<string | number> = [kind];
    if (before !== undefined) { where.push('rowid < ?'); parameters.push(before); }
    if (projectIds) {
      if (!projectIds.length) return { items: [], hasMore: false, total: 0 };
      where.push(`json_extract(body,'$.projectId') IN (${projectIds.map(() => '?').join(',')})`);
      parameters.push(...projectIds);
    }
    const clause = where.join(' AND ');
    const rows = this.db.prepare(`SELECT rowid,body FROM records WHERE ${clause} ORDER BY rowid DESC LIMIT ?`).all(...parameters, bounded + 1) as Array<{ rowid: number; body: string }>;
    const hasMore = rows.length > bounded; const selected = rows.slice(0, bounded);
    const countWhere = ['kind=?']; const countParameters: string[] = [kind];
    if (projectIds) { countWhere.push(`json_extract(body,'$.projectId') IN (${projectIds.map(() => '?').join(',')})`); countParameters.push(...projectIds); }
    const total = (this.db.prepare(`SELECT count(*) AS n FROM records WHERE ${countWhere.join(' AND ')}`).get(...countParameters) as { n: number }).n;
    return { items: selected.map(row => JSON.parse(row.body) as T), hasMore, total, ...(hasMore && selected.length ? { nextCursor: selected[selected.length - 1].rowid } : {}) };
  }
  projectSummaries(projectIds?: string[]): Array<{ id: string; name: string; revision: number; createdAt: number; updatedAt: number }> {
    if (projectIds && !projectIds.length) return [];
    const filter = projectIds ? ` AND id IN (${projectIds.map(() => '?').join(',')})` : '';
    return this.db.prepare(`SELECT id,json_extract(body,'$.name') AS name,json_extract(body,'$.revision') AS revision,json_extract(body,'$.createdAt') AS createdAt,json_extract(body,'$.updatedAt') AS updatedAt FROM records WHERE kind='project'${filter} ORDER BY rowid DESC`).all(...(projectIds ?? [])) as Array<{ id: string; name: string; revision: number; createdAt: number; updatedAt: number }>;
  }
  recordBytes(kind?: string, idPrefix?: string): number {
    const where = [kind ? 'kind=?' : '1=1']; const parameters: string[] = kind ? [kind] : [];
    if (idPrefix !== undefined) { where.push('id LIKE ? ESCAPE \'\\\''); parameters.push(`${idPrefix.replaceAll('\\', '\\\\').replaceAll('%', '\\%').replaceAll('_', '\\_')}%`); }
    return (this.db.prepare(`SELECT coalesce(sum(length(CAST(body AS BLOB))),0) AS n FROM records WHERE ${where.join(' AND ')}`).get(...parameters) as { n: number }).n;
  }
  put(kind: string, id: string, value: unknown): void {
    const body = JSON.stringify(value); const bytes = Buffer.byteLength(body);
    const recordLimit = this.limits.recordBytes[kind] ?? 16 * MIB;
    if (bytes > recordLimit) throw new WorkspaceError(413, `${kind} record exceeds its ${recordLimit}-byte storage limit`);
    const current = this.db.prepare('SELECT length(CAST(body AS BLOB)) AS n FROM records WHERE kind=? AND id=?').get(kind, id) as { n: number } | undefined;
    const delta = bytes - (current?.n ?? 0);
    const kindLimit = this.limits.kindBytes[kind];
    if (delta > 0 && kindLimit !== undefined && this.recordBytes(kind) + delta > kindLimit) throw new WorkspaceError(507, `${kind} storage quota reached`);
    if (delta > 0 && this.recordBytes() + delta > this.limits.totalRecordBytes) throw new WorkspaceError(507, 'Guardian record storage quota reached');
    if (delta > 0) {
      const stats = statfsSync(this.directory);
      if (Number(stats.bavail) * Number(stats.bsize) - delta < this.limits.reservedFreeBytes) throw new WorkspaceError(507, 'Guardian reserved disk space would be exhausted');
    }
    this.db.prepare('INSERT INTO records(kind,id,body) VALUES(?,?,?) ON CONFLICT(kind,id) DO UPDATE SET body=excluded.body')
      .run(kind, id, body);
  }
  count(kind: string): number {
    return (this.db.prepare('SELECT count(*) AS n FROM records WHERE kind=?').get(kind) as { n: number }).n;
  }
  audit(actor: string, operation: string, target?: string, details: unknown = {}): void {
    const previous = this.db.prepare('SELECT hash FROM audit ORDER BY sequence DESC LIMIT 1').get() as { hash: string } | undefined;
    const id = randomUUID(); const at = Date.now();
    const boundedText = (value: string, max: number): string => {
      if (Buffer.byteLength(value) <= max) return value;
      const suffix = `…#${digest(value)}`; const budget = max - Buffer.byteLength(suffix) - 3;
      return `${Buffer.from(value).subarray(0, budget).toString('utf8')}…#${digest(value)}`;
    };
    actor = boundedText(actor, 256); operation = boundedText(operation, 256); target = target === undefined ? undefined : boundedText(target, 256);
    const raw = JSON.stringify(details); const body = Buffer.byteLength(raw) <= 16 * 1024 ? raw : JSON.stringify({ truncated: true, bytes: Buffer.byteLength(raw), sha256: digest(raw) });
    const previousHash = previous?.hash ?? '';
    const hash = digest(JSON.stringify([previousHash, id, at, actor, operation, target ?? null, body]));
    this.db.prepare('INSERT INTO audit(id,at,actor,operation,target,details,previous_hash,hash) VALUES(?,?,?,?,?,?,?,?)')
      .run(id, at, actor, operation, target ?? null, body, previousHash, hash);
  }
  auditList(limit = 500): unknown[] {
    return this.db.prepare('SELECT * FROM audit ORDER BY sequence DESC LIMIT ?').all(limit).map(row => {
      const value = row as Record<string, unknown>;
      return { ...value, details: JSON.parse(String(value['details'])) };
    });
  }
  auditPage(limit = 100, before?: number): RecordPage<unknown> {
    const bounded = Math.max(1, Math.min(100, limit));
    const rows = (before === undefined
      ? this.db.prepare('SELECT * FROM audit ORDER BY sequence DESC LIMIT ?').all(bounded + 1)
      : this.db.prepare('SELECT * FROM audit WHERE sequence < ? ORDER BY sequence DESC LIMIT ?').all(before, bounded + 1)) as Array<Record<string, unknown>>;
    const hasMore = rows.length > bounded; const selected = rows.slice(0, bounded);
    const items = selected.map(value => ({ ...value, details: JSON.parse(String(value['details'])) }));
    const total = (this.db.prepare('SELECT count(*) AS n FROM audit').get() as { n: number }).n;
    return { items, hasMore, total, ...(hasMore && selected.length ? { nextCursor: Number(selected[selected.length - 1]['sequence']) } : {}) };
  }
  pruneTerminalJobs(retain = 1000): void {
    this.db.prepare(`DELETE FROM records WHERE kind='job' AND id IN (
      SELECT id FROM records WHERE kind='job' AND json_extract(body,'$.state') IN ('succeeded','failed','rejected','expired') ORDER BY rowid DESC LIMIT -1 OFFSET ?
    )`).run(retain);
  }
  expiredApprovalJobs<T>(now = Date.now()): T[] {
    return this.db.prepare("SELECT body FROM records WHERE kind='job' AND json_extract(body,'$.state')='awaiting_approval' AND json_extract(body,'$.expiresAt') <= ?").all(now)
      .map(row => JSON.parse((row as { body: string }).body) as T);
  }
  createClient(input: Omit<Principal, 'id'>, actor: string): { client: Principal; token: string } {
    const client: Principal = { ...input, id: randomUUID() };
    const token = `guardian_${randomBytes(32).toString('base64url')}`;
    this.transaction(() => {
      this.db.prepare('INSERT INTO clients(id,hash,body) VALUES(?,?,?)').run(client.id, digest(token), JSON.stringify(client));
      this.audit(actor, 'clients.create', client.id, { name: client.name, role: client.role, scopes: client.scopes });
    });
    return { client, token };
  }
  bootstrapAdministrator(path: string, rotate = false): void {
    if (!rotate && (existsSync(path) || this.clients().some(c => c.role === 'admin' && !c.revoked && c.expiresAt > Date.now()))) {
      throw new Error('Administrator bootstrap already exists. Use its saved token, or run init --rotate-admin locally to rotate it.');
    }
    const client: Principal = { id: randomUUID(), name: 'Local administrator', role: 'admin', scopes: ['admin'], expiresAt: Date.now() + 365 * 86400000 };
    const token = `guardian_${randomBytes(32).toString('base64url')}`;
    // Preserve the previous token during explicit local rotation, including if the transaction fails.
    const previousFile = existsSync(path) ? readFileSync(path) : undefined;
    let fileWritten = false;
    if (rotate && existsSync(path)) copyFileSync(path, `${path}.previous-${Date.now()}`, constants.COPYFILE_EXCL);
    try { this.transaction(() => {
      this.db.prepare('INSERT INTO clients(id,hash,body) VALUES(?,?,?)').run(client.id, digest(token), JSON.stringify(client));
      writeFileSync(path, token + '\n', { encoding: 'utf8', mode: 0o600, flag: rotate ? 'w' : 'wx' });
      fileWritten = true;
      for (const old of this.clients()) if (old.role === 'admin' && old.id !== client.id && !old.revoked) {
        this.db.prepare('UPDATE clients SET body=? WHERE id=?').run(JSON.stringify({ ...old, revoked: true }), old.id);
      }
      this.audit('local-bootstrap', rotate ? 'admin.rotate' : 'admin.bootstrap', client.id);
    }); } catch (error) {
      if (fileWritten) {
        if (previousFile) writeFileSync(path, previousFile, { mode: 0o600 });
        else unlinkSync(path);
      }
      throw error;
    }
  }
  authenticate(token: string): Principal | undefined {
    if (token.length > 256) return undefined;
    const row = this.db.prepare('SELECT body FROM clients WHERE hash=?').get(digest(token)) as { body: string } | undefined;
    if (!row) return undefined;
    const client = JSON.parse(row.body) as Principal;
    return !client.revoked && client.expiresAt > Date.now() ? client : undefined;
  }
  signInEntra(identity: { issuer: string; subject: string; name: string; role: Role }, scopes: string[]): Principal {
    const id = `entra:${digest(identity.issuer + '\0' + identity.subject)}`;
    const principal: Principal = { id, name: identity.name, role: identity.role, scopes, expiresAt: Date.now() + 3600000 };
    this.transaction(() => {
      this.db.prepare('INSERT INTO clients(id,hash,body) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET body=excluded.body')
        .run(id, digest(randomBytes(32).toString('hex')), JSON.stringify(principal));
      this.audit(id, 'entra.signin', undefined, { role: identity.role });
    });
    return principal;
  }
  signInLocalBrowser(): Principal {
    const principal: Principal = { id: 'local-browser', name: 'Local browser', role: 'admin', scopes: ['admin'], expiresAt: Date.now() + 8 * 3600000 };
    this.transaction(() => {
      this.db.prepare('INSERT INTO clients(id,hash,body) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET hash=excluded.hash,body=excluded.body')
        .run(principal.id, digest(randomBytes(32).toString('hex')), JSON.stringify(principal));
      this.audit(principal.id, 'browser.local-signin');
    });
    return principal;
  }
  client(id: string): Principal | undefined {
    const row = this.db.prepare('SELECT body FROM clients WHERE id=?').get(id) as { body: string } | undefined;
    return row ? JSON.parse(row.body) as Principal : undefined;
  }
  clients(): Principal[] {
    return this.db.prepare('SELECT body FROM clients ORDER BY rowid').all().map(row => JSON.parse((row as { body: string }).body) as Principal);
  }
  revoke(id: string, actor: string): void {
    const client = this.client(id);
    if (!client) throw new WorkspaceError(404, 'Client not found');
    if (client.role === 'admin') throw new WorkspaceError(403, 'Root administrator rotation requires the local administration command.');
    this.transaction(() => {
      this.db.prepare('UPDATE clients SET body=? WHERE id=?').run(JSON.stringify({ ...client, revoked: true }), id);
      this.audit(actor, 'clients.revoke', id);
    });
  }
  acquireServiceOwnership(): void {
    const nonce = randomUUID();
    this.transaction(() => {
      const row = this.db.prepare('SELECT value FROM meta WHERE key=?').get('service-owner') as { value: string } | undefined;
      if (row) {
        const prior = JSON.parse(row.value) as { pid: number };
        let alive = true;
        try { process.kill(prior.pid, 0); } catch (error) { alive = (error as NodeJS.ErrnoException).code !== 'ESRCH'; }
        if (alive) throw new Error('Another Guardian service owns this data directory. Stop it before starting another instance.');
      }
      this.db.prepare('INSERT INTO meta(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value')
        .run('service-owner', JSON.stringify({ pid: process.pid, nonce }));
    });
    this.owner = nonce;
  }
  close(): void {
    if (this.owner) this.db.prepare('DELETE FROM meta WHERE key=? AND value=?').run('service-owner', JSON.stringify({ pid: process.pid, nonce: this.owner }));
    this.db.close();
  }
}
