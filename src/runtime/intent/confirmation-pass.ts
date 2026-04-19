import type { ChatMessage } from '../../llm/types.js';
import { deriveIntentRouteClarification } from './intent-route-clarification.js';
import {
  buildRawResponsePreview,
  parseIntentGatewayDecision,
  parseStructuredContent,
} from './structured-recovery.js';
import { collapseIntentGatewayWhitespace } from './text.js';
import {
  buildIntentGatewayContextSections,
} from './route-classifier.js';
import {
  findExplicitBuiltinToolName,
  INTENT_GATEWAY_CAPABILITY_INVENTORY_PROMPT_LINES,
  resolveRouteForExplicitToolName,
} from './capability-inventory.js';
import {
  isExplicitAutomationAuthoringRequest,
  isExplicitAutomationControlRequest,
  isExplicitAutomationOutputRequest,
} from './entity-resolvers/automation.js';
import {
  isExplicitRemoteSandboxTaskRequest,
} from './entity-resolvers/coding.js';
import {
  isExplicitProviderConfigRequest,
} from './entity-resolvers/provider-config.js';
import {
  isExplicitCodingExecutionRequest,
  isExplicitCodingSessionControlRequest,
  isExplicitRepoInspectionRequest,
  isExplicitRepoPlanningRequest,
  isExplicitWorkspaceScopedRepoWorkRequest,
} from './request-patterns.js';
import type {
  IntentGatewayChatFn,
  IntentGatewayDecision,
  IntentGatewayInput,
  IntentGatewayRecord,
  IntentGatewayRoute,
} from './types.js';

const CONFIRMATION_AUTOMATION_CONTROL_OPERATIONS = new Set([
  'delete',
  'toggle',
  'run',
  'inspect',
  'clone',
  'update',
]);

const INTENT_GATEWAY_CONFIRMATION_SYSTEM_PROMPT = [
  'You are Guardian\'s intent gateway confirmation pass.',
  'A previous pass already returned a structured routing decision, but runtime detected low confidence or capability-surface ambiguity.',
  'Re-check the original request against the candidate routes and capability ownership hints.',
  'If the previous route is correct, keep it.',
  'If it is wrong, return the corrected route, operation, workload metadata, and entities.',
  'If the request is still genuinely ambiguous between top-level routes, do not guess. Return resolution=needs_clarification, missingFields=["intent_route"], lower confidence, and a short clarification question in summary.',
  'Skill names are downstream execution aids. Route the underlying task, not the skill label itself.',
  ...INTENT_GATEWAY_CAPABILITY_INVENTORY_PROMPT_LINES,
  'Return exactly one JSON object and do not explain anything outside that object.',
].join(' ');

type ConfirmationCandidateRoute = Exclude<IntentGatewayRoute, 'unknown'>;

export async function confirmIntentGatewayDecisionIfNeeded(
  input: IntentGatewayInput,
  record: IntentGatewayRecord,
  chat: IntentGatewayChatFn,
): Promise<IntentGatewayRecord> {
  const confirmation = deriveIntentGatewayConfirmationRequest(input, record);
  if (!confirmation) {
    return record;
  }

  const startedAt = Date.now();
  const priorStructuredDecision = readPriorStructuredDecision(record);
  try {
    const response = await chat(buildIntentGatewayConfirmationMessages(input, record, confirmation), {
      maxTokens: 220,
      temperature: 0,
      responseFormat: { type: 'json_object' },
    });
    const parsed = parseIntentGatewayDecision(response, {
      sourceContent: input.content,
      pendingAction: input.pendingAction,
      continuity: input.continuity,
    }, {
      mode: 'confirmation',
    });
    if (!parsed.available || !shouldAdoptConfirmationDecision(record, parsed.decision, priorStructuredDecision)) {
      return record;
    }
    const rawResponsePreview = buildRawResponsePreview(response);
    return {
      mode: 'confirmation',
      available: true,
      model: response.model || 'unknown',
      latencyMs: Math.max(0, Date.now() - startedAt),
      ...(record.promptProfile ? { promptProfile: record.promptProfile } : {}),
      ...(rawResponsePreview ? { rawResponsePreview } : {}),
      decision: parsed.decision,
    };
  } catch {
    return record;
  }
}

function deriveIntentGatewayConfirmationRequest(
  input: IntentGatewayInput,
  record: IntentGatewayRecord,
): { reason: string; candidateRoutes: ConfirmationCandidateRoute[]; explicitToolName?: string } | null {
  const decision = record.decision;
  const priorStructuredDecision = readPriorStructuredDecision(record);
  const rawRequest = input.content.trim();
  const normalizedRequest = collapseIntentGatewayWhitespace(rawRequest);
  const normalizedLower = normalizedRequest.toLowerCase();
  const candidateRoutes = new Set<ConfirmationCandidateRoute>();
  const reasons: string[] = [];

  const clarification = deriveIntentRouteClarification({
    content: rawRequest,
    decision,
    mode: record.mode,
  });
  if (clarification) {
    for (const route of clarification.candidateRoutes) {
      addCandidateRoute(candidateRoutes, route);
    }
    reasons.push('top_level_route_ambiguity');
  }

  const explicitToolName = findExplicitBuiltinToolName(rawRequest);
  const explicitToolRoute = resolveRouteForExplicitToolName(explicitToolName);
  if (explicitToolRoute) {
    addCandidateRoute(candidateRoutes, explicitToolRoute);
    if (explicitToolRoute !== decision.route) {
      reasons.push('explicit_tool_route_mismatch');
    }
  }

  if (isExplicitAutomationAuthoringRequest(rawRequest)) {
    candidateRoutes.add('automation_authoring');
  }
  if (isExplicitAutomationControlRequest(rawRequest)
    || (decision.route === 'ui_control'
      && decision.entities.uiSurface === 'automations'
      && CONFIRMATION_AUTOMATION_CONTROL_OPERATIONS.has(decision.operation))) {
    candidateRoutes.add('automation_control');
  }
  if (isExplicitAutomationOutputRequest(rawRequest)) {
    candidateRoutes.add('automation_output_task');
  }

  if (isExplicitProviderConfigRequest(rawRequest)) {
    candidateRoutes.add('general_assistant');
  }

  if (
    isExplicitCodingExecutionRequest(rawRequest)
    || isExplicitRepoInspectionRequest(rawRequest)
    || isExplicitRepoPlanningRequest(rawRequest)
    || isExplicitWorkspaceScopedRepoWorkRequest(rawRequest)
    || isExplicitRemoteSandboxTaskRequest(rawRequest, normalizedLower)
  ) {
    candidateRoutes.add('coding_task');
  }

  if (isExplicitCodingSessionControlRequest(rawRequest)) {
    candidateRoutes.add('coding_session_control');
  }

  const routes = [...candidateRoutes];
  if (routes.length === 0) {
    return null;
  }
  const priorRoute = typeof priorStructuredDecision?.route === 'string'
    ? priorStructuredDecision.route.trim()
    : '';
  if (decision.route !== 'unknown'
    && priorRoute
    && priorRoute !== decision.route
    && routes.includes(decision.route)) {
    reasons.push('classifier_route_mismatch');
  }
  const priorOperation = typeof priorStructuredDecision?.operation === 'string'
    ? priorStructuredDecision.operation.trim()
    : '';
  if (decision.route !== 'unknown'
    && priorOperation
    && priorOperation !== decision.operation
    && routes.includes(decision.route)) {
    reasons.push('classifier_operation_mismatch');
  }
  if (routes.length === 1 && routes[0] === decision.route && reasons.length === 0) {
    return null;
  }
  if (decision.route === 'unknown' || !routes.includes(decision.route)) {
    reasons.push('capability_owner_mismatch');
  }

  return {
    reason: [...new Set(reasons)].join(', '),
    candidateRoutes: routes,
    ...(explicitToolName ? { explicitToolName } : {}),
  };
}

function buildIntentGatewayConfirmationMessages(
  input: IntentGatewayInput,
  record: IntentGatewayRecord,
  confirmation: { reason: string; candidateRoutes: ConfirmationCandidateRoute[]; explicitToolName?: string },
): ChatMessage[] {
  const sections = buildIntentGatewayContextSections(input);
  const priorStructuredDecision = readPriorStructuredDecision(record);
  const canonicalDecision = serializeDecisionForPrompt(record.decision);
  return [
    {
      role: 'system',
      content: INTENT_GATEWAY_CONFIRMATION_SYSTEM_PROMPT,
    },
    {
      role: 'user',
      content: [
        `Confirmation reason: ${confirmation.reason || 'unspecified'}`,
        `Candidate routes: ${confirmation.candidateRoutes.join(', ')}`,
        ...(confirmation.explicitToolName ? [`Explicit tool name: ${confirmation.explicitToolName}`] : []),
        `Prior decision JSON: ${JSON.stringify(priorStructuredDecision ?? canonicalDecision)}`,
        `Canonical repaired decision JSON: ${JSON.stringify(canonicalDecision)}`,
        '',
        ...sections,
      ].join('\n'),
    },
  ];
}

function shouldAdoptConfirmationDecision(
  previousRecord: IntentGatewayRecord,
  next: IntentGatewayDecision,
  priorStructuredDecision: Record<string, unknown> | null,
): boolean {
  if (priorStructuredDecision && doesPriorStructuredDecisionDisagree(priorStructuredDecision, next)) {
    return true;
  }
  return JSON.stringify(serializeDecisionForComparison(previousRecord.decision))
    !== JSON.stringify(serializeDecisionForComparison(next));
}

function doesPriorStructuredDecisionDisagree(
  prior: Record<string, unknown>,
  next: IntentGatewayDecision,
): boolean {
  const priorRoute = typeof prior.route === 'string' ? prior.route.trim() : '';
  if (priorRoute && priorRoute !== next.route) {
    return true;
  }
  const priorOperation = typeof prior.operation === 'string' ? prior.operation.trim() : '';
  if (priorOperation && priorOperation !== next.operation) {
    return true;
  }
  const priorResolution = typeof prior.resolution === 'string' ? prior.resolution.trim() : '';
  return !!priorResolution && priorResolution !== next.resolution;
}

function serializeDecisionForComparison(
  decision: IntentGatewayDecision,
): Record<string, unknown> {
  return {
    route: decision.route,
    confidence: decision.confidence,
    operation: decision.operation,
    summary: decision.summary,
    turnRelation: decision.turnRelation,
    resolution: decision.resolution,
    missingFields: [...decision.missingFields].sort(),
    executionClass: decision.executionClass,
    preferredTier: decision.preferredTier,
    requiresRepoGrounding: decision.requiresRepoGrounding,
    requiresToolSynthesis: decision.requiresToolSynthesis,
    requireExactFileReferences: decision.requireExactFileReferences,
    expectedContextPressure: decision.expectedContextPressure,
    preferredAnswerPath: decision.preferredAnswerPath,
    simpleVsComplex: decision.simpleVsComplex,
    resolvedContent: decision.resolvedContent,
    entities: Object.keys(decision.entities)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = decision.entities[key as keyof typeof decision.entities];
        return acc;
      }, {}),
  };
}

function serializeDecisionForPrompt(
  decision: IntentGatewayDecision,
): Record<string, unknown> {
  return {
    route: decision.route,
    confidence: decision.confidence,
    operation: decision.operation,
    summary: decision.summary,
    turnRelation: decision.turnRelation,
    resolution: decision.resolution,
    missingFields: decision.missingFields,
    executionClass: decision.executionClass,
    preferredTier: decision.preferredTier,
    requiresRepoGrounding: decision.requiresRepoGrounding,
    requiresToolSynthesis: decision.requiresToolSynthesis,
    ...(typeof decision.requireExactFileReferences === 'boolean'
      ? { requireExactFileReferences: decision.requireExactFileReferences }
      : {}),
    expectedContextPressure: decision.expectedContextPressure,
    preferredAnswerPath: decision.preferredAnswerPath,
    ...(decision.simpleVsComplex ? { simpleVsComplex: decision.simpleVsComplex } : {}),
    ...(decision.resolvedContent ? { resolvedContent: decision.resolvedContent } : {}),
    ...decision.entities,
  };
}

function readPriorStructuredDecision(record: IntentGatewayRecord): Record<string, unknown> | null {
  if (record.rawStructuredDecision) {
    return { ...record.rawStructuredDecision };
  }
  if (!record.rawResponsePreview?.trim()) {
    return null;
  }
  return parseStructuredContent(record.rawResponsePreview);
}

function addCandidateRoute(
  candidateRoutes: Set<ConfirmationCandidateRoute>,
  route: IntentGatewayRoute,
): void {
  if (route !== 'unknown') {
    candidateRoutes.add(route);
  }
}
