import { afterEach, describe, expect, it } from 'vitest';
import { createServer, type Server } from 'node:http';
import { AddressInfo } from 'node:net';
import { CloudflareClient } from './cloudflare-client.js';

const servers: Server[] = [];

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) reject(error);
      else resolve();
    });
  })));
});

describe('cloudflare-client', () => {
  it('unwraps Cloudflare success envelopes with bearer auth', async () => {
    const server = createServer((req, res) => {
      expect(req.method).toBe('GET');
      expect(req.headers.authorization).toBe('Bearer cf-secret');
      expect(req.url).toBe('/zones?per_page=5');
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({
        success: true,
        result: [{ id: 'zone_1', name: 'example.com' }],
      }));
    });
    servers.push(server);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
    const address = server.address() as AddressInfo;

    const client = new CloudflareClient({
      id: 'cf-main',
      name: 'Cloudflare Main',
      apiBaseUrl: `http://127.0.0.1:${address.port}`,
      apiToken: 'cf-secret',
    });

    const result = await client.listZones({ per_page: 5 });
    expect(result).toEqual([{ id: 'zone_1', name: 'example.com' }]);
  });

  it('sends JSON payloads for mutating DNS requests', async () => {
    const server = createServer((req, res) => {
      expect(req.method).toBe('POST');
      expect(req.url).toBe('/zones/zone_1/dns_records');
      let raw = '';
      req.setEncoding('utf8');
      req.on('data', (chunk) => {
        raw += chunk;
      });
      req.on('end', () => {
        expect(JSON.parse(raw)).toEqual({ type: 'A', name: 'app', content: '1.2.3.4' });
        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify({
          success: true,
          result: { id: 'record_1', type: 'A', name: 'app', content: '1.2.3.4' },
        }));
      });
    });
    servers.push(server);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
    const address = server.address() as AddressInfo;

    const client = new CloudflareClient({
      id: 'cf-main',
      name: 'Cloudflare Main',
      apiBaseUrl: `http://127.0.0.1:${address.port}`,
      apiToken: 'cf-secret',
    });

    const result = await client.createDnsRecord('zone_1', { type: 'A', name: 'app', content: '1.2.3.4' });
    expect(result).toEqual({ id: 'record_1', type: 'A', name: 'app', content: '1.2.3.4' });
  });

  it('maps Cloudflare API errors into useful messages', async () => {
    const server = createServer((_req, res) => {
      res.statusCode = 403;
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({
        success: false,
        errors: [{ code: 9109, message: 'Unauthorized to access requested resource' }],
        result: null,
      }));
    });
    servers.push(server);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
    const address = server.address() as AddressInfo;

    const client = new CloudflareClient({
      id: 'cf-main',
      name: 'Cloudflare Main',
      apiBaseUrl: `http://127.0.0.1:${address.port}`,
      apiToken: 'cf-secret',
    });

    await expect(client.listZones()).rejects.toThrow('Request failed with 403: Unauthorized to access requested resource');
  });

  it('sends purge cache payloads to the zone purge endpoint', async () => {
    const server = createServer((req, res) => {
      expect(req.method).toBe('POST');
      expect(req.url).toBe('/zones/zone_1/purge_cache');
      let raw = '';
      req.setEncoding('utf8');
      req.on('data', (chunk) => {
        raw += chunk;
      });
      req.on('end', () => {
        expect(JSON.parse(raw)).toEqual({ tags: ['release-123'] });
        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify({
          success: true,
          result: { id: 'purge_1' },
        }));
      });
    });
    servers.push(server);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
    const address = server.address() as AddressInfo;

    const client = new CloudflareClient({
      id: 'cf-main',
      name: 'Cloudflare Main',
      apiBaseUrl: `http://127.0.0.1:${address.port}`,
      apiToken: 'cf-secret',
    });

    const result = await client.purgeCache('zone_1', { tags: ['release-123'] });
    expect(result).toEqual({ id: 'purge_1' });
  });
});
