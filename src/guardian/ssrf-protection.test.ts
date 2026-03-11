/**
 * Tests for centralized SSRF protection.
 */

import { describe, it, expect } from 'vitest';
import {
  isPrivateAddress,
  checkPrivateAddress,
  validateUrlForSsrf,
  SsrfController,
} from './ssrf-protection.js';
import type { AgentAction } from './guardian.js';

// ─── isPrivateAddress / checkPrivateAddress ───────────────────

describe('isPrivateAddress', () => {
  it('blocks RFC1918 10.x.x.x', () => {
    expect(isPrivateAddress('10.0.0.1')).toBe(true);
    expect(isPrivateAddress('10.255.255.255')).toBe(true);
    expect(checkPrivateAddress('10.0.0.1').reason).toBe('private_ip');
  });

  it('blocks RFC1918 172.16-31.x', () => {
    expect(isPrivateAddress('172.16.0.1')).toBe(true);
    expect(isPrivateAddress('172.31.255.255')).toBe(true);
    expect(isPrivateAddress('172.15.0.1')).toBe(false);
    expect(isPrivateAddress('172.32.0.1')).toBe(false);
  });

  it('blocks RFC1918 192.168.x.x', () => {
    expect(isPrivateAddress('192.168.0.1')).toBe(true);
    expect(isPrivateAddress('192.168.255.255')).toBe(true);
    expect(checkPrivateAddress('192.168.1.1').reason).toBe('private_ip');
  });

  it('blocks 127.x.x.x / localhost', () => {
    expect(isPrivateAddress('127.0.0.1')).toBe(true);
    expect(isPrivateAddress('127.255.255.255')).toBe(true);
    expect(isPrivateAddress('localhost')).toBe(true);
    expect(isPrivateAddress('sub.localhost')).toBe(true);
    expect(checkPrivateAddress('localhost').reason).toBe('loopback');
  });

  it('blocks 169.254.x.x link-local', () => {
    expect(isPrivateAddress('169.254.0.1')).toBe(true);
    expect(isPrivateAddress('169.254.169.254')).toBe(true);
    expect(checkPrivateAddress('169.254.1.1').reason).toBe('link_local');
  });

  it('blocks cloud metadata endpoints', () => {
    expect(isPrivateAddress('169.254.169.254')).toBe(true);
    expect(checkPrivateAddress('metadata.google.internal').reason).toBe('cloud_metadata');
    expect(isPrivateAddress('metadata.google.internal')).toBe(true);
    expect(isPrivateAddress('metadata.goog')).toBe(true);
  });

  it('blocks IPv6 loopback and link-local', () => {
    expect(isPrivateAddress('::1')).toBe(true);
    expect(isPrivateAddress('[::1]')).toBe(true);
    expect(isPrivateAddress('fe80::1')).toBe(true);
    expect(checkPrivateAddress('::1').reason).toBe('loopback');
    expect(checkPrivateAddress('fe80::1').reason).toBe('link_local');
  });

  it('blocks unique local IPv6 (fc/fd)', () => {
    expect(isPrivateAddress('fc00::1')).toBe(true);
    expect(isPrivateAddress('fd12::1')).toBe(true);
    expect(checkPrivateAddress('fd00::1').reason).toBe('private_ip');
  });

  it('blocks IPv4-mapped IPv6', () => {
    expect(isPrivateAddress('::ffff:10.0.0.1')).toBe(true);
    expect(isPrivateAddress('::ffff:127.0.0.1')).toBe(true);
    expect(isPrivateAddress('::ffff:192.168.1.1')).toBe(true);
    expect(checkPrivateAddress('::ffff:10.0.0.1').reason).toBe('ipv4_mapped');
    // Public IPv4-mapped should be allowed
    expect(isPrivateAddress('::ffff:8.8.8.8')).toBe(false);
  });

  it('blocks decimal IP obfuscation (2130706433 = 127.0.0.1)', () => {
    expect(isPrivateAddress('2130706433')).toBe(true); // 127.0.0.1
    expect(isPrivateAddress('167772161')).toBe(true);  // 10.0.0.1
    expect(checkPrivateAddress('2130706433').reason).toBe('obfuscated_ip');
  });

  it('blocks hex IP obfuscation', () => {
    expect(isPrivateAddress('0x7f000001')).toBe(true); // 127.0.0.1
    expect(isPrivateAddress('0x0a000001')).toBe(true); // 10.0.0.1
  });

  it('blocks 0.x.x.x (current network)', () => {
    expect(isPrivateAddress('0.0.0.0')).toBe(true);
    expect(isPrivateAddress('0.1.2.3')).toBe(true);
  });

  it('allows public IPs', () => {
    expect(isPrivateAddress('8.8.8.8')).toBe(false);
    expect(isPrivateAddress('1.1.1.1')).toBe(false);
    expect(isPrivateAddress('93.184.216.34')).toBe(false);
    expect(isPrivateAddress('example.com')).toBe(false);
    expect(isPrivateAddress('api.openai.com')).toBe(false);
  });
});

// ─── validateUrlForSsrf ──────────────────────────────────────

describe('validateUrlForSsrf', () => {
  it('blocks private URLs', async () => {
    const result = await validateUrlForSsrf('http://10.0.0.1/admin');
    expect(result.safe).toBe(false);
    expect(result.reason).toBe('private_ip');
  });

  it('allows public URLs', async () => {
    const result = await validateUrlForSsrf('https://example.com/api');
    expect(result.safe).toBe(true);
  });

  it('blocks cloud metadata', async () => {
    const result = await validateUrlForSsrf('http://169.254.169.254/latest/meta-data/');
    expect(result.safe).toBe(false);
    expect(result.reason).toBe('cloud_metadata');
  });

  it('allowlist overrides private IP check', async () => {
    const result = await validateUrlForSsrf('http://10.0.0.5/api', {
      enabled: true,
      allowlist: ['10.0.0.5'],
    });
    expect(result.safe).toBe(true);
  });

  it('allowPrivateNetworks permits all private ranges', async () => {
    const result = await validateUrlForSsrf('http://192.168.1.1/admin', {
      enabled: true,
      allowPrivateNetworks: true,
    });
    expect(result.safe).toBe(true);
  });

  it('disabled config skips all checks', async () => {
    const result = await validateUrlForSsrf('http://127.0.0.1/secret', {
      enabled: false,
    });
    expect(result.safe).toBe(true);
  });

  it('handles invalid URLs', async () => {
    const result = await validateUrlForSsrf('not-a-url');
    expect(result.safe).toBe(false);
  });
});

// ─── SsrfController (admission pipeline) ─────────────────────

describe('SsrfController', () => {
  function makeAction(type: string, params: Record<string, unknown>): AgentAction {
    return {
      type,
      agentId: 'test-agent',
      capabilities: ['network_access'],
      params,
    };
  }

  it('blocks http_request to private IP', () => {
    const ctrl = new SsrfController();
    const result = ctrl.check(makeAction('http_request', { url: 'http://10.0.0.1/api' }));
    expect(result).not.toBeNull();
    expect(result!.allowed).toBe(false);
    expect(result!.reason).toContain('private_ip');
  });

  it('blocks browser_navigate to metadata endpoint', () => {
    const ctrl = new SsrfController();
    const result = ctrl.check(makeAction('browser_navigate', { url: 'http://169.254.169.254/latest/' }));
    expect(result).not.toBeNull();
    expect(result!.allowed).toBe(false);
    expect(result!.reason).toContain('cloud metadata');
  });

  it('allows public URLs through', () => {
    const ctrl = new SsrfController();
    const result = ctrl.check(makeAction('http_request', { url: 'https://api.openai.com/v1/chat' }));
    expect(result).toBeNull(); // null = pass through
  });

  it('passes through non-HTTP action types', () => {
    const ctrl = new SsrfController();
    const result = ctrl.check(makeAction('read_file', { path: '/etc/passwd' }));
    expect(result).toBeNull();
  });

  it('respects allowlist', () => {
    const ctrl = new SsrfController({ allowlist: ['192.168.1.100'] });
    const result = ctrl.check(makeAction('http_request', { url: 'http://192.168.1.100/api' }));
    expect(result).toBeNull();
  });

  it('respects allowPrivateNetworks', () => {
    const ctrl = new SsrfController({ allowPrivateNetworks: true });
    const result = ctrl.check(makeAction('http_request', { url: 'http://10.0.0.1/api' }));
    expect(result).toBeNull();
  });

  it('skips check when disabled', () => {
    const ctrl = new SsrfController({ enabled: false });
    const result = ctrl.check(makeAction('http_request', { url: 'http://127.0.0.1/secret' }));
    expect(result).toBeNull();
  });

  it('passes through actions without url param', () => {
    const ctrl = new SsrfController();
    const result = ctrl.check(makeAction('http_request', { method: 'POST' }));
    expect(result).toBeNull();
  });
});
