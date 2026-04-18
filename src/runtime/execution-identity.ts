export const EXECUTION_IDENTITY_METADATA_KEY = '__guardian_execution_identity';

export interface ExecutionIdentityMetadata {
  executionId: string;
  parentExecutionId?: string;
  rootExecutionId?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function normalizeText(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

export function normalizeExecutionIdentityMetadata(
  value: unknown,
): ExecutionIdentityMetadata | null {
  if (!isRecord(value)) return null;
  const executionId = normalizeText(value.executionId);
  if (!executionId) return null;
  const parentExecutionId = normalizeText(value.parentExecutionId);
  const rootExecutionId = normalizeText(value.rootExecutionId) ?? executionId;
  return {
    executionId,
    ...(parentExecutionId ? { parentExecutionId } : {}),
    rootExecutionId,
  };
}

export function readExecutionIdentityMetadata(
  metadata: Record<string, unknown> | undefined | null,
): ExecutionIdentityMetadata | null {
  if (!metadata) return null;
  return normalizeExecutionIdentityMetadata(metadata[EXECUTION_IDENTITY_METADATA_KEY]);
}

export function attachExecutionIdentityMetadata(
  metadata: Record<string, unknown> | undefined,
  executionIdentity: ExecutionIdentityMetadata | null | undefined,
): Record<string, unknown> | undefined {
  const normalized = normalizeExecutionIdentityMetadata(executionIdentity);
  if (!normalized) return metadata;
  return {
    ...(metadata ?? {}),
    [EXECUTION_IDENTITY_METADATA_KEY]: normalized,
  };
}
