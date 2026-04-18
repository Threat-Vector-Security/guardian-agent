import type { ConversationContextQuery } from '../conversation.js';
import { normalizeIntentGatewayRepairText } from './text.js';

export interface IntentGatewayHistoryContinuityContext {
  focusSummary?: string;
  lastActionableRequest?: string;
  activeExecutionRefs?: string[];
}

function uniqueTrimmed(values: Array<string | undefined | null>): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const trimmed = value?.trim();
    if (!trimmed) continue;
    if (seen.has(trimmed)) continue;
    seen.add(trimmed);
    result.push(trimmed);
  }
  return result;
}

function normalizeRepairText(value: string): string {
  return normalizeIntentGatewayRepairText(value).replace(/\s+/g, ' ').trim();
}

function wordCount(value: string): number {
  return value.split(/\s+/).filter(Boolean).length;
}

export function buildIntentGatewayHistoryQuery(input: {
  content: string;
  continuity?: IntentGatewayHistoryContinuityContext | null;
}): string | ConversationContextQuery | undefined {
  const text = input.content.trim();
  if (!text) return undefined;
  const continuity = input.continuity;
  if (!continuity) return text;

  const focusTexts = uniqueTrimmed([
    continuity.lastActionableRequest,
    continuity.focusSummary,
  ]).filter((value) => normalizeRepairText(value) !== normalizeRepairText(text));
  const identifiers = uniqueTrimmed(continuity.activeExecutionRefs ?? []);

  if (focusTexts.length === 0 && identifiers.length === 0) {
    return text;
  }

  return {
    text,
    ...(focusTexts.length > 0 ? { focusTexts } : {}),
    ...(identifiers.length > 0 ? { identifiers } : {}),
  };
}

export function shouldRepairHistoricalCodingBackendTurn(input: {
  content: string;
  lastActionableRequest?: string | null;
}): boolean {
  const current = input.content.trim();
  const previous = input.lastActionableRequest?.trim();
  if (!current || !previous) return false;

  const normalizedCurrent = normalizeRepairText(current);
  const normalizedPrevious = normalizeRepairText(previous);
  if (!normalizedCurrent || !normalizedPrevious || normalizedCurrent === normalizedPrevious) {
    return false;
  }

  if (wordCount(current) <= 16) {
    return true;
  }

  const relativeThreshold = Math.max(48, Math.round(previous.length * 0.7));
  return current.length < Math.min(120, relativeThreshold);
}

export function resolveHistoricalCodingBackendRequest(input: {
  backendId: string;
  content: string;
  lastActionableRequest?: string | null;
}): string | null {
  const lastActionableRequest = input.lastActionableRequest?.trim();
  if (!lastActionableRequest) return null;
  if (!shouldRepairHistoricalCodingBackendTurn({
    content: input.content,
    lastActionableRequest,
  })) {
    return null;
  }

  const backendNeedle = normalizeRepairText(input.backendId.replace(/-/g, ' '));
  const normalizedLast = normalizeRepairText(lastActionableRequest);
  if (backendNeedle && normalizedLast.includes(backendNeedle)) {
    return lastActionableRequest;
  }

  return `Use ${input.backendId} for this request: ${lastActionableRequest}`;
}
