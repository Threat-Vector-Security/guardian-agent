import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { createLogger } from '../util/logging.js';
import { mkdirSecureSync, writeSecureFileSync } from '../util/secure-fs.js';

const log = createLogger('control-plane-integrity');

const KEY_BYTES = 32;
const DEFAULT_KEY_FILENAME = 'integrity.key';
const DEFAULT_MANIFEST_FILENAME = 'integrity-manifest.json';

export type IntegrityVerificationCode =
  | 'verified'
  | 'adopted'
  | 'absent'
  | 'missing_tracked'
  | 'untracked'
  | 'mismatch'
  | 'manifest_invalid';

export interface IntegrityManifestEntry {
  path: string;
  hmac: string;
  updatedAt: string;
  updatedBy?: string;
}

interface IntegrityManifestBody {
  version: 1;
  entries: Record<string, IntegrityManifestEntry>;
}

interface IntegrityManifestFile extends IntegrityManifestBody {
  manifestHmac: string;
}

export interface IntegrityVerificationResult {
  ok: boolean;
  code: IntegrityVerificationCode;
  path: string;
  message: string;
  adopted?: boolean;
  tracked?: boolean;
}

export interface IntegrityViolation {
  path: string;
  code: Extract<IntegrityVerificationCode, 'missing_tracked' | 'mismatch' | 'manifest_invalid'>;
  message: string;
}

export interface IntegritySweepResult {
  ok: boolean;
  verifiedCount: number;
  trackedCount: number;
  violations: IntegrityViolation[];
}

export interface ControlPlaneIntegrityOptions {
  baseDir: string;
  keyPath?: string;
  manifestPath?: string;
}

function compareDigests(left: string, right: string): boolean {
  const leftBytes = Buffer.from(left, 'hex');
  const rightBytes = Buffer.from(right, 'hex');
  if (leftBytes.length !== rightBytes.length) {
    return false;
  }
  return timingSafeEqual(leftBytes, rightBytes);
}

function sortEntries(entries: Record<string, IntegrityManifestEntry>): Record<string, IntegrityManifestEntry> {
  return Object.fromEntries(
    Object.entries(entries)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, value]) => [key, { ...value }]),
  );
}

export class ControlPlaneIntegrity {
  private readonly baseDir: string;
  private readonly keyPath: string;
  private readonly manifestPath: string;
  private readonly key: Buffer;

  constructor(options: ControlPlaneIntegrityOptions) {
    this.baseDir = resolve(options.baseDir);
    this.keyPath = resolve(options.keyPath ?? join(this.baseDir, DEFAULT_KEY_FILENAME));
    this.manifestPath = resolve(options.manifestPath ?? join(this.baseDir, DEFAULT_MANIFEST_FILENAME));
    mkdirSecureSync(this.baseDir);
    this.key = this.loadOrCreateKeySync();
  }

  getManifestPath(): string {
    return this.manifestPath;
  }

  getKeyPath(): string {
    return this.keyPath;
  }

  signFileSync(filePath: string, updatedBy = 'system'): IntegrityVerificationResult {
    const absolutePath = resolve(filePath);
    if (!existsSync(absolutePath)) {
      this.removeFileSync(absolutePath, updatedBy);
      return {
        ok: true,
        code: 'absent',
        path: absolutePath,
        message: `Protected file is absent: ${this.describePath(absolutePath)}`,
      };
    }

    const manifest = this.readManifestBodySync();
    manifest.entries[absolutePath] = {
      path: absolutePath,
      hmac: this.computeFileHmac(absolutePath),
      updatedAt: new Date().toISOString(),
      updatedBy,
    };
    this.writeManifestBodySync(manifest);
    return {
      ok: true,
      code: 'verified',
      path: absolutePath,
      tracked: true,
      message: `Signed protected file: ${this.describePath(absolutePath)}`,
    };
  }

  removeFileSync(filePath: string, _updatedBy = 'system'): boolean {
    const absolutePath = resolve(filePath);
    const manifest = this.readManifestBodySync();
    if (!(absolutePath in manifest.entries)) {
      return false;
    }
    delete manifest.entries[absolutePath];
    this.writeManifestBodySync(manifest);
    return true;
  }

  verifyFileSync(
    filePath: string,
    options?: { adoptUntracked?: boolean; updatedBy?: string },
  ): IntegrityVerificationResult {
    const absolutePath = resolve(filePath);
    let manifest: IntegrityManifestBody;
    try {
      manifest = this.readManifestBodySync();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        ok: false,
        code: 'manifest_invalid',
        path: absolutePath,
        message: `Integrity manifest is invalid: ${message}`,
      };
    }

    const trackedEntry = manifest.entries[absolutePath];
    if (!existsSync(absolutePath)) {
      if (!trackedEntry) {
        return {
          ok: true,
          code: 'absent',
          path: absolutePath,
          message: `Protected file is absent: ${this.describePath(absolutePath)}`,
        };
      }
      return {
        ok: false,
        code: 'missing_tracked',
        path: absolutePath,
        tracked: true,
        message: `Tracked file is missing: ${this.describePath(absolutePath)}`,
      };
    }

    if (!trackedEntry) {
      if (options?.adoptUntracked) {
        this.signFileSync(absolutePath, options.updatedBy ?? 'adopt_untracked');
        return {
          ok: true,
          code: 'adopted',
          path: absolutePath,
          tracked: true,
          adopted: true,
          message: `Adopted untracked protected file: ${this.describePath(absolutePath)}`,
        };
      }
      return {
        ok: false,
        code: 'untracked',
        path: absolutePath,
        message: `Protected file is not tracked in the integrity manifest: ${this.describePath(absolutePath)}`,
      };
    }

    const expected = trackedEntry.hmac;
    const actual = this.computeFileHmac(absolutePath);
    if (!compareDigests(expected, actual)) {
      return {
        ok: false,
        code: 'mismatch',
        path: absolutePath,
        tracked: true,
        message: `Integrity mismatch for protected file: ${this.describePath(absolutePath)}`,
      };
    }

    return {
      ok: true,
      code: 'verified',
      path: absolutePath,
      tracked: true,
      message: `Integrity verified for protected file: ${this.describePath(absolutePath)}`,
    };
  }

  verifyTrackedFilesSync(): IntegritySweepResult {
    let manifest: IntegrityManifestBody;
    try {
      manifest = this.readManifestBodySync();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        ok: false,
        verifiedCount: 0,
        trackedCount: 0,
        violations: [{
          path: this.manifestPath,
          code: 'manifest_invalid',
          message: `Integrity manifest is invalid: ${message}`,
        }],
      };
    }

    const violations: IntegrityViolation[] = [];
    let verifiedCount = 0;
    for (const absolutePath of Object.keys(manifest.entries).sort((left, right) => left.localeCompare(right))) {
      const result = this.verifyFileSync(absolutePath);
      if (result.ok) {
        verifiedCount++;
        continue;
      }
      if (result.code === 'missing_tracked' || result.code === 'mismatch' || result.code === 'manifest_invalid') {
        violations.push({
          path: result.path,
          code: result.code,
          message: result.message,
        });
      }
    }

    return {
      ok: violations.length === 0,
      verifiedCount,
      trackedCount: Object.keys(manifest.entries).length,
      violations,
    };
  }

  verifyFilesSync(
    filePaths: string[],
    options?: { adoptUntracked?: boolean; updatedBy?: string },
  ): IntegritySweepResult {
    try {
      this.readManifestBodySync();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        ok: false,
        verifiedCount: 0,
        trackedCount: 0,
        violations: [{
          path: this.manifestPath,
          code: 'manifest_invalid',
          message: `Integrity manifest is invalid: ${message}`,
        }],
      };
    }

    const targets = [...new Set(filePaths.map((filePath) => resolve(filePath)))];
    const violations: IntegrityViolation[] = [];
    let verifiedCount = 0;

    for (const targetPath of targets) {
      const result = this.verifyFileSync(targetPath, options);
      if (result.ok) {
        if (result.code !== 'absent') {
          verifiedCount++;
        }
        continue;
      }
      if (result.code === 'missing_tracked' || result.code === 'mismatch' || result.code === 'manifest_invalid') {
        violations.push({
          path: result.path,
          code: result.code,
          message: result.message,
        });
      }
    }

    return {
      ok: violations.length === 0,
      verifiedCount,
      trackedCount: targets.length,
      violations,
    };
  }

  private loadOrCreateKeySync(): Buffer {
    if (existsSync(this.keyPath)) {
      const raw = readFileSync(this.keyPath, 'utf-8').trim();
      if (/^[0-9a-f]{64}$/i.test(raw)) {
        return Buffer.from(raw, 'hex');
      }
      if (/^[A-Za-z0-9+/=]+$/.test(raw)) {
        return Buffer.from(raw, 'base64');
      }
      return Buffer.from(raw, 'utf-8');
    }

    const key = randomBytes(KEY_BYTES);
    writeSecureFileSync(this.keyPath, key.toString('hex'));
    log.info({ path: this.keyPath }, 'Created control-plane integrity key');
    return key;
  }

  private computeFileHmac(filePath: string): string {
    const absolutePath = resolve(filePath);
    const hmac = createHmac('sha256', this.key);
    hmac.update(absolutePath);
    hmac.update('\n');
    hmac.update(readFileSync(absolutePath));
    return hmac.digest('hex');
  }

  private computeManifestHmac(body: IntegrityManifestBody): string {
    const hmac = createHmac('sha256', this.key);
    hmac.update(JSON.stringify({
      version: body.version,
      entries: sortEntries(body.entries),
    }));
    return hmac.digest('hex');
  }

  private readManifestBodySync(): IntegrityManifestBody {
    if (!existsSync(this.manifestPath)) {
      return { version: 1, entries: {} };
    }

    const raw = readFileSync(this.manifestPath, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<IntegrityManifestFile>;
    if (parsed.version !== 1) {
      throw new Error(`Unsupported integrity manifest version '${String(parsed.version)}'`);
    }
    if (typeof parsed.manifestHmac !== 'string' || !parsed.manifestHmac.trim()) {
      throw new Error('Missing manifestHmac');
    }
    const entries: Record<string, IntegrityManifestEntry> = {};
    for (const [key, value] of Object.entries(parsed.entries ?? {})) {
      if (!value || typeof value !== 'object') {
        throw new Error(`Invalid manifest entry for '${key}'`);
      }
      const entry = value as Partial<IntegrityManifestEntry>;
      if (typeof entry.path !== 'string' || typeof entry.hmac !== 'string' || typeof entry.updatedAt !== 'string') {
        throw new Error(`Malformed manifest entry for '${key}'`);
      }
      entries[resolve(key)] = {
        path: resolve(entry.path),
        hmac: entry.hmac,
        updatedAt: entry.updatedAt,
        updatedBy: typeof entry.updatedBy === 'string' ? entry.updatedBy : undefined,
      };
    }

    const body: IntegrityManifestBody = { version: 1, entries };
    const expected = this.computeManifestHmac(body);
    if (!compareDigests(parsed.manifestHmac, expected)) {
      throw new Error('Manifest HMAC mismatch');
    }
    return body;
  }

  private writeManifestBodySync(body: IntegrityManifestBody): void {
    const normalized: IntegrityManifestBody = {
      version: 1,
      entries: sortEntries(body.entries),
    };
    const manifest: IntegrityManifestFile = {
      ...normalized,
      manifestHmac: this.computeManifestHmac(normalized),
    };
    writeSecureFileSync(this.manifestPath, JSON.stringify(manifest, null, 2));
  }

  private describePath(filePath: string): string {
    const rel = relative(this.baseDir, filePath);
    if (rel === '') {
      return '.';
    }
    if (rel && !rel.startsWith('..') && !rel.includes(':')) {
      return rel.replace(/\\/g, '/');
    }
    return filePath;
  }
}
