import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { FTSStore, sanitizeFTSQuery } from './fts-store.js';
import { DocumentStore } from './document-store.js';
import { hasSQLiteDriver, openSQLiteDatabase } from '../runtime/sqlite-driver.js';
import type { SQLiteDatabase } from '../runtime/sqlite-driver.js';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { mkdirSync, rmSync } from 'node:fs';

const describeSQLite = hasSQLiteDriver() ? describe : describe.skip;

describe('sanitizeFTSQuery', () => {
  it('removes quotes and brackets', () => {
    expect(sanitizeFTSQuery('hello "world"')).toBe('hello world');
    expect(sanitizeFTSQuery('test (value)')).toBe('test value');
  });

  it('removes FTS operators', () => {
    expect(sanitizeFTSQuery('hello AND world')).toBe('hello world');
    expect(sanitizeFTSQuery('NOT bad OR good')).toBe('bad good');
  });

  it('collapses whitespace', () => {
    expect(sanitizeFTSQuery('  hello   world  ')).toBe('hello world');
  });

  it('returns empty for empty input', () => {
    expect(sanitizeFTSQuery('')).toBe('');
    expect(sanitizeFTSQuery('   ')).toBe('');
  });
});

describeSQLite('FTSStore', () => {
  let db: SQLiteDatabase;
  let docStore: DocumentStore;
  let fts: FTSStore;
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = join(tmpdir(), `search-fts-test-${Date.now()}`);
    mkdirSync(tmpDir, { recursive: true });
    db = openSQLiteDatabase(join(tmpDir, 'test.sqlite'), { enableForeignKeyConstraints: true })!;
    docStore = new DocumentStore(db);
    fts = new FTSStore(db);
  });

  afterEach(() => {
    try { db.close(); } catch {}
    rmSync(tmpDir, { recursive: true, force: true });
  });

  function addChunks(content: string[]): void {
    docStore.addSource({ id: 'test', name: 'Test', type: 'directory', path: '/test', enabled: true });
    const doc = docStore.upsertDocument('test', '/test/doc.txt', null, 'hash', null, 100);
    for (const c of content) {
      docStore.insertChunk(doc.id, null, c, 0, c.length, 1, 'child');
    }
  }

  it('finds matching chunks via FTS5', () => {
    addChunks([
      'The quick brown fox jumps over the lazy dog',
      'A fast red car drives on the highway',
      'The lazy dog sleeps in the sun',
    ]);

    const results = fts.search('lazy dog');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].content).toContain('lazy dog');
  });

  it('returns empty for no matches', () => {
    addChunks(['hello world']);
    const results = fts.search('nonexistent unicorn');
    expect(results).toHaveLength(0);
  });

  it('respects limit parameter', () => {
    addChunks(Array.from({ length: 10 }, (_, i) => `Document about testing number ${i}`));
    const results = fts.search('testing', undefined, 3);
    expect(results.length).toBeLessThanOrEqual(3);
  });

  it('filters by source id', () => {
    docStore.addSource({ id: 'src-a', name: 'A', type: 'directory', path: '/a', enabled: true });
    docStore.addSource({ id: 'src-b', name: 'B', type: 'directory', path: '/b', enabled: true });

    const docA = docStore.upsertDocument('src-a', '/a/file.txt', null, 'ha', null, 100);
    const docB = docStore.upsertDocument('src-b', '/b/file.txt', null, 'hb', null, 100);

    docStore.insertChunk(docA.id, null, 'search engine optimization', 0, 27, 3, 'child');
    docStore.insertChunk(docB.id, null, 'search algorithm design', 0, 23, 3, 'child');

    const allResults = fts.search('search');
    expect(allResults.length).toBe(2);

    const filteredResults = fts.search('search', 'src-a');
    expect(filteredResults.length).toBe(1);
    expect(filteredResults[0].content).toContain('optimization');
  });

  it('returns empty for empty query', () => {
    addChunks(['hello world']);
    const results = fts.search('');
    expect(results).toHaveLength(0);
  });

  it('handles porter stemming (run/running/runs)', () => {
    addChunks([
      'The runner is running in the race',
      'She runs every morning',
    ]);

    const results = fts.search('run');
    expect(results.length).toBe(2);
  });

  it('rebuilds FTS index', () => {
    addChunks(['rebuild test content']);
    // Should not throw
    fts.rebuild();
    const results = fts.search('rebuild');
    expect(results.length).toBe(1);
  });
});
