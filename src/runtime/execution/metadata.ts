import type { DelegatedResultEnvelope, ExecutionEvent } from './types.js';

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

export function readDelegatedResultEnvelope(
  metadata: Record<string, unknown> | undefined,
): DelegatedResultEnvelope | undefined {
  const value = metadata?.[DELEGATED_RESULT_METADATA_KEY];
  if (!isRecord(value)) return undefined;
  if (!isRecord(value.taskContract)) return undefined;
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}
