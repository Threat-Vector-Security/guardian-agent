/**
 * Optional re-ranker — re-scores search results for better relevance.
 *
 * Supports Cohere Rerank API or LLM-based scoring.
 * Disabled by default; enabled via config.
 */

import type { SearchResult } from './types.js';

export interface RerankerConfig {
  enabled: boolean;
  provider?: 'cohere' | 'llm';
  model?: string;
  apiKey?: string;
  topN?: number;
}

export interface Reranker {
  rerank(query: string, results: SearchResult[], topN: number): Promise<SearchResult[]>;
}

// ─── Cohere Reranker ──────────────────────────────────────

export class CohereReranker implements Reranker {
  private readonly apiKey: string;
  private readonly model: string;

  constructor(config: { apiKey: string; model?: string }) {
    this.apiKey = config.apiKey;
    this.model = config.model ?? 'rerank-v3.5';
  }

  async rerank(query: string, results: SearchResult[], topN: number): Promise<SearchResult[]> {
    if (results.length === 0) return [];

    const response = await fetch('https://api.cohere.com/v2/rerank', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        query,
        documents: results.map(r => r.snippet),
        top_n: topN,
      }),
    });

    if (!response.ok) {
      // Graceful degradation — return original results if reranking fails
      return results.slice(0, topN);
    }

    const data = await response.json() as {
      results: Array<{ index: number; relevance_score: number }>;
    };

    return data.results.map(r => ({
      ...results[r.index],
      score: r.relevance_score,
    }));
  }
}

// ─── Factory ──────────────────────────────────────────────

export function createReranker(config?: RerankerConfig): Reranker | null {
  if (!config?.enabled) return null;

  if (config.provider === 'cohere' && config.apiKey) {
    return new CohereReranker({ apiKey: config.apiKey, model: config.model });
  }

  // LLM-based reranking is a future enhancement
  return null;
}
