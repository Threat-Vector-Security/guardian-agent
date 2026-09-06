export type AppModuleMode = 'diagram' | 'grc';

export type GrcFindingType = 'threat' | 'vulnerability' | 'weakness' | 'observation';
export type GrcFindingSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';
export type GrcFindingSource = 'rule_engine' | 'manual' | 'ai_analysis';
export type GrcFindingStatus = 'open' | 'in_review' | 'accepted' | 'mitigated' | 'dismissed';

export type RiskStatus = 'draft' | 'assessed' | 'treated' | 'accepted' | 'closed';
export type RiskTreatmentStrategy = 'mitigate' | 'transfer' | 'avoid' | 'accept';
export type AssessmentStatus = 'draft' | 'in_review' | 'completed' | 'archived';
export type SoaApplicability = 'applicable' | 'not_applicable' | 'partially_applicable';
export type SoaImplementationStatus = 'implemented' | 'planned' | 'not_implemented' | 'in_progress';
export type SoaScopeType = 'system' | 'diagram' | 'assessment' | 'asset_group';
export type EvidenceKind = 'link' | 'file_reference';
export type ControlSetSourceType = 'built_in' | 'imported';
export type AssessmentScopeType = 'system' | 'diagram' | 'diagram_segment' | 'asset_group' | 'application' | 'osi_layer';
export type GrcTaskStatus = 'todo' | 'in_progress' | 'blocked' | 'done';
export type GrcTaskPriority = 'low' | 'medium' | 'high' | 'critical';
export type GrcTaskType = 'risk_treatment' | 'control_implementation' | 'assessment' | 'evidence' | 'review';
export type GrcAIContextScope = 'linked' | 'workspace';
export type GrcAIContextDetail = 'summary' | 'detailed';
export type GrcAssetDomain = 'it' | 'ot' | 'cloud' | 'iot' | 'application' | 'data' | 'network' | 'physical' | 'people';
export type GrcRiskPlanActionStatus = 'planned' | 'in_progress' | 'blocked' | 'done';
export type GrcGovernanceDocType = 'policy' | 'process' | 'procedure' | 'guideline' | 'sop' | 'standard' | 'framework' | 'other';
export type GrcGovernanceDocStatus = 'draft' | 'active' | 'under_review' | 'archived' | 'superseded';

export type GrcRemediationStatus =
  | 'identified' | 'confirmed' | 'remediation_planned' | 'remediation_in_progress'
  | 'remediated' | 'verified' | 'false_positive';

export type GrcSoaImportance = 'mandatory' | 'recommended' | 'optional';

export type GrcRiskAcceptanceScopeType = 'risk' | 'compliance' | 'policy';
export type GrcRiskAcceptanceStatus = 'draft' | 'pending_review' | 'approved' | 'rejected' | 'expired';

export type GrcControlAuditResult = 'pass' | 'fail' | 'partial' | 'pending';

export type GrcFrameworkMappingRelationship = 'equivalent' | 'partial' | 'related';

export type GrcEntityHealthLevel = 'green' | 'yellow' | 'red';

export type GrcIncidentSeverity = 'critical' | 'high' | 'medium' | 'low';
export type GrcIncidentStatus =
  | 'identified' | 'triaged' | 'investigating' | 'contained' | 'resolved' | 'closed';

export interface GrcEntityHealth {
  level: GrcEntityHealthLevel;
  reasons: string[];
}

export interface GrcRiskAcceptance {
  id: string;
  riskId: string;
  title: string;
  scopeType: GrcRiskAcceptanceScopeType;
  requestedBy: string;
  approvedBy: string;
  status: GrcRiskAcceptanceStatus;
  justification: string;
  conditions: string;
  emailLink?: string;
  effectiveDate: string;
  expirationDate: string;
  reviewDate: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface GrcControlAudit {
  id: string;
  plannedDate: string;
  actualDate: string;
  auditor: string;
  result: GrcControlAuditResult;
  evidenceRefs: string[];
  notes: string;
  createdAt: string;
}

export interface GrcFrameworkMapping {
  id: string;
  sourceControlSetId: string;
  sourceControlId: string;
  targetControlSetId: string;
  targetControlId: string;
  relationship: GrcFrameworkMappingRelationship;
  notes: string;
  createdAt: string;
}

export interface GrcIncidentTimelineEntry {
  id: string;
  date: string;
  description: string;
  actor: string;
}

export interface GrcIncident {
  id: string;
  title: string;
  description: string;
  severity: GrcIncidentSeverity;
  status: GrcIncidentStatus;
  detectedDate: string;
  resolvedDate: string;
  closedDate: string;
  owner: string;
  linkedRiskIds: string[];
  linkedAssetIds: string[];
  linkedFindingIds: string[];
  timelineEntries: GrcIncidentTimelineEntry[];
  lessonsLearned: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}
export type GrcThreatActorType = 'nation_state' | 'organised_crime' | 'insider' | 'hacktivist' | 'opportunistic' | 'competitor' | 'supply_chain';
export type GrcThreatActorResourceLevel = 'very_low' | 'low' | 'moderate' | 'high' | 'very_high';

export type GrcInitiativeCategory =
  | 'uplift' | 'remediation' | 'compliance' | 'transformation' | 'hardening' | 'other';

export type GrcInitiativeStatus =
  | 'proposed' | 'approved' | 'in_progress' | 'on_hold' | 'completed' | 'cancelled';

export type GrcInitiativePriority = 'critical' | 'high' | 'medium' | 'low';

export type GrcMilestoneStatus = 'pending' | 'in_progress' | 'completed' | 'skipped';

export type GrcImplementedControlType = 'technical' | 'administrative' | 'physical' | 'operational';
export type GrcImplementedControlStatus = 'active' | 'planned' | 'under_review' | 'deprecated' | 'inactive';
export type GrcImplementedControlAutomation = 'manual' | 'semi_automated' | 'fully_automated';
export type GrcImplementedControlCategory =
  | 'access_control' | 'encryption' | 'monitoring' | 'network_security'
  | 'endpoint_protection' | 'identity_management' | 'logging' | 'backup_recovery'
  | 'incident_response' | 'policy' | 'training' | 'physical_security' | 'other';

export interface GrcInitiativeMilestone {
  id: string;
  title: string;
  description: string;
  status: GrcMilestoneStatus;
  dueDate: string;
  completedDate: string;
  owner: string;
}

export interface GrcSecurityInitiative {
  id: string;
  title: string;
  description: string;
  category: GrcInitiativeCategory;
  status: GrcInitiativeStatus;
  priority: GrcInitiativePriority;
  owner: string;
  executiveSponsor: string;
  currentState: string;
  targetState: string;
  startDate: string;
  targetDate: string;
  completedDate: string;
  milestones: GrcInitiativeMilestone[];
  linkedRiskIds: string[];
  linkedControlSetIds: string[];
  linkedAssetIds: string[];
  linkedImplementedControlIds: string[];
  linkedAssessmentIds: string[];
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface GrcImplementedControl {
  id: string;
  title: string;
  description: string;
  controlType: GrcImplementedControlType;
  category: GrcImplementedControlCategory;
  status: GrcImplementedControlStatus;
  automationLevel: GrcImplementedControlAutomation;
  owner: string;
  vendor: string;
  product: string;
  version: string;
  implementedDate: string;
  lastReviewDate: string;
  nextReviewDate: string;
  linkedSoaEntryIds: string[];
  linkedRiskIds: string[];
  linkedAssetIds: string[];
  linkedAssessmentIds: string[];
  notes: string;
  auditHistory?: GrcControlAudit[];
  createdAt: string;
  updatedAt: string;
}

export type GrcThirdPartyCategory =
  | 'cloud_provider' | 'saas' | 'managed_service' | 'contractor'
  | 'supplier' | 'partner' | 'other';

export type GrcThirdPartyStatus =
  | 'active' | 'under_review' | 'onboarding' | 'offboarding' | 'terminated';

export type GrcThirdPartyRiskRating =
  | 'critical' | 'high' | 'medium' | 'low' | 'not_assessed';

export type GrcThirdPartyDataClassification =
  | 'public' | 'internal' | 'confidential' | 'restricted';

export interface GrcThirdParty {
  id: string;
  name: string;
  description: string;
  category: GrcThirdPartyCategory;
  status: GrcThirdPartyStatus;
  riskRating: GrcThirdPartyRiskRating;
  dataClassification: GrcThirdPartyDataClassification;
  linkedAssetIds: string[];
  linkedRiskIds: string[];
  contactName: string;
  contactEmail: string;
  contractExpiry: string;
  lastAssessmentDate: string;
  nextReviewDate: string;
  notes: string;
}

export interface RiskScaleValue {
  id: string;
  label: string;
  value: number;
  description?: string;
}

export interface RiskMatrixCell {
  likelihoodId: string;
  impactId: string;
  score: number;
  ratingLabel: string;
  color: string;
  exceedsAppetite: boolean;
}

export interface RiskTierNode {
  id: string;
  tier: 1 | 2 | 3 | 4;
  label: string;
  description?: string;
  parentId?: string;
  tags?: string[];
}

export interface GrcRiskModel {
  version: string;
  likelihoodScale: RiskScaleValue[];
  impactScale: RiskScaleValue[];
  matrix: RiskMatrixCell[];
  appetiteThresholdScore: number;
  updatedAt: string;
}

export interface DiagramNodeRef {
  diagramId: string;
  nodeId: string;
  nodeLabel?: string;
  nodeType?: string;
  sourceNodeId?: string;
  targetNodeId?: string;
}

export interface GrcAssetCriticality {
  confidentiality: number;
  integrity: number;
  availability: number;
  financial: number;
  reputation: number;
  safety: number;
}

export interface GrcAssetCategoryMap {
  it: string[];
  ot: string[];
  cloud: string[];
  iot: string[];
  application: string[];
  data: string[];
  network: string[];
  physical: string[];
  people: string[];
}

export interface GrcAssetCriticalityLevel {
  value: number;
  label: string;
}

export interface GrcAsset {
  id: string;
  name: string;
  type: string;
  domain: GrcAssetDomain;
  category: string;
  owner?: string;
  businessProcess?: string;
  description?: string;
  businessCriticality: number;
  securityCriticality: number;
  criticality: GrcAssetCriticality;
  diagramRefs: DiagramNodeRef[];
  isConnection?: boolean;
  businessUnit?: string;
  createdAt: string;
  updatedAt: string;
}

export interface GrcFinding {
  id: string;
  title: string;
  description: string;
  type: GrcFindingType;
  severity: GrcFindingSeverity;
  source: GrcFindingSource;
  status: GrcFindingStatus;
  category?: import('./ManualAnalysisTypes').ManualFindingCategory;
  ruleId?: string;
  strideCategories?: import('./ThreatIntelTypes').StrideCategory[];
  relatedNodeIds: string[];
  relatedEdgeIds: string[];
  linkedRiskIds: string[];
  linkedTaskIds: string[];
  linkedAssetIds: string[];
  recommendations: string[];
  owner?: string;
  notes?: string;
  remediationStatus?: GrcRemediationStatus;
  cvssScore?: number;
  createdAt: string;
  updatedAt: string;
}

export interface RiskScoreSnapshot {
  likelihoodId: string;
  impactId: string;
  rawScore: number;
  ratingLabel: string;
  color: string;
  exceedsAppetite: boolean;
  riskModelVersion: string;
  scoredAt: string;
  resolvedAppetiteThreshold?: number;
}

export interface RiskTierPath {
  tier1?: string;
  tier2?: string;
  tier3?: string;
  tier4?: string;
}

export interface DiagramRiskLink {
  diagramId: string;
  nodeIds: string[];
}

export interface GrcRisk {
  id: string;
  title: string;
  description?: string;
  status: RiskStatus;
  owner?: string;
  dueDate?: string;
  reviewCadenceDays?: number;
  tierPath: RiskTierPath;
  categoryId?: string;
  threatActorIds?: string[];
  assetIds: string[];
  diagramLinks: DiagramRiskLink[];
  inherentScore: RiskScoreSnapshot;
  residualScore?: RiskScoreSnapshot;
  treatmentStrategy: RiskTreatmentStrategy;
  treatmentPlan?: string;
  sourceFindingId?: string;
  businessUnit?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AssessmentScopeItem {
  id: string;
  type: AssessmentScopeType;
  value: string;
  name: string;
}

export type AssessmentThreatModelNodeSourceType = 'asset' | 'diagram_node' | 'dfd_custom';
export type AssessmentThreatModelEdgeSourceType = 'manual' | 'diagram_edge';

export interface AssessmentThreatModelPosition {
  x: number;
  y: number;
}

export interface AssessmentThreatModelNode {
  id: string;
  label: string;
  sourceType: AssessmentThreatModelNodeSourceType;
  position: AssessmentThreatModelPosition;
  nodeType?: string;
  shape?: string;
  iconName?: string;
  commentary?: string;
  assetId?: string;
  diagramId?: string;
  diagramNodeId?: string;
}

export interface AssessmentThreatModelEdge {
  id: string;
  source: string;
  target: string;
  sourceType: AssessmentThreatModelEdgeSourceType;
  label?: string;
  commentary?: string;
  diagramId?: string;
  diagramEdgeId?: string;
  pathOrder?: number;
}

export interface GrcAssessmentThreatModel {
  nodes: AssessmentThreatModelNode[];
  edges: AssessmentThreatModelEdge[];
  attackPathDescription?: string;
  attackPaths?: AssessmentAttackPath[];
  updatedAt: string;
}

export interface GrcRiskManagementPlanAction {
  id: string;
  title: string;
  owner?: string;
  dueDate?: string;
  status: GrcRiskPlanActionStatus;
  priority?: GrcTaskPriority;
  treatmentStrategy?: RiskTreatmentStrategy;
  linkedRiskIds: string[];
  notes?: string;
}

export interface GrcRiskManagementPlan {
  objective?: string;
  strategy?: string;
  residualRiskStatement?: string;
  monitoringApproach?: string;
  communicationPlan?: string;
  reviewCadenceDays?: number;
  actions: GrcRiskManagementPlanAction[];
  updatedAt: string;
}

export interface GrcAssessment {
  id: string;
  title: string;
  status: AssessmentStatus;
  scopeItems: AssessmentScopeItem[];
  tierFilter: RiskTierPath;
  riskManagementPlan: GrcRiskManagementPlan;
  threatModel?: GrcAssessmentThreatModel;
  owner?: string;
  reviewer?: string;
  startDate?: string;
  dueDate?: string;
  completedDate?: string;
  methodologyNote?: string;
  assumptionNote?: string;
  riskIds: string[];
  threatActorIds?: string[];
  soaGapIds: string[];
  taskIds: string[];
  linkedImplementedControlIds: string[];
  linkedInitiativeIds: string[];
  summary?: string;
  findings?: string;
  recommendations?: string;
  evidenceSummary?: string;
  businessUnit?: string;
  createdAt: string;
  updatedAt: string;
}

export interface GrcControl {
  id: string;
  controlId: string;
  title: string;
  description?: string;
  family?: string;
  tags?: string[];
  sourceRow?: number;
}

export interface GrcControlSet {
  id: string;
  name: string;
  version?: string;
  releaseDate?: string;
  sourceType: ControlSetSourceType;
  importedAt?: string;
  importSourceName?: string;
  controls: GrcControl[];
}

export interface GrcEvidenceReference {
  id: string;
  kind: EvidenceKind;
  name: string;
  url?: string;
  mimeType?: string;
  sizeBytes?: number;
  hash?: string;
  note?: string;
  governanceDocId?: string;
  createdAt: string;
}

export interface GrcSoaEntry {
  id: string;
  controlSetId: string;
  controlId: string;
  scopeType: SoaScopeType;
  scopeId: string;
  applicability: SoaApplicability;
  implementationStatus: SoaImplementationStatus;
  justification?: string;
  mitigatesRiskIds: string[];
  diagramRefs: DiagramNodeRef[];
  evidence: GrcEvidenceReference[];
  maturityLevel?: number;
  weight?: number;
  importance?: GrcSoaImportance;
  updatedAt: string;
}

export interface GrcTask {
  id: string;
  title: string;
  description?: string;
  type: GrcTaskType;
  status: GrcTaskStatus;
  priority: GrcTaskPriority;
  owner?: string;
  dueDate?: string;
  riskId?: string;
  controlSetId?: string;
  controlId?: string;
  assessmentId?: string;
  assetId?: string;
  sourceFindingId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RiskRatingThresholds {
  criticalThreshold: number;
  highThreshold: number;
  mediumThreshold: number;
}

export interface RiskRatingColors {
  critical: string;
  high: string;
  medium: string;
  low: string;
  unrated: string;
}

export interface RiskRatingBand {
  id: string;
  label: string;
  value: number;
  minScoreRatio: number;
  color: string;
}

export interface GrcRecordDefaults {
  assetDomain: GrcAssetDomain;
  assetCategory: string;
  assetBusinessCriticality: number;
  assetSecurityCriticality: number;
  assetCriticality: GrcAssetCriticality;
  riskStatus: RiskStatus;
  treatmentStrategy: RiskTreatmentStrategy;
  tier1Label: string;
  assessmentScopeType: AssessmentScopeType;
  assessmentScopeValue: string;
  assessmentScopeName: string;
  assessmentTierFilter: RiskTierPath;
}

export interface SoaDisplayLabels {
  applicability: Record<SoaApplicability, string>;
  implementationStatus: Record<SoaImplementationStatus, string>;
}

export interface ExportFilenames {
  assetsCsv: string;
  risksCsv: string;
  soaCsv: string;
  tasksCsv: string;
  plansCsv: string;
  threatProfilesCsv: string;
  appetiteRulesCsv: string;
  findingsCsv: string;
  governanceDocsCsv: string;
  thirdPartiesCsv: string;
  initiativesCsv: string;
  implementedControlsCsv: string;
  riskAcceptancesCsv: string;
  frameworkMappingsCsv: string;
  incidentsCsv: string;
}

export interface GrcProtocolOsiMapping {
  protocol: string;
  osiLayer: string;
}

export interface GrcAssessmentScopeConfig {
  enabledTypes: AssessmentScopeType[];
  systemScopeOptions: string[];
  applicationScopeOptions: string[];
  osiLayerOptions: string[];
  protocolOsiMappings: GrcProtocolOsiMapping[];
}

export interface MaturityLevel {
  level: number;
  label: string;
  description?: string;
}

export interface MaturityModel {
  id: string;
  name: string;
  levels: MaturityLevel[];
}

export interface TableColumnConfig {
  visibleColumnIds: string[];
}

export type GrcReportId =
  | 'executive_summary' | 'risk_register' | 'compliance_status'
  | 'assessment_summary' | 'findings_report' | 'threat_landscape'
  | 'governance_status' | 'risk_treatment_progress';

export interface GrcReportSectionDef { id: string; label: string; }
export interface GrcReportSectionConfig { visibleSectionIds: string[]; }
export interface GrcReportCatalogEntry {
  id: GrcReportId; title: string; description: string;
  icon: string; defaultSections: GrcReportSectionDef[];
}

export type CustomChartType =
  | 'bar' | 'horizontal_bar' | 'pie' | 'donut'
  | 'stacked_bar' | 'line' | 'area' | 'radar' | 'treemap';

export type CustomChartDataSourceKey =
  | 'risks' | 'assets' | 'findings' | 'workflowTasks'
  | 'thirdParties' | 'governanceDocuments' | 'threatActors'
  | 'soaEntries' | 'assessments' | 'threatScenarios' | 'appetiteRules'
  | 'securityInitiatives' | 'implementedControls' | 'incidents';

export type CustomChartTimeGranularity = 'week' | 'month' | 'quarter';
export type CustomChartColorScheme = 'default' | 'severity' | 'cool' | 'warm' | 'monochrome';

export interface CustomChartConfig {
  id: string;
  title: string;
  chartType: CustomChartType;
  dataSource: CustomChartDataSourceKey;
  groupByField: string;
  secondaryGroupByField?: string;
  timeGranularity?: CustomChartTimeGranularity;
  colorScheme: CustomChartColorScheme;
  createdAt: string;
  updatedAt: string;
}

export interface GrcWorkspaceConfig {
  ratingBands: RiskRatingBand[];
  ratingThresholds: RiskRatingThresholds;
  ratingColors: RiskRatingColors;
  assetCategories: GrcAssetCategoryMap;
  assetCriticalityScale: GrcAssetCriticalityLevel[];
  assessmentScopes: GrcAssessmentScopeConfig;
  recordDefaults: GrcRecordDefaults;
  soaLabels: SoaDisplayLabels;
  exportFilenames: ExportFilenames;
  tableColumns?: Record<string, TableColumnConfig>;
  reportSections?: Record<string, GrcReportSectionConfig>;
  customCharts?: CustomChartConfig[];
  maturityModels?: MaturityModel[];
  activeMaturityModelId?: string;
  businessUnits?: string[];
}

export interface GrcAIAssistConfig {
  enabled: boolean;
  contextScope: GrcAIContextScope;
  contextDetail: GrcAIContextDetail;
  includeAssets: boolean;
  includeRisks: boolean;
  includeSoaEntries: boolean;
  includeTasks: boolean;
  includeAssessments: boolean;
  includeThreatProfiles: boolean;
  includeGovernanceDocuments: boolean;
  includeAppetiteRules: boolean;
  includeFindings: boolean;
  includeThirdParties: boolean;
  includeSecurityInitiatives: boolean;
  includeImplementedControls: boolean;
  includeRiskAcceptances: boolean;
  includeFrameworkMappings: boolean;
  includeIncidents: boolean;
  maxItemsPerSection: number;
}

export interface GrcWorkspace {
  schemaVersion: '1.0';
  createdAt: string;
  updatedAt: string;
  riskModel: GrcRiskModel;
  tierCatalogue: RiskTierNode[];
  assets: GrcAsset[];
  findings: GrcFinding[];
  risks: GrcRisk[];
  assessments: GrcAssessment[];
  controlSets: GrcControlSet[];
  soaEntries: GrcSoaEntry[];
  workflowTasks: GrcTask[];
  governanceDocuments: GrcGovernanceDocument[];
  threatActors: GrcThreatActor[];
  threatScenarios: GrcThreatScenario[];
  appetiteRules: GrcAppetiteRule[];
  thirdParties: GrcThirdParty[];
  securityInitiatives: GrcSecurityInitiative[];
  implementedControls: GrcImplementedControl[];
  riskAcceptances: GrcRiskAcceptance[];
  frameworkMappings: GrcFrameworkMapping[];
  incidents: GrcIncident[];
  aiAssist: GrcAIAssistConfig;
  config?: GrcWorkspaceConfig;
}

export interface GrcDashboardMetrics {
  assetCount: number;
  highBusinessCriticalAssetCount: number;
  highSecurityCriticalAssetCount: number;
  assetsByDomain: Record<string, number>;
  riskCount: number;
  highAndCriticalRiskCount: number;
  openAssessmentCount: number;
  assessmentsWithPlansCount: number;
  openPlanActionCount: number;
  controlSetCount: number;
  soaEntryCount: number;
  implementedControlCount: number;
  notImplementedControlCount: number;
  applicableControlCount: number;
  openTaskCount: number;
  overdueTaskCount: number;
  dueSoonTaskCount: number;
  riskByRating: Record<string, number>;
  governanceDocumentCount: number;
  activeGovernanceDocumentCount: number;
  threatActorCount: number;
  threatScenarioCount: number;
  appetiteBreachCount: number;
  findingCount: number;
  openFindingCount: number;
  criticalHighFindingCount: number;
  thirdPartyCount: number;
  highRiskThirdPartyCount: number;
  initiativeCount: number;
  activeInitiativeCount: number;
  overdueInitiativeCount: number;
  implementedControlRegistryCount: number;
  activeImplementedControlRegistryCount: number;
  controlsOverdueForReviewCount: number;
  expiredAcceptanceCount: number;
  pendingAcceptanceCount: number;
  failedAuditCount: number;
  incidentCount: number;
  openIncidentCount: number;
}

export interface GrcWorkflowHealth {
  orphanRiskCount: number;
  unmitigatedHighRiskCount: number;
  controlsWithoutRiskLinksCount: number;
  implementedControlsWithoutEvidenceCount: number;
  overdueTaskCount: number;
  dueSoonTaskCount: number;
  assessmentCoveragePercent: number;
  appetiteBreachCount: number;
  governanceOverdueReviewCount: number;
  thirdPartyOverdueReviewCount: number;
  stalledInitiativeCount: number;
  overdueInitiativeMilestoneCount: number;
  implementedControlsOverdueReviewCount: number;
  expiredAcceptanceCount: number;
  pendingReviewAcceptanceCount: number;
  pendingAuditCount: number;
  staleOpenIncidentCount: number;
  recommendedActions: string[];
}

export interface DiagramNodeSummary {
  id: string;
  type?: string;
  label?: string;
  zone?: string;
  protocols?: string[];
  indexCode?: string;
}

export interface DiagramEdgeSummary {
  id: string;
  source: string;
  target: string;
  label?: string;
  zone?: string;
  protocol?: string;
  indexCode?: string;
}

export type { StrideCategory } from './ThreatIntelTypes';

export type AttackPathRiskLevel = 'Critical' | 'High' | 'Medium' | 'Low' | 'Info';

export interface DiagramAttackPathStep {
  order: number;
  edgeId: string;
  sourceNodeId: string;
  targetNodeId: string;
  technique?: string;
}

export interface DiagramAttackPath {
  id: string;
  name: string;
  strideCategory: import('./ThreatIntelTypes').StrideCategory;
  riskLevel: AttackPathRiskLevel;
  description: string;
  steps: DiagramAttackPathStep[];
  mitreTechniques?: string[];
  pastaStage?: import('../utils/attackPathUtils').PastaStageId;
  createdAt: string;
  updatedAt: string;
}

export interface AssessmentAttackPathStep {
  order: number;
  edgeId: string;
  sourceNodeId: string;
  targetNodeId: string;
  technique?: string;
}

export interface AssessmentAttackPath {
  id: string;
  name: string;
  strideCategory: import('./ThreatIntelTypes').StrideCategory;
  riskLevel: AttackPathRiskLevel;
  description: string;
  steps: AssessmentAttackPathStep[];
  diagramAttackPathId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DiagramContextSnapshot {
  diagramId: string;
  systemName: string;
  nodes: DiagramNodeSummary[];
  edges?: DiagramEdgeSummary[];
  edgeCount: number;
  selectedNodeIds?: string[];
  attackPaths?: DiagramAttackPath[];
  updatedAt: string;
}

export interface GrcGovernanceDocument {
  id: string;
  title: string;
  type: GrcGovernanceDocType;
  description?: string;
  owner?: string;
  reviewDate?: string;
  nextReviewDate?: string;
  status: GrcGovernanceDocStatus;
  version?: string;
  url?: string;
  tags?: string[];
  linkedRiskIds: string[];
  linkedControlSetIds: string[];
  linkedAssessmentIds: string[];
  reviewedBy?: string;
  approvedBy?: string;
  approvalDate?: string;
  createdAt: string;
  updatedAt: string;
}

export interface GrcThreatActor {
  id: string;
  name: string;
  type: GrcThreatActorType;
  capabilityLevel: number;
  resourceLevel: GrcThreatActorResourceLevel;
  motivation: string;
  description?: string;
  targetedAssetIds: string[];
  targetedAssetDomains?: GrcAssetDomain[];
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface GrcThreatScenario {
  id: string;
  title: string;
  description: string;
  threatActorId: string;
  targetedAssetIds: string[];
  attackTechniques: string[];
  linkedRiskIds: string[];
  linkedAssessmentIds?: string[];
  likelihood?: string;
  impact?: string;
  createdAt: string;
  updatedAt: string;
}

export interface GrcAppetiteRule {
  id: string;
  name: string;
  description?: string;
  scopeAssetDomain?: GrcAssetDomain;
  scopeTier1?: string;
  scopeAssetCriticalityMin?: number;
  thresholdScore: number;
  createdAt: string;
  updatedAt: string;
}

export interface Tier3ImportRow {
  tier2?: string;
  tier3: string;
  description?: string;
  tags?: string[];
}

export interface ControlImportRow {
  controlId: string;
  title: string;
  description?: string;
  family?: string;
  tags?: string[];
  sourceRow?: number;
}
