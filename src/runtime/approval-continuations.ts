export interface ApprovalContinuationScope {
  userId: string;
  channel: string;
  surfaceId?: string;
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
  const surfaceId = normalizeScopeValue(scope.surfaceId) || userId || 'default-surface';
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
