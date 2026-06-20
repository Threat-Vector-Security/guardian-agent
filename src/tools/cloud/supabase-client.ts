import http from 'node:http';
import https from 'node:https';

export interface SupabaseInstanceConfig {
  id: string;
  name: string;
  apiBaseUrl?: string;
  accessToken: string;
  organizationId?: string;
  projectRef?: string;
}

export interface SupabaseRequestInput {
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  path: string;
  query?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
  timeoutMs?: number;
}

export class SupabaseClient {
  readonly config: SupabaseInstanceConfig;
  readonly baseUrl: URL;

  constructor(config: SupabaseInstanceConfig) {
    this.config = { ...config };
    this.baseUrl = new URL(config.apiBaseUrl?.trim() || 'https://api.supabase.com');
  }

  async request<T = unknown>(input: SupabaseRequestInput): Promise<T> {
    const url = new URL(input.path, this.baseUrl);
    for (const [key, value] of Object.entries(input.query ?? {})) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }

    const bodyText = input.body === undefined ? undefined : JSON.stringify(input.body);
    const headers: Record<string, string> = {
      'Accept': 'application/json',
      'Authorization': `Bearer ${this.config.accessToken}`,
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
            reject(new Error(extractSupabaseError(statusCode, body)));
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

  async listProjects(): Promise<unknown> {
    return this.request({ method: 'GET', path: '/v1/projects' });
  }

  async getProject(projectRef?: string): Promise<unknown> {
    const ref = projectRef?.trim() || this.config.projectRef?.trim();
    if (!ref) throw new Error(`Supabase profile '${this.config.id}' requires projectRef.`);
    return this.request({ method: 'GET', path: `/v1/projects/${encodeURIComponent(ref)}` });
  }
}

function extractSupabaseError(statusCode: number, body: string): string {
  if (!body) return `Request failed with ${statusCode}`;
  try {
    const parsed = JSON.parse(body) as { message?: string; error?: string };
    const message = parsed.message || parsed.error;
    if (message) return `Request failed with ${statusCode}: ${message}`;
  } catch {
    // Use raw text below.
  }
  return `Request failed with ${statusCode}: ${body.slice(0, 300)}`;
}
