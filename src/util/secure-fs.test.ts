import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it } from 'vitest';
import {
  mkdirSecure,
  mkdirSecureSync,
  SECURE_FS_MODES,
  tightenSecureTree,
  writeSecureFile,
  writeSecureFileSync,
} from './secure-fs.js';

const testDirs: string[] = [];

function makeTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'guardianagent-secure-fs-'));
  testDirs.push(dir);
  return dir;
}

function assertMode(path: string, expectedMode: number): void {
  if (process.platform === 'win32') return;
  expect(statSync(path).mode & 0o777).toBe(expectedMode);
}

afterEach(() => {
  for (const dir of testDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe('secure-fs', () => {
  it('creates secure directories and files synchronously', () => {
    const root = makeTempDir();
    const dirPath = join(root, 'state');
    const filePath = join(dirPath, 'config.json');

    mkdirSecureSync(dirPath);
    writeSecureFileSync(filePath, '{"ok":true}\n');

    expect(readFileSync(filePath, 'utf-8')).toContain('"ok":true');
    assertMode(dirPath, SECURE_FS_MODES.directory);
    assertMode(filePath, SECURE_FS_MODES.file);
  });

  it('creates secure directories and files asynchronously', async () => {
    const root = makeTempDir();
    const dirPath = join(root, 'memory');
    const filePath = join(dirPath, 'entry.json');

    await mkdirSecure(dirPath);
    await writeSecureFile(filePath, '{"entry":1}\n');

    expect(readFileSync(filePath, 'utf-8')).toContain('"entry":1');
    assertMode(dirPath, SECURE_FS_MODES.directory);
    assertMode(filePath, SECURE_FS_MODES.file);
  });

  it('tightens existing tree permissions', async () => {
    const root = makeTempDir();
    const nestedDir = join(root, 'audit');
    const nestedFile = join(nestedDir, 'audit.jsonl');

    mkdirSync(nestedDir, { recursive: true });
    writeFileSync(nestedFile, 'line\n', 'utf-8');
    if (process.platform !== 'win32') {
      chmodSync(root, 0o755);
      chmodSync(nestedDir, 0o755);
      chmodSync(nestedFile, 0o644);
    }

    await tightenSecureTree(root);

    assertMode(root, SECURE_FS_MODES.directory);
    assertMode(nestedDir, SECURE_FS_MODES.directory);
    assertMode(nestedFile, SECURE_FS_MODES.file);
  });
});
