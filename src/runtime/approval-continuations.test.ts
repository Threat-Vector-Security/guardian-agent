import { describe, expect, it } from 'vitest';

import {
  APPROVAL_OUTCOME_CONTINUATION_METADATA_KEY,
  buildApprovalOutcomeContinuationMetadata,
  readApprovalOutcomeContinuationMetadata,
  shouldContinueConversationAfterApprovalDecision,
} from './approval-continuations.js';

describe('approval continuations', () => {
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
