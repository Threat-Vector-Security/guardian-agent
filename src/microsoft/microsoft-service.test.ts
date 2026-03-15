/**
 * Unit tests for MicrosoftService.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MicrosoftService } from './microsoft-service.js';
import type { MicrosoftServiceConfig } from './microsoft-service.js';
import type { MicrosoftAuth } from './microsoft-auth.js';
import type { MicrosoftExecuteParams } from './types.js';

function mockAuth(overrides?: Partial<MicrosoftAuth>): MicrosoftAuth {
  return {
    getAccessToken: vi.fn().mockResolvedValue('test-access-token-123'),
    isAuthenticated: vi.fn().mockReturnValue(true),
    getTokenExpiry: vi.fn().mockReturnValue(Date.now() + 3600_000),
    ...overrides,
  } as unknown as MicrosoftAuth;
}

function makeService(authOverrides?: Partial<MicrosoftAuth>, config?: MicrosoftServiceConfig): MicrosoftService {
  return new MicrosoftService(mockAuth(authOverrides), config);
}

describe('MicrosoftService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('construction', () => {
    it('defaults to standard services', () => {
      const svc = makeService();
      expect(svc.getEnabledServices()).toEqual(['mail', 'calendar', 'onedrive', 'contacts']);
    });

    it('uses configured services', () => {
      const svc = makeService(undefined, { services: ['mail', 'contacts'] });
      expect(svc.getEnabledServices()).toEqual(['mail', 'contacts']);
      expect(svc.isServiceEnabled('calendar')).toBe(false);
    });
  });

  describe('isServiceEnabled', () => {
    it('matches case-insensitively', () => {
      const svc = makeService();
      expect(svc.isServiceEnabled('Mail')).toBe(true);
      expect(svc.isServiceEnabled('CALENDAR')).toBe(true);
    });
  });

  describe('isAuthenticated', () => {
    it('delegates to auth', () => {
      const svc = makeService();
      expect(svc.isAuthenticated()).toBe(true);
    });

    it('returns false when auth says no', () => {
      const svc = makeService({ isAuthenticated: vi.fn().mockReturnValue(false) } as any);
      expect(svc.isAuthenticated()).toBe(false);
    });
  });

  describe('execute', () => {
    it('rejects disabled service', async () => {
      const svc = makeService(undefined, { services: ['mail'] });
      const result = await svc.execute({
        service: 'calendar',
        resource: 'me/events',
        method: 'list',
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain('not enabled');
    });

    it('allows user service even if not in services list', async () => {
      // The 'user' service is always allowed (for /me endpoint)
      const svc = makeService(undefined, { services: ['mail'] });

      // Mock fetch for this test
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: () => Promise.resolve(JSON.stringify({ displayName: 'Test User', mail: 'test@example.com' })),
      });
      vi.stubGlobal('fetch', mockFetch);

      const result = await svc.execute({
        service: 'user',
        resource: 'me',
        method: 'get',
      });

      expect(result.success).toBe(true);
      vi.unstubAllGlobals();
    });

    it('makes correct GET request for list', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: () => Promise.resolve(JSON.stringify({ value: [{ id: '1', subject: 'Test' }] })),
      });
      vi.stubGlobal('fetch', mockFetch);

      const svc = makeService();
      const result = await svc.execute({
        service: 'mail',
        resource: 'me/messages',
        method: 'list',
        params: { $top: 5, $select: 'subject' },
      });

      expect(result.success).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(1);

      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toContain('graph.microsoft.com/v1.0/me/messages');
      expect(url).toContain('%24top=5');
      expect(url).toContain('%24select=subject');
      expect(opts.method).toBe('GET');
      expect(opts.headers.Authorization).toBe('Bearer test-access-token-123');

      vi.unstubAllGlobals();
    });

    it('makes correct POST request for create', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 201,
        text: () => Promise.resolve(JSON.stringify({ id: 'new-msg-id', subject: 'Draft' })),
      });
      vi.stubGlobal('fetch', mockFetch);

      const svc = makeService();
      const result = await svc.execute({
        service: 'mail',
        resource: 'me/messages',
        method: 'create',
        json: {
          subject: 'Draft',
          body: { contentType: 'Text', content: 'Hello' },
          toRecipients: [{ emailAddress: { address: 'test@example.com' } }],
        },
      });

      expect(result.success).toBe(true);
      const [, opts] = mockFetch.mock.calls[0];
      expect(opts.method).toBe('POST');
      expect(opts.headers['Content-Type']).toBe('application/json');

      const body = JSON.parse(opts.body);
      expect(body.subject).toBe('Draft');

      vi.unstubAllGlobals();
    });

    it('handles 204 No Content response', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 204,
        text: () => Promise.resolve(''),
      });
      vi.stubGlobal('fetch', mockFetch);

      const svc = makeService();
      const result = await svc.execute({
        service: 'mail',
        resource: 'me/messages',
        method: 'delete',
        id: 'msg-123',
      });

      expect(result.success).toBe(true);
      expect(result.data).toBeNull();

      vi.unstubAllGlobals();
    });

    it('handles error response', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        text: () => Promise.resolve(JSON.stringify({
          error: { code: 'InvalidAuthenticationToken', message: 'Access token is expired.' },
        })),
      });
      vi.stubGlobal('fetch', mockFetch);

      const svc = makeService();
      const result = await svc.execute({
        service: 'mail',
        resource: 'me/messages',
        method: 'list',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Access token is expired');

      vi.unstubAllGlobals();
    });

    it('inserts id into resource path', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: () => Promise.resolve(JSON.stringify({ id: 'msg-123', subject: 'Test' })),
      });
      vi.stubGlobal('fetch', mockFetch);

      const svc = makeService();
      await svc.execute({
        service: 'mail',
        resource: 'me/messages',
        method: 'get',
        id: 'msg-123',
      });

      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain('me/messages/msg-123');

      vi.unstubAllGlobals();
    });

    it('handles network errors gracefully', async () => {
      const mockFetch = vi.fn().mockRejectedValue(new Error('Network timeout'));
      vi.stubGlobal('fetch', mockFetch);

      const svc = makeService();
      const result = await svc.execute({
        service: 'mail',
        resource: 'me/messages',
        method: 'list',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Network timeout');

      vi.unstubAllGlobals();
    });
  });

  describe('sendOutlookMessage', () => {
    it('sends via /me/sendMail with correct body', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 202,
        text: () => Promise.resolve(''),
      });
      vi.stubGlobal('fetch', mockFetch);

      const svc = makeService();
      const result = await svc.sendOutlookMessage({
        to: 'user@example.com',
        subject: 'Hello',
        body: 'World',
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ status: 'sent', to: 'user@example.com' });

      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toBe('https://graph.microsoft.com/v1.0/me/sendMail');
      expect(opts.method).toBe('POST');

      const body = JSON.parse(opts.body);
      expect(body.message.subject).toBe('Hello');
      expect(body.message.toRecipients[0].emailAddress.address).toBe('user@example.com');

      vi.unstubAllGlobals();
    });
  });

  describe('createOutlookDraft', () => {
    it('creates draft via /me/messages', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 201,
        text: () => Promise.resolve(JSON.stringify({
          id: 'draft-id-123',
          subject: 'Draft Subject',
        })),
      });
      vi.stubGlobal('fetch', mockFetch);

      const svc = makeService();
      const result = await svc.createOutlookDraft({
        to: 'user@example.com',
        subject: 'Draft Subject',
        body: 'Draft body',
      });

      expect(result.success).toBe(true);

      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toContain('me/messages');
      expect(opts.method).toBe('POST');

      vi.unstubAllGlobals();
    });
  });

  describe('schema', () => {
    it('returns exact match', () => {
      const svc = makeService();
      const result = svc.schema('mail.messages.list');
      expect(result.success).toBe(true);
      expect(result.data.method).toBe('GET');
      expect(result.data.description).toContain('messages');
    });

    it('returns prefix matches', () => {
      const svc = makeService();
      const result = svc.schema('mail');
      expect(result.success).toBe(true);
      expect(result.data.matches.length).toBeGreaterThan(1);
    });

    it('lists all paths when no match', () => {
      const svc = makeService();
      const result = svc.schema('nonexistent.endpoint');
      expect(result.success).toBe(true);
      expect(result.data.paths).toBeDefined();
      expect(result.data.paths.length).toBeGreaterThan(0);
    });
  });

  describe('inferHttpMethod', () => {
    it('maps method names to HTTP verbs correctly', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true, status: 200,
        text: () => Promise.resolve('{}'),
      });
      vi.stubGlobal('fetch', mockFetch);

      const svc = makeService();

      // list → GET
      await svc.execute({ service: 'mail', resource: 'me/messages', method: 'list' });
      expect(mockFetch.mock.calls[0][1].method).toBe('GET');

      // delete → DELETE
      await svc.execute({ service: 'mail', resource: 'me/messages', method: 'delete', id: '123' });
      expect(mockFetch.mock.calls[1][1].method).toBe('DELETE');

      // update → PATCH
      await svc.execute({ service: 'mail', resource: 'me/messages', method: 'update', id: '123', json: { isRead: true } });
      expect(mockFetch.mock.calls[2][1].method).toBe('PATCH');

      // create → POST
      await svc.execute({ service: 'mail', resource: 'me/messages', method: 'create', json: { subject: 'Test' } });
      expect(mockFetch.mock.calls[3][1].method).toBe('POST');

      vi.unstubAllGlobals();
    });
  });
});
