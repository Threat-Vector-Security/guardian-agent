import type { AgentContext, UserMessage } from '../../agent/types.js';
import { toString } from '../../chat-agent-helpers.js';
import type { ToolExecutor } from '../../tools/executor.js';
import type { ContinuityThreadRecord } from '../continuity-threads.js';
import type { IntentGatewayDecision } from '../intent-gateway.js';
import type { SecondBrainService } from '../second-brain/second-brain-service.js';
import {
  buildRoutineSemanticHints,
  buildSecondBrainFocusMetadata,
  buildSecondBrainFocusRemovalMetadata,
  buildToolSafeRoutineTrigger,
  collapseWhitespaceForSecondBrainParsing,
  deriveRoutineTimingKind,
  extractCustomSecondBrainRoutineCreate,
  extractEmailAddressFromText,
  extractExplicitNamedSecondBrainTitle,
  extractNamedSecondBrainTitle,
  extractPhoneNumberFromText,
  extractQuotedLabeledValue,
  extractQuotedPhrase,
  extractRetitledSecondBrainTitle,
  extractRoutineDeliveryDefaults,
  extractRoutineDueWithinHours,
  extractRoutineEnabledState,
  extractRoutineFocusQuery,
  extractRoutineIncludeOverdue,
  extractRoutineLookaheadMinutes,
  extractRoutineScheduleTiming,
  extractRoutineTopicWatchQuery,
  extractSecondBrainFallbackPersonName,
  extractSecondBrainPersonRelationship,
  extractSecondBrainRoutingBias,
  extractSecondBrainTags,
  extractSecondBrainTaskPriority,
  extractSecondBrainTaskStatus,
  extractSecondBrainTextBody,
  extractUrlFromText,
  findMatchingRoutineForCreate,
  formatBriefKindLabelForUser,
  getSecondBrainFocusEntry,
  isSecondBrainFocusItemType,
  normalizeRoutineNameForMatch,
  normalizeRoutineQueryTokens,
  normalizeRoutineSearchTokens,
  normalizeRoutineTemplateIdForMatch,
  normalizeSecondBrainInlineFieldValue,
  readSecondBrainFocusContinuationState,
  resolveDirectSecondBrainReadQuery,
  routineDeliveryChannels,
  routineDueWithinHours,
  routineIncludeOverdue,
  routineTopicQuery,
  summarizeRoutineTimingForUser,
  type SecondBrainFocusContinuationPayload,
} from './direct-intent-helpers.js';
import type {
  DirectSecondBrainMutationAction,
  DirectSecondBrainMutationItemType,
  DirectSecondBrainMutationToolName,
} from './direct-second-brain-mutation.js';
import { tryDirectSecondBrainRead } from './direct-second-brain-read.js';
import { tryDirectSecondBrainRoutineWrite } from './direct-second-brain-routine-write.js';
import { tryDirectSecondBrainWrite } from './direct-second-brain-write.js';

export type DirectPersonalAssistantResult =
  | string
  | { content: string; metadata?: Record<string, unknown> }
  | null;

export interface DirectSecondBrainClarificationRequest {
  message: UserMessage;
  decision: IntentGatewayDecision;
  prompt: string;
  field?: string;
  missingFields?: string[];
  entities?: Record<string, unknown>;
}

export interface DirectSecondBrainMutationRequest {
  message: UserMessage;
  ctx: AgentContext;
  userKey: string;
  decision: IntentGatewayDecision;
  toolName: DirectSecondBrainMutationToolName;
  args: Record<string, unknown>;
  summary: string;
  pendingIntro: string;
  successDescriptor: {
    itemType: DirectSecondBrainMutationItemType;
    action: DirectSecondBrainMutationAction;
    fallbackId?: string;
    fallbackLabel?: string;
  };
  focusState: SecondBrainFocusContinuationPayload | null | undefined;
}

export interface DirectPersonalAssistantDeps {
  tools?: Pick<ToolExecutor, 'isEnabled'> | null;
  secondBrainService?: SecondBrainService | null;
  buildClarificationResponse: (
    input: DirectSecondBrainClarificationRequest,
  ) => { content: string; metadata?: Record<string, unknown> };
  executeMutation: (
    input: DirectSecondBrainMutationRequest,
  ) => Promise<string | { content: string; metadata?: Record<string, unknown> }>;
}

export async function tryDirectPersonalAssistant(input: {
  message: UserMessage;
  ctx: AgentContext;
  userKey: string;
  decision?: IntentGatewayDecision;
  continuityThread?: ContinuityThreadRecord | null;
}, deps: DirectPersonalAssistantDeps): Promise<DirectPersonalAssistantResult> {
  return (await tryDirectPersonalAssistantWrite(input, deps))
    ?? tryDirectPersonalAssistantRead(input, deps);
}

export function resolveDirectSecondBrainItemType(
  decision: IntentGatewayDecision | undefined,
  continuityThread?: ContinuityThreadRecord | null,
): string {
  const requestedItemType = toString(decision?.entities.personalItemType).trim();
  if (requestedItemType && requestedItemType !== 'unknown' && requestedItemType !== 'overview') {
    return requestedItemType;
  }
  if (decision?.route !== 'personal_assistant_task' || decision.turnRelation !== 'follow_up') {
    return requestedItemType;
  }
  const focusState = readSecondBrainFocusContinuationState(continuityThread);
  if (focusState?.activeItemType) {
    return focusState.activeItemType;
  }
  const availableTypes = Object.keys(focusState?.byType ?? {}).filter(isSecondBrainFocusItemType);
  return availableTypes.length === 1 ? availableTypes[0] : requestedItemType;
}

export async function tryDirectPersonalAssistantWrite(input: {
  message: UserMessage;
  ctx: AgentContext;
  userKey: string;
  decision?: IntentGatewayDecision;
  continuityThread?: ContinuityThreadRecord | null;
}, deps: DirectPersonalAssistantDeps): Promise<DirectPersonalAssistantResult> {
  if (!deps.tools?.isEnabled() || input.decision?.route !== 'personal_assistant_task') {
    return null;
  }
  if (!['create', 'save', 'update', 'delete', 'toggle'].includes(input.decision.operation)) {
    return null;
  }

  const resolvedItemType = resolveDirectSecondBrainItemType(input.decision, input.continuityThread);
  const focusState = readSecondBrainFocusContinuationState(input.continuityThread);

  if (resolvedItemType === 'routine') {
    if (!deps.secondBrainService) return null;
    return tryDirectSecondBrainRoutineWrite({
      secondBrainService: deps.secondBrainService as SecondBrainService & {
        listRoutineRecords?: () => Array<Record<string, unknown>>;
        getRoutineRecordById?: (id: string) => Record<string, unknown> | null;
      },
      message: input.message,
      ctx: input.ctx,
      userKey: input.userKey,
      decision: input.decision,
      focusState,
      getFocusEntry: getSecondBrainFocusEntry,
      buildFocusMetadata: buildSecondBrainFocusMetadata,
      normalizeRoutineNameForMatch,
      normalizeRoutineTemplateIdForMatch,
      extractExplicitNamedTitle: extractExplicitNamedSecondBrainTitle,
      extractRoutineDeliveryDefaults,
      extractRoutineScheduleTiming,
      extractRoutineFocusQuery,
      extractCustomRoutineCreate: extractCustomSecondBrainRoutineCreate,
      extractQuotedPhrase,
      findMatchingRoutineForCreate,
      routineTopicQuery,
      extractRoutineEnabledState,
      extractRoutingBias: extractSecondBrainRoutingBias,
      extractRoutineLookaheadMinutes,
      extractRoutineTopicWatchQuery,
      extractRoutineDueWithinHours,
      extractRoutineIncludeOverdue,
      routineDeliveryChannels,
      deriveRoutineTimingKind,
      buildToolSafeRoutineTrigger,
      executeMutation: deps.executeMutation,
    });
  }

  return tryDirectSecondBrainWrite({
    secondBrainService: deps.secondBrainService,
    message: input.message,
    ctx: input.ctx,
    userKey: input.userKey,
    decision: input.decision,
    resolvedItemType,
    focusState,
    getFocusEntry: getSecondBrainFocusEntry,
    normalizeInlineFieldValue: normalizeSecondBrainInlineFieldValue,
    extractQuotedLabeledValue,
    extractExplicitNamedTitle: extractExplicitNamedSecondBrainTitle,
    extractNamedTitle: extractNamedSecondBrainTitle,
    extractRetitledTitle: extractRetitledSecondBrainTitle,
    extractTextBody: extractSecondBrainTextBody,
    extractTags: extractSecondBrainTags,
    collapseWhitespace: collapseWhitespaceForSecondBrainParsing,
    extractTaskPriority: extractSecondBrainTaskPriority,
    extractTaskStatus: extractSecondBrainTaskStatus,
    extractUrlFromText,
    extractFallbackPersonName: extractSecondBrainFallbackPersonName,
    extractEmailAddress: extractEmailAddressFromText,
    extractPhoneNumber: extractPhoneNumberFromText,
    extractPersonRelationship: extractSecondBrainPersonRelationship,
    buildClarificationResponse: deps.buildClarificationResponse,
    executeMutation: deps.executeMutation,
  });
}

export function tryDirectPersonalAssistantRead(input: {
  message: UserMessage;
  decision?: IntentGatewayDecision;
  continuityThread?: ContinuityThreadRecord | null;
}, deps: DirectPersonalAssistantDeps): DirectPersonalAssistantResult {
  if (!deps.secondBrainService || input.decision?.route !== 'personal_assistant_task') {
    return null;
  }
  if (!['inspect', 'read', 'search'].includes(input.decision.operation)) {
    return null;
  }

  return tryDirectSecondBrainRead({
    secondBrainService: deps.secondBrainService,
    requestText: input.message.content,
    decision: input.decision,
    continuityThread: input.continuityThread,
    resolvedItemType: resolveDirectSecondBrainItemType(input.decision, input.continuityThread),
    readFocusState: readSecondBrainFocusContinuationState,
    getFocusEntry: getSecondBrainFocusEntry,
    buildFocusMetadata: buildSecondBrainFocusMetadata,
    buildFocusRemovalMetadata: buildSecondBrainFocusRemovalMetadata,
    resolveReadQuery: resolveDirectSecondBrainReadQuery,
    normalizeInlineFieldValue: normalizeSecondBrainInlineFieldValue,
    formatBriefKindLabel: formatBriefKindLabelForUser,
    normalizeRoutineQueryTokens,
    normalizeRoutineSearchTokens,
    deriveRoutineTimingKind: (routine) => deriveRoutineTimingKind(
      routine as { timing?: { kind?: string }; trigger?: { mode?: string; eventType?: string } },
    ),
    summarizeRoutineTimingForUser: (routine) => summarizeRoutineTimingForUser(
      routine as {
        timing?: { label?: string };
        trigger?: { mode?: string; cron?: string; eventType?: string; lookaheadMinutes?: unknown };
      },
    ),
    routineTopicQuery: (routine) => routineTopicQuery(
      routine as { topicQuery?: string; config?: { topicQuery?: string } },
    ),
    routineDueWithinHours: (routine) => routineDueWithinHours(
      routine as { dueWithinHours?: number; config?: { dueWithinHours?: number } },
    ),
    routineIncludeOverdue: (routine) => routineIncludeOverdue(
      routine as { includeOverdue?: boolean; config?: { includeOverdue?: boolean } },
    ),
    routineDeliveryChannels: (routine) => routineDeliveryChannels(
      routine as { delivery?: string[]; deliveryDefaults?: string[] },
    ),
    buildRoutineSemanticHints: (routine) => buildRoutineSemanticHints(
      routine as {
        id?: string;
        templateId?: string;
        name?: string;
        category?: string;
        externalCommMode?: string;
        topicQuery?: string;
        dueWithinHours?: number;
        includeOverdue?: boolean;
        config?: {
          topicQuery?: string;
          dueWithinHours?: number;
          includeOverdue?: boolean;
        };
        timing?: {
          kind?: string;
          label?: string;
          schedule?: { cadence?: string; dayOfWeek?: string; dayOfMonth?: number; time?: string; minute?: number };
        };
        trigger?: { mode?: string; eventType?: string; cron?: string; lookaheadMinutes?: unknown };
      },
    ),
  });
}
