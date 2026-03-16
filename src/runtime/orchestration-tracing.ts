import { randomUUID } from 'node:crypto';

export interface OrchestrationTraceSpan {
  id: string;
  runId: string;
  groupId: string;
  parentRunId?: string;
  type: 'compile' | 'validate' | 'repair' | 'save' | 'node' | 'approval' | 'resume' | 'handoff' | 'verification';
  name: string;
  startedAt: number;
  completedAt?: number;
  status: 'running' | 'succeeded' | 'failed' | 'blocked';
  metadata?: Record<string, unknown>;
}

export function createOrchestrationSpan(
  input: Omit<OrchestrationTraceSpan, 'id'>,
): OrchestrationTraceSpan {
  return {
    id: randomUUID(),
    ...input,
  };
}
