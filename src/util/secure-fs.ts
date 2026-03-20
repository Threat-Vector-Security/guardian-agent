import { chmod, mkdir, readdir, writeFile } from 'node:fs/promises';
import { chmodSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const SECURE_FILE_MODE = 0o600;
const SECURE_DIR_MODE = 0o700;

async function hardenPath(path: string, mode: number): Promise<void> {
  try {
    await chmod(path, mode);
  } catch {
    // Best effort only. Some filesystems and platforms ignore POSIX modes.
  }
}

function hardenPathSync(path: string, mode: number): void {
  try {
    chmodSync(path, mode);
  } catch {
    // Best effort only. Some filesystems and platforms ignore POSIX modes.
  }
}

export async function mkdirSecure(dirPath: string): Promise<void> {
  await mkdir(dirPath, { recursive: true, mode: SECURE_DIR_MODE });
  await hardenPath(dirPath, SECURE_DIR_MODE);
}

export function mkdirSecureSync(dirPath: string): void {
  mkdirSync(dirPath, { recursive: true, mode: SECURE_DIR_MODE });
  hardenPathSync(dirPath, SECURE_DIR_MODE);
}

export async function writeSecureFile(filePath: string, content: string | Uint8Array, encoding: BufferEncoding = 'utf-8'): Promise<void> {
  await mkdirSecure(dirname(filePath));
  if (typeof content === 'string') {
    await writeFile(filePath, content, { encoding, mode: SECURE_FILE_MODE });
  } else {
    await writeFile(filePath, content, { mode: SECURE_FILE_MODE });
  }
  await hardenPath(filePath, SECURE_FILE_MODE);
}

export function writeSecureFileSync(filePath: string, content: string | Uint8Array, encoding: BufferEncoding = 'utf-8'): void {
  mkdirSecureSync(dirname(filePath));
  if (typeof content === 'string') {
    writeFileSync(filePath, content, { encoding, mode: SECURE_FILE_MODE });
  } else {
    writeFileSync(filePath, content, { mode: SECURE_FILE_MODE });
  }
  hardenPathSync(filePath, SECURE_FILE_MODE);
}

export async function appendSecureFile(filePath: string, content: string, encoding: BufferEncoding = 'utf-8'): Promise<void> {
  await mkdirSecure(dirname(filePath));
  await writeFile(filePath, content, { encoding, mode: SECURE_FILE_MODE, flag: 'a' });
  await hardenPath(filePath, SECURE_FILE_MODE);
}

export async function tightenSecureTree(rootPath: string): Promise<void> {
  if (!existsSync(rootPath)) return;
  await tightenSecureTreeInner(rootPath, true);
}

async function tightenSecureTreeInner(targetPath: string, isDir: boolean): Promise<void> {
  await hardenPath(targetPath, isDir ? SECURE_DIR_MODE : SECURE_FILE_MODE);
  if (!isDir) return;
  let entries;
  try {
    entries = await readdir(targetPath, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (entry.isSymbolicLink()) continue;
    const childPath = join(targetPath, entry.name.toString());
    await tightenSecureTreeInner(childPath, entry.isDirectory());
  }
}

export const SECURE_FS_MODES = {
  file: SECURE_FILE_MODE,
  directory: SECURE_DIR_MODE,
} as const;
