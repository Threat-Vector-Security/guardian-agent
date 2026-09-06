import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { SecurityCollectors } from './collectors.js';

function testDir(): string { return join(tmpdir(), `guardian-collectors-${randomUUID()}`); }

async function windowsOutput(command: string, args: string[]): Promise<string> {
  const script = args.at(-1) ?? '';
  if (command === 'tasklist') return '"System","4","Services","0","100 K"\n';
  if (command === 'reg' || command === 'schtasks') return '';
  if (command === 'netsh') return script === 'state' ? 'Domain Profile Settings:\nState ON\nPrivate Profile Settings:\nState ON\nPublic Profile Settings:\nState ON\n' : 'Rule Name: allow\n';
  if (script.includes('Get-MpComputerStatus')) return JSON.stringify({ AntivirusEnabled: true, RealTimeProtectionEnabled: true, BehaviorMonitorEnabled: true, AntivirusSignatureAge: 1, QuickScanAge: 0, FullScanAge: 4294967295 });
  if (script.includes('Get-MpPreference')) return '{"EnableControlledFolderAccess":1}';
  if (script.includes('Get-NetFirewallProfile')) return '[{"Name":"Private","Enabled":true}]';
  if (script.includes('Get-MpThreatDetection')) return '[]';
  if (script.includes('AntiVirusProduct')) return '[{"displayName":"Other vendor","productState":266240}]';
  if (script.includes('Get-NetNeighbor')) return '[{"IPAddress":"192.168.1.1","State":2}]';
  if (script.includes('Get-NetTCPConnection')) return '[{"LocalAddress":"192.168.1.2","LocalPort":1234,"RemoteAddress":"192.168.1.1","RemotePort":443,"State":5,"OwningProcess":123}]';
  if (script.includes('Start-MpScan')) return '';
  throw new Error(`Unexpected test command: ${command}`);
}

describe('SecurityCollectors', () => {
  it('collects passive snapshots with honest coverage and isolated persistence', async () => {
    const dir = testDir();
    const runner = vi.fn(windowsOutput);
    const collectors = new SecurityCollectors(dir, { platform: 'win32', now: () => 1234, homeDir: dir, runner });
    expect(collectors.supportsScan).toBe(true);
    await collectors.initialize();
    const report = await collectors.check();
    expect(report.host.status).toBe('degraded');
    expect(report.host.data).toMatchObject({ baselineTrust: 'observed_only', partialCoverage: true, snapshot: { processCount: 1 } });
    expect(report.native).toMatchObject({ status: 'available', collectedAt: 1234, data: { inventoryOnly: true, scanSupported: true, antivirusProducts: [{ displayName: 'Other vendor' }], defender: { signatureAgeHours: 24, fullScanAgeHours: null } } });
    expect(report.network).toMatchObject({ status: 'available', data: { passiveOnly: true, neighbors: [{ IPAddress: '192.168.1.1' }] } });
    expect(report.coverage.find((item) => item.id === 'prevention')?.status).toBe('unsupported');
    expect(JSON.parse(await readFile(join(dir, 'host-monitor.json'), 'utf8')).baselineReady).toBe(true);
    expect(JSON.parse(await readFile(join(dir, 'windows-defender.json'), 'utf8')).status.available).toBe(true);
    expect(runner.mock.calls.some(([, args]) => args.some((arg) => /Start-MpScan|Remove-|Set-|Invoke-WebRequest/.test(arg)))).toBe(false);
  });

  it('does not translate command failures into zero host counts or empty network inventory', async () => {
    const dir = testDir();
    const collectors = new SecurityCollectors(dir, { platform: 'win32', homeDir: dir, runner: async () => { throw new Error('access denied'); } });
    const report = await collectors.check();
    expect(report.host).toMatchObject({ status: 'unavailable', data: null });
    expect(report.network).toMatchObject({ status: 'unavailable', data: null });
    expect(report.native.status).toBe('unavailable');
    expect(report.native.data).toMatchObject({ scanSupported: false });
    expect(report.host.errors.length).toBeGreaterThan(0);
  });

  it('reports swallowed host persistence command failures as degraded data', async () => {
    const dir = testDir();
    const collectors = new SecurityCollectors(dir, { platform: 'win32', homeDir: dir, runner: async (command, args) => {
      if (command === 'schtasks') throw new Error('permission denied');
      return windowsOutput(command, args);
    } });
    const report = await collectors.check();
    expect(report.host).toMatchObject({ status: 'degraded', data: null });
    expect(report.host.errors).toEqual(expect.arrayContaining(['schtasks: permission denied']));
  });

  it('keeps successful network evidence when one source fails and preserves freshness across failures', async () => {
    const dir = testDir();
    let failed = false;
    let now = 100;
    const collectors = new SecurityCollectors(dir, { platform: 'win32', homeDir: dir, now: () => now, runner: async (command, args) => {
      if (failed && args.at(-1)?.includes('Get-NetNeighbor')) throw new Error('neighbor query failed');
      return windowsOutput(command, args);
    } });
    await collectors.check();
    failed = true;
    now = 200;
    const report = await collectors.check();
    expect(report.network).toMatchObject({ status: 'degraded', lastSuccessfulAt: 100, collectedAt: 200, data: { neighbors: null, connections: [{ RemotePort: 443 }] } });
  });

  it('marks antivirus collection degraded if threat detection failed despite a valid status query', async () => {
    const dir = testDir();
    const collectors = new SecurityCollectors(dir, { platform: 'win32', homeDir: dir, runner: async (command, args) => {
      if (args.at(-1)?.includes('Get-MpThreatDetection')) throw new Error('detections inaccessible');
      return windowsOutput(command, args);
    } });
    const report = await collectors.check();
    expect(report.native.status).toBe('degraded');
    expect(report.native.errors).toContain('detections inaccessible');
  });

  it('rejects malformed inventory records instead of reporting available empty inventory', async () => {
    const dir = testDir();
    const collectors = new SecurityCollectors(dir, { platform: 'win32', homeDir: dir, runner: async (command, args) => {
      if (args.at(-1)?.includes('Get-NetNeighbor')) return '42';
      return windowsOutput(command, args);
    } });
    const report = await collectors.check();
    expect(report.network).toMatchObject({ status: 'degraded', data: { neighbors: null } });
  });

  it('distinguishes successful scan requests from completion and already-running native scans', async () => {
    const dir = testDir();
    const requested = new SecurityCollectors(dir, { platform: 'win32', runner: windowsOutput });
    expect(await requested.requestScan('quick')).toMatchObject({ state: 'requested', message: expect.stringContaining('completion and clean status are not established') });
    const running = new SecurityCollectors(dir, { platform: 'win32', runner: async () => { throw new Error('A scan is already in progress. (0x80508023)'); } });
    expect(await running.requestScan('full')).toMatchObject({ state: 'already_running' });
  });

  it('reports timed-out scans as unknown and rejects non-enumerated scan types without execution', async () => {
    const runner = vi.fn(async () => { throw Object.assign(new Error('timeout'), { killed: true }); });
    const collectors = new SecurityCollectors(testDir(), { platform: 'win32', runner });
    expect(await collectors.requestScan('full')).toMatchObject({ state: 'unknown' });
    runner.mockClear();
    expect(await collectors.requestScan('quick; Remove-Item' as 'quick')).toMatchObject({ state: 'failed' });
    expect(runner).not.toHaveBeenCalled();
  });

  it('does not auto-install ClamAV or equate executable presence with Linux real-time protection', async () => {
    const runner = vi.fn(async (command: string) => {
      if (command === 'clamscan') return 'ClamAV 1.4.0/12345/Mon Sep 1';
      throw new Error('unavailable');
    });
    const collectors = new SecurityCollectors(testDir(), { platform: 'linux', runner });
    expect(collectors.supportsScan).toBe(false);
    const report = await collectors.check();
    expect(report.native).toMatchObject({ status: 'degraded', data: { provider: 'clamav', inventoryOnly: true, protectionState: 'unknown', scanSupported: false } });
    expect(await collectors.requestScan('quick')).toMatchObject({ state: 'failed' });
    expect(runner.mock.calls.map(([command]) => command)).not.toEqual(expect.arrayContaining(['apt', 'sudo', 'brew']));
  });
});

async function macOutput(command: string, args: string[]): Promise<string> {
  if (command === 'ps') return '123 /usr/bin/ssh\n456 /Applications/Browser.app/Contents/MacOS/Browser\n';
  if (command === 'crontab') return '';
  if (command === 'pfctl') return args.includes('info') ? 'Status: Enabled for 1 days\n' : 'pass all\n';
  if (command === '/usr/sbin/spctl') return 'assessments enabled\n';
  if (command === '/usr/bin/fdesetup') return 'FileVault is On.\n';
  if (command === '/usr/libexec/ApplicationFirewall/socketfilterfw') return 'Firewall is enabled. (State = 1)\n';
  if (command === '/usr/sbin/arp') return '? (192.168.1.1) at aa:bb:cc:dd:ee:ff on en0 ifscope [ethernet]\n? (192.168.1.9) at (incomplete) on en0 ifscope [ethernet]\n';
  if (command === '/usr/sbin/lsof') return 'p456\ncBrowser\nf12\nPTCP\nn192.168.1.2:50423->93.184.216.34:443\nTST=ESTABLISHED\nTQR=0\nTQS=0\nf13\nPUDP\nn*:5353\np123\ncssh\nf5\nPTCP\nn127.0.0.1:2222\nTST=LISTEN\n';
  throw new Error(`Unexpected Mac fixture command: ${command}`);
}

describe('SecurityCollectors macOS', () => {
  it('collects local native settings and passive networks alongside the existing Mac host monitor', async () => {
    const dir = testDir();
    const runner = vi.fn(macOutput);
    const collectors = new SecurityCollectors(dir, { platform: 'darwin', homeDir: dir, now: () => 123, runner });
    expect(collectors.supportsScan).toBe(false);
    await collectors.initialize();
    const report = await collectors.check();
    expect(report.native).toMatchObject({ status: 'available', data: { provider: 'macos_security', scanSupported: false, components: [
      { id: 'gatekeeper', enabled: true, status: 'available', collectedAt: 123 },
      { id: 'filevault', enabled: true, status: 'available' },
      { id: 'application_firewall', enabled: true, status: 'available' },
    ] } });
    expect(report.host).toMatchObject({ status: 'degraded', data: { snapshot: { processCount: 2, firewallBackend: 'pf' } } });
    expect(report.network).toMatchObject({ status: 'degraded', lastSuccessfulAt: 123, data: { connectionFormat: 'macos_lsof', visibility: 'current_user', neighborScope: 'ipv4_cache_only', passiveOnly: true,
      neighbors: [{ address: '192.168.1.1', linkLayerAddress: 'aa:bb:cc:dd:ee:ff', state: 'cached' }, { address: '192.168.1.9', linkLayerAddress: null, state: 'incomplete' }],
      connections: [{ pid: 456, command: 'Browser', protocol: 'TCP', state: 'ESTABLISHED' }, { pid: 456, protocol: 'UDP', state: null }, { pid: 123, command: 'ssh', state: 'LISTEN' }],
    } });
    expect(report.coverage).toEqual(expect.arrayContaining([expect.objectContaining({ id: 'macos:gatekeeper', status: 'available' })]));
    expect(runner).toHaveBeenCalledWith('/usr/sbin/arp', ['-an'], 8_000);
    expect(runner).toHaveBeenCalledWith('/usr/sbin/lsof', ['-nP', '-i', '-FpcfnPT'], 10_000);
    expect(runner.mock.calls.some(([command, args]) => command.includes('sudo') || args.some((arg) => /--set|--disable|--enable|--master|--scan/.test(arg)))).toBe(false);
    runner.mockClear();
    expect(await collectors.requestScan('quick')).toMatchObject({ state: 'failed', message: expect.stringContaining('only for Windows Defender') });
    expect(runner).not.toHaveBeenCalled();
  });

  it('turns confirmed disabled Mac controls into findings and handles fdesetup Off exit status', async () => {
    const dir = testDir();
    const collectors = new SecurityCollectors(dir, { platform: 'darwin', homeDir: dir, runner: async (command, args) => {
      if (command === '/usr/sbin/spctl') return 'assessments disabled';
      if (command === '/usr/bin/fdesetup') throw Object.assign(new Error('exit 1'), { code: 1, stdout: 'FileVault is Off.\n', stderr: '' });
      if (command === '/usr/libexec/ApplicationFirewall/socketfilterfw') return 'Firewall is disabled. (State = 0)';
      return macOutput(command, args);
    } });
    const report = await collectors.check();
    expect(report.native).toMatchObject({ status: 'available', data: { components: [ { enabled: false }, { enabled: false }, { enabled: false } ] } });
    expect(report.findings.filter((finding) => finding.source === 'macos_security').map((finding) => finding.id)).toEqual(['macos:gatekeeper:disabled', 'macos:filevault:disabled', 'macos:application_firewall:disabled']);
  });

  it('keeps localized, transitional and inconsistent Mac status output unknown', async () => {
    const dir = testDir();
    const collectors = new SecurityCollectors(dir, { platform: 'darwin', homeDir: dir, runner: async (command, args) => {
      if (command === '/usr/sbin/spctl') return 'Evaluierungen sind aktiviert';
      if (command === '/usr/bin/fdesetup') return 'FileVault is On.\nEncryption in progress: 50%';
      if (command === '/usr/libexec/ApplicationFirewall/socketfilterfw') return 'Firewall is disabled. (State = 1)';
      return macOutput(command, args);
    } });
    const report = await collectors.check();
    expect(report.native).toMatchObject({ status: 'degraded', data: { components: [ { enabled: null, status: 'degraded' }, { enabled: null, status: 'degraded' }, { enabled: null, status: 'degraded' } ] } });
    expect(report.native.errors).toHaveLength(3);
    expect(report.findings.filter((finding) => finding.source === 'macos_security')).toEqual([]);
  });

  it('reports unavailable Mac sources without zero counts or false healthy states', async () => {
    const collectors = new SecurityCollectors(testDir(), { platform: 'darwin', runner: async () => { throw new Error('Operation not permitted'); } });
    const report = await collectors.check();
    expect(report.native).toMatchObject({ status: 'unavailable', data: { components: [ { enabled: null, status: 'unavailable' }, { enabled: null, status: 'unavailable' }, { enabled: null, status: 'unavailable' } ] } });
    expect(report.network).toMatchObject({ status: 'unavailable', data: null });
    expect(report.host.data).toBeNull();
  });

  it('preserves successful Mac socket evidence when neighbor parsing fails', async () => {
    const dir = testDir();
    const collectors = new SecurityCollectors(dir, { platform: 'darwin', homeDir: dir, runner: async (command, args) => {
      if (command === '/usr/sbin/arp') return 'unexpected localized diagnostic';
      return macOutput(command, args);
    } });
    const report = await collectors.check();
    expect(report.network).toMatchObject({ status: 'degraded', data: { neighbors: null, connections: [{ pid: 456 }, { pid: 456 }, { pid: 123 }], sources: { neighbors: 'unavailable', connections: 'available' } } });
  });

  it('does not turn lsof permission failure or malformed records into an empty connection list', async () => {
    const dir = testDir();
    const collectors = new SecurityCollectors(dir, { platform: 'darwin', homeDir: dir, runner: async (command, args) => {
      if (command === '/usr/sbin/lsof') return 'p456\ncBrowser\nf12\nPTCP\n';
      return macOutput(command, args);
    } });
    const report = await collectors.check();
    expect(report.network).toMatchObject({ status: 'degraded', data: { connections: null, sources: { connections: 'unavailable' } } });
    expect(report.network.errors).toEqual(expect.arrayContaining(['Visible Internet sockets: Incomplete macOS socket record.']));
  });

  it('does not trust FileVault output from unexpected failed or diagnostic commands', async () => {
    const dir = testDir();
    const collectors = new SecurityCollectors(dir, { platform: 'darwin', homeDir: dir, runner: async (command, args) => {
      if (command === '/usr/bin/fdesetup') throw Object.assign(new Error('permission error'), { code: 1, stdout: 'FileVault is Off.', stderr: 'permission denied' });
      return macOutput(command, args);
    } });
    const report = await collectors.check();
    expect(report.native).toMatchObject({ status: 'degraded', data: { components: [ { enabled: true }, { enabled: null, status: 'unavailable' }, { enabled: true } ] } });
  });
});
