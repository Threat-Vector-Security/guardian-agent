import {
  extractCodingWorkspaceTarget,
  extractExplicitRemoteExecCommand,
  inferExplicitCodingBackendRequest,
  inferExplicitCodingTaskOperation,
} from './entity-resolvers/coding.js';
import {
  inferSecondBrainOperation,
  inferSecondBrainPersonalItemType,
  isExplicitSecondBrainEntityRequest,
  isExplicitSecondBrainRoutineRequest,
} from './entity-resolvers/personal-assistant.js';
import {
  inferProviderConfigOperation,
  isExplicitProviderConfigRequest,
} from './entity-resolvers/provider-config.js';
import { normalizeConfidence, normalizeOperation } from './normalization.js';
import { isExplicitComplexPlanningRequest } from './request-patterns.js';
import { collapseIntentGatewayWhitespace } from './text.js';
import type { IntentGatewayDecision, IntentGatewayRepairContext } from './types.js';

type NormalizeIntentGatewayDecisionFn = (
  parsed: Record<string, unknown>,
  repairContext?: IntentGatewayRepairContext,
) => IntentGatewayDecision;

export function repairUnavailableIntentGatewayDecision(
  repairContext: IntentGatewayRepairContext | undefined,
  parsed: Record<string, unknown> | undefined,
  normalizeIntentGatewayDecision: NormalizeIntentGatewayDecisionFn,
): IntentGatewayDecision | null {
  const rawSourceContent = collapseIntentGatewayWhitespace(repairContext?.sourceContent ?? '');
  const sourceContent = rawSourceContent.toLowerCase();
  if (!sourceContent) return null;
  if (isExplicitComplexPlanningRequest(rawSourceContent)) {
    return normalizeIntentGatewayDecision({
      ...(parsed ?? {}),
      route: 'complex_planning_task',
      operation: 'run',
      confidence: normalizeConfidence(parsed?.confidence) ?? 'medium',
      summary: typeof parsed?.summary === 'string' && parsed.summary.trim()
        ? parsed.summary.trim()
        : 'Recovered explicit complex-planning request after an unstructured gateway response.',
    }, repairContext);
  }
  const inferredProviderConfigDecision = inferExplicitProviderConfigDecision(
    repairContext,
    parsed,
    normalizeIntentGatewayDecision,
  );
  if (inferredProviderConfigDecision) {
    return inferredProviderConfigDecision;
  }
  const parsedOperation = normalizeOperation(parsed?.operation);
  const inferredRemoteExecCommand = extractExplicitRemoteExecCommand(
    rawSourceContent,
    sourceContent,
    parsedOperation === 'unknown' ? 'run' : parsedOperation,
  );
  if (inferredRemoteExecCommand) {
    return normalizeIntentGatewayDecision({
      ...(parsed ?? {}),
      route: 'coding_task',
      operation: 'run',
      confidence: normalizeConfidence(parsed?.confidence) ?? 'low',
      summary: typeof parsed?.summary === 'string' && parsed.summary.trim()
        ? parsed.summary.trim()
        : 'Recovered explicit remote-sandbox coding intent after an unstructured gateway response.',
      command: inferredRemoteExecCommand,
      codingRemoteExecRequested: true,
      ...(extractCodingWorkspaceTarget(rawSourceContent)
        ? { sessionTarget: extractCodingWorkspaceTarget(rawSourceContent) }
        : {}),
    }, repairContext);
  }
  const inferredCodingBackendRequest = inferExplicitCodingBackendRequest(
    rawSourceContent,
    sourceContent,
    parsedOperation,
  );
  if (inferredCodingBackendRequest) {
    return normalizeIntentGatewayDecision({
      ...(parsed ?? {}),
      route: 'coding_task',
      operation: inferredCodingBackendRequest.operation,
      confidence: normalizeConfidence(parsed?.confidence) ?? 'low',
      summary: typeof parsed?.summary === 'string' && parsed.summary.trim()
        ? parsed.summary.trim()
        : 'Recovered coding-backend intent from an explicit backend workspace request after an unstructured gateway response.',
      codingBackend: inferredCodingBackendRequest.codingBackend,
      codingBackendRequested: true,
      ...(inferredCodingBackendRequest.sessionTarget
        ? { sessionTarget: inferredCodingBackendRequest.sessionTarget }
        : {}),
    }, repairContext);
  }
  const inferredSecondBrainDecision = inferExplicitSecondBrainDecision(
    repairContext,
    parsed,
    normalizeIntentGatewayDecision,
  );
  if (inferredSecondBrainDecision) {
    return inferredSecondBrainDecision;
  }
  const inferredCodingOperation = inferExplicitCodingTaskOperation(sourceContent, parsedOperation);
  if (!inferredCodingOperation) return null;
  return normalizeIntentGatewayDecision({
    ...(parsed ?? {}),
    route: 'coding_task',
    operation: inferredCodingOperation,
    confidence: normalizeConfidence(parsed?.confidence) ?? 'low',
    summary: typeof parsed?.summary === 'string' && parsed.summary.trim()
      ? parsed.summary.trim()
      : 'Recovered coding-task intent from explicit repo file references after an unstructured gateway response.',
  }, repairContext);
}

function inferExplicitSecondBrainDecision(
  repairContext: IntentGatewayRepairContext | undefined,
  parsed: Record<string, unknown> | undefined,
  normalizeIntentGatewayDecision: NormalizeIntentGatewayDecisionFn,
): IntentGatewayDecision | null {
  const operation = inferSecondBrainOperation(
    repairContext?.sourceContent,
    'personal_assistant_task',
    normalizeOperation(parsed?.operation) ?? 'unknown',
  );
  if (!operation || operation === 'unknown') {
    return null;
  }
  if (
    !isExplicitSecondBrainEntityRequest(repairContext?.sourceContent, operation)
    && !isExplicitSecondBrainRoutineRequest(repairContext?.sourceContent, operation)
  ) {
    return null;
  }
  const personalItemType = inferSecondBrainPersonalItemType(
    repairContext,
    'personal_assistant_task',
    operation,
  );
  if (!personalItemType || personalItemType === 'unknown') {
    return null;
  }
  return normalizeIntentGatewayDecision({
    ...(parsed ?? {}),
    route: 'personal_assistant_task',
    operation,
    personalItemType,
    confidence: normalizeConfidence(parsed?.confidence) ?? 'low',
    summary: typeof parsed?.summary === 'string' && parsed.summary.trim()
      ? parsed.summary.trim()
      : 'Recovered Second Brain intent from an unstructured gateway response.',
  }, repairContext);
}

function inferExplicitProviderConfigDecision(
  repairContext: IntentGatewayRepairContext | undefined,
  parsed: Record<string, unknown> | undefined,
  normalizeIntentGatewayDecision: NormalizeIntentGatewayDecisionFn,
): IntentGatewayDecision | null {
  const rawSourceContent = collapseIntentGatewayWhitespace(repairContext?.sourceContent ?? '');
  if (!isExplicitProviderConfigRequest(rawSourceContent)) return null;
  const parsedOperation = normalizeOperation(parsed?.operation);
  return normalizeIntentGatewayDecision({
    ...(parsed ?? {}),
    route: 'general_assistant',
    operation: inferProviderConfigOperation(rawSourceContent, parsedOperation),
    confidence: normalizeConfidence(parsed?.confidence) ?? 'low',
    summary: typeof parsed?.summary === 'string' && parsed.summary.trim()
      ? parsed.summary.trim()
      : 'Recovered an AI provider configuration request after an unstructured gateway response.',
    uiSurface: 'config',
    executionClass: 'provider_crud',
    preferredTier: 'external',
    requiresRepoGrounding: false,
    requiresToolSynthesis: true,
    expectedContextPressure: 'medium',
    preferredAnswerPath: 'tool_loop',
    simpleVsComplex: 'complex',
  }, repairContext);
}
