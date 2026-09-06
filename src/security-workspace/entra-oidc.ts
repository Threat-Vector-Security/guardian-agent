import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { createRemoteJWKSet, customFetch, jwtVerify } from 'jose';

export interface EntraOidcConfig {
  tenantId: string;
  clientId: string;
  clientSecret?: string;
  redirectUri: string;
  adminGroupIds: string[];
  operatorGroupIds: string[];
  viewerGroupIds: string[];
}

export interface EntraIdentity {
  subject: string;
  issuer: string;
  name: string;
  role: 'admin' | 'operator' | 'viewer';
}

export interface EntraOidcOptions {
  fetch?: typeof globalThis.fetch;
  now?: () => number;
}

const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STATE = /^[A-Za-z0-9_-]{43}$/;
const LOGIN_LIFETIME_MS = 300_000;
const MAX_PENDING_LOGINS = 1_024;

function matchesSecret(actual: unknown, expected: string): boolean {
  return typeof actual === 'string' && Buffer.byteLength(actual) === Buffer.byteLength(expected)
    && timingSafeEqual(Buffer.from(actual), Buffer.from(expected));
}

/** Tenant-bound browser login only. The caller owns the browser cookie and local session lifecycle. */
export class EntraOidc {
  private readonly tenantId: string;
  private readonly clientId: string;
  private readonly clientSecret?: string;
  private readonly redirectUri: string;
  private readonly issuer: string;
  private readonly tokenUrl: string;
  private readonly authorizeUrl: string;
  private readonly fetcher: typeof globalThis.fetch;
  private readonly now: () => number;
  private readonly keys: ReturnType<typeof createRemoteJWKSet>;
  private readonly roles = new Map<string, EntraIdentity['role']>();
  private readonly pending = new Map<string, { nonce: string; verifier: string; expiresAt: number }>();

  constructor(config: EntraOidcConfig, options: EntraOidcOptions = {}) {
    if (!config || typeof config.tenantId !== 'string' || !GUID.test(config.tenantId)) throw new Error('Entra tenantId must be a tenant GUID.');
    if (typeof config.clientId !== 'string' || !config.clientId.trim() || config.clientId.length > 256 || /[\s\x00-\x1f]/.test(config.clientId)) throw new Error('Entra clientId is invalid.');
    if (config.clientSecret !== undefined && (typeof config.clientSecret !== 'string' || !config.clientSecret || config.clientSecret.length > 4_096)) throw new Error('Entra clientSecret is invalid.');
    let redirect: URL;
    try { redirect = new URL(config.redirectUri); }
    catch { throw new Error('Entra redirectUri must be an absolute callback URL.'); }
    const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(redirect.hostname);
    if ((redirect.protocol !== 'https:' && !(redirect.protocol === 'http:' && loopback)) || redirect.username || redirect.password || redirect.hash || redirect.search) {
      throw new Error('Entra callback requires HTTPS or HTTP loopback without credentials, query or fragment.');
    }
    for (const [role, groups] of [['admin', config.adminGroupIds], ['operator', config.operatorGroupIds], ['viewer', config.viewerGroupIds]] as const) {
      if (!Array.isArray(groups) || groups.length > 1_000) throw new Error('Entra role mappings must be bounded arrays of group GUIDs.');
      for (const group of groups) {
        if (typeof group !== 'string' || !GUID.test(group)) throw new Error('Entra role mappings must use group GUIDs.');
        const normalized = group.toLowerCase();
        if (this.roles.has(normalized) && this.roles.get(normalized) !== role) throw new Error('An Entra group cannot map to multiple roles.');
        this.roles.set(normalized, role);
      }
    }
    if (this.roles.size === 0) throw new Error('Entra login requires at least one explicit group-to-role mapping.');
    this.tenantId = config.tenantId.toLowerCase();
    this.clientId = config.clientId;
    this.clientSecret = config.clientSecret;
    this.redirectUri = redirect.href;
    this.issuer = `https://login.microsoftonline.com/${this.tenantId}/v2.0`;
    this.authorizeUrl = `https://login.microsoftonline.com/${this.tenantId}/oauth2/v2.0/authorize`;
    this.tokenUrl = `https://login.microsoftonline.com/${this.tenantId}/oauth2/v2.0/token`;
    this.fetcher = options.fetch ?? globalThis.fetch;
    this.now = options.now ?? Date.now;
    this.keys = createRemoteJWKSet(new URL(`https://login.microsoftonline.com/${this.tenantId}/discovery/v2.0/keys`), {
      timeoutDuration: 10_000,
      [customFetch]: (url, init) => this.fetcher(url, init),
    });
  }

  private prune(): void {
    const now = this.now();
    for (const [state, login] of this.pending) if (login.expiresAt <= now) this.pending.delete(state);
  }

  async begin(): Promise<{ url: string; state: string }> {
    this.prune();
    if (this.pending.size >= MAX_PENDING_LOGINS) throw new Error('Too many pending Entra logins. Try again later.');
    const state = randomBytes(32).toString('base64url');
    const nonce = randomBytes(32).toString('base64url');
    const verifier = randomBytes(32).toString('base64url');
    this.pending.set(state, { nonce, verifier, expiresAt: this.now() + LOGIN_LIFETIME_MS });
    const url = new URL(this.authorizeUrl);
    url.search = new URLSearchParams({
      client_id: this.clientId, response_type: 'code', response_mode: 'query', redirect_uri: this.redirectUri,
      scope: 'openid profile', state, nonce,
      code_challenge: createHash('sha256').update(verifier).digest('base64url'), code_challenge_method: 'S256',
    }).toString();
    return { url: url.href, state };
  }

  async finish(input: { code: string; state: string; cookieState: string }): Promise<EntraIdentity> {
    this.prune();
    if (!input || typeof input.state !== 'string' || !STATE.test(input.state)) throw new Error('Entra login state is invalid or expired.');
    const login = this.pending.get(input.state);
    // Consume before any asynchronous work: parallel callbacks and failed attempts cannot replay a verifier.
    this.pending.delete(input.state);
    if (!login || !matchesSecret(input.cookieState, input.state)) throw new Error('Entra login state is invalid or expired.');
    if (typeof input.code !== 'string' || !input.code || input.code.length > 16_384) throw new Error('Entra authorization code is invalid.');
    const body = new URLSearchParams({
      grant_type: 'authorization_code', client_id: this.clientId, code: input.code,
      redirect_uri: this.redirectUri, code_verifier: login.verifier, scope: 'openid profile',
    });
    if (this.clientSecret !== undefined) body.set('client_secret', this.clientSecret);
    try {
      const response = await this.fetcher(this.tokenUrl, {
        method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body,
        redirect: 'manual', signal: AbortSignal.timeout(10_000),
      });
      if (response.status !== 200) throw new Error('Token exchange rejected.');
      // Bound the token response before parsing. No access or refresh token leaves this method.
      const reader = response.body?.getReader();
      if (!reader) throw new Error('Token exchange returned no body.');
      const chunks: Uint8Array[] = [];
      let size = 0;
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          size += value.byteLength;
          if (size > 256 * 1024) throw new Error('Token response exceeds size limit.');
          chunks.push(value);
        }
      } finally { await reader.cancel(); }
      const tokens: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      if (!tokens || typeof tokens !== 'object' || !('id_token' in tokens) || typeof tokens.id_token !== 'string' || tokens.id_token.length > 65_536) throw new Error('No valid ID token.');
      const { payload } = await jwtVerify(tokens.id_token, this.keys, {
        algorithms: ['RS256'], issuer: this.issuer, audience: this.clientId,
        requiredClaims: ['iss', 'aud', 'sub', 'exp', 'iat', 'nonce', 'tid'],
        currentDate: new Date(this.now()), clockTolerance: 0, maxTokenAge: '10 minutes',
      });
      if (login.expiresAt <= this.now()) throw new Error('Login expired during verification.');
      if (payload.tid !== this.tenantId || payload.aud !== this.clientId || !matchesSecret(payload.nonce, login.nonce)
        || (payload.azp !== undefined && payload.azp !== this.clientId)) throw new Error('Identity binding is invalid.');
      if (typeof payload.sub !== 'string' || !payload.sub || payload.sub.length > 256) throw new Error('Identity subject is invalid.');
      // Group overage needs Graph resolution, which is deliberately not an implicit privilege fallback.
      if (payload.hasgroups !== undefined || payload._claim_names !== undefined || payload._claim_sources !== undefined) throw new Error('Complete group membership is required.');
      if (!Array.isArray(payload.groups) || payload.groups.length > 200 || payload.groups.some((group) => typeof group !== 'string' || !GUID.test(group))) throw new Error('Complete group membership is required.');
      const memberships = new Set(payload.groups.map((group: string) => this.roles.get(group.toLowerCase())));
      const role = (['admin', 'operator', 'viewer'] as const).find((candidate) => memberships.has(candidate));
      if (!role) throw new Error('No mapped application role.');
      const name = typeof payload.name === 'string' && payload.name.length <= 256 ? payload.name : payload.sub;
      return { subject: payload.sub, issuer: this.issuer, name, role };
    } catch {
      // Provider errors may contain authorization codes, secrets or tokens. Keep them out of logs and API errors.
      throw new Error('Entra login could not be verified or is not authorized.');
    }
  }
}
