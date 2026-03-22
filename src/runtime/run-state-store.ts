import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { GraphRunCheckpoint } from './graph-types.js';

export interface RunStateStore<TStepResult> {
  save(checkpoint: GraphRunCheckpoint<TStepResult>): void;
  get(runId: string): GraphRunCheckpoint<TStepResult> | null;
  list(limit?: number): GraphRunCheckpoint<TStepResult>[];
}

function cloneCheckpoint<TStepResult>(checkpoint: GraphRunCheckpoint<TStepResult>): GraphRunCheckpoint<TStepResult> {
  return {
    ...checkpoint,
    completedNodeIds: [...checkpoint.completedNodeIds],
    pendingApprovalIds: checkpoint.pendingApprovalIds ? [...checkpoint.pendingApprovalIds] : undefined,
    results: [...checkpoint.results],
    events: checkpoint.events.map((event) => ({ ...event })),
    resumeContext: checkpoint.resumeContext ? { ...checkpoint.resumeContext } : undefined,
  };
}

export class InMemoryRunStateStore<TStepResult> implements RunStateStore<TStepResult> {
  private readonly checkpoints = new Map<string, GraphRunCheckpoint<TStepResult>>();

  save(checkpoint: GraphRunCheckpoint<TStepResult>): void {
    this.checkpoints.set(checkpoint.runId, cloneCheckpoint(checkpoint));
  }

  get(runId: string): GraphRunCheckpoint<TStepResult> | null {
    const checkpoint = this.checkpoints.get(runId);
    return checkpoint ? cloneCheckpoint(checkpoint) : null;
  }

  list(limit = 100): GraphRunCheckpoint<TStepResult>[] {
    return [...this.checkpoints.values()]
      .sort((left, right) => right.updatedAt - left.updatedAt)
      .slice(0, Math.max(1, limit))
      .map((checkpoint) => cloneCheckpoint(checkpoint));
  }
}

export interface JsonFileRunStateStoreOptions {
  persistPath: string;
  maxEntries?: number;
}

export class JsonFileRunStateStore<TStepResult> implements RunStateStore<TStepResult> {
  private readonly persistPath: string;
  private readonly maxEntries: number;
  private readonly checkpoints = new Map<string, GraphRunCheckpoint<TStepResult>>();

  constructor(options: JsonFileRunStateStoreOptions) {
    this.persistPath = options.persistPath;
    this.maxEntries = Math.max(1, options.maxEntries ?? 200);
    this.load();
  }

  save(checkpoint: GraphRunCheckpoint<TStepResult>): void {
    this.checkpoints.set(checkpoint.runId, cloneCheckpoint(checkpoint));
    this.compact();
    this.persist();
  }

  get(runId: string): GraphRunCheckpoint<TStepResult> | null {
    const checkpoint = this.checkpoints.get(runId);
    return checkpoint ? cloneCheckpoint(checkpoint) : null;
  }

  list(limit = 100): GraphRunCheckpoint<TStepResult>[] {
    return [...this.checkpoints.values()]
      .sort((left, right) => right.updatedAt - left.updatedAt)
      .slice(0, Math.max(1, limit))
      .map((checkpoint) => cloneCheckpoint(checkpoint));
  }

  private load(): void {
    if (!existsSync(this.persistPath)) return;
    try {
      const raw = readFileSync(this.persistPath, 'utf-8');
      const parsed = JSON.parse(raw) as { checkpoints?: Array<GraphRunCheckpoint<TStepResult>> };
      for (const checkpoint of parsed.checkpoints ?? []) {
        if (!checkpoint?.runId) continue;
        this.checkpoints.set(checkpoint.runId, cloneCheckpoint(checkpoint));
      }
      this.compact();
    } catch {
      this.checkpoints.clear();
    }
  }

  private persist(): void {
    mkdirSync(dirname(this.persistPath), { recursive: true });
    const tmpPath = `${this.persistPath}.tmp`;
    const payload = JSON.stringify({
      version: 1,
      checkpoints: this.list(this.maxEntries),
    }, null, 2);
    writeFileSync(tmpPath, payload, 'utf-8');
    renameSync(tmpPath, this.persistPath);
  }

  private compact(): void {
    const ordered = [...this.checkpoints.values()]
      .sort((left, right) => right.updatedAt - left.updatedAt)
      .slice(0, this.maxEntries);
    this.checkpoints.clear();
    for (const checkpoint of ordered) {
      this.checkpoints.set(checkpoint.runId, checkpoint);
    }
  }
}
