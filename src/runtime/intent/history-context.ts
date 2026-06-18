import type { ConversationContextQuery } from '../conversation.js';

export interface IntentGatewayHistoryContinuityContext {
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

function prefersRecentHistory(content: string): boolean {
  return /\b(?:above|earlier|first|it|last|previous|recent|same|second|that|them|these|third|those)\b/i.test(content);
}

export function buildIntentGatewayHistoryQuery(input: {
  content: string;
  continuity?: IntentGatewayHistoryContinuityContext | null;
}): string | ConversationContextQuery | undefined {
  const text = input.content.trim();
  if (!text) return undefined;
  if (prefersRecentHistory(text)) return undefined;
  const continuity = input.continuity;
  if (!continuity) return text;

  const identifiers = uniqueTrimmed(continuity.activeExecutionRefs ?? []);

  if (identifiers.length === 0) {
    return text;
  }

  return {
    text,
    ...(identifiers.length > 0 ? { identifiers } : {}),
  };
}
