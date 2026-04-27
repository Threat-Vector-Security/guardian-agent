import type { PrincipalRole } from '../../tools/types.js';
import type { ToolApprovalDecisionResult } from '../../tools/executor.js';
import type { PendingActionRecord } from '../pending-actions.js';
import type { ChatContinuationGraphResume } from './chat-continuation-graph.js';
import type {
  AutomationAuthoringContinuationPayload,
  FilesystemSaveOutputContinuationPayload,
} from './chat-continuation-payloads.js';
import type { ToolLoopContinuationPayload } from './tool-loop-continuation.js';

export type ChatContinuationExecutionResult =
  | string
  | {
      content: string;
      metadata?: Record<string, unknown>;
    };

export interface ExecuteChatContinuationPayloadInput {
  pendingAction: PendingActionRecord;
  resume: ChatContinuationGraphResume;
  approvalId: string;
  approvalResult: ToolApprovalDecisionResult;
  createRequestId: () => string;
  executeStoredFilesystemSave: (input: {
    targetPath: string;
    content: string;
    originalUserContent: string;
    userKey: string;
    userId: string;
    channel: string;
    surfaceId?: string;
    principalId?: string;
    principalRole?: PrincipalRole;
    requestId: string;
    codeContext?: { workspaceRoot: string; sessionId?: string };
    allowPathRemediation: boolean;
  }) => Promise<ChatContinuationExecutionResult>;
  executeStoredAutomationAuthoring: (
    pendingAction: PendingActionRecord,
    resume: AutomationAuthoringContinuationPayload,
    approvalResult?: ToolApprovalDecisionResult,
  ) => Promise<{ content: string; metadata?: Record<string, unknown> }>;
  resumeStoredToolLoopContinuation: (
    pendingAction: PendingActionRecord,
    continuation: ToolLoopContinuationPayload,
    options: {
      approvalId: string;
      pendingActionAlreadyCleared: true;
      approvalResult: ToolApprovalDecisionResult;
    },
  ) => Promise<{ content: string; metadata?: Record<string, unknown> } | null>;
}

export async function executeChatContinuationPayload(
  input: ExecuteChatContinuationPayloadInput,
): Promise<ChatContinuationExecutionResult> {
  const payload = input.resume.payload;
  if (payload.type === 'filesystem_save_output') {
    return input.executeStoredFilesystemSave(buildFilesystemSaveContinuationInput(input.pendingAction, payload, input.createRequestId()));
  }
  if (payload.type === 'automation_authoring') {
    return input.executeStoredAutomationAuthoring(
      input.pendingAction,
      payload,
      input.approvalResult,
    );
  }
  return await input.resumeStoredToolLoopContinuation(
    input.pendingAction,
    payload,
    {
      approvalId: input.approvalId,
      pendingActionAlreadyCleared: true,
      approvalResult: input.approvalResult,
    },
  ) ?? {
    content: 'I could not resume the pending coding run after approval.',
  };
}

function buildFilesystemSaveContinuationInput(
  pendingAction: PendingActionRecord,
  payload: FilesystemSaveOutputContinuationPayload,
  requestId: string,
): Parameters<ExecuteChatContinuationPayloadInput['executeStoredFilesystemSave']>[0] {
  return {
    targetPath: payload.targetPath,
    content: payload.content,
    originalUserContent: payload.originalUserContent,
    userKey: `${pendingAction.scope.userId}:${pendingAction.scope.channel}`,
    userId: pendingAction.scope.userId,
    channel: pendingAction.scope.channel,
    surfaceId: pendingAction.scope.surfaceId,
    principalId: payload.principalId ?? pendingAction.scope.userId,
    principalRole: normalizePrincipalRole(payload.principalRole) ?? 'owner',
    requestId,
    codeContext: payload.codeContext,
    allowPathRemediation: payload.allowPathRemediation,
  };
}

function normalizePrincipalRole(value: string | undefined): PrincipalRole | undefined {
  switch (value) {
    case 'owner':
    case 'operator':
    case 'approver':
    case 'viewer':
      return value;
    default:
      return undefined;
  }
}
