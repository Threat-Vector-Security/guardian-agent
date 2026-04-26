import { randomUUID } from 'node:crypto';

import type { ToolApprovalDecisionResult } from '../../tools/executor.js';
import type { PendingActionRecord } from '../pending-actions.js';
import {
  normalizeFilesystemResumePrincipalRole,
  readAutomationAuthoringResumePayload,
  readFilesystemSaveOutputResumePayload,
  type AutomationAuthoringResumePayload,
} from './capability-continuation-resume.js';
import type { StoredFilesystemSaveInput } from './filesystem-save-resume.js';

export interface CapabilityContinuationRuntimeResponse {
  content: string;
  metadata?: Record<string, unknown>;
}

export async function resumeStoredCapabilityContinuationPendingAction(input: {
  pendingAction: PendingActionRecord;
  options?: {
    pendingActionAlreadyCleared?: boolean;
    approvalResult?: ToolApprovalDecisionResult;
  };
  completePendingAction: (actionId: string, nowMs?: number) => void;
  executeStoredFilesystemSave: (
    input: StoredFilesystemSaveInput,
  ) => Promise<string | CapabilityContinuationRuntimeResponse>;
  executeStoredAutomationAuthoring?: (
    pendingAction: PendingActionRecord,
    resume: AutomationAuthoringResumePayload,
    approvalResult?: ToolApprovalDecisionResult,
  ) => Promise<CapabilityContinuationRuntimeResponse>;
}): Promise<CapabilityContinuationRuntimeResponse | null> {
  if (!input.options?.pendingActionAlreadyCleared) {
    input.completePendingAction(input.pendingAction.id);
  }

  const automationAuthoringResume = readAutomationAuthoringResumePayload(input.pendingAction.resume?.payload);
  if (automationAuthoringResume && input.executeStoredAutomationAuthoring) {
    return input.executeStoredAutomationAuthoring(
      input.pendingAction,
      automationAuthoringResume,
      input.options?.approvalResult,
    );
  }

  const filesystemResume = readFilesystemSaveOutputResumePayload(input.pendingAction.resume?.payload);
  if (filesystemResume) {
    const result = await input.executeStoredFilesystemSave({
      targetPath: filesystemResume.targetPath,
      content: filesystemResume.content,
      originalUserContent: filesystemResume.originalUserContent,
      userKey: `${input.pendingAction.scope.userId}:${input.pendingAction.scope.channel}`,
      userId: input.pendingAction.scope.userId,
      channel: input.pendingAction.scope.channel,
      surfaceId: input.pendingAction.scope.surfaceId,
      principalId: filesystemResume.principalId ?? input.pendingAction.scope.userId,
      principalRole: normalizeFilesystemResumePrincipalRole(filesystemResume.principalRole) ?? 'owner',
      requestId: randomUUID(),
      codeContext: filesystemResume.codeContext,
      allowPathRemediation: filesystemResume.allowPathRemediation,
    });
    return typeof result === 'string' ? { content: result } : result;
  }

  return null;
}
