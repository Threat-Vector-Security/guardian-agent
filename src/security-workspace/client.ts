import { readFile } from 'node:fs/promises';
import { WorkspaceError } from './store.js';
import type { Operation } from './operations.js';

export class SecurityClient {
  private cookie?: string;
  readonly url: string;
  constructor(url: string, private readonly token: string) {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' || parsed.hostname !== '127.0.0.1' || parsed.username || parsed.password || parsed.search || parsed.hash || parsed.pathname !== '/') {
      throw new Error('This local release only accepts http://127.0.0.1:<port> service URLs.');
    }
    this.url = parsed.origin;
  }
  static async fromEnvironment(url = process.env['GUARDIAN_URL'] ?? 'http://127.0.0.1:3000'): Promise<SecurityClient> {
    const file = process.env['GUARDIAN_TOKEN_FILE'];
    const token = file ? (await readFile(file, 'utf8')).trim() : process.env['GUARDIAN_TOKEN'];
    if (!token) throw new Error('Set GUARDIAN_TOKEN_FILE to a scoped client token file, or GUARDIAN_TOKEN.');
    return new SecurityClient(url, token);
  }
  async loginAdmin(): Promise<void> {
    const response = await fetch(`${this.url}/api/v1/session`, {
      method: 'POST', redirect: 'error', signal: AbortSignal.timeout(30000),
      headers: { 'Content-Type': 'application/json', Origin: this.url }, body: JSON.stringify({ token: this.token }),
    });
    const value = await response.json() as { principal?: { role: string }; error?: { message: string } };
    if (!response.ok || value.principal?.role !== 'admin') throw new Error(value.error?.message ?? 'Administrator credential required');
    this.cookie = response.headers.get('set-cookie')?.split(';')[0];
    if (!this.cookie) throw new Error('No administrator session returned');
  }
  private async request(path: string, payload?: unknown): Promise<Record<string, unknown>> {
    const response = await fetch(`${this.url}${path}`, {
      method: payload ? 'POST' : 'GET', redirect: 'error', signal: AbortSignal.timeout(135000),
      headers: { 'Content-Type': 'application/json', ...(this.cookie ? { Cookie: this.cookie, Origin: this.url } : { Authorization: `Bearer ${this.token}` }) },
      ...(payload ? { body: JSON.stringify(payload) } : {}),
    });
    const result = await response.json() as Record<string, unknown>;
    if (!response.ok) throw new WorkspaceError(response.status, (result.error as { message?: string } | undefined)?.message ?? `HTTP ${response.status}`);
    return result;
  }
  async operations(): Promise<Operation[]> { return (await this.request('/api/v1/operations')).items as Operation[]; }
  async execute(operation: string, input: Record<string, unknown> = {}): Promise<unknown> {
    return (await this.request('/api/v1/operations', { operation, input })).result;
  }
}
