import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { GatewayFirewallMonitoringService } from './gateway-monitor.js';
import type { AssistantGatewayMonitoringConfig } from '../config/types.js';

type RunnerMap = Record<string, string | Error>;

const tempDirs: string[] = [];

function makeConfig(overrides: Partial<AssistantGatewayMonitoringConfig> = {}): AssistantGatewayMonitoringConfig {
  return {
    enabled: true,
    scanIntervalSec: 300,
    dedupeWindowMs: 30_000,
    monitors: [{
      id: 'edge-1',
      enabled: true,
      displayName: 'Edge Firewall',
      provider: 'opnsense',
      command: 'collector',
      args: ['--json'],
      timeoutMs: 5_000,
    }],
    ...overrides,
  };
}

function makeRunner(outputs: RunnerMap) {
  return async (command: string, args: string[]): Promise<string> => {
    const key = [command, ...args].join(' ');
    const result = outputs[key];
    if (result instanceof Error) throw result;
    return result ?? '';
  };
}

async function makeTempDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'guardian-gateway-monitor-'));
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, {
    recursive: true,
    force: true,
    maxRetries: 5,
    retryDelay: 50,
  })));
});

describe('GatewayFirewallMonitoringService', () => {
  it('records gateway firewall disablement and configuration drift', async () => {
    const dir = await makeTempDir();
    const persistPath = join(dir, 'gateway-monitor.json');
    const baselineService = new GatewayFirewallMonitoringService({
      config: makeConfig(),
      persistPath,
      runner: makeRunner({
        'collector --json': JSON.stringify({
          displayName: 'HQ Gateway',
          provider: 'opnsense',
          available: true,
          firewallEnabled: true,
          ruleCount: 18,
          wanDefaultAction: 'deny',
          portForwards: ['wan:443->192.168.1.20:443'],
          adminUsers: ['admin'],
          firmwareVersion: '24.7.1',
        }),
      }),
    });
    await baselineService.runCheck();
    await baselineService.persist();

    const service = new GatewayFirewallMonitoringService({
      config: makeConfig(),
      persistPath,
      runner: makeRunner({
        'collector --json': JSON.stringify({
          displayName: 'HQ Gateway',
          provider: 'opnsense',
          available: true,
          firewallEnabled: false,
          ruleCount: 9,
          wanDefaultAction: 'allow',
          portForwards: ['wan:8443->192.168.1.20:8443'],
          adminUsers: ['admin', 'temp-ops'],
          firmwareVersion: '24.7.2',
        }),
      }),
    });
    await service.load();
    const report = await service.runCheck();

    expect(report.alerts).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'gateway_firewall_disabled', severity: 'critical' }),
      expect.objectContaining({ type: 'gateway_firewall_change', severity: 'medium' }),
      expect.objectContaining({ type: 'gateway_port_forward_change', severity: 'high' }),
      expect.objectContaining({ type: 'gateway_admin_change', severity: 'high' }),
    ]));
    expect(report.gateways[0]?.firewallEnabled).toBe(false);
  });

  it('blocks risky actions when critical gateway alerts are active', async () => {
    const dir = await makeTempDir();
    const service = new GatewayFirewallMonitoringService({
      config: makeConfig(),
      persistPath: join(dir, 'gateway-monitor.json'),
      runner: makeRunner({
        'collector --json': JSON.stringify({
          provider: 'opnsense',
          available: true,
          firewallEnabled: false,
          ruleCount: 3,
          wanDefaultAction: 'allow',
          portForwards: [],
          adminUsers: ['admin'],
        }),
      }),
    });

    await service.runCheck();

    expect(service.shouldBlockAction({ type: 'http_request', toolName: 'web_fetch' })).toEqual({
      allowed: false,
      reason: expect.stringContaining('gateway monitoring'),
    });
  });

  it('records monitor errors as alerts', async () => {
    const dir = await makeTempDir();
    const service = new GatewayFirewallMonitoringService({
      config: makeConfig(),
      persistPath: join(dir, 'gateway-monitor.json'),
      runner: makeRunner({
        'collector --json': new Error('connection refused'),
      }),
    });

    const report = await service.runCheck();

    expect(report.alerts).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'gateway_monitor_error', severity: 'medium' }),
    ]));
    expect(report.gateways[0]?.available).toBe(false);
  });
});
