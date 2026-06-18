import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('GoogleAuth', () => {
  it('exports GoogleAuth class', async () => {
    const mod = await import('./google-auth.js');
    expect(mod.GoogleAuth).toBeDefined();
    expect(typeof mod.GoogleAuth).toBe('function');
  });

  it('constructs with config', async () => {
    const { GoogleAuth } = await import('./google-auth.js');
    const auth = new GoogleAuth({
      credentialsPath: '/tmp/test-credentials.json',
      callbackPort: 19999,
      scopes: ['https://www.googleapis.com/auth/gmail.modify'],
    });
    expect(auth.isAuthenticated()).toBe(false);
    expect(auth.getTokenExpiry()).toBeUndefined();
  });

  it('getAccessToken throws when no tokens are loaded', async () => {
    const { GoogleAuth } = await import('./google-auth.js');
    const auth = new GoogleAuth({
      credentialsPath: '/tmp/nonexistent.json',
      callbackPort: 19999,
      scopes: [],
    });
    // isAuthenticated is false before any tokens are loaded.
    expect(auth.isAuthenticated()).toBe(false);
    // Stub loadStoredTokens to simulate no stored tokens (avoids reading real secrets file).
    vi.spyOn(auth, 'loadStoredTokens').mockResolvedValue();
    await expect(auth.getAccessToken()).rejects.toThrow(/Not authenticated/);
  });

  it('cancels a pending OAuth flow and clears the callback server state', async () => {
    const { GoogleAuth } = await import('./google-auth.js');
    const auth = new GoogleAuth({
      credentialsPath: '/tmp/test-credentials.json',
      callbackPort: 19999,
      scopes: [],
    });
    const server = { close: vi.fn() };
    const reject = vi.fn();
    const timeoutHandle = setTimeout(() => {}, 10_000);
    (auth as any).pending = {
      codeVerifier: 'verifier',
      state: 'state',
      server,
      resolve: vi.fn(),
      reject,
      timeoutHandle,
    };

    auth.cancelPendingAuth('User closed the popup.');

    expect(server.close).toHaveBeenCalledOnce();
    expect(reject).toHaveBeenCalledWith(expect.objectContaining({ message: 'User closed the popup.' }));
    expect(auth.hasPendingAuth()).toBe(false);
  });

  it('cancels an earlier pending flow before starting a new one', async () => {
    const { GoogleAuth } = await import('./google-auth.js');
    const auth = new GoogleAuth({
      credentialsPath: '/tmp/test-credentials.json',
      callbackPort: 19999,
      scopes: ['scope-a'],
    });
    const server = { close: vi.fn() };
    const reject = vi.fn();
    (auth as any).pending = {
      codeVerifier: 'verifier',
      state: 'state',
      server,
      resolve: vi.fn(),
      reject,
      timeoutHandle: setTimeout(() => {}, 10_000),
    };
    vi.spyOn(auth as any, 'loadClientCredentials').mockResolvedValue({
      client_id: 'client-id',
      client_secret: 'client-secret',
    });
    const startServerSpy = vi.spyOn(auth as any, 'startCallbackServer').mockResolvedValue(undefined);

    const result = await auth.startAuth();

    expect(server.close).toHaveBeenCalledOnce();
    expect(reject).toHaveBeenCalledWith(expect.objectContaining({ message: 'Starting a new OAuth flow.' }));
    expect(startServerSpy).toHaveBeenCalledOnce();
    expect(result.authUrl).toContain('accounts.google.com');
  });

  it('uses a configured web redirect URI without starting the standalone callback server', async () => {
    const { GoogleAuth } = await import('./google-auth.js');
    const auth = new GoogleAuth({
      credentialsPath: '/tmp/test-credentials.json',
      callbackPort: 19999,
      redirectUri: 'https://guardian.example.com/api/google/auth/callback',
      scopes: ['scope-a'],
    });
    vi.spyOn(auth as any, 'loadClientCredentials').mockResolvedValue({
      client_id: 'client-id',
      client_secret: 'client-secret',
    });
    const startServerSpy = vi.spyOn(auth as any, 'startCallbackServer').mockResolvedValue(undefined);

    const result = await auth.startAuth();
    const authUrl = new URL(result.authUrl);

    expect(startServerSpy).not.toHaveBeenCalled();
    expect(auth.hasPendingAuth()).toBe(true);
    expect(authUrl.searchParams.get('redirect_uri')).toBe('https://guardian.example.com/api/google/auth/callback');
    auth.cancelPendingAuth('test cleanup');
  });

  it('exchanges the authorization code when the web callback is handled', async () => {
    const { GoogleAuth } = await import('./google-auth.js');
    const auth = new GoogleAuth({
      credentialsPath: '/tmp/test-credentials.json',
      callbackPort: 19999,
      redirectUri: 'https://guardian.example.com/api/google/auth/callback',
      scopes: ['scope-a'],
    });
    const exchangeSpy = vi.spyOn(auth as any, 'exchangeCode').mockResolvedValue(undefined);
    (auth as any).pending = {
      codeVerifier: 'verifier',
      state: 'state',
      resolve: vi.fn(),
      reject: vi.fn(),
      timeoutHandle: setTimeout(() => {}, 10_000),
    };

    await auth.handleCallback('code', 'state');

    expect(exchangeSpy).toHaveBeenCalledWith('code', 'verifier');
    expect(auth.hasPendingAuth()).toBe(false);
  });

  it('does not exchange twice when waitForCallback is also awaiting the flow', async () => {
    const { GoogleAuth } = await import('./google-auth.js');
    const auth = new GoogleAuth({
      credentialsPath: '/tmp/test-credentials.json',
      callbackPort: 19999,
      redirectUri: 'https://guardian.example.com/api/google/auth/callback',
      scopes: ['scope-a'],
    });
    const exchangeSpy = vi.spyOn(auth as any, 'exchangeCode').mockResolvedValue(undefined);
    (auth as any).pending = {
      codeVerifier: 'verifier',
      state: 'state',
      resolve: vi.fn(),
      reject: vi.fn(),
      timeoutHandle: setTimeout(() => {}, 10_000),
    };

    const waiting = auth.waitForCallback();
    await Promise.resolve();
    await auth.handleCallback('code', 'state');
    await waiting;

    expect(exchangeSpy).toHaveBeenCalledOnce();
    expect(auth.hasPendingAuth()).toBe(false);
  });
});
