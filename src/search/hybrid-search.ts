/**
 * Hybrid search — combines BM25 keyword search with vector similarity search.
 *
 * Merges results using Reciprocal Rank Fusion (RRF):
 *   score(d) = Σ 1/(k + rank_i(d))  where k=60
 *
 * Returns parent chunk context alongside matched child snippets.
 */

import type { FTSStore, FTSResult } from './fts-store.js';
import type { VectorStore, VectorResult } from './vector-store.js';
import type { DocumentStore } from './document-store.js';
import type { EmbeddingProvider, SearchResult, SearchMode } from './types.js';

export interface HybridSearchOptions {
  query: string;
  mode: SearchMode;
  sourceId?: string;
  limit: number;
  embeddingProvider?: EmbeddingProvider | null;
}

interface RankedItem {
  chunkId: string;
  rrf: number;
  ftsScore?: number;
  vectorScore?: number;
}

const RRF_K = 60;

export class HybridSearch {
  constructor(
    private readonly fts: FTSStore,
    private readonly vector: VectorStore,
    private readonly store: DocumentStore,
  ) {}

  async search(options: HybridSearchOptions): Promise<SearchResult[]> {
    const { query, mode, sourceId, limit, embeddingProvider } = options;

    // Fetch wider candidate pool for merging
    const candidateLimit = Math.min(limit * 3, 100);

    let ftsResults: FTSResult[] = [];
    let vectorResults: VectorResult[] = [];

    if (mode === 'keyword' || mode === 'hybrid') {
      ftsResults = this.fts.search(query, sourceId, candidateLimit);
    }

    if ((mode === 'semantic' || mode === 'hybrid') && embeddingProvider) {
      try {
        const [queryEmbedding] = await embeddingProvider.embed([query]);
        vectorResults = this.vector.search(queryEmbedding, sourceId, candidateLimit);
      } catch {
        // Graceful degradation — vector search fails, keyword still works
        if (mode === 'semantic') {
          return []; // Semantic-only with no vector → empty
        }
      }
    }

    if (mode === 'semantic' && vectorResults.length === 0 && !embeddingProvider) {
      return []; // No embedding provider for semantic search
    }

    // Merge results via RRF
    const merged = this.mergeRRF(ftsResults, vectorResults);

    // Take top results and resolve full context
    const topItems = merged.slice(0, limit);
    return this.resolveResults(topItems, sourceId);
  }

  /** Merge FTS and vector results using Reciprocal Rank Fusion. */
  private mergeRRF(ftsResults: FTSResult[], vectorResults: VectorResult[]): RankedItem[] {
    const scoreMap = new Map<string, RankedItem>();

    // Add FTS results (ranked by BM25 score, lower = better)
    for (let rank = 0; rank < ftsResults.length; rank++) {
      const r = ftsResults[rank];
      const existing = scoreMap.get(r.chunkId) ?? { chunkId: r.chunkId, rrf: 0 };
      existing.rrf += 1 / (RRF_K + rank + 1);
      existing.ftsScore = r.score;
      scoreMap.set(r.chunkId, existing);
    }

    // Add vector results (ranked by cosine similarity, higher = better, already sorted)
    for (let rank = 0; rank < vectorResults.length; rank++) {
      const r = vectorResults[rank];
      const existing = scoreMap.get(r.chunkId) ?? { chunkId: r.chunkId, rrf: 0 };
      existing.rrf += 1 / (RRF_K + rank + 1);
      existing.vectorScore = r.score;
      scoreMap.set(r.chunkId, existing);
    }

    // Sort by RRF score descending
    const items = [...scoreMap.values()];
    items.sort((a, b) => b.rrf - a.rrf);
    return items;
  }

  /** Resolve chunk IDs to full SearchResult objects with parent context. */
  private resolveResults(items: RankedItem[], _sourceId?: string): SearchResult[] {
    const results: SearchResult[] = [];

    for (const item of items) {
      const chunk = this.store.getChunk(item.chunkId);
      if (!chunk) continue;

      // Find the document for file path and source info
      const doc = this.store.getDocument(chunk.documentId);
      if (!doc) continue;

      // Find parent context
      let context = chunk.content;
      if (chunk.parentChunkId) {
        const parent = this.store.getChunk(chunk.parentChunkId);
        if (parent) context = parent.content;
      }

      // Get source name
      const source = this.store.getSource(doc.sourceId);

      results.push({
        score: item.rrf,
        filepath: doc.filepath,
        title: doc.title ?? '',
        context,
        snippet: chunk.content,
        documentId: doc.id,
        collectionName: source?.name ?? doc.sourceId,
        chunkId: chunk.id,
      });
    }

    return results;
  }
}
