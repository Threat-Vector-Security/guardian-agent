import { GrcWorkspace, GrcAsset, GrcFinding, GrcRisk, GrcAssessment, GrcSoaEntry, GrcTask, GrcGovernanceDocument, GrcThreatActor, GrcThreatScenario, GrcAppetiteRule, GrcThirdParty, GrcImplementedControl, GrcSecurityInitiative, GrcAIAssistConfig, GrcControlSet, RiskTierNode, RiskScaleValue } from '../../types/GrcTypes';
import { buildRiskMatrix, calculateRiskScore, createDefaultConfig } from '../../services/GrcWorkspaceService';

export const NOW = '2025-06-01T00:00:00.000Z';

export const LIKELIHOOD_SCALE: RiskScaleValue[] = [
  { id: 'likelihood-1', label: 'Rare', value: 1, description: 'Unlikely to occur' },
  { id: 'likelihood-2', label: 'Unlikely', value: 2, description: 'Could occur but not expected' },
  { id: 'likelihood-3', label: 'Possible', value: 3, description: 'Might occur at some time' },
  { id: 'likelihood-4', label: 'Likely', value: 4, description: 'Will probably occur' },
  { id: 'likelihood-5', label: 'Almost Certain', value: 5, description: 'Expected to occur' },
];

export const IMPACT_SCALE: RiskScaleValue[] = [
  { id: 'impact-1', label: 'Negligible', value: 1, description: 'Minor impact' },
  { id: 'impact-2', label: 'Minor', value: 2, description: 'Noticeable but contained' },
  { id: 'impact-3', label: 'Moderate', value: 3, description: 'Significant operational impact' },
  { id: 'impact-4', label: 'Major', value: 4, description: 'Serious business impact' },
  { id: 'impact-5', label: 'Critical', value: 5, description: 'Existential threat to business' },
];

export const APPETITE_THRESHOLD = 12;

const matrix = buildRiskMatrix(LIKELIHOOD_SCALE, IMPACT_SCALE, APPETITE_THRESHOLD);

export const BASE_RISK_MODEL = {
  version: 'v-shared-base',
  likelihoodScale: LIKELIHOOD_SCALE,
  impactScale: IMPACT_SCALE,
  matrix,
  appetiteThresholdScore: APPETITE_THRESHOLD,
  updatedAt: NOW,
};

export function score(likelihoodId: string, impactId: string) {
  return calculateRiskScore(BASE_RISK_MODEL, likelihoodId, impactId);
}

export const OWASP_CONTROL_SET_ID = 'cs-owasp-top10';
export const CIS_CONTROL_SET_ID = 'cs-cis-controls-v8';

export const SHARED_CONTROL_SETS: GrcControlSet[] = [
  {
    id: OWASP_CONTROL_SET_ID,
    name: 'OWASP Top 10 (2021)',
    version: '2021',
    releaseDate: '2021-09',
    sourceType: 'built_in' as const,
    importedAt: NOW,
    controls: [
      { id: 'ctrl-a01', controlId: 'A01', title: 'Broken Access Control', family: 'OWASP Top 10 2021' },
      { id: 'ctrl-a02', controlId: 'A02', title: 'Cryptographic Failures', family: 'OWASP Top 10 2021' },
      { id: 'ctrl-a03', controlId: 'A03', title: 'Injection', family: 'OWASP Top 10 2021' },
      { id: 'ctrl-a04', controlId: 'A04', title: 'Insecure Design', family: 'OWASP Top 10 2021' },
      { id: 'ctrl-a05', controlId: 'A05', title: 'Security Misconfiguration', family: 'OWASP Top 10 2021' },
      { id: 'ctrl-a06', controlId: 'A06', title: 'Vulnerable and Outdated Components', family: 'OWASP Top 10 2021' },
      { id: 'ctrl-a07', controlId: 'A07', title: 'Identification and Authentication Failures', family: 'OWASP Top 10 2021' },
      { id: 'ctrl-a08', controlId: 'A08', title: 'Software and Data Integrity Failures', family: 'OWASP Top 10 2021' },
      { id: 'ctrl-a09', controlId: 'A09', title: 'Security Logging and Monitoring Failures', family: 'OWASP Top 10 2021' },
      { id: 'ctrl-a10', controlId: 'A10', title: 'Server-Side Request Forgery', family: 'OWASP Top 10 2021' },
    ],
  },
  {
    id: CIS_CONTROL_SET_ID,
    name: 'CIS Controls v8 (Subset)',
    version: '8.0',
    releaseDate: '2021-05',
    sourceType: 'imported' as const,
    importedAt: NOW,
    controls: [
      { id: 'cis-ctrl-01', controlId: 'CIS.01', title: 'Inventory and Control of Enterprise Assets', family: 'CIS Controls v8' },
      { id: 'cis-ctrl-02', controlId: 'CIS.02', title: 'Inventory and Control of Software Assets', family: 'CIS Controls v8' },
      { id: 'cis-ctrl-03', controlId: 'CIS.03', title: 'Data Protection', family: 'CIS Controls v8' },
      { id: 'cis-ctrl-04', controlId: 'CIS.04', title: 'Secure Configuration of Enterprise Assets and Software', family: 'CIS Controls v8' },
      { id: 'cis-ctrl-05', controlId: 'CIS.05', title: 'Account Management', family: 'CIS Controls v8' },
      { id: 'cis-ctrl-06', controlId: 'CIS.06', title: 'Access Control Management', family: 'CIS Controls v8' },
      { id: 'cis-ctrl-07', controlId: 'CIS.07', title: 'Continuous Vulnerability Management', family: 'CIS Controls v8' },
      { id: 'cis-ctrl-08', controlId: 'CIS.08', title: 'Audit Log Management', family: 'CIS Controls v8' },
    ],
  },
];

export const DEFAULT_AI_ASSIST: GrcAIAssistConfig = {
  enabled: true,
  contextScope: 'linked',
  contextDetail: 'summary',
  includeAssets: true,
  includeRisks: true,
  includeSoaEntries: true,
  includeTasks: true,
  includeAssessments: true,
  includeThreatProfiles: true,
  includeGovernanceDocuments: true,
  includeAppetiteRules: true,
  includeFindings: true,
  includeThirdParties: true,
  includeSecurityInitiatives: true,
  includeImplementedControls: true,
  includeRiskAcceptances: true,
  includeFrameworkMappings: true,
  includeIncidents: true,
  maxItemsPerSection: 20,
};

export const DEFAULT_APPETITE_RULES: GrcAppetiteRule[] = [
  {
    id: 'appetite-mission-critical',
    name: 'Mission-Critical Assets',
    description: 'Lower appetite threshold for risks affecting assets with maximum business criticality.',
    scopeAssetCriticalityMin: 5,
    thresholdScore: 8,
    createdAt: NOW,
    updatedAt: NOW,
  },
  {
    id: 'appetite-cyber-tier',
    name: 'Cyber Risk Tier',
    description: 'Reduced appetite for all risks classified under the Cyber Risk tier.',
    scopeTier1: 'Cyber Risk',
    thresholdScore: 10,
    createdAt: NOW,
    updatedAt: NOW,
  },
];

export interface GrcSystemData {
  tierCatalogue: RiskTierNode[];
  assets: GrcAsset[];
  findings?: GrcFinding[];
  risks: GrcRisk[];
  assessments: GrcAssessment[];
  soaEntries: GrcSoaEntry[];
  workflowTasks?: GrcTask[];
  governanceDocuments?: GrcGovernanceDocument[];
  threatActors?: GrcThreatActor[];
  threatScenarios?: GrcThreatScenario[];
  appetiteRules?: GrcAppetiteRule[];
  thirdParties?: GrcThirdParty[];
  securityInitiatives?: GrcSecurityInitiative[];
  implementedControls?: GrcImplementedControl[];
}

export function buildGrcWorkspace(data: GrcSystemData): GrcWorkspace {
  return {
    schemaVersion: '1.0',
    createdAt: NOW,
    updatedAt: NOW,
    riskModel: BASE_RISK_MODEL,
    tierCatalogue: data.tierCatalogue,
    assets: data.assets,
    findings: data.findings ?? [],
    risks: data.risks,
    assessments: data.assessments,
    controlSets: SHARED_CONTROL_SETS,
    soaEntries: data.soaEntries,
    workflowTasks: data.workflowTasks ?? [],
    governanceDocuments: data.governanceDocuments ?? [],
    threatActors: data.threatActors ?? [],
    threatScenarios: data.threatScenarios ?? [],
    appetiteRules: data.appetiteRules ?? DEFAULT_APPETITE_RULES,
    thirdParties: data.thirdParties ?? [],
    securityInitiatives: data.securityInitiatives ?? [],
    implementedControls: data.implementedControls ?? [],
    riskAcceptances: [],
    frameworkMappings: [],
    incidents: [],
    aiAssist: DEFAULT_AI_ASSIST,
    config: createDefaultConfig(),
  };
}
