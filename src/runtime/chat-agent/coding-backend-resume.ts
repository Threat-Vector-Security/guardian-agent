import { isRecord, toBoolean, toNumber, toString } from '../../chat-agent-helpers.js';
import type { ToolApprovalDecisionResult } from '../../tools/executor.js';
import type { PendingActionRecord } from '../pending-actions.js';
import { buildCodingBackendResponseSource } from './direct-intent-helpers.js';
import {
  DIRECT_ROUTE_RESUME_TYPE_CODING_BACKEND_RUN,
  type CodingBackendRunResumePayload,
} from './direct-route-resume.js';

export function buildCodingBackendRunResumePayload(input: {
  task: string;
  backendId?: string;
  codeSessionId?: string;
  workspaceRoot?: string;
}): PendingActionRecord['resume'] {
  return {
    kind: 'direct_route',
    payload: {
      type: DIRECT_ROUTE_RESUME_TYPE_CODING_BACKEND_RUN,
      task: input.task,
      ...(input.backendId ? { backendId: input.backendId } : {}),
      ...(input.codeSessionId ? { codeSessionId: input.codeSessionId } : {}),
      ...(input.workspaceRoot ? { workspaceRoot: input.workspaceRoot } : {}),
    },
  };
}

export async function executeStoredCodingBackendRun(
  _pendingAction: PendingActionRecord,
  resume: CodingBackendRunResumePayload,
  approvalResult?: ToolApprovalDecisionResult,
): Promise<{ content: string; metadata?: Record<string, unknown> }> {
  if (!approvalResult || !approvalResult.approved) {
    const backendName = resume.backendId || 'the coding backend';
    return { content: `The delegated run for ${backendName} was not approved.` };
  }

  const runResult = isRecord(approvalResult.result?.output) ? approvalResult.result!.output : null;
  const backendName = toString(runResult?.backendName) || resume.backendId || 'Coding backend';
  const assistantResponse = toString(runResult?.assistantResponse)?.trim();
  const backendOutput = toString(runResult?.output)?.trim();
  const executionMessage = toString(approvalResult.result?.message)?.trim();
  const executionError = toString(approvalResult.result?.error)?.trim();
  const sessionId = resume.codeSessionId || toString(runResult?.codeSessionId);

  const metadata: Record<string, unknown> = {
    codingBackendDelegated: true,
    codingBackendId: resume.backendId,
    responseSource: buildCodingBackendResponseSource({
      backendId: resume.backendId,
      backendName,
      durationMs: toNumber(runResult?.durationMs) ?? undefined,
    }),
    ...(sessionId ? { codeSessionResolved: true, codeSessionId: sessionId } : {}),
  };

  const content = assistantResponse || backendOutput || `${backendName} completed successfully.`;
  if (approvalResult.executionSucceeded !== false && (toBoolean(runResult?.success) || !runResult)) {
    return { content, metadata };
  }

  const failureMessage = assistantResponse
    || backendOutput
    || executionError
    || executionMessage
    || approvalResult.message.trim()
    || toString(runResult?.message)
    || `${backendName} could not complete the requested task.`;
  return { content: failureMessage, metadata };
}
