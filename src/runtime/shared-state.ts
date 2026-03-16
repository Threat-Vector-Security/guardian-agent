/**
 * Shared state — inter-agent data passing for orchestration patterns.
 *
 * Enables Sequential/Parallel/Loop agents to share intermediate results
 * through a key-value store. Supports two scoping conventions:
 *
 * - Regular keys: persist for the lifetime of the orchestration run
 * - "temp:" prefixed keys: cleared after each orchestration invocation
 *
 * All reads/writes are synchronous for simplicity within a single runtime.
 */

export interface SharedStateMetadata {
  producerAgent?: string;
  timestamp: number;
  schemaId?: string;
  validationStatus?: 'warned' | 'enforced' | 'none' | 'failed';
  taintReasons?: string[];
}

/** Read-only view of shared state for sub-agents. */
export interface SharedStateView {
  get<T = unknown>(key: string): T | undefined;
  getMetadata(key: string): SharedStateMetadata | undefined;
  has(key: string): boolean;
  keys(): string[];
  snapshot(): Record<string, unknown>;
}

export interface SharedStateOptions {
  maxStateBytes?: number;
}

/**
 * Mutable shared state for orchestration agents.
 *
 * Orchestration agents (Sequential, Parallel, Loop) own the state
 * and pass read-only views to sub-agents when needed.
 */
export class SharedState implements SharedStateView {
  private state: Map<string, unknown> = new Map();
  private metadata: Map<string, SharedStateMetadata> = new Map();
  private tempKeys: Set<string> = new Set();
  private maxStateBytes: number;

  constructor(options?: SharedStateOptions) {
    this.maxStateBytes = options?.maxStateBytes ?? 10 * 1024 * 1024; // Default 10MB
  }

  private estimateBytes(value: unknown): number {
    if (typeof value === 'string') return value.length * 2;
    return JSON.stringify(value)?.length || 0;
  }

  private getTotalBytes(): number {
    let total = 0;
    for (const value of this.state.values()) {
      total += this.estimateBytes(value);
    }
    return total;
  }

  /** Get a value by key. Returns undefined if not set. */
  get<T = unknown>(key: string): T | undefined {
    return this.state.get(key) as T | undefined;
  }

  getMetadata(key: string): SharedStateMetadata | undefined {
    return this.metadata.get(key);
  }

  /** Set a value. Keys starting with "temp:" are tracked for bulk cleanup. */
  set(key: string, value: unknown, meta?: Partial<SharedStateMetadata>): void {
    const valueBytes = this.estimateBytes(value);
    if (this.getTotalBytes() + valueBytes > this.maxStateBytes) {
      throw new Error(`SharedState capacity exceeded. Cannot add ${valueBytes} bytes for key '${key}'.`);
    }

    this.state.set(key, value);
    this.metadata.set(key, {
      timestamp: Date.now(),
      validationStatus: 'none',
      ...meta,
    });
    
    if (key.startsWith('temp:')) {
      this.tempKeys.add(key);
    }
  }

  /** Check if a key exists. */
  has(key: string): boolean {
    return this.state.has(key);
  }

  /** Delete a single key. */
  delete(key: string): boolean {
    this.tempKeys.delete(key);
    this.metadata.delete(key);
    return this.state.delete(key);
  }

  /** Get all keys. */
  keys(): string[] {
    return [...this.state.keys()];
  }

  /** Return a plain-object snapshot of all state. */
  snapshot(): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const [key, value] of this.state) {
      result[key] = value;
    }
    return result;
  }

  /** Clear all keys with the "temp:" prefix. Called between orchestration runs. */
  clearTemp(): void {
    for (const key of this.tempKeys) {
      this.state.delete(key);
      this.metadata.delete(key);
    }
    this.tempKeys.clear();
  }

  /** Clear all state. */
  clear(): void {
    this.state.clear();
    this.metadata.clear();
    this.tempKeys.clear();
  }

  /** Number of entries. */
  get size(): number {
    return this.state.size;
  }

  /** Create a read-only view of this state. */
  asReadOnly(): SharedStateView {
    return {
      get: <T = unknown>(key: string) => this.get<T>(key),
      getMetadata: (key: string) => this.getMetadata(key),
      has: (key: string) => this.has(key),
      keys: () => this.keys(),
      snapshot: () => this.snapshot(),
    };
  }
}
