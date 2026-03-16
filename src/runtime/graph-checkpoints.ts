import type { GraphRunCheckpoint, GraphRunStatus } from './graph-types.js';
import type { InMemoryRunStateStore } from './run-state-store.js';

export class GraphCheckpointManager<TStepResult> {
  constructor(
    private readonly store: InMemoryRunStateStore<TStepResult>,
    private readonly now: () => number,
  ) {}

  create(runId: string, graphId: string, graphName: string): GraphRunCheckpoint<TStepResult> {
    const timestamp = this.now();
    const checkpoint: GraphRunCheckpoint<TStepResult> = {
      runId,
      graphId,
      graphName,
      status: 'running',
      createdAt: timestamp,
      updatedAt: timestamp,
      completedNodeIds: [],
      results: [],
      events: [],
    };
    this.store.save(checkpoint);
    return checkpoint;
  }

  update(
    checkpoint: GraphRunCheckpoint<TStepResult>,
    input: Partial<Pick<GraphRunCheckpoint<TStepResult>, 'currentNodeId' | 'results' | 'events' | 'completedNodeIds'>> & {
      status?: GraphRunStatus;
    },
  ): GraphRunCheckpoint<TStepResult> {
    const next: GraphRunCheckpoint<TStepResult> = {
      ...checkpoint,
      currentNodeId: input.currentNodeId ?? checkpoint.currentNodeId,
      results: input.results ? [...input.results] : [...checkpoint.results],
      events: input.events ? input.events.map((event) => ({ ...event })) : checkpoint.events.map((event) => ({ ...event })),
      completedNodeIds: input.completedNodeIds ? [...input.completedNodeIds] : [...checkpoint.completedNodeIds],
      status: input.status ?? checkpoint.status,
      updatedAt: this.now(),
    };
    this.store.save(next);
    return next;
  }
}
