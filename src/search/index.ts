/**
 * Search module — native TypeScript search pipeline.
 *
 * In-process FTS5 + vector search over indexed document collections.
 */

export { SearchService } from './search-service.js';
export { DocumentStore } from './document-store.js';
export { FTSStore, sanitizeFTSQuery } from './fts-store.js';
export { VectorStore, cosineSimilarity } from './vector-store.js';
export { HybridSearch } from './hybrid-search.js';
export { parseDocument, inferMimeType } from './document-parser.js';
export { chunkText, flattenChunks, estimateTokens } from './chunker.js';
export {
  OllamaEmbeddingProvider,
  OpenAIEmbeddingProvider,
  createEmbeddingProvider,
  embedInBatches,
} from './embedding-provider.js';
export { createReranker, CohereReranker } from './reranker.js';

export type {
  SearchMode,
  SearchSourceType,
  SearchSourceConfig,
  SearchOptions,
  SearchResult,
  SearchResponse,
  SearchConfig,
  SearchStatusResponse,
  CollectionInfo,
  DocumentRecord,
  ChunkRecord,
  EmbeddingProvider,
} from './types.js';
