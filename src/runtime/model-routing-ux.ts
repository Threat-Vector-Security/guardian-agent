import { formatProviderTierLabel, getProviderLocality, getProviderTier } from '../llm/provider-metadata.js';

export interface ResponseUsageMetadata {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  cacheCreationTokens?: number;
  cacheReadTokens?: number;
}

export interface ResponseSourceMetadata {
  locality: 'local' | 'external';
  providerName?: string;
  providerTier?: 'local' | 'managed_cloud' | 'frontier';
  model?: string;
  tier?: 'local' | 'external';
  usedFallback?: boolean;
  notice?: string;
  durationMs?: number;
  usage?: ResponseUsageMetadata;
}

export type LocalModelComplexityGuardEnv = Record<string, string | undefined>;

const LOCAL_MODEL_TOO_COMPLICATED_MESSAGE =
  'This request is too complicated for the current local model. Please change model or configure external.';

export function buildLocalModelTooComplicatedMessage(): string {
  return LOCAL_MODEL_TOO_COMPLICATED_MESSAGE;
}

export function shouldBypassLocalModelComplexityGuard(
  env: LocalModelComplexityGuardEnv = process.env,
): boolean {
  const value = env.GUARDIAN_BYPASS_LOCAL_MODEL_COMPLEXITY_GUARD?.trim().toLowerCase();
  return value === '1' || value === 'true' || value === 'yes';
}

export function isLocalToolCallParseError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? '');
  return /ollama api error 500/i.test(message)
    && /(error parsing tool call|unexpected end of json input|invalid character .* after array element)/i.test(message);
}

export function getProviderLocalityFromName(providerName: string | undefined): 'local' | 'external' {
  return getProviderLocality(providerName) ?? 'external';
}

export function readResponseSourceMetadata(metadata?: Record<string, unknown>): ResponseSourceMetadata | undefined {
  const value = metadata?.responseSource;
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const record = value as Record<string, unknown>;
  const locality = record.locality;
  if (locality !== 'local' && locality !== 'external') return undefined;
  const usageRecord = record.usage && typeof record.usage === 'object' && !Array.isArray(record.usage)
    ? record.usage as Record<string, unknown>
    : null;
  const promptTokens = typeof usageRecord?.promptTokens === 'number' && Number.isFinite(usageRecord.promptTokens)
    ? usageRecord.promptTokens
    : undefined;
  const completionTokens = typeof usageRecord?.completionTokens === 'number' && Number.isFinite(usageRecord.completionTokens)
    ? usageRecord.completionTokens
    : undefined;
  const totalTokens = typeof usageRecord?.totalTokens === 'number' && Number.isFinite(usageRecord.totalTokens)
    ? usageRecord.totalTokens
    : undefined;
  return {
    locality,
    providerName: typeof record.providerName === 'string' ? record.providerName : undefined,
    providerTier: record.providerTier === 'local' || record.providerTier === 'managed_cloud' || record.providerTier === 'frontier'
      ? record.providerTier
      : (typeof record.providerName === 'string' ? getProviderTier(record.providerName) : undefined),
    model: typeof record.model === 'string' ? record.model : undefined,
    tier: record.tier === 'local' || record.tier === 'external' ? record.tier : undefined,
    usedFallback: record.usedFallback === true,
    notice: typeof record.notice === 'string' ? record.notice : undefined,
    durationMs: typeof record.durationMs === 'number' && Number.isFinite(record.durationMs)
      ? record.durationMs
      : undefined,
    ...(typeof promptTokens === 'number' && typeof completionTokens === 'number' && typeof totalTokens === 'number'
      ? {
          usage: {
            promptTokens,
            completionTokens,
            totalTokens,
            ...(typeof usageRecord?.cacheCreationTokens === 'number' && Number.isFinite(usageRecord.cacheCreationTokens)
              ? { cacheCreationTokens: usageRecord.cacheCreationTokens }
              : {}),
            ...(typeof usageRecord?.cacheReadTokens === 'number' && Number.isFinite(usageRecord.cacheReadTokens)
              ? { cacheReadTokens: usageRecord.cacheReadTokens }
              : {}),
          },
        }
      : {}),
  };
}

export function formatResponseSourceLabel(metadata?: Record<string, unknown>): string {
  const source = readResponseSourceMetadata(metadata);
  if (!source) return '';
  const parts: string[] = [source.providerTier ? formatProviderTierLabel(source.providerTier) : source.locality];
  if (source.usedFallback) parts.push('fallback');
  return `[${parts.join(' · ')}]`;
}
