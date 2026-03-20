import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { ControlPlaneIntegrity } from './control-plane-integrity.js';

let tempDir: string;

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), 'guardian-integrity-test-'));
});

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

describe('ControlPlaneIntegrity', () => {
  it('signs and verifies protected files', () => {
    const integrity = new ControlPlaneIntegrity({ baseDir: tempDir });
    const filePath = join(tempDir, 'config.yaml');
    writeFileSync(filePath, 'guardian:\n  enabled: true\n');

    integrity.signFileSync(filePath, 'test');
    const result = integrity.verifyFileSync(filePath);

    expect(result.ok).toBe(true);
    expect(result.code).toBe('verified');
  });

  it('adopts untracked files on demand', () => {
    const integrity = new ControlPlaneIntegrity({ baseDir: tempDir });
    const filePath = join(tempDir, 'scheduled-tasks.json');
    writeFileSync(filePath, '[]');

    const result = integrity.verifyFileSync(filePath, {
      adoptUntracked: true,
      updatedBy: 'test_adopt',
    });

    expect(result.ok).toBe(true);
    expect(result.code).toBe('adopted');
    expect(integrity.verifyFileSync(filePath).ok).toBe(true);
  });

  it('detects file tampering after a legitimate signature', () => {
    const integrity = new ControlPlaneIntegrity({ baseDir: tempDir });
    const filePath = join(tempDir, 'policy.json');
    writeFileSync(filePath, JSON.stringify({ schemaVersion: 1, rules: [] }, null, 2));

    integrity.signFileSync(filePath, 'test');
    writeFileSync(filePath, JSON.stringify({ schemaVersion: 1, rules: [{ id: 'evil' }] }, null, 2));

    const result = integrity.verifyFileSync(filePath);
    expect(result.ok).toBe(false);
    expect(result.code).toBe('mismatch');
  });

  it('detects manifest tampering', () => {
    const integrity = new ControlPlaneIntegrity({ baseDir: tempDir });
    const filePath = join(tempDir, 'memory.index.json');
    writeFileSync(filePath, JSON.stringify({ version: 1, entries: [] }, null, 2));

    integrity.signFileSync(filePath, 'test');
    writeFileSync(integrity.getManifestPath(), JSON.stringify({
      version: 1,
      entries: {},
      manifestHmac: '00',
    }, null, 2));

    const result = integrity.verifyFileSync(filePath);
    expect(result.ok).toBe(false);
    expect(result.code).toBe('manifest_invalid');
  });

  it('detects when a tracked file is deleted', () => {
    const integrity = new ControlPlaneIntegrity({ baseDir: tempDir });
    const filePath = join(tempDir, 'scheduled-tasks.json');
    writeFileSync(filePath, '[]');

    integrity.signFileSync(filePath, 'test');
    unlinkSync(filePath);

    const result = integrity.verifyFileSync(filePath);
    expect(result.ok).toBe(false);
    expect(result.code).toBe('missing_tracked');
  });
});
