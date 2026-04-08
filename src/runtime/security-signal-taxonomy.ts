export const LOW_CONFIDENCE_SECURITY_DETAIL_TYPES = [
  'new_external_destination',
  'new_listening_port',
  'sensitive_path_change',
  'firewall_change',
  'defender_controlled_folder_access_disabled',
] as const;

export const EXPECTED_GUARDRAIL_SECURITY_DETAIL_TYPES = [
  'degraded_backend_manual_terminals_disabled',
  'strict_sandbox_lockdown',
  'restrict_browser_mutation',
  'pause_scheduled_mutations',
  'restrict_outbound_mutation',
  'restrict_command_execution',
  'restrict_network_egress',
  'restrict_mcp_tooling',
  'freeze_mutating_tools',
  'ir_assist_read_only',
] as const;

export const DEFAULT_SUPPRESSED_SECURITY_NOTIFICATION_DETAIL_TYPES = [
  ...LOW_CONFIDENCE_SECURITY_DETAIL_TYPES,
  ...EXPECTED_GUARDRAIL_SECURITY_DETAIL_TYPES,
] as const;

const LOW_CONFIDENCE_SECURITY_DETAIL_TYPE_SET = new Set<string>(LOW_CONFIDENCE_SECURITY_DETAIL_TYPES);
const EXPECTED_GUARDRAIL_SECURITY_DETAIL_TYPE_SET = new Set<string>(EXPECTED_GUARDRAIL_SECURITY_DETAIL_TYPES);

export function isLowConfidenceSecurityDetailType(value: string | undefined | null): boolean {
  return typeof value === 'string' && LOW_CONFIDENCE_SECURITY_DETAIL_TYPE_SET.has(value);
}

export function isExpectedGuardrailSecurityDetailType(value: string | undefined | null): boolean {
  return typeof value === 'string' && EXPECTED_GUARDRAIL_SECURITY_DETAIL_TYPE_SET.has(value);
}
