import { describe, expect, it } from 'vitest';
import { buildAwsEnvironmentMap, buildLocalEnvironmentMap } from './environment-mapping.js';
import { importContextCypher, type ContextNode } from './contextcypher.js';
import type { AwsSecurityReport } from './aws-security.js';
import type { CollectorTelemetry } from './collectors.js';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { SecurityStore } from './store.js';
import { SecurityWorkspace } from './service.js';

const device = { id: 'device-one', name: 'Workstation', platform: 'win32' };
const network = (neighbors: unknown[]): CollectorTelemetry => ({ status: 'available', data: { neighbors }, collectedAt: 1234, errors: [], description: 'Passive cache only.' });
const aws = (): AwsSecurityReport => ({ accountId: '123456789012', region: 'ap-southeast-2', collectedAt: 1234, status: 'available', coverage: [{ id: 'aws.identity', name: 'Identity', status: 'available', description: 'Verified' }], errors: [], findings: [], resources: { instances: [{ InstanceId: 'i-one', SubnetId: 'subnet-one', SecurityGroups: [{ GroupId: 'sg-one' }, { GroupId: 'sg-missing' }, { GroupId: 'sg-one' }] }], securityGroups: [{ GroupId: 'sg-one', OwnerId: '123456789012' }, { GroupId: 'sg-other', OwnerId: '999999999999' }] } });

describe('environment mapping', () => {
  it('maps Windows, macOS and Linux observed neighbors with stable IDs and cache-only semantics', () => {
    const neighbors = [
      { IPAddress: '192.168.1.1', LinkLayerAddress: 'ab-cd-ef-00-11-22', State: 5, InterfaceIndex: 3 },
      { address: '192.168.1.2', linkLayerAddress: 'ab:cd:ef:00:11:23', state: 'cached', interface: 'en0' },
      { dst: 'fe80::2', lladdr: 'ab:cd:ef:00:11:24', state: ['STALE'], dev: 'eth0' },
    ];
    const result = buildLocalEnvironmentMap(network(neighbors), device);
    expect(result.nodeCount).toBe(4);
    expect(result.edgeCount).toBe(3);
    const reverse = buildLocalEnvironmentMap(network(neighbors.toReversed()), device);
    expect(result.document.nodes).toEqual(reverse.document.nodes);
    expect(JSON.stringify(result.document)).toContain('cache observation');
    expect((result.document.nodes as ContextNode[]).map(item => item.type)).toEqual(['workstation', 'generic', 'generic', 'generic']);
    expect(importContextCypher(JSON.stringify(result.document)).document).toEqual(result.document);
  });

  it('does not invent inventory from sockets, invalid, multicast, incomplete or duplicate entries', () => {
    const neighbors = [
      { IPAddress: '192.168.1.1', LinkLayerAddress: 'ab-cd-ef-00-11-22', State: 5, InterfaceIndex: 3 },
      { IPAddress: '192.168.1.1', LinkLayerAddress: 'ab-cd-ef-00-11-22', State: 5, InterfaceIndex: 3 },
      ...['224.0.0.1', 'ff02::1', '0.0.0.0', 'invalid', '127.0.0.1'].map(IPAddress => ({ IPAddress, LinkLayerAddress: 'ab-cd-ef-00-11-22', State: 5 })),
      { address: '192.168.1.3', linkLayerAddress: 'ab:cd:ef:00:11:23', state: 'incomplete' },
      { IPAddress: '192.168.1.4', LinkLayerAddress: '00-00-00-00-00-00', State: 1 },
    ];
    expect(buildLocalEnvironmentMap(network(neighbors), device).nodeCount).toBe(2);
    const empty = buildLocalEnvironmentMap(network([]), device);
    expect(empty.edgeCount).toBe(0);
    expect(empty.warnings.join(' ')).toContain('does not mean');
    expect(() => buildLocalEnvironmentMap({ ...network([]), data: { connections: ['1.2.3.4'] } }, device)).toThrow('No neighbor inventory');
  });

  it('limits neighbor maps without silently claiming complete coverage', () => {
    const neighbors = Array.from({ length: 1005 }, (_, index) => ({ address: `10.0.${Math.floor(index / 254)}.${index % 254 + 1}`, linkLayerAddress: 'ab:cd:ef:00:11:23', state: 'cached', interface: 'en0' }));
    const result = buildLocalEnvironmentMap(network(neighbors), device);
    expect(result.nodeCount).toBe(1001);
    expect(result.warnings.join(' ')).toContain('limited to 1000');
  });

  it('maps only observed AWS associations, removes cross-account groups and produces valid import documents', () => {
    const report = aws();
    const result = buildAwsEnvironmentMap(report, report);
    expect(result.nodeCount).toBe(2);
    expect(result.edgeCount).toBe(1);
    expect(JSON.stringify(result.document)).not.toContain('sg-other');
    expect(JSON.stringify(result.document)).not.toContain('sg-missing');
    expect(JSON.stringify(result.document)).toContain('subnet-one');
    expect(importContextCypher(JSON.stringify(result.document)).document).toEqual(result.document);
    expect((buildAwsEnvironmentMap({ ...report, collectedAt: 2000 }, report).document.nodes as ContextNode[]).map(item => item.id)).toEqual((result.document.nodes as ContextNode[]).map(item => item.id));
  });

  it('rejects mismatched scopes and failed AWS identity; preserves partial coverage', () => {
    const report = aws();
    expect(() => buildAwsEnvironmentMap(report, { ...report, accountId: '999999999999' })).toThrow('does not match');
    expect(() => buildAwsEnvironmentMap(report, { ...report, region: 'us-east-1' })).toThrow('does not match');
    expect(() => buildAwsEnvironmentMap({ ...report, coverage: [] }, report)).toThrow('identity was not verified');
    const partial = buildAwsEnvironmentMap({ ...report, status: 'degraded', errors: [{ source: 'ec2', code: 'Truncated', message: 'Partial inventory' }] }, report);
    expect(partial.warnings).toContain('ec2: Partial inventory');
  });

  it('enforces installation and cloud scopes without invoking collection or allowing target overrides', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'guardian-environment-test-'));
    const store = new SecurityStore(dir);
    const workspace = new SecurityWorkspace(store, { check: async () => { throw new Error('Unexpected host collection'); }, requestScan: async () => { throw new Error('Unexpected scan'); } }, { target: 'aws:123456789012:ap-southeast-2', check: async () => { throw new Error('Unexpected AWS collection'); }, close: () => {} });
    try {
      const createClient = (scopes: string[], projectIds?: string[]) => store.createClient({ name: 'test', role: 'viewer', scopes, ...(projectIds ? { projectIds } : {}), expiresAt: Date.now() + 600000 }, 'bootstrap').client;
      const reader = createClient(['security:read']);
      const cloudReader = createClient(['security:read', 'cloud:read']);
      const scoped = createClient(['security:read', 'cloud:read'], ['selected-project']);
      store.put('meta', 'status', { network: network([]) });
      store.put('aws-status', 'aws:123456789012:ap-southeast-2', aws());
      await expect(workspace.execute(reader, 'assistant', 'environments.preview', { source: 'local' })).resolves.toMatchObject({ source: 'local', nodeCount: 1 });
      await expect(workspace.execute(reader, 'assistant', 'environments.preview', { source: 'aws' })).rejects.toMatchObject({ status: 403 });
      await expect(workspace.execute(cloudReader, 'assistant', 'environments.preview', { source: 'aws' })).resolves.toMatchObject({ source: 'aws', nodeCount: 2 });
      for (const source of ['local', 'aws']) await expect(workspace.execute(scoped, 'assistant', 'environments.preview', { source })).rejects.toMatchObject({ status: 403 });
      await expect(workspace.execute(cloudReader, 'assistant', 'environments.preview', { source: 'aws', accountId: '999999999999' })).rejects.toMatchObject({ status: 400 });
      expect(store.count('job')).toBe(0);
      expect(store.count('project')).toBe(0);
    } finally {
      await workspace.close(); store.close();
      if (dirname(resolve(dir)) !== resolve(tmpdir()) || !basename(dir).startsWith('guardian-environment-test-')) throw new Error('Unexpected temporary directory');
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
