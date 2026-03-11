/**
 * FTS5 keyword search — BM25-ranked full-text search over chunks.
 *
 * Uses the FTS5 virtual table created by DocumentStore (content-sync mode).
 * Query sanitization mirrors conversation.ts pattern.
 */

import type { SQLiteDatabase } from '../runtime/sqlite-driver.js';

export interface FTSResult {
  chunkId: string;
  score: number;
  content: string;
  documentId: string;
  parentChunkId: string | null;
  chunkType: 'parent' | 'child';
}

export class FTSStore {
  constructor(private readonly db: SQLiteDatabase) {}

  /**
   * Search chunks using FTS5 BM25 ranking.
   *
   * @param query - Search query (will be sanitized for FTS5 syntax)
   * @param sourceId - Optional source filter
   * @param limit - Max results (default 20)
   */
  search(query: string, sourceId?: string, limit: number = 20): FTSResult[] {
    const safeQuery = sanitizeFTSQuery(query);
    if (!safeQuery) return [];

    let sql = `
      SELECT
        c.id as chunk_id,
        bm25(chunks_fts) as score,
        c.content,
        c.document_id,
        c.parent_chunk_id,
        c.chunk_type
      FROM chunks_fts fts
      JOIN chunks c ON c.rowid = fts.rowid
    `;

    const params: unknown[] = [safeQuery];

    if (sourceId) {
      sql += `
        JOIN documents d ON d.id = c.document_id
        WHERE fts.content MATCH ?
          AND d.source_id = ?
      `;
      params.push(sourceId);
    } else {
      sql += ' WHERE fts.content MATCH ?';
    }

    sql += ' ORDER BY bm25(chunks_fts) LIMIT ?';
    params.push(limit);

    const rows = this.db.prepare(sql).all(...params) as Array<Record<string, unknown>>;
    return rows.map(r => ({
      chunkId: r.chunk_id as string,
      score: r.score as number,
      content: r.content as string,
      documentId: r.document_id as string,
      parentChunkId: r.parent_chunk_id as string | null,
      chunkType: r.chunk_type as 'parent' | 'child',
    }));
  }

  /** Rebuild the FTS index from the chunks table. */
  rebuild(): void {
    this.db.exec(`INSERT INTO chunks_fts(chunks_fts) VALUES ('rebuild')`);
  }
}

/**
 * Sanitize a user query for FTS5 MATCH syntax.
 * Removes special characters that could cause syntax errors.
 */
export function sanitizeFTSQuery(query: string): string {
  return query
    .replace(/['"]/g, ' ')       // Remove quotes
    .replace(/[(){}[\]]/g, ' ')  // Remove brackets
    .replace(/[*^~]/g, ' ')      // Remove FTS operators
    .replace(/\b(AND|OR|NOT|NEAR)\b/gi, ' ')  // Remove FTS keywords used as operators
    .replace(/\s+/g, ' ')
    .trim();
}
