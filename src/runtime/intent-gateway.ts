import type { ChatMessage, ChatResponse, ToolDefinition } from '../llm/types.js';
import { deriveIntentRouteClarification } from './intent/intent-route-clarification.js';
import { confirmIntentGatewayDecisionIfNeeded } from './intent/confirmation-pass.js';
import { selectIntentGatewayPromptProfile } from './intent/prompt-profiles.js';
import { normalizeIntentGatewayPromptProfile, normalizeRoute } from './intent/normalization.js';
import {
  classifierProvenanceSourceForMode,
  normalizeIntentGatewayDecisionProvenance,
} from './intent/provenance.js';
import { classifyIntentGatewayPass } from './intent/route-classifier.js';
import {
  extractExplicitAutomationName,
  isExplicitAutomationAuthoringRequest,
  isExplicitAutomationControlRequest,
  inferAutomationControlOperation,
  inferAutomationEnabledState,
} from './intent/entity-resolvers/automation.js';
import {
  hasExplicitRepoPathReference,
  inferCodeSessionControlOperation,
  inferExplicitCodingBackendRequest,
  inferExplicitCodingTaskOperation,
  inferExplicitFilesystemTaskOperation,
} from './intent/entity-resolvers/coding.js';
import {
  normalizeIntentGatewayDecision,
  parseStructuredContent,
  parseStructuredToolArguments,
} from './intent/structured-recovery.js';
import { normalizeIntentGatewayRepairText } from './intent/text.js';
import { hasRequiredWritePlannedStep } from './intent/planned-steps.js';
import {
  PRE_ROUTED_INTENT_GATEWAY_METADATA_KEY,
} from './intent/types.js';
import {
  isRawCredentialDisclosureRequest,
  looksLikeSelfContainedDirectAnswerTurn,
  looksLikeContextDependentPromptSelectionTurn,
  isExplicitRepoInspectionRequest,
  isExplicitCodingSessionControlRequest,
  isExplicitCodingBackendResumeRequest,
  inferExplicitCodingBackendResumeBackend,
  isExplicitWorkspaceAppBuildRequest,
  isExplicitWorkspaceScopedRepoWorkRequest,
  looksLikeGuardianCapabilityQuestion,
} from './intent/request-patterns.js';
import {
  inferProviderConfigOperation,
  isExplicitProviderConfigRequest,
} from './intent/entity-resolvers/provider-config.js';
import { getAmbiguousEmailProviderClarification } from './email-provider-routing.js';
import type {
  IntentGatewayChatFn,
  IntentGatewayDecision,
  IntentGatewayInput,
  IntentGatewayRecord,
} from './intent/types.js';

export { PRE_ROUTED_INTENT_GATEWAY_METADATA_KEY } from './intent/types.js';
export type {
  IntentGatewayChatFn,
  IntentGatewayConfidence,
  IntentGatewayDecision,
  IntentGatewayDecisionProvenance,
  IntentGatewayEntities,
  IntentGatewayExecutionClass,
  IntentGatewayExpectedContextPressure,
  IntentGatewayInput,
  IntentGatewayOperation,
  IntentGatewayPlannedStep,
  IntentGatewayPlannedStepKind,
  IntentGatewayPreferredAnswerPath,
  IntentGatewayPreferredTier,
  IntentGatewayPromptProfile,
  IntentGatewayProvenanceSource,
  IntentGatewayRepairContext,
  IntentGatewayRecord,
  IntentGatewayResolution,
  IntentGatewayRoute,
  IntentGatewayTurnRelation,
} from './intent/types.js';

const AUTOMATION_NAME_REPAIR_TOOL: ToolDefinition = {
  name: 'resolve_automation_name',
  description: 'Extract the exact saved automation name referenced by a request that is already known to be about controlling an existing automation. Call exactly once.',
  parameters: {
    type: 'object',
    additionalProperties: false,
    properties: {
      automationName: {
        type: 'string',
      },
    },
    required: ['automationName'],
  },
};

const AUTOMATION_NAME_REPAIR_SYSTEM_PROMPT = [
  'You repair missing automation names for Guardian intent routing.',
  'The route and operation are already known to be about controlling an existing saved automation.',
  'Return only the exact automationName the user referenced.',
  'Call the resolve_automation_name tool exactly once.',
].join(' ');

export class IntentGateway {
  async classify(
    input: IntentGatewayInput,
    chat: IntentGatewayChatFn,
  ): Promise<IntentGatewayRecord> {
    const startedAt = Date.now();
    const contentPlanRecord = buildContentPlanIntentGatewayRecord(input, startedAt);
    if (contentPlanRecord) {
      return contentPlanRecord;
    }
    const primaryPromptProfile = selectIntentGatewayPromptProfile(input);
    const primary = await classifyIntentGatewayPass(input, chat, {
      mode: 'primary',
      startedAt,
      promptProfile: primaryPromptProfile,
    });
    if (primary.available) {
      return this.repairDecisionIfNeeded(input, primary, chat);
    }

    const fallback = await classifyIntentGatewayPass(input, chat, {
      mode: 'json_fallback',
      startedAt,
      promptProfile: primaryPromptProfile,
    });
    if (fallback.available) {
      return this.repairDecisionIfNeeded(input, fallback, chat);
    }

    const routeOnly = await classifyIntentGatewayPass(input, chat, {
      mode: 'route_only_fallback',
      startedAt,
      promptProfile: primaryPromptProfile,
    });
    if (routeOnly.available || routeOnly.rawResponsePreview || routeOnly.model !== 'unknown') {
      return this.repairDecisionIfNeeded(input, routeOnly, chat);
    }
    if (fallback.rawResponsePreview || fallback.model !== 'unknown') {
      return this.repairDecisionIfNeeded(input, fallback, chat);
    }
    return this.repairDecisionIfNeeded(input, primary, chat);
  }

  private async repairDecisionIfNeeded(
    input: IntentGatewayInput,
    record: IntentGatewayRecord,
    chat: IntentGatewayChatFn,
  ): Promise<IntentGatewayRecord> {
    let workingRecord = normalizeIntentGatewayRecordDecisionForInput(input, record);
    let decision = repairEmailProviderDecisionIfNeeded(input, workingRecord.decision);
    decision = resolveSatisfiedClarificationIfNeeded(input, decision);
    workingRecord = decision === workingRecord.decision
      ? workingRecord
      : {
          ...workingRecord,
          decision,
        };
    workingRecord = await confirmIntentGatewayDecisionIfNeeded(input, workingRecord, chat);
    decision = workingRecord.decision;
    decision = applyUncertainRepairedRouteGuard(input, decision);
    decision = repairCodeSessionCreateControlDecision(input, decision);
    decision = repairCodingBackendResumeDecision(input, decision);
    decision = repairCodeSessionGroundingDecision(input, decision);
    decision = repairMissingSearchQueryFromContent(input, decision);
    decision = applyMissingRepairedSearchTargetGuard(input, decision);
    decision = applyUnresolvedContextReferenceGuard(input, decision);
    decision = repairDiagnosticsTraceInspection(decision);
    decision = repairCodeSessionClarificationFromRecentHistory(input, decision);
    decision = repairAutomationClarificationFromRecentHistory(input, decision);
    if (needsAutomationNameRepair(decision)) {
      const repairedName = await repairAutomationName(input, decision, chat);
      if (repairedName) {
        decision = {
          ...decision,
          provenance: {
            ...(decision.provenance ?? {}),
            entities: {
              ...(decision.provenance?.entities ?? {}),
              automationName: 'repair.automation_name',
            },
          },
          entities: {
            ...decision.entities,
            automationName: repairedName,
          },
        };
      }
    }
    decision = applyIntentRouteClarificationGuard(input, workingRecord, decision);
    decision = repairUnavailableUnknownWithConversationContext(input, workingRecord, decision);
    decision = applyUnknownRouteClarificationGuard(input, decision);
    decision = repairMissingFieldClarificationPrompt(input, decision);
    return {
      ...workingRecord,
      decision,
    };
  }
}

function repairDiagnosticsTraceInspection(decision: IntentGatewayDecision): IntentGatewayDecision {
  if (decision.route !== 'diagnostics_task') return decision;
  if (decision.operation !== 'inspect' && decision.operation !== 'read' && decision.operation !== 'search') {
    return decision;
  }
  const missingFieldText = decision.missingFields.join(' ').toLowerCase();
  if (
    decision.resolution !== 'needs_clarification'
    && decision.entities.toolName !== 'guardian_trace_inspect'
  ) {
    return decision;
  }
  if (
    decision.resolution === 'needs_clarification'
    && !missingFieldText.includes('routing_trace')
    && !missingFieldText.includes('trace')
    && !missingFieldText.includes('time_window')
  ) {
    return decision;
  }
  return {
    ...decision,
    operation: decision.operation === 'search' ? 'inspect' : decision.operation,
    summary: decision.summary?.trim() || 'Inspect Guardian routing trace evidence for recent assistant behavior.',
    resolution: 'ready',
    missingFields: [],
    executionClass: 'tool_orchestration',
    requiresRepoGrounding: false,
    requiresToolSynthesis: true,
    requireExactFileReferences: false,
    expectedContextPressure: 'medium',
    preferredAnswerPath: 'tool_loop',
    simpleVsComplex: 'complex',
    entities: {
      ...decision.entities,
      toolName: 'guardian_trace_inspect',
    },
    provenance: {
      ...(decision.provenance ?? {}),
      operation: decision.operation === 'search' ? 'repair.structured' : decision.provenance?.operation,
      entities: {
        ...(decision.provenance?.entities ?? {}),
        toolName: 'repair.structured',
      },
    },
  };
}

function applyUnresolvedContextReferenceGuard(
  input: IntentGatewayInput,
  decision: IntentGatewayDecision,
): IntentGatewayDecision {
  if (!shouldClarifyUnresolvedContextReference(input, decision)) {
    return decision;
  }
  return {
    ...decision,
    summary: 'What should I check? Please point me at the item, page, message, file, or request you mean.',
    resolution: 'needs_clarification',
    missingFields: [...new Set([...decision.missingFields, 'reference_target'])],
    executionClass: 'direct_assistant',
    requiresRepoGrounding: false,
    requiresToolSynthesis: false,
    requireExactFileReferences: false,
    expectedContextPressure: 'low',
    preferredAnswerPath: 'direct',
    simpleVsComplex: 'simple',
  };
}

function shouldClarifyUnresolvedContextReference(
  input: IntentGatewayInput,
  decision: IntentGatewayDecision,
): boolean {
  if (decision.resolution !== 'ready' || decision.turnRelation !== 'new_request') {
    return false;
  }
  if (input.pendingAction || hasContinuityAnchor(input)) {
    return false;
  }
  if (!isToolBackedContextReferenceDecision(decision)) {
    return false;
  }
  if (!looksLikeContextDependentPromptSelectionTurn(input.content)) {
    return false;
  }
  return !hasConcreteReferenceTarget(input, decision);
}

function hasContinuityAnchor(input: IntentGatewayInput): boolean {
  const continuity = input.continuity;
  return !!(
    continuity?.lastActionableRequest
    || continuity?.focusSummary
    || continuity?.continuationStateKind
    || (continuity?.activeExecutionRefs && continuity.activeExecutionRefs.length > 0)
  );
}

function isToolBackedContextReferenceDecision(decision: IntentGatewayDecision): boolean {
  if (decision.requiresRepoGrounding || decision.requiresToolSynthesis) {
    return true;
  }
  return decision.route === 'security_task'
    || decision.route === 'coding_task'
    || decision.route === 'filesystem_task'
    || decision.route === 'browser_task'
    || decision.route === 'search_task'
    || decision.route === 'memory_task';
}

function hasConcreteReferenceTarget(
  input: IntentGatewayInput,
  decision: IntentGatewayDecision,
): boolean {
  const entities = decision.entities;
  if (
    entities.query
    || (entities.urls && entities.urls.length > 0)
    || entities.path
    || entities.searchSourceId
    || entities.searchSourceName
    || entities.emailProvider
    || entities.personalItemType
  ) {
    return true;
  }
  const content = input.content.trim();
  return /\bhttps?:\/\//i.test(content)
    || /\b(?:this|the)\s+(?:repo|repository|workspace|codebase|project)\b/i.test(content)
    || isExplicitRepoInspectionRequest(content);
}

function buildContentPlanIntentGatewayRecord(
  input: IntentGatewayInput,
  startedAt: number,
): IntentGatewayRecord | null {
  const sourceContent = input.content;
  const repairContext = {
    sourceContent,
    recentHistory: input.recentHistory,
    pendingAction: input.pendingAction,
    continuity: input.continuity,
  };
  const normalize = (raw: Record<string, unknown>, rawResponsePreview: string): IntentGatewayRecord => ({
    mode: 'primary',
    available: true,
    model: 'content-plan',
    latencyMs: Math.max(0, Date.now() - startedAt),
    promptProfile: 'compact',
    rawResponsePreview,
    decision: normalizeIntentGatewayDecision(raw, repairContext, {
      classifierSource: 'derived.workload',
    }),
  });

  if (looksLikeSelfContainedDirectAnswerTurn(sourceContent)) {
    return normalize({
      route: 'general_assistant',
      confidence: 'high',
      operation: 'read',
      summary: 'Answer the self-contained exact-response request directly.',
      turnRelation: 'new_request',
      resolution: 'ready',
      missingFields: [],
      executionClass: 'direct_assistant',
      preferredTier: 'external',
      requiresRepoGrounding: false,
      requiresToolSynthesis: false,
      expectedContextPressure: 'low',
      preferredAnswerPath: 'direct',
      simpleVsComplex: 'simple',
      entities: {},
    }, 'content-plan:self-contained-exact-answer');
  }

  if (looksLikeGuardianCapabilityQuestion(sourceContent)) {
    return normalize({
      route: 'general_assistant',
      confidence: 'high',
      operation: 'inspect',
      summary: 'Answer a Guardian capability or configuration question directly.',
      turnRelation: 'new_request',
      resolution: 'ready',
      missingFields: [],
      executionClass: 'direct_assistant',
      preferredTier: 'external',
      requiresRepoGrounding: false,
      requiresToolSynthesis: false,
      requireExactFileReferences: false,
      expectedContextPressure: 'low',
      preferredAnswerPath: 'direct',
      simpleVsComplex: 'simple',
      entities: {},
    }, 'content-plan:guardian-capability-question');
  }

  if (isRawCredentialDisclosureRequest(sourceContent)) {
    return normalize({
      route: 'security_task',
      confidence: 'high',
      operation: 'read',
      summary: 'Refuse a request to disclose raw protected credentials or secrets.',
      turnRelation: 'new_request',
      resolution: 'ready',
      missingFields: [],
      executionClass: 'security_analysis',
      preferredTier: 'external',
      requiresRepoGrounding: false,
      requiresToolSynthesis: false,
      requireExactFileReferences: false,
      expectedContextPressure: 'low',
      preferredAnswerPath: 'direct',
      simpleVsComplex: 'simple',
      entities: {},
    }, 'content-plan:raw-credential-disclosure-refusal');
  }

  if (isPendingApprovalStatusRequest(sourceContent)) {
    return normalize({
      route: 'general_assistant',
      confidence: 'high',
      operation: 'read',
      summary: 'Report the current approval status.',
      turnRelation: 'new_request',
      resolution: 'ready',
      missingFields: [],
      executionClass: 'direct_assistant',
      preferredTier: 'external',
      requiresRepoGrounding: false,
      requiresToolSynthesis: false,
      requireExactFileReferences: false,
      expectedContextPressure: 'low',
      preferredAnswerPath: 'direct',
      simpleVsComplex: 'simple',
      entities: {},
    }, 'content-plan:pending-approval-status');
  }

  const codeSessionCreateDirective = parseCodeSessionCreateDirective(sourceContent);
  if (codeSessionCreateDirective) {
    return normalize(buildCodeSessionCreateControlDecision(codeSessionCreateDirective), 'content-plan:code-session-create-control');
  }

  if (isExplicitCodingBackendResumeRequest(sourceContent)) {
    return normalize(buildCodingBackendResumeDecision(sourceContent), 'content-plan:coding-backend-resume');
  }

  const codingBackendDelegation = buildExplicitCodingBackendDelegationDecision(sourceContent);
  if (codingBackendDelegation) {
    return normalize(codingBackendDelegation, 'content-plan:coding-backend-delegation');
  }

  if (isNarrowContentPlanRepoInspectionRequest(sourceContent)) {
    return normalize({
      route: 'coding_task',
      confidence: 'high',
      operation: 'inspect',
      summary: 'Inspect the current coding workspace and answer from repo evidence.',
      turnRelation: 'new_request',
      resolution: 'ready',
      missingFields: [],
      executionClass: 'repo_grounded',
      preferredTier: 'external',
      requiresRepoGrounding: true,
      requiresToolSynthesis: true,
      requireExactFileReferences: true,
      expectedContextPressure: 'medium',
      preferredAnswerPath: 'chat_synthesis',
      simpleVsComplex: 'complex',
      plannedSteps: [
        {
          kind: 'read',
          summary: 'Inspect the relevant repo files or symbols.',
          required: true,
          expectedToolCategories: ['read', 'repo_inspect'],
        },
        {
          kind: 'answer',
          summary: 'Answer with the grounded repo evidence.',
          required: true,
          dependsOn: ['step_1'],
          expectedToolCategories: ['answer'],
        },
      ],
      entities: {},
    }, 'content-plan:repo-inspection');
  }

  if (
    isExplicitAutomationControlRequest(sourceContent)
    && !isExplicitAutomationAuthoringRequest(sourceContent)
    && hasExplicitReadOnlyConstraint(sourceContent)
  ) {
    const automationOperation = inferAutomationControlOperation(sourceContent, 'unknown');
    if (automationOperation === 'read' || automationOperation === 'inspect' || automationOperation === 'search') {
      return normalize({
        route: 'automation_control',
        confidence: 'high',
        operation: automationOperation,
        summary: 'Read the automation catalog or automation status.',
        turnRelation: 'new_request',
        resolution: 'ready',
        missingFields: [],
        executionClass: 'tool_orchestration',
        preferredTier: 'external',
        requiresRepoGrounding: false,
        requiresToolSynthesis: true,
        requireExactFileReferences: false,
        expectedContextPressure: 'medium',
        preferredAnswerPath: 'tool_loop',
        simpleVsComplex: 'complex',
        plannedSteps: [
          {
            kind: 'read',
            summary: 'Read automation catalog data.',
            required: true,
            expectedToolCategories: ['automation_list'],
          },
          {
            kind: 'answer',
            summary: 'Summarize the automation catalog result.',
            required: true,
            dependsOn: ['step_1'],
            expectedToolCategories: ['answer'],
          },
        ],
        entities: {},
      }, 'content-plan:automation-control-read');
    }
  }

  const codeSessionRemovalTarget = inferCodeSessionRemovalClarificationAnswer(input);
  if (codeSessionRemovalTarget) {
    const codeSessionRemovalContext = readCodeSessionRemovalClarificationContext(input);
    const codeSessionCreateDirective = buildCodeSessionCreateDirectiveFromRemovalContext(codeSessionRemovalContext);
    return normalize({
      route: 'coding_session_control',
      confidence: 'high',
      operation: 'delete',
      summary: codeSessionCreateDirective
        ? 'Remove the selected coding session and continue the requested coding-session creation.'
        : 'Remove the selected coding session to resolve the coding-session limit.',
      turnRelation: 'clarification_answer',
      resolution: 'ready',
      missingFields: [],
      executionClass: 'tool_orchestration',
      preferredTier: 'local',
      requiresRepoGrounding: false,
      requiresToolSynthesis: false,
      requireExactFileReferences: false,
      expectedContextPressure: 'low',
      preferredAnswerPath: 'direct',
      simpleVsComplex: 'simple',
      sessionTarget: codeSessionRemovalTarget,
      ...(codeSessionCreateDirective
        ? {
            path: codeSessionCreateDirective.workspaceRoot,
            ...(codeSessionCreateDirective.title ? { query: codeSessionCreateDirective.title } : {}),
            codeSessionResource: 'session',
          }
        : {}),
    }, 'content-plan:code-session-removal-clarification');
  }

  if (isExplicitProviderConfigRequest(sourceContent) || isExplicitProviderStatusReadRequest(sourceContent)) {
    const providerOperation = inferProviderConfigOperation(sourceContent, 'unknown');
    if (providerOperation === 'read' || providerOperation === 'inspect') {
      return normalize({
        route: 'general_assistant',
        confidence: 'high',
        operation: providerOperation,
        summary: 'Read Guardian provider configuration or status.',
        turnRelation: 'new_request',
        resolution: 'ready',
        missingFields: [],
        executionClass: 'provider_crud',
        preferredTier: 'external',
        requiresRepoGrounding: false,
        requiresToolSynthesis: true,
        requireExactFileReferences: false,
        expectedContextPressure: 'medium',
        preferredAnswerPath: 'tool_loop',
        simpleVsComplex: 'complex',
        plannedSteps: [
          {
            kind: 'read',
            summary: 'Read provider configuration or status evidence.',
            required: true,
            expectedToolCategories: ['provider_config'],
          },
          {
            kind: 'answer',
            summary: 'Report provider status without changing configuration.',
            required: true,
            dependsOn: ['step_1'],
            expectedToolCategories: ['answer'],
          },
        ],
        entities: {
          uiSurface: 'config',
        },
      }, 'content-plan:provider-config-read');
    }
  }

  if (isExplicitSecondBrainReadOnlyRequest(sourceContent)) {
    return normalize({
      route: 'personal_assistant_task',
      confidence: 'high',
      operation: 'read',
      summary: 'Read Second Brain items and answer from that evidence.',
      turnRelation: 'new_request',
      resolution: 'ready',
      missingFields: [],
      executionClass: 'tool_orchestration',
      preferredTier: 'external',
      requiresRepoGrounding: false,
      requiresToolSynthesis: true,
      requireExactFileReferences: false,
      expectedContextPressure: 'medium',
      preferredAnswerPath: 'tool_loop',
      simpleVsComplex: 'complex',
      plannedSteps: [
        {
          kind: 'read',
          summary: 'Read the relevant Second Brain items.',
          required: true,
          expectedToolCategories: ['second_brain'],
        },
        {
          kind: 'answer',
          summary: 'Summarize the Second Brain result.',
          required: true,
          dependsOn: ['step_1'],
          expectedToolCategories: ['answer'],
        },
      ],
      entities: {},
    }, 'content-plan:second-brain-read');
  }

  if (
    isExplicitWorkspaceAppBuildRequest(sourceContent)
    && asksForWorkspaceAppRuntimeEvidence(sourceContent)
  ) {
    const normalizedSourceContent = sourceContent.toLowerCase();
    const inferredOperation = inferExplicitCodingTaskOperation(normalizedSourceContent, 'unknown');
    const operation = inferredOperation && inferredOperation !== 'unknown'
      ? inferredOperation
      : 'create';
    return normalize({
      route: 'coding_task',
      confidence: 'high',
      operation,
      summary: operation === 'create'
        ? 'Build the requested app in the current coding workspace.'
        : 'Update the requested app in the current coding workspace.',
      turnRelation: input.continuity?.activeExecution?.codeSessionId || input.continuity?.activeExecutionRefs?.some((ref) => ref.startsWith('code_session:'))
        ? 'follow_up'
        : 'new_request',
      resolution: 'ready',
      missingFields: [],
      executionClass: 'repo_grounded',
      preferredTier: 'external',
      requiresRepoGrounding: true,
      requiresToolSynthesis: true,
      requireExactFileReferences: false,
      expectedContextPressure: 'medium',
      preferredAnswerPath: 'tool_loop',
      simpleVsComplex: 'complex',
      plannedSteps: [
        {
          kind: 'read',
          summary: 'Inspect the current workspace before creating app files.',
          required: true,
          expectedToolCategories: ['read', 'repo_inspect'],
        },
        {
          kind: 'write',
          summary: 'Create or update the requested app files in the workspace.',
          required: true,
          dependsOn: ['step_1'],
          expectedToolCategories: ['write', 'repo_mutation'],
        },
        {
          kind: 'read',
          summary: 'Read back the created app files or collect equivalent file evidence.',
          required: true,
          dependsOn: ['step_2'],
          expectedToolCategories: ['read', 'repo_inspect'],
        },
        {
          kind: 'tool_call',
          summary: 'Run or exercise the app locally and collect runtime evidence.',
          required: true,
          dependsOn: ['step_3'],
          expectedToolCategories: ['runtime_evidence'],
        },
        {
          kind: 'answer',
          summary: 'Report the local URL and verified visible behavior.',
          required: true,
          dependsOn: ['step_4'],
          expectedToolCategories: ['answer'],
        },
      ],
      entities: {},
    }, 'content-plan:workspace-app-build');
  }

  const hasAttachedCodeSessionRef = input.continuity?.activeExecutionRefs?.some((ref) => ref.startsWith('code_session:')) === true
    || !!input.continuity?.activeExecution?.codeSessionId;
  const normalizedSourceForContinuity = sourceContent.toLowerCase();
  const activeExecution = input.continuity?.activeExecution;
  const canUseFreshCodeSessionContentPlan = !activeExecution
    || asksNotToResumePriorCodingExecution(normalizedSourceForContinuity);
  if (
    hasAttachedCodeSessionRef
    && canUseFreshCodeSessionContentPlan
    && isExplicitBoundedCodeSessionFileMutation(sourceContent)
    && isExplicitWorkspaceScopedRepoWorkRequest(sourceContent)
  ) {
    const normalizedSourceContent = sourceContent.toLowerCase();
    const operation = (
      hasExplicitRepoPathReference(normalizedSourceContent)
        ? inferExplicitFilesystemTaskOperation(normalizedSourceContent, 'unknown')
        : null
    ) ?? inferExplicitCodingTaskOperation(normalizedSourceContent, 'unknown') ?? 'update';
    return normalize({
      route: 'coding_task',
      confidence: 'high',
      operation,
      summary: 'Run the explicit coding workspace request against the attached code session.',
      turnRelation: input.continuity?.activeExecution?.codeSessionId || input.continuity?.activeExecutionRefs?.some((ref) => ref.startsWith('code_session:'))
        ? 'follow_up'
        : 'new_request',
      resolution: 'ready',
      missingFields: [],
      executionClass: 'repo_grounded',
      preferredTier: 'external',
      requiresRepoGrounding: true,
      requiresToolSynthesis: true,
      requireExactFileReferences: false,
      expectedContextPressure: 'medium',
      preferredAnswerPath: 'tool_loop',
      simpleVsComplex: 'complex',
      plannedSteps: [
        {
          kind: 'read',
          summary: 'Inspect the relevant workspace context before changing files.',
          required: true,
          expectedToolCategories: ['read', 'repo_inspect'],
        },
        {
          kind: 'write',
          summary: 'Apply the requested workspace change.',
          required: true,
          expectedToolCategories: [operation === 'delete' ? 'delete' : 'write', 'repo_mutation'],
        },
        {
          kind: 'read',
          summary: 'Read back the changed artifact or collect equivalent verification evidence.',
          required: true,
          dependsOn: ['step_2'],
          expectedToolCategories: ['read', 'repo_inspect'],
        },
        {
          kind: 'answer',
          summary: 'Report the completed change and verification evidence.',
          required: true,
          dependsOn: ['step_3'],
          expectedToolCategories: ['answer'],
        },
      ],
      entities: {},
    }, 'content-plan:explicit-code-session-work');
  }

  return null;
}

function isPendingApprovalStatusRequest(content: string | undefined): boolean {
  const normalized = normalizePendingApprovalStatusRequestText(content);
  if (!normalized) return false;
  return /^pending approvals?\??$/.test(normalized)
    || /^approvals? pending\??$/.test(normalized)
    || /^(?:what|which)\s+(?:pending approvals?|approvals?\s+pending)(?:\s+do i have)?(?:\s+(?:right now|currently|today))?\??$/.test(normalized)
    || /^(?:show|list)\s+(?:my\s+|the\s+)?(?:current\s+)?(?:pending approvals?|approvals?\s+pending)(?:\s+(?:right now|currently|today))?\??$/.test(normalized)
    || /^(?:are there|do i have)\s+(?:any\s+)?(?:pending approvals?|approvals?\s+pending)(?:\s+(?:right now|currently|today))?\??$/.test(normalized)
    || /^(?:tell me whether|tell me if)\s+(?:i\s+have\s+)?(?:any\s+)?pending approvals?(?:\s+(?:right now|currently|today))?[.?!]?$/.test(normalized);
}

function normalizePendingApprovalStatusRequestText(content: string | undefined): string {
  return normalizeIntentGatewayRepairText(content)
    .replace(/\b(?:do\s+not|don't|never)\s+(?:approve|deny|accept|reject)(?:\s+or\s+(?:approve|deny|accept|reject))?\s+anything\b[^.!?\n]*[.!?]?/g, ' ')
    .replace(/\binclude\s+marker\s+[a-z0-9_-]+\b[.!?]?/g, ' ')
    .replace(/\bkeep\s+the\s+answer\s+concise\b[.!?]?/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[.?!]+$/g, '?');
}

function stripNegatedMutationClauses(content: string): string {
  return content
    .replace(/\b(?:do\s+not|don't|never)\s+(?:create|update|archive|save|delete|remove|write|change|edit|modify)\b[^.!?\n]*/g, ' ')
    .replace(/\bwithout\s+(?:creating|updating|archiving|saving|deleting|removing|writing|changing|editing|modifying)\b[^.!?\n]*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isExplicitSecondBrainReadOnlyRequest(content: string | undefined): boolean {
  const normalized = normalizeIntentGatewayRepairText(content);
  if (!normalized || !/\bsecond brain\b/.test(normalized)) return false;
  const positiveContent = stripNegatedMutationClauses(normalized);
  if (!/\b(?:list|show|read|count|summarize|summary|current|open|what|which|how many)\b/.test(positiveContent)) {
    return false;
  }
  return !/\b(?:create|update|archive|save|delete|remove|write|change|edit|modify)\b/.test(positiveContent);
}

function hasExplicitReadOnlyConstraint(content: string | undefined): boolean {
  const normalized = normalizeIntentGatewayRepairText(content);
  if (!normalized) return false;
  const withoutCodeScopedConstraints = normalized
    .replace(
      /\b(?:do\s+not|don't|never)\s+(?:edit|change|modify|write|update)\s+(?:the\s+)?(?:code|source|repo|repository|codebase|workspace)\b/g,
      ' ',
    )
    .replace(
      /\bwithout\s+(?:editing|changing|modifying|writing|updating)\s+(?:the\s+)?(?:code|source|repo|repository|codebase|workspace)\b/g,
      ' ',
    );
  return /\b(?:do\s+not|don't|never)\s+(?:create|update|archive|save|delete|remove|write|change|edit|modify|run|enable|disable)\b/.test(withoutCodeScopedConstraints)
    || /\bwithout\s+(?:creating|updating|archiving|saving|deleting|removing|writing|changing|editing|modifying|running|enabling|disabling)\b/.test(withoutCodeScopedConstraints)
    || /\bread[\s-]*only\b/.test(withoutCodeScopedConstraints);
}

function isNarrowContentPlanRepoInspectionRequest(content: string | undefined): boolean {
  const normalized = normalizeIntentGatewayRepairText(content);
  if (!normalized || !isExplicitRepoInspectionRequest(normalized)) return false;
  if (/(?:^|\s)(?:src|docs|web|scripts|native|policies|skills)\//.test(normalized)) return false;
  if (/\b(?:functions?|types?|symbols?|classes?|interfaces?|methods?)\b/.test(normalized)) return false;
  return /\bwhich\s+(?:typescript|javascript|source|code)?\s*files?\s+contains?\b/.test(normalized)
    || /\bwhich\s+(?:typescript|javascript|source|code)?\s*files?\s+(?:implement|define|handle|own)\b/.test(normalized);
}

function isExplicitProviderStatusReadRequest(content: string | undefined): boolean {
  const normalized = normalizeIntentGatewayRepairText(content);
  if (!normalized) return false;
  if (!/\b(?:providers?|ollama|openai|anthropic|xai|gemini|claude)\b/.test(normalized)) {
    return false;
  }
  return /\b(?:check|show|list|read|inspect|status|connected|health|available|catalog|models?)\b/.test(normalized)
    && !/\b(?:update|edit|change|modify|set|switch|create|add|delete|remove)\b/.test(stripNegatedMutationClauses(normalized));
}

function asksForWorkspaceAppRuntimeEvidence(content: string | undefined): boolean {
  const normalized = normalizeIntentGatewayRepairText(content);
  if (!normalized) return false;
  return /\b(?:start|run|launch|serve|exercise|open)\b[^.!?\n]{0,120}\b(?:app|locally|local\s+url|localhost|browser|visible\s+behavior|verified?)\b/.test(normalized)
    || /\b(?:local\s+url|localhost|browser|visible\s+behavior|verified?\s+visible|what\s+you\s+verified)\b/.test(normalized)
    || /\bmake\s+(?:it|the\s+app)\s+runnable\s+locally\b/.test(normalized);
}

function isExplicitBoundedCodeSessionFileMutation(content: string): boolean {
  const normalized = content.toLowerCase();
  if (!hasExplicitRepoPathReference(normalized)) return false;
  const hasMutation = /\b(?:create|add|make|write|touch|update|edit|append|delete|remove)\b/.test(normalized);
  if (!hasMutation) return false;
  const hasExactContentInstruction = /\b(?:containing|with\s+content|exact(?:ly)?|write\s+.+?\s+to)\b/.test(normalized);
  const hasVerificationInstruction = /\b(?:read\s+(?:it|the\s+file)\s+back|read\s+back|verify|confirm)\b/.test(normalized);
  return hasExactContentInstruction && hasVerificationInstruction;
}

function normalizeIntentGatewayRecordDecisionForInput(
  input: IntentGatewayInput,
  record: IntentGatewayRecord,
): IntentGatewayRecord {
  if (record.decision.route !== 'unknown') {
    return record;
  }
  const decision = normalizeIntentGatewayDecision(
    {
      ...record.decision,
      ...record.decision.entities,
    } as Record<string, unknown>,
    {
      sourceContent: input.content,
      recentHistory: input.recentHistory,
      pendingAction: input.pendingAction,
      continuity: input.continuity,
      enabledManagedProviders: input.enabledManagedProviders,
    },
    { classifierSource: classifierProvenanceSourceForMode(record.mode) },
  );
  return {
    ...record,
    decision,
  };
}

function applyUncertainRepairedRouteGuard(
  input: IntentGatewayInput,
  decision: IntentGatewayDecision,
): IntentGatewayDecision {
  if (!shouldClarifyUncertainRepairedRoute(input, decision)) {
    return decision;
  }
  return {
    ...decision,
    summary: buildUncertainRepairedRoutePrompt(input),
    resolution: 'needs_clarification',
    missingFields: [...new Set([...decision.missingFields, 'intent_route'])],
    executionClass: 'direct_assistant',
    requiresRepoGrounding: false,
    requiresToolSynthesis: false,
    requireExactFileReferences: false,
    expectedContextPressure: 'low',
    preferredAnswerPath: 'direct',
    simpleVsComplex: 'simple',
  };
}

function applyMissingRepairedSearchTargetGuard(
  input: IntentGatewayInput,
  decision: IntentGatewayDecision,
): IntentGatewayDecision {
  if (!shouldClarifyMissingRepairedSearchTarget(decision)) {
    return decision;
  }
  return {
    ...decision,
    summary: buildMissingRepairedSearchTargetPrompt(input, decision),
    resolution: 'needs_clarification',
    missingFields: [...new Set([...decision.missingFields, 'query'])],
    executionClass: 'direct_assistant',
    requiresRepoGrounding: false,
    requiresToolSynthesis: false,
    requireExactFileReferences: false,
    expectedContextPressure: 'low',
    preferredAnswerPath: 'direct',
    simpleVsComplex: 'simple',
  };
}

function repairMissingSearchQueryFromContent(
  input: IntentGatewayInput,
  decision: IntentGatewayDecision,
): IntentGatewayDecision {
  if (!shouldClarifyMissingRepairedSearchTarget(decision)) {
    return decision;
  }
  if (hasWebSearchPlannedStep(decision)) {
    return decision;
  }
  if (!hasExtractableSearchQuery(input.content)) {
    return decision;
  }
  return {
    ...decision,
    resolution: 'ready',
    missingFields: decision.missingFields.filter((field) => field !== 'query'),
    entities: {
      ...decision.entities,
      query: input.content.trim(),
    },
    provenance: {
      ...(decision.provenance ?? {}),
      entities: {
        ...(decision.provenance?.entities ?? {}),
        query: 'repair.structured',
      },
    },
  };
}

function repairUnavailableUnknownWithConversationContext(
  input: IntentGatewayInput,
  record: IntentGatewayRecord,
  decision: IntentGatewayDecision,
): IntentGatewayDecision {
  if (decision.route !== 'unknown') {
    return decision;
  }
  if (record.available) {
    return decision;
  }
  const hasResumableActiveExecution = canRepairFromActiveExecution(input);
  const hasExplicitActiveExecutionContinuation = canRepairFromExplicitActiveExecutionContinuation(input);
  const recentArtifactRepair = repairUnavailableRecentArtifactReferenceWork(input, decision);
  if (recentArtifactRepair) {
    return recentArtifactRepair;
  }
  if (
    !hasResumableActiveExecution
    && !hasExplicitActiveExecutionContinuation
    && (
      looksLikeContextDependentPromptSelectionTurn(input.content)
      || !hasSubstantiveCurrentTurnForDirectFallback(input.content)
    )
  ) {
    return decision;
  }
  if (hasExplicitActiveExecutionContinuation) {
    const activeExecutionRepair = repairUnavailableActiveExecutionWork(input, decision, {
      allowFailedOrCancelled: true,
    });
    if (activeExecutionRepair) {
      return activeExecutionRepair;
    }
  }
  if (hasActiveCodeSessionContinuity(input)) {
    const codeSessionRepair = repairUnavailableCodeSessionWork(input, decision);
    if (codeSessionRepair) {
      return codeSessionRepair;
    }
    if (!looksLikeDirectContextQuestion(input.content)) {
      return decision;
    }
  }
  const activeExecutionRepair = repairUnavailableActiveExecutionWork(input, decision);
  if (activeExecutionRepair) {
    return activeExecutionRepair;
  }
  if (input.pendingAction || !hasConversationContextForDirectFallback(input)) {
    return decision;
  }
  return {
    ...decision,
    route: 'general_assistant',
    confidence: 'low',
    operation: decision.operation === 'unknown' ? 'read' : decision.operation,
    summary: 'Answer the user from the current conversation context; ask plainly if that context is still insufficient.',
    turnRelation: 'follow_up',
    resolution: 'ready',
    missingFields: [],
    resolvedContent: input.content,
    executionClass: 'direct_assistant',
    preferredTier: 'external',
    requiresRepoGrounding: false,
    requiresToolSynthesis: false,
    requireExactFileReferences: false,
    expectedContextPressure: 'medium',
    preferredAnswerPath: 'direct',
    simpleVsComplex: 'simple',
    provenance: {
      ...(decision.provenance ?? {}),
      route: 'repair.continuity',
      operation: decision.operation === 'unknown'
        ? 'repair.continuity'
        : decision.provenance?.operation,
      resolvedContent: 'repair.continuity',
      executionClass: 'repair.continuity',
      preferredTier: 'repair.continuity',
      requiresRepoGrounding: 'repair.continuity',
      requiresToolSynthesis: 'repair.continuity',
      requireExactFileReferences: 'repair.continuity',
      expectedContextPressure: 'repair.continuity',
      preferredAnswerPath: 'repair.continuity',
      simpleVsComplex: 'repair.continuity',
    },
    entities: {
      ...decision.entities,
    },
  };
}

function canRepairFromActiveExecution(input: IntentGatewayInput): boolean {
  const activeExecution = input.continuity?.activeExecution;
  if (!activeExecution || !activeExecution.route) {
    return false;
  }
  if (activeExecution.status === 'failed' || activeExecution.status === 'cancelled') {
    return false;
  }
  return activeExecution.route !== 'unknown' && activeExecution.route !== 'general_assistant';
}

function canRepairFromExplicitActiveExecutionContinuation(input: IntentGatewayInput): boolean {
  const activeExecution = input.continuity?.activeExecution;
  if (!activeExecution || !activeExecution.route) {
    return false;
  }
  if (activeExecution.route === 'unknown' || activeExecution.route === 'general_assistant') {
    return false;
  }
  if (!hasExplicitExecutionContinuationRequest(input.content)) {
    return false;
  }
  if (asksNotToResumePriorCodingExecution(input.content.trim().toLowerCase())) {
    return false;
  }
  if (activeExecution.route === 'coding_task') {
    return hasActiveCodeSessionContinuity(input) || !!activeExecution.codeSessionId;
  }
  return true;
}

function repairUnavailableActiveExecutionWork(
  input: IntentGatewayInput,
  decision: IntentGatewayDecision,
  options?: { allowFailedOrCancelled?: boolean },
): IntentGatewayDecision | null {
  if (!options?.allowFailedOrCancelled && !canRepairFromActiveExecution(input)) {
    return null;
  }
  const activeExecution = input.continuity?.activeExecution;
  if (!activeExecution) return null;
  if (
    !options?.allowFailedOrCancelled
    && (activeExecution.status === 'failed' || activeExecution.status === 'cancelled')
  ) {
    return null;
  }
  const route = activeExecution.route;
  if (!route || route === 'unknown' || route === 'general_assistant') {
    return null;
  }
  const operation = activeExecution.operation && activeExecution.operation !== 'unknown'
    ? activeExecution.operation
    : decision.operation !== 'unknown'
      ? decision.operation
      : defaultOperationForRoute(route);
  const workload = workloadForActiveExecutionRoute(route);
  return {
    ...decision,
    route,
    confidence: 'low',
    operation,
    summary: activeExecution.summary?.trim()
      || summaryForActiveExecutionRoute(route),
    turnRelation: 'follow_up',
    resolution: 'ready',
    missingFields: [],
    resolvedContent: input.content,
    executionClass: workload.executionClass,
    preferredTier: workload.preferredTier,
    requiresRepoGrounding: workload.requiresRepoGrounding,
    requiresToolSynthesis: workload.requiresToolSynthesis,
    requireExactFileReferences: workload.requireExactFileReferences,
    expectedContextPressure: workload.expectedContextPressure,
    preferredAnswerPath: workload.preferredAnswerPath,
    simpleVsComplex: 'complex',
    provenance: {
      ...(decision.provenance ?? {}),
      route: 'repair.continuity',
      operation: 'repair.continuity',
      resolvedContent: 'repair.continuity',
      executionClass: 'repair.continuity',
      preferredTier: 'repair.continuity',
      requiresRepoGrounding: 'repair.continuity',
      requiresToolSynthesis: 'repair.continuity',
      requireExactFileReferences: 'repair.continuity',
      expectedContextPressure: 'repair.continuity',
      preferredAnswerPath: 'repair.continuity',
      simpleVsComplex: 'repair.continuity',
      entities: {
        ...(decision.provenance?.entities ?? {}),
        ...(route === 'coding_task' && hasExplicitExecutionContinuationRequest(input.content)
          ? { codingBackendResumeRequested: 'repair.continuity' as const }
          : {}),
      },
    },
    entities: {
      ...decision.entities,
      ...(route === 'coding_task' && hasExplicitExecutionContinuationRequest(input.content)
        ? { codingBackendResumeRequested: true }
        : {}),
    },
  };
}

function defaultOperationForRoute(route: IntentGatewayDecision['route']): IntentGatewayDecision['operation'] {
  switch (route) {
    case 'filesystem_task':
    case 'workspace_task':
    case 'email_task':
    case 'search_task':
    case 'memory_task':
    case 'diagnostics_task':
    case 'security_task':
      return 'inspect';
    case 'automation_authoring':
    case 'complex_planning_task':
      return 'create';
    case 'automation_control':
    case 'coding_session_control':
      return 'update';
    case 'coding_task':
      return 'update';
    default:
      return 'read';
  }
}

function workloadForActiveExecutionRoute(
  route: IntentGatewayDecision['route'],
): Pick<
  IntentGatewayDecision,
  | 'executionClass'
  | 'preferredTier'
  | 'requiresRepoGrounding'
  | 'requiresToolSynthesis'
  | 'requireExactFileReferences'
  | 'expectedContextPressure'
  | 'preferredAnswerPath'
> {
  if (route === 'coding_task') {
    return {
      executionClass: 'repo_grounded',
      preferredTier: 'external',
      requiresRepoGrounding: true,
      requiresToolSynthesis: true,
      requireExactFileReferences: false,
      expectedContextPressure: 'high',
      preferredAnswerPath: 'chat_synthesis',
    };
  }
  if (route === 'security_task') {
    return {
      executionClass: 'security_analysis',
      preferredTier: 'external',
      requiresRepoGrounding: true,
      requiresToolSynthesis: true,
      requireExactFileReferences: false,
      expectedContextPressure: 'high',
      preferredAnswerPath: 'chat_synthesis',
    };
  }
  if (route === 'general_assistant' || route === 'channel_delivery' || route === 'unknown') {
    return {
      executionClass: 'direct_assistant',
      preferredTier: 'external',
      requiresRepoGrounding: false,
      requiresToolSynthesis: false,
      requireExactFileReferences: false,
      expectedContextPressure: 'medium',
      preferredAnswerPath: 'direct',
    };
  }
  return {
    executionClass: 'tool_orchestration',
    preferredTier: 'external',
    requiresRepoGrounding: false,
    requiresToolSynthesis: true,
    requireExactFileReferences: false,
    expectedContextPressure: 'medium',
    preferredAnswerPath: 'tool_loop',
  };
}

function summaryForActiveExecutionRoute(route: IntentGatewayDecision['route']): string {
  if (route === 'coding_task') {
    return 'Continue the active coding workspace request from execution state.';
  }
  if (route === 'complex_planning_task') {
    return 'Continue the active planning request from execution state.';
  }
  return 'Continue the active execution from shared orchestration state.';
}

function repairUnavailableRecentArtifactReferenceWork(
  input: IntentGatewayInput,
  decision: IntentGatewayDecision,
): IntentGatewayDecision | null {
  const artifact = resolveRecentArtifactReference(input);
  if (!artifact) return null;
  return {
    ...decision,
    route: 'coding_task',
    confidence: 'medium',
    operation: 'read',
    plannedSteps: [
      {
        kind: 'read',
        summary: `Read ${artifact.path} from the active coding workspace.`,
        required: true,
        expectedToolCategories: ['repo_inspection'],
      },
      {
        kind: 'answer',
        summary: 'Show the requested file content or a concise excerpt from repo evidence.',
        required: true,
      },
    ],
    summary: 'Read a recently changed file from the active coding workspace.',
    turnRelation: 'follow_up',
    resolution: 'ready',
    missingFields: [],
    resolvedContent: input.content,
    executionClass: 'repo_grounded',
    preferredTier: 'external',
    requiresRepoGrounding: true,
    requiresToolSynthesis: true,
    requireExactFileReferences: true,
    expectedContextPressure: 'medium',
    preferredAnswerPath: 'tool_loop',
    simpleVsComplex: 'simple',
    provenance: {
      ...(decision.provenance ?? {}),
      route: 'repair.continuity',
      operation: 'repair.continuity',
      resolvedContent: 'repair.continuity',
      executionClass: 'repair.continuity',
      preferredTier: 'repair.continuity',
      requiresRepoGrounding: 'repair.continuity',
      requiresToolSynthesis: 'repair.continuity',
      requireExactFileReferences: 'repair.continuity',
      expectedContextPressure: 'repair.continuity',
      preferredAnswerPath: 'repair.continuity',
      simpleVsComplex: 'repair.continuity',
      entities: {
        ...(decision.provenance?.entities ?? {}),
        path: 'repair.continuity',
      },
    },
    entities: {
      ...decision.entities,
      path: artifact.path,
    },
  };
}

function resolveRecentArtifactReference(
  input: IntentGatewayInput,
): { kind: 'file'; path: string; source?: string; codeSessionId?: string } | null {
  const artifacts = input.continuity?.recentArtifacts
    ?.filter((artifact) => artifact.kind === 'file' && artifact.path.trim().length > 0)
    ?? [];
  if (artifacts.length === 0) {
    return null;
  }
  const content = input.content.trim();
  if (!looksLikeRecentArtifactReadRequest(content)) {
    return null;
  }
  const normalizedContent = normalizeArtifactReferenceText(content);
  const matches = artifacts.filter((artifact) => {
    const normalizedPath = normalizeArtifactReferenceText(artifact.path);
    const basename = normalizedPath.split('/').pop() ?? normalizedPath;
    return normalizedContent.includes(normalizedPath)
      || (!!basename && normalizedContent.includes(basename));
  });
  if (matches.length !== 1) {
    return null;
  }
  const [match] = matches;
  if (!match) {
    return null;
  }
  return {
    kind: 'file',
    path: match.path,
    ...(match.source ? { source: match.source } : {}),
    ...(match.codeSessionId ? { codeSessionId: match.codeSessionId } : {}),
  };
}

function looksLikeRecentArtifactReadRequest(content: string): boolean {
  const normalized = content.trim().toLowerCase();
  if (!normalized) {
    return false;
  }
  if (/\b(?:edit|change|modify|update|fix|patch|write|add|remove|delete|replace|overwrite)\b/.test(normalized)) {
    return false;
  }
  return /\b(?:show|read|display|open|view|cat|print|paste|quote|excerpt|inspect)\b/.test(normalized)
    && /\b(?:code|content|file|html|css|js|ts|tsx|jsx|json|md|markdown|created|changed|just\s+created|just\s+changed)\b/.test(normalized);
}

function normalizeArtifactReferenceText(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\\/g, '/')
    .replace(/`/g, '');
}

function repairUnavailableCodeSessionWork(
  input: IntentGatewayInput,
  decision: IntentGatewayDecision,
): IntentGatewayDecision | null {
  const normalized = input.content.trim().toLowerCase();
  if (!normalized) return null;
  const inferredFilesystemOperation = hasExplicitRepoPathReference(normalized)
    ? inferExplicitFilesystemTaskOperation(normalized, decision.operation)
    : null;
  const inferredCodingOperation = inferredFilesystemOperation
    ?? inferExplicitCodingTaskOperation(normalized, decision.operation);
  const isFreshExplicitWork = isFreshExplicitCodeSessionWorkRequest(
    input,
    inferredFilesystemOperation,
    inferredCodingOperation,
  );
  if (
    asksNotToResumePriorCodingExecution(normalized)
    && !isFreshExplicitWork
  ) {
    return null;
  }
  const asksForRepoOverview = /\b(?:overview|describe|summari[sz]e|what\s+type|what\s+kind)\b/.test(normalized)
    && /\b(?:repo|repository|codebase|workspace|app|application)\b/.test(normalized);
  const asksWorkspaceSearch = /\b(?:search|find|grep|look\s+for)\b/.test(normalized)
    && /\b(?:workspace|repo|repository|codebase|selected\s+file|file|src|code)\b/.test(normalized);
  const asksToModifySelectedCode = /\b(?:make|update|edit|change|modify|fix|patch|write|add|remove|delete)\b/.test(normalized)
    && /\b(?:selected\s+file|answer|code|file|src|function|component|module)\b/.test(normalized);
  const asksToMutateWorkspaceArtifact = inferredCodingOperation === 'create'
    || inferredCodingOperation === 'update'
    || inferredCodingOperation === 'delete'
    || inferredCodingOperation === 'save';
  if (
    !asksForRepoOverview
    && !asksWorkspaceSearch
    && !asksToModifySelectedCode
    && !asksToMutateWorkspaceArtifact
    && !isExplicitRepoInspectionRequest(input.content)
  ) {
    return null;
  }
  const operation = asksToModifySelectedCode || asksToMutateWorkspaceArtifact
    ? inferredCodingOperation ?? 'update'
    : asksWorkspaceSearch
      ? 'search'
      : inferredCodingOperation ?? 'inspect';
  return {
    ...decision,
    route: 'coding_task',
    confidence: 'low',
    operation,
    plannedSteps: shouldDropIncompatibleCodeSessionPlannedSteps(decision, operation)
      ? []
      : decision.plannedSteps,
    summary: asksToModifySelectedCode || asksToMutateWorkspaceArtifact
      ? 'Continue the requested edit in the active coding workspace.'
      : 'Inspect the active coding workspace and answer from repo evidence.',
    turnRelation: isFreshExplicitWork ? 'new_request' : 'follow_up',
    resolution: 'ready',
    missingFields: [],
    resolvedContent: input.content,
    executionClass: 'repo_grounded',
    preferredTier: 'external',
    requiresRepoGrounding: true,
    requiresToolSynthesis: true,
    requireExactFileReferences: false,
    expectedContextPressure: 'medium',
    preferredAnswerPath: 'chat_synthesis',
    simpleVsComplex: 'complex',
    provenance: {
      ...(decision.provenance ?? {}),
      route: isFreshExplicitWork ? 'repair.structured' : 'repair.continuity',
      operation: isFreshExplicitWork ? 'repair.structured' : 'repair.continuity',
      executionClass: 'repair.continuity',
      requiresRepoGrounding: 'repair.continuity',
      requiresToolSynthesis: 'repair.continuity',
      preferredAnswerPath: 'repair.continuity',
    },
  };
}

function asksNotToResumePriorCodingExecution(normalized: string): boolean {
  return /\b(?:do\s+not|don't|dont)\s+resume\b/.test(normalized)
    || /\btreat\s+this\s+as\s+a\s+fresh\b/.test(normalized)
    || /\bfresh\s+bounded\s+coding\s+step\b/.test(normalized)
    || /\bfresh\s+planning\s+request\b/.test(normalized);
}

function hasExplicitExecutionContinuationRequest(content: string): boolean {
  const normalized = content.trim().toLowerCase();
  if (!normalized) return false;
  return /\b(?:continue|resume|retry|rerun|try\s+again|pick\s+(?:it\s+)?back\s+up|carry\s+on|keep\s+going)\b/.test(normalized)
    || /\b(?:where|when)\s+(?:you|it)\s+left\s+off\b/.test(normalized)
    || /\bfrom\s+(?:where\s+)?(?:you|it)\s+left\s+off\b/.test(normalized)
    || /\b(?:timed\s*out|timeout|failed)\b.{0,120}\b(?:continue|resume|retry|get\s+.+?\s+running|finish)\b/.test(normalized)
    || /\b(?:continue|resume|retry|get\s+.+?\s+running|finish)\b.{0,120}\b(?:timed\s*out|timeout|failed|left\s+off)\b/.test(normalized);
}

function isFreshExplicitCodeSessionWorkRequest(
  input: IntentGatewayInput,
  filesystemOperation: IntentGatewayDecision['operation'] | null,
  codingOperation: IntentGatewayDecision['operation'] | null,
): boolean {
  const operation = filesystemOperation ?? codingOperation;
  if (!operation || operation === 'unknown') return false;
  if (filesystemOperation) return true;
  if (isExplicitWorkspaceScopedRepoWorkRequest(input.content)) return true;
  return isExplicitRepoInspectionRequest(input.content);
}

function shouldDropIncompatibleCodeSessionPlannedSteps(
  decision: IntentGatewayDecision,
  operation: IntentGatewayDecision['operation'],
): boolean {
  if (!decision.plannedSteps?.length) return false;
  if (operation !== 'create' && operation !== 'update' && operation !== 'delete' && operation !== 'save') {
    return false;
  }
  return decision.plannedSteps.some((step) => (
    step.expectedToolCategories?.some((category) => {
      const normalized = category.trim().toLowerCase();
      return normalized === 'web_search' || normalized === 'browser';
    }) === true
  ));
}

function repairCodeSessionGroundingDecision(
  input: IntentGatewayInput,
  decision: IntentGatewayDecision,
): IntentGatewayDecision {
  if (!hasActiveCodeSessionContinuity(input)) {
    return decision;
  }
  if (decision.route === 'coding_task') {
    return repairUnavailableCodeSessionWork(input, decision) ?? decision;
  }
  if (
    decision.route !== 'search_task'
    && decision.route !== 'general_assistant'
    && decision.route !== 'unknown'
  ) {
    return decision;
  }
  return repairUnavailableCodeSessionWork(input, decision) ?? decision;
}

function hasActiveCodeSessionContinuity(input: IntentGatewayInput): boolean {
  return input.continuity?.activeExecutionRefs?.some((ref) => ref.startsWith('code_session:')) ?? false;
}

function looksLikeDirectContextQuestion(content: string): boolean {
  const normalized = content.trim().toLowerCase();
  if (!normalized) return false;
  return normalized.endsWith('?') || /^(?:yeah|yes|ok|okay|but|so)\b/.test(normalized);
}

function hasSubstantiveCurrentTurnForDirectFallback(content: string): boolean {
  const trimmed = content.trim();
  if (!trimmed) {
    return false;
  }
  const wordCount = trimmed.split(/\s+/).filter(Boolean).length;
  return wordCount >= 8 || trimmed.length >= 72;
}

function hasConversationContextForDirectFallback(input: IntentGatewayInput): boolean {
  if (!hasContinuityAnchor(input)) {
    return false;
  }
  if (input.continuity?.lastActionableRequest || input.continuity?.focusSummary) {
    return true;
  }
  return (input.recentHistory ?? []).some((entry) => entry.role === 'assistant' && entry.content.trim().length > 0);
}

function applyUnknownRouteClarificationGuard(
  input: IntentGatewayInput,
  decision: IntentGatewayDecision,
): IntentGatewayDecision {
  if (decision.route !== 'unknown') {
    return decision;
  }
  const missingFields = new Set(decision.missingFields);
  missingFields.add('intent_route');
  return {
    ...decision,
    summary: buildUnknownRouteClarificationPrompt(input, decision),
    resolution: 'needs_clarification',
    missingFields: [...missingFields],
    executionClass: 'direct_assistant',
    preferredTier: 'local',
    requiresRepoGrounding: false,
    requiresToolSynthesis: false,
    requireExactFileReferences: false,
    expectedContextPressure: 'low',
    preferredAnswerPath: 'direct',
    simpleVsComplex: 'simple',
  };
}

function buildUnknownRouteClarificationPrompt(
  input: IntentGatewayInput,
  decision: IntentGatewayDecision,
): string {
  const pendingPrompt = input.pendingAction?.field === 'intent_route'
    ? input.pendingAction.prompt?.trim()
    : '';
  if (pendingPrompt) {
    return pendingPrompt;
  }
  if (decision.summary.trim().endsWith('?')) {
    return decision.summary.trim();
  }
  return 'I am not sure what you want me to do. Could you clarify the request?';
}

function shouldClarifyMissingRepairedSearchTarget(decision: IntentGatewayDecision): boolean {
  if (decision.resolution !== 'ready') {
    return false;
  }
  if (decision.provenance?.route !== 'repair.structured') {
    return false;
  }
  if (!hasSearchPlannedStep(decision) && decision.operation !== 'search') {
    return false;
  }
  if (decision.operation !== 'search' && !hasWebSearchPlannedStep(decision)) {
    return false;
  }
  return !hasConcreteSearchTarget(decision);
}

function hasSearchPlannedStep(decision: IntentGatewayDecision): boolean {
  return (decision.plannedSteps ?? []).some((step) => (
    step.kind === 'search'
    || (step.expectedToolCategories ?? []).some((category) => {
      const normalized = category.trim().toLowerCase();
      return normalized === 'search'
        || normalized === 'web_search';
    })
  ));
}

function hasWebSearchPlannedStep(decision: IntentGatewayDecision): boolean {
  return (decision.plannedSteps ?? []).some((step) =>
    (step.expectedToolCategories ?? []).some((category) => category.trim().toLowerCase() === 'web_search'));
}

function hasConcreteSearchTarget(decision: IntentGatewayDecision): boolean {
  const entities = decision.entities;
  return !!(
    entities.query
    || (entities.urls && entities.urls.length > 0)
    || entities.path
    || entities.searchSourceId
    || entities.searchSourceName
  );
}

function buildMissingRepairedSearchTargetPrompt(
  input: IntentGatewayInput,
  decision: IntentGatewayDecision,
): string {
  const hasWebSearchPlan = hasWebSearchPlannedStep(decision);
  if (hasWebSearchPlan) {
    return 'What should I search the web for? A topic, question, or website category is enough.';
  }
  const hasRecentHistory = (input.recentHistory ?? []).length > 0
    || !!input.continuity?.lastActionableRequest
    || !!input.continuity?.focusSummary;
  if (hasRecentHistory) {
    return 'I am not sure what to search for from the previous request. What useful information should I bring back?';
  }
  return 'What should I search for? A topic, question, file, or source is enough.';
}

function hasExtractableSearchQuery(content: string): boolean {
  const normalized = content
    .toLowerCase()
    .replace(/^\[context:[^\]]+\]\s*/i, '')
    .replace(/[^a-z0-9_.@/-]+/g, ' ')
    .trim();
  if (!normalized) return false;
  const stopWords = new Set([
    'search',
    'find',
    'grep',
    'look',
    'for',
    'the',
    'this',
    'that',
    'workspace',
    'repo',
    'repository',
    'codebase',
    'tell',
    'me',
    'where',
    'is',
    'it',
    'defined',
    'give',
    'brief',
    'slow',
    'summary',
    'summarize',
  ]);
  return normalized
    .split(/\s+/)
    .some((token) => token.length >= 3 && !stopWords.has(token));
}

function repairMissingFieldClarificationPrompt(
  input: IntentGatewayInput,
  decision: IntentGatewayDecision,
): IntentGatewayDecision {
  if (decision.resolution !== 'needs_clarification') {
    return decision;
  }
  const missingFields = new Set(decision.missingFields.map((field) => field.trim().toLowerCase()));
  if (!missingFields.has('url') && !missingFields.has('urls')) {
    return decision;
  }
  if (decision.route !== 'browser_task' && decision.route !== 'search_task') {
    return decision;
  }
  return {
    ...decision,
    summary: buildMissingUrlClarificationPrompt(input, decision),
  };
}

function buildMissingUrlClarificationPrompt(
  input: IntentGatewayInput,
  decision: IntentGatewayDecision,
): string {
  const hasRecentHistory = (input.recentHistory ?? []).length > 0
    || !!input.continuity?.lastActionableRequest
    || !!input.continuity?.focusSummary
    || (input.continuity?.activeExecutionRefs?.length ?? 0) > 0;
  const wantsSummary = /\b(?:summari[sz]e|summary|full\s+contents?|contents?|fetch|read)\b/i.test(input.content)
    || decision.operation === 'read';
  if (hasRecentHistory && wantsSummary) {
    return 'Which page should I fetch and summarize? Paste the URL or name one of the sources from the previous results.';
  }
  if (wantsSummary) {
    return 'Which page should I fetch and summarize? Paste the URL or name the source.';
  }
  return 'Which page or URL should I open?';
}

function shouldClarifyUncertainRepairedRoute(
  input: IntentGatewayInput,
  decision: IntentGatewayDecision,
): boolean {
  if (
    input.pendingAction
    && (decision.turnRelation === 'clarification_answer' || decision.turnRelation === 'correction')
  ) {
    return false;
  }
  if (decision.resolution !== 'ready' || decision.confidence !== 'low') {
    return false;
  }
  if (decision.route === 'unknown' || decision.route === 'general_assistant') {
    return false;
  }
  if (decision.operation !== 'unknown' || decision.turnRelation !== 'new_request') {
    return false;
  }
  if (hasConcreteExecutionTarget(decision)) {
    return false;
  }
  return decision.provenance?.route === 'repair.structured';
}

function hasConcreteExecutionTarget(decision: IntentGatewayDecision): boolean {
  const entities = decision.entities;
  return !!(
    entities.automationName
    || entities.newAutomationName
    || entities.uiSurface
    || (entities.urls && entities.urls.length > 0)
    || entities.query
    || entities.path
    || entities.sessionTarget
    || entities.codeSessionResource
    || entities.emailProvider
    || entities.calendarTarget
    || entities.codingBackend
    || entities.command
    || entities.searchSourceId
    || entities.searchSourceName
    || entities.toolName
  );
}

function buildUncertainRepairedRoutePrompt(
  input: IntentGatewayInput,
): string {
  const hasRecentHistory = (input.recentHistory ?? []).length > 0
    || !!input.continuity?.lastActionableRequest
    || !!input.continuity?.focusSummary;
  if (hasRecentHistory) {
    return 'I am not sure how this relates to the previous request. What do you want me to do next, and what useful information should I bring back?';
  }
  return 'I am not sure which task you want me to perform. What should I do, and what useful information should I bring back?';
}

interface CodeSessionCreateDirective {
  title?: string;
  workspaceRoot: string;
  attach: boolean;
}

function parseCodeSessionCreateDirective(content: string | undefined): CodeSessionCreateDirective | null {
  const raw = content?.trim() ?? '';
  if (!raw) return null;
  const normalized = raw.toLowerCase();
  if (!/\b(?:create|new|start)\b[^.!?\n]{0,80}\b(?:coding\s+)?session\b/.test(normalized)) {
    return null;
  }
  if (isExplicitWorkspaceAppBuildRequest(raw)) {
    return null;
  }
  const workspaceRoot = extractCodeSessionCreateWorkspaceRoot(raw);
  if (!workspaceRoot) {
    return null;
  }
  const title = extractCodeSessionCreateTitle(raw);
  return {
    workspaceRoot,
    ...(title ? { title } : {}),
    attach: /\battach\b/i.test(raw) || /\bcurrent\s+(?:coding\s+)?workspace\b/i.test(raw),
  };
}

function buildCodeSessionCreateControlDecision(
  directive: CodeSessionCreateDirective,
): Record<string, unknown> {
  return {
    route: 'coding_session_control',
    confidence: 'high',
    operation: 'create',
    summary: directive.title
      ? `Create and attach coding session "${directive.title}".`
      : 'Create and attach a coding session.',
    turnRelation: 'new_request',
    resolution: 'ready',
    missingFields: [],
    executionClass: 'tool_orchestration',
    preferredTier: 'local',
    requiresRepoGrounding: false,
    requiresToolSynthesis: false,
    requireExactFileReferences: false,
    expectedContextPressure: 'low',
    preferredAnswerPath: 'direct',
    simpleVsComplex: 'simple',
    path: directive.workspaceRoot,
    ...(directive.title ? { sessionTarget: directive.title } : {}),
    codeSessionResource: 'session',
  };
}

function buildCodingBackendResumeDecision(content: string | undefined): Record<string, unknown> {
  const codingBackend = inferExplicitCodingBackendResumeBackend(content);
  return {
    route: 'coding_task',
    confidence: 'high',
    operation: 'update',
    summary: 'Resume the latest coding backend run in the active coding workspace.',
    turnRelation: 'follow_up',
    resolution: 'ready',
    missingFields: [],
    executionClass: 'repo_grounded',
    preferredTier: 'external',
    requiresRepoGrounding: true,
    requiresToolSynthesis: true,
    requireExactFileReferences: false,
    expectedContextPressure: 'high',
    preferredAnswerPath: 'chat_synthesis',
    simpleVsComplex: 'complex',
    codingBackendRequested: true,
    codingBackendResumeRequested: true,
    ...(codingBackend ? { codingBackend } : {}),
  };
}

function buildExplicitCodingBackendDelegationDecision(content: string | undefined): Record<string, unknown> | null {
  const rawContent = content?.trim() ?? '';
  if (!rawContent) return null;
  const explicitBackend = inferExplicitCodingBackendRequest(
    rawContent,
    rawContent.toLowerCase(),
    'unknown',
  );
  if (!explicitBackend) return null;
  if (explicitBackend.codingBackend !== 'codex-sdk') return null;
  const operation = explicitBackend.operation === 'unknown' ? 'run' : explicitBackend.operation;
  const isWriteOperation = operation === 'create'
    || operation === 'update'
    || operation === 'delete'
    || operation === 'save';
  const isRunOperation = operation === 'run';
  return {
    route: 'coding_task',
    confidence: 'high',
    operation,
    summary: 'Delegate the requested coding workspace task to the selected coding backend.',
    turnRelation: 'new_request',
    resolution: 'ready',
    missingFields: [],
    executionClass: 'repo_grounded',
    preferredTier: 'external',
    requiresRepoGrounding: true,
    requiresToolSynthesis: true,
    requireExactFileReferences: false,
    expectedContextPressure: isWriteOperation || isRunOperation ? 'high' : 'medium',
    preferredAnswerPath: 'tool_loop',
    simpleVsComplex: isWriteOperation || isRunOperation ? 'complex' : 'simple',
    plannedSteps: buildCodingBackendDelegationPlannedSteps(operation),
    codingBackend: explicitBackend.codingBackend,
    codingBackendRequested: true,
    ...(explicitBackend.sessionTarget ? { sessionTarget: explicitBackend.sessionTarget } : {}),
  };
}

function buildCodingBackendDelegationPlannedSteps(
  operation: IntentGatewayDecision['operation'],
): NonNullable<IntentGatewayDecision['plannedSteps']> {
  if (operation === 'create' || operation === 'update' || operation === 'delete' || operation === 'save') {
    return [
      {
        kind: 'read',
        summary: 'Inspect the current workspace context before changing files.',
        required: true,
        expectedToolCategories: ['read', 'repo_inspect'],
      },
      {
        kind: 'write',
        summary: 'Apply the requested workspace change through the selected coding backend.',
        required: true,
        dependsOn: ['step_1'],
        expectedToolCategories: ['coding_backend', 'repo_mutation'],
      },
      {
        kind: 'answer',
        summary: 'Report the coding backend result and verification evidence.',
        required: true,
        dependsOn: ['step_2'],
        expectedToolCategories: ['answer'],
      },
    ];
  }
  if (operation === 'run') {
    return [
      {
        kind: 'tool_call',
        summary: 'Run the requested coding backend task in the active workspace.',
        required: true,
        expectedToolCategories: ['coding_backend'],
      },
      {
        kind: 'answer',
        summary: 'Report the coding backend result.',
        required: true,
        dependsOn: ['step_1'],
        expectedToolCategories: ['answer'],
      },
    ];
  }
  return [
    {
      kind: 'read',
      summary: 'Inspect the workspace through the selected coding backend.',
      required: true,
      expectedToolCategories: ['coding_backend', 'repo_inspect'],
    },
    {
      kind: 'answer',
      summary: 'Report the coding backend findings and recommended next step.',
      required: true,
      dependsOn: ['step_1'],
      expectedToolCategories: ['answer'],
    },
  ];
}

function repairCodeSessionCreateControlDecision(
  input: IntentGatewayInput,
  decision: IntentGatewayDecision,
): IntentGatewayDecision {
  const directive = parseCodeSessionCreateDirective(input.content);
  if (!directive) {
    return decision;
  }
  if (decision.route === 'security_task') {
    return decision;
  }
  const normalized = normalizeIntentGatewayDecision(
    buildCodeSessionCreateControlDecision(directive),
    {
      sourceContent: input.content,
      recentHistory: input.recentHistory,
      pendingAction: input.pendingAction,
      continuity: input.continuity,
    },
    { classifierSource: 'repair.structured' },
  );
  return {
    ...normalized,
    provenance: {
      ...(normalized.provenance ?? {}),
      route: 'repair.structured',
      operation: 'repair.structured',
      executionClass: 'repair.structured',
      preferredAnswerPath: 'repair.structured',
      requiresRepoGrounding: 'repair.structured',
      requiresToolSynthesis: 'repair.structured',
    },
  };
}

function repairCodingBackendResumeDecision(
  input: IntentGatewayInput,
  decision: IntentGatewayDecision,
): IntentGatewayDecision {
  if (!isExplicitCodingBackendResumeRequest(input.content)) {
    return decision;
  }
  if (decision.route === 'security_task') {
    return decision;
  }
  const normalized = normalizeIntentGatewayDecision(
    buildCodingBackendResumeDecision(input.content),
    {
      sourceContent: input.content,
      recentHistory: input.recentHistory,
      pendingAction: input.pendingAction,
      continuity: input.continuity,
    },
    { classifierSource: 'repair.structured' },
  );
  return {
    ...normalized,
    provenance: {
      ...(normalized.provenance ?? {}),
      route: 'repair.structured',
      operation: 'repair.structured',
      executionClass: 'repair.structured',
      preferredTier: 'repair.structured',
      requiresRepoGrounding: 'repair.structured',
      requiresToolSynthesis: 'repair.structured',
      requireExactFileReferences: 'repair.structured',
      expectedContextPressure: 'repair.structured',
      preferredAnswerPath: 'repair.structured',
      simpleVsComplex: 'repair.structured',
    },
  };
}

function extractCodeSessionCreateWorkspaceRoot(content: string): string | undefined {
  const quoted = content.match(/\b(?:for|at|in)\s+["'`]([^"'`]+)["'`]/i)?.[1];
  const windows = quoted ?? content.match(/\b(?:for|at|in)\s+([A-Za-z]:\\.+?)(?=\s+(?:and\s+)?(?:attach|as\s+the|use|switch)\b|[.!?]?$|$)/i)?.[1];
  const unix = windows ?? content.match(/\b(?:for|at|in)\s+((?:\/|~\/|\.{1,2}[\\/]).+?)(?=\s+(?:and\s+)?(?:attach|as\s+the|use|switch)\b|[.!?]?$|$)/i)?.[1];
  return cleanCodeSessionCreateValue(unix);
}

function extractCodeSessionCreateTitle(content: string): string | undefined {
  const named = content.match(/\b(?:named|called)\s+(.+?)\s+(?:for|at|in)\s+(?=["'`]*[A-Za-z]:\\|["'`]*(?:\/|~\/|\.{1,2}[\\/]))/i)?.[1]
    ?? content.match(/\b(?:named|called)\s+["'`]([^"'`]+)["'`]/i)?.[1];
  return cleanCodeSessionCreateValue(named);
}

function cleanCodeSessionCreateValue(value: string | undefined): string | undefined {
  const cleaned = value
    ?.trim()
    .replace(/^["'`]+|["'`]+$/g, '')
    .replace(/[.?!,;:]+$/g, '')
    .trim();
  return cleaned || undefined;
}

function repairEmailProviderDecisionIfNeeded(
  input: IntentGatewayInput,
  decision: IntentGatewayDecision,
): IntentGatewayDecision {
  if (decision.route !== 'email_task') {
    return decision;
  }

  const enabledProviders = new Set(
    (input.enabledManagedProviders ?? [])
      .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
      .map((value) => value.trim().toLowerCase()),
  );
  const hasGoogleWorkspace = enabledProviders.has('gws');
  const hasMicrosoft365 = enabledProviders.has('m365');
  const hasBothMailProviders = hasGoogleWorkspace && hasMicrosoft365;

  if (!hasGoogleWorkspace && !hasMicrosoft365) {
    return decision;
  }

  if (hasBothMailProviders && getAmbiguousEmailProviderClarification(input.content, enabledProviders)) {
    const missingFields = new Set(decision.missingFields);
    missingFields.add('email_provider');
    const { emailProvider: _emailProvider, ...entities } = decision.entities;
    const { emailProvider: _emailProviderSource, ...entityProvenance } = decision.provenance?.entities ?? {};
    return {
      ...decision,
      resolution: 'needs_clarification',
      missingFields: [...missingFields],
      entities,
      provenance: {
        ...(decision.provenance ?? {}),
        entities: entityProvenance,
      },
    };
  }

  if (decision.entities.emailProvider) {
    return decision;
  }

  const emailProvider = hasMicrosoft365 ? 'm365' : 'gws';
  return {
    ...decision,
    provenance: {
      ...(decision.provenance ?? {}),
      entities: {
        ...(decision.provenance?.entities ?? {}),
        emailProvider: decision.provenance?.entities?.emailProvider ?? 'resolver.email',
      },
    },
    entities: {
      ...decision.entities,
      emailProvider,
    },
  };
}

function resolveSatisfiedClarificationIfNeeded(
  input: IntentGatewayInput,
  decision: IntentGatewayDecision,
): IntentGatewayDecision {
  const pendingAction = input.pendingAction;
  if (!pendingAction || pendingAction.blockerKind !== 'clarification') {
    return decision;
  }
  const satisfiedField = readSatisfiedClarificationField(decision, pendingAction, pendingAction.field);
  if (!satisfiedField) {
    return decision;
  }
  const missingFields = decision.missingFields.filter((field) => field !== satisfiedField);
  const resolvedContent = decision.resolvedContent
    ?? buildSatisfiedClarificationResolvedContent(decision, pendingAction.originalRequest, satisfiedField);
  return {
    ...decision,
    turnRelation: decision.turnRelation === 'correction' ? 'correction' : 'clarification_answer',
    resolution: 'ready',
    missingFields,
    ...(resolvedContent ? { resolvedContent } : {}),
    provenance: {
      ...(decision.provenance ?? {}),
      ...(resolvedContent
        ? {
            resolvedContent: decision.provenance?.resolvedContent ?? 'resolver.clarification',
          }
        : {}),
    },
  };
}

function readSatisfiedClarificationField(
  decision: IntentGatewayDecision,
  pendingAction: NonNullable<IntentGatewayInput['pendingAction']>,
  field: string | undefined,
): string | null {
  switch (field?.trim()) {
    case 'email_provider':
      return decision.entities.emailProvider ? 'email_provider' : null;
    case 'coding_backend':
      return decision.entities.codingBackend ? 'coding_backend' : null;
    case 'automation_name':
      return decision.entities.automationName?.trim() ? 'automation_name' : null;
    case 'session_target':
      return decision.entities.sessionTarget?.trim() ? 'session_target' : null;
    case 'path':
      return decision.entities.path?.trim() ? 'path' : null;
    case 'url':
    case 'urls':
      return decision.entities.urls?.some((url) => url.trim()) ? field.trim() : null;
    case 'intent_route':
      return hasSatisfiedIntentRouteClarification(decision, pendingAction) ? 'intent_route' : null;
    default:
      return null;
  }
}

function buildSatisfiedClarificationResolvedContent(
  decision: IntentGatewayDecision,
  originalRequest: string,
  field: string,
): string | undefined {
  const original = originalRequest.trim();
  if (!original) return undefined;
  switch (field) {
    case 'email_provider': {
      const providerLabel = decision.entities.emailProvider === 'm365'
        ? 'Outlook / Microsoft 365'
        : decision.entities.emailProvider === 'gws'
          ? 'Gmail / Google Workspace'
          : '';
      return providerLabel ? `Use ${providerLabel} for this request: ${original}` : undefined;
    }
    case 'coding_backend': {
      const backendLabel = formatCodingBackendLabel(decision.entities.codingBackend);
      return backendLabel ? `Use ${backendLabel} for this request: ${original}` : undefined;
    }
    case 'automation_name':
      return original;
    case 'session_target':
      return `Use ${decision.entities.sessionTarget} for this request: ${original}`;
    case 'path':
      return decision.entities.path?.trim()
        ? `Use path ${decision.entities.path.trim()} for this request: ${original}`
        : original;
    case 'url':
    case 'urls': {
      const url = decision.entities.urls?.find((candidate) => candidate.trim());
      return url ? `Use URL ${url.trim()} for this request: ${original}` : original;
    }
    case 'intent_route':
      return original;
    default:
      return undefined;
  }
}

function applyIntentRouteClarificationGuard(
  input: IntentGatewayInput,
  record: IntentGatewayRecord,
  decision: IntentGatewayDecision,
): IntentGatewayDecision {
  const clarification = deriveIntentRouteClarification({
    content: input.content,
    decision,
    mode: record.mode,
  });
  if (!clarification) {
    return decision;
  }
  const missingFields = new Set(decision.missingFields);
  missingFields.add('intent_route');
  return {
    ...decision,
    confidence: decision.confidence === 'high' ? 'medium' : decision.confidence,
    resolution: 'needs_clarification',
    missingFields: [...missingFields],
    summary: clarification.prompt,
  };
}

function hasSatisfiedIntentRouteClarification(
  decision: IntentGatewayDecision,
  pendingAction: NonNullable<IntentGatewayInput['pendingAction']>,
): boolean {
  const candidates = readIntentRouteCandidatesFromPendingAction(pendingAction);
  if (candidates.length === 0) {
    return (decision.turnRelation === 'clarification_answer' || decision.turnRelation === 'correction')
      && decision.resolution === 'ready'
      && decision.route !== 'unknown';
  }
  return candidates.includes(decision.route);
}

function readIntentRouteCandidatesFromPendingAction(
  pendingAction: NonNullable<IntentGatewayInput['pendingAction']>,
): IntentGatewayDecision['route'][] {
  const rawCandidates = pendingAction.entities?.intentRouteCandidates;
  if (!Array.isArray(rawCandidates)) {
    return [];
  }
  return [...new Set(
    rawCandidates
      .map((value) => normalizeRoute(value))
      .filter((value): value is IntentGatewayDecision['route'] => value !== 'unknown'),
  )];
}

function formatCodingBackendLabel(value: string | undefined): string {
  switch (value?.trim()) {
    case 'codex':
      return 'Codex';
    case 'codex-sdk':
      return 'Codex SDK';
    case 'claude-code':
      return 'Claude Code';
    case 'gemini-cli':
      return 'Gemini CLI';
    case 'aider':
      return 'Aider';
    default:
      return value?.trim() ?? '';
  }
}

const CODE_SESSION_REMOVE_CLARIFICATION_PROMPT_PATTERN = /(?:which|what)\s+(?:coding\s+)?session\s+should\s+i\s+remove(?:\s+to\s+make\s+room)?|session\s+creation\s+failed[^]*?\bsessions?\s+\(the\s+maximum\)|already\s+have\s+\d+\s+sessions?\s+\(the\s+maximum\)/i;
const CODE_SESSION_REMOVE_VERB_PATTERN = /^(?:please\s+)?(?:remove|delete|drop|discard)\s+(?:the\s+)?/i;
const CODE_SESSION_CONTROL_VERB_PATTERN = /\b(?:detach|disconnect|leave|delete|remove|switch|attach|connect|create|list|show|inspect|current|active)\b/i;

function inferCodeSessionRemovalClarificationAnswer(
  input: IntentGatewayInput,
): string | null {
  const context = readCodeSessionRemovalClarificationContext(input);
  if (!context) {
    return null;
  }
  return readCodeSessionRemovalAnswerFromPendingOptions(input.content, input.pendingAction)
    ?? readCodeSessionRemovalAnswerName(input.content)
    ?? null;
}

function repairCodeSessionClarificationFromRecentHistory(
  input: IntentGatewayInput,
  decision: IntentGatewayDecision,
): IntentGatewayDecision {
  if (decision.turnRelation === 'correction') {
    return decision;
  }
  if (
    decision.route === 'coding_session_control'
    && decision.turnRelation === 'clarification_answer'
    && decision.operation !== 'unknown'
    && decision.entities.sessionTarget?.trim()
  ) {
    return decision;
  }

  const context = readCodeSessionRemovalClarificationContext(input);
  if (!context) {
    return decision;
  }
  const sessionTarget = decision.entities.sessionTarget?.trim()
    || readCodeSessionRemovalAnswerFromPendingOptions(input.content, input.pendingAction)
    || readCodeSessionRemovalAnswerName(input.content);
  if (!sessionTarget) {
    return decision;
  }
  const operation = inferCodeSessionControlOperation(input.content.toLowerCase()) ?? 'delete';
  const createDirective = buildCodeSessionCreateDirectiveFromRemovalContext(context);

  return {
    ...decision,
    route: 'coding_session_control',
    operation,
    confidence: decision.confidence === 'low' ? 'medium' : decision.confidence,
    turnRelation: 'clarification_answer',
    resolution: 'ready',
    missingFields: decision.missingFields.filter((field) => field !== 'session_target'),
    executionClass: 'tool_orchestration',
    preferredTier: 'local',
    requiresRepoGrounding: false,
    requiresToolSynthesis: false,
    requireExactFileReferences: false,
    expectedContextPressure: 'low',
    preferredAnswerPath: 'direct',
    simpleVsComplex: 'simple',
    resolvedContent: decision.resolvedContent
      ?? (createDirective
        ? `Remove coding session ${sessionTarget}, then create the requested coding session.`
        : `Remove coding session ${sessionTarget} to make room for the requested session.`),
    entities: {
      ...decision.entities,
      sessionTarget,
      ...(createDirective
        ? {
            path: createDirective.workspaceRoot,
            ...(createDirective.title ? { query: createDirective.title } : {}),
            codeSessionResource: 'session' as const,
          }
        : {}),
    },
    provenance: {
      ...(decision.provenance ?? {}),
      route: decision.provenance?.route ?? 'repair.structured',
      operation: decision.provenance?.operation ?? 'repair.structured',
      resolvedContent: decision.provenance?.resolvedContent ?? 'repair.structured',
      entities: {
        ...(decision.provenance?.entities ?? {}),
        sessionTarget: decision.provenance?.entities?.sessionTarget ?? 'repair.structured',
        ...(createDirective
          ? {
              path: decision.provenance?.entities?.path ?? 'repair.structured',
              ...(createDirective.title ? { query: decision.provenance?.entities?.query ?? 'repair.structured' } : {}),
              codeSessionResource: decision.provenance?.entities?.codeSessionResource ?? 'repair.structured',
            }
          : {}),
      },
    },
  };
}

interface CodeSessionRemovalClarificationContext {
  originalUserRequest?: string;
  workspaceRoot?: string;
  title?: string;
}

function buildCodeSessionCreateDirectiveFromRemovalContext(
  context: CodeSessionRemovalClarificationContext | null,
): CodeSessionCreateDirective | null {
  if (!context) {
    return null;
  }
  if (context.workspaceRoot) {
    return {
      workspaceRoot: context.workspaceRoot,
      ...(context.title ? { title: context.title } : {}),
      attach: true,
    };
  }
  return context.originalUserRequest
    ? parseCodeSessionCreateDirective(context.originalUserRequest)
    : null;
}

function readCodeSessionRemovalClarificationContext(
  input: IntentGatewayInput,
): CodeSessionRemovalClarificationContext | null {
  return readCodeSessionRemovalClarificationContextFromPendingAction(input.pendingAction)
    ?? readCodeSessionRemovalClarificationContextFromHistory(input.recentHistory);
}

function readCodeSessionRemovalClarificationContextFromPendingAction(
  pendingAction: IntentGatewayInput['pendingAction'],
): CodeSessionRemovalClarificationContext | null {
  if (!pendingAction || pendingAction.blockerKind !== 'clarification') {
    return null;
  }
  if (pendingAction.route !== 'coding_session_control') {
    return null;
  }
  const promptLooksRelevant = CODE_SESSION_REMOVE_CLARIFICATION_PROMPT_PATTERN.test(pendingAction.prompt);
  if (pendingAction.field !== 'session_target' && !promptLooksRelevant) {
    return null;
  }
  const workspaceRoot = typeof pendingAction.entities?.path === 'string'
    ? pendingAction.entities.path.trim()
    : '';
  const title = typeof pendingAction.entities?.query === 'string'
    ? pendingAction.entities.query.trim()
    : typeof pendingAction.entities?.sessionTarget === 'string'
      ? pendingAction.entities.sessionTarget.trim()
      : '';
  return {
    ...(pendingAction.originalRequest?.trim() ? { originalUserRequest: pendingAction.originalRequest.trim() } : {}),
    ...(workspaceRoot ? { workspaceRoot } : {}),
    ...(title ? { title } : {}),
  };
}

function readCodeSessionRemovalClarificationContextFromHistory(
  recentHistory: IntentGatewayInput['recentHistory'],
): CodeSessionRemovalClarificationContext | null {
  if (!Array.isArray(recentHistory) || recentHistory.length === 0) {
    return null;
  }
  for (let index = recentHistory.length - 1; index >= 0; index -= 1) {
    const entry = recentHistory[index];
    if (!entry || entry.role !== 'assistant') {
      continue;
    }
    if (!CODE_SESSION_REMOVE_CLARIFICATION_PROMPT_PATTERN.test(entry.content)) {
      continue;
    }
    for (let priorIndex = index - 1; priorIndex >= 0; priorIndex -= 1) {
      const priorEntry = recentHistory[priorIndex];
      if (priorEntry?.role === 'user' && priorEntry.content.trim()) {
        return {
          originalUserRequest: priorEntry.content.trim(),
        };
      }
    }
    return {};
  }
  return null;
}

function readCodeSessionRemovalAnswerName(content: string | undefined): string | undefined {
  const raw = content?.trim() ?? '';
  if (!raw || raw.length > 120) {
    return undefined;
  }
  const cleaned = raw
    .replace(CODE_SESSION_REMOVE_VERB_PATTERN, '')
    .replace(/^["'`]+|["'`]+$/g, '')
    .replace(/[.?!]+$/g, '')
    .trim();
  if (!cleaned) {
    return undefined;
  }
  if (isExplicitCodingSessionControlRequest(cleaned) && !CODE_SESSION_REMOVE_VERB_PATTERN.test(raw)) {
    return undefined;
  }
  if (CODE_SESSION_CONTROL_VERB_PATTERN.test(cleaned)) {
    return undefined;
  }
  return cleaned.split(/\s+/).length <= 12 ? cleaned : undefined;
}

function readCodeSessionRemovalAnswerFromPendingOptions(
  content: string | undefined,
  pendingAction: IntentGatewayInput['pendingAction'],
): string | undefined {
  if (!pendingAction || pendingAction.blockerKind !== 'clarification') {
    return undefined;
  }
  if (pendingAction.route !== 'coding_session_control' || pendingAction.field !== 'session_target') {
    return undefined;
  }
  const normalizedContent = normalizeCodeSessionRemovalOptionText(content);
  if (!normalizedContent) {
    return undefined;
  }
  const options = pendingAction.options ?? [];
  for (const option of options) {
    const value = option.value.trim();
    const label = option.label.trim();
    const normalizedValue = normalizeCodeSessionRemovalOptionText(value);
    const normalizedLabel = normalizeCodeSessionRemovalOptionText(label);
    const normalizedDescription = normalizeCodeSessionRemovalOptionText(option.description);
    const resolvedValue = value || label;
    if (!resolvedValue) {
      continue;
    }
    if ((normalizedValue && normalizedContent === normalizedValue)
      || (normalizedLabel && normalizedContent === normalizedLabel)
      || (normalizedLabel && normalizedContent.includes(normalizedLabel))
      || (normalizedValue && normalizedContent.includes(normalizedValue))
      || (normalizedDescription && normalizedContent.includes(normalizedDescription))) {
      return resolvedValue;
    }
  }
  return undefined;
}

function normalizeCodeSessionRemovalOptionText(content: string | undefined): string {
  return (content ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

const AUTOMATION_NAME_CLARIFICATION_PROMPT_PATTERN = /tell me which automation you want to inspect, run, rename, enable, disable, or edit/i;
const DEICTIC_AUTOMATION_REFERENCE_PATTERN = /\b(?:that|it|the one|just created|new one|newly created|latest|most recent)\b/i;
const AUTOMATION_CONTROL_VERB_PATTERN = /\b(?:disable|enable|run|inspect|show|read|delete|remove|rename|edit|update|change|modify|clone|list)\b/i;

function repairAutomationClarificationFromRecentHistory(
  input: IntentGatewayInput,
  decision: IntentGatewayDecision,
): IntentGatewayDecision {
  const isAutomationControlRoute = decision.route === 'automation_control'
    || (decision.route === 'ui_control' && decision.entities.uiSurface === 'automations');
  if (!isAutomationControlRoute) {
    return decision;
  }
  if (decision.turnRelation === 'correction') {
    return decision;
  }
  if (
    decision.turnRelation === 'clarification_answer'
    && decision.operation !== 'unknown'
    && decision.entities.automationName?.trim()
  ) {
    return decision;
  }

  const clarificationContext = readAutomationNameClarificationContext(input.recentHistory);
  if (!clarificationContext) {
    return decision;
  }

  const repairedOperation = decision.operation === 'unknown'
    ? inferAutomationControlOperation(clarificationContext.originalUserRequest, decision.operation)
    : decision.operation;
  if (repairedOperation === 'unknown') {
    return decision;
  }

  const repairedAutomationName = decision.entities.automationName?.trim()
    || extractExplicitAutomationName(input.content)
    || readAutomationClarificationAnswerName(input.content);
  const enabled = typeof decision.entities.enabled === 'boolean'
    ? decision.entities.enabled
    : inferAutomationEnabledState(clarificationContext.originalUserRequest);

  return {
    ...decision,
    operation: repairedOperation,
    turnRelation: 'clarification_answer',
    resolution: 'ready',
    missingFields: decision.missingFields.filter((field) => field !== 'automation_name'),
    entities: {
      ...decision.entities,
      ...(repairedAutomationName ? { automationName: repairedAutomationName } : {}),
      ...(typeof enabled === 'boolean' ? { enabled } : {}),
    },
    ...(decision.resolvedContent
      ? {}
      : { resolvedContent: clarificationContext.originalUserRequest }),
    provenance: {
      ...(decision.provenance ?? {}),
      ...(decision.resolvedContent
        ? {}
        : { resolvedContent: decision.provenance?.resolvedContent ?? 'resolver.clarification' }),
      entities: {
        ...(decision.provenance?.entities ?? {}),
        ...(repairedAutomationName && !decision.provenance?.entities?.automationName
          ? { automationName: 'repair.automation_name' }
          : {}),
        ...(typeof enabled === 'boolean' && !decision.provenance?.entities?.enabled
          ? { enabled: 'repair.automation_name' }
          : {}),
      },
    },
  };
}

function readAutomationNameClarificationContext(
  recentHistory: IntentGatewayInput['recentHistory'],
): { originalUserRequest: string } | null {
  if (!Array.isArray(recentHistory) || recentHistory.length === 0) {
    return null;
  }
  for (let index = recentHistory.length - 1; index >= 0; index -= 1) {
    const entry = recentHistory[index];
    if (!entry || entry.role !== 'assistant') {
      continue;
    }
    if (!AUTOMATION_NAME_CLARIFICATION_PROMPT_PATTERN.test(entry.content)) {
      continue;
    }
    for (let priorIndex = index - 1; priorIndex >= 0; priorIndex -= 1) {
      const priorEntry = recentHistory[priorIndex];
      if (priorEntry?.role === 'user' && priorEntry.content.trim()) {
        return {
          originalUserRequest: priorEntry.content.trim(),
        };
      }
    }
  }
  return null;
}

function readAutomationClarificationAnswerName(content: string | undefined): string | undefined {
  const raw = content?.trim() ?? '';
  if (!raw) {
    return undefined;
  }
  const cleaned = raw
    .replace(/^["'`]+|["'`]+$/g, '')
    .replace(/[.?!]+$/g, '')
    .trim();
  if (!cleaned) {
    return undefined;
  }
  if (DEICTIC_AUTOMATION_REFERENCE_PATTERN.test(cleaned)) {
    return cleaned;
  }
  if (AUTOMATION_CONTROL_VERB_PATTERN.test(cleaned)) {
    return undefined;
  }
  return cleaned.split(/\s+/).length <= 12 ? cleaned : undefined;
}

export function toIntentGatewayClientMetadata(
  record: IntentGatewayRecord | null | undefined,
): Record<string, unknown> | undefined {
  if (!record) return undefined;
  return {
    mode: record.mode,
    available: record.available,
    model: record.model,
    latencyMs: record.latencyMs,
    ...(record.promptProfile ? { promptProfile: record.promptProfile } : {}),
    route: record.decision.route,
    confidence: record.decision.confidence,
    operation: record.decision.operation,
    summary: record.decision.summary,
    turnRelation: record.decision.turnRelation,
    resolution: record.decision.resolution,
    missingFields: record.decision.missingFields,
    executionClass: record.decision.executionClass,
    preferredTier: record.decision.preferredTier,
    requiresRepoGrounding: record.decision.requiresRepoGrounding,
    requiresToolSynthesis: record.decision.requiresToolSynthesis,
    ...(typeof record.decision.requireExactFileReferences === 'boolean'
      ? { requireExactFileReferences: record.decision.requireExactFileReferences }
      : {}),
    expectedContextPressure: record.decision.expectedContextPressure,
    ...(record.decision.simpleVsComplex ? { simpleVsComplex: record.decision.simpleVsComplex } : {}),
    preferredAnswerPath: record.decision.preferredAnswerPath,
    ...(record.decision.plannedSteps?.length
      ? { plannedSteps: cloneIntentGatewayPlannedSteps(record.decision.plannedSteps) }
      : {}),
    ...(record.decision.provenance ? { provenance: record.decision.provenance } : {}),
    ...(record.decision.resolvedContent ? { resolvedContent: record.decision.resolvedContent } : {}),
    entities: record.decision.entities,
  };
}

export function serializeIntentGatewayRecord(
  record: IntentGatewayRecord,
): Record<string, unknown> {
  return {
    mode: record.mode,
    available: record.available,
    model: record.model,
    latencyMs: record.latencyMs,
    ...(record.promptProfile ? { promptProfile: record.promptProfile } : {}),
    ...(record.rawResponsePreview ? { rawResponsePreview: record.rawResponsePreview } : {}),
    decision: {
      route: record.decision.route,
      confidence: record.decision.confidence,
      operation: record.decision.operation,
      summary: record.decision.summary,
      ...(record.decision.recoveryReason ? { recoveryReason: record.decision.recoveryReason } : {}),
      turnRelation: record.decision.turnRelation,
      resolution: record.decision.resolution,
      missingFields: [...record.decision.missingFields],
      executionClass: record.decision.executionClass,
      preferredTier: record.decision.preferredTier,
      requiresRepoGrounding: record.decision.requiresRepoGrounding,
      requiresToolSynthesis: record.decision.requiresToolSynthesis,
      ...(typeof record.decision.requireExactFileReferences === 'boolean'
        ? { requireExactFileReferences: record.decision.requireExactFileReferences }
        : {}),
      expectedContextPressure: record.decision.expectedContextPressure,
      ...(record.decision.simpleVsComplex ? { simpleVsComplex: record.decision.simpleVsComplex } : {}),
      preferredAnswerPath: record.decision.preferredAnswerPath,
      ...(record.decision.plannedSteps?.length
        ? { plannedSteps: cloneIntentGatewayPlannedSteps(record.decision.plannedSteps) }
        : {}),
      ...(record.decision.provenance ? { provenance: record.decision.provenance } : {}),
      ...(record.decision.resolvedContent ? { resolvedContent: record.decision.resolvedContent } : {}),
      ...record.decision.entities,
    },
  };
}

export function deserializeIntentGatewayRecord(
  value: unknown,
): IntentGatewayRecord | null {
  if (!isRecord(value)) return null;
  if (!isRecord(value.decision)) return null;
  const mode = value.mode === 'json_fallback' || value.mode === 'route_only_fallback'
    || value.mode === 'confirmation'
    ? value.mode
    : 'primary';
  const normalizedDecision = normalizeIntentGatewayDecision(
    value.decision,
    undefined,
    { classifierSource: classifierProvenanceSourceForMode(mode) },
  );
  const normalizedProvenance = normalizeIntentGatewayDecisionProvenance(
    (value.decision as Record<string, unknown>).provenance,
  );
  const serializedResolvedContent = typeof value.decision.resolvedContent === 'string'
    && value.decision.resolvedContent.trim()
    ? value.decision.resolvedContent.trim()
    : undefined;
  return {
    mode,
    available: value.available !== false,
    model: typeof value.model === 'string' && value.model.trim()
      ? value.model
      : 'unknown',
    latencyMs: typeof value.latencyMs === 'number' && Number.isFinite(value.latencyMs)
      ? value.latencyMs
      : 0,
    ...(normalizeIntentGatewayPromptProfile(value.promptProfile)
      ? { promptProfile: normalizeIntentGatewayPromptProfile(value.promptProfile) }
      : {}),
    ...(typeof value.rawResponsePreview === 'string' && value.rawResponsePreview.trim()
      ? { rawResponsePreview: value.rawResponsePreview }
      : {}),
    decision: {
      ...normalizedDecision,
      ...(serializedResolvedContent
        ? { resolvedContent: serializedResolvedContent }
        : {}),
      ...(normalizedProvenance
        ? { provenance: normalizedProvenance }
        : {}),
    },
  };
}

export function attachPreRoutedIntentGatewayMetadata(
  metadata: Record<string, unknown> | undefined,
  record: IntentGatewayRecord | null | undefined,
): Record<string, unknown> | undefined {
  if (!record) return metadata;
  return {
    ...(metadata ?? {}),
    [PRE_ROUTED_INTENT_GATEWAY_METADATA_KEY]: serializeIntentGatewayRecord(record),
  };
}

export function readPreRoutedIntentGatewayMetadata(
  metadata: Record<string, unknown> | undefined,
): IntentGatewayRecord | null {
  if (!metadata) return null;
  return deserializeIntentGatewayRecord(metadata[PRE_ROUTED_INTENT_GATEWAY_METADATA_KEY]);
}

export function detachPreRoutedIntentGatewayMetadata(
  metadata: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  if (!metadata || !(PRE_ROUTED_INTENT_GATEWAY_METADATA_KEY in metadata)) {
    return metadata;
  }
  const { [PRE_ROUTED_INTENT_GATEWAY_METADATA_KEY]: _discarded, ...rest } = metadata;
  return Object.keys(rest).length > 0 ? rest : undefined;
}

export function shouldReusePreRoutedIntentGateway(
  record: IntentGatewayRecord | null | undefined,
): record is IntentGatewayRecord {
  // Preserve any structured gateway decision, including degraded fallback records.
  // Downstream routing layers decide whether a low-confidence route is actionable.
  return !!record;
}

export function shouldReusePreRoutedIntentGatewayForContent(
  record: IntentGatewayRecord | null | undefined,
  originalContent: string | undefined,
  effectiveRoutingContent: string | undefined,
): record is IntentGatewayRecord {
  if (!shouldReusePreRoutedIntentGateway(record)) {
    return false;
  }
  return (originalContent?.trim() ?? '') === (effectiveRoutingContent?.trim() ?? '');
}

export function enrichIntentGatewayRecordWithContentPlan(
  record: IntentGatewayRecord | null | undefined,
  sourceContent: string | undefined,
): IntentGatewayRecord | null {
  if (!record) return null;
  const trimmedSource = sourceContent?.trim();
  if (!trimmedSource) return record;

  const normalized = normalizeIntentGatewayDecision(
    {
      ...record.decision,
      ...record.decision.entities,
      ...(record.decision.plannedSteps?.length
        ? { plannedSteps: cloneIntentGatewayPlannedSteps(record.decision.plannedSteps) }
        : {}),
    } as Record<string, unknown>,
    { sourceContent: trimmedSource },
    { classifierSource: classifierProvenanceSourceForMode(record.mode) },
  );

  const shouldApplyEntityEnrichment = record.decision.route === 'coding_task'
    || record.decision.route === 'coding_session_control';
  const normalizedEntityKeys = Object.keys(normalized.entities ?? {});
  const normalizedEntityProvenanceKeys = Object.keys(normalized.provenance?.entities ?? {});
  const entityEnrichedRecord = shouldApplyEntityEnrichment
    && (normalizedEntityKeys.length > 0 || normalizedEntityProvenanceKeys.length > 0)
    ? {
        ...record,
        decision: {
          ...record.decision,
          entities: {
            ...(record.decision.entities ?? {}),
            ...(normalized.entities ?? {}),
          },
          provenance: {
            ...(record.decision.provenance ?? {}),
            ...(normalizedEntityProvenanceKeys.length > 0
              ? {
                  entities: {
                    ...(record.decision.provenance?.entities ?? {}),
                    ...(normalized.provenance?.entities ?? {}),
                  },
                }
              : {}),
          },
        },
      }
    : record;

  if (hasRequiredWritePlannedStep(entityEnrichedRecord.decision)) return entityEnrichedRecord;
  if (entityEnrichedRecord.decision.plannedSteps?.length) return entityEnrichedRecord;

  if (!hasRequiredWritePlannedStep(normalized) || !normalized.plannedSteps?.length) {
    return entityEnrichedRecord;
  }

  return {
    ...entityEnrichedRecord,
    decision: {
      ...entityEnrichedRecord.decision,
      plannedSteps: cloneIntentGatewayPlannedSteps(normalized.plannedSteps),
      ...(typeof entityEnrichedRecord.decision.requireExactFileReferences === 'boolean'
        ? {}
        : typeof normalized.requireExactFileReferences === 'boolean'
          ? { requireExactFileReferences: normalized.requireExactFileReferences }
          : {}),
      provenance: {
        ...(entityEnrichedRecord.decision.provenance ?? {}),
        ...(typeof entityEnrichedRecord.decision.requireExactFileReferences === 'boolean'
          ? {}
          : normalized.provenance?.requireExactFileReferences
            ? { requireExactFileReferences: normalized.provenance.requireExactFileReferences }
            : {}),
      },
    },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function cloneIntentGatewayPlannedSteps(
  steps: NonNullable<IntentGatewayDecision['plannedSteps']>,
): NonNullable<IntentGatewayDecision['plannedSteps']> {
  return steps.map((step) => ({
    kind: step.kind,
    summary: step.summary,
    ...(step.expectedToolCategories?.length
      ? { expectedToolCategories: [...step.expectedToolCategories] }
      : {}),
    ...(typeof step.required === 'boolean' ? { required: step.required } : {}),
    ...(step.dependsOn?.length ? { dependsOn: [...step.dependsOn] } : {}),
  }));
}

function buildAutomationNameRepairMessages(
  input: IntentGatewayInput,
  decision: IntentGatewayDecision,
): ChatMessage[] {
  const channelLabel = input.channel?.trim() || 'unknown';
  const historySection = Array.isArray(input.recentHistory) && input.recentHistory.length > 0
    ? input.recentHistory
      .slice(-6)
      .map((entry) => `${entry.role}: ${entry.content}`)
      .join('\n')
    : '';
  return [
    {
      role: 'system',
      content: AUTOMATION_NAME_REPAIR_SYSTEM_PROMPT,
    },
    {
      role: 'user',
      content: [
        `Channel: ${channelLabel}`,
        `Route: ${decision.route}`,
        `Operation: ${decision.operation}`,
        'Extract the saved automation name from this request.',
        '',
        historySection ? `Recent history:\n${historySection}` : '',
        input.content.trim(),
      ].join('\n'),
    },
  ];
}

function parseAutomationNameRepair(response: ChatResponse): string | undefined {
  const parsed = parseStructuredToolArguments(response)
    ?? parseStructuredContent(response.content);
  if (!parsed) return undefined;
  const automationName = typeof parsed.automationName === 'string' ? parsed.automationName.trim() : '';
  return automationName || undefined;
}

async function repairAutomationName(
  input: IntentGatewayInput,
  decision: IntentGatewayDecision,
  chat: IntentGatewayChatFn,
): Promise<string | undefined> {
  const explicitName = extractExplicitAutomationName(input.content);
  if (explicitName) {
    return explicitName;
  }
  const followUpHistoryName = readAutomationNameFromRecentHistory(input.recentHistory);
  if (followUpHistoryName) {
    return followUpHistoryName;
  }
  try {
    const response = await chat(buildAutomationNameRepairMessages(input, decision), {
      maxTokens: 80,
      temperature: 0,
      tools: [AUTOMATION_NAME_REPAIR_TOOL],
    });
    return parseAutomationNameRepair(response);
  } catch {
    return undefined;
  }
}

function needsAutomationNameRepair(decision: IntentGatewayDecision): boolean {
  if (decision.entities.automationName?.trim()) return false;
  if (decision.route === 'automation_control' || decision.route === 'automation_output_task') {
    return ['delete', 'toggle', 'run', 'inspect', 'clone', 'update'].includes(decision.operation);
  }
  return decision.route === 'ui_control'
    && decision.entities.uiSurface === 'automations'
    && ['delete', 'toggle', 'run', 'inspect', 'clone', 'update'].includes(decision.operation);
}

function readAutomationNameFromRecentHistory(
  recentHistory: IntentGatewayInput['recentHistory'],
): string | undefined {
  for (let index = (recentHistory?.length ?? 0) - 1; index >= 0; index -= 1) {
    const entry = recentHistory?.[index];
    if (!entry || entry.role !== 'assistant') continue;
    const quoted = [...entry.content.matchAll(/['"`]([^'"`]+)['"`]/g)]
      .map((match) => match[1]?.trim())
      .filter((value): value is string => Boolean(value));
    if (quoted.length > 0) {
      return quoted[quoted.length - 1];
    }
  }
  return undefined;
}
