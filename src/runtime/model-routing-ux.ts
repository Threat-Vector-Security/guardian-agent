export interface ResponseSourceMetadata {
  locality: 'local' | 'external';
  providerName?: string;
  tier?: 'local' | 'external';
  usedFallback?: boolean;
  notice?: string;
}

const LOCAL_MODEL_TOO_COMPLICATED_MESSAGE =
  'This request is too complicated for the current local model. Please change model or configure external.';

export function buildLocalModelTooComplicatedMessage(): string {
  return LOCAL_MODEL_TOO_COMPLICATED_MESSAGE;
}

export function isLocalToolCallParseError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? '');
  return /ollama api error 500/i.test(message)
    && /(error parsing tool call|unexpected end of json input|invalid character .* after array element)/i.test(message);
}

export function getProviderLocalityFromName(providerName: string | undefined): 'local' | 'external' {
  return providerName?.trim().toLowerCase() === 'ollama' ? 'local' : 'external';
}

export function readResponseSourceMetadata(metadata?: Record<string, unknown>): ResponseSourceMetadata | undefined {
  const value = metadata?.responseSource;
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const record = value as Record<string, unknown>;
  const locality = record.locality;
  if (locality !== 'local' && locality !== 'external') return undefined;
  return {
    locality,
    providerName: typeof record.providerName === 'string' ? record.providerName : undefined,
    tier: record.tier === 'local' || record.tier === 'external' ? record.tier : undefined,
    usedFallback: record.usedFallback === true,
    notice: typeof record.notice === 'string' ? record.notice : undefined,
  };
}

export function formatResponseSourceLabel(metadata?: Record<string, unknown>): string {
  const source = readResponseSourceMetadata(metadata);
  if (!source) return '';
  const parts: string[] = [source.locality];
  if (source.usedFallback) parts.push('fallback');
  return `[${parts.join(' · ')}]`;
}
