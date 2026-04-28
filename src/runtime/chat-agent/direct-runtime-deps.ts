import type { DirectAutomationDeps } from './direct-automation.js';
import type { DirectMailboxDeps } from './direct-mailbox-runtime.js';
import {
  type DirectPersonalAssistantDeps,
  type DirectSecondBrainMutationRequest,
} from './direct-personal-assistant.js';
import type { DirectScheduledEmailAutomationDeps } from './direct-scheduled-email-automation.js';
import {
  buildSecondBrainFocusMetadata,
  buildSecondBrainFocusRemovalMetadata,
  type SecondBrainFocusContinuationPayload,
} from './direct-intent-helpers.js';
import {
  buildDirectSecondBrainClarificationResponse,
  buildDirectSecondBrainMutationSuccessResponse,
  executeDirectSecondBrainMutation,
  type DirectSecondBrainSuccessDescriptor,
} from './direct-second-brain-mutation.js';
import { toPendingActionEntities } from './intent-gateway-orchestration.js';
import type { SecondBrainService } from '../second-brain/second-brain-service.js';

export interface DirectRuntimeDepsInput {
  agentId: string;
  tools?: DirectAutomationDeps['tools'];
  secondBrainService?: SecondBrainService;
  conversationService?: DirectScheduledEmailAutomationDeps['conversationService'];
  setApprovalFollowUp: (
    approvalId: string,
    copy: { approved?: string; denied?: string },
  ) => void;
  getPendingApprovals: (
    userKey: string,
    surfaceId?: string,
    nowMs?: number,
  ) => { ids: string[]; createdAt: number; expiresAt: number } | null;
  formatPendingApprovalPrompt: DirectAutomationDeps['formatPendingApprovalPrompt'];
  parsePendingActionUserKey: DirectAutomationDeps['parsePendingActionUserKey'];
  setClarificationPendingAction: DirectAutomationDeps['setClarificationPendingAction'];
  setPendingApprovalActionForRequest: DirectAutomationDeps['setPendingApprovalActionForRequest'];
  setChatContinuationGraphPendingApprovalActionForRequest: DirectAutomationDeps['setChatContinuationGraphPendingApprovalActionForRequest'];
  buildPendingApprovalBlockedResponse: DirectAutomationDeps['buildPendingApprovalBlockedResponse'];
  buildImmediateResponseMetadata: (
    pendingApprovalIds: string[],
    userId: string,
    channel: string,
    surfaceId?: string,
    options?: { includePendingAction?: boolean },
  ) => Record<string, unknown> | undefined;
}

export function buildDirectMailboxDeps(input: DirectRuntimeDepsInput): DirectMailboxDeps {
  return {
    agentId: input.agentId,
    tools: input.tools,
    setApprovalFollowUp: input.setApprovalFollowUp,
    getPendingApprovals: input.getPendingApprovals,
    formatPendingApprovalPrompt: input.formatPendingApprovalPrompt,
    setPendingApprovalActionForRequest: input.setPendingApprovalActionForRequest,
    buildPendingApprovalBlockedResponse: input.buildPendingApprovalBlockedResponse,
  };
}

export function buildDirectAutomationDeps(input: DirectRuntimeDepsInput): DirectAutomationDeps {
  return {
    agentId: input.agentId,
    tools: input.tools,
    setApprovalFollowUp: input.setApprovalFollowUp,
    formatPendingApprovalPrompt: input.formatPendingApprovalPrompt,
    parsePendingActionUserKey: input.parsePendingActionUserKey,
    setClarificationPendingAction: input.setClarificationPendingAction,
    setPendingApprovalActionForRequest: input.setPendingApprovalActionForRequest,
    setChatContinuationGraphPendingApprovalActionForRequest: input.setChatContinuationGraphPendingApprovalActionForRequest,
    buildPendingApprovalBlockedResponse: input.buildPendingApprovalBlockedResponse,
  };
}

export function buildDirectScheduledEmailAutomationDeps(
  input: DirectRuntimeDepsInput,
): DirectScheduledEmailAutomationDeps {
  return {
    agentId: input.agentId,
    tools: input.tools,
    conversationService: input.conversationService,
    setApprovalFollowUp: input.setApprovalFollowUp,
    getPendingApprovals: input.getPendingApprovals,
    formatPendingApprovalPrompt: input.formatPendingApprovalPrompt,
    setPendingApprovalActionForRequest: input.setPendingApprovalActionForRequest,
    buildPendingApprovalBlockedResponse: input.buildPendingApprovalBlockedResponse,
  };
}

export function buildDirectSecondBrainSuccessResponse(
  descriptor: DirectSecondBrainSuccessDescriptor,
  output: unknown,
  focusState: SecondBrainFocusContinuationPayload | null | undefined,
): { content: string; metadata?: Record<string, unknown> } {
  return buildDirectSecondBrainMutationSuccessResponse({
    descriptor,
    output,
    focusState,
    buildFocusMetadata: buildSecondBrainFocusMetadata,
    buildFocusRemovalMetadata: buildSecondBrainFocusRemovalMetadata,
  });
}

export function buildDirectPersonalAssistantDeps(
  input: DirectRuntimeDepsInput,
): DirectPersonalAssistantDeps {
  return {
    tools: input.tools,
    secondBrainService: input.secondBrainService,
    buildClarificationResponse: (request) => buildDirectSecondBrainClarificationResponse({
      ...request,
      toPendingActionEntities: (entities) => toPendingActionEntities(
        entities as Parameters<typeof toPendingActionEntities>[0],
      ),
      setClarificationPendingAction: input.setClarificationPendingAction,
      buildImmediateResponseMetadata: input.buildImmediateResponseMetadata,
    }),
    executeMutation: (request: DirectSecondBrainMutationRequest) => executeDirectSecondBrainMutation({
      ...request,
      agentId: input.agentId,
      tools: input.tools,
      getPendingApprovals: input.getPendingApprovals,
      setApprovalFollowUp: input.setApprovalFollowUp,
      formatPendingApprovalPrompt: input.formatPendingApprovalPrompt,
      setPendingApprovalActionForRequest: input.setPendingApprovalActionForRequest,
      buildPendingApprovalBlockedResponse: input.buildPendingApprovalBlockedResponse,
      toPendingActionEntities: (entities) => toPendingActionEntities(
        entities as Parameters<typeof toPendingActionEntities>[0],
      ),
      buildDirectSecondBrainMutationSuccessResponse: buildDirectSecondBrainSuccessResponse,
    }),
  };
}
