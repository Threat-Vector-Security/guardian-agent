import type { UserMessage } from '../../agent/types.js';
import { stripLeadingContextPrefix } from '../../chat-agent-helpers.js';
import type { PendingApprovalSummary } from '../pending-approval-copy.js';
import {
  toPendingActionClientMetadata,
  type PendingActionRecord,
} from '../pending-actions.js';

export interface PendingApprovalStatusOptions {
  exactOnly?: boolean;
}

export interface PendingApprovalStatusTools {
  isEnabled(): boolean;
  listPendingApprovalIdsForUser?: (
    userId: string | undefined,
    channel: string | undefined,
    options?: { includeUnscoped?: boolean; limit?: number; principalId?: string },
  ) => string[];
  getApprovalSummaries?: (approvalIds: string[]) => Map<string, PendingApprovalSummary>;
}

export interface PendingApprovalStatusDeps {
  tools?: PendingApprovalStatusTools;
  getCodeSessionSurfaceId(message: UserMessage): string | undefined;
  getPendingApprovalAction(userId: string, channel: string, surfaceId?: string): PendingActionRecord | null;
  setPendingApprovals(userKey: string, ids: string[], surfaceId?: string): void;
  formatPendingApprovalPrompt(
    ids: string[],
    summaries?: Map<string, { toolName: string; argsPreview: string }>,
  ): string;
}

export function isPendingApprovalStatusQuery(
  content: string,
  options?: PendingApprovalStatusOptions,
): boolean {
  const normalized = stripLeadingContextPrefix(content).replace(/\s+/g, ' ').trim();
  if (!normalized) return false;
  const exactPendingApprovalStatus = /^pending approvals?\??$/i.test(normalized)
    || /^approvals? pending\??$/i.test(normalized);
  const broadPendingApprovalStatus =
    /^(?:what|which)\s+(?:pending approvals?|approvals?\s+pending)(?:\s+do i have)?(?:\s+(?:right now|currently|today))?\??$/i.test(normalized)
    || /^(?:show|list)\s+(?:my\s+|the\s+)?(?:current\s+)?(?:pending approvals?|approvals?\s+pending)(?:\s+(?:right now|currently|today))?\??$/i.test(normalized)
    || /^(?:are there|do i have)\s+(?:any\s+)?(?:pending approvals?|approvals?\s+pending)(?:\s+(?:right now|currently|today))?\??$/i.test(normalized)
    || /^(?:any|current)\s+(?:pending approvals?|approvals?\s+pending)\??$/i.test(normalized)
    || /^(?:pending approvals?|approvals?\s+pending)\s+(?:right now|currently|today)\??$/i.test(normalized);

  return options?.exactOnly === true
    ? exactPendingApprovalStatus
    : exactPendingApprovalStatus || broadPendingApprovalStatus;
}

export function tryBuildDirectPendingApprovalStatusResponse(
  message: UserMessage,
  deps: PendingApprovalStatusDeps,
  options?: PendingApprovalStatusOptions,
): { content: string; metadata?: Record<string, unknown> } | null {
  if (!deps.tools?.isEnabled()) return null;
  if (!isPendingApprovalStatusQuery(message.content, options)) return null;

  const surfaceId = deps.getCodeSessionSurfaceId(message);
  let pendingAction = deps.getPendingApprovalAction(message.userId, message.channel, surfaceId);
  if (!pendingAction) {
    const liveApprovalIds = deps.tools.listPendingApprovalIdsForUser?.(message.userId, message.channel, {
      includeUnscoped: message.channel === 'web',
    }) ?? [];
    if (liveApprovalIds.length > 0) {
      deps.setPendingApprovals(`${message.userId}:${message.channel}`, liveApprovalIds, surfaceId);
      pendingAction = deps.getPendingApprovalAction(message.userId, message.channel, surfaceId);
    }
  }

  const approvalIds = pendingAction?.blocker.approvalIds ?? [];
  const summaries = approvalIds.length > 0
    ? deps.tools.getApprovalSummaries?.(approvalIds)
    : undefined;
  const content = deps.formatPendingApprovalPrompt(approvalIds, summaries);
  const pendingActionMeta = toPendingActionClientMetadata(pendingAction);
  return {
    content,
    metadata: pendingActionMeta ? { pendingAction: pendingActionMeta } : undefined,
  };
}
