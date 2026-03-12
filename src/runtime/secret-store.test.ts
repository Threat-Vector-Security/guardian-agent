import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { LocalSecretStore } from './secret-store.js';

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe('LocalSecretStore', () => {
  it('stores, resolves, and deletes secrets', () => {
    const dir = mkdtempSync(join(tmpdir(), 'guardianagent-secret-store-'));
    tempDirs.push(dir);
    const store = new LocalSecretStore({ baseDir: dir, now: () => 123 });

    store.set('provider-openai', 'sk-test-openai');

    expect(store.has('provider-openai')).toBe(true);
    expect(store.get('provider-openai')).toBe('sk-test-openai');

    store.delete('provider-openai');

    expect(store.has('provider-openai')).toBe(false);
    expect(store.get('provider-openai')).toBeUndefined();
  });

  it('does not write plaintext secrets into the encrypted data file', () => {
    const dir = mkdtempSync(join(tmpdir(), 'guardianagent-secret-store-'));
    tempDirs.push(dir);
    const store = new LocalSecretStore({ baseDir: dir, now: () => 456 });

    store.set('search-brave', 'brave-secret-value');

    const raw = readFileSync(join(dir, 'secrets.enc.json'), 'utf-8');
    expect(raw).toContain('search-brave');
    expect(raw).not.toContain('brave-secret-value');
    expect(store.get('search-brave')).toBe('brave-secret-value');
  });
});
