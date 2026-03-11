import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { VectorStore, cosineSimilarity } from './vector-store.js';
import { DocumentStore } from './document-store.js';
import { hasSQLiteDriver, openSQLiteDatabase } from '../runtime/sqlite-driver.js';
import type { SQLiteDatabase } from '../runtime/sqlite-driver.js';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { mkdirSync, rmSync } from 'node:fs';

describe('cosineSimilarity', () => {
  it('returns 1 for identical vectors', () => {
    const a = new Float32Array([1, 2, 3]);
    expect(cosineSimilarity(a, a)).toBeCloseTo(1, 5);
  });

  it('returns 0 for orthogonal vectors', () => {
    const a = new Float32Array([1, 0]);
    const b = new Float32Array([0, 1]);
    expect(cosineSimilarity(a, b)).toBeCloseTo(0, 5);
  });

  it('returns -1 for opposite vectors', () => {
    const a = new Float32Array([1, 0]);
    const b = new Float32Array([-1, 0]);
    expect(cosineSimilarity(a, b)).toBeCloseTo(-1, 5);
  });

  it('returns 0 for different length vectors', () => {
    const a = new Float32Array([1, 2]);
    const b = new Float32Array([1, 2, 3]);
    expect(cosineSimilarity(a, b)).toBe(0);
  });

  it('returns 0 for zero vectors', () => {
    const a = new Float32Array([0, 0, 0]);
    const b = new Float32Array([1, 2, 3]);
    expect(cosineSimilarity(a, b)).toBe(0);
  });

  it('computes correct similarity for similar vectors', () => {
    const a = new Float32Array([1, 2, 3]);
    const b = new Float32Array([1.1, 2.1, 3.1]);
    const sim = cosineSimilarity(a, b);
    expect(sim).toBeGreaterThan(0.99);
    expect(sim).toBeLessThanOrEqual(1);
  });
});

const describeSQLite = hasSQLiteDriver() ? describe : describe.skip;

describeSQLite('VectorStore', () => {
  let db: SQLiteDatabase;
  let docStore: DocumentStore;
  let vectorStore: VectorStore;
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = join(tmpdir(), `search-vector-test-${Date.now()}`);
    mkdirSync(tmpDir, { recursive: true });
    db = openSQLiteDatabase(join(tmpDir, 'test.sqlite'), { enableForeignKeyConstraints: true })!;
    docStore = new DocumentStore(db);
    vectorStore = new VectorStore(docStore);
  });

  afterEach(() => {
    try { db.close(); } catch {}
    rmSync(tmpDir, { recursive: true, force: true });
  });

  function addChunkWithEmbedding(content: string, embedding: Float32Array): string {
    // Ensure source exists
    try { docStore.addSource({ id: 'vs', name: 'VS', type: 'file', path: '/f', enabled: true }); } catch {}
    let doc = docStore.getDocumentByPath('vs', '/f');
    if (!doc) doc = docStore.upsertDocument('vs', '/f', null, 'h', null, 100);
    const chunkId = docStore.insertChunk(doc.id, null, content, 0, content.length, 1, 'child');
    docStore.setEmbedding(chunkId, embedding);
    return chunkId;
  }

  it('finds most similar vectors', () => {
    const id1 = addChunkWithEmbedding('cat', new Float32Array([1, 0, 0]));
    const id2 = addChunkWithEmbedding('dog', new Float32Array([0, 1, 0]));
    const id3 = addChunkWithEmbedding('kitten', new Float32Array([0.9, 0.1, 0]));

    const query = new Float32Array([1, 0, 0]);
    const results = vectorStore.search(query);

    expect(results[0].chunkId).toBe(id1);
    expect(results[0].score).toBeCloseTo(1, 3);
    // Kitten should be second (more similar to cat than dog)
    expect(results[1].chunkId).toBe(id3);
  });

  it('respects limit', () => {
    for (let i = 0; i < 5; i++) {
      addChunkWithEmbedding(`item ${i}`, new Float32Array([Math.random(), Math.random(), Math.random()]));
    }

    const results = vectorStore.search(new Float32Array([1, 0, 0]), undefined, 2);
    expect(results).toHaveLength(2);
  });

  it('returns empty when no embeddings', () => {
    const results = vectorStore.search(new Float32Array([1, 0, 0]));
    expect(results).toHaveLength(0);
  });

  it('checks if embeddings exist', () => {
    expect(vectorStore.hasEmbeddings()).toBe(false);
    addChunkWithEmbedding('test', new Float32Array([1, 2, 3]));
    expect(vectorStore.hasEmbeddings()).toBe(true);
  });
});
