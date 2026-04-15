export const INTENT_GATEWAY_MISSING_SUMMARY = 'No classification summary provided.';

export function isIntentGatewayPlaceholderSummary(value: string | null | undefined): boolean {
  return (typeof value === 'string' ? value.trim() : '') === INTENT_GATEWAY_MISSING_SUMMARY;
}

export function normalizeUserFacingIntentGatewaySummary(
  value: string | null | undefined,
): string | undefined {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  if (!trimmed || isIntentGatewayPlaceholderSummary(trimmed)) {
    return undefined;
  }
  return trimmed;
}
