import type { SecurityAlertSeverity, SecurityAlertSource } from './security-alerts.js';
import type { SecurityAlertStatus } from './security-alert-lifecycle.js';
import {
  DEPLOYMENT_PROFILES,
  SECURITY_OPERATING_MODES,
  type DeploymentProfile,
  type SecurityOperatingMode,
  isDeploymentProfile,
  isSecurityOperatingMode,
} from './security-controls.js';

export type SecurityPostureSource = SecurityAlertSource;
export type SecurityPostureSeverity = SecurityAlertSeverity;

export interface SecurityPostureAlert {
  id: string;
  source: SecurityPostureSource;
  type: string;
  severity: SecurityPostureSeverity;
  description: string;
  timestamp?: number;
  acknowledged?: boolean;
  status?: SecurityAlertStatus;
}

export interface SecurityPostureAssessmentInput {
  profile: DeploymentProfile;
  currentMode: SecurityOperatingMode;
  alerts: SecurityPostureAlert[];
  availableSources?: SecurityPostureSource[];
}

export interface SecurityPostureAssessment {
  profile: DeploymentProfile;
  currentMode: SecurityOperatingMode;
  recommendedMode: SecurityOperatingMode;
  shouldEscalate: boolean;
  summary: string;
  reasons: string[];
  counts: {
    total: number;
    low: number;
    medium: number;
    high: number;
    critical: number;
  };
  bySource: Record<SecurityPostureSource, number>;
  availableSources: SecurityPostureSource[];
  topAlerts: SecurityPostureAlert[];
}

const MODE_RANK: Record<SecurityOperatingMode, number> = {
  monitor: 0,
  guarded: 1,
  ir_assist: 2,
  lockdown: 3,
};

const LOCKDOWN_ALERT_TYPES = new Set<string>([
  'firewall_disabled',
  'gateway_firewall_disabled',
  'data_exfiltration',
  'lateral_movement',
  'defender_antivirus_disabled',
  'defender_realtime_protection_disabled',
  'defender_firewall_profile_disabled',
]);

const IR_ASSIST_ALERT_TYPES = new Set<string>([
  'beaconing',
  'port_scanning',
  'gateway_admin_change',
  'suspicious_process',
  'defender_threat_detected',
  'data_exfiltration',
  'lateral_movement',
]);

const LOW_CONFIDENCE_MEDIUM_ALERT_TYPES = new Set<string>([
  'new_external_destination',
  'new_listening_port',
  'sensitive_path_change',
  'firewall_change',
  'defender_controlled_folder_access_disabled',
]);

const CORROBORATION_REQUIRED_CRITICAL_ALERT_TYPES = new Set<string>([
  'arp_conflict',
]);

export { DEPLOYMENT_PROFILES, SECURITY_OPERATING_MODES, isDeploymentProfile, isSecurityOperatingMode };
export type { DeploymentProfile, SecurityOperatingMode };

export function assessSecurityPosture(input: SecurityPostureAssessmentInput): SecurityPostureAssessment {
  const activeAlerts = input.alerts
    .filter((alert) => (alert.status ?? (alert.acknowledged ? 'acknowledged' : 'active')) === 'active')
    .slice()
    .sort((a, b) => severityRank(b.severity) - severityRank(a.severity) || (b.timestamp ?? 0) - (a.timestamp ?? 0));

  const counts = {
    total: activeAlerts.length,
    low: activeAlerts.filter((alert) => alert.severity === 'low').length,
    medium: activeAlerts.filter((alert) => alert.severity === 'medium').length,
    high: activeAlerts.filter((alert) => alert.severity === 'high').length,
    critical: activeAlerts.filter((alert) => alert.severity === 'critical').length,
  };
  const bySource: Record<SecurityPostureSource, number> = { host: 0, network: 0, gateway: 0, native: 0, assistant: 0, install: 0 };
  for (const alert of activeAlerts) {
    bySource[alert.source] += 1;
  }

  const availableSources = [...new Set((input.availableSources ?? activeAlerts.map((alert) => alert.source)).filter(Boolean))]
    .filter((value): value is SecurityPostureSource => value === 'host' || value === 'network' || value === 'gateway' || value === 'native' || value === 'assistant' || value === 'install');

  const criticalAlerts = activeAlerts.filter((alert) => alert.severity === 'critical');
  const highAlerts = activeAlerts.filter((alert) => alert.severity === 'high');
  const mediumAlerts = activeAlerts.filter((alert) => alert.severity === 'medium');
  const actionableMediumAlerts = mediumAlerts.filter((alert) => !LOW_CONFIDENCE_MEDIUM_ALERT_TYPES.has(alert.type));
  const postureOnlyCriticalAlerts = criticalAlerts.filter((alert) => isPostureOnlyAlert(alert));
  const corroborationRequiredCriticalAlerts = criticalAlerts.filter((alert) => CORROBORATION_REQUIRED_CRITICAL_ALERT_TYPES.has(alert.type));
  const incidentCriticalAlerts = criticalAlerts.filter((alert) => (
    !LOCKDOWN_ALERT_TYPES.has(alert.type)
    && !isPostureOnlyAlert(alert)
    && !CORROBORATION_REQUIRED_CRITICAL_ALERT_TYPES.has(alert.type)
  ));
  const actionableHighAlerts = highAlerts.filter((alert) => !isPostureOnlyAlert(alert));
  const postureOnlyElevatedAlerts = activeAlerts.filter((alert) => isPostureOnlyAlert(alert) && severityRank(alert.severity) >= 3);
  const incidentCriticalSources = new Set(incidentCriticalAlerts.map((alert) => alert.source));
  const hasNonAssistantHighCorroboration = actionableHighAlerts.some((alert) => alert.source !== 'assistant');
  const reasons: string[] = [];

  let recommendedMode: SecurityOperatingMode = 'monitor';
  if (criticalAlerts.length > 0) {
    const lockdownCandidate = criticalAlerts.some((alert) => LOCKDOWN_ALERT_TYPES.has(alert.type))
      || incidentCriticalSources.size >= 2;
    if (lockdownCandidate) {
      recommendedMode = 'lockdown';
      reasons.push('Critical alerts indicate a likely active incident or weakened protection boundary.');
    } else if (incidentCriticalAlerts.length > 0) {
      recommendedMode = 'ir_assist';
      reasons.push('A critical alert is active and warrants operator-led investigation.');
    } else if (corroborationRequiredCriticalAlerts.length > 0 && hasNonAssistantHighCorroboration) {
      recommendedMode = 'ir_assist';
      reasons.push('A critical network signal is corroborated by additional elevated alerts and now warrants investigation mode.');
    } else {
      recommendedMode = 'guarded';
      if (postureOnlyCriticalAlerts.length > 0) {
        reasons.push('Critical assistant or package-install findings indicate meaningful posture risk, but they are posture-oriented signals rather than direct incident evidence.');
      }
      if (corroborationRequiredCriticalAlerts.length > 0) {
        reasons.push('A critical alert is active, but this signal class requires corroboration before incident-assist mode is warranted.');
      }
    }
  } else if (actionableHighAlerts.length >= 2 || (actionableHighAlerts.length >= 1 && new Set(actionableHighAlerts.map((alert) => alert.source)).size >= 2)) {
    recommendedMode = 'guarded';
    reasons.push('Multiple elevated alerts suggest raising controls while preserving normal operation where possible.');
  } else if (actionableHighAlerts.length === 1) {
    recommendedMode = 'guarded';
    reasons.push('A high-severity alert is active and should tighten approvals and outbound actions.');
  } else if (postureOnlyElevatedAlerts.length > 0) {
    recommendedMode = 'guarded';
    reasons.push('Assistant Security or package-install trust has high-risk posture findings. Tighten controls, but avoid incident-response mode until stronger runtime evidence appears.');
  } else if (actionableMediumAlerts.length >= 2 && new Set(actionableMediumAlerts.map((alert) => alert.source)).size >= 2) {
    recommendedMode = 'guarded';
    reasons.push('Medium-severity alerts across multiple sources suggest a broader issue than a single noisy signal.');
  }

  if (recommendedMode === 'monitor' && activeAlerts.length === 0) {
    reasons.push('No active alerts currently justify tighter controls.');
  } else if (recommendedMode === 'monitor' && activeAlerts.length > 0) {
    reasons.push('Active alerts are currently low-confidence, low-severity, or posture-oriented enough to stay in monitor mode without incident escalation.');
  }
  if (recommendedMode === 'ir_assist' && criticalAlerts.some((alert) => IR_ASSIST_ALERT_TYPES.has(alert.type))) {
    reasons.push('The active signal pattern fits investigation-oriented response rather than immediate full lockdown.');
  }
  if (availableSources.length === 0) {
    reasons.push('No alert sources are currently available, so recommendations are based on limited visibility.');
  }

  const shouldEscalate = MODE_RANK[recommendedMode] > MODE_RANK[input.currentMode];
  const summary = buildSummary({
    currentMode: input.currentMode,
    recommendedMode,
    shouldEscalate,
    counts,
    profile: input.profile,
  });

  return {
    profile: input.profile,
    currentMode: input.currentMode,
    recommendedMode,
    shouldEscalate,
    summary,
    reasons,
    counts,
    bySource,
    availableSources,
    topAlerts: activeAlerts.slice(0, 5),
  };
}

function severityRank(severity: SecurityPostureSeverity): number {
  switch (severity) {
    case 'critical': return 4;
    case 'high': return 3;
    case 'medium': return 2;
    default: return 1;
  }
}

function buildSummary(input: {
  profile: DeploymentProfile;
  currentMode: SecurityOperatingMode;
  recommendedMode: SecurityOperatingMode;
  shouldEscalate: boolean;
  counts: SecurityPostureAssessment['counts'];
}): string {
  const { currentMode, recommendedMode, shouldEscalate, counts, profile } = input;
  if (counts.total === 0) {
    return `Profile '${profile}' has no active alerts. Stay in '${currentMode}'.`;
  }
  if (!shouldEscalate && recommendedMode === currentMode) {
    return `Profile '${profile}' has ${counts.total} active alerts. '${currentMode}' remains appropriate for the current signal mix.`;
  }
  if (!shouldEscalate) {
    return `Profile '${profile}' has ${counts.total} active alerts. Current mode '${currentMode}' is already at or above the recommended posture.`;
  }
  return `Profile '${profile}' has ${counts.total} active alerts. Escalate from '${currentMode}' to '${recommendedMode}'.`;
}

function isPostureOnlyAlert(alert: SecurityPostureAlert): boolean {
  return alert.source === 'assistant'
    || alert.source === 'install'
    || alert.type.startsWith('assistant_security_')
    || alert.type.startsWith('package_install_');
}
