import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { gzipSync } from 'node:zlib';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  PackageInstallTrustService,
  buildPackageInstallSpawnPlan,
  type PackageInstallCommandRunner,
} from './package-install-trust-service.js';

const testDirs: string[] = [];

afterEach(() => {
  for (const dir of testDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe('PackageInstallTrustService', () => {
  it('installs trusted npm packages after staged review', async () => {
    const root = mkdtempSync(join(tmpdir(), 'guardianagent-package-install-service-'));
    testDirs.push(root);
    const runner = createRunner({
      root,
      tarballName: 'clean-pkg-1.0.0.tgz',
      tarballEntries: {
        'package/package.json': JSON.stringify({ name: 'clean-pkg', version: '1.0.0' }),
        'package/index.js': 'export const ok = true;\n',
      },
    });
    const service = new PackageInstallTrustService({
      quarantineRoot: join(root, 'quarantine'),
      persistPath: join(root, 'package-install-trust.json'),
      runner,
      nativeProtectionScanner: {
        scanPath: vi.fn().mockResolvedValue({
          provider: 'clamav',
          status: 'clean',
          summary: 'clean',
          observedAt: 1_000,
        }),
      } as any,
    });

    const result = await service.runManagedInstall({
      command: 'npm install clean-pkg',
      cwd: root,
    });

    expect(result.success).toBe(true);
    expect(result.status).toBe('installed');
    expect(result.event?.state).toBe('trusted');
    expect(result.event?.installed).toBe(true);
    expect(service.listAlerts()).toHaveLength(0);
  });

  it('pauses caution installs until allowCaution is set and records an alert', async () => {
    const root = mkdtempSync(join(tmpdir(), 'guardianagent-package-install-service-'));
    testDirs.push(root);
    const runner = createRunner({
      root,
      tarballName: 'caution-pkg-1.0.0.tgz',
      tarballEntries: {
        'package/package.json': JSON.stringify({
          name: 'caution-pkg',
          version: '1.0.0',
          scripts: {
            postinstall: 'node postinstall.js',
          },
          dependencies: {
            leftpad: '^1.0.0',
          },
        }, null, 2),
        'package/postinstall.js': 'console.log("hello");\n',
      },
    });
    const service = new PackageInstallTrustService({
      quarantineRoot: join(root, 'quarantine'),
      persistPath: join(root, 'package-install-trust.json'),
      runner,
      nativeProtectionScanner: {
        scanPath: vi.fn().mockResolvedValue({
          provider: 'clamav',
          status: 'clean',
          summary: 'clean',
          observedAt: 2_000,
        }),
      } as any,
    });

    const result = await service.runManagedInstall({
      command: 'npm install caution-pkg',
      cwd: root,
    });

    expect(result.success).toBe(false);
    expect(result.status).toBe('requires_review');
    expect(result.event?.state).toBe('caution');
    expect(result.alertId).toBeTruthy();
    expect(service.listAlerts()).toHaveLength(1);
    expect(service.listAlerts()[0]?.type).toBe('package_install_caution');
  });

  it('resolves Windows npm shims from the Node install directory and enables shell fallback for cmd scripts', async () => {
    const plan = await buildPackageInstallSpawnPlan(
      {
        command: 'npm',
        args: ['install', 'is-number'],
        env: {
          PATH: '',
          PATHEXT: '.COM;.EXE;.BAT;.CMD',
        },
      },
      {
        platform: 'win32',
        execPath: 'C:\\Program Files\\nodejs\\node.exe',
        pathExists: async (candidate) => candidate === 'C:\\Program Files\\nodejs\\npm.cmd',
      },
    );

    expect(plan.command).toBe('C:\\Program Files\\nodejs\\npm.cmd');
    expect(plan.args).toEqual(['install', 'is-number']);
    expect(plan.shell).toBe(true);
  });
});

function createRunner(input: {
  root: string;
  tarballName: string;
  tarballEntries: Record<string, string>;
}): PackageInstallCommandRunner {
  return async ({ command, args }) => {
    if (command === 'npm' && args[0] === 'pack') {
      const outputIndex = args.indexOf('--pack-destination');
      const outputDir = outputIndex === -1 ? '' : args[outputIndex + 1];
      if (!outputDir) {
        throw new Error('missing --pack-destination');
      }
      writeFileSync(join(outputDir, input.tarballName), createTgz(input.tarballEntries));
      return { stdout: input.tarballName, stderr: '', exitCode: 0 };
    }
    if (command === 'npm' && args[0] === 'install') {
      return { stdout: 'installed', stderr: '', exitCode: 0 };
    }
    return { stdout: '', stderr: `unexpected command ${command} ${args.join(' ')}`, exitCode: 1 };
  };
}

function createTgz(entries: Record<string, string>): Buffer {
  const parts: Buffer[] = [];
  for (const [name, content] of Object.entries(entries)) {
    const data = Buffer.from(content, 'utf8');
    const header = Buffer.alloc(512, 0);
    writeAscii(header, 0, 100, name);
    writeAscii(header, 100, 8, '0000644\0');
    writeAscii(header, 108, 8, '0000000\0');
    writeAscii(header, 116, 8, '0000000\0');
    writeAscii(header, 124, 12, `${data.length.toString(8).padStart(11, '0')}\0`);
    writeAscii(header, 136, 12, `${Math.floor(Date.now() / 1000).toString(8).padStart(11, '0')}\0`);
    header.fill(0x20, 148, 156);
    header[156] = '0'.charCodeAt(0);
    writeAscii(header, 257, 6, 'ustar\0');
    writeAscii(header, 263, 2, '00');
    const checksum = [...header].reduce((sum, value) => sum + value, 0);
    writeAscii(header, 148, 8, `${checksum.toString(8).padStart(6, '0')}\0 `);
    parts.push(header, data, Buffer.alloc((512 - (data.length % 512 || 512)) % 512));
  }
  parts.push(Buffer.alloc(1024, 0));
  return gzipSync(Buffer.concat(parts));
}

function writeAscii(target: Buffer, start: number, maxLength: number, value: string): void {
  target.write(value.slice(0, maxLength), start, 'ascii');
}
