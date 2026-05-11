import type { IntentGatewayOperation } from '../types.js';
import { normalizeIntentGatewayRepairText } from '../text.js';

export function isExplicitProviderConfigRequest(content: string | undefined): boolean {
  const normalized = normalizeIntentGatewayRepairText(content);
  if (!normalized) return false;
  return /\bconfigured\s+(?:ai\s+|llm\s+)?providers?\b/.test(normalized)
    || /\b(?:ai\s+|llm\s+)?provider\s+profiles?\b/.test(normalized)
    || (/\b(?:providers?|profiles?|models?|catalog|routing policy)\b/.test(normalized)
      && /\b(?:ai|llm|model|ollama|anthropic|openai|xai|gemini|claude)\b/.test(normalized));
}

export function inferProviderConfigOperation(
  content: string,
  fallback: IntentGatewayOperation,
): IntentGatewayOperation {
  const normalized = content.toLowerCase();
  if (isExplicitProviderConfigReadOnlyRequest(normalized)) {
    return /\b(?:inspect|explain|details?|catalog|models?|status|connected|health)\b/.test(normalized)
      ? 'inspect'
      : 'read';
  }
  if (['read', 'inspect', 'create', 'update', 'delete'].includes(fallback)) {
    return fallback;
  }
  if (/\b(?:update|edit|change|modify|set|switch)\b/.test(normalized)) {
    return 'update';
  }
  if (/\b(?:delete|remove)\b/.test(normalized)) {
    return 'delete';
  }
  if (/\b(?:create|add)\b/.test(normalized)) {
    return 'create';
  }
  if (/\b(?:inspect|explain|details?|catalog|models?)\b/.test(normalized)) {
    return 'inspect';
  }
  return 'read';
}

function isExplicitProviderConfigReadOnlyRequest(normalized: string): boolean {
  if (!normalized) return false;
  if (/\b(?:do\s+not|don't|never)\s+(?:change|modify|update|edit|set|switch|create|add|delete|remove)\b/.test(normalized)) {
    return true;
  }
  return /\b(?:check|show|list|read|inspect|status|connected|health|available|catalog|models?)\b/.test(normalized)
    && !/\b(?:update|edit|change|modify|set|switch|create|add|delete|remove)\b/.test(
      normalized.replace(/\b(?:do\s+not|don't|never)\s+(?:change|modify|update|edit|set|switch|create|add|delete|remove)\b[^.!?\n]*/g, ' '),
    );
}
