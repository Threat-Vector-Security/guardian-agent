import http from 'node:http';
import https from 'node:https';

export interface FlyInstanceConfig {
  id: string;
  name: string;
  apiBaseUrl?: string;
  apiToken: string;
  orgSlug?: string;
  defaultAppName?: string;
}

type QueryValue = string | number | boolean | undefined;

export interface FlyRequestInput {
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  path: string;
  query?: Record<string, QueryValue>;
  body?: unknown;
  timeoutMs?: number;
}

export class FlyClient {
  readonly config: FlyInstanceConfig;
  readonly baseUrl: URL;

  constructor(config: FlyInstanceConfig) {
    this.config = { ...config };
    this.baseUrl = new URL(config.apiBaseUrl?.trim() || 'https://api.machines.dev');
  }

  async request<T = unknown>(input: FlyRequestInput): Promise<T> {
    const url = new URL(input.path, this.baseUrl);
    for (const [key, value] of Object.entries(input.query ?? {})) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }

    const bodyText = input.body === undefined ? undefined : JSON.stringify(input.body);
    const headers: Record<string, string> = {
      'Accept': 'application/json',
      'Authorization': `Bearer ${this.config.apiToken}`,
      'User-Agent': 'GuardianAgent-Cloud/1.0',
    };
    if (bodyText !== undefined) {
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = Buffer.byteLength(bodyText).toString();
    }

    const transport = url.protocol === 'http:' ? http : https;
    return await new Promise<T>((resolve, reject) => {
      const req = transport.request({
        protocol: url.protocol,
        hostname: url.hostname,
        port: url.port || undefined,
        method: input.method,
        path: `${url.pathname}${url.search}`,
        headers,
      }, (res) => {
        let raw = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => {
          raw += chunk;
        });
        res.on('end', () => {
          const statusCode = res.statusCode ?? 500;
          const body = raw.trim();
          if (statusCode < 200 || statusCode >= 300) {
            reject(new Error(extractFlyError(statusCode, body)));
            return;
          }
          if (!body) {
            resolve({} as T);
            return;
          }
          try {
            resolve(JSON.parse(body) as T);
          } catch (error) {
            reject(new Error(`Invalid JSON response: ${error instanceof Error ? error.message : String(error)}`));
          }
        });
      });

      req.setTimeout(input.timeoutMs ?? 15_000, () => {
        req.destroy(new Error('Request timed out'));
      });
      req.on('error', reject);
      if (bodyText !== undefined) req.write(bodyText);
      req.end();
    });
  }

  async listApps(orgSlug?: string): Promise<unknown> {
    const org = orgSlug?.trim() || this.config.orgSlug?.trim();
    return this.request({
      method: 'GET',
      path: '/v1/apps',
      query: org ? { org_slug: org } : undefined,
    });
  }

  async getApp(appName?: string): Promise<unknown> {
    const app = appName?.trim() || this.config.defaultAppName?.trim();
    if (!app) throw new Error(`Fly profile '${this.config.id}' requires defaultAppName or appName.`);
    return this.request({ method: 'GET', path: `/v1/apps/${encodeURIComponent(app)}` });
  }

  async listMachines(appName?: string): Promise<unknown> {
    const app = appName?.trim() || this.config.defaultAppName?.trim();
    if (!app) throw new Error(`Fly profile '${this.config.id}' requires defaultAppName or appName.`);
    return this.request({ method: 'GET', path: `/v1/apps/${encodeURIComponent(app)}/machines` });
  }
}

function extractFlyError(statusCode: number, body: string): string {
  if (!body) return `Request failed with ${statusCode}`;
  try {
    const parsed = JSON.parse(body) as { error?: string; message?: string };
    const message = parsed.error || parsed.message;
    if (message) return `Request failed with ${statusCode}: ${message}`;
  } catch {
    // Use raw text below.
  }
  return `Request failed with ${statusCode}: ${body.slice(0, 300)}`;
}
