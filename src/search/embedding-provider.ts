/**
 * Embedding providers — generate vector embeddings from text.
 *
 * Two implementations:
 * - OllamaEmbeddingProvider: local via Ollama API
 * - OpenAIEmbeddingProvider: cloud via OpenAI SDK
 */

import type { EmbeddingProvider } from './types.js';

// ─── Ollama Embedding Provider ────────────────────────────

export class OllamaEmbeddingProvider implements EmbeddingProvider {
  readonly name = 'ollama';
  readonly dimensions: number;
  private readonly baseUrl: string;
  private readonly model: string;

  constructor(options?: { baseUrl?: string; model?: string; dimensions?: number }) {
    this.baseUrl = (options?.baseUrl ?? 'http://localhost:11434').replace(/\/$/, '');
    this.model = options?.model ?? 'nomic-embed-text';
    this.dimensions = options?.dimensions ?? 768;
  }

  async embed(texts: string[]): Promise<Float32Array[]> {
    if (texts.length === 0) return [];

    const response = await fetch(`${this.baseUrl}/api/embed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: this.model, input: texts }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Ollama embed API error ${response.status}: ${body}`);
    }

    const data = await response.json() as { embeddings: number[][] };
    if (!data.embeddings || !Array.isArray(data.embeddings)) {
      throw new Error('Ollama embed response missing embeddings array');
    }

    return data.embeddings.map(e => new Float32Array(e));
  }
}

// ─── OpenAI Embedding Provider ────────────────────────────

export class OpenAIEmbeddingProvider implements EmbeddingProvider {
  readonly name = 'openai';
  readonly dimensions: number;
  private readonly baseUrl: string;
  private readonly model: string;
  private readonly apiKey: string;

  constructor(options: { apiKey: string; baseUrl?: string; model?: string; dimensions?: number }) {
    this.apiKey = options.apiKey;
    this.baseUrl = (options.baseUrl ?? 'https://api.openai.com/v1').replace(/\/$/, '');
    this.model = options.model ?? 'text-embedding-3-small';
    this.dimensions = options.dimensions ?? 1536;
  }

  async embed(texts: string[]): Promise<Float32Array[]> {
    if (texts.length === 0) return [];

    const response = await fetch(`${this.baseUrl}/embeddings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        input: texts,
        ...(this.dimensions !== 1536 ? { dimensions: this.dimensions } : {}),
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`OpenAI embeddings API error ${response.status}: ${body}`);
    }

    const data = await response.json() as {
      data: Array<{ embedding: number[]; index: number }>;
    };

    // Sort by index to maintain input order
    const sorted = data.data.sort((a, b) => a.index - b.index);
    return sorted.map(d => new Float32Array(d.embedding));
  }
}

// ─── Factory ──────────────────────────────────────────────

export interface EmbeddingConfig {
  provider?: 'ollama' | 'openai';
  model?: string;
  baseUrl?: string;
  apiKey?: string;
  batchSize?: number;
  dimensions?: number;
}

/** Create an embedding provider from config. Returns null if config is insufficient. */
export function createEmbeddingProvider(config?: EmbeddingConfig): EmbeddingProvider | null {
  if (!config) return null;

  const provider = config.provider ?? 'ollama';

  if (provider === 'openai') {
    if (!config.apiKey) return null;
    return new OpenAIEmbeddingProvider({
      apiKey: config.apiKey,
      baseUrl: config.baseUrl,
      model: config.model,
      dimensions: config.dimensions,
    });
  }

  // Default: Ollama
  return new OllamaEmbeddingProvider({
    baseUrl: config.baseUrl,
    model: config.model,
    dimensions: config.dimensions,
  });
}

// ─── Batch Helper ─────────────────────────────────────────

/**
 * Embed texts in batches to avoid API limits.
 *
 * @param provider - Embedding provider
 * @param texts - Texts to embed
 * @param batchSize - Max texts per API call (default 32)
 */
export async function embedInBatches(
  provider: EmbeddingProvider,
  texts: string[],
  batchSize: number = 32,
): Promise<Float32Array[]> {
  if (texts.length === 0) return [];
  if (texts.length <= batchSize) return provider.embed(texts);

  const results: Float32Array[] = [];
  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    const embeddings = await provider.embed(batch);
    results.push(...embeddings);
  }
  return results;
}
