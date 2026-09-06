import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { randomBytes } from 'node:crypto';
import { readFile, realpath } from 'node:fs/promises';
import { resolve, sep, extname } from 'node:path';
import { SecurityWorkspace } from './service.js';
import { WorkspaceError, type Principal } from './store.js';
import { visibleOperations, ASSISTANT_SCOPES } from './operations.js';
import type { EntraOidc } from './entra-oidc.js';

export interface SecurityServerOptions { port?: number; webRoot: string; entra?: Pick<EntraOidc, 'begin' | 'finish'> }
// Full Guardian envelopes include original base64 + editable document, nested inside JSON transport.
const MAX_BODY = 96 * 1024 * 1024;
export async function startSecurityServer(workspace: SecurityWorkspace, options: SecurityServerOptions) {
  const sessions = new Map<string, { clientId: string; role: Principal['role']; expiresAt: number; localAuthRevision?: string }>();
  const attempts = new Map<string, { count: number; reset: number }>();
  let origin = '';
  let activeBodies = 0;
  function establishSession(principal: Principal, res: ServerResponse, extraCookies: string[] = [], localAuthRevision?: string): void {
    for (const [id, session] of sessions) if (session.expiresAt <= Date.now()) sessions.delete(id);
    const existing = [...sessions].find(([, session]) => session.clientId === principal.id);
    const nonAdmin = [...sessions.values()].filter(session => session.role !== 'admin').length;
    if (!existing && principal.role !== 'admin' && nonAdmin >= 90) throw new WorkspaceError(429, 'Non-administrator session capacity reached');
    if (!existing && sessions.size >= 100) {
      const replaceable = principal.role === 'admin' ? [...sessions].find(([, session]) => session.role !== 'admin') : undefined;
      if (!replaceable) throw new WorkspaceError(429, 'Session limit reached');
      sessions.delete(replaceable[0]);
    }
    const sid = existing?.[0] ?? randomBytes(32).toString('base64url');
    workspace.store.audit(principal.id, 'session.created');
    sessions.set(sid, { clientId: principal.id, role: principal.role, expiresAt: Math.min(principal.expiresAt, Date.now() + 8 * 3600000), ...(localAuthRevision ? { localAuthRevision } : {}) });
    res.setHeader('Set-Cookie', [`guardian_session=${sid}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800`, ...extraCookies]);
  }
  function send(res: ServerResponse, status: number, value: unknown): void {
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify(value));
  }
  function rateLimit(req: IncomingMessage, bucket: string, clientId?: string): void {
    const key = clientId ? `${bucket}:${clientId}` : `${bucket}:${req.socket.remoteAddress ?? 'local'}`; const now = Date.now();
    const prior = attempts.get(key);
    const entry = prior && prior.reset > now ? prior : { count: 0, reset: now + 60000 };
    attempts.set(key, entry);
    if (++entry.count > 240) throw new WorkspaceError(429, 'Local API rate limit reached. Retry in one minute.');
  }
  function authenticate(req: IncomingMessage): { principal: Principal; audience: 'admin' | 'assistant' } | undefined {
    const authorization = req.headers.authorization;
    if (authorization) {
      if (!authorization.startsWith('Bearer ')) return undefined;
      const principal = workspace.store.authenticate(authorization.slice(7));
      // A root token is only exchanged for an explicit administrative session.
      if (!principal || principal.role === 'admin') return undefined;
      return { principal, audience: 'assistant' };
    }
    const sid = /(?:^|;\s*)guardian_session=([^;]+)/.exec(req.headers.cookie ?? '')?.[1];
    const session = sid ? sessions.get(sid) : undefined;
    if (!session || session.expiresAt <= Date.now()) { if (sid) sessions.delete(sid); return undefined; }
    if (session.localAuthRevision) {
      const preference = workspace.browserAuthentication();
      if (options.entra || preference.signInRequired || preference.revision !== session.localAuthRevision) { sessions.delete(sid!); return undefined; }
    }
    const principal = workspace.store.client(session.clientId);
    if (!principal || principal.revoked || principal.expiresAt <= Date.now()) return undefined;
    return { principal, audience: principal.role === 'admin' ? 'admin' : 'assistant' };
  }
  async function body(req: IncomingMessage): Promise<Record<string, unknown>> {
    if (activeBodies >= 2) throw new WorkspaceError(429, 'Request body concurrency limit reached');
    activeBodies += 1;
    try {
    if (req.headers['content-type']?.split(';')[0]?.trim() !== 'application/json') throw new WorkspaceError(415, 'Use application/json');
    if (Number(req.headers['content-length'] ?? 0) > MAX_BODY) throw new WorkspaceError(413, 'Request exceeds 96 MiB');
    let size = 0; const chunks: Buffer[] = [];
    for await (const chunk of req) {
      const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      size += bytes.length;
      if (size > MAX_BODY) throw new WorkspaceError(413, 'Request exceeds 96 MiB');
      chunks.push(bytes);
    }
    let value: unknown;
    try { value = JSON.parse(Buffer.concat(chunks).toString('utf8')); }
    catch { throw new WorkspaceError(400, 'Invalid JSON'); }
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new WorkspaceError(400, 'Expected a JSON object');
    return value as Record<string, unknown>;
    } finally { activeBodies -= 1; }
  }
  const server = createServer((req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
    void (async () => {
      if (req.headers.host !== new URL(origin).host) throw new WorkspaceError(403, 'Invalid Host header');
      if (req.headers.origin && req.headers.origin !== origin) throw new WorkspaceError(403, 'Cross-origin access denied');
      const url = new URL(req.url ?? '/', origin);
      if (url.pathname === '/health' && req.method === 'GET') { send(res, 200, { status: 'ok', product: 'guardian-security', version: '2.0.0' }); return; }
      if (url.pathname === '/api/v1/auth/providers' && req.method === 'GET') { send(res, 200, { entra: !!options.entra, localBrowserAccess: !options.entra && !workspace.browserAuthentication().signInRequired }); return; }
      if (url.pathname === '/api/v1/session/local' && req.method === 'POST') {
        rateLimit(req, 'local-browser-login');
        if (req.headers.authorization || req.headers.origin !== origin || req.headers['sec-fetch-site'] !== 'same-origin'
          || !['cors', 'same-origin'].includes(String(req.headers['sec-fetch-mode'])) || req.headers['sec-fetch-dest'] !== 'empty') {
          throw new WorkspaceError(403, 'Local browser access requires a same-origin browser request');
        }
        const input = await body(req);
        if (Object.keys(input).length) throw new WorkspaceError(400, 'Local browser access does not accept credentials or options');
        const preference = workspace.browserAuthentication();
        if (options.entra || preference.signInRequired) throw new WorkspaceError(403, 'Browser sign-in is required');
        const principal = workspace.store.signInLocalBrowser();
        establishSession(principal, res, [], preference.revision);
        send(res, 200, { authenticated: true, principal }); return;
      }
      if (url.pathname === '/api/v1/auth/entra/start' && req.method === 'GET' && options.entra) {
        rateLimit(req, 'entra-start');
        const login = await options.entra.begin();
        res.setHeader('Set-Cookie', `guardian_oidc=${login.state}; HttpOnly; SameSite=Lax; Path=/api/v1/auth/entra; Max-Age=300`);
        res.writeHead(302, { Location: login.url, 'Cache-Control': 'no-store' }); res.end(); return;
      }
      if (url.pathname === '/api/v1/auth/entra/callback' && req.method === 'GET' && options.entra) {
        rateLimit(req, 'entra-callback');
        const clearCookie = 'guardian_oidc=; HttpOnly; SameSite=Lax; Path=/api/v1/auth/entra; Max-Age=0';
        res.setHeader('Set-Cookie', clearCookie);
        let identity;
        try { identity = await options.entra.finish({ code: url.searchParams.get('code') ?? '', state: url.searchParams.get('state') ?? '', cookieState: /(?:^|;\s*)guardian_oidc=([^;]+)/.exec(req.headers.cookie ?? '')?.[1] ?? '' }); }
        catch { throw new WorkspaceError(401, 'Microsoft Entra sign-in could not be verified. Return to Guardian and try again.'); }
        const principal = workspace.store.signInEntra(identity, identity.role === 'admin' ? ['admin'] : identity.role === 'viewer' ? ['security:read', 'projects:read'] : ASSISTANT_SCOPES.filter(scope => scope !== 'findings:ingest'));
        establishSession(principal, res, [clearCookie]);
        res.writeHead(302, { Location: '/', 'Cache-Control': 'no-store' }); res.end(); return;
      }
      if (url.pathname === '/api/v1/session') {
        if (req.method === 'GET') {
          const auth = authenticate(req);
          send(res, 200, { authenticated: !!auth, principal: auth?.principal }); return;
        }
        if (req.method === 'POST') {
          rateLimit(req, 'login');
          const input = await body(req);
          if (typeof input.token !== 'string') throw new WorkspaceError(400, 'Token required');
          const principal = workspace.store.authenticate(input.token);
          if (!principal) throw new WorkspaceError(401, 'Invalid or expired credential');
          establishSession(principal, res);
          send(res, 200, { authenticated: true, principal }); return;
        }
        if (req.method === 'DELETE') {
          if (req.headers.origin !== origin) throw new WorkspaceError(403, 'Same-origin session request required');
          const sid = /(?:^|;\s*)guardian_session=([^;]+)/.exec(req.headers.cookie ?? '')?.[1];
          if (sid) sessions.delete(sid);
          res.setHeader('Set-Cookie', 'guardian_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');
          send(res, 200, { authenticated: false }); return;
        }
      }
      if (url.pathname === '/api/v1/operations') {
        const auth = authenticate(req);
        rateLimit(req, auth ? 'client' : 'anonymous-api', auth?.principal.id);
        if (!auth) throw new WorkspaceError(401, 'Authentication required. Root credentials must use an administrator session.');
        if (req.method === 'GET') { send(res, 200, { items: visibleOperations(auth.principal, auth.audience) }); return; }
        if (req.method !== 'POST') throw new WorkspaceError(405, 'Use POST for operations');
        if (!req.headers.authorization && req.headers.origin !== origin) throw new WorkspaceError(403, 'Same-origin session request required');
        const input = await body(req);
        if (typeof input.operation !== 'string' || !input.input || typeof input.input !== 'object' || Array.isArray(input.input)
          || Object.keys(input).some(key => !['operation', 'input'].includes(key))) throw new WorkspaceError(400, 'Expected {operation, input}');
        if (Buffer.byteLength(input.operation) > 128) throw new WorkspaceError(400, 'Operation name exceeds 128 bytes');
        const result = await workspace.execute(auth.principal, auth.audience, input.operation, input.input as Record<string, unknown>);
        send(res, 200, { result }); return;
      }
      if (url.pathname.startsWith('/api/')) throw new WorkspaceError(404, 'Endpoint not found');
      if (req.method !== 'GET' && req.method !== 'HEAD') throw new WorkspaceError(405, 'Method not allowed');
      const root = await realpath(options.webRoot);
      let pathname: string;
      try { pathname = decodeURIComponent(url.pathname); } catch { throw new WorkspaceError(400, 'Invalid path'); }
      const candidate = resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`);
      if (candidate !== root && !candidate.startsWith(root + sep)) throw new WorkspaceError(403, 'Invalid path');
      let path: string;
      try { path = await realpath(candidate); } catch { throw new WorkspaceError(404, 'File not found'); }
      if (!path.startsWith(root + sep)) throw new WorkspaceError(403, 'Invalid static path');
      const types: Record<string, string> = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.woff2': 'font/woff2' };
      if (!types[extname(path)]) throw new WorkspaceError(404, 'File not found');
      const content = await readFile(path);
      res.writeHead(200, { 'Content-Type': `${types[extname(path)]}; charset=utf-8`, 'Cache-Control': 'no-cache' });
      res.end(req.method === 'HEAD' ? undefined : content);
    })().catch(error => {
      if (!res.headersSent) send(res, error instanceof WorkspaceError ? error.status : 500, { error: { message: error instanceof WorkspaceError ? error.message : 'Internal request failure. Check local service diagnostics.' } });
      else res.destroy();
      if (!(error instanceof WorkspaceError)) console.error('Guardian request failed:', error instanceof Error ? error.name : 'unknown');
    });
  });
  server.requestTimeout = 30000; server.headersTimeout = 10000; server.maxHeadersCount = 50;
  await new Promise<void>((resolveListen, reject) => { server.once('error', reject); server.listen(options.port ?? 3000, '127.0.0.1', () => resolveListen()); });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Unable to resolve listener address');
  origin = `http://127.0.0.1:${address.port}`;
  return { server, origin, close: async () => {
    server.closeIdleConnections();
    await new Promise<void>((done, reject) => server.close(error => error ? reject(error) : done()));
    await workspace.close();
  } };
}
