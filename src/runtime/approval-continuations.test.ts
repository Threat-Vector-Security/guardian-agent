import { describe, expect, it } from 'vitest';

import {
  APPROVAL_OUTCOME_CONTINUATION_METADATA_KEY,
  buildApprovalContinuationScopeKey,
  buildApprovalOutcomeContinuationMetadata,
  findSuspendedApprovalState,
  normalizeApprovalContinuationScope,
  readApprovalOutcomeContinuationMetadata,
  shouldContinueConversationAfterApprovalDecision,
  selectSuspendedOriginalMessage,
} from './approval-continuations.js';

describe('approval continuations', () => {
  it('normalizes scope to a stable surface-aware key', () => {
    expect(normalizeApprovalContinuationScope({
      userId: 'web-user',
      channel: 'web',
    })).toEqual({
      userId: 'web-user',
      channel: 'web',
      surfaceId: 'web-guardian-chat',
    });

    expect(normalizeApprovalContinuationScope({
      userId: 'cli-user',
      channel: 'cli',
    })).toEqual({
      userId: 'cli-user',
      channel: 'cli',
      surfaceId: 'cli-guardian-chat',
    });

    expect(buildApprovalContinuationScopeKey({
      userId: 'web-user',
      channel: 'web',
      surfaceId: 'web-guardian-chat',
    })).toBe('web-user:web:web-guardian-chat');
  });

  it('matches suspended approvals only on the requested surface when scope is provided', () => {
    const sessions = [
      {
        scope: { userId: 'web-user', channel: 'web', surfaceId: 'web-guardian-chat' },
        pendingTools: [{ approvalId: 'approval-memory-1' }],
      },
      {
        scope: { userId: 'web-user', channel: 'web', surfaceId: 'web-config' },
        pendingTools: [{ approvalId: 'approval-config-1' }],
      },
    ];

    expect(findSuspendedApprovalState(sessions, 'approval-memory-1', {
      userId: 'web-user',
      channel: 'web',
      surfaceId: 'web-guardian-chat',
    })).toBe(sessions[0]);
    expect(findSuspendedApprovalState(sessions, 'approval-memory-1', {
      userId: 'web-user',
      channel: 'web',
      surfaceId: 'web-config',
    })).toBeNull();
  });

  it('only preserves the previous original message on a real continuation turn', () => {
    expect(selectSuspendedOriginalMessage({
      isContinuation: true,
      existing: 'older request',
      current: 'new request',
    })).toBe('older request');

    expect(selectSuspendedOriginalMessage({
      isContinuation: false,
      existing: 'older request',
      current: 'new request',
    })).toBe('new request');
  });

  it('round-trips structured approval outcome continuation metadata', () => {
    const metadata = buildApprovalOutcomeContinuationMetadata({
      approvalId: 'approval-1',
      decision: 'approved',
      resultMessage: 'Search completed.',
    });

    expect(metadata).toHaveProperty(APPROVAL_OUTCOME_CONTINUATION_METADATA_KEY);
    expect(readApprovalOutcomeContinuationMetadata(metadata)).toEqual({
      type: 'approval_outcome',
      approvalId: 'approval-1',
      decision: 'approved',
      resultMessage: 'Search completed.',
    });
  });

  it('continues approved suspended work even when the approved tool later reports failure', () => {
    expect(shouldContinueConversationAfterApprovalDecision({
      decision: 'approved',
      hasContinuation: true,
    })).toBe(true);

    expect(shouldContinueConversationAfterApprovalDecision({
      decision: 'denied',
      hasContinuation: true,
    })).toBe(false);

    expect(shouldContinueConversationAfterApprovalDecision({
      decision: 'approved',
      hasContinuation: false,
    })).toBe(false);
  });
});
