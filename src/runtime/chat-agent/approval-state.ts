import type { AgentContext, UserMessage } from '../../agent/types.js';
import type { ToolExecutor } from '../../tools/executor.js';
import {
  describePendingApproval,
  formatPendingApprovalMessage,
} from '../pending-approval-copy.js';
import { PENDING_APPROVAL_TTL_MS } from './orchestration-state.js';

export const APPROVAL_CONFIRM_PATTERN = /^(?:\/)?(?:approve|approved|yes|yep|yeah|y|go ahead|do it|confirm|ok|okay|sure|proceed|accept)\b/i;
export const APPROVAL_DENY_PATTERN = /^(?:\/)?(?:deny|denied|reject|decline|cancel|no|nope|nah|n)\b/i;
export const APPROVAL_COMMAND_PATTERN = /^\/?(approve|deny)\b/i;

const APPROVAL_ID_TOKEN_PATTERN = /^(?=.*(?:-|\d))[a-z0-9-]{4,}$/i;

export interface ApprovalFollowUpCopy {
  approved?: string;
  denied?: string;
}

export interface AutomationApprovalContinuation {
  originalMessage: UserMessage;
  ctx: AgentContext;
  pendingApprovalIds: string[];
  expiresAt: number;
}

export interface ChatAgentApprovalStateDeps {
  tools?: Pick<ToolExecutor, 'getApprovalSummaries'> | null;
}

export class ChatAgentApprovalState {
  private readonly approvalFollowUps = new Map<string, ApprovalFollowUpCopy>();
  private readonly automationApprovalContinuations = new Map<string, AutomationApprovalContinuation>();
  private readonly tools?: Pick<ToolExecutor, 'getApprovalSummaries'> | null;

  constructor(deps: ChatAgentApprovalStateDeps) {
    this.tools = deps.tools;
  }

  setApprovalFollowUp(approvalId: string, copy: ApprovalFollowUpCopy): void {
    const normalizedId = approvalId.trim();
    if (!normalizedId) return;
    this.approvalFollowUps.set(normalizedId, copy);
  }

  clearApprovalFollowUp(approvalId: string): void {
    this.approvalFollowUps.delete(approvalId.trim());
  }

  takeApprovalFollowUp(approvalId: string, decision: 'approved' | 'denied'): string | null {
    const normalizedId = approvalId.trim();
    if (!normalizedId) return null;
    const copy = this.approvalFollowUps.get(normalizedId);
    if (!copy) return null;
    this.approvalFollowUps.delete(normalizedId);
    return decision === 'approved'
      ? (copy.approved ?? null)
      : (copy.denied ?? null);
  }

  getAutomationApprovalContinuation(
    userKey: string,
    nowMs: number = Date.now(),
  ): AutomationApprovalContinuation | null {
    const state = this.automationApprovalContinuations.get(userKey);
    if (!state) return null;
    if (state.expiresAt <= nowMs) {
      this.automationApprovalContinuations.delete(userKey);
      return null;
    }
    return state;
  }

  setAutomationApprovalContinuation(
    userKey: string,
    originalMessage: UserMessage,
    ctx: AgentContext,
    pendingApprovalIds: string[],
    expiresAt: number = Date.now() + PENDING_APPROVAL_TTL_MS,
  ): void {
    const uniqueIds = [...new Set(pendingApprovalIds.filter((id) => id.trim().length > 0))];
    if (uniqueIds.length === 0) {
      this.automationApprovalContinuations.delete(userKey);
      return;
    }
    this.automationApprovalContinuations.set(userKey, {
      originalMessage,
      ctx,
      pendingApprovalIds: uniqueIds,
      expiresAt,
    });
  }

  clearAutomationApprovalContinuation(userKey: string): void {
    this.automationApprovalContinuations.delete(userKey);
  }

  hasAutomationApprovalContinuation(approvalId: string): boolean {
    const normalizedId = approvalId.trim();
    if (!normalizedId) return false;
    for (const continuation of this.automationApprovalContinuations.values()) {
      if (continuation.pendingApprovalIds.includes(normalizedId)) {
        return true;
      }
    }
    return false;
  }

  findAutomationApprovalContinuation(approvalId: string) {
    const normalizedId = approvalId.trim();
    if (!normalizedId) return null;
    for (const [userKey, continuation] of this.automationApprovalContinuations.entries()) {
      if (continuation.pendingApprovalIds.includes(normalizedId)) {
        return { userKey, continuation };
      }
    }
    return null;
  }

  resolveApprovalTargets(
    input: string,
    pendingIds: string[],
  ): { ids: string[]; errors: string[] } {
    const argsText = input.replace(APPROVAL_COMMAND_PATTERN, '').trim();
    if (!argsText) return { ids: pendingIds, errors: [] };
    const rawTokens = argsText
      .split(/[,\s]+/)
      .map((token) => token.trim().replace(/^\[+|\]+$/g, ''))
      .filter(Boolean)
      .filter((token) => APPROVAL_ID_TOKEN_PATTERN.test(token));
    if (rawTokens.length === 0) return { ids: pendingIds, errors: [] };

    const selected = new Set<string>();
    const errors: string[] = [];
    for (const token of rawTokens) {
      if (pendingIds.includes(token)) {
        selected.add(token);
        continue;
      }
      const matches = pendingIds.filter((id) => id.startsWith(token));
      if (matches.length === 1) {
        selected.add(matches[0]);
      } else if (matches.length > 1) {
        errors.push(`Approval ID prefix '${token}' is ambiguous.`);
      } else {
        errors.push(`Approval ID '${token}' was not found for this chat.`);
      }
    }
    return { ids: [...selected], errors };
  }

  formatPendingApprovalPrompt(
    ids: string[],
    summaries?: Map<string, { toolName: string; argsPreview: string }>,
  ): string {
    if (ids.length === 0) return 'There are no pending approvals.';
    const resolvedSummaries = summaries ?? this.tools?.getApprovalSummaries?.(ids);
    const ttlMinutes = Math.round(PENDING_APPROVAL_TTL_MS / 60_000);
    if (ids.length === 1) {
      const summary = resolvedSummaries?.get(ids[0]);
      const what = summary
        ? `Waiting for approval to ${describePendingApproval(summary)}.`
        : undefined;
      return [
        what ?? 'I prepared an action that needs your approval.',
        `Approval ID: ${ids[0]}`,
        `Reply "yes" to approve or "no" to deny (expires in ${ttlMinutes} minutes).`,
        'Optional: /approve or /deny',
      ].join('\n');
    }
    const described = ids
      .map((id) => resolvedSummaries?.get(id))
      .filter((summary): summary is { toolName: string; argsPreview: string } => Boolean(summary));
    const lines = [
      described.length > 0
        ? formatPendingApprovalMessage(described)
        : `I prepared ${ids.length} actions that need your approval.`,
    ];
    for (const id of ids) {
      lines.push(`  • ${id.slice(0, 8)}…`);
    }
    lines.push(`Reply "yes" to approve all or "no" to deny all (expires in ${ttlMinutes} minutes).`);
    lines.push('Optional: /approve <id> or /deny <id> for specific actions');
    return lines.join('\n');
  }
}
