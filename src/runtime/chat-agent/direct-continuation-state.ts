import { isRecord, toString } from '../../chat-agent-helpers.js';
import type { ContinuityThreadContinuationState } from '../continuity-threads.js';

export function readDirectContinuationStateMetadata(
  metadata: Record<string, unknown> | undefined,
): ContinuityThreadContinuationState | null | undefined {
  if (!metadata || !Object.prototype.hasOwnProperty.call(metadata, 'continuationState')) {
    return undefined;
  }
  const raw = metadata.continuationState;
  if (raw === null) return null;
  if (!isRecord(raw) || !isRecord(raw.payload)) return undefined;
  const kind = toString(raw.kind).trim();
  if (!kind) return undefined;
  return {
    kind,
    payload: { ...raw.payload },
  };
}

export function stripDirectContinuationStateMetadata(
  metadata: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  if (!metadata) return undefined;
  const next = { ...metadata };
  delete next.continuationState;
  return Object.keys(next).length > 0 ? next : undefined;
}

export function normalizeDirectRouteContinuationResponse(input: {
  response: { content: string; metadata?: Record<string, unknown> };
  userId: string;
  channel: string;
  surfaceId?: string;
  updateDirectContinuationState: (
    userId: string,
    channel: string,
    surfaceId: string | undefined,
    continuationState: ContinuityThreadContinuationState | null,
  ) => unknown;
  withCurrentPendingActionMetadata: (
    metadata: Record<string, unknown> | undefined,
    userId: string,
    channel: string,
    surfaceId?: string,
  ) => Record<string, unknown> | undefined;
}): { content: string; metadata?: Record<string, unknown> } {
  const continuationState = readDirectContinuationStateMetadata(input.response.metadata);
  if (continuationState !== undefined) {
    input.updateDirectContinuationState(input.userId, input.channel, input.surfaceId, continuationState);
  }
  const baseMetadata = stripDirectContinuationStateMetadata(input.response.metadata);
  const metadata = input.withCurrentPendingActionMetadata(
    baseMetadata,
    input.userId,
    input.channel,
    input.surfaceId,
  );
  return {
    content: input.response.content,
    ...(metadata ? { metadata } : {}),
  };
}
