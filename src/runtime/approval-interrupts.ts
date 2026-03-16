import { createRunEvent, type OrchestrationRunEvent } from './run-events.js';

export interface ApprovalInterruptState {
  approvalIds: string[];
  message: string;
}

export function buildApprovalInterruptEvents(
  runId: string,
  now: number,
  input: {
    nodeId: string;
    approvalIds: string[];
    message: string;
  },
): OrchestrationRunEvent[] {
  return [
    createRunEvent(runId, 'approval_requested', now, {
      nodeId: input.nodeId,
      message: input.message,
      metadata: { approvalIds: input.approvalIds },
    }),
    createRunEvent(runId, 'run_interrupted', now, {
      nodeId: input.nodeId,
      message: 'Execution paused for approval.',
      metadata: { approvalIds: input.approvalIds },
    }),
  ];
}
