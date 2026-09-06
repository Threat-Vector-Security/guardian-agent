import { createHash } from 'node:crypto';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { exportJWK, generateKeyPair, SignJWT, type JWTPayload } from 'jose';
import { EntraOidc, type EntraOidcConfig } from './entra-oidc.js';

const TENANT = '11111111-1111-1111-1111-111111111111';
const ADMIN = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const OPERATOR = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const VIEWER = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
const CLIENT = '22222222-2222-2222-2222-222222222222';
const ISSUER = `https://login.microsoftonline.com/${TENANT}/v2.0`;
const BASE_CONFIG: EntraOidcConfig = {
  tenantId: TENANT, clientId: CLIENT, redirectUri: 'http://127.0.0.1:3000/auth/entra/callback',
  adminGroupIds: [ADMIN], operatorGroupIds: [OPERATOR], viewerGroupIds: [VIEWER],
};
let keys: Awaited<ReturnType<typeof generateKeyPair>>;
let wrongKeys: Awaited<ReturnType<typeof generateKeyPair>>;

beforeAll(async () => {
  [keys, wrongKeys] = await Promise.all([generateKeyPair('RS256'), generateKeyPair('RS256')]);
});

async function fixture(options: {
  claims?: JWTPayload;
  config?: Partial<EntraOidcConfig>;
  wrongSignature?: boolean;
  hmac?: boolean;
  tokenStatus?: number;
  tokenBody?: string;
  keyStatus?: number;
} = {}) {
  let now = Date.now();
  let authorization: URL;
  const key = await exportJWK(keys.publicKey);
  const fetcher = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    if (url === `https://login.microsoftonline.com/${TENANT}/discovery/v2.0/keys`) {
      expect(init?.redirect).toBe('manual');
      return new Response(JSON.stringify({ keys: [{ ...key, kid: 'key1', use: 'sig', alg: 'RS256' }] }), { status: options.keyStatus ?? 200 });
    }
    expect(url).toBe(`https://login.microsoftonline.com/${TENANT}/oauth2/v2.0/token`);
    expect(init?.method).toBe('POST');
    expect(init?.redirect).toBe('manual');
    const body = new URLSearchParams(String(init?.body));
    expect(body.get('grant_type')).toBe('authorization_code');
    expect(body.get('redirect_uri')).toBe(BASE_CONFIG.redirectUri);
    expect(createHash('sha256').update(body.get('code_verifier') ?? '').digest('base64url')).toBe(authorization.searchParams.get('code_challenge'));
    const seconds = Math.floor(now / 1_000);
    const payload: JWTPayload = {
      iss: ISSUER, aud: CLIENT, tid: TENANT, sub: 'pairwise-subject', oid: 'directory-object', name: 'Test Operator',
      iat: seconds, exp: seconds + 600, nonce: authorization.searchParams.get('nonce'), groups: [OPERATOR],
      ...options.claims,
    };
    const token = await new SignJWT(payload)
      .setProtectedHeader({ alg: options.hmac ? 'HS256' : 'RS256', kid: 'key1', jku: 'https://attacker.invalid/keys' })
      .sign(options.hmac ? new Uint8Array(32) : options.wrongSignature ? wrongKeys.privateKey : keys.privateKey);
    return new Response(options.tokenBody ?? JSON.stringify({ id_token: token, access_token: 'must-never-be-returned', refresh_token: 'must-never-be-stored' }), { status: options.tokenStatus ?? 200 });
  });
  const service = new EntraOidc({ ...BASE_CONFIG, ...options.config }, { fetch: fetcher, now: () => now });
  const login = await service.begin();
  authorization = new URL(login.url);
  return { service, login, authorization, fetcher, advance: (milliseconds: number) => { now += milliseconds; } };
}

describe('EntraOidc', () => {
  it('performs PKCE with a signed tenant-bound ID token and returns only a local identity', async () => {
    const { service, login, authorization, fetcher } = await fixture();
    expect(authorization.origin).toBe('https://login.microsoftonline.com');
    expect(authorization.pathname).toBe(`/${TENANT}/oauth2/v2.0/authorize`);
    expect(authorization.searchParams.get('response_type')).toBe('code');
    expect(authorization.searchParams.get('response_mode')).toBe('query');
    expect(authorization.searchParams.get('scope')).toBe('openid profile');
    expect(authorization.searchParams.get('code_challenge_method')).toBe('S256');
    expect(authorization.searchParams.get('state')).toBe(login.state);
    expect(authorization.searchParams.get('nonce')).not.toBe(login.state);
    expect(await service.finish({ code: 'valid-code', state: login.state, cookieState: login.state })).toEqual({
      subject: 'pairwise-subject', issuer: ISSUER, name: 'Test Operator', role: 'operator',
    });
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher.mock.calls.some(([url]) => String(url).includes('attacker'))).toBe(false);
    expect(new URLSearchParams(String(fetcher.mock.calls[0][1]?.body)).has('client_secret')).toBe(false);
  });

  it('includes a confidential client secret only in the token POST', async () => {
    const secret = 'test-secret&with=encoding';
    const { service, login, authorization, fetcher } = await fixture({ config: { clientSecret: secret } });
    expect(authorization.href).not.toContain('test-secret');
    await service.finish({ code: 'valid-code', state: login.state, cookieState: login.state });
    expect(new URLSearchParams(String(fetcher.mock.calls[0][1]?.body)).get('client_secret')).toBe(secret);
  });

  it.each([
    ['wrong issuer', { iss: 'https://attacker.invalid/v2.0' }],
    ['wrong audience', { aud: 'different-app' }],
    ['multiple audiences', { aud: [CLIENT, 'different-app'] }],
    ['wrong tenant', { tid: '33333333-3333-3333-3333-333333333333' }],
    ['wrong nonce', { nonce: 'wrong' }],
    ['missing nonce', { nonce: undefined }],
    ['missing expiry', { exp: undefined }],
    ['expired token', { exp: 1 }],
    ['future issuance', { iat: 9_999_999_999 }],
    ['future not-before', { nbf: 9_999_999_999 }],
    ['wrong authorized party', { azp: 'different-app' }],
    ['missing subject', { sub: undefined }],
    ['unmapped group', { groups: ['dddddddd-dddd-dddd-dddd-dddddddddddd'] }],
    ['missing groups', { groups: undefined }],
    ['malformed groups', { groups: [ADMIN, 5] }],
    ['group overage with group claim', { groups: [ADMIN], _claim_names: { groups: 'src1' } }],
    ['hasgroups overage', { groups: [ADMIN], hasgroups: true }],
  ] satisfies Array<[string, JWTPayload]>)('rejects %s without implicit privilege or token disclosure', async (_name, claims) => {
    const { service, login } = await fixture({ claims });
    await expect(service.finish({ code: 'private-code', state: login.state, cookieState: login.state })).rejects.toThrow('Entra login could not be verified or is not authorized.');
  });

  it.each([{ wrongSignature: true }, { hmac: true }, { keyStatus: 500 }])('rejects invalid signatures, algorithms and unavailable verification keys: %j', async (options) => {
    const { service, login } = await fixture(options);
    await expect(service.finish({ code: 'valid-code', state: login.state, cookieState: login.state })).rejects.toThrow('could not be verified');
  });

  it.each([
    [[VIEWER], 'viewer'],
    [[VIEWER, OPERATOR], 'operator'],
    [[ADMIN, OPERATOR, VIEWER], 'admin'],
  ] as const)('uses explicitly mapped group roles %j => %s', async (groups, role) => {
    const { service, login } = await fixture({ claims: { groups } });
    expect(await service.finish({ code: 'valid-code', state: login.state, cookieState: login.state })).toMatchObject({ role });
  });

  it('requires the browser cookie binder and consumes mismatched attempts', async () => {
    const { service, login, fetcher } = await fixture();
    await expect(service.finish({ code: 'valid-code', state: login.state, cookieState: 'another-browser' })).rejects.toThrow('state is invalid');
    await expect(service.finish({ code: 'valid-code', state: login.state, cookieState: login.state })).rejects.toThrow('state is invalid');
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('rejects expired authorization state before exchanging a code', async () => {
    const { service, login, fetcher, advance } = await fixture();
    advance(300_000);
    await expect(service.finish({ code: 'valid-code', state: login.state, cookieState: login.state })).rejects.toThrow('state is invalid');
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('allows exactly one concurrent callback and prevents replay after success', async () => {
    const { service, login, fetcher } = await fixture();
    const input = { code: 'valid-code', state: login.state, cookieState: login.state };
    const results = await Promise.allSettled([service.finish(input), service.finish(input)]);
    expect(results.map((result) => result.status)).toEqual(['fulfilled', 'rejected']);
    await expect(service.finish(input)).rejects.toThrow('state is invalid');
    expect(fetcher.mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(1);
  });

  it.each([
    { tokenStatus: 302 },
    { tokenStatus: 400, tokenBody: '{"error":"secret-private-code"}' },
    { tokenBody: '{}' },
    { tokenBody: 'not JSON private-code' },
    { tokenBody: 'x'.repeat(256 * 1024 + 1) },
  ])('denies bad token endpoint responses without leaking their contents', async (options) => {
    const { service, login } = await fixture(options);
    await expect(service.finish({ code: 'private-code', state: login.state, cookieState: login.state })).rejects.toThrow('Entra login could not be verified or is not authorized.');
    await expect(service.finish({ code: 'private-code', state: login.state, cookieState: login.state })).rejects.toThrow('state is invalid');
  });

  it('bounds pending login memory and prunes expired attempts', async () => {
    const { service, advance } = await fixture();
    for (let index = 1; index < 1_024; index++) await service.begin();
    await expect(service.begin()).rejects.toThrow('Too many pending');
    advance(300_000);
    await expect(service.begin()).resolves.toMatchObject({ state: expect.any(String) });
  });

  it.each([
    { tenantId: 'common' },
    { tenantId: `${TENANT}/../../attacker` },
    { redirectUri: 'http://192.168.1.10/callback' },
    { redirectUri: 'https://user:password@example.com/callback' },
    { redirectUri: 'https://example.com/callback#fragment' },
    { adminGroupIds: ['Administrators'] },
    { operatorGroupIds: [ADMIN] },
    { adminGroupIds: [], operatorGroupIds: [], viewerGroupIds: [] },
  ])('rejects unsafe or ambiguous configuration %j', (config) => {
    expect(() => new EntraOidc({ ...BASE_CONFIG, ...config })).toThrow();
  });
});
