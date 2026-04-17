export type OrchestrationCoreRole = 'coordinator' | 'explorer' | 'implementer' | 'verifier';

export interface OrchestrationRoleDescriptor {
  role: OrchestrationCoreRole;
  label?: string;
  lenses?: readonly string[];
}

const VALID_ROLES = new Set<OrchestrationCoreRole>([
  'coordinator',
  'explorer',
  'implementer',
  'verifier',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function normalizeText(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function titleCaseToken(value: string): string {
  return value
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

export function normalizeOrchestrationRole(value: unknown): OrchestrationCoreRole | undefined {
  return typeof value === 'string' && VALID_ROLES.has(value as OrchestrationCoreRole)
    ? value as OrchestrationCoreRole
    : undefined;
}

export function normalizeOrchestrationRoleDescriptor(value: unknown): OrchestrationRoleDescriptor | undefined {
  if (!isRecord(value)) return undefined;
  const role = normalizeOrchestrationRole(value.role);
  if (!role) return undefined;
  const label = normalizeText(value.label);
  const lenses = Array.isArray(value.lenses)
    ? [...new Set(value.lenses
      .map((entry) => normalizeText(entry))
      .filter((entry): entry is string => Boolean(entry))
      .slice(0, 6))]
    : [];
  return {
    role,
    ...(label ? { label } : {}),
    ...(lenses.length > 0 ? { lenses } : {}),
  };
}

export function defaultOrchestrationRoleLabel(role: OrchestrationCoreRole): string {
  return titleCaseToken(role);
}

export function formatOrchestrationRoleDescriptor(
  descriptor: OrchestrationRoleDescriptor | undefined,
  options: { includeLenses?: boolean } = {},
): string | undefined {
  if (!descriptor) return undefined;
  const base = descriptor.label?.trim() || defaultOrchestrationRoleLabel(descriptor.role);
  if (options.includeLenses === false || !descriptor.lenses?.length) {
    return base;
  }
  return `${base} (${descriptor.lenses.map((lens) => titleCaseToken(lens)).join(', ')})`;
}
