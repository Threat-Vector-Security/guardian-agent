import { buildStepReceipts } from './task-plan.js';
import type {
  DelegatedResultEnvelope,
  DelegatedTaskContract,
  EvidenceReceipt,
  ExecutionEvent,
  Interruption,
  StepReceipt,
  WorkerRunStatus,
  WorkerStopReason,
} from './types.js';

export const DELEGATED_RESULT_METADATA_KEY = 'delegatedResult';
export const EXECUTION_EVENTS_METADATA_KEY = 'executionEvents';

export function buildDelegatedExecutionMetadata(
  envelope: DelegatedResultEnvelope,
): Record<string, unknown> {
  return {
    [DELEGATED_RESULT_METADATA_KEY]: envelope,
    [EXECUTION_EVENTS_METADATA_KEY]: envelope.events,
  };
}

export function sanitizeExecutionEventsForOperator(
  events: readonly ExecutionEvent[],
): ExecutionEvent[] {
  return events.map((event) => {
    const {
      args: _args,
      rawOutput: _rawOutput,
      traceResultPreview: _traceResultPreview,
      ...payload
    } = event.payload;
    return {
      ...event,
      payload,
    };
  });
}

export function sanitizeDelegatedEnvelopeForOperator(
  envelope: DelegatedResultEnvelope,
): DelegatedResultEnvelope {
  return {
    ...envelope,
    events: sanitizeExecutionEventsForOperator(envelope.events),
  };
}

export function readDelegatedResultEnvelope(
  metadata: Record<string, unknown> | undefined,
): DelegatedResultEnvelope | undefined {
  const value = metadata?.[DELEGATED_RESULT_METADATA_KEY];
  if (!isRecord(value)) return undefined;
  if (!isRecord(value.taskContract)) return undefined;
  if (!isRecord(value.taskContract.plan)) return undefined;
  if (!isWorkerRunStatus(value.runStatus)) return undefined;
  if (!isWorkerStopReason(value.stopReason)) return undefined;
  if (!Array.isArray(value.stepReceipts)) return undefined;
  if (!Array.isArray(value.interruptions)) return undefined;
  if (!Array.isArray(value.evidenceReceipts)) return undefined;
  if (!Array.isArray(value.events)) return undefined;
  return value as unknown as DelegatedResultEnvelope;
}

export function readExecutionEvents(
  metadata: Record<string, unknown> | undefined,
): ExecutionEvent[] {
  const value = metadata?.[EXECUTION_EVENTS_METADATA_KEY];
  return Array.isArray(value)
    ? value.filter((event): event is ExecutionEvent => isRecord(event) && typeof event.type === 'string' && typeof event.eventId === 'string')
    : [];
}

export function buildDelegatedProtocolFailureEnvelope(
  taskContract: DelegatedTaskContract,
  operatorSummary: string,
): DelegatedResultEnvelope {
  return buildDelegatedSyntheticEnvelope({
    taskContract,
    runStatus: 'failed',
    stopReason: 'error',
    operatorSummary,
  });
}

export function buildDelegatedSyntheticEnvelope(input: {
  taskContract: DelegatedTaskContract;
  runStatus: WorkerRunStatus;
  stopReason: WorkerStopReason;
  operatorSummary: string;
  evidenceReceipts?: EvidenceReceipt[];
  interruptions?: Interruption[];
  events?: ExecutionEvent[];
  stepReceipts?: StepReceipt[];
}): DelegatedResultEnvelope {
  const evidenceReceipts = input.evidenceReceipts ?? [];
  const interruptions = input.interruptions ?? [];
  return {
    taskContract: input.taskContract,
    runStatus: input.runStatus,
    stopReason: input.stopReason,
    stepReceipts: input.stepReceipts ?? buildStepReceipts({
      plannedTask: input.taskContract.plan,
      evidenceReceipts,
      interruptions,
    }),
    operatorSummary: input.operatorSummary,
    claims: [],
    evidenceReceipts,
    interruptions,
    artifacts: [],
    events: input.events ?? [],
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function isWorkerRunStatus(value: unknown): boolean {
  return value === 'completed'
    || value === 'suspended'
    || value === 'incomplete'
    || value === 'failed'
    || value === 'max_turns';
}

function isWorkerStopReason(value: unknown): boolean {
  return value === 'end_turn'
    || value === 'tool_use_pending'
    || value === 'max_tokens'
    || value === 'max_rounds'
    || value === 'approval_required'
    || value === 'error';
}
