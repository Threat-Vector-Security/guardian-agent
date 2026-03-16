import { randomUUID } from 'node:crypto';

export type OrchestrationRunEventType =
  | 'run_created'
  | 'node_started'
  | 'node_completed'
  | 'approval_requested'
  | 'approval_denied'
  | 'run_interrupted'
  | 'run_resumed'
  | 'handoff_started'
  | 'handoff_completed'
  | 'verification_pending'
  | 'verification_completed'
  | 'run_completed'
  | 'run_failed';

export interface OrchestrationRunEvent {
  id: string;
  runId: string;
  parentRunId?: string;
  type: OrchestrationRunEventType;
  nodeId?: string;
  timestamp: number;
  message?: string;
  metadata?: Record<string, unknown>;
}

export function createRunEvent(
  runId: string,
  type: OrchestrationRunEventType,
  now: number,
  input: {
    parentRunId?: string;
    nodeId?: string;
    message?: string;
    metadata?: Record<string, unknown>;
  } = {},
): OrchestrationRunEvent {
  return {
    id: randomUUID(),
    runId,
    parentRunId: input.parentRunId,
    type,
    nodeId: input.nodeId,
    timestamp: now,
    message: input.message,
    metadata: input.metadata,
  };
}
