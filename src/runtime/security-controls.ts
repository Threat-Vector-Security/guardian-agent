import { existsSync, readFileSync } from 'node:fs';

export type DeploymentProfile = 'personal' | 'home' | 'organization' | 'cloud';
export type RuntimeEnvironmentKind = 'workstation' | 'container' | 'cloud';
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

export const DEPLOYMENT_PROFILES: readonly DeploymentProfile[] = ['personal', 'home', 'organization', 'cloud'];
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

export interface RuntimeEnvironmentDetection {
  kind: RuntimeEnvironmentKind;
  deploymentProfile: DeploymentProfile;
  platform?: string;
  indicators: string[];
}

interface RuntimePlatformDetector {
  env: string[];
  platform: (env: NodeJS.ProcessEnv) => string;
}

const CLOUD_RUNTIME_DETECTORS: readonly RuntimePlatformDetector[] = [
  { env: ['FLY_APP_NAME', 'FLY_MACHINE_ID'], platform: env => env.FLY_APP_NAME ? `Fly.io app ${env.FLY_APP_NAME}` : 'Fly.io' },
  { env: ['KUBERNETES_SERVICE_HOST'], platform: () => 'Kubernetes' },
  { env: ['K_SERVICE', 'K_REVISION', 'K_CONFIGURATION'], platform: env => env.K_SERVICE ? `Google Cloud Run service ${env.K_SERVICE}` : 'Google Cloud Run' },
  { env: ['VERCEL', 'VERCEL_ENV', 'VERCEL_URL'], platform: () => 'Vercel' },
  { env: ['AWS_LAMBDA_FUNCTION_NAME', 'AWS_EXECUTION_ENV'], platform: env => env.AWS_LAMBDA_FUNCTION_NAME ? `AWS Lambda function ${env.AWS_LAMBDA_FUNCTION_NAME}` : 'AWS runtime' },
  { env: ['ECS_CONTAINER_METADATA_URI', 'ECS_CONTAINER_METADATA_URI_V4'], platform: () => 'AWS ECS' },
  { env: ['WEBSITE_SITE_NAME', 'WEBSITE_INSTANCE_ID'], platform: env => env.WEBSITE_SITE_NAME ? `Azure App Service ${env.WEBSITE_SITE_NAME}` : 'Azure App Service' },
  { env: ['FUNCTIONS_WORKER_RUNTIME'], platform: () => 'Azure Functions' },
  { env: ['RENDER_SERVICE_ID', 'RENDER'], platform: () => 'Render' },
  { env: ['RAILWAY_SERVICE_ID', 'RAILWAY_ENVIRONMENT'], platform: () => 'Railway' },
  { env: ['DYNO', 'HEROKU_APP_NAME'], platform: env => env.HEROKU_APP_NAME ? `Heroku app ${env.HEROKU_APP_NAME}` : 'Heroku' },
  { env: ['NETLIFY'], platform: () => 'Netlify' },
  { env: ['DIGITALOCEAN_APP_ID'], platform: () => 'DigitalOcean App Platform' },
  { env: ['CF_INSTANCE_GUID', 'CF_INSTANCE_INDEX'], platform: () => 'Cloud Foundry' },
  { env: ['CODESPACES', 'GITHUB_CODESPACE_TOKEN'], platform: env => env.CODESPACE_NAME ? `GitHub Codespace ${env.CODESPACE_NAME}` : 'GitHub Codespaces' },
];

export function isDeploymentProfile(value: string): value is DeploymentProfile {
  return DEPLOYMENT_PROFILES.includes(value as DeploymentProfile);
}

export function detectRuntimeEnvironment(env: NodeJS.ProcessEnv = process.env): RuntimeEnvironmentDetection {
  for (const detector of CLOUD_RUNTIME_DETECTORS) {
    const matched = detector.env.filter(key => !!env[key]);
    if (matched.length > 0) {
      return {
        kind: 'cloud',
        deploymentProfile: 'cloud',
        platform: detector.platform(env),
        indicators: matched,
      };
    }
  }

  const containerIndicators = detectContainerIndicators(env, env === process.env);
  if (containerIndicators.length > 0) {
    return {
      kind: 'container',
      deploymentProfile: DEFAULT_DEPLOYMENT_PROFILE,
      platform: 'containerized runtime',
      indicators: containerIndicators,
    };
  }

  return {
    kind: 'workstation',
    deploymentProfile: DEFAULT_DEPLOYMENT_PROFILE,
    indicators: [],
  };
}

export function inferRuntimeDeploymentProfile(env: NodeJS.ProcessEnv = process.env): DeploymentProfile {
  return detectRuntimeEnvironment(env).deploymentProfile;
}

function detectContainerIndicators(env: NodeJS.ProcessEnv, includeHostFiles: boolean): string[] {
  const indicators: string[] = [];
  if (env.container) indicators.push('container');
  if (env.DOTNET_RUNNING_IN_CONTAINER === 'true') indicators.push('DOTNET_RUNNING_IN_CONTAINER');
  if (!includeHostFiles) return indicators;

  if (existsSync('/.dockerenv')) indicators.push('/.dockerenv');
  if (existsSync('/run/.containerenv')) indicators.push('/run/.containerenv');

  try {
    const cgroup = readFileSync('/proc/1/cgroup', 'utf8');
    if (/\b(?:docker|kubepods|containerd|libpod|podman|lxc)\b/i.test(cgroup)) {
      indicators.push('/proc/1/cgroup');
    }
  } catch {
    // Absent on Windows/macOS and on some restricted containers.
  }

  return indicators;
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
