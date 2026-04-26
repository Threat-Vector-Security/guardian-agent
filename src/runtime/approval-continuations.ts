export const APPROVAL_OUTCOME_CONTINUATION_METADATA_KEY = 'approvalOutcomeContinuation';

export interface ApprovalOutcomeContinuationMetadata {
  type: 'approval_outcome';
  approvalId: string;
  decision: 'approved' | 'denied';
  resultMessage?: string;
}

export function shouldContinueConversationAfterApprovalDecision(input: {
  decision: 'approved' | 'denied';
  hasContinuation: boolean;
}): boolean {
  return input.decision === 'approved' && input.hasContinuation;
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
