import { execFile as execFileCb } from 'node:child_process';
import { promisify } from 'node:util';
import type { PackageInstallNativeProtection } from './package-install-trust.js';
import type { WindowsDefenderAlert, WindowsDefenderProvider } from './windows-defender-provider.js';

interface CommandResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  errorCode?: string;
  errorMessage?: string;
}

type CommandRunner = (command: string, args: string[], timeoutMs?: number) => Promise<CommandResult>;

export interface PackageInstallNativeProtectionScannerOptions {
  now?: () => number;
  platform?: NodeJS.Platform;
  windowsDefender?: WindowsDefenderProvider;
  runner?: CommandRunner;
}

const execFile = promisify(execFileCb);

export class PackageInstallNativeProtectionScanner {
  private readonly now: () => number;
  private readonly platform: NodeJS.Platform;
  private readonly windowsDefender?: WindowsDefenderProvider;
  private readonly runner: CommandRunner;

  constructor(options?: PackageInstallNativeProtectionScannerOptions) {
    this.now = options?.now ?? Date.now;
    this.platform = options?.platform ?? process.platform;
    this.windowsDefender = options?.windowsDefender;
    this.runner = options?.runner ?? defaultRunner;
  }

  async scanPath(scanPath: string): Promise<PackageInstallNativeProtection> {
    if (this.platform === 'win32') {
      return this.scanWithWindowsDefender(scanPath);
    }
    return this.scanWithClamAv(scanPath);
  }

  private async scanWithWindowsDefender(scanPath: string): Promise<PackageInstallNativeProtection> {
    const timestamp = this.now();
    if (!this.windowsDefender) {
      return {
        provider: 'windows_defender',
        status: 'unavailable',
        summary: 'Windows Defender integration is not available in this Guardian runtime.',
        observedAt: timestamp,
      };
    }

    const status = await this.windowsDefender.refreshStatus().catch(() => this.windowsDefender!.getStatus());
    if (!status.supported || !status.available) {
      return {
        provider: 'windows_defender',
        status: 'unavailable',
        summary: status.summary || 'Windows Defender is not available for staged package scans.',
        observedAt: timestamp,
      };
    }

    const hostPath = toWindowsHostPath(scanPath);
    if (!hostPath) {
      return {
        provider: 'windows_defender',
        status: 'error',
        summary: 'The staged package path could not be translated to a Windows host path for Defender scanning.',
        observedAt: timestamp,
      };
    }

    try {
      await this.windowsDefender.runScan({ type: 'custom', path: hostPath });
      await this.windowsDefender.refreshStatus().catch(() => this.windowsDefender!.getStatus());
      const matches = this.windowsDefender
        .listAlerts()
        .filter((alert) => isWindowsDefenderAlertInPath(alert, hostPath));
      if (matches.length > 0) {
        return {
          provider: 'windows_defender',
          status: 'detected',
          summary: `Windows Defender reported ${matches.length} detection${matches.length === 1 ? '' : 's'} for the staged package content.`,
          observedAt: this.now(),
          details: matches.flatMap(formatWindowsDefenderAlertDetail).slice(0, 6),
        };
      }
      return {
        provider: 'windows_defender',
        status: 'clean',
        summary: 'Windows Defender completed a custom scan with no active staged-package detections observed.',
        observedAt: this.now(),
      };
    } catch (error) {
      return {
        provider: 'windows_defender',
        status: 'error',
        summary: `Windows Defender custom scan failed: ${error instanceof Error ? error.message : String(error)}`,
        observedAt: this.now(),
      };
    }
  }

  private async scanWithClamAv(scanPath: string): Promise<PackageInstallNativeProtection> {
    const timestamp = this.now();
    const scans: Array<{ command: string; args: string[] }> = [
      { command: 'clamdscan', args: ['--fdpass', '--multiscan', '--infected', '--no-summary', scanPath] },
      { command: 'clamscan', args: ['--recursive', '--infected', '--no-summary', scanPath] },
    ];

    let lastFailure: CommandResult | null = null;
    for (const scan of scans) {
      const result = await this.runner(scan.command, scan.args, 300_000);
      if (result.errorCode === 'ENOENT') {
        lastFailure = result;
        continue;
      }
      if (result.exitCode === 0) {
        return {
          provider: 'clamav',
          status: 'clean',
          summary: `${scan.command} completed with no detections in the staged package content.`,
          observedAt: this.now(),
        };
      }
      const detections = parseClamAvDetections(result.stdout);
      if (result.exitCode === 1 || detections.length > 0) {
        return {
          provider: 'clamav',
          status: 'detected',
          summary: `ClamAV reported ${Math.max(detections.length, 1)} detection${Math.max(detections.length, 1) === 1 ? '' : 's'} in the staged package content.`,
          observedAt: this.now(),
          details: detections.slice(0, 6),
        };
      }
      lastFailure = result;
    }

    if (lastFailure?.errorCode === 'ENOENT' || (!lastFailure && scans.length > 0)) {
      return {
        provider: 'clamav',
        status: 'unavailable',
        summary: 'No native Unix AV scanner is configured. Install clamdscan or clamscan to enable staged package scans.',
        observedAt: timestamp,
      };
    }

    return {
      provider: 'clamav',
      status: 'error',
      summary: `Native AV scan failed: ${formatCommandFailure(lastFailure)}`,
      observedAt: this.now(),
    };
  }
}

function parseClamAvDetections(stdout: string): string[] {
  return stdout
    .split(/\r?\n/g)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const match = line.match(/^(.*?):\s*(.+?)\s+FOUND$/);
      if (!match) return '';
      return `${match[2]} (${match[1]})`;
    })
    .filter(Boolean);
}

function isWindowsDefenderAlertInPath(alert: WindowsDefenderAlert, scanPath: string): boolean {
  if (alert.type !== 'defender_threat_detected') return false;
  const resources = Array.isArray(alert.evidence?.resources)
    ? alert.evidence.resources.filter((resource): resource is string => typeof resource === 'string')
    : [];
  return resources.some((resource) => pathWithinWindowsRoot(resource, scanPath));
}

function formatWindowsDefenderAlertDetail(alert: WindowsDefenderAlert): string[] {
  const threatName = typeof alert.evidence?.threatName === 'string'
    ? alert.evidence.threatName
    : alert.description;
  const resources = Array.isArray(alert.evidence?.resources)
    ? alert.evidence.resources.filter((resource): resource is string => typeof resource === 'string')
    : [];
  if (resources.length === 0) {
    return [String(threatName)];
  }
  return resources.slice(0, 3).map((resource) => `${threatName} (${resource})`);
}

function pathWithinWindowsRoot(candidatePath: string, rootPath: string): boolean {
  const candidate = normalizeWindowsPath(candidatePath);
  const root = normalizeWindowsPath(rootPath);
  return candidate === root || candidate.startsWith(`${root}\\`);
}

function normalizeWindowsPath(value: string): string {
  return value.replace(/\//g, '\\').replace(/\\+$/, '').toLowerCase();
}

function toWindowsHostPath(pathValue: string): string | null {
  if (!pathValue.trim()) return null;
  if (/^[a-zA-Z]:[\\/]/.test(pathValue) || /^\\\\/.test(pathValue)) {
    return pathValue.replace(/\//g, '\\');
  }
  const mnt = pathValue.match(/^\/mnt\/([a-zA-Z])\/(.*)$/);
  if (!mnt) return null;
  const drive = mnt[1].toUpperCase();
  const rest = mnt[2].replace(/\//g, '\\');
  return `${drive}:\\${rest}`;
}

function formatCommandFailure(result: CommandResult | null): string {
  if (!result) return 'unknown scanner failure';
  const message = [
    result.errorMessage,
    result.stderr?.trim(),
    typeof result.exitCode === 'number' ? `exit code ${result.exitCode}` : '',
  ].filter(Boolean)[0];
  return message || 'unknown scanner failure';
}

async function defaultRunner(command: string, args: string[], timeoutMs = 300_000): Promise<CommandResult> {
  try {
    const { stdout, stderr } = await execFile(command, args, {
      timeout: timeoutMs,
      maxBuffer: 16 * 1024 * 1024,
    });
    return {
      stdout: typeof stdout === 'string' ? stdout : String(stdout ?? ''),
      stderr: typeof stderr === 'string' ? stderr : String(stderr ?? ''),
      exitCode: 0,
    };
  } catch (error) {
    const execError = error as NodeJS.ErrnoException & {
      stdout?: string | Buffer;
      stderr?: string | Buffer;
      code?: string | number;
      signal?: NodeJS.Signals;
    };
    return {
      stdout: typeof execError.stdout === 'string' ? execError.stdout : String(execError.stdout ?? ''),
      stderr: typeof execError.stderr === 'string' ? execError.stderr : String(execError.stderr ?? ''),
      exitCode: typeof execError.code === 'number' ? execError.code : null,
      errorCode: typeof execError.code === 'string' ? execError.code : undefined,
      errorMessage: execError.message,
    };
  }
}
