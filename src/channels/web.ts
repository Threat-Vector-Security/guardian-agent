/**
 * Web channel adapter.
 *
 * Lightweight HTTP server using Node built-in http module.
 * REST API for agent communication + dashboard API + SSE + static file serving.
 *
 * Security:
 *   - Optional bearer token authentication with cookie-session custody when enabled
 *   - Configurable CORS origins (default: same-origin only; wildcard disallowed by config validation)
 *   - Request body size limit (default: 1 MB)
 *   - Path traversal protection for static files
 */

import { createServer, type Server, type IncomingMessage, type ServerResponse } from 'node:http';
import { createHmac, randomBytes, randomUUID } from 'node:crypto';
import { join, normalize, extname, resolve, relative, isAbsolute } from 'node:path';
import { readFile, readdir, stat } from 'node:fs/promises';
import { spawn as spawnPty, type IPty } from 'node-pty';
import type { ChannelAdapter, MessageCallback } from './types.js';
import type { DashboardCallbacks, SSEEvent, SSEListener, UIInvalidationEvent } from './web-types.js';
import { readBody, sendJSON } from './web-json.js';
import { handleWebChatRoutes } from './web-chat-routes.js';
import { handleWebControlRoutes } from './web-control-routes.js';
import { handleWebMonitoringRoutes } from './web-monitoring-routes.js';
import { handleWebRuntimeRoutes } from './web-runtime-routes.js';
import {
  getDefaultShellForPlatform,
  getPtyShellLaunch,
  getShellOptionsForPlatform,
} from './web-shell-launch.js';
import { createLogger } from '../util/logging.js';
import { timingSafeEqualString } from '../util/crypto-guardrails.js';
import type { AssistantConnectorPlaybookDefinition } from '../config/types.js';
import type { AutomationSaveInput } from '../runtime/automation-save.js';
import { buildHardenedEnv } from '../sandbox/index.js';
import {
  inspectCodeWorkspaceFileStructureSync,
  inspectCodeWorkspaceFileStructureTextSync,
} from '../runtime/code-workspace-structure.js';

const log = createLogger('channel:web');

/** Default maximum request body size: 1 MB. */
const DEFAULT_MAX_BODY_BYTES = 1_048_576;
const PRIVILEGED_TICKET_TTL_SECONDS = 300;
const PRIVILEGED_TICKET_MAX_REPLAY_TRACK = 2048;
const PRIVILEGED_TICKET_ISSUE_WINDOW_MS = 5 * 60_000;
const PRIVILEGED_TICKET_ISSUE_LIMIT = 3;
const AUTH_FAILURE_WINDOW_MS = 60_000;
const AUTH_FAILURE_LIMIT = 8;
const AUTH_BLOCK_DURATION_MS = 5 * 60_000;

/** MIME types for static file serving. */
const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.mjs': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

export type WebAuthMode = 'bearer_required' | 'disabled';
type PrivilegedTicketAction =
  | 'auth.config'
  | 'auth.rotate'
  | 'auth.reveal'
  | 'connectors.config'
  | 'connectors.pack'
  | 'connectors.playbook'
  | 'guardian.config'
  | 'policy.config'
  | 'tools.policy'
  | 'config.security'
  | 'memory.config'
  | 'search.pick-path'
  | 'killswitch'
  | 'factory-reset';

export interface WebAuthRuntimeConfig {
  mode: WebAuthMode;
  token?: string;
  tokenSource?: 'config' | 'env' | 'ephemeral';
  rotateOnStartup?: boolean;
  sessionTtlMinutes?: number;
}

export interface WebChannelOptions {
  /** Port to listen on. */
  port?: number;
  /** Host to bind to. */
  host?: string;
  /** Default agent to route messages to. */
  defaultAgent?: string;
  /** Bearer token for authentication when auth mode is bearer_required. */
  authToken?: string;
  /** Structured auth configuration. */
  auth?: WebAuthRuntimeConfig;
  /** Allowed CORS origins (default: none / same-origin). Wildcard origins are rejected by config validation. */
  allowedOrigins?: string[];
  /** Maximum request body size in bytes (default: 1 MB). */
  maxBodyBytes?: number;
  /** Directory to serve static frontend files from. */
  staticDir?: string;
  /** Dashboard API callbacks from runtime. */
  dashboard?: DashboardCallbacks;
}

/** Cookie-based session record for server-side token custody. */
interface CookieSession {
  sessionId: string;
  createdAt: number;
  expiresAt: number;
}

interface AuthFailureState {
  count: number;
  windowStartedAt: number;
  blockedUntil?: number;
}

interface TicketMintState {
  count: number;
  windowStartedAt: number;
}

const SESSION_COOKIE_NAME = 'guardianagent_sid';
const DEFAULT_SESSION_TTL_MINUTES = 480; // 8 hours
const SESSION_CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

interface TerminalSessionRecord {
  id: string;
  ownerSessionId: string | null;
  pty: IPty;
  shell: string;
  cwd: string;
  cols: number;
  rows: number;
  codeSessionId?: string | null;
}

type RequestErrorLike = Error & {
  statusCode?: number;
  errorCode?: string;
};

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

function trimOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function readSurfaceIdFromSearchParams(url: URL): string | undefined {
  return trimOptionalString(url.searchParams.get('surfaceId'));
}

function normalizeWebAuthMode(value: unknown): WebAuthMode {
  return value === 'disabled' ? 'disabled' : 'bearer_required';
}

function getRequestErrorDetails(err: unknown): { statusCode: number; error: string; errorCode?: string } | null {
  if (!(err instanceof Error)) return null;
  const requestError = err as RequestErrorLike;
  const statusCode = Number(requestError.statusCode);
  if (!Number.isFinite(statusCode) || statusCode < 400 || statusCode > 599) {
    return null;
  }
  return {
    statusCode,
    error: requestError.message || 'Request failed',
    ...(requestError.errorCode ? { errorCode: requestError.errorCode } : {}),
  };
}

function hasOwn(value: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function isPathWithinRoot(root: string, target: string): boolean {
  const normalizedRoot = resolve(root);
  const normalizedTarget = resolve(target);
  const rel = relative(normalizedRoot, normalizedTarget);
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel));
}

function resolveCodeSessionPath(root: string, requestedPath: string | undefined, fallbackRelative = '.'): string {
  const candidate = trimOptionalString(requestedPath) || fallbackRelative;
  const target = isAbsolute(candidate) ? resolve(candidate) : resolve(root, candidate);
  if (!isPathWithinRoot(root, target)) {
    throw new Error('Path must stay inside the coding session workspace.');
  }
  return target;
}

function toRelativeSessionPath(root: string, target: string): string {
  const normalizedRoot = resolve(root);
  const normalizedTarget = resolve(target);
  if (!isPathWithinRoot(normalizedRoot, normalizedTarget)) {
    throw new Error('Path must stay inside the coding session workspace.');
  }
  const rel = relative(normalizedRoot, normalizedTarget).replace(/\\/g, '/');
  return rel === '' ? '.' : rel;
}

export class WebChannel implements ChannelAdapter {
  readonly name = 'web';
  private server: Server | null = null;
  private onMessage: MessageCallback | null = null;
  private port: number;
  private host: string;
  private authMode: WebAuthMode;
  private authToken: string | undefined;
  private authTokenSource: 'config' | 'env' | 'ephemeral';
  private authRotateOnStartup: boolean;
  private authSessionTtlMinutes?: number;
  private allowedOrigins: string[];
  private maxBodyBytes: number;
  private staticDir: string | undefined;
  private dashboard: DashboardCallbacks;
  private sseClients: Set<ServerResponse> = new Set();
  private readonly terminalSessions = new Map<string, TerminalSessionRecord>();
  private readonly terminalOutputListeners = new Map<string, Set<(data: string) => void>>();
  private readonly terminalExitListeners = new Map<string, Set<(exitCode: number, signal: number) => void>>();
  private readonly privilegedTicketSecret = randomBytes(32);
  private readonly usedPrivilegedTicketNonces = new Map<string, number>();
  private readonly sessions = new Map<string, CookieSession>();
  private readonly authFailures = new Map<string, AuthFailureState>();
  private readonly ticketMintAttempts = new Map<string, TicketMintState>();
  private sessionCleanupTimer: ReturnType<typeof setInterval> | null = null;

  constructor(options: WebChannelOptions = {}) {
    this.port = options.port ?? 3000;
    this.host = options.host ?? 'localhost';
    const auth = options.auth;
    this.authMode = normalizeWebAuthMode(auth?.mode);
    if (auth?.mode && auth.mode !== this.authMode) {
      log.warn({ requestedMode: auth.mode, appliedMode: this.authMode }, 'Ignoring unsupported web auth mode');
    }
    this.authToken = auth?.token ?? options.authToken;
    this.authTokenSource = auth?.tokenSource ?? (options.authToken ? 'config' : 'ephemeral');
    this.authRotateOnStartup = auth?.rotateOnStartup ?? false;
    this.authSessionTtlMinutes = auth?.sessionTtlMinutes;
    this.allowedOrigins = options.allowedOrigins ?? [];
    this.maxBodyBytes = options.maxBodyBytes ?? DEFAULT_MAX_BODY_BYTES;
    this.staticDir = options.staticDir;
    this.dashboard = options.dashboard ?? {};
  }

  async start(onMessage: MessageCallback): Promise<void> {
    this.onMessage = onMessage;

    this.server = createServer(async (req, res) => {
      // CORS headers — restrict to configured origins
      const origin = req.headers.origin;
      if (origin && this.isOriginAllowed(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
      }
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Stream, X-Guardian-Ticket');
      res.setHeader('Access-Control-Allow-Credentials', 'true');

      if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
      }

      try {
        await this.handleRequest(req, res);
      } catch (err) {
        log.error({ err }, 'Unhandled request error');
        if (!res.headersSent) {
          sendJSON(res, 500, { error: 'Internal server error' });
        }
      }
    });

    // Start periodic session cleanup
    this.sessionCleanupTimer = setInterval(() => this.pruneExpiredSessions(), SESSION_CLEANUP_INTERVAL_MS);

    return new Promise((resolve, reject) => {
      this.server!.listen(this.port, this.host, () => {
        log.info({ port: this.port, host: this.host }, 'Web channel started');
        if (this.authMode === 'disabled') {
          log.warn(
            { port: this.port, host: this.host, authMode: this.authMode },
            'Web channel started WITHOUT bearer authentication. Only use this on trusted networks.',
          );
        } else if (!this.authToken) {
          log.warn(
            { port: this.port, host: this.host, authMode: this.authMode },
            'Web channel started WITHOUT strict bearer authentication.',
          );
        }
        resolve();
      });
      this.server!.on('error', reject);
    });
  }

  async stop(): Promise<void> {
    // Stop session cleanup
    if (this.sessionCleanupTimer) {
      clearInterval(this.sessionCleanupTimer);
      this.sessionCleanupTimer = null;
    }
    this.sessions.clear();
    this.authFailures.clear();
    this.ticketMintAttempts.clear();

    // Close all SSE connections
    for (const client of this.sseClients) {
      client.end();
    }
    this.sseClients.clear();
    for (const session of this.terminalSessions.values()) {
      try {
        session.pty.kill();
      } catch {
        // Best effort cleanup.
      }
    }
    this.terminalSessions.clear();

    return new Promise((resolve) => {
      if (this.server) {
        // Stop accepting new connections
        this.server.close(() => {
          this.server = null;
          this.onMessage = null;
          log.info('Web channel stopped');
          resolve();
        });

        // Force-close all connections so server.close() resolves immediately.
        // closeAllConnections (Node 18.2+) destroys active sockets;
        // closeIdleConnections is a fallback for idle keep-alive sockets.
        const s = this.server as Server & {
          closeAllConnections?: () => void;
          closeIdleConnections?: () => void;
        };
        s.closeAllConnections?.() ?? s.closeIdleConnections?.();
      } else {
        resolve();
      }
    });
  }

  async send(_userId: string, text: string): Promise<void> {
    if (!text.trim()) return;
    this.emitSSE({
      type: 'assistant.notice',
      data: {
        id: randomUUID(),
        timestamp: Date.now(),
        text,
      },
    });
  }

  /** Returns a CodingBackendTerminalControl implementation for programmatic terminal access. */
  getCodingBackendTerminalControl(): import('./web-types.js').CodingBackendTerminalControl {
    return {
      openTerminal: async (params) => {
        const terminalId = randomUUID();
        const { codeSessionId, shell, cwd, cols = 120, rows = 30 } = params;
        const shellType = shell || (process.platform === 'win32' ? 'wsl' : 'bash');
        const launch = getPtyShellLaunch(shellType, process.platform, cwd);
        const ptyCwd = launch.cwd === null ? undefined : (launch.cwd || cwd || process.cwd());
        const pty = spawnPty(launch.file, launch.args, {
          name: 'xterm-color',
          cols,
          rows,
          cwd: ptyCwd,
          env: buildHardenedEnv({ ...process.env, ...launch.env }),
        });
        const session: TerminalSessionRecord = {
          id: terminalId,
          ownerSessionId: null,
          pty,
          shell: shellType,
          cwd: cwd || process.cwd(),
          cols,
          rows,
          codeSessionId: codeSessionId || null,
        };
        this.terminalSessions.set(terminalId, session);
        this.dashboard.onCodeTerminalEvent?.({
          action: 'opened',
          terminalId,
          shell: session.shell,
          cwd: session.cwd,
          cols: session.cols,
          rows: session.rows,
          codeSessionId: session.codeSessionId ?? null,
        });
        pty.onData((data) => {
          this.emitSSE({ type: 'terminal.output', data: { terminalId, data } });
          const listeners = this.terminalOutputListeners.get(terminalId);
          if (listeners) {
            for (const cb of listeners) { try { cb(data); } catch { /* listener error */ } }
          }
        });
        pty.onExit((event) => {
          const exitListeners = this.terminalExitListeners.get(terminalId);
          if (exitListeners) {
            for (const cb of exitListeners) { try { cb(event.exitCode ?? 1, event.signal ?? 0); } catch { /* listener error */ } }
            this.terminalExitListeners.delete(terminalId);
          }
          this.terminalOutputListeners.delete(terminalId);
          this.terminalSessions.delete(terminalId);
          this.dashboard.onCodeTerminalEvent?.({
            action: 'exited',
            terminalId,
            shell: session.shell,
            cwd: session.cwd,
            cols: session.cols,
            rows: session.rows,
            codeSessionId: session.codeSessionId ?? null,
            exitCode: event.exitCode,
            signal: event.signal,
          });
          this.emitSSE({ type: 'terminal.exit', data: { terminalId, exitCode: event.exitCode, signal: event.signal } });
        });
        return { terminalId };
      },
      writeTerminalInput: (terminalId, input) => {
        const session = this.terminalSessions.get(terminalId);
        if (session) session.pty.write(input);
      },
      closeTerminal: (terminalId) => {
        const session = this.terminalSessions.get(terminalId);
        if (session) session.pty.kill();
      },
      onTerminalOutput: (terminalId, cb) => {
        let set = this.terminalOutputListeners.get(terminalId);
        if (!set) { set = new Set(); this.terminalOutputListeners.set(terminalId, set); }
        set.add(cb);
        return () => { set!.delete(cb); };
      },
      onTerminalExit: (terminalId, cb) => {
        let set = this.terminalExitListeners.get(terminalId);
        if (!set) { set = new Set(); this.terminalExitListeners.set(terminalId, set); }
        set.add(cb);
        return () => { set!.delete(cb); };
      },
    };
  }

  private emitSSE(event: SSEEvent): void {
    if (this.sseClients.size === 0) {
      return;
    }
    const payload = `event: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`;
    for (const client of this.sseClients) {
      if (!client.destroyed) {
        client.write(payload);
      }
    }
  }

  private emitUIInvalidation(topics: string[], reason: string, path: string): void {
    const deduped = uniqueTopics(topics);
    if (deduped.length === 0) {
      return;
    }
    const event: UIInvalidationEvent = {
      topics: deduped,
      reason,
      path,
      timestamp: Date.now(),
    };
    this.emitSSE({ type: 'ui.invalidate', data: event });
  }

  private maybeEmitUIInvalidation(result: unknown, topics: string[], reason: string, path: string): void {
    if (!isSuccessfulMutationResult(result)) {
      return;
    }
    this.emitUIInvalidation(topics, reason, path);
  }

  /** Check if a request origin is in the allowed list. */
  private isOriginAllowed(origin: string): boolean {
    if (this.allowedOrigins.length === 0) return false;
    if (this.allowedOrigins.includes('*')) return true;
    return this.allowedOrigins.includes(origin);
  }

  private getClientAddress(req: IncomingMessage): string {
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string' && forwarded.trim()) {
      return forwarded.split(',')[0].trim();
    }
    return req.socket.remoteAddress ?? 'unknown';
  }

  private clearAuthFailures(req: IncomingMessage): void {
    this.authFailures.delete(this.getClientAddress(req));
  }

  private getAuthBlockRemainingMs(req: IncomingMessage): number {
    const state = this.authFailures.get(this.getClientAddress(req));
    const blockedUntil = state?.blockedUntil ?? 0;
    return Math.max(0, blockedUntil - Date.now());
  }

  private recordAuthFailure(req: IncomingMessage): number {
    const key = this.getClientAddress(req);
    const now = Date.now();
    const existing = this.authFailures.get(key);
    let next: AuthFailureState;

    if (!existing || now - existing.windowStartedAt >= AUTH_FAILURE_WINDOW_MS) {
      next = { count: 1, windowStartedAt: now };
    } else {
      next = { ...existing, count: existing.count + 1 };
    }

    if (next.count >= AUTH_FAILURE_LIMIT) {
      next.blockedUntil = now + AUTH_BLOCK_DURATION_MS;
    }

    this.authFailures.set(key, next);
    return Math.max(0, (next.blockedUntil ?? 0) - now);
  }

  private sendAuthBlocked(res: ServerResponse, retryAfterMs: number): false {
    const retryAfterSeconds = Math.max(1, Math.ceil(retryAfterMs / 1000));
    res.setHeader('Retry-After', String(retryAfterSeconds));
    sendJSON(res, 429, { error: 'Too many authentication failures. Try again later.' });
    return false;
  }

  private rejectAuth(req: IncomingMessage, res: ServerResponse, invalidToken: boolean): false {
    const remainingMs = this.getAuthBlockRemainingMs(req);
    if (remainingMs > 0) {
      return this.sendAuthBlocked(res, remainingMs);
    }

    const blockMs = this.recordAuthFailure(req);
    if (blockMs > 0) {
      log.warn({ client: this.getClientAddress(req) }, 'Web auth temporarily blocked after repeated failures');
      return this.sendAuthBlocked(res, blockMs);
    }

    sendJSON(res, invalidToken ? 403 : 401, { error: invalidToken ? 'Invalid token' : 'Authentication required' });
    return false;
  }

  private recordPrivilegedTicketMint(req: IncomingMessage): number {
    const key = this.getClientAddress(req);
    const now = Date.now();
    const existing = this.ticketMintAttempts.get(key);
    let next: TicketMintState;

    if (!existing || now - existing.windowStartedAt >= PRIVILEGED_TICKET_ISSUE_WINDOW_MS) {
      next = { count: 1, windowStartedAt: now };
    } else {
      next = { ...existing, count: existing.count + 1 };
    }

    this.ticketMintAttempts.set(key, next);
    if (next.count <= PRIVILEGED_TICKET_ISSUE_LIMIT) {
      return 0;
    }
    return Math.max(0, (next.windowStartedAt + PRIVILEGED_TICKET_ISSUE_WINDOW_MS) - now);
  }

  private sendPrivilegedTicketRateLimited(res: ServerResponse, retryAfterMs: number): void {
    const retryAfterSeconds = Math.max(1, Math.ceil(retryAfterMs / 1000));
    res.setHeader('Retry-After', String(retryAfterSeconds));
    sendJSON(res, 429, { error: 'Too many privileged ticket requests. Try again later.' });
  }

  private hasNestedPath(value: unknown, path: readonly string[]): boolean {
    if (path.length === 0) return true;
    const record = asRecord(value);
    if (!record) return false;
    const [head, ...rest] = path;
    if (!hasOwn(record, head)) return false;
    return rest.length === 0
      ? true
      : this.hasNestedPath(record[head], rest);
  }

  private getConfigPrivilegedAction(value: unknown): PrivilegedTicketAction | null {
    const touchesSecurity = this.hasNestedPath(value, ['guardian'])
      || this.hasNestedPath(value, ['assistant', 'security'])
      || this.hasNestedPath(value, ['assistant', 'tools', 'policyMode'])
      || this.hasNestedPath(value, ['assistant', 'tools', 'toolPolicies']);
    if (touchesSecurity) {
      return 'config.security';
    }

    const touchesMemory = this.hasNestedPath(value, ['assistant', 'memory', 'knowledgeBase'])
      || this.hasNestedPath(value, ['assistant', 'memory', 'semanticSearch'])
      || this.hasNestedPath(value, ['assistant', 'memory', 'knowledgeBase', 'semanticSearch']);
    return touchesMemory ? 'memory.config' : null;
  }

  setAuthConfig(auth: WebAuthRuntimeConfig): void {
    this.authMode = normalizeWebAuthMode(auth.mode);
    if (auth.mode !== this.authMode) {
      log.warn({ requestedMode: auth.mode, appliedMode: this.authMode }, 'Ignoring unsupported web auth mode update');
    }
    this.authToken = auth.token?.trim() || undefined;
    this.authTokenSource = auth.tokenSource ?? this.authTokenSource;
    this.authRotateOnStartup = auth.rotateOnStartup ?? this.authRotateOnStartup;
    this.authSessionTtlMinutes = auth.sessionTtlMinutes;
  }

  getAuthStatus(): {
    mode: WebAuthMode;
    tokenConfigured: boolean;
    tokenSource: 'config' | 'env' | 'ephemeral';
    tokenPreview?: string;
    rotateOnStartup: boolean;
    sessionTtlMinutes?: number;
    host: string;
    port: number;
  } {
    return {
      mode: this.authMode,
      tokenConfigured: !!this.authToken,
      tokenSource: this.authTokenSource,
      tokenPreview: this.authToken ? previewToken(this.authToken) : undefined,
      rotateOnStartup: this.authRotateOnStartup,
      sessionTtlMinutes: this.authSessionTtlMinutes,
      host: this.host,
      port: this.port,
    };
  }

  getAuthToken(): string | undefined {
    return this.authToken;
  }

  private shouldRequireAuth(req: IncomingMessage): boolean {
    void req;
    return this.authMode === 'bearer_required';
  }

  /** Parse a cookie value from the request. */
  private parseCookie(req: IncomingMessage, name: string): string | undefined {
    const header = req.headers.cookie;
    if (!header) return undefined;
    for (const part of header.split(';')) {
      const [k, ...rest] = part.trim().split('=');
      if (k === name) return rest.join('=');
    }
    return undefined;
  }

  /** Validate a session cookie. Returns true if valid and not expired. */
  private validateSessionCookie(req: IncomingMessage): boolean {
    const sid = this.parseCookie(req, SESSION_COOKIE_NAME);
    if (!sid) return false;
    const session = this.sessions.get(sid);
    if (!session) return false;
    if (Date.now() > session.expiresAt) {
      this.sessions.delete(sid);
      return false;
    }
    return true;
  }

  /** Prune expired sessions. */
  private pruneExpiredSessions(): void {
    const now = Date.now();
    for (const [sid, session] of this.sessions) {
      if (now > session.expiresAt) {
        this.sessions.delete(sid);
      }
    }
  }

  /** Verify bearer token authentication. Returns true if auth passes. */
  private checkAuth(req: IncomingMessage, res: ServerResponse): boolean {
    if (!this.shouldRequireAuth(req)) return true;
    if (!this.authToken) {
      sendJSON(res, 401, { error: 'Authentication required' });
      return false;
    }

    // Try bearer token first
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      if (timingSafeEqualString(this.authToken, token)) {
        this.clearAuthFailures(req);
        return true;
      }
    }

    // Then try session cookie
    if (this.validateSessionCookie(req)) {
      this.clearAuthFailures(req);
      return true;
    }

    return this.rejectAuth(req, res, !!authHeader);
  }

  private resolveRequestPrincipal(req: IncomingMessage): { principalId: string; principalRole: import('../tools/types.js').PrincipalRole } {
    const sid = this.parseCookie(req, SESSION_COOKIE_NAME);
    if (sid && this.sessions.has(sid)) {
      return { principalId: `web-session:${sid}`, principalRole: 'owner' };
    }
    if (this.authMode === 'disabled') {
      return { principalId: 'web-open', principalRole: 'owner' };
    }
    return { principalId: 'web-bearer', principalRole: 'owner' };
  }

  /** Check auth for SSE via bearer header (non-browser clients) or session cookie (browser EventSource). */
  private checkAuthForSSE(req: IncomingMessage, _url: URL, res: ServerResponse): boolean {
    if (!this.shouldRequireAuth(req)) return true;
    if (!this.authToken) {
      sendJSON(res, 401, { error: 'Authentication required' });
      return false;
    }

    // Allow bearer header for non-browser SSE clients
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      if (timingSafeEqualString(this.authToken, token)) {
        this.clearAuthFailures(req);
        return true;
      }
    }

    // Browser EventSource path: authenticated cookie session.
    if (this.validateSessionCookie(req)) {
      this.clearAuthFailures(req);
      return true;
    }

    const remainingMs = this.getAuthBlockRemainingMs(req);
    if (remainingMs > 0) {
      return this.sendAuthBlocked(res, remainingMs);
    }

    const blockMs = this.recordAuthFailure(req);
    if (blockMs > 0) {
      log.warn({ client: this.getClientAddress(req) }, 'Web auth temporarily blocked after repeated SSE failures');
      return this.sendAuthBlocked(res, blockMs);
    }

    if (authHeader) {
      sendJSON(res, 403, { error: 'Invalid token' });
    } else {
      sendJSON(res, 401, {
        error: 'Authentication required. SSE requires an authenticated session cookie or Authorization header.',
      });
    }
    return false;
  }

  private isPrivilegedTicketAction(value: string): value is PrivilegedTicketAction {
    return value === 'auth.config'
      || value === 'auth.rotate'
      || value === 'auth.reveal'
      || value === 'connectors.config'
      || value === 'connectors.pack'
      || value === 'connectors.playbook'
      || value === 'guardian.config'
      || value === 'policy.config'
      || value === 'tools.policy'
      || value === 'config.security'
      || value === 'memory.config'
      || value === 'search.pick-path'
      || value === 'killswitch'
      || value === 'factory-reset';
  }

  private mintPrivilegedTicket(action: PrivilegedTicketAction): string {
    const ts = Math.floor(Date.now() / 1000);
    const nonce = randomBytes(16).toString('hex');
    const payload = `${action}|${ts}|${nonce}`;
    const signature = createHmac('sha256', this.privilegedTicketSecret).update(payload).digest('hex');
    return Buffer.from(`${payload}|${signature}`, 'utf8').toString('base64url');
  }

  private pruneTicketReplayCache(nowSec: number): void {
    const nowMs = nowSec * 1000;
    for (const [nonce, expiresAt] of this.usedPrivilegedTicketNonces) {
      if (expiresAt <= nowMs) {
        this.usedPrivilegedTicketNonces.delete(nonce);
      }
    }
    while (this.usedPrivilegedTicketNonces.size > PRIVILEGED_TICKET_MAX_REPLAY_TRACK) {
      const first = this.usedPrivilegedTicketNonces.keys().next();
      if (first.done) break;
      this.usedPrivilegedTicketNonces.delete(first.value);
    }
  }

  private verifyPrivilegedTicket(
    ticket: string,
    expectedAction: PrivilegedTicketAction,
  ): { valid: boolean; error?: string } {
    let decoded = '';
    try {
      decoded = Buffer.from(ticket, 'base64url').toString('utf8');
    } catch {
      return { valid: false, error: 'Invalid privileged ticket encoding' };
    }

    const parts = decoded.split('|');
    if (parts.length !== 4) {
      return { valid: false, error: 'Invalid privileged ticket format' };
    }

    const [action, tsRaw, nonce, signature] = parts;
    if (action !== expectedAction) {
      return { valid: false, error: 'Privileged ticket action mismatch' };
    }
    if (!/^\d+$/.test(tsRaw)) {
      return { valid: false, error: 'Invalid privileged ticket timestamp' };
    }
    if (!/^[a-f0-9]{32}$/i.test(nonce)) {
      return { valid: false, error: 'Invalid privileged ticket nonce' };
    }
    if (!/^[a-f0-9]{64}$/i.test(signature)) {
      return { valid: false, error: 'Invalid privileged ticket signature' };
    }

    const issuedAtSec = Number.parseInt(tsRaw, 10);
    const nowSec = Math.floor(Date.now() / 1000);
    if (!Number.isFinite(issuedAtSec) || Math.abs(nowSec - issuedAtSec) > PRIVILEGED_TICKET_TTL_SECONDS) {
      return { valid: false, error: 'Privileged ticket expired' };
    }

    this.pruneTicketReplayCache(nowSec);
    if (this.usedPrivilegedTicketNonces.has(nonce)) {
      return { valid: false, error: 'Privileged ticket replay detected' };
    }

    const payload = `${action}|${tsRaw}|${nonce}`;
    const expectedSignature = createHmac('sha256', this.privilegedTicketSecret).update(payload).digest('hex');
    if (!timingSafeEqualString(expectedSignature, signature)) {
      return { valid: false, error: 'Invalid privileged ticket signature' };
    }

    this.usedPrivilegedTicketNonces.set(
      nonce,
      (nowSec + PRIVILEGED_TICKET_TTL_SECONDS) * 1000,
    );
    return { valid: true };
  }

  private getPrivilegedTicket(req: IncomingMessage, url: URL, bodyTicket?: string): string | undefined {
    if (bodyTicket?.trim()) return bodyTicket.trim();
    const header = req.headers['x-guardian-ticket'];
    if (typeof header === 'string' && header.trim()) return header.trim();
    const queryTicket = url.searchParams.get('ticket');
    if (queryTicket?.trim()) return queryTicket.trim();
    return undefined;
  }

  private requirePrivilegedTicket(
    req: IncomingMessage,
    res: ServerResponse,
    url: URL,
    action: PrivilegedTicketAction,
    bodyTicket?: string,
  ): boolean {
    const ticket = this.getPrivilegedTicket(req, url, bodyTicket);
    if (!ticket) {
      sendJSON(res, 401, { error: 'Privileged ticket required' });
      return false;
    }
    const verify = this.verifyPrivilegedTicket(ticket, action);
    if (!verify.valid) {
      sendJSON(res, 403, { error: verify.error ?? 'Invalid privileged ticket' });
      return false;
    }
    return true;
  }

  private async handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const url = new URL(req.url ?? '/', `http://${this.host}:${this.port}`);

    // GET /health — Health check (no auth required)
    if (req.method === 'GET' && url.pathname === '/health') {
      sendJSON(res, 200, { status: 'ok', timestamp: Date.now() });
      return;
    }

    // ─── API + SSE routes (require auth) ───────────────────────

    if (url.pathname.startsWith('/api/') || url.pathname === '/sse') {
      // SSE uses cookie session auth (or bearer header for non-browser clients).
      if (url.pathname === '/sse') {
        if (!this.checkAuthForSSE(req, url, res)) return;
      } else {
        if (!this.checkAuth(req, res)) return;
      }

      // GET /api/status — Runtime status
      if (req.method === 'GET' && url.pathname === '/api/status') {
        sendJSON(res, 200, {
          status: 'running',
          timestamp: Date.now(),
          platform: process.platform,
          shellOptions: getShellOptionsForPlatform(process.platform),
        });
        return;
      }

      // POST /api/auth/session — create HttpOnly session cookie (usually exchanges bearer token for cookie)
      if (req.method === 'POST' && url.pathname === '/api/auth/session') {
        // At this point checkAuth already validated the request under the active auth mode.
        const ttlMinutes = this.authSessionTtlMinutes ?? DEFAULT_SESSION_TTL_MINUTES;
        const now = Date.now();
        const sessionId = randomUUID();
        const session: CookieSession = {
          sessionId,
          createdAt: now,
          expiresAt: now + ttlMinutes * 60 * 1000,
        };
        this.sessions.set(sessionId, session);

        const isSecure = req.headers['x-forwarded-proto'] === 'https'
          || (req.socket as { encrypted?: boolean }).encrypted === true;
        const cookieFlags = `HttpOnly; SameSite=Strict; Path=/; Max-Age=${ttlMinutes * 60}${isSecure ? '; Secure' : ''}`;
        res.setHeader('Set-Cookie', `${SESSION_COOKIE_NAME}=${sessionId}; ${cookieFlags}`);
        sendJSON(res, 200, { success: true, expiresAt: session.expiresAt });
        return;
      }

      // DELETE /api/auth/session — destroy session cookie
      if (req.method === 'DELETE' && url.pathname === '/api/auth/session') {
        const sid = this.parseCookie(req, SESSION_COOKIE_NAME);
        if (sid) {
          this.sessions.delete(sid);
        }
        res.setHeader('Set-Cookie', `${SESSION_COOKIE_NAME}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0`);
        sendJSON(res, 200, { success: true });
        return;
      }

      if (await handleWebControlRoutes({
        req,
        res,
        url,
        maxBodyBytes: this.maxBodyBytes,
        dashboard: this.dashboard,
        resolveRequestPrincipal: (request) => this.resolveRequestPrincipal(request),
        maybeEmitUIInvalidation: (result, topics, reason, path) => this.maybeEmitUIInvalidation(result, topics, reason, path),
        requirePrivilegedTicket: (request, response, requestUrl, action, presented) =>
          this.requirePrivilegedTicket(request, response, requestUrl, action as PrivilegedTicketAction, presented),
        isPrivilegedTicketAction: (value) => this.isPrivilegedTicketAction(value),
        recordPrivilegedTicketMint: (request) => this.recordPrivilegedTicketMint(request),
        sendPrivilegedTicketRateLimited: (response, retryAfterMs) => this.sendPrivilegedTicketRateLimited(response, retryAfterMs),
        mintPrivilegedTicket: (action) => this.mintPrivilegedTicket(action as PrivilegedTicketAction),
        privilegedTicketTtlSeconds: PRIVILEGED_TICKET_TTL_SECONDS,
      })) {
        return;
      }

      if (await handleWebMonitoringRoutes({
        req,
        res,
        url,
        maxBodyBytes: this.maxBodyBytes,
        dashboard: this.dashboard,
        maybeEmitUIInvalidation: (result, topics, reason, path) => this.maybeEmitUIInvalidation(result, topics, reason, path),
        emitUIInvalidation: (topics, reason, path) => this.emitUIInvalidation(topics, reason, path),
      })) {
        return;
      }

      if (await handleWebRuntimeRoutes({
        req,
        res,
        url,
        maxBodyBytes: this.maxBodyBytes,
        dashboard: this.dashboard,
        maybeEmitUIInvalidation: (result, topics, reason, path) => this.maybeEmitUIInvalidation(result, topics, reason, path),
        requirePrivilegedTicket: (request, response, requestUrl, action, presented) =>
          this.requirePrivilegedTicket(request, response, requestUrl, action, presented),
        getConfigPrivilegedAction: (parsed) => this.getConfigPrivilegedAction(parsed) ?? undefined,
        logInternalError,
      })) {
        return;
      }

      if (await handleWebChatRoutes({
        req,
        res,
        url,
        maxBodyBytes: this.maxBodyBytes,
        dashboard: this.dashboard,
        onMessage: this.onMessage,
        resolveRequestPrincipal: (request) => this.resolveRequestPrincipal(request),
        getRequestErrorDetails,
        logInternalError,
        maybeEmitUIInvalidation: (result, topics, reason, path) => this.maybeEmitUIInvalidation(result, topics, reason, path),
        emitSSE: (event) => {
          for (const client of this.sseClients) {
            if (!client.destroyed) {
              client.write(`event: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`);
            }
          }
        },
        generateMessageId: () => randomUUID(),
      })) {
        return;
      }

      // GET /sse — Server-Sent Events stream
      if (req.method === 'GET' && url.pathname === '/sse') {
        this.handleSSE(req, res);
        return;
      }

      // ─── Scheduled Tasks API ─────────────────────────────────

      // GET /api/automations/catalog — Unified saved automation catalog
      if (req.method === 'GET' && url.pathname === '/api/automations/catalog') {
        if (!this.dashboard.onAutomationCatalog) {
          sendJSON(res, 404, { error: 'Not available' });
          return;
        }
        sendJSON(res, 200, this.dashboard.onAutomationCatalog());
        return;
      }

      if (req.method === 'GET' && url.pathname === '/api/automations/history') {
        if (!this.dashboard.onAutomationRunHistory) {
          sendJSON(res, 404, { error: 'Not available' });
          return;
        }
        sendJSON(res, 200, this.dashboard.onAutomationRunHistory());
        return;
      }

      if (req.method === 'POST' && url.pathname === '/api/automations/save') {
        if (!this.dashboard.onAutomationSave) {
          sendJSON(res, 404, { error: 'Not available' });
          return;
        }
        let body = '{}';
        try {
          body = await readBody(req, this.maxBodyBytes);
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Bad request';
          sendJSON(res, 400, { error: message });
          return;
        }
        let parsed: AutomationSaveInput;
        try {
          parsed = body ? JSON.parse(body) as AutomationSaveInput : {} as AutomationSaveInput;
        } catch {
          sendJSON(res, 400, { error: 'Invalid JSON' });
          return;
        }
        const result = this.dashboard.onAutomationSave(parsed);
        sendJSON(res, 200, result);
        this.maybeEmitUIInvalidation(result, ['automations'], 'automation.saved', url.pathname);
        return;
      }

      if (req.method === 'POST' && url.pathname.match(/^\/api\/automations\/[^/]+\/definition$/)) {
        if (!this.dashboard.onAutomationDefinitionSave) {
          sendJSON(res, 404, { error: 'Not available' });
          return;
        }
        const automationId = decodeURIComponent(url.pathname.split('/')[3] || '').trim();
        if (!automationId) {
          sendJSON(res, 400, { error: 'automationId is required' });
          return;
        }
        let body = '{}';
        try {
          body = await readBody(req, this.maxBodyBytes);
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Bad request';
          sendJSON(res, 400, { error: message });
          return;
        }
        let parsed: AssistantConnectorPlaybookDefinition;
        try {
          parsed = body ? JSON.parse(body) as AssistantConnectorPlaybookDefinition : {} as AssistantConnectorPlaybookDefinition;
        } catch {
          sendJSON(res, 400, { error: 'Invalid JSON' });
          return;
        }
        const result = this.dashboard.onAutomationDefinitionSave(automationId, parsed);
        sendJSON(res, 200, result);
        this.maybeEmitUIInvalidation(result, ['automations'], 'automation.definition_saved', url.pathname);
        return;
      }

      if (req.method === 'POST' && url.pathname.match(/^\/api\/automations\/[^/]+\/create$/)) {
        if (!this.dashboard.onAutomationCreate) {
          sendJSON(res, 404, { error: 'Not available' });
          return;
        }
        const automationId = decodeURIComponent(url.pathname.split('/')[3] || '').trim();
        if (!automationId) {
          sendJSON(res, 400, { error: 'automationId is required' });
          return;
        }
        const result = this.dashboard.onAutomationCreate(automationId);
        sendJSON(res, 200, result);
        this.maybeEmitUIInvalidation(result, ['automations'], 'automation.created', url.pathname);
        return;
      }

      if (req.method === 'POST' && url.pathname.match(/^\/api\/automations\/[^/]+\/run$/)) {
        if (!this.dashboard.onAutomationRun) {
          sendJSON(res, 404, { error: 'Not available' });
          return;
        }
        const automationId = decodeURIComponent(url.pathname.split('/')[3] || '').trim();
        if (!automationId) {
          sendJSON(res, 400, { error: 'automationId is required' });
          return;
        }
        let body = '{}';
        try {
          body = await readBody(req, this.maxBodyBytes);
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Bad request';
          sendJSON(res, 400, { error: message });
          return;
        }
        let parsed: {
          dryRun?: boolean;
          origin?: 'assistant' | 'cli' | 'web';
          agentId?: string;
          userId?: string;
          channel?: string;
          requestedBy?: string;
        };
        try {
          parsed = body ? JSON.parse(body) as typeof parsed : {};
        } catch {
          sendJSON(res, 400, { error: 'Invalid JSON' });
          return;
        }
        const result = await this.dashboard.onAutomationRun({
          automationId,
          dryRun: parsed?.dryRun === true,
          origin: parsed?.origin,
          agentId: trimOptionalString(parsed?.agentId),
          userId: trimOptionalString(parsed?.userId),
          channel: trimOptionalString(parsed?.channel),
          requestedBy: trimOptionalString(parsed?.requestedBy),
        });
        sendJSON(res, 200, result);
        this.maybeEmitUIInvalidation(result, ['automations'], 'automation.run', url.pathname);
        return;
      }

      if (req.method === 'POST' && url.pathname.match(/^\/api\/automations\/[^/]+\/enabled$/)) {
        if (!this.dashboard.onAutomationSetEnabled) {
          sendJSON(res, 404, { error: 'Not available' });
          return;
        }
        const automationId = decodeURIComponent(url.pathname.split('/')[3] || '').trim();
        if (!automationId) {
          sendJSON(res, 400, { error: 'automationId is required' });
          return;
        }
        let body: string;
        try {
          body = await readBody(req, this.maxBodyBytes);
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Bad request';
          sendJSON(res, 400, { error: message });
          return;
        }
        let parsed: { enabled?: boolean };
        try {
          parsed = JSON.parse(body) as { enabled?: boolean };
        } catch {
          sendJSON(res, 400, { error: 'Invalid JSON' });
          return;
        }
        if (typeof parsed.enabled !== 'boolean') {
          sendJSON(res, 400, { error: 'enabled must be a boolean' });
          return;
        }
        const result = this.dashboard.onAutomationSetEnabled(automationId, parsed.enabled);
        sendJSON(res, 200, result);
        this.maybeEmitUIInvalidation(result, ['automations'], 'automation.enabled', url.pathname);
        return;
      }

      if (req.method === 'DELETE' && url.pathname.match(/^\/api\/automations\/[^/]+$/)) {
        if (!this.dashboard.onAutomationDelete) {
          sendJSON(res, 404, { error: 'Not available' });
          return;
        }
        const automationId = decodeURIComponent(url.pathname.split('/')[3] || '').trim();
        if (!automationId) {
          sendJSON(res, 400, { error: 'automationId is required' });
          return;
        }
        const result = this.dashboard.onAutomationDelete(automationId);
        sendJSON(res, 200, result);
        this.maybeEmitUIInvalidation(result, ['automations'], 'automation.deleted', url.pathname);
        return;
      }

      // GET /api/scheduled-tasks — List all scheduled tasks
      if (req.method === 'GET' && url.pathname === '/api/scheduled-tasks') {
        if (!this.dashboard.onScheduledTasks) {
          sendJSON(res, 404, { error: 'Not available' });
          return;
        }
        sendJSON(res, 200, this.dashboard.onScheduledTasks());
        return;
      }

      // GET /api/scheduled-tasks/history — Get run history
      if (req.method === 'GET' && url.pathname === '/api/scheduled-tasks/history') {
        if (!this.dashboard.onScheduledTaskHistory) {
          sendJSON(res, 404, { error: 'Not available' });
          return;
        }
        sendJSON(res, 200, this.dashboard.onScheduledTaskHistory());
        return;
      }

      // POST /api/scheduled-tasks/:id/run — Manually trigger a task now
      if (req.method === 'POST' && url.pathname.match(/^\/api\/scheduled-tasks\/[^/]+\/run$/)) {
        if (!this.dashboard.onScheduledTaskRunNow) {
          sendJSON(res, 404, { error: 'Not available' });
          return;
        }
        const parts = url.pathname.split('/');
        const id = decodeURIComponent(parts[3]);
        if (!id) {
          sendJSON(res, 400, { error: 'Task ID required' });
          return;
        }
        const result = await this.dashboard.onScheduledTaskRunNow(id);
        sendJSON(res, 200, result);
        this.maybeEmitUIInvalidation(result, ['automations', 'network', 'security'], 'scheduled-task.ran', url.pathname);
        return;
      }

      // POST /api/scheduled-tasks — Create new scheduled task
      if (req.method === 'POST' && url.pathname === '/api/scheduled-tasks') {
        if (!this.dashboard.onScheduledTaskCreate) {
          sendJSON(res, 404, { error: 'Not available' });
          return;
        }
        let body: string;
        try {
          body = await readBody(req, this.maxBodyBytes);
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Bad request';
          sendJSON(res, 400, { error: message });
          return;
        }
        let parsed: Record<string, unknown>;
        try {
          parsed = JSON.parse(body) as Record<string, unknown>;
        } catch {
          sendJSON(res, 400, { error: 'Invalid JSON' });
          return;
        }
        const principal = this.resolveRequestPrincipal(req);
        const result = this.dashboard.onScheduledTaskCreate(
          {
            ...parsed,
            principalId: principal.principalId,
            principalRole: principal.principalRole,
          } as unknown as Parameters<NonNullable<typeof this.dashboard.onScheduledTaskCreate>>[0],
        );
        sendJSON(res, 200, result);
        this.maybeEmitUIInvalidation(result, ['automations', 'network'], 'scheduled-task.created', url.pathname);
        return;
      }

      // PUT /api/scheduled-tasks/:id — Update existing task
      if (req.method === 'PUT' && url.pathname.startsWith('/api/scheduled-tasks/')) {
        if (!this.dashboard.onScheduledTaskUpdate) {
          sendJSON(res, 404, { error: 'Not available' });
          return;
        }
        const id = decodeURIComponent(url.pathname.slice('/api/scheduled-tasks/'.length));
        if (!id) {
          sendJSON(res, 400, { error: 'Task ID required' });
          return;
        }
        let body: string;
        try {
          body = await readBody(req, this.maxBodyBytes);
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Bad request';
          sendJSON(res, 400, { error: message });
          return;
        }
        let parsed: Record<string, unknown>;
        try {
          parsed = JSON.parse(body) as Record<string, unknown>;
        } catch {
          sendJSON(res, 400, { error: 'Invalid JSON' });
          return;
        }
        const principal = this.resolveRequestPrincipal(req);
        const result = this.dashboard.onScheduledTaskUpdate(
          id,
          {
            ...parsed,
            principalId: principal.principalId,
            principalRole: principal.principalRole,
          } as Parameters<NonNullable<typeof this.dashboard.onScheduledTaskUpdate>>[1],
        );
        sendJSON(res, 200, result);
        this.maybeEmitUIInvalidation(result, ['automations', 'network'], 'scheduled-task.updated', url.pathname);
        return;
      }

      // DELETE /api/scheduled-tasks/:id — Delete task
      if (req.method === 'DELETE' && url.pathname.startsWith('/api/scheduled-tasks/')) {
        if (!this.dashboard.onScheduledTaskDelete) {
          sendJSON(res, 404, { error: 'Not available' });
          return;
        }
        const id = decodeURIComponent(url.pathname.slice('/api/scheduled-tasks/'.length));
        if (!id) {
          sendJSON(res, 400, { error: 'Task ID required' });
          return;
        }
        const result = this.dashboard.onScheduledTaskDelete(id);
        sendJSON(res, 200, result);
        this.maybeEmitUIInvalidation(result, ['automations', 'network'], 'scheduled-task.deleted', url.pathname);
        return;
      }

      // GET /api/scheduled-tasks/:id — Get single task
      if (req.method === 'GET' && url.pathname.startsWith('/api/scheduled-tasks/')) {
        if (!this.dashboard.onScheduledTaskGet) {
          sendJSON(res, 404, { error: 'Not available' });
          return;
        }
        const id = decodeURIComponent(url.pathname.slice('/api/scheduled-tasks/'.length));
        if (!id) {
          sendJSON(res, 400, { error: 'Task ID required' });
          return;
        }
        const task = this.dashboard.onScheduledTaskGet(id);
        if (!task) {
          sendJSON(res, 404, { error: 'Task not found' });
          return;
        }
        sendJSON(res, 200, task);
        return;
      }

      // ─── Document Search Routes ──────────────────────────────

      // GET /api/search/status — Search engine status and indexed sources
      if (req.method === 'GET' && url.pathname === '/api/search/status') {
        if (!this.dashboard.onSearchStatus) {
          sendJSON(res, 404, { error: 'Not available' });
          return;
        }
        sendJSON(res, 200, await this.dashboard.onSearchStatus());
        return;
      }

      // GET /api/search/sources — List configured document sources
      if (req.method === 'GET' && url.pathname === '/api/search/sources') {
        if (!this.dashboard.onSearchSources) {
          sendJSON(res, 404, { error: 'Not available' });
          return;
        }
        sendJSON(res, 200, this.dashboard.onSearchSources());
        return;
      }

      // POST /api/search/sources — Add a new document source
      if (req.method === 'POST' && url.pathname === '/api/search/sources') {
        if (!this.dashboard.onSearchSourceAdd) {
          sendJSON(res, 404, { error: 'Not available' });
          return;
        }
        let body: string;
        try {
          body = await readBody(req, this.maxBodyBytes);
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Bad request';
          sendJSON(res, 400, { error: message });
          return;
        }
        let parsed: Record<string, unknown>;
        try {
          parsed = JSON.parse(body) as Record<string, unknown>;
        } catch {
          sendJSON(res, 400, { error: 'Invalid JSON' });
          return;
        }
        if (!parsed.id || !parsed.name || !parsed.path || !parsed.type) {
          sendJSON(res, 400, { error: 'id, name, path, and type are required' });
          return;
        }
        const result = this.dashboard.onSearchSourceAdd(
          parsed as unknown as Parameters<NonNullable<typeof this.dashboard.onSearchSourceAdd>>[0],
        );
        sendJSON(res, 200, result);
        this.maybeEmitUIInvalidation(result, ['config'], 'search.source.added', url.pathname);
        return;
      }

      // POST /api/search/pick-path — open local native picker for search source paths
      if (req.method === 'POST' && url.pathname === '/api/search/pick-path') {
        if (!this.dashboard.onSearchPickPath) {
          sendJSON(res, 404, { error: 'Not available' });
          return;
        }
        let body: string;
        try {
          body = await readBody(req, this.maxBodyBytes);
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Bad request';
          sendJSON(res, 400, { error: message });
          return;
        }
        let parsed: { kind?: 'directory' | 'file'; ticket?: string };
        try {
          parsed = JSON.parse(body) as { kind?: 'directory' | 'file'; ticket?: string };
        } catch {
          sendJSON(res, 400, { error: 'Invalid JSON' });
          return;
        }
        if (!this.requirePrivilegedTicket(req, res, url, 'search.pick-path', parsed.ticket)) {
          return;
        }
        if (parsed.kind !== 'directory' && parsed.kind !== 'file') {
          sendJSON(res, 400, { error: "kind must be 'directory' or 'file'" });
          return;
        }
        try {
          const result = await this.dashboard.onSearchPickPath({ kind: parsed.kind });
          sendJSON(res, 200, result);
        } catch (err) {
          logInternalError('Search path picker failed', err);
          sendJSON(res, 500, { error: 'Path picker failed' });
        }
        return;
      }

      // DELETE /api/search/sources/:id — Remove a document source
      if (req.method === 'DELETE' && url.pathname.startsWith('/api/search/sources/')) {
        if (!this.dashboard.onSearchSourceRemove) {
          sendJSON(res, 404, { error: 'Not available' });
          return;
        }
        const id = decodeURIComponent(url.pathname.slice('/api/search/sources/'.length));
        if (!id) {
          sendJSON(res, 400, { error: 'Source ID required' });
          return;
        }
        const result = this.dashboard.onSearchSourceRemove(id);
        sendJSON(res, 200, result);
        this.maybeEmitUIInvalidation(result, ['config'], 'search.source.removed', url.pathname);
        return;
      }

      // PATCH /api/search/sources/:id — Toggle source enabled/disabled
      if (req.method === 'PATCH' && url.pathname.startsWith('/api/search/sources/')) {
        if (!this.dashboard.onSearchSourceToggle) {
          sendJSON(res, 404, { error: 'Not available' });
          return;
        }
        const id = decodeURIComponent(url.pathname.slice('/api/search/sources/'.length));
        if (!id) {
          sendJSON(res, 400, { error: 'Source ID required' });
          return;
        }
        let body: string;
        try {
          body = await readBody(req, this.maxBodyBytes);
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Bad request';
          sendJSON(res, 400, { error: message });
          return;
        }
        let parsed: { enabled?: boolean };
        try {
          parsed = JSON.parse(body) as { enabled?: boolean };
        } catch {
          sendJSON(res, 400, { error: 'Invalid JSON' });
          return;
        }
        if (typeof parsed.enabled !== 'boolean') {
          sendJSON(res, 400, { error: 'enabled (boolean) is required' });
          return;
        }
        const result = this.dashboard.onSearchSourceToggle(id, parsed.enabled);
        sendJSON(res, 200, result);
        this.maybeEmitUIInvalidation(result, ['config'], 'search.source.toggled', url.pathname);
        return;
      }

      // POST /api/search/reindex — Trigger reindex of document sources
      if (req.method === 'POST' && url.pathname === '/api/search/reindex') {
        if (!this.dashboard.onSearchReindex) {
          sendJSON(res, 404, { error: 'Not available' });
          return;
        }
        let collection: string | undefined;
        try {
          const body = await readBody(req, this.maxBodyBytes);
          if (body.trim()) {
            const parsed = JSON.parse(body) as { collection?: string };
            collection = parsed.collection;
          }
        } catch {
          // No body or invalid JSON — reindex all
        }
        const result = await this.dashboard.onSearchReindex(collection);
        sendJSON(res, 200, result);
        this.maybeEmitUIInvalidation(result, ['config'], 'search.reindex.started', url.pathname);
        return;
      }

      // GET /api/gws/status — Google Workspace connection status
      if (req.method === 'GET' && url.pathname === '/api/gws/status') {
        if (!this.dashboard.onGwsStatus) {
          sendJSON(res, 404, { error: 'Not available' });
          return;
        }
        sendJSON(res, 200, await this.dashboard.onGwsStatus());
        return;
      }

      // POST /api/gws/reauth — Trigger Google Workspace re-authentication
      if (req.method === 'POST' && url.pathname === '/api/gws/reauth') {
        try {
          const { execFile } = await import('node:child_process');
          const gwsCmd = 'gws';
          const child = execFile(gwsCmd, ['auth', 'login'], {
            shell: process.platform === 'win32',
            timeout: 120_000,
          } as any);
          let stdout = '';
          let stderr = '';
          child.stdout?.on('data', (data: Buffer) => { stdout += data.toString(); });
          child.stderr?.on('data', (data: Buffer) => { stderr += data.toString(); });
          const exitCode = await new Promise<number>((resolve) => {
            child.on('close', (code) => resolve(code ?? 1));
            child.on('error', () => resolve(1));
          });
          if (exitCode === 0) {
            sendJSON(res, 200, { success: true, message: 'Authentication successful. Refresh status to verify.' });
          } else {
            sendJSON(res, 200, { success: false, message: `Authentication flow exited with code ${exitCode}. Check the browser window that opened.`, detail: stderr || stdout });
          }
        } catch (err) {
          sendJSON(res, 500, { success: false, message: err instanceof Error ? err.message : 'Failed to start auth flow' });
        }
        return;
      }

      // ── Native Google integration routes ───────────────────
      // GET /api/google/status — Native Google auth status
      if (req.method === 'GET' && url.pathname === '/api/google/status') {
        if (!this.dashboard.onGoogleStatus) {
          sendJSON(res, 404, { error: 'Not available' });
          return;
        }
        sendJSON(res, 200, await this.dashboard.onGoogleStatus());
        return;
      }

      // POST /api/google/auth/start — Start native OAuth flow
      if (req.method === 'POST' && url.pathname === '/api/google/auth/start') {
        if (!this.dashboard.onGoogleAuthStart) {
          sendJSON(res, 404, { error: 'Native Google integration not enabled' });
          return;
        }
        const body = await readBody(req, this.maxBodyBytes);
        const parsed = JSON.parse(body || '{}') as { services?: string[] };
        sendJSON(res, 200, await this.dashboard.onGoogleAuthStart(parsed.services ?? []));
        return;
      }

      // POST /api/google/credentials — Upload client_secret.json
      if (req.method === 'POST' && url.pathname === '/api/google/credentials') {
        if (!this.dashboard.onGoogleCredentials) {
          sendJSON(res, 404, { error: 'Native Google integration not enabled' });
          return;
        }
        const body = await readBody(req, this.maxBodyBytes);
        const parsed = JSON.parse(body || '{}') as { credentials?: string };
        if (!parsed.credentials) {
          sendJSON(res, 400, { success: false, message: 'Missing credentials field.' });
          return;
        }
        sendJSON(res, 200, await this.dashboard.onGoogleCredentials(parsed.credentials));
        return;
      }

      // POST /api/google/disconnect — Revoke and clear tokens
      if (req.method === 'POST' && url.pathname === '/api/google/disconnect') {
        if (!this.dashboard.onGoogleDisconnect) {
          sendJSON(res, 404, { error: 'Native Google integration not enabled' });
          return;
        }
        sendJSON(res, 200, await this.dashboard.onGoogleDisconnect());
        return;
      }

      // ── Native Microsoft 365 integration routes ─────────────
      // GET /api/microsoft/status — Native Microsoft auth status
      if (req.method === 'GET' && url.pathname === '/api/microsoft/status') {
        if (!this.dashboard.onMicrosoftStatus) {
          sendJSON(res, 404, { error: 'Not available' });
          return;
        }
        sendJSON(res, 200, await this.dashboard.onMicrosoftStatus());
        return;
      }

      // POST /api/microsoft/auth/start — Start native Microsoft OAuth flow
      if (req.method === 'POST' && url.pathname === '/api/microsoft/auth/start') {
        if (!this.dashboard.onMicrosoftAuthStart) {
          sendJSON(res, 404, { error: 'Native Microsoft integration not enabled' });
          return;
        }
        const body = await readBody(req, this.maxBodyBytes);
        const parsed = JSON.parse(body || '{}') as { services?: string[] };
        sendJSON(res, 200, await this.dashboard.onMicrosoftAuthStart(parsed.services ?? []));
        return;
      }

      // POST /api/microsoft/config — Save client ID / tenant ID
      if (req.method === 'POST' && url.pathname === '/api/microsoft/config') {
        if (!this.dashboard.onMicrosoftConfig) {
          sendJSON(res, 404, { error: 'Native Microsoft integration not enabled' });
          return;
        }
        const body = await readBody(req, this.maxBodyBytes);
        const parsed = JSON.parse(body || '{}') as { clientId?: string; tenantId?: string };
        if (!parsed.clientId) {
          sendJSON(res, 400, { success: false, message: 'Missing clientId field.' });
          return;
        }
        sendJSON(res, 200, await this.dashboard.onMicrosoftConfig({ clientId: parsed.clientId, tenantId: parsed.tenantId }));
        return;
      }

      // POST /api/microsoft/disconnect — Clear tokens
      if (req.method === 'POST' && url.pathname === '/api/microsoft/disconnect') {
        if (!this.dashboard.onMicrosoftDisconnect) {
          sendJSON(res, 404, { error: 'Native Microsoft integration not enabled' });
          return;
        }
        sendJSON(res, 200, await this.dashboard.onMicrosoftDisconnect());
        return;
      }

      // GET /api/guardian-agent/status — Guardian Agent inline evaluation status
      if (req.method === 'GET' && url.pathname === '/api/guardian-agent/status') {
        if (!this.dashboard.onGuardianAgentStatus) {
          sendJSON(res, 404, { error: 'Not available' });
          return;
        }
        sendJSON(res, 200, this.dashboard.onGuardianAgentStatus());
        return;
      }

      // POST /api/guardian-agent/config — Update Guardian Agent settings
      if (req.method === 'POST' && url.pathname === '/api/guardian-agent/config') {
        if (!this.dashboard.onGuardianAgentUpdate) {
          sendJSON(res, 404, { error: 'Not available' });
          return;
        }
        const body = await readBody(req, this.maxBodyBytes);
        const input = JSON.parse(body) as {
          enabled?: boolean;
          llmProvider?: 'local' | 'external' | 'auto';
          failOpen?: boolean;
          timeoutMs?: number;
          ticket?: string;
        };
        if (!this.requirePrivilegedTicket(req, res, url, 'guardian.config', input.ticket)) {
          return;
        }
        const result = this.dashboard.onGuardianAgentUpdate(input);
        sendJSON(res, result.success ? 200 : (result.statusCode ?? 400), result);
        this.maybeEmitUIInvalidation(result, ['config', 'security'], 'guardian-agent.updated', url.pathname);
        return;
      }

      // GET /api/policy/status — Policy-as-Code engine status
      if (req.method === 'GET' && url.pathname === '/api/policy/status') {
        if (!this.dashboard.onPolicyStatus) {
          sendJSON(res, 404, { error: 'Not available' });
          return;
        }
        sendJSON(res, 200, this.dashboard.onPolicyStatus());
        return;
      }

      // POST /api/policy/config — Update Policy-as-Code engine config
      if (req.method === 'POST' && url.pathname === '/api/policy/config') {
        if (!this.dashboard.onPolicyUpdate) {
          sendJSON(res, 404, { error: 'Not available' });
          return;
        }
        const body = await readBody(req, this.maxBodyBytes);
        const input = JSON.parse(body) as {
          enabled?: boolean;
          mode?: 'off' | 'shadow' | 'enforce';
          families?: {
            tool?: 'off' | 'shadow' | 'enforce';
            admin?: 'off' | 'shadow' | 'enforce';
            guardian?: 'off' | 'shadow' | 'enforce';
            event?: 'off' | 'shadow' | 'enforce';
          };
          mismatchLogLimit?: number;
          ticket?: string;
        };
        if (!this.requirePrivilegedTicket(req, res, url, 'policy.config', input.ticket)) {
          return;
        }
        const result = this.dashboard.onPolicyUpdate(input);
        sendJSON(res, result.success ? 200 : (result.statusCode ?? 400), result);
        this.maybeEmitUIInvalidation(result, ['config', 'security'], 'policy.config.updated', url.pathname);
        return;
      }

      // POST /api/policy/reload — Reload policy rules from disk
      if (req.method === 'POST' && url.pathname === '/api/policy/reload') {
        if (!this.dashboard.onPolicyReload) {
          sendJSON(res, 404, { error: 'Not available' });
          return;
        }
        let parsed: { ticket?: string } = {};
        try {
          const body = await readBody(req, this.maxBodyBytes);
          if (body.trim()) {
            parsed = JSON.parse(body) as { ticket?: string };
          }
        } catch {
          sendJSON(res, 400, { error: 'Invalid JSON' });
          return;
        }
        if (!this.requirePrivilegedTicket(req, res, url, 'policy.config', parsed.ticket)) {
          return;
        }
        const result = this.dashboard.onPolicyReload();
        sendJSON(res, 200, result);
        this.maybeEmitUIInvalidation(result, ['config', 'security'], 'policy.reloaded', url.pathname);
        return;
      }

      // POST /api/sentinel/audit — Run Sentinel audit on-demand
      if (req.method === 'POST' && url.pathname === '/api/sentinel/audit') {
        if (!this.dashboard.onSentinelAuditRun) {
          sendJSON(res, 404, { error: 'Not available' });
          return;
        }
        let windowMs: number | undefined;
        try {
          const body = await readBody(req, this.maxBodyBytes);
          if (body) {
            const parsed = JSON.parse(body) as { windowMs?: number };
            windowMs = parsed.windowMs;
          }
        } catch { /* empty body is fine */ }
        const result = await this.dashboard.onSentinelAuditRun(windowMs);
        sendJSON(res, 200, result);
        this.maybeEmitUIInvalidation(result, ['security'], 'sentinel.audit.completed', url.pathname);
        return;
      }

      // POST /api/factory-reset — Bulk reset data, config, or both
      if (req.method === 'POST' && url.pathname === '/api/factory-reset') {
        if (!this.dashboard.onFactoryReset) {
          sendJSON(res, 404, { error: 'Not available' });
          return;
        }
        const body = await readBody(req, this.maxBodyBytes);
        const parsed = JSON.parse(body) as { scope?: string; ticket?: string };
        if (!parsed.scope || !['data', 'config', 'all'].includes(parsed.scope)) {
          sendJSON(res, 400, { error: 'scope must be "data", "config", or "all"' });
          return;
        }
        if (!this.requirePrivilegedTicket(req, res, url, 'factory-reset', parsed.ticket)) {
          return;
        }
        const result = await this.dashboard.onFactoryReset({ scope: parsed.scope as 'data' | 'config' | 'all' });
        sendJSON(res, 200, result);
        this.maybeEmitUIInvalidation(result, ['dashboard', 'config', 'providers', 'tools', 'automations', 'network', 'security'], 'factory-reset.completed', url.pathname);
        if (parsed.scope === 'all' && result.success && this.dashboard.onKillswitch) {
          setTimeout(() => this.dashboard.onKillswitch!(), 100);
        }
        return;
      }

      // POST /api/killswitch — Shut down the entire process
      if (req.method === 'POST' && url.pathname === '/api/killswitch') {
        if (!this.dashboard.onKillswitch) {
          sendJSON(res, 404, { error: 'Not available' });
          return;
        }
        let parsed: { ticket?: string } = {};
        try {
          const body = await readBody(req, this.maxBodyBytes);
          if (body.trim()) {
            parsed = JSON.parse(body) as { ticket?: string };
          }
        } catch {
          sendJSON(res, 400, { error: 'Invalid JSON' });
          return;
        }
        if (!this.requirePrivilegedTicket(req, res, url, 'killswitch', parsed.ticket)) {
          return;
        }
        sendJSON(res, 200, { success: true, message: 'Shutting down...' });
        // Small delay so the HTTP response is flushed before the process exits
        setTimeout(() => this.dashboard.onKillswitch!(), 100);
        return;
      }

      if (req.method === 'GET' && url.pathname === '/api/code/sessions') {
        if (!this.dashboard.onCodeSessionsList) {
          sendJSON(res, 404, { error: 'Not available' });
          return;
        }
        const principal = this.resolveRequestPrincipal(req);
        const userId = url.searchParams.get('userId') || 'web-user';
        const channel = url.searchParams.get('channel') || 'web';
        sendJSON(res, 200, this.dashboard.onCodeSessionsList({
          userId,
          principalId: principal.principalId,
          channel,
          surfaceId: readSurfaceIdFromSearchParams(url) ?? userId,
        }));
        return;
      }

      if (req.method === 'POST' && url.pathname === '/api/code/sessions') {
        if (!this.dashboard.onCodeSessionCreate) {
          sendJSON(res, 404, { error: 'Not available' });
          return;
        }
        const body = await readBody(req, this.maxBodyBytes);
        const parsed = JSON.parse(body || '{}') as {
          userId?: string;
          channel?: string;
          surfaceId?: string;
          title?: string;
          workspaceRoot?: string;
          agentId?: string | null;
          attach?: boolean;
        };
        if (!trimOptionalString(parsed.title) || !trimOptionalString(parsed.workspaceRoot)) {
          sendJSON(res, 400, { error: 'title and workspaceRoot are required' });
          return;
        }
        const principal = this.resolveRequestPrincipal(req);
        const result = this.dashboard.onCodeSessionCreate({
          userId: parsed.userId || 'web-user',
          principalId: principal.principalId,
          channel: parsed.channel || 'web',
          surfaceId: trimOptionalString(parsed.surfaceId) ?? parsed.userId ?? 'web-user',
          title: parsed.title!,
          workspaceRoot: parsed.workspaceRoot!,
          agentId: trimOptionalString(parsed.agentId) ?? null,
          attach: parsed.attach !== false,
        });
        sendJSON(res, 200, result);
        return;
      }

      if (req.method === 'POST' && url.pathname === '/api/code/sessions/detach') {
        if (!this.dashboard.onCodeSessionDetach) {
          sendJSON(res, 404, { error: 'Not available' });
          return;
        }
        const body = await readBody(req, this.maxBodyBytes);
        const parsed = JSON.parse(body || '{}') as { userId?: string; channel?: string; surfaceId?: string };
        const principal = this.resolveRequestPrincipal(req);
        const result = this.dashboard.onCodeSessionDetach({
          userId: parsed.userId || 'web-user',
          principalId: principal.principalId,
          channel: parsed.channel || 'web',
          surfaceId: trimOptionalString(parsed.surfaceId) ?? parsed.userId ?? 'web-user',
        });
        sendJSON(res, 200, result);
        return;
      }

      const codeSessionAttachMatch = req.method === 'POST'
        ? url.pathname.match(/^\/api\/code\/sessions\/([^/]+)\/attach$/)
        : null;
      if (codeSessionAttachMatch) {
        if (!this.dashboard.onCodeSessionAttach) {
          sendJSON(res, 404, { error: 'Not available' });
          return;
        }
        const sessionId = decodeURIComponent(codeSessionAttachMatch[1]);
        const body = await readBody(req, this.maxBodyBytes);
        const parsed = JSON.parse(body || '{}') as { userId?: string; channel?: string; surfaceId?: string; mode?: string };
        const principal = this.resolveRequestPrincipal(req);
        const result = this.dashboard.onCodeSessionAttach({
          sessionId,
          userId: parsed.userId || 'web-user',
          principalId: principal.principalId,
          channel: parsed.channel || 'web',
          surfaceId: trimOptionalString(parsed.surfaceId) ?? parsed.userId ?? 'web-user',
          mode: trimOptionalString(parsed.mode) as import('../runtime/code-sessions.js').CodeSessionAttachmentMode | undefined,
        });
        sendJSON(res, 200, result);
        return;
      }

      const codeSessionApprovalMatch = req.method === 'POST'
        ? url.pathname.match(/^\/api\/code\/sessions\/([^/]+)\/approvals\/([^/]+)$/)
        : null;
      if (codeSessionApprovalMatch) {
        if (!this.dashboard.onCodeSessionApprovalDecision) {
          sendJSON(res, 404, { error: 'Not available' });
          return;
        }
        const sessionId = decodeURIComponent(codeSessionApprovalMatch[1]);
        const approvalId = decodeURIComponent(codeSessionApprovalMatch[2]);
        const body = await readBody(req, this.maxBodyBytes);
        const parsed = JSON.parse(body || '{}') as {
          userId?: string;
          channel?: string;
          surfaceId?: string;
          decision?: 'approved' | 'denied';
          reason?: string;
        };
        if (!parsed.decision || (parsed.decision !== 'approved' && parsed.decision !== 'denied')) {
          sendJSON(res, 400, { error: 'decision is required' });
          return;
        }
        const principal = this.resolveRequestPrincipal(req);
        try {
          const result = await this.dashboard.onCodeSessionApprovalDecision({
            sessionId,
            approvalId,
            decision: parsed.decision,
            userId: parsed.userId || 'web-user',
            principalId: principal.principalId,
            principalRole: principal.principalRole,
            channel: parsed.channel || 'web',
            surfaceId: trimOptionalString(parsed.surfaceId) ?? parsed.userId ?? 'web-user',
            reason: trimOptionalString(parsed.reason),
          });
          sendJSON(res, 200, result);
        } catch (err) {
          const requestError = getRequestErrorDetails(err);
          if (requestError) {
            sendJSON(res, requestError.statusCode, {
              error: requestError.error,
              ...(requestError.errorCode ? { errorCode: requestError.errorCode } : {}),
            });
            return;
          }
          logInternalError('Code session approval decision failed', err);
          const detail = err instanceof Error ? err.message : String(err);
          sendJSON(res, 500, { error: `Dispatch error: ${detail}` });
        }
        return;
      }

      const codeSessionResetMatch = req.method === 'POST'
        ? url.pathname.match(/^\/api\/code\/sessions\/([^/]+)\/reset$/)
        : null;
      if (codeSessionResetMatch) {
        if (!this.dashboard.onCodeSessionResetConversation) {
          sendJSON(res, 404, { error: 'Not available' });
          return;
        }
        const sessionId = decodeURIComponent(codeSessionResetMatch[1]);
        const body = await readBody(req, this.maxBodyBytes);
        const parsed = JSON.parse(body || '{}') as { userId?: string; channel?: string };
        const result = this.dashboard.onCodeSessionResetConversation({
          sessionId,
          userId: parsed.userId || 'web-user',
          channel: parsed.channel || 'web',
        });
        sendJSON(res, 200, result);
        return;
      }

      const codeSessionTimelineMatch = req.method === 'GET'
        ? url.pathname.match(/^\/api\/code\/sessions\/([^/]+)\/timeline$/)
        : null;
      if (codeSessionTimelineMatch) {
        if (!this.dashboard.onCodeSessionTimeline) {
          sendJSON(res, 404, { error: 'Not available' });
          return;
        }
        const sessionId = decodeURIComponent(codeSessionTimelineMatch[1]);
        const principal = this.resolveRequestPrincipal(req);
        const userId = url.searchParams.get('userId') || 'web-user';
        const channel = url.searchParams.get('channel') || 'web';
        const limit = Number.parseInt(url.searchParams.get('limit') || '12', 10);
        const result = this.dashboard.onCodeSessionTimeline({
          sessionId,
          userId,
          principalId: principal.principalId,
          channel,
          surfaceId: readSurfaceIdFromSearchParams(url) ?? userId,
          limit: Number.isFinite(limit) ? limit : 12,
        });
        if (!result) {
          sendJSON(res, 404, { error: 'Code session not found' });
          return;
        }
        sendJSON(res, 200, result);
        return;
      }

      const codeSessionMatch = url.pathname.match(/^\/api\/code\/sessions\/([^/]+)$/);
      if (codeSessionMatch) {
        const sessionId = decodeURIComponent(codeSessionMatch[1]);
        const principal = this.resolveRequestPrincipal(req);

        if (req.method === 'GET') {
          if (!this.dashboard.onCodeSessionGet) {
            sendJSON(res, 404, { error: 'Not available' });
            return;
          }
          const userId = url.searchParams.get('userId') || 'web-user';
          const channel = url.searchParams.get('channel') || 'web';
          const historyLimit = Number.parseInt(url.searchParams.get('historyLimit') || '120', 10);
          const result = this.dashboard.onCodeSessionGet({
            sessionId,
            userId,
            principalId: principal.principalId,
            channel,
            surfaceId: readSurfaceIdFromSearchParams(url) ?? userId,
            historyLimit: Number.isFinite(historyLimit) ? historyLimit : 120,
          });
          if (!result) {
            sendJSON(res, 404, { error: 'Code session not found' });
            return;
          }
          sendJSON(res, 200, result);
          return;
        }

        if (req.method === 'PATCH') {
          if (!this.dashboard.onCodeSessionUpdate) {
            sendJSON(res, 404, { error: 'Not available' });
            return;
          }
          const body = await readBody(req, this.maxBodyBytes);
          const parsed = JSON.parse(body || '{}') as {
            userId?: string;
            channel?: string;
            surfaceId?: string;
            title?: string;
            workspaceRoot?: string;
            agentId?: string | null;
            status?: string;
            uiState?: Record<string, unknown>;
            workState?: Record<string, unknown>;
          };
          const result = this.dashboard.onCodeSessionUpdate({
            sessionId,
            userId: parsed.userId || 'web-user',
            principalId: principal.principalId,
            channel: parsed.channel || 'web',
            surfaceId: trimOptionalString(parsed.surfaceId) ?? parsed.userId ?? 'web-user',
            title: trimOptionalString(parsed.title),
            workspaceRoot: trimOptionalString(parsed.workspaceRoot),
            agentId: hasOwn(parsed as object, 'agentId') ? (trimOptionalString(parsed.agentId) ?? null) : undefined,
            status: trimOptionalString(parsed.status) as import('../runtime/code-sessions.js').CodeSessionStatus | undefined,
            uiState: asRecord(parsed.uiState) as import('../runtime/code-sessions.js').CodeSessionUiState | undefined,
            workState: asRecord(parsed.workState) as import('../runtime/code-sessions.js').CodeSessionWorkState | undefined,
          });
          if (!result) {
            sendJSON(res, 404, { error: 'Code session not found' });
            return;
          }
          sendJSON(res, 200, result);
          return;
        }

        if (req.method === 'DELETE') {
          if (!this.dashboard.onCodeSessionDelete) {
            sendJSON(res, 404, { error: 'Not available' });
            return;
          }
          const body = await readBody(req, this.maxBodyBytes).catch(() => '');
          const parsed = JSON.parse(body || '{}') as { userId?: string; channel?: string; surfaceId?: string };
          const result = this.dashboard.onCodeSessionDelete({
            sessionId,
            userId: parsed.userId || 'web-user',
            principalId: principal.principalId,
            channel: parsed.channel || 'web',
            surfaceId: trimOptionalString(parsed.surfaceId) ?? parsed.userId ?? 'web-user',
          });
          sendJSON(res, result.success ? 200 : 404, result);
          return;
        }
      }

      const codeSessionStructureMatch = req.method === 'GET'
        ? url.pathname.match(/^\/api\/code\/sessions\/([^/]+)\/structure$/)
        : null;
      if (codeSessionStructureMatch) {
        if (!this.dashboard.onCodeSessionGet) {
          sendJSON(res, 404, { success: false, error: 'Not available' });
          return;
        }
        const sessionId = decodeURIComponent(codeSessionStructureMatch[1]);
        const principal = this.resolveRequestPrincipal(req);
        const userId = url.searchParams.get('userId') || 'web-user';
        const channel = url.searchParams.get('channel') || 'web';
        const snapshot = this.dashboard.onCodeSessionGet({
          sessionId,
          userId,
          principalId: principal.principalId,
          channel,
          surfaceId: readSurfaceIdFromSearchParams(url) ?? userId,
          historyLimit: 1,
        });
        if (!snapshot) {
          sendJSON(res, 404, { success: false, error: 'Code session not found' });
          return;
        }

        const requestedPath = trimOptionalString(url.searchParams.get('path'));
        const requestedSectionId = trimOptionalString(url.searchParams.get('sectionId'));
        const requestedLine = Number(url.searchParams.get('line')) || 0;
        const fallbackPath = trimOptionalString(snapshot.session.uiState.selectedFilePath);
        if (!requestedPath && !fallbackPath) {
          sendJSON(res, 400, { success: false, error: 'A file path is required for structure inspection.' });
          return;
        }

        let targetPath: string;
        try {
          targetPath = resolveCodeSessionPath(
            snapshot.session.resolvedRoot,
            requestedPath ?? fallbackPath ?? undefined,
          );
        } catch (err) {
          sendJSON(res, 403, { success: false, error: err instanceof Error ? err.message : 'Denied path' });
          return;
        }

        try {
          const structure = inspectCodeWorkspaceFileStructureSync(
            snapshot.session.resolvedRoot,
            targetPath,
            Date.now(),
            {
              ...(requestedLine > 0 ? { lineNumber: requestedLine } : {}),
              ...(requestedSectionId ? { sectionId: requestedSectionId } : {}),
            },
          );
          sendJSON(res, 200, { success: true, ...structure });
        } catch (err) {
          sendJSON(res, 200, {
            success: false,
            error: err instanceof Error ? err.message : 'Failed to inspect file structure',
          });
        }
        return;
      }

      const codeSessionStructurePreviewMatch = req.method === 'POST'
        ? url.pathname.match(/^\/api\/code\/sessions\/([^/]+)\/structure-preview$/)
        : null;
      if (codeSessionStructurePreviewMatch) {
        if (!this.dashboard.onCodeSessionGet) {
          sendJSON(res, 404, { success: false, error: 'Not available' });
          return;
        }
        const sessionId = decodeURIComponent(codeSessionStructurePreviewMatch[1]);
        const principal = this.resolveRequestPrincipal(req);
        const body = await readBody(req, this.maxBodyBytes);
        const parsed = JSON.parse(body || '{}') as {
          userId?: string;
          channel?: string;
          surfaceId?: string;
          path?: string;
          content?: string;
          line?: number;
          sectionId?: string;
        };
        const snapshot = this.dashboard.onCodeSessionGet({
          sessionId,
          userId: parsed.userId || 'web-user',
          principalId: principal.principalId,
          channel: parsed.channel || 'web',
          surfaceId: trimOptionalString(parsed.surfaceId) ?? parsed.userId ?? 'web-user',
          historyLimit: 1,
        });
        if (!snapshot) {
          sendJSON(res, 404, { success: false, error: 'Code session not found' });
          return;
        }

        const requestedPath = trimOptionalString(parsed.path);
        if (!requestedPath) {
          sendJSON(res, 400, { success: false, error: 'A file path is required for structure preview.' });
          return;
        }
        if (typeof parsed.content !== 'string') {
          sendJSON(res, 400, { success: false, error: 'Structure preview content must be a string.' });
          return;
        }

        let targetPath: string;
        try {
          targetPath = resolveCodeSessionPath(snapshot.session.resolvedRoot, requestedPath);
        } catch (err) {
          sendJSON(res, 403, { success: false, error: err instanceof Error ? err.message : 'Denied path' });
          return;
        }

        try {
          const structure = inspectCodeWorkspaceFileStructureTextSync(
            snapshot.session.resolvedRoot,
            targetPath,
            parsed.content,
            Date.now(),
            {
              ...(Number(parsed.line) > 0 ? { lineNumber: Number(parsed.line) } : {}),
              ...(trimOptionalString(parsed.sectionId) ? { sectionId: trimOptionalString(parsed.sectionId)! } : {}),
            },
          );
          sendJSON(res, 200, { success: true, ...structure });
        } catch (err) {
          sendJSON(res, 200, {
            success: false,
            error: err instanceof Error ? err.message : 'Failed to inspect file structure preview',
          });
        }
        return;
      }

      // POST /api/code/fs/list — direct user directory listing for Code UI
      if (req.method === 'POST' && url.pathname === '/api/code/fs/list') {
        const body = await readBody(req, this.maxBodyBytes);
        const parsed = JSON.parse(body || '{}') as {
          path?: string;
          sessionId?: string;
          userId?: string;
          channel?: string;
          surfaceId?: string;
        };
        let targetPath = resolve(parsed.path || '.');
        if (trimOptionalString(parsed.sessionId) && this.dashboard.onCodeSessionGet) {
          const principal = this.resolveRequestPrincipal(req);
          const snapshot = this.dashboard.onCodeSessionGet({
            sessionId: parsed.sessionId!,
            userId: parsed.userId || 'web-user',
            principalId: principal.principalId,
            channel: parsed.channel || 'web',
            surfaceId: trimOptionalString(parsed.surfaceId) ?? parsed.userId ?? 'web-user',
            historyLimit: 1,
          });
          if (!snapshot) {
            sendJSON(res, 404, { success: false, error: 'Code session not found' });
            return;
          }
          try {
            targetPath = resolveCodeSessionPath(snapshot.session.resolvedRoot, parsed.path, '.');
          } catch (err) {
            sendJSON(res, 403, { success: false, error: err instanceof Error ? err.message : 'Denied path' });
            return;
          }
        }
        try {
          const entries = await readdir(targetPath, { withFileTypes: true });
          sendJSON(res, 200, {
            success: true,
            path: targetPath,
            entries: entries
              .filter((entry) => entry.isDirectory() || entry.isFile())
              .map((entry) => ({
                name: entry.name,
                type: entry.isDirectory() ? 'dir' : 'file',
              })),
          });
        } catch (err) {
          sendJSON(res, 200, { success: false, error: err instanceof Error ? err.message : 'Failed to list directory' });
        }
        return;
      }

      // POST /api/code/fs/read — direct user file read for Code UI
      if (req.method === 'POST' && url.pathname === '/api/code/fs/read') {
        const body = await readBody(req, this.maxBodyBytes);
        const parsed = JSON.parse(body || '{}') as {
          path?: string;
          maxBytes?: number;
          sessionId?: string;
          userId?: string;
          channel?: string;
          surfaceId?: string;
        };
        let targetPath = resolve(parsed.path || '.');
        if (trimOptionalString(parsed.sessionId) && this.dashboard.onCodeSessionGet) {
          const principal = this.resolveRequestPrincipal(req);
          const snapshot = this.dashboard.onCodeSessionGet({
            sessionId: parsed.sessionId!,
            userId: parsed.userId || 'web-user',
            principalId: principal.principalId,
            channel: parsed.channel || 'web',
            surfaceId: trimOptionalString(parsed.surfaceId) ?? parsed.userId ?? 'web-user',
            historyLimit: 1,
          });
          if (!snapshot) {
            sendJSON(res, 404, { success: false, error: 'Code session not found' });
            return;
          }
          try {
            targetPath = resolveCodeSessionPath(snapshot.session.resolvedRoot, parsed.path);
          } catch (err) {
            sendJSON(res, 403, { success: false, error: err instanceof Error ? err.message : 'Denied path' });
            return;
          }
        }
        const maxBytes = Math.max(1024, Math.min(500_000, Number(parsed.maxBytes) || 250_000));
        try {
          const content = await readFile(targetPath, 'utf-8');
          sendJSON(res, 200, {
            success: true,
            path: targetPath,
            content: content.length > maxBytes ? content.slice(0, maxBytes) : content,
          });
        } catch (err) {
          sendJSON(res, 200, { success: false, error: err instanceof Error ? err.message : 'Failed to read file' });
        }
        return;
      }

      // POST /api/code/fs/write — direct user file write for Code UI editor
      if (req.method === 'POST' && url.pathname === '/api/code/fs/write') {
        const body = await readBody(req, this.maxBodyBytes);
        const parsed = JSON.parse(body || '{}') as {
          path?: string;
          content?: string;
          sessionId?: string;
          userId?: string;
          channel?: string;
          surfaceId?: string;
        };
        if (typeof parsed.content !== 'string') {
          sendJSON(res, 400, { success: false, error: 'Missing content' });
          return;
        }
        let targetPath = resolve(parsed.path || '.');
        if (trimOptionalString(parsed.sessionId) && this.dashboard.onCodeSessionGet) {
          const principal = this.resolveRequestPrincipal(req);
          const snapshot = this.dashboard.onCodeSessionGet({
            sessionId: parsed.sessionId!,
            userId: parsed.userId || 'web-user',
            principalId: principal.principalId,
            channel: parsed.channel || 'web',
            surfaceId: trimOptionalString(parsed.surfaceId) ?? parsed.userId ?? 'web-user',
            historyLimit: 1,
          });
          if (!snapshot) {
            sendJSON(res, 404, { success: false, error: 'Code session not found' });
            return;
          }
          try {
            targetPath = resolveCodeSessionPath(snapshot.session.resolvedRoot, parsed.path);
          } catch (err) {
            sendJSON(res, 403, { success: false, error: err instanceof Error ? err.message : 'Denied path' });
            return;
          }
        }
        try {
          const { writeFile } = await import('node:fs/promises');
          await writeFile(targetPath, parsed.content, 'utf-8');
          sendJSON(res, 200, { success: true, path: targetPath });
        } catch (err) {
          sendJSON(res, 200, { success: false, error: err instanceof Error ? err.message : 'Failed to write file' });
        }
        return;
      }

      // POST /api/code/git/diff — direct user git diff for Code UI
      if (req.method === 'POST' && url.pathname === '/api/code/git/diff') {
        const body = await readBody(req, this.maxBodyBytes);
        const parsed = JSON.parse(body || '{}') as {
          cwd?: string;
          path?: string;
          staged?: boolean;
          sessionId?: string;
          userId?: string;
          channel?: string;
          surfaceId?: string;
        };
        let cwd = resolve(parsed.cwd || '.');
        let sessionPath = trimOptionalString(parsed.path);
        if (trimOptionalString(parsed.sessionId) && this.dashboard.onCodeSessionGet) {
          const principal = this.resolveRequestPrincipal(req);
          const snapshot = this.dashboard.onCodeSessionGet({
            sessionId: parsed.sessionId!,
            userId: parsed.userId || 'web-user',
            principalId: principal.principalId,
            channel: parsed.channel || 'web',
            surfaceId: trimOptionalString(parsed.surfaceId) ?? parsed.userId ?? 'web-user',
            historyLimit: 1,
          });
          if (!snapshot) {
            sendJSON(res, 404, { success: false, error: 'Code session not found' });
            return;
          }
          try {
            cwd = resolveCodeSessionPath(snapshot.session.resolvedRoot, parsed.cwd, '.');
            if (sessionPath) {
              const resolvedPath = resolveCodeSessionPath(snapshot.session.resolvedRoot, sessionPath);
              sessionPath = toRelativeSessionPath(snapshot.session.resolvedRoot, resolvedPath);
            }
          } catch (err) {
            sendJSON(res, 403, { success: false, error: err instanceof Error ? err.message : 'Denied path' });
            return;
          }
        }
        const args = ['diff'];
        if (parsed.staged) args.push('--staged');
        if (sessionPath) args.push('--', sessionPath);
        try {
          const { execFile } = await import('node:child_process');
          const result = await new Promise<{ stdout: string; stderr: string; exitCode: number }>((resolveResult) => {
            execFile('git', args, { cwd, windowsHide: true, maxBuffer: 2 * 1024 * 1024 }, (error: any, stdout: string, stderr: string) => {
              resolveResult({
                stdout: stdout || '',
                stderr: stderr || '',
                exitCode: error ? (error.code ?? 1) : 0,
              });
            });
          });
          sendJSON(res, 200, { success: result.exitCode === 0, stdout: result.stdout, stderr: result.stderr, exitCode: result.exitCode });
        } catch (err) {
          sendJSON(res, 200, { success: false, error: err instanceof Error ? err.message : 'Git diff failed' });
        }
        return;
      }

      // GET /api/code/sessions/:id/git/status — git status for Code UI panel
      const gitStatusMatch = url.pathname.match(/^\/api\/code\/sessions\/([^/]+)\/git\/status$/);
      if (req.method === 'GET' && gitStatusMatch) {
        const sessionId = decodeURIComponent(gitStatusMatch[1]);
        const principal = this.resolveRequestPrincipal(req);
        const userId = url.searchParams.get('userId') || 'web-user';
        const channel = url.searchParams.get('channel') || 'web';
        const snapshot = this.dashboard.onCodeSessionGet?.({
          sessionId,
          userId,
          principalId: principal.principalId,
          channel,
          surfaceId: readSurfaceIdFromSearchParams(url) ?? userId,
          historyLimit: 1,
        });
        if (!snapshot) {
          sendJSON(res, 404, { success: false, error: 'Code session not found' });
          return;
        }
        const cwd = snapshot.session.resolvedRoot;
        try {
          const { execFile } = await import('node:child_process');
          const [statusResult, branchResult] = await Promise.all([
            new Promise<{ stdout: string; exitCode: number }>((resolve) => {
              execFile('git', ['status', '--porcelain=v1', '-uall'], { cwd, windowsHide: true, maxBuffer: 1024 * 1024 }, (error: any, stdout: string) => {
                resolve({ stdout: stdout || '', exitCode: error ? (error.code ?? 1) : 0 });
              });
            }),
            new Promise<{ stdout: string }>((resolve) => {
              execFile('git', ['branch', '--show-current'], { cwd, windowsHide: true }, (_error: any, stdout: string) => {
                resolve({ stdout: (stdout || '').trim() });
              });
            }),
          ]);
          if (statusResult.exitCode !== 0) {
            sendJSON(res, 200, { success: false, error: 'Not a git repository or git not available' });
            return;
          }
          const staged: Array<{ path: string; status: string }> = [];
          const unstaged: Array<{ path: string; status: string }> = [];
          const untracked: Array<{ path: string; status: string }> = [];
          for (const line of statusResult.stdout.split('\n')) {
            if (!line || line.length < 4) continue;
            const x = line[0]; // index status
            const y = line[1]; // worktree status
            const filePath = line.slice(3).replace(/ -> .+$/, ''); // handle renames
            if (x === '?' && y === '?') {
              untracked.push({ path: filePath, status: '?' });
            } else {
              if (x !== ' ' && x !== '?') staged.push({ path: filePath, status: x });
              if (y !== ' ' && y !== '?') unstaged.push({ path: filePath, status: y });
            }
          }
          sendJSON(res, 200, { success: true, branch: branchResult.stdout, staged, unstaged, untracked });
        } catch (err) {
          sendJSON(res, 200, { success: false, error: err instanceof Error ? err.message : 'Git status failed' });
        }
        return;
      }

      // POST /api/code/sessions/:id/git/action — git actions (stage, unstage, commit, push, pull, fetch, discard)
      const gitActionMatch = url.pathname.match(/^\/api\/code\/sessions\/([^/]+)\/git\/action$/);
      if (req.method === 'POST' && gitActionMatch) {
        const sessionId = decodeURIComponent(gitActionMatch[1]);
        const body = await readBody(req, this.maxBodyBytes);
        const parsed = JSON.parse(body || '{}') as {
          action: string;
          path?: string;
          message?: string;
          userId?: string;
          channel?: string;
          surfaceId?: string;
        };
        const principal = this.resolveRequestPrincipal(req);
        const snapshot = this.dashboard.onCodeSessionGet?.({
          sessionId,
          userId: parsed.userId || 'web-user',
          principalId: principal.principalId,
          channel: parsed.channel || 'web',
          surfaceId: trimOptionalString(parsed.surfaceId) ?? parsed.userId ?? 'web-user',
          historyLimit: 1,
        });
        if (!snapshot) {
          sendJSON(res, 404, { success: false, error: 'Code session not found' });
          return;
        }
        const cwd = snapshot.session.resolvedRoot;
        const action = parsed.action;
        const validActions = ['stage', 'unstage', 'commit', 'push', 'pull', 'fetch', 'discard', 'init'];
        if (!validActions.includes(action)) {
          sendJSON(res, 400, { success: false, error: `Invalid git action: ${action}` });
          return;
        }
        try {
          const { execFile } = await import('node:child_process');
          const run = (args: string[]): Promise<{ stdout: string; stderr: string; exitCode: number }> =>
            new Promise((resolve) => {
              execFile('git', args, { cwd, windowsHide: true, maxBuffer: 2 * 1024 * 1024 }, (error: any, stdout: string, stderr: string) => {
                resolve({ stdout: stdout || '', stderr: stderr || '', exitCode: error ? (error.code ?? 1) : 0 });
              });
            });
          let result: { stdout: string; stderr: string; exitCode: number };
          switch (action) {
            case 'stage':
              result = await run(['add', '--', parsed.path || '.']);
              break;
            case 'unstage':
              result = await run(['reset', 'HEAD', '--', parsed.path || '.']);
              break;
            case 'commit':
              if (!parsed.message?.trim()) {
                sendJSON(res, 400, { success: false, error: 'Commit message required' });
                return;
              }
              result = await run(['commit', '-m', parsed.message.trim()]);
              break;
            case 'push':
              result = await run(['push']);
              break;
            case 'pull':
              result = await run(['pull']);
              break;
            case 'fetch':
              result = await run(['fetch']);
              break;
            case 'discard':
              result = await run(['checkout', '--', parsed.path || '.']);
              break;
            case 'init':
              result = await run(['init']);
              break;
            default:
              sendJSON(res, 400, { success: false, error: 'Unknown action' });
              return;
          }
          sendJSON(res, 200, { success: result.exitCode === 0, stdout: result.stdout, stderr: result.stderr });
        } catch (err) {
          sendJSON(res, 200, { success: false, error: err instanceof Error ? err.message : `Git ${action} failed` });
        }
        return;
      }

      // GET /api/code/sessions/:id/git/graph — commit graph for git panel
      const gitGraphMatch = url.pathname.match(/^\/api\/code\/sessions\/([^/]+)\/git\/graph$/);
      if (req.method === 'GET' && gitGraphMatch) {
        const sessionId = decodeURIComponent(gitGraphMatch[1]);
        const principal = this.resolveRequestPrincipal(req);
        const userId = url.searchParams.get('userId') || 'web-user';
        const channel = url.searchParams.get('channel') || 'web';
        const snapshot = this.dashboard.onCodeSessionGet?.({
          sessionId,
          userId,
          principalId: principal.principalId,
          channel,
          surfaceId: readSurfaceIdFromSearchParams(url) ?? userId,
          historyLimit: 1,
        });
        if (!snapshot) {
          sendJSON(res, 404, { success: false, error: 'Code session not found' });
          return;
        }
        const cwd = snapshot.session.resolvedRoot;
        try {
          const { execFile } = await import('node:child_process');
          const result = await new Promise<{ stdout: string; exitCode: number }>((resolve) => {
            execFile('git', [
              'log', '--all', '--oneline', '--graph', '--decorate=short',
              '--date=short', '--pretty=format:%h\t%d\t%s\t%ad',
              '-40',
            ], { cwd, windowsHide: true, maxBuffer: 256 * 1024 }, (error: any, stdout: string) => {
              resolve({ stdout: stdout || '', exitCode: error ? (error.code ?? 1) : 0 });
            });
          });
          if (result.exitCode !== 0) {
            sendJSON(res, 200, { success: false, entries: [] });
            return;
          }
          const entries = result.stdout.split('\n').filter(Boolean).map((line) => {
            // Each line is: graph_chars hash \t refs \t message \t date
            // But --graph prepends graph characters before the formatted output
            const graphMatch = line.match(/^([*|/\\ ]+)\s*([a-f0-9]+)\t\s*(\([^)]*\))?\s*\t?\s*(.*?)\t\s*(.*)$/);
            if (graphMatch) {
              return {
                graph: graphMatch[1].trimEnd(),
                hash: graphMatch[2],
                refs: (graphMatch[3] || '').replace(/^\(|\)$/g, '').trim(),
                message: graphMatch[4],
                date: graphMatch[5],
              };
            }
            // Graph-only lines (merge lines, etc.)
            return { graph: line, hash: '', refs: '', message: '', date: '' };
          });
          sendJSON(res, 200, { success: true, entries });
        } catch (err) {
          sendJSON(res, 200, { success: false, entries: [], error: err instanceof Error ? err.message : 'Git graph failed' });
        }
        return;
      }

      // POST /api/code/terminals — Open a PTY-backed terminal session
      if (req.method === 'POST' && url.pathname === '/api/code/terminals') {
        const terminalAccess = this.dashboard.onCodeTerminalAccessCheck?.();
        if (terminalAccess && terminalAccess.allowed === false) {
          sendJSON(res, 403, { success: false, error: terminalAccess.reason || 'Manual code terminals are disabled by policy.' });
          return;
        }
        const body = await readBody(req, this.maxBodyBytes);
        const parsed = JSON.parse(body || '{}') as {
          cwd?: string;
          shell?: string;
          cols?: number;
          rows?: number;
          sessionId?: string;
          userId?: string;
          channel?: string;
          surfaceId?: string;
        };
        const platform = process.platform;
        const shellType = parsed.shell || getDefaultShellForPlatform(platform);
        let requestedCwd = parsed.cwd || process.cwd();
        let codeSessionId: string | null = null;
        if (trimOptionalString(parsed.sessionId) && this.dashboard.onCodeSessionGet) {
          const principal = this.resolveRequestPrincipal(req);
          const snapshot = this.dashboard.onCodeSessionGet({
            sessionId: parsed.sessionId!,
            userId: parsed.userId || 'web-user',
            principalId: principal.principalId,
            channel: parsed.channel || 'web',
            surfaceId: trimOptionalString(parsed.surfaceId) ?? parsed.userId ?? 'web-user',
            historyLimit: 1,
          });
          if (!snapshot) {
            sendJSON(res, 404, { success: false, error: 'Code session not found' });
            return;
          }
          try {
            requestedCwd = resolveCodeSessionPath(snapshot.session.resolvedRoot, parsed.cwd, '.');
            codeSessionId = snapshot.session.id;
          } catch (err) {
            sendJSON(res, 403, { success: false, error: err instanceof Error ? err.message : 'Denied path' });
            return;
          }
        }
        const launch = getPtyShellLaunch(shellType, platform, requestedCwd);
        const cols = Math.max(40, Math.min(240, Number(parsed.cols) || 120));
        const rows = Math.max(12, Math.min(120, Number(parsed.rows) || 30));
        const ownerSessionId = this.parseCookie(req, SESSION_COOKIE_NAME) || null;
        try {
          const terminalId = randomUUID();
          const ptyCwd = launch.cwd === null ? undefined : (launch.cwd || requestedCwd || process.cwd());
          const pty = spawnPty(launch.file, launch.args, {
            name: 'xterm-color',
            cols,
            rows,
            cwd: ptyCwd,
            env: buildHardenedEnv({
              ...process.env,
              ...launch.env,
            }),
          });
          const session: TerminalSessionRecord = {
            id: terminalId,
            ownerSessionId,
            pty,
            shell: shellType,
            cwd: requestedCwd,
            cols,
            rows,
            ...(codeSessionId ? { codeSessionId } : {}),
          };
          this.terminalSessions.set(terminalId, session);
          this.dashboard.onCodeTerminalEvent?.({
            action: 'opened',
            terminalId,
            shell: shellType,
            cwd: session.cwd,
            cols: session.cols,
            rows: session.rows,
            codeSessionId: session.codeSessionId ?? null,
          });
          pty.onData((data) => {
            this.emitSSE({
              type: 'terminal.output',
              data: { terminalId, data },
            });
            const outputListeners = this.terminalOutputListeners.get(terminalId);
            if (outputListeners) {
              for (const cb of outputListeners) { try { cb(data); } catch { /* listener error */ } }
            }
          });
          pty.onExit((event) => {
            const exitListeners = this.terminalExitListeners.get(terminalId);
            if (exitListeners) {
              for (const cb of exitListeners) { try { cb(event.exitCode ?? 1, event.signal ?? 0); } catch { /* listener error */ } }
              this.terminalExitListeners.delete(terminalId);
            }
            this.terminalOutputListeners.delete(terminalId);
            this.terminalSessions.delete(terminalId);
            this.dashboard.onCodeTerminalEvent?.({
              action: 'exited',
              terminalId,
              shell: session.shell,
              cwd: session.cwd,
              cols: session.cols,
              rows: session.rows,
              codeSessionId: session.codeSessionId ?? null,
              exitCode: event.exitCode,
              signal: event.signal,
            });
            this.emitSSE({
              type: 'terminal.exit',
              data: { terminalId, exitCode: event.exitCode, signal: event.signal },
            });
          });
          sendJSON(res, 200, {
            success: true,
            terminalId,
            shell: shellType,
            cwd: session.cwd,
          });
        } catch (err) {
          sendJSON(res, 500, { success: false, error: err instanceof Error ? err.message : 'Failed to open terminal' });
        }
        return;
      }

      const terminalInputMatch = req.method === 'POST' ? url.pathname.match(/^\/api\/code\/terminals\/([^/]+)\/input$/) : null;
      if (terminalInputMatch) {
        const terminalId = decodeURIComponent(terminalInputMatch[1]);
        const session = this.terminalSessions.get(terminalId);
        if (!session || !this.canAccessTerminal(req, session)) {
          sendJSON(res, 404, { success: false, error: 'Terminal not found' });
          return;
        }
        const body = await readBody(req, this.maxBodyBytes);
        const parsed = JSON.parse(body || '{}') as { input?: string };
        if (typeof parsed.input !== 'string') {
          sendJSON(res, 400, { success: false, error: 'input is required' });
          return;
        }
        session.pty.write(parsed.input);
        sendJSON(res, 200, { success: true });
        return;
      }

      const terminalResizeMatch = req.method === 'POST' ? url.pathname.match(/^\/api\/code\/terminals\/([^/]+)\/resize$/) : null;
      if (terminalResizeMatch) {
        const terminalId = decodeURIComponent(terminalResizeMatch[1]);
        const session = this.terminalSessions.get(terminalId);
        if (!session || !this.canAccessTerminal(req, session)) {
          sendJSON(res, 404, { success: false, error: 'Terminal not found' });
          return;
        }
        const body = await readBody(req, this.maxBodyBytes);
        const parsed = JSON.parse(body || '{}') as { cols?: number; rows?: number };
        const cols = Math.max(40, Math.min(240, Number(parsed.cols) || session.cols));
        const rows = Math.max(12, Math.min(120, Number(parsed.rows) || session.rows));
        session.cols = cols;
        session.rows = rows;
        session.pty.resize(cols, rows);
        sendJSON(res, 200, { success: true });
        return;
      }

      const terminalDeleteMatch = req.method === 'DELETE' ? url.pathname.match(/^\/api\/code\/terminals\/([^/]+)$/) : null;
      if (terminalDeleteMatch) {
        const terminalId = decodeURIComponent(terminalDeleteMatch[1]);
        const session = this.terminalSessions.get(terminalId);
        if (!session || !this.canAccessTerminal(req, session)) {
          sendJSON(res, 404, { success: false, error: 'Terminal not found' });
          return;
        }
        this.terminalSessions.delete(terminalId);
        try {
          session.pty.kill();
        } catch {
          // Best effort close.
        }
        sendJSON(res, 200, { success: true });
        return;
      }

      // POST /api/shell/exec — removed; use PTY-backed code terminals instead
      if (req.method === 'POST' && url.pathname === '/api/shell/exec') {
        sendJSON(res, 410, {
          success: false,
          error: 'Direct shell execution has been removed from the web API. Use /api/code/terminals for interactive shell access.',
        });
        return;
      }

      // API 404
      sendJSON(res, 404, { error: 'Not found' });
      return;
    }

    // ─── Static file serving (no auth required) ────────────────

    if (this.staticDir && req.method === 'GET') {
      const served = await this.serveStatic(url.pathname, res);
      if (served) return;
    }

    // 404
    sendJSON(res, 404, { error: 'Not found' });
  }

  /** Handle SSE connection. */
  private handleSSE(req: IncomingMessage, res: ServerResponse): void {
    if (!this.dashboard.onSSESubscribe) {
      sendJSON(res, 404, { error: 'SSE not available' });
      return;
    }

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });

    // Send initial comment to confirm connection
    res.write(':connected\n\n');

    this.sseClients.add(res);

    const listener: SSEListener = (event) => {
      if (res.destroyed) return;
      res.write(`event: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`);
    };

    const unsubscribe = this.dashboard.onSSESubscribe(listener);

    // Heartbeat every 30s
    const heartbeat = setInterval(() => {
      if (res.destroyed) return;
      res.write(':heartbeat\n\n');
    }, 30_000);

    // Cleanup on disconnect
    const cleanup = () => {
      clearInterval(heartbeat);
      unsubscribe();
      this.sseClients.delete(res);
    };

    req.on('close', cleanup);
    res.on('close', cleanup);
  }

  private canAccessTerminal(req: IncomingMessage, session: TerminalSessionRecord): boolean {
    const requester = this.parseCookie(req, SESSION_COOKIE_NAME) || null;
    return session.ownerSessionId === requester;
  }

  /** Serve a static file from staticDir. Returns true if served. */
  private async serveStatic(pathname: string, res: ServerResponse): Promise<boolean> {
    if (!this.staticDir) return false;

    if (pathname.startsWith('/vendor/xterm/')) {
      const vendorFile = pathname.slice('/vendor/xterm/'.length);
      const vendorRoot = normalize(join(this.staticDir, '..', '..', 'node_modules'));
      let vendorPath: string | null = null;
      if (vendorFile === 'xterm.mjs') vendorPath = normalize(join(vendorRoot, '@xterm', 'xterm', 'lib', 'xterm.mjs'));
      else if (vendorFile === 'addon-fit.mjs') vendorPath = normalize(join(vendorRoot, '@xterm', 'addon-fit', 'lib', 'addon-fit.mjs'));
      else if (vendorFile === 'xterm.css') vendorPath = normalize(join(vendorRoot, '@xterm', 'xterm', 'css', 'xterm.css'));
      if (!vendorPath || !vendorPath.startsWith(vendorRoot)) return false;
      try {
        const ext = extname(vendorPath);
        const contentType = MIME_TYPES[ext] ?? 'application/octet-stream';
        const content = await readFile(vendorPath);
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(content);
        return true;
      } catch {
        return false;
      }
    }

    // Serve vendored Monaco editor files from web/public/vendor/monaco/
    if (pathname.startsWith('/vendor/monaco/')) {
      const monacoDir = normalize(join(this.staticDir, 'vendor', 'monaco'));
      const monacoPath = normalize(join(monacoDir, pathname.slice('/vendor/monaco/'.length)));
      if (!monacoPath.startsWith(monacoDir)) return false;
      try {
        const ext = extname(monacoPath);
        const contentType = MIME_TYPES[ext] ?? (ext === '.ttf' ? 'font/ttf' : 'application/octet-stream');
        const content = await readFile(monacoPath);
        res.writeHead(200, { 'Content-Type': contentType, 'Cache-Control': 'public, max-age=86400' });
        res.end(content);
        return true;
      } catch {
        return false;
      }
    }

    // Normalize and prevent path traversal
    let filePath = normalize(join(this.staticDir, pathname));

    // Containment check
    if (!filePath.startsWith(normalize(this.staticDir))) {
      return false;
    }

    try {
      const stats = await stat(filePath);

      // If it's a directory, try index.html
      if (stats.isDirectory()) {
        filePath = join(filePath, 'index.html');
        await stat(filePath); // throws if doesn't exist
      }
    } catch {
      // SPA fallback: serve index.html for paths without file extensions
      const ext = extname(pathname);
      if (!ext) {
        try {
          filePath = join(this.staticDir, 'index.html');
          await stat(filePath);
        } catch {
          return false;
        }
      } else {
        return false;
      }
    }

    const ext = extname(filePath);
    const contentType = MIME_TYPES[ext] ?? 'application/octet-stream';

    try {
      const content = await readFile(filePath);
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
      return true;
    } catch {
      return false;
    }
  }
}

function logInternalError(message: string, err: unknown): void {
  log.error({ err }, message);
}

function previewToken(token: string): string {
  if (token.length <= 8) return token;
  return `${token.slice(0, 4)}...${token.slice(-4)}`;
}

function isSuccessfulMutationResult(result: unknown): boolean {
  if (!result || typeof result !== 'object' || !('success' in result)) {
    return true;
  }
  return (result as { success?: boolean }).success !== false;
}

function uniqueTopics(topics: string[]): string[] {
  return [...new Set(topics.filter((topic) => topic && topic.trim()))];
}
