export type DeploymentProfile = 'personal' | 'home' | 'organization';
export type SecurityOperatingMode = 'monitor' | 'guarded' | 'lockdown' | 'ir_assist';
export type SecurityTriageLlmProvider = 'local' | 'external' | 'auto';
export type AssistantSecurityMonitoringProfile = 'quick' | 'runtime-hardening' | 'workspace-boundaries';
export type AssistantSecurityAutoContainmentSeverity = 'high' | 'critical';
export type AssistantSecurityAutoContainmentCategory =
  | 'sandbox'
  | 'policy'
  | 'browser'
  | 'mcp'
  | 'workspace'
  | 'trust_boundary';

export const DEFAULT_DEPLOYMENT_PROFILE: DeploymentProfile = 'personal';
export const DEFAULT_SECURITY_OPERATING_MODE: SecurityOperatingMode = 'monitor';
export const DEFAULT_SECURITY_TRIAGE_LLM_PROVIDER: SecurityTriageLlmProvider = 'auto';
export const DEFAULT_ASSISTANT_SECURITY_MONITORING_PROFILE: AssistantSecurityMonitoringProfile = 'quick';
export const DEFAULT_ASSISTANT_SECURITY_MONITORING_CRON = '15 */12 * * *';
export const DEFAULT_ASSISTANT_SECURITY_AUTO_CONTAINMENT_SEVERITY: AssistantSecurityAutoContainmentSeverity = 'high';
export const DEFAULT_ASSISTANT_SECURITY_AUTO_CONTAINMENT_CONFIDENCE = 0.95;
export const DEFAULT_ASSISTANT_SECURITY_AUTO_CONTAINMENT_CATEGORIES: readonly AssistantSecurityAutoContainmentCategory[] = [
  'sandbox',
  'trust_boundary',
  'mcp',
];

export const DEPLOYMENT_PROFILES: readonly DeploymentProfile[] = ['personal', 'home', 'organization'];
export const SECURITY_OPERATING_MODES: readonly SecurityOperatingMode[] = ['monitor', 'guarded', 'lockdown', 'ir_assist'];
export const SECURITY_TRIAGE_LLM_PROVIDERS: readonly SecurityTriageLlmProvider[] = ['auto', 'local', 'external'];
export const ASSISTANT_SECURITY_MONITORING_PROFILES: readonly AssistantSecurityMonitoringProfile[] = ['quick', 'runtime-hardening', 'workspace-boundaries'];
export const ASSISTANT_SECURITY_AUTO_CONTAINMENT_SEVERITIES: readonly AssistantSecurityAutoContainmentSeverity[] = ['high', 'critical'];
export const ASSISTANT_SECURITY_AUTO_CONTAINMENT_CATEGORIES: readonly AssistantSecurityAutoContainmentCategory[] = [
  'sandbox',
  'policy',
  'browser',
  'mcp',
  'workspace',
  'trust_boundary',
];

export function isDeploymentProfile(value: string): value is DeploymentProfile {
  return DEPLOYMENT_PROFILES.includes(value as DeploymentProfile);
}

export function isSecurityOperatingMode(value: string): value is SecurityOperatingMode {
  return SECURITY_OPERATING_MODES.includes(value as SecurityOperatingMode);
}

export function isSecurityTriageLlmProvider(value: string): value is SecurityTriageLlmProvider {
  return SECURITY_TRIAGE_LLM_PROVIDERS.includes(value as SecurityTriageLlmProvider);
}

export function isAssistantSecurityMonitoringProfile(value: string): value is AssistantSecurityMonitoringProfile {
  return ASSISTANT_SECURITY_MONITORING_PROFILES.includes(value as AssistantSecurityMonitoringProfile);
}

export function isAssistantSecurityAutoContainmentSeverity(value: string): value is AssistantSecurityAutoContainmentSeverity {
  return ASSISTANT_SECURITY_AUTO_CONTAINMENT_SEVERITIES.includes(value as AssistantSecurityAutoContainmentSeverity);
}

export function isAssistantSecurityAutoContainmentCategory(value: string): value is AssistantSecurityAutoContainmentCategory {
  return ASSISTANT_SECURITY_AUTO_CONTAINMENT_CATEGORIES.includes(value as AssistantSecurityAutoContainmentCategory);
}
