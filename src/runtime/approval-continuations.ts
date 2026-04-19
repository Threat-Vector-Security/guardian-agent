import { resolveConversationSurfaceId } from './channel-surface-ids.js';

export interface ApprovalContinuationScope {
  userId: string;
  channel: string;
  surfaceId?: string;
}

export const APPROVAL_OUTCOME_CONTINUATION_METADATA_KEY = 'approvalOutcomeContinuation';

export interface ApprovalOutcomeContinuationMetadata {
  type: 'approval_outcome';
  approvalId: string;
  decision: 'approved' | 'denied';
  resultMessage?: string;
}

export interface SuspendedApprovalStateLike {
  scope: ApprovalContinuationScope;
  pendingTools: Array<{ approvalId: string }>;
}

function normalizeScopeValue(value: string | undefined): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function normalizeApprovalContinuationScope(scope: ApprovalContinuationScope): Required<ApprovalContinuationScope> {
  const userId = normalizeScopeValue(scope.userId);
  const channel = normalizeScopeValue(scope.channel) || 'web';
  const surfaceId = resolveConversationSurfaceId({
    channel,
    surfaceId: normalizeScopeValue(scope.surfaceId) || undefined,
    userId,
  });
  return {
    userId,
    channel,
    surfaceId,
  };
}

export function buildApprovalContinuationScopeKey(scope: ApprovalContinuationScope): string {
  const normalized = normalizeApprovalContinuationScope(scope);
  return `${normalized.userId}:${normalized.channel}:${normalized.surfaceId}`;
}

export function shouldContinueConversationAfterApprovalDecision(input: {
  decision: 'approved' | 'denied';
  hasContinuation: boolean;
}): boolean {
  return input.decision === 'approved' && input.hasContinuation;
}

export function findSuspendedApprovalState<T extends SuspendedApprovalStateLike>(
  sessions: Iterable<T>,
  approvalId: string,
  scope?: ApprovalContinuationScope,
): T | null {
  const normalizedApprovalId = approvalId.trim();
  if (!normalizedApprovalId) return null;

  const normalizedScope = scope ? normalizeApprovalContinuationScope(scope) : null;
  for (const session of sessions) {
    const sessionScope = normalizeApprovalContinuationScope(session.scope);
    if (normalizedScope
      && (sessionScope.userId !== normalizedScope.userId
        || sessionScope.channel !== normalizedScope.channel
        || sessionScope.surfaceId !== normalizedScope.surfaceId)) {
      continue;
    }
    if (session.pendingTools.some((tool) => tool.approvalId === normalizedApprovalId)) {
      return session;
    }
  }
  return null;
}

export function selectSuspendedOriginalMessage<T>(args: {
  isContinuation: boolean;
  existing: T | null | undefined;
  current: T;
}): T {
  if (args.isContinuation && args.existing) {
    return args.existing;
  }
  return args.current;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function buildApprovalOutcomeContinuationMetadata(input: {
  approvalId: string;
  decision: 'approved' | 'denied';
  resultMessage?: string;
}): Record<string, unknown> {
  return {
    [APPROVAL_OUTCOME_CONTINUATION_METADATA_KEY]: {
      type: 'approval_outcome',
      approvalId: input.approvalId.trim(),
      decision: input.decision,
      ...(typeof input.resultMessage === 'string' && input.resultMessage.trim()
        ? { resultMessage: input.resultMessage.trim() }
        : {}),
    } satisfies ApprovalOutcomeContinuationMetadata,
  };
}

export function readApprovalOutcomeContinuationMetadata(
  metadata: unknown,
): ApprovalOutcomeContinuationMetadata | null {
  if (!isRecord(metadata)) return null;
  const raw = metadata[APPROVAL_OUTCOME_CONTINUATION_METADATA_KEY];
  if (!isRecord(raw)) return null;
  if (raw.type !== 'approval_outcome') return null;
  const approvalId = typeof raw.approvalId === 'string' ? raw.approvalId.trim() : '';
  const decision = raw.decision === 'denied' ? 'denied' : raw.decision === 'approved' ? 'approved' : '';
  if (!approvalId || !decision) return null;
  return {
    type: 'approval_outcome',
    approvalId,
    decision,
    ...(typeof raw.resultMessage === 'string' && raw.resultMessage.trim()
      ? { resultMessage: raw.resultMessage.trim() }
      : {}),
  };
}
