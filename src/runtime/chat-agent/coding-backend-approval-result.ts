import { isRecord, toBoolean, toNumber, toString } from '../../chat-agent-helpers.js';
import type { ToolApprovalDecisionResult } from '../../tools/executor.js';
import { buildToolResultPayloadFromJob } from '../../tools/job-results.js';
import { buildCodingBackendResponseSource } from './direct-intent-helpers.js';

export function formatCodingBackendApprovalResult(
  approvalResult: ToolApprovalDecisionResult | undefined,
): { content: string; metadata?: Record<string, unknown> } | null {
  if (!approvalResult || approvalResult.job?.toolName !== 'coding_backend_run') {
    return null;
  }

  const output = resolveCodingBackendRunOutput(approvalResult);
  const backendId = toString(output?.backendId).trim()
    || toString(approvalResult.job?.argsRedacted?.backend).trim()
    || undefined;
  const backendName = toString(output?.backendName).trim() || backendId || 'Coding backend';
  const sessionId = toString(output?.codeSessionId).trim()
    || approvalResult.job?.codeSessionId
    || undefined;

  if (!approvalResult.approved) {
    return {
      content: `The delegated run for ${backendId || backendName} was not approved.`,
    };
  }

  const assistantResponse = toString(output?.assistantResponse)?.trim();
  const backendOutput = toString(output?.output)?.trim();
  const executionMessage = toString(approvalResult.result?.message)?.trim();
  const executionError = toString(approvalResult.result?.error)?.trim();

  const metadata: Record<string, unknown> = {
    codingBackendDelegated: true,
    codingBackendId: backendId,
    responseSource: buildCodingBackendResponseSource({
      backendId,
      backendName,
      durationMs: toNumber(output?.durationMs) ?? approvalResult.job?.durationMs,
    }),
    ...(sessionId ? { codeSessionResolved: true, codeSessionId: sessionId } : {}),
  };

  const content = assistantResponse || backendOutput || `${backendName} completed successfully.`;
  if (approvalResult.executionSucceeded !== false && (toBoolean(output?.success) || !output)) {
    return { content, metadata };
  }

  const failureMessage = assistantResponse
    || backendOutput
    || executionError
    || executionMessage
    || approvalResult.message.trim()
    || toString(output?.message)
    || `${backendName} could not complete the requested task.`;
  return { content: failureMessage, metadata };
}

function resolveCodingBackendRunOutput(
  approvalResult: ToolApprovalDecisionResult,
): Record<string, unknown> | null {
  if (isRecord(approvalResult.result?.output)) {
    return approvalResult.result.output;
  }
  const jobPayload = buildToolResultPayloadFromJob(approvalResult.job);
  if (isRecord(jobPayload.output)) {
    return jobPayload.output;
  }
  return null;
}
