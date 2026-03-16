import type { GraphRunCheckpoint } from './graph-types.js';

export class InMemoryRunStateStore<TStepResult> {
  private readonly checkpoints = new Map<string, GraphRunCheckpoint<TStepResult>>();

  save(checkpoint: GraphRunCheckpoint<TStepResult>): void {
    this.checkpoints.set(checkpoint.runId, {
      ...checkpoint,
      completedNodeIds: [...checkpoint.completedNodeIds],
      results: [...checkpoint.results],
      events: checkpoint.events.map((event) => ({ ...event })),
    });
  }

  get(runId: string): GraphRunCheckpoint<TStepResult> | null {
    const checkpoint = this.checkpoints.get(runId);
    if (!checkpoint) return null;
    return {
      ...checkpoint,
      completedNodeIds: [...checkpoint.completedNodeIds],
      results: [...checkpoint.results],
      events: checkpoint.events.map((event) => ({ ...event })),
    };
  }

  list(limit = 100): GraphRunCheckpoint<TStepResult>[] {
    return [...this.checkpoints.values()]
      .sort((left, right) => right.updatedAt - left.updatedAt)
      .slice(0, Math.max(1, limit))
      .map((checkpoint) => ({
        ...checkpoint,
        completedNodeIds: [...checkpoint.completedNodeIds],
        results: [...checkpoint.results],
        events: checkpoint.events.map((event) => ({ ...event })),
      }));
  }
}
