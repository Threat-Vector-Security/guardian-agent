import type { GraphRunCheckpoint, GraphRunStatus } from './graph-types.js';
import type { RunStateStore } from './run-state-store.js';

export class GraphCheckpointManager<TStepResult> {
  constructor(
    private readonly store: RunStateStore<TStepResult>,
    private readonly now: () => number,
  ) {}

  create(
    runId: string,
    graphId: string,
    graphName: string,
    resumeContext?: Record<string, unknown>,
  ): GraphRunCheckpoint<TStepResult> {
    const timestamp = this.now();
    const checkpoint: GraphRunCheckpoint<TStepResult> = {
      runId,
      graphId,
      graphName,
      status: 'running',
      createdAt: timestamp,
      updatedAt: timestamp,
      completedNodeIds: [],
      pendingApprovalIds: [],
      results: [],
      events: [],
      resumeContext: resumeContext ? { ...resumeContext } : undefined,
    };
    this.store.save(checkpoint);
    return checkpoint;
  }

  update(
    checkpoint: GraphRunCheckpoint<TStepResult>,
    input: Partial<Pick<GraphRunCheckpoint<TStepResult>, 'currentNodeId' | 'nextNodeId' | 'results' | 'events' | 'completedNodeIds' | 'pendingApprovalIds' | 'resumeContext'>> & {
      status?: GraphRunStatus;
    },
  ): GraphRunCheckpoint<TStepResult> {
    const next: GraphRunCheckpoint<TStepResult> = {
      ...checkpoint,
      currentNodeId: input.currentNodeId ?? checkpoint.currentNodeId,
      nextNodeId: input.nextNodeId ?? checkpoint.nextNodeId,
      results: input.results ? [...input.results] : [...checkpoint.results],
      events: input.events ? input.events.map((event) => ({ ...event })) : checkpoint.events.map((event) => ({ ...event })),
      completedNodeIds: input.completedNodeIds ? [...input.completedNodeIds] : [...checkpoint.completedNodeIds],
      pendingApprovalIds: input.pendingApprovalIds ? [...input.pendingApprovalIds] : checkpoint.pendingApprovalIds ? [...checkpoint.pendingApprovalIds] : undefined,
      status: input.status ?? checkpoint.status,
      updatedAt: this.now(),
      resumeContext: input.resumeContext ? { ...input.resumeContext } : checkpoint.resumeContext ? { ...checkpoint.resumeContext } : undefined,
    };
    this.store.save(next);
    return next;
  }
}
