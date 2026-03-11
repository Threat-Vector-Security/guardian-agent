import http from 'node:http';
import https from 'node:https';

export interface CloudflareInstanceConfig {
  id: string;
  name: string;
  apiBaseUrl?: string;
  apiToken: string;
  accountId?: string;
  defaultZoneId?: string;
}

type QueryValue = string | number | boolean | undefined | Array<string | number | boolean>;

export interface CloudflareRequestInput {
  method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  path: string;
  query?: Record<string, QueryValue>;
  body?: unknown;
  headers?: Record<string, string>;
  timeoutMs?: number;
}

interface CloudflareEnvelope<T = unknown> {
  success: boolean;
  errors?: Array<{ code?: number; message?: string } | string>;
  messages?: Array<{ code?: number; message?: string } | string>;
  result: T;
  result_info?: Record<string, unknown>;
}

export class CloudflareClient {
  readonly config: CloudflareInstanceConfig;
  readonly baseUrl: URL;

  constructor(config: CloudflareInstanceConfig) {
    this.config = { ...config };
    this.baseUrl = new URL(config.apiBaseUrl?.trim() || 'https://api.cloudflare.com/client/v4');
  }

  async request<T = unknown>(input: CloudflareRequestInput): Promise<T> {
    const url = new URL(input.path, this.baseUrl);
    for (const [key, value] of Object.entries(input.query ?? {})) {
      appendQueryValue(url.searchParams, key, value);
    }

    const transport = url.protocol === 'http:' ? http : https;
    const bodyText = input.body === undefined ? undefined : JSON.stringify(input.body);
    const headers: Record<string, string> = {
      'Accept': 'application/json',
      'Authorization': `Bearer ${this.config.apiToken}`,
      'User-Agent': 'GuardianAgent-Cloud/1.0',
      ...input.headers,
    };
    if (bodyText !== undefined) {
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = Buffer.byteLength(bodyText).toString();
    }

    return await new Promise<T>((resolve, reject) => {
      const req = transport.request(
        {
          protocol: url.protocol,
          hostname: url.hostname,
          port: url.port || undefined,
          method: input.method,
          path: `${url.pathname}${url.search}`,
          headers,
        },
        (res) => {
          let raw = '';
          res.setEncoding('utf8');
          res.on('data', (chunk) => {
            raw += chunk;
          });
          res.on('end', () => {
            const statusCode = res.statusCode ?? 500;
            const body = raw.trim();
            if (!body) {
              if (statusCode >= 200 && statusCode < 300) {
                resolve({} as T);
                return;
              }
              reject(new Error(`Request failed with ${statusCode}`));
              return;
            }
            let parsed: unknown;
            try {
              parsed = JSON.parse(body);
            } catch (error) {
              reject(new Error(`Invalid JSON response: ${error instanceof Error ? error.message : String(error)}`));
              return;
            }
            if (statusCode < 200 || statusCode >= 300) {
              reject(new Error(extractCloudflareError(statusCode, parsed)));
              return;
            }
            try {
              resolve(unwrapCloudflareResponse(parsed));
            } catch (error) {
              reject(error);
            }
          });
        },
      );

      req.setTimeout(input.timeoutMs ?? 15_000, () => {
        req.destroy(new Error('Request timed out'));
      });
      req.on('error', reject);
      if (bodyText !== undefined) req.write(bodyText);
      req.end();
    });
  }

  async verifyToken(): Promise<unknown> {
    return this.request({ method: 'GET', path: '/user/tokens/verify' });
  }

  async getAccount(): Promise<unknown> {
    if (!this.config.accountId?.trim()) {
      throw new Error(`Cloudflare profile '${this.config.id}' does not define accountId.`);
    }
    return this.request({
      method: 'GET',
      path: `/accounts/${encodeURIComponent(this.config.accountId)}`,
    });
  }

  async listZones(query?: Record<string, QueryValue>): Promise<unknown> {
    return this.request({ method: 'GET', path: '/zones', query });
  }

  async getZone(zoneId: string): Promise<unknown> {
    return this.request({ method: 'GET', path: `/zones/${encodeURIComponent(zoneId)}` });
  }

  async listDnsRecords(zoneId: string, query?: Record<string, QueryValue>): Promise<unknown> {
    return this.request({
      method: 'GET',
      path: `/zones/${encodeURIComponent(zoneId)}/dns_records`,
      query,
    });
  }

  async getDnsRecord(zoneId: string, recordId: string): Promise<unknown> {
    return this.request({
      method: 'GET',
      path: `/zones/${encodeURIComponent(zoneId)}/dns_records/${encodeURIComponent(recordId)}`,
    });
  }

  async createDnsRecord(zoneId: string, body: Record<string, unknown>): Promise<unknown> {
    return this.request({
      method: 'POST',
      path: `/zones/${encodeURIComponent(zoneId)}/dns_records`,
      body,
    });
  }

  async updateDnsRecord(zoneId: string, recordId: string, body: Record<string, unknown>): Promise<unknown> {
    return this.request({
      method: 'PATCH',
      path: `/zones/${encodeURIComponent(zoneId)}/dns_records/${encodeURIComponent(recordId)}`,
      body,
    });
  }

  async deleteDnsRecord(zoneId: string, recordId: string): Promise<unknown> {
    return this.request({
      method: 'DELETE',
      path: `/zones/${encodeURIComponent(zoneId)}/dns_records/${encodeURIComponent(recordId)}`,
    });
  }

  async getZoneSetting(zoneId: string, settingId: string): Promise<unknown> {
    return this.request({
      method: 'GET',
      path: `/zones/${encodeURIComponent(zoneId)}/settings/${encodeURIComponent(settingId)}`,
    });
  }

  async updateZoneSetting(zoneId: string, settingId: string, value: unknown): Promise<unknown> {
    return this.request({
      method: 'PATCH',
      path: `/zones/${encodeURIComponent(zoneId)}/settings/${encodeURIComponent(settingId)}`,
      body: { value },
    });
  }

  async purgeCache(zoneId: string, body: Record<string, unknown>): Promise<unknown> {
    return this.request({
      method: 'POST',
      path: `/zones/${encodeURIComponent(zoneId)}/purge_cache`,
      body,
    });
  }

  async resolveZoneId(zoneIdOrName: string | undefined): Promise<string> {
    const candidate = zoneIdOrName?.trim() || this.config.defaultZoneId?.trim();
    if (!candidate) {
      throw new Error(`Cloudflare profile '${this.config.id}' requires zoneId, zone name, or defaultZoneId.`);
    }
    if (candidate.includes('.')) {
      const zones = await this.listZones({ name: candidate, per_page: 1 });
      if (!Array.isArray(zones) || zones.length === 0) {
        throw new Error(`Cloudflare zone '${candidate}' was not found.`);
      }
      const first = zones[0];
      if (!first || typeof first !== 'object' || Array.isArray(first) || typeof (first as { id?: unknown }).id !== 'string') {
        throw new Error(`Cloudflare zone lookup for '${candidate}' returned an invalid result.`);
      }
      return (first as { id: string }).id;
    }
    return candidate;
  }
}

function unwrapCloudflareResponse<T = unknown>(value: unknown): T {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Invalid Cloudflare API response');
  }
  const envelope = value as CloudflareEnvelope<T>;
  if (!envelope.success) {
    throw new Error(extractCloudflareError(200, value));
  }
  return envelope.result;
}

function extractCloudflareError(statusCode: number, value: unknown): string {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const envelope = value as CloudflareEnvelope;
    const errorMessage = firstCloudflareMessage(envelope.errors) || firstCloudflareMessage(envelope.messages);
    if (errorMessage) {
      return `Request failed with ${statusCode}: ${errorMessage}`;
    }
  }
  return `Request failed with ${statusCode}`;
}

function firstCloudflareMessage(values: CloudflareEnvelope['errors'] | CloudflareEnvelope['messages']): string | undefined {
  if (!values) return undefined;
  for (const entry of values) {
    if (typeof entry === 'string' && entry.trim()) return entry.trim();
    if (entry && typeof entry === 'object' && 'message' in entry && typeof entry.message === 'string' && entry.message.trim()) {
      return entry.message.trim();
    }
  }
  return undefined;
}

function appendQueryValue(params: URLSearchParams, key: string, value: QueryValue): void {
  if (value === undefined) return;
  if (Array.isArray(value)) {
    for (const item of value) {
      params.append(key, String(item));
    }
    return;
  }
  params.set(key, String(value));
}
