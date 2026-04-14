import type { ChatResponse } from '../../llm/types.js';
import { parseStructuredJsonObject } from '../../util/structured-json.js';
import {
  repairIntentGatewayOperation,
  repairIntentGatewayRoute,
} from './clarification-resolver.js';
import { resolveIntentGatewayEntities } from './route-entity-resolution.js';
import {
  normalizeConfidence,
  normalizeExecutionClass,
  normalizeExpectedContextPressure,
  normalizeOperation,
  normalizePreferredAnswerPath,
  normalizePreferredTier,
  normalizeResolution,
  normalizeRoute,
  normalizeSimpleVsComplex,
  normalizeTurnRelation,
} from './normalization.js';
import type {
  IntentGatewayDecision,
  IntentGatewayRepairContext,
} from './types.js';
import { repairUnavailableIntentGatewayDecision } from './unstructured-recovery.js';
import { deriveWorkloadMetadata } from './workload-derivation.js';

export function parseIntentGatewayDecision(
  response: ChatResponse,
  repairContext?: IntentGatewayRepairContext,
): { decision: IntentGatewayDecision; available: boolean } {
  const parsed = parseStructuredToolArguments(response)
    ?? parseStructuredContent(response.content);
  if (!parsed) {
    const repaired = repairUnavailableIntentGatewayDecision(
      repairContext,
      undefined,
      normalizeIntentGatewayDecision,
    );
    if (repaired) {
      return {
        decision: repaired,
        available: true,
      };
    }
    return {
      decision: {
        route: 'unknown',
        confidence: 'low',
        operation: 'unknown',
        summary: 'Intent gateway response was not structured.',
        turnRelation: 'new_request',
        resolution: 'ready',
        missingFields: [],
        executionClass: 'direct_assistant',
        preferredTier: 'local',
        requiresRepoGrounding: false,
        requiresToolSynthesis: false,
        expectedContextPressure: 'low',
        preferredAnswerPath: 'direct',
        simpleVsComplex: 'simple',
        entities: {},
      },
      available: false,
    };
  }
  const decision = normalizeIntentGatewayDecision(parsed, repairContext);
  if (decision.route === 'unknown') {
    const repaired = repairUnavailableIntentGatewayDecision(
      repairContext,
      parsed,
      normalizeIntentGatewayDecision,
    );
    if (repaired) {
      return {
        decision: repaired,
        available: true,
      };
    }
  }
  return {
    decision,
    available: decision.route !== 'unknown',
  };
}

export function parseStructuredToolArguments(response: ChatResponse): Record<string, unknown> | null {
  const firstToolCall = response.toolCalls?.[0];
  if (!firstToolCall?.arguments) return null;
  return parseStructuredJsonObject<Record<string, unknown>>(firstToolCall.arguments);
}

export function parseStructuredContent(content: string): Record<string, unknown> | null {
  return parseStructuredJsonObject<Record<string, unknown>>(content);
}

export function normalizeIntentGatewayDecision(
  parsed: Record<string, unknown>,
  repairContext?: IntentGatewayRepairContext,
): IntentGatewayDecision {
  const parsedOperation = normalizeOperation(parsed.operation);
  const confidence = normalizeConfidence(parsed.confidence);
  const summary = typeof parsed.summary === 'string' && parsed.summary.trim()
    ? parsed.summary.trim()
    : 'No classification summary provided.';
  const turnRelation = normalizeTurnRelation(parsed.turnRelation);
  const route = repairIntentGatewayRoute(
    normalizeRoute(parsed.route),
    parsedOperation,
    turnRelation,
    repairContext,
  );
  const operation = repairIntentGatewayOperation(parsedOperation, route, turnRelation, repairContext);
  const resolution = normalizeResolution(parsed.resolution);
  const missingFields = Array.isArray(parsed.missingFields)
    ? parsed.missingFields
      .filter((value): value is string => typeof value === 'string')
      .map((value) => value.trim())
      .filter(Boolean)
    : [];
  const resolvedContent = typeof parsed.resolvedContent === 'string' && parsed.resolvedContent.trim()
    ? parsed.resolvedContent.trim()
    : undefined;
  const entities = resolveIntentGatewayEntities(parsed, repairContext, route, operation);
  const derivedWorkload = deriveWorkloadMetadata(route, operation, {
    ...parsed,
    ...entities,
  });
  const executionClass = normalizeExecutionClass(parsed.executionClass) ?? derivedWorkload.executionClass;
  const preferredTier = normalizePreferredTier(parsed.preferredTier) ?? derivedWorkload.preferredTier;
  const requiresRepoGrounding = typeof parsed.requiresRepoGrounding === 'boolean'
    ? parsed.requiresRepoGrounding
    : derivedWorkload.requiresRepoGrounding;
  const requiresToolSynthesis = typeof parsed.requiresToolSynthesis === 'boolean'
    ? parsed.requiresToolSynthesis
    : derivedWorkload.requiresToolSynthesis;
  const expectedContextPressure = normalizeExpectedContextPressure(parsed.expectedContextPressure)
    ?? derivedWorkload.expectedContextPressure;
  const preferredAnswerPath = normalizePreferredAnswerPath(parsed.preferredAnswerPath)
    ?? derivedWorkload.preferredAnswerPath;
  const simpleVsComplex = normalizeSimpleVsComplex(parsed.simpleVsComplex)
    ?? derivedWorkload.simpleVsComplex;

  return {
    route,
    confidence,
    operation,
    summary,
    turnRelation,
    resolution,
    missingFields,
    executionClass,
    preferredTier,
    requiresRepoGrounding,
    requiresToolSynthesis,
    expectedContextPressure,
    preferredAnswerPath,
    simpleVsComplex,
    ...(resolvedContent ? { resolvedContent } : {}),
    entities,
  };
}

export function buildRawResponsePreview(response: ChatResponse): string | undefined {
  const toolArguments = response.toolCalls?.[0]?.arguments?.trim();
  if (toolArguments) return toolArguments.slice(0, 200);
  const content = response.content.trim();
  return content ? content.slice(0, 200) : undefined;
}
