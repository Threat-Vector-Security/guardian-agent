import type { AgentContext, UserMessage } from '../../agent/types.js';
import type { ChatMessage, ChatOptions, ChatResponse } from '../../llm/types.js';
import type { ConversationKey, ConversationService } from '../conversation.js';
import type { ContinuityThreadRecord } from '../continuity-threads.js';
import type { IntentGatewayDecision } from '../intent-gateway.js';
import {
  tryDirectCodeSessionControlFromGateway,
  type CodeSessionControlDeps,
  type CodingTaskResumer,
} from './code-session-control.js';
import { tryDirectAutomationAuthoring, tryDirectAutomationControl, tryDirectAutomationOutput, tryDirectBrowserAutomation } from './direct-automation.js';
import {
  tryDirectCodingBackendDelegation,
  type DirectCodingBackendDeps,
} from './direct-coding-backend.js';
import type { DirectIntentDispatchResult } from './direct-intent-dispatch.js';
import { tryDirectGoogleWorkspaceRead, tryDirectGoogleWorkspaceWrite } from './direct-mailbox-runtime.js';
import { tryDirectMemoryRead, tryDirectMemorySave } from './direct-memory.js';
import { tryDirectPersonalAssistant } from './direct-personal-assistant.js';
import { tryDirectProviderRead } from './direct-provider-read.js';
import {
  buildDirectAutomationDeps,
  buildDirectMailboxDeps,
  buildDirectPersonalAssistantDeps,
  buildDirectScheduledEmailAutomationDeps,
  type DirectRuntimeDepsInput,
} from './direct-runtime-deps.js';
import { tryDirectScheduledEmailAutomation } from './direct-scheduled-email-automation.js';
import type { DirectIntentHandlerMap } from './direct-route-orchestration.js';
import { tryDirectFilesystemIntent } from './direct-route-runtime.js';
import { tryDirectWebSearch } from './direct-web-search.js';
import type { StoredFilesystemSaveInput } from './filesystem-save-resume.js';
import type { StoredToolLoopSanitizedResult } from './tool-loop-runtime.js';

type DirectCodeContext = {
  workspaceRoot: string;
  sessionId?: string;
};

export type DirectCodeSessionControlDeps = Omit<CodeSessionControlDeps, 'resumeCodingTask'>;

export interface ChatDirectCodingRouteDeps {
  backendDeps: DirectCodingBackendDeps;
  sessionControlDeps: DirectCodeSessionControlDeps;
}

export interface BuildChatDirectRouteHandlersInput {
  agentId: string;
  tools: DirectRuntimeDepsInput['tools'];
  runtimeDeps: DirectRuntimeDepsInput;
  message: UserMessage;
  routedMessage: UserMessage;
  ctx: AgentContext;
  userKey: string;
  conversationKey: ConversationKey;
  conversationService?: Pick<ConversationService, 'getSessionHistory'> | null;
  stateAgentId: string;
  decision?: IntentGatewayDecision | null;
  codeContext?: DirectCodeContext;
  continuityThread?: ContinuityThreadRecord | null;
  llmMessages: ChatMessage[];
  fallbackProviderOrder?: string[];
  defaultToolResultProviderKind: 'local' | 'external';
  sanitizeToolResultForLlm: (
    toolName: string,
    result: unknown,
    providerKind: 'local' | 'external',
  ) => StoredToolLoopSanitizedResult;
  chatWithFallback: (
    ctx: AgentContext,
    messages: ChatMessage[],
    options?: ChatOptions,
    fallbackProviderOrder?: string[],
  ) => Promise<ChatResponse>;
  executeStoredFilesystemSave: (
    input: StoredFilesystemSaveInput,
  ) => Promise<DirectIntentDispatchResult>;
  codingRoutes: ChatDirectCodingRouteDeps;
}

export function buildDirectCodingTaskResumer(
  backendDeps: DirectCodingBackendDeps,
): CodingTaskResumer {
  return (message, ctx, userKey, decision, codeContext) => tryDirectCodingBackendDelegation(
    {
      message,
      ctx,
      userKey,
      decision,
      codeContext,
    },
    backendDeps,
  );
}

export function tryDirectChatCodeSessionControl(input: {
  tools: DirectRuntimeDepsInput['tools'];
  message: UserMessage;
  ctx: AgentContext;
  decision?: IntentGatewayDecision | null;
  codingRoutes: ChatDirectCodingRouteDeps;
}): Promise<DirectIntentDispatchResult | null> {
  return tryDirectCodeSessionControlFromGateway({
    ...input.codingRoutes.sessionControlDeps,
    toolsEnabled: input.tools?.isEnabled() === true,
    resumeCodingTask: buildDirectCodingTaskResumer(input.codingRoutes.backendDeps),
    message: input.message,
    ctx: input.ctx,
    decision: input.decision ?? undefined,
  });
}

export function buildChatDirectRouteHandlers(input: BuildChatDirectRouteHandlersInput): DirectIntentHandlerMap {
  const mailboxDeps = buildDirectMailboxDeps(input.runtimeDeps);
  const automationDeps = buildDirectAutomationDeps(input.runtimeDeps);
  const scheduledEmailAutomationDeps = buildDirectScheduledEmailAutomationDeps(input.runtimeDeps);
  const personalAssistantDeps = buildDirectPersonalAssistantDeps(input.runtimeDeps);

  return {
    personal_assistant: () => tryDirectPersonalAssistant({
      message: input.routedMessage,
      ctx: input.ctx,
      userKey: input.userKey,
      decision: input.decision ?? undefined,
      continuityThread: input.continuityThread,
    }, personalAssistantDeps),
    provider_read: () => tryDirectProviderRead({
      agentId: input.agentId,
      tools: input.tools,
      message: input.routedMessage,
      ctx: input.ctx,
      decision: input.decision,
    }),
    coding_session_control: () => tryDirectChatCodeSessionControl({
      tools: input.tools,
      message: input.message,
      ctx: input.ctx,
      decision: input.decision,
      codingRoutes: input.codingRoutes,
    }),
    coding_backend: () => tryDirectCodingBackendDelegation({
      message: input.routedMessage,
      ctx: input.ctx,
      userKey: input.userKey,
      decision: input.decision ?? undefined,
      codeContext: input.codeContext,
    }, input.codingRoutes.backendDeps),
    filesystem: () => tryDirectFilesystemIntent({
      message: input.routedMessage,
      ctx: input.ctx,
      userKey: input.userKey,
      conversationKey: input.conversationKey,
      codeContext: input.codeContext,
      originalUserContent: input.message.content,
      gatewayDecision: input.decision ?? undefined,
      agentId: input.agentId,
      tools: input.tools,
      conversationService: input.conversationService,
      executeStoredFilesystemSave: input.executeStoredFilesystemSave,
      setApprovalFollowUp: input.runtimeDeps.setApprovalFollowUp,
      getPendingApprovals: input.runtimeDeps.getPendingApprovals,
      formatPendingApprovalPrompt: input.runtimeDeps.formatPendingApprovalPrompt,
      setPendingApprovalActionForRequest: input.runtimeDeps.setPendingApprovalActionForRequest,
      buildPendingApprovalBlockedResponse: input.runtimeDeps.buildPendingApprovalBlockedResponse,
    }),
    memory_write: () => tryDirectMemorySave({
      tools: input.tools,
      agentId: input.agentId,
      message: input.routedMessage,
      ctx: input.ctx,
      userKey: input.userKey,
      codeContext: input.codeContext,
      originalUserContent: input.message.content,
      getPendingApprovals: input.runtimeDeps.getPendingApprovals,
      setApprovalFollowUp: input.runtimeDeps.setApprovalFollowUp,
      formatPendingApprovalPrompt: input.runtimeDeps.formatPendingApprovalPrompt,
      setPendingApprovalActionForRequest: input.runtimeDeps.setPendingApprovalActionForRequest,
      buildPendingApprovalBlockedResponse: input.runtimeDeps.buildPendingApprovalBlockedResponse,
    }),
    memory_read: () => tryDirectMemoryRead({
      tools: input.tools,
      agentId: input.agentId,
      message: input.routedMessage,
      ctx: input.ctx,
      codeContext: input.codeContext,
      originalUserContent: input.message.content,
    }),
    scheduled_email_automation: () => tryDirectScheduledEmailAutomation({
      message: input.routedMessage,
      ctx: input.ctx,
      userKey: input.userKey,
      stateAgentId: input.stateAgentId,
    }, scheduledEmailAutomationDeps),
    automation: ({ gatewayDirected }) => tryDirectAutomationAuthoring({
      message: input.routedMessage,
      ctx: input.ctx,
      userKey: input.userKey,
      codeContext: input.codeContext,
      options: {
        intentDecision: input.decision,
        assumeAuthoring: gatewayDirected,
      },
    }, automationDeps),
    automation_control: () => tryDirectAutomationControl({
      message: input.routedMessage,
      ctx: input.ctx,
      userKey: input.userKey,
      intentDecision: input.decision,
      continuityThread: input.continuityThread,
    }, automationDeps),
    automation_output: () => tryDirectAutomationOutput({
      message: input.routedMessage,
      ctx: input.ctx,
      intentDecision: input.decision,
    }, automationDeps),
    workspace_write: () => tryDirectGoogleWorkspaceWrite({
      message: input.routedMessage,
      ctx: input.ctx,
      userKey: input.userKey,
      decision: input.decision ?? undefined,
    }, mailboxDeps),
    workspace_read: () => tryDirectGoogleWorkspaceRead({
      message: input.routedMessage,
      ctx: input.ctx,
      userKey: input.userKey,
      decision: input.decision ?? undefined,
      continuityThread: input.continuityThread,
    }, mailboxDeps),
    browser: () => tryDirectBrowserAutomation({
      message: input.routedMessage,
      ctx: input.ctx,
      userKey: input.userKey,
      codeContext: input.codeContext,
      intentDecision: input.decision,
      continuityThread: input.continuityThread,
    }, automationDeps),
    web_search: () => tryDirectWebSearch({
      agentId: input.agentId,
      tools: input.tools,
      message: input.routedMessage,
      ctx: input.ctx,
      llmMessages: input.llmMessages,
      fallbackProviderOrder: input.fallbackProviderOrder,
      defaultToolResultProviderKind: input.defaultToolResultProviderKind,
      sanitizeToolResultForLlm: input.sanitizeToolResultForLlm,
      chatWithFallback: input.chatWithFallback,
    }),
  };
}
