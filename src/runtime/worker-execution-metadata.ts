export type WorkerExecutionLifecycle = 'completed' | 'blocked' | 'failed';
export type WorkerExecutionSource = 'tool_loop' | 'planner';
export type WorkerExecutionResponseQuality = 'final' | 'degraded';
export type WorkerExecutionTerminationReason =
  | 'clean_exit'
  | 'max_rounds'
  | 'max_wall_clock'
  | 'provider_error'
  | 'disconnect'
  | 'watchdog_kill';
export type WorkerExecutionCompletionReason =
  | 'answer_first_response'
  | 'model_response'
  | 'fallback_model_response'
  | 'answer_first_fallback'
  | 'approval_pending'
  | 'phantom_approval_response'
  | 'degraded_response'
  | 'empty_response_fallback'
  | 'planner_completed'
  | 'planner_failed'
  | 'planner_generation_failed'
  | 'unsupported_actions';

export interface WorkerExecutionMetadata {
  lifecycle: WorkerExecutionLifecycle;
  source: WorkerExecutionSource;
  completionReason: WorkerExecutionCompletionReason;
  responseQuality?: WorkerExecutionResponseQuality;
  terminationReason?: WorkerExecutionTerminationReason;
  blockerKind?: string;
  roundCount?: number;
  toolCallCount?: number;
  toolResultCount?: number;
  successfulToolResultCount?: number;
  pendingApprovalCount?: number;
}

export function buildWorkerExecutionMetadata(
  metadata: WorkerExecutionMetadata,
): Record<'workerExecution', Record<string, unknown>> {
  return {
    workerExecution: {
      lifecycle: metadata.lifecycle,
      source: metadata.source,
      completionReason: metadata.completionReason,
      ...(metadata.responseQuality ? { responseQuality: metadata.responseQuality } : {}),
      ...(metadata.terminationReason ? { terminationReason: metadata.terminationReason } : {}),
      ...(metadata.blockerKind ? { blockerKind: metadata.blockerKind } : {}),
      ...(typeof metadata.roundCount === 'number' ? { roundCount: metadata.roundCount } : {}),
      ...(typeof metadata.toolCallCount === 'number' ? { toolCallCount: metadata.toolCallCount } : {}),
      ...(typeof metadata.toolResultCount === 'number' ? { toolResultCount: metadata.toolResultCount } : {}),
      ...(typeof metadata.successfulToolResultCount === 'number'
        ? { successfulToolResultCount: metadata.successfulToolResultCount }
        : {}),
      ...(typeof metadata.pendingApprovalCount === 'number' ? { pendingApprovalCount: metadata.pendingApprovalCount } : {}),
    },
  };
}

export function readWorkerExecutionMetadata(
  metadata: Record<string, unknown> | undefined,
): WorkerExecutionMetadata | undefined {
  const workerExecution = metadata?.workerExecution;
  if (!isRecord(workerExecution)) return undefined;
  if (!isWorkerExecutionLifecycle(workerExecution.lifecycle)) return undefined;
  if (!isWorkerExecutionSource(workerExecution.source)) return undefined;
  if (!isWorkerExecutionCompletionReason(workerExecution.completionReason)) return undefined;

  return {
    lifecycle: workerExecution.lifecycle,
    source: workerExecution.source,
    completionReason: workerExecution.completionReason,
    ...(isWorkerExecutionResponseQuality(workerExecution.responseQuality)
      ? { responseQuality: workerExecution.responseQuality }
      : {}),
    ...(isWorkerExecutionTerminationReason(workerExecution.terminationReason)
      ? { terminationReason: workerExecution.terminationReason }
      : {}),
    ...(typeof workerExecution.blockerKind === 'string' && workerExecution.blockerKind.trim().length > 0
      ? { blockerKind: workerExecution.blockerKind.trim() }
      : {}),
    ...(typeof workerExecution.roundCount === 'number' ? { roundCount: workerExecution.roundCount } : {}),
    ...(typeof workerExecution.toolCallCount === 'number' ? { toolCallCount: workerExecution.toolCallCount } : {}),
    ...(typeof workerExecution.toolResultCount === 'number' ? { toolResultCount: workerExecution.toolResultCount } : {}),
    ...(typeof workerExecution.successfulToolResultCount === 'number'
      ? { successfulToolResultCount: workerExecution.successfulToolResultCount }
      : {}),
    ...(typeof workerExecution.pendingApprovalCount === 'number'
      ? { pendingApprovalCount: workerExecution.pendingApprovalCount }
      : {}),
  };
}

function isWorkerExecutionLifecycle(value: unknown): value is WorkerExecutionLifecycle {
  return value === 'completed' || value === 'blocked' || value === 'failed';
}

function isWorkerExecutionSource(value: unknown): value is WorkerExecutionSource {
  return value === 'tool_loop' || value === 'planner';
}

function isWorkerExecutionResponseQuality(value: unknown): value is WorkerExecutionResponseQuality {
  return value === 'final' || value === 'degraded';
}

function isWorkerExecutionTerminationReason(value: unknown): value is WorkerExecutionTerminationReason {
  return value === 'clean_exit'
    || value === 'max_rounds'
    || value === 'max_wall_clock'
    || value === 'provider_error'
    || value === 'disconnect'
    || value === 'watchdog_kill';
}

function isWorkerExecutionCompletionReason(value: unknown): value is WorkerExecutionCompletionReason {
  return value === 'answer_first_response'
    || value === 'model_response'
    || value === 'fallback_model_response'
    || value === 'answer_first_fallback'
    || value === 'approval_pending'
    || value === 'phantom_approval_response'
    || value === 'degraded_response'
    || value === 'empty_response_fallback'
    || value === 'planner_completed'
    || value === 'planner_failed'
    || value === 'planner_generation_failed'
    || value === 'unsupported_actions';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}
