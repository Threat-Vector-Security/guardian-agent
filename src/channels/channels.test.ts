import { describe, it, expect, afterEach } from 'vitest';
import { PassThrough } from 'node:stream';
import { CLIChannel } from './cli.js';
import { WebChannel } from './web.js';
import type { UserMessage, AgentResponse } from '../agent/types.js';

describe('CLIChannel', () => {
  it('should start and stop without errors', async () => {
    const input = new PassThrough();
    const output = new PassThrough();
    const cli = new CLIChannel({ input, output });

    const handler = async (_msg: UserMessage): Promise<AgentResponse> => {
      return { content: 'response' };
    };

    await cli.start(handler);
    await cli.stop();
  });

  it('should route messages to handler', async () => {
    const input = new PassThrough();
    const output = new PassThrough();
    const cli = new CLIChannel({ input, output });
    const received: UserMessage[] = [];

    const handler = async (msg: UserMessage): Promise<AgentResponse> => {
      received.push(msg);
      return { content: `Echo: ${msg.content}` };
    };

    await cli.start(handler);

    // Simulate user typing
    input.write('Hello world\n');

    // Give async handler time to process
    await new Promise(r => setTimeout(r, 50));

    expect(received.length).toBe(1);
    expect(received[0].content).toBe('Hello world');
    expect(received[0].channel).toBe('cli');

    await cli.stop();
  });

  it('should handle /help command without sending to handler', async () => {
    const input = new PassThrough();
    const output = new PassThrough();
    const cli = new CLIChannel({ input, output });
    const received: UserMessage[] = [];

    const handler = async (msg: UserMessage): Promise<AgentResponse> => {
      received.push(msg);
      return { content: 'response' };
    };

    await cli.start(handler);

    input.write('/help\n');
    await new Promise(r => setTimeout(r, 50));

    // /help should not be sent as a message
    expect(received.length).toBe(0);

    await cli.stop();
  });
});

describe('WebChannel', () => {
  let web: WebChannel | null = null;

  afterEach(async () => {
    if (web) {
      await web.stop();
      web = null;
    }
  });

  it('should start and stop a server', async () => {
    web = new WebChannel({ port: 0 }); // port 0 = random

    // For testing, we need a valid port. Use a high port.
    web = new WebChannel({ port: 18923 });

    const handler = async (_msg: UserMessage): Promise<AgentResponse> => {
      return { content: 'response' };
    };

    await web.start(handler);
    await web.stop();
    web = null;
  });

  it('should respond to health check', async () => {
    web = new WebChannel({ port: 18924 });

    await web.start(async () => ({ content: 'ok' }));

    const res = await fetch('http://localhost:18924/health');
    const body = await res.json() as { status: string };

    expect(res.status).toBe(200);
    expect(body.status).toBe('ok');
  });

  it('should handle POST /api/message', async () => {
    web = new WebChannel({ port: 18925 });
    const received: UserMessage[] = [];

    await web.start(async (msg) => {
      received.push(msg);
      return { content: `Echo: ${msg.content}` };
    });

    const res = await fetch('http://localhost:18925/api/message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: 'Hello' }),
    });

    const body = await res.json() as { content: string };

    expect(res.status).toBe(200);
    expect(body.content).toBe('Echo: Hello');
    expect(received.length).toBe(1);
  });

  it('should return 400 for missing content', async () => {
    web = new WebChannel({ port: 18926 });

    await web.start(async () => ({ content: 'ok' }));

    const res = await fetch('http://localhost:18926/api/message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(400);
  });

  it('should return 404 for unknown routes', async () => {
    web = new WebChannel({ port: 18927 });

    await web.start(async () => ({ content: 'ok' }));

    const res = await fetch('http://localhost:18927/unknown');
    expect(res.status).toBe(404);
  });

  // ─── Fix #4: Web Channel Security Hardening ───────────────────

  describe('Fix #4: Bearer token authentication', () => {
    it('should require auth when authToken is configured', async () => {
      web = new WebChannel({ port: 18930, authToken: 'secret-token-123' });
      await web.start(async () => ({ content: 'ok' }));

      // No auth header → 401
      const res = await fetch('http://localhost:18930/api/status');
      expect(res.status).toBe(401);
      const body = await res.json() as { error: string };
      expect(body.error).toBe('Authentication required');
    });

    it('should reject invalid token', async () => {
      web = new WebChannel({ port: 18931, authToken: 'secret-token-123' });
      await web.start(async () => ({ content: 'ok' }));

      const res = await fetch('http://localhost:18931/api/status', {
        headers: { Authorization: 'Bearer wrong-token' },
      });
      expect(res.status).toBe(403);
      const body = await res.json() as { error: string };
      expect(body.error).toBe('Invalid token');
    });

    it('should accept valid token', async () => {
      web = new WebChannel({ port: 18932, authToken: 'secret-token-123' });
      await web.start(async () => ({ content: 'ok' }));

      const res = await fetch('http://localhost:18932/api/status', {
        headers: { Authorization: 'Bearer secret-token-123' },
      });
      expect(res.status).toBe(200);
    });

    it('should allow health check without auth', async () => {
      web = new WebChannel({ port: 18933, authToken: 'secret-token-123' });
      await web.start(async () => ({ content: 'ok' }));

      const res = await fetch('http://localhost:18933/health');
      expect(res.status).toBe(200);
    });
  });

  describe('Fix #4: CORS origin allowlist', () => {
    it('should not set Access-Control-Allow-Origin when no origins configured', async () => {
      web = new WebChannel({ port: 18934 });
      await web.start(async () => ({ content: 'ok' }));

      const res = await fetch('http://localhost:18934/health', {
        headers: { Origin: 'https://evil.com' },
      });
      expect(res.status).toBe(200);
      // No ACAO header since origin is not in allowed list
      expect(res.headers.get('access-control-allow-origin')).toBeNull();
    });

    it('should reflect allowed origin', async () => {
      web = new WebChannel({ port: 18935, allowedOrigins: ['https://myapp.com'] });
      await web.start(async () => ({ content: 'ok' }));

      const res = await fetch('http://localhost:18935/health', {
        headers: { Origin: 'https://myapp.com' },
      });
      expect(res.headers.get('access-control-allow-origin')).toBe('https://myapp.com');
    });

    it('should reject disallowed origin', async () => {
      web = new WebChannel({ port: 18936, allowedOrigins: ['https://myapp.com'] });
      await web.start(async () => ({ content: 'ok' }));

      const res = await fetch('http://localhost:18936/health', {
        headers: { Origin: 'https://evil.com' },
      });
      expect(res.headers.get('access-control-allow-origin')).toBeNull();
    });
  });

  describe('Fix #4: Request body size limit', () => {
    it('should reject oversized request body', async () => {
      web = new WebChannel({ port: 18937, maxBodyBytes: 100 });
      await web.start(async () => ({ content: 'ok' }));

      const largeContent = 'x'.repeat(200);
      // Server destroys the socket mid-stream, so fetch may get a socket error
      // or a 413 response depending on timing. Either outcome means the body was rejected.
      try {
        const res = await fetch('http://localhost:18937/api/message', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: largeContent }),
        });
        // If we get a response, it should be 413
        expect(res.status).toBe(413);
      } catch (err) {
        // Socket error is expected when server destroys connection mid-stream
        expect((err as Error).message).toContain('fetch failed');
      }
    });

    it('should accept body within limit', async () => {
      web = new WebChannel({ port: 18938, maxBodyBytes: 10000 });
      await web.start(async (msg) => ({ content: `Echo: ${msg.content}` }));

      const res = await fetch('http://localhost:18938/api/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: 'small' }),
      });
      expect(res.status).toBe(200);
    });

    it('should return 400 for invalid JSON', async () => {
      web = new WebChannel({ port: 18939 });
      await web.start(async () => ({ content: 'ok' }));

      const res = await fetch('http://localhost:18939/api/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'not-json{{{',
      });
      expect(res.status).toBe(400);
      const body = await res.json() as { error: string };
      expect(body.error).toBe('Invalid JSON');
    });
  });
});
