/**
 * Vector store — cosine similarity search over chunk embeddings.
 *
 * Embeddings are stored as BLOBs in SQLite (no native extension needed).
 * KNN search is performed in JavaScript using cosine similarity.
 * For typical document collections (< 100K chunks), this is fast enough.
 */

import type { DocumentStore } from './document-store.js';

export interface VectorResult {
  chunkId: string;
  score: number;  // cosine similarity, 0-1 (higher = more similar)
}

export class VectorStore {
  constructor(private readonly store: DocumentStore) {}

  /**
   * Find the K most similar chunks to a query embedding.
   *
   * @param queryEmbedding - Query vector
   * @param sourceId - Optional source filter
   * @param limit - Max results (default 20)
   */
  search(queryEmbedding: Float32Array, sourceId?: string, limit: number = 20): VectorResult[] {
    const candidates = this.store.getEmbeddingsForSearch(sourceId);

    if (candidates.length === 0) return [];

    // Compute cosine similarity for all candidates
    const scored = candidates.map(c => ({
      chunkId: c.chunkId,
      score: cosineSimilarity(queryEmbedding, c.embedding),
    }));

    // Sort by score descending and take top K
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, limit);
  }

  /** Check if any embeddings exist. */
  hasEmbeddings(sourceId?: string): boolean {
    return this.store.getEmbeddedChunkCount(sourceId) > 0;
  }
}

/**
 * Compute cosine similarity between two vectors.
 * Returns a value between -1 and 1 (1 = identical direction).
 */
export function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  if (a.length !== b.length) return 0;

  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  if (denom === 0) return 0;

  return dot / denom;
}
