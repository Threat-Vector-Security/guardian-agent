import { execFile as execFileCallback } from 'node:child_process';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { DEFAULT_CONFIG } from '../config/types.js';
import { HostMonitoringService } from '../runtime/host-monitor.js';
import { WindowsDefenderProvider } from '../runtime/windows-defender-provider.js';
import { mkdirSecure } from '../util/secure-fs.js';

const execFile = promisify(execFileCallback);
type Runner = (command: string, args: string[], timeoutMs?: number) => Promise<string>;
type Status = 'available' | 'degraded' | 'unavailable' | 'unsupported';

export interface CollectorTelemetry {
  status: Status;
  collectedAt: number;
  lastSuccessfulAt?: number;
  data: unknown | null;
  errors: string[];
  description: string;
}

export interface CollectorFinding {
  id: string;
  source: string;
  severity: string;
  title: string;
  description: string;
  evidence: unknown;
  observedAt: number;
}

export interface CollectorReport {
  host: CollectorTelemetry;
  native: CollectorTelemetry;
  network: CollectorTelemetry;
  findings: CollectorFinding[];
  coverage: Array<{ id: string; name: string; status: string; description: string; lastUpdatedAt?: number }>;
}

export interface ScanRequestResult {
  state: 'requested' | 'already_running' | 'failed' | 'unknown';
  message: string;
  evidence?: unknown;
}

export interface SecurityCollectorsOptions {
  platform?: NodeJS.Platform;
  now?: () => number;
  runner?: Runner;
  homeDir?: string;
}

export interface MacSecurityComponent {
  id: 'gatekeeper' | 'filevault' | 'application_firewall';
  name: string;
  status: Status;
  enabled: boolean | null;
  collectedAt: number;
  scope: string;
  raw?: string;
  error?: string;
}

// Only literal, application-owned commands reach the runner. No caller can supply a script or path.
async function runNative(command: string, args: string[], timeoutMs = 20_000): Promise<string> {
  const result = await execFile(command, args, {
    timeout: Math.min(timeoutMs, 20_000), windowsHide: true, encoding: 'utf8', maxBuffer: 4 * 1024 * 1024,
  });
  // spctl status is written to stderr on macOS; do not discard it as an absent status.
  return command === '/usr/sbin/spctl' && args.length === 1 && args[0] === '--status'
    ? [result.stdout.trim(), result.stderr.trim()].filter(Boolean).join('\n')
    : result.stdout;
}

function errorMessage(error: unknown): string {
  return (error instanceof Error ? error.message : String(error)).slice(0, 1_000);
}

function jsonRows(raw: string): Record<string, unknown>[] {
  // Empty PowerShell pipeline output is a legitimate empty collection; malformed output is not.
  if (!raw.trim()) return [];
  const parsed: unknown = JSON.parse(raw);
  const rows = parsed === null ? [] : Array.isArray(parsed) ? parsed : [parsed];
  if (rows.some((row) => !row || typeof row !== 'object' || Array.isArray(row))) {
    throw new Error('Native collection returned an invalid record.');
  }
  return rows as Record<string, unknown>[];
}

function macNeighbors(raw: string): Array<{ address: string; linkLayerAddress: string | null; interface: string; state: string }> {
  return raw.split('\n').map((line) => line.trim()).filter(Boolean).map((line) => {
    const match = /^\S+ \((\d{1,3}(?:\.\d{1,3}){3})\) at ((?:[a-f0-9]{1,2}:){5}[a-f0-9]{1,2}|\(incomplete\)) on (\S+)(?: .*)?$/i.exec(line);
    if (!match || match[1].split('.').some((part) => Number(part) > 255)) throw new Error('Unrecognized macOS ARP output.');
    return { address: match[1], linkLayerAddress: match[2] === '(incomplete)' ? null : match[2], interface: match[3], state: match[2] === '(incomplete)' ? 'incomplete' : 'cached' };
  });
}

function macConnections(raw: string): Array<Record<string, unknown>> {
  const result: Array<Record<string, unknown>> = [];
  let pid: number | undefined;
  let command = '';
  let socket: Record<string, unknown> | undefined;
  const flush = () => {
    if (socket) {
      if (typeof socket.endpoint !== 'string' || !socket.endpoint || !pid) throw new Error('Incomplete macOS socket record.');
      result.push(socket);
    }
    socket = undefined;
  };
  // lsof field mode avoids parsing aligned columns and preserves process/descriptor association.
  for (const line of raw.split('\n').filter(Boolean)) {
    const value = line.slice(1);
    switch (line[0]) {
      case 'p':
        flush();
        if (!/^\d+$/.test(value) || Number(value) <= 0) throw new Error('Invalid macOS socket process ID.');
        pid = Number(value); command = ''; break;
      case 'c': command = value; break;
      case 'f':
        flush();
        if (!pid) throw new Error('macOS socket record has no process.');
        socket = { pid, command, descriptor: value, state: null }; break;
      case 'n': if (!socket) throw new Error('macOS socket endpoint has no descriptor.'); socket.endpoint = value; break;
      case 'P': if (!socket) throw new Error('macOS socket protocol has no descriptor.'); socket.protocol = value; break;
      case 'T': if (!socket) throw new Error('macOS socket state has no descriptor.'); if (value.startsWith('ST=')) socket.state = value.slice(3); break;
      default: throw new Error('Unrecognized macOS socket output.');
    }
  }
  flush();
  if (raw.trim() && result.length === 0) throw new Error('Incomplete macOS socket output.');
  return result;
}

function macEnabled(id: MacSecurityComponent['id'], raw: string): boolean | null {
  const value = raw.trim();
  if (id === 'gatekeeper') return /^assessments enabled$/i.test(value) ? true : /^assessments disabled$/i.test(value) ? false : null;
  if (id === 'filevault') return /^FileVault is On\.$/i.test(value) ? true : /^FileVault is Off\.$/i.test(value) ? false : null;
  return /^Firewall is enabled\. \(State = [12]\)$/i.test(value) ? true : /^Firewall is disabled\. \(State = 0\)$/i.test(value) ? false : null;
}

export class SecurityCollectors {
  private readonly platform: NodeJS.Platform;
  private readonly now: () => number;
  private readonly runner: Runner;
  private readonly host: HostMonitoringService;
  private readonly defender: WindowsDefenderProvider;
  private hostErrors: string[] = [];
  private defenderErrors: string[] = [];
  private readonly successful = new Map<string, number>();
  private pendingCheck?: Promise<CollectorReport>;
  private pendingScan?: Promise<ScanRequestResult>;

  get supportsScan(): boolean { return this.platform === 'win32'; }

  constructor(private readonly dataDir: string, options: SecurityCollectorsOptions = {}) {
    this.platform = options.platform ?? process.platform;
    this.now = options.now ?? Date.now;
    this.runner = options.runner ?? runNative;
    const defaults = DEFAULT_CONFIG.assistant.hostMonitoring;
    this.host = new HostMonitoringService({
      config: { ...defaults, enabled: true, monitorNetwork: false, sensitivePaths: defaults.sensitivePaths.filter((path) => !path.includes('.guardianagent')) },
      persistPath: join(dataDir, 'host-monitor.json'), platform: this.platform, now: this.now, homeDir: options.homeDir,
      runner: async (command, args, timeout) => {
        try { return await this.runner(command, args, timeout); }
        catch (error) { this.hostErrors.push(`${command}: ${errorMessage(error)}`); throw error; }
      },
    });
    this.defender = new WindowsDefenderProvider({
      persistPath: join(dataDir, 'windows-defender.json'), platform: this.platform, now: this.now,
      runner: async (command, args, timeout) => {
        try {
          const hardenedArgs = args.map((arg, index) => index === args.length - 1 ? `$ErrorActionPreference = 'Stop'; ${arg}` : arg);
          return await this.runner(command, hardenedArgs, timeout);
        } catch (error) { this.defenderErrors.push(errorMessage(error)); throw error; }
      },
    });
  }

  async initialize(): Promise<void> {
    await mkdirSecure(this.dataDir);
    await Promise.all([this.host.load(), this.defender.load()]);
  }

  async check(): Promise<CollectorReport> {
    if (this.pendingCheck) return this.pendingCheck;
    const pending = this.collect();
    this.pendingCheck = pending;
    try { return await pending; }
    finally { if (this.pendingCheck === pending) this.pendingCheck = undefined; }
  }

  private telemetry(id: string, status: Status, data: unknown, errors: string[], description: string): CollectorTelemetry {
    const collectedAt = this.now();
    if (status === 'available') this.successful.set(id, collectedAt);
    return { status, collectedAt, lastSuccessfulAt: this.successful.get(id), data, errors, description };
  }

  private async collect(): Promise<CollectorReport> {
    const [host, native, network] = await Promise.all([this.collectHost(), this.collectNative(), this.collectNetwork()]);
    const findings: CollectorFinding[] = [];
    // Best-effort collectors can resolve alerts after incomplete queries. Do not present those as a clean bill of health.
    if (host.data !== null) {
      for (const alert of this.host.listAlerts()) findings.push({
        id: `host:${alert.id}`, source: 'host', severity: alert.severity, title: alert.type.replaceAll('_', ' '),
        description: alert.description, evidence: { ...alert.evidence, heuristic: true }, observedAt: alert.lastSeenAt,
      });
    }
    if (this.platform === 'win32') {
      for (const alert of this.defender.listAlerts()) findings.push({
        id: `defender:${alert.id}`, source: 'windows_defender', severity: alert.severity, title: alert.type.replaceAll('_', ' '),
        description: alert.description, evidence: { ...alert.evidence, collectionStatus: native.status }, observedAt: alert.lastSeenAt,
      });
    }
    const macComponents = this.platform === 'darwin' ? (native.data as { components: MacSecurityComponent[] }).components : [];
    for (const component of macComponents) {
      if (component.enabled === false) findings.push({
        id: `macos:${component.id}:disabled`, source: 'macos_security', severity: component.id === 'application_firewall' ? 'medium' : 'high',
        title: `${component.name} is disabled`, description: `${component.name} reported disabled. Review whether this is intended for this workstation.`,
        evidence: { scope: component.scope, raw: component.raw }, observedAt: component.collectedAt,
      });
    }
    const coverage = [
      { id: 'host', name: 'Host posture and change checks', ...host },
      { id: 'native', name: 'Native antivirus status', ...native },
      { id: 'network', name: 'Passive local network visibility', ...network },
    ].map(({ id, name, status, description, collectedAt }) => ({ id, name, status, description, lastUpdatedAt: collectedAt }));
    for (const component of macComponents) coverage.push({ id: `macos:${component.id}`, name: component.name, status: component.status, description: component.scope, lastUpdatedAt: component.collectedAt });
    coverage.push({ id: 'prevention', name: 'EDR / packet inspection / universal agent interception', status: 'unsupported', description: 'Guardian does not provide kernel prevention, packet inspection, or control of activity outside its interfaces.', lastUpdatedAt: this.now() });
    return { host, native, network, findings, coverage };
  }

  private async collectHost(): Promise<CollectorTelemetry> {
    this.hostErrors = [];
    const description = 'On-demand process-name heuristics, persistence and sensitive-path metadata checks. Partial polling coverage; the first observed baseline is not a trusted clean baseline. Network counts come from the separate passive collector.';
    try {
      const report = await this.host.runCheck();
      await this.host.persist();
      if (this.hostErrors.length) return this.telemetry('host', 'degraded', null, [...this.hostErrors], description);
      const { knownExternalDestinationCount: _destinations, listeningPortCount: _listeners, ...snapshot } = report.snapshot;
      this.successful.set('host', this.now());
      return this.telemetry('host', 'degraded', {
        baselineReady: report.baselineReady, baselineTrust: 'observed_only', snapshot,
        timestamp: report.timestamp, partialCoverage: true,
      }, [], description);
    } catch (error) {
      return this.telemetry('host', 'unavailable', null, [...this.hostErrors, errorMessage(error)], description);
    }
  }

  private powershell(script: string): Promise<string> {
    return this.runner('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', `$ErrorActionPreference = 'Stop'; ${script}`], 20_000);
  }

  private async collectNative(): Promise<CollectorTelemetry> {
    if (this.platform === 'darwin') return this.collectMacSecurity();
    if (this.platform === 'linux') {
      try {
        const version = (await this.runner('clamscan', ['--version'], 5_000)).trim();
        if (!version.startsWith('ClamAV ')) throw new Error('Unexpected ClamAV version output.');
        return this.telemetry('native', 'degraded', { provider: 'clamav', version, protectionState: 'unknown', inventoryOnly: true, scanSupported: false }, [], 'ClamAV executable inventory only. Does not establish daemon health, active protection or completed scans.');
      } catch (error) {
        return this.telemetry('native', 'unavailable', null, [errorMessage(error)], 'ClamAV was not discoverable. No packages were installed.');
      }
    }
    if (this.platform !== 'win32') return this.telemetry('native', 'unsupported', null, [], 'Native antivirus integration is not implemented on this platform.');
    this.defenderErrors = [];
    const [statusResult, inventoryResult] = await Promise.allSettled([
      this.defender.refreshStatus(),
      this.powershell('Get-CimInstance -Namespace root/SecurityCenter2 -ClassName AntiVirusProduct | Select-Object displayName,instanceGuid,productState | ConvertTo-Json -Compress').then(jsonRows),
    ]);
    const errors = [...this.defenderErrors];
    const defender = statusResult.status === 'fulfilled' ? statusResult.value : null;
    if (statusResult.status === 'rejected') errors.push(errorMessage(statusResult.reason));
    if (inventoryResult.status === 'rejected') errors.push(`Antivirus inventory: ${errorMessage(inventoryResult.reason)}`);
    const available = defender?.available === true;
    if (defender && !defender.available && errors.length === 0) errors.push(defender.summary);
    const inventory = inventoryResult.status === 'fulfilled' ? inventoryResult.value : null;
    return this.telemetry('native', available && errors.length === 0 ? 'available' : available || inventory !== null ? 'degraded' : 'unavailable', {
      defender, antivirusProducts: inventory, inventoryOnly: true, scanSupported: available,
    }, errors, 'Defender status and detections plus Security Center antivirus inventory. Registration does not establish protection health or provide management of third-party antivirus. A scan request is not a clean or completed scan.');
  }

  private async collectMacSecurity(): Promise<CollectorTelemetry> {
    const sources: Array<{ id: MacSecurityComponent['id']; name: string; command: string; args: string[]; scope: string }> = [
      { id: 'gatekeeper', name: 'Gatekeeper', command: '/usr/sbin/spctl', args: ['--status'], scope: 'Global Gatekeeper assessment setting only; not a guarantee that every executable is assessed or safe.' },
      { id: 'filevault', name: 'FileVault', command: '/usr/bin/fdesetup', args: ['status'], scope: 'Startup-volume FileVault status only; does not assess external volumes or recovery-key escrow.' },
      { id: 'application_firewall', name: 'Application Firewall', command: '/usr/libexec/ApplicationFirewall/socketfilterfw', args: ['--getglobalstate'], scope: 'Application Firewall global setting only; separate from the packet-filter firewall, per-app rules and outbound filtering.' },
    ];
    const components = await Promise.all(sources.map(async ({ command, args, ...source }): Promise<MacSecurityComponent> => {
      try {
        let output: string;
        try { output = await this.runner(command, args, 10_000); }
        catch (error) {
          const result = error as { code?: number; stdout?: string; stderr?: string };
          // fdesetup status uses exit 1 for FileVault Off; accept only the exact known status, not arbitrary failed output.
          if (source.id === 'filevault' && result.code === 1 && typeof result.stdout === 'string' && macEnabled('filevault', result.stdout) === false && !result.stderr?.trim()) output = result.stdout;
          else throw error;
        }
        const raw = output.trim().slice(0, 4_096);
        const enabled = macEnabled(source.id, output);
        return { ...source, status: enabled === null ? 'degraded' : 'available', enabled, collectedAt: this.now(), raw,
          ...(enabled === null ? { error: 'Status output is unrecognized or indicates a transition; protection state is unknown.' } : {}) };
      } catch (error) {
        return { ...source, status: 'unavailable', enabled: null, collectedAt: this.now(), error: errorMessage(error) };
      }
    }));
    const errors = components.filter((component) => component.error).map((component) => `${component.name}: ${component.error}`);
    const status = components.every((component) => component.status === 'available') ? 'available'
      : components.every((component) => component.status === 'unavailable') ? 'unavailable' : 'degraded';
    return this.telemetry('native', status, { provider: 'macos_security', components, scanSupported: false,
      xprotect: { status: 'unsupported', description: 'XProtect runtime health, malware detections and scan completion are not collected.' } }, errors,
    'Read-only local macOS security settings. No protection changes, active scans, privileged access or hosted service. Unrecognized status remains unknown; XProtect runtime verification is not implemented.');
  }

  private async collectNetwork(): Promise<CollectorTelemetry> {
    if (this.platform === 'darwin') return this.collectMacNetwork();
    const description = 'Passive OS neighbor-cache and connection snapshots only; not a complete LAN inventory, active scan, packet capture, traffic-volume measurement or intrusion prevention.';
    if (this.platform !== 'win32' && this.platform !== 'linux') return this.telemetry('network', 'unsupported', null, [], description);
    const collectors = this.platform === 'win32' ? [
      this.powershell('Get-NetNeighbor | Select-Object IPAddress,LinkLayerAddress,State,InterfaceIndex | ConvertTo-Json -Compress').then(jsonRows),
      this.powershell('Get-NetTCPConnection | Select-Object LocalAddress,LocalPort,RemoteAddress,RemotePort,State,OwningProcess | ConvertTo-Json -Compress').then(jsonRows),
    ] : [
      this.runner('ip', ['-j', 'neigh', 'show'], 8_000).then(jsonRows),
      this.runner('ss', ['-H', '-tuna'], 8_000).then((raw) => raw.split('\n').map((line) => line.trim()).filter(Boolean)),
    ];
    const [neighbors, connections] = await Promise.allSettled(collectors);
    const errors: string[] = [];
    if (neighbors.status === 'rejected') errors.push(`Neighbors: ${errorMessage(neighbors.reason)}`);
    if (connections.status === 'rejected') errors.push(`Connections: ${errorMessage(connections.reason)}`);
    const status = errors.length === 0 ? 'available' : errors.length === 2 ? 'unavailable' : 'degraded';
    return this.telemetry('network', status, status === 'unavailable' ? null : {
      neighbors: neighbors.status === 'fulfilled' ? neighbors.value : null,
      connections: connections.status === 'fulfilled' ? connections.value : null,
      connectionFormat: this.platform === 'win32' ? 'windows_tcp' : 'ss_text', passiveOnly: true,
    }, errors, description);
  }

  private async collectMacNetwork(): Promise<CollectorTelemetry> {
    const [neighbors, connections] = await Promise.allSettled([
      this.runner('/usr/sbin/arp', ['-an'], 8_000).then(macNeighbors),
      this.runner('/usr/sbin/lsof', ['-nP', '-i', '-FpcfnPT'], 10_000).then(macConnections),
    ]);
    const errors: string[] = [];
    if (neighbors.status === 'rejected') errors.push(`IPv4 neighbor cache: ${errorMessage(neighbors.reason)}`);
    if (connections.status === 'rejected') errors.push(`Visible Internet sockets: ${errorMessage(connections.reason)}`);
    const status = errors.length === 2 ? 'unavailable' : 'degraded';
    if (!errors.length) this.successful.set('network', this.now());
    return this.telemetry('network', status, status === 'unavailable' ? null : {
      neighbors: neighbors.status === 'fulfilled' ? neighbors.value : null,
      connections: connections.status === 'fulfilled' ? connections.value : null,
      sources: { neighbors: neighbors.status === 'fulfilled' ? 'available' : 'unavailable', connections: connections.status === 'fulfilled' ? 'available' : 'unavailable' },
      connectionFormat: 'macos_lsof', passiveOnly: true, visibility: 'current_user', neighborScope: 'ipv4_cache_only',
    }, errors, 'Passive IPv4 ARP cache and Internet sockets visible to the current macOS user. Partial visibility: other users, protected processes and IPv6 neighbors may be absent. No active discovery, network traffic capture or privilege elevation.');
  }

  async requestScan(scanType: 'quick' | 'full'): Promise<ScanRequestResult> {
    if (scanType !== 'quick' && scanType !== 'full') return { state: 'failed', message: 'Only quick and full native scans are supported.' };
    if (this.platform !== 'win32') return { state: 'failed', message: 'Native scan requests are currently supported only for Windows Defender.' };
    if (this.pendingScan) return { state: 'already_running', message: 'A Guardian scan request is already being processed; native scan completion is not known.' };
    const pending = this.runScan(scanType);
    this.pendingScan = pending;
    try { return await pending; }
    finally { if (this.pendingScan === pending) this.pendingScan = undefined; }
  }

  private async runScan(scanType: 'quick' | 'full'): Promise<ScanRequestResult> {
    try {
      const result = await this.defender.runScan({ type: scanType });
      if (!result.success) return { state: 'failed', message: result.message };
      return {
        state: result.message.includes('already in progress') ? 'already_running' : 'requested',
        message: `${result.message} Scan completion and clean status are not established.`, evidence: { provider: 'windows_defender', scanType },
      };
    } catch (error) {
      const details = error as { killed?: boolean; code?: string; signal?: string };
      const message = errorMessage(error);
      const uncertain = details.killed || details.signal || details.code === 'ETIMEDOUT' || /timed?\s*out|timeout/i.test(message);
      return { state: uncertain ? 'unknown' : 'failed', message: uncertain ? 'The scan request timed out or was interrupted. Defender may still be scanning; completion is unknown.' : message, evidence: { error: message } };
    }
  }
}
