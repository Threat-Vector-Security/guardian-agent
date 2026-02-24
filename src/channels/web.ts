/**
 * Web channel adapter.
 *
 * Lightweight HTTP server using Node built-in http module.
 * REST API for agent communication + basic status endpoint.
 *
 * Security:
 *   - Optional bearer token authentication
 *   - Configurable CORS origins (default: same-origin only)
 *   - Request body size limit (default: 1 MB)
 */

import { createServer, type Server, type IncomingMessage, type ServerResponse } from 'node:http';
import { randomUUID } from 'node:crypto';
import type { ChannelAdapter, MessageCallback } from './types.js';
import { createLogger } from '../util/logging.js';

const log = createLogger('channel:web');

/** Default maximum request body size: 1 MB. */
const DEFAULT_MAX_BODY_BYTES = 1_048_576;

export interface WebChannelOptions {
  /** Port to listen on. */
  port?: number;
  /** Host to bind to. */
  host?: string;
  /** Default agent to route messages to. */
  defaultAgent?: string;
  /** Bearer token for authentication. If set, all non-health requests require it. */
  authToken?: string;
  /** Allowed CORS origins (default: none / same-origin). Use ['*'] to allow all (not recommended). */
  allowedOrigins?: string[];
  /** Maximum request body size in bytes (default: 1 MB). */
  maxBodyBytes?: number;
}

export class WebChannel implements ChannelAdapter {
  readonly name = 'web';
  private server: Server | null = null;
  private onMessage: MessageCallback | null = null;
  private port: number;
  private host: string;
  private authToken: string | undefined;
  private allowedOrigins: string[];
  private maxBodyBytes: number;

  constructor(options: WebChannelOptions = {}) {
    this.port = options.port ?? 3000;
    this.host = options.host ?? 'localhost';
    this.authToken = options.authToken;
    this.allowedOrigins = options.allowedOrigins ?? [];
    this.maxBodyBytes = options.maxBodyBytes ?? DEFAULT_MAX_BODY_BYTES;
  }

  async start(onMessage: MessageCallback): Promise<void> {
    this.onMessage = onMessage;

    this.server = createServer(async (req, res) => {
      // CORS headers — restrict to configured origins
      const origin = req.headers.origin;
      if (origin && this.isOriginAllowed(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
      }
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

      if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
      }

      try {
        await this.handleRequest(req, res);
      } catch (err) {
        log.error({ err }, 'Unhandled request error');
        sendJSON(res, 500, { error: 'Internal server error' });
      }
    });

    return new Promise((resolve, reject) => {
      this.server!.listen(this.port, this.host, () => {
        log.info({ port: this.port, host: this.host }, 'Web channel started');
        if (!this.authToken) {
          log.warn(
            { port: this.port, host: this.host },
            'Web channel started WITHOUT authentication — all non-health endpoints are open. Set authToken in config to enable bearer token auth.',
          );
        }
        resolve();
      });
      this.server!.on('error', reject);
    });
  }

  async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          this.server = null;
          this.onMessage = null;
          log.info('Web channel stopped');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  async send(_userId: string, _text: string): Promise<void> {
    // Web channel is request/response — no push capability without WebSocket
    log.warn('WebChannel.send() called but push is not supported without WebSocket');
  }

  /** Check if a request origin is in the allowed list. */
  private isOriginAllowed(origin: string): boolean {
    if (this.allowedOrigins.length === 0) return false;
    if (this.allowedOrigins.includes('*')) return true;
    return this.allowedOrigins.includes(origin);
  }

  /** Verify bearer token authentication. Returns true if auth passes. */
  private checkAuth(req: IncomingMessage, res: ServerResponse): boolean {
    if (!this.authToken) return true; // no auth configured

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      sendJSON(res, 401, { error: 'Authentication required' });
      return false;
    }

    const token = authHeader.slice(7);
    if (token !== this.authToken) {
      sendJSON(res, 403, { error: 'Invalid token' });
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

    // All other endpoints require auth
    if (!this.checkAuth(req, res)) return;

    // GET /api/status — Runtime status
    if (req.method === 'GET' && url.pathname === '/api/status') {
      sendJSON(res, 200, {
        status: 'running',
        timestamp: Date.now(),
      });
      return;
    }

    // POST /api/message — Send a message to an agent
    if (req.method === 'POST' && url.pathname === '/api/message') {
      let body: string;
      try {
        body = await readBody(req, this.maxBodyBytes);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Bad request';
        const status = message.includes('too large') ? 413 : 400;
        sendJSON(res, status, { error: message });
        return;
      }

      let parsed: { content?: string; userId?: string; agentId?: string };
      try {
        parsed = JSON.parse(body) as { content?: string; userId?: string; agentId?: string };
      } catch {
        sendJSON(res, 400, { error: 'Invalid JSON' });
        return;
      }

      if (!parsed.content) {
        sendJSON(res, 400, { error: 'content is required' });
        return;
      }

      if (!this.onMessage) {
        sendJSON(res, 503, { error: 'No message handler registered' });
        return;
      }

      const response = await this.onMessage({
        id: randomUUID(),
        userId: parsed.userId ?? 'web-user',
        channel: 'web',
        content: parsed.content,
        timestamp: Date.now(),
      });

      sendJSON(res, 200, response);
      return;
    }

    // 404
    sendJSON(res, 404, { error: 'Not found' });
  }
}

function sendJSON(res: ServerResponse, status: number, data: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

function readBody(req: IncomingMessage, maxBytes: number): Promise<string> {
  return new Promise((resolve, reject) => {
    let totalBytes = 0;
    const chunks: Buffer[] = [];

    req.on('data', (chunk: Buffer) => {
      totalBytes += chunk.length;
      if (totalBytes > maxBytes) {
        req.destroy();
        reject(new Error(`Request body too large (limit: ${maxBytes} bytes)`));
        return;
      }
      chunks.push(chunk);
    });

    req.on('end', () => resolve(Buffer.concat(chunks).toString()));
    req.on('error', reject);
  });
}
