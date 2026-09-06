import {
  AssessmentThreatModelEdge,
  AssessmentThreatModelEdgeSourceType,
  AssessmentThreatModelNode,
  AssessmentThreatModelNodeSourceType,
  AssessmentScopeItem,
  AssessmentScopeType,
  ControlImportRow,
  CustomChartType,
  CustomChartDataSourceKey,
  CustomChartColorScheme,
  CustomChartTimeGranularity,
  GrcAIAssistConfig,
  GrcAppetiteRule,
  DiagramContextSnapshot,
  DiagramNodeRef,
  DiagramNodeSummary,
  DiagramEdgeSummary,
  GrcAsset,
  GrcAssetCategoryMap,
  GrcAssetCriticality,
  GrcAssetCriticalityLevel,
  GrcAssetDomain,
  GrcAssessment,
  GrcAssessmentThreatModel,
  GrcAssessmentScopeConfig,
  GrcControl,
  GrcControlSet,
  GrcDashboardMetrics,
  GrcEvidenceReference,
  GrcFinding,
  GrcFindingSeverity,
  GrcGovernanceDocument,
  GrcFindingSource,
  GrcReportCatalogEntry,
  GrcReportId,
  GrcReportSectionConfig,
  GrcFindingStatus,
  GrcFindingType,
  MaturityModel,
  GrcProtocolOsiMapping,
  GrcRisk,
  GrcRiskModel,
  GrcRiskManagementPlan,
  GrcRiskManagementPlanAction,
  GrcRiskPlanActionStatus,
  GrcSoaEntry,
  GrcTask,
  GrcTaskPriority,
  GrcTaskStatus,
  GrcTaskType,
  GrcThreatActor,
  GrcThirdParty,
  GrcThirdPartyCategory,
  GrcThirdPartyDataClassification,
  GrcThirdPartyRiskRating,
  GrcThirdPartyStatus,
  GrcSecurityInitiative,
  GrcInitiativeCategory,
  GrcInitiativeStatus,
  GrcInitiativePriority,
  GrcImplementedControl,
  GrcImplementedControlType,
  GrcImplementedControlStatus,
  GrcImplementedControlAutomation,
  GrcImplementedControlCategory,
  GrcMilestoneStatus,
  GrcThreatActorResourceLevel,
  GrcThreatActorType,
  GrcThreatScenario,
  GrcWorkflowHealth,
  GrcWorkspace,
  GrcWorkspaceConfig,
  GrcRiskAcceptance,
  GrcRiskAcceptanceStatus,
  GrcRiskAcceptanceScopeType,
  GrcControlAudit,
  GrcControlAuditResult,
  GrcFrameworkMapping,
  GrcFrameworkMappingRelationship,
  GrcEntityHealth,
  GrcEntityHealthLevel,
  GrcIncident,
  GrcIncidentSeverity,
  GrcIncidentStatus,
  GrcRemediationStatus,
  GrcSoaImportance,
  RiskMatrixCell,
  RiskRatingBand,
  RiskRatingColors,
  RiskRatingThresholds,
  RiskScaleValue,
  RiskStatus,
  RiskTreatmentStrategy,
  SoaApplicability,
  SoaImplementationStatus,
  Tier3ImportRow,
  DiagramAttackPath
} from '../types/GrcTypes';

const nowIso = (): string => new Date().toISOString();

const createId = (prefix: string): string =>
  `${prefix}-${Math.random().toString(36).slice(2, 8)}-${Date.now().toString(36)}`;

export const generateFindingId = (
  existingFindings: { id: string }[],
  assets: { id: string; name: string }[],
  linkedAssetIds: string[]
): string => {
  const firstAssetId = linkedAssetIds[0];
  let code = 'GEN';
  if (firstAssetId) {
    const asset = assets.find(a => a.id === firstAssetId);
    if (asset) {
      const words = asset.name.replace(/[^a-zA-Z0-9\s]/g, '').trim().split(/\s+/).filter(Boolean);
      code = words.map(w =>
        /^\d/.test(w) || w === w.toUpperCase() ? w : w[0].toUpperCase()
      ).join('');
      if (code.length > 6) code = code.slice(0, 6);
      if (!code) code = 'ASSET';
    }
  }
  const prefix = `FIND-${code}-`;
  let maxNum = 0;
  for (const f of existingFindings) {
    if (f.id.startsWith(prefix)) {
      const num = parseInt(f.id.slice(prefix.length), 10);
      if (!isNaN(num) && num > maxNum) maxNum = num;
    }
  }
  return `${prefix}${String(maxNum + 1).padStart(3, '0')}`;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const asArray = <T = unknown>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : []);

const asString = (value: unknown, fallback = ''): string =>
  typeof value === 'string' ? value : fallback;

const asNumber = (value: unknown, fallback = 0): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;

const asBoolean = (value: unknown, fallback = false): boolean =>
  typeof value === 'boolean' ? value : fallback;

const toSlug = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);

const defaultCriticality = (): GrcAssetCriticality => ({
  confidentiality: 3,
  integrity: 3,
  availability: 3,
  financial: 3,
  reputation: 3,
  safety: 3
});

const defaultAssetCategories = (): GrcAssetCategoryMap => ({
  it: ['Servers', 'Network Infrastructure', 'Endpoints', 'Cloud Infrastructure', 'Security Tools'],
  ot: ['PLC', 'SCADA/HMI', 'Industrial Network', 'Controllers', 'Physical Sensors'],
  cloud: ['Cloud Service', 'Cloud Storage', 'Cloud Database', 'Managed Service', 'Serverless Function'],
  iot: ['IoT Device', 'Edge Gateway', 'Sensor Network', 'Connected Device', 'Actuator'],
  application: ['Web Application', 'API Service', 'Database', 'Identity Service', 'Business Application'],
  data: ['Data Warehouse', 'Data Lake', 'ETL Pipeline', 'Data Store', 'Backup'],
  network: ['VPN Tunnel', 'API Connection', 'Data Flow', 'Network Link', 'Load Balancer'],
  physical: ['Data Center', 'Physical Server', 'Facility', 'Access Point', 'Media'],
  people: ['User/Employee', 'External User', 'Contractor', 'Service Account', 'Administrator']
});

const defaultAssetCriticalityScale = (): GrcAssetCriticalityLevel[] => [
  { value: 1, label: 'Very Low' },
  { value: 2, label: 'Low' },
  { value: 3, label: 'Moderate' },
  { value: 4, label: 'High' },
  { value: 5, label: 'Mission Critical' }
];

const assessmentScopeTypes: AssessmentScopeType[] = [
  'system',
  'diagram',
  'diagram_segment',
  'asset_group',
  'application',
  'osi_layer'
];

export const assessmentScopeTypeLabels: Record<AssessmentScopeType, string> = {
  system: 'System',
  diagram: 'Diagram',
  diagram_segment: 'Security Zone',
  asset_group: 'Asset Group',
  application: 'Application',
  osi_layer: 'OSI Layer'
};

const normalizeAssessmentScopeType = (
  value: unknown,
  fallback: AssessmentScopeType
): AssessmentScopeType => {
  const candidate = asString(value);
  return assessmentScopeTypes.includes(candidate as AssessmentScopeType)
    ? (candidate as AssessmentScopeType)
    : fallback;
};

const defaultAssessmentScopeConfig = (): GrcAssessmentScopeConfig => ({
  enabledTypes: [...assessmentScopeTypes],
  systemScopeOptions: ['Whole System', 'Production', 'Staging', 'Development', 'DR / BCP'],
  applicationScopeOptions: ['Customer-Facing', 'Internal Line-of-Business', 'Integration Platform'],
  osiLayerOptions: [
    'L1 Physical',
    'L2 Data Link',
    'L3 Network',
    'L4 Transport',
    'L5 Session',
    'L6 Presentation',
    'L7 Application'
  ],
  protocolOsiMappings: [
    { protocol: 'Ethernet', osiLayer: 'L2 Data Link' },
    { protocol: 'ARP', osiLayer: 'L2 Data Link' },
    { protocol: 'IP', osiLayer: 'L3 Network' },
    { protocol: 'ICMP', osiLayer: 'L3 Network' },
    { protocol: 'TCP', osiLayer: 'L4 Transport' },
    { protocol: 'UDP', osiLayer: 'L4 Transport' },
    { protocol: 'TLS', osiLayer: 'L6 Presentation' },
    { protocol: 'HTTPS', osiLayer: 'L7 Application' },
    { protocol: 'HTTP', osiLayer: 'L7 Application' },
    { protocol: 'SSH', osiLayer: 'L7 Application' },
    { protocol: 'DNS', osiLayer: 'L7 Application' },
    { protocol: 'MQTT', osiLayer: 'L7 Application' },
    { protocol: 'Modbus', osiLayer: 'L7 Application' },
    { protocol: 'DNP3', osiLayer: 'L7 Application' }
  ]
});

const normalizeScopeOptionList = (raw: unknown, fallback: string[]): string[] => {
  const parsed = asArray<string>(raw)
    .map(item => (typeof item === 'string' ? item.trim() : ''))
    .filter(Boolean);
  if (parsed.length === 0) {
    return [...fallback];
  }
  return Array.from(new Set(parsed));
};

const normalizeProtocolOsiMappings = (
  raw: unknown,
  fallback: GrcProtocolOsiMapping[]
): GrcProtocolOsiMapping[] => {
  const parsed = asArray<Record<string, unknown>>(raw)
    .map(item => ({
      protocol: asString(item.protocol).trim(),
      osiLayer: asString(item.osiLayer).trim()
    }))
    .filter(item => item.protocol.length > 0 && item.osiLayer.length > 0);

  if (parsed.length === 0) {
    return fallback.map(item => ({ ...item }));
  }

  const deduped = new Map<string, GrcProtocolOsiMapping>();
  parsed.forEach(item => {
    const key = item.protocol.toLowerCase();
    if (!deduped.has(key)) {
      deduped.set(key, item);
    }
  });
  return Array.from(deduped.values());
};

const normalizeAssessmentScopeConfig = (
  raw: unknown,
  fallback: GrcAssessmentScopeConfig
): GrcAssessmentScopeConfig => {
  const value = isRecord(raw) ? raw : {};
  const parsedTypes = asArray<string>(value.enabledTypes)
    .map(item => normalizeAssessmentScopeType(item, 'system'))
    .filter((item, index, array) => array.indexOf(item) === index);
  return {
    enabledTypes: parsedTypes.length > 0 ? parsedTypes : [...fallback.enabledTypes],
    systemScopeOptions: normalizeScopeOptionList(value.systemScopeOptions, fallback.systemScopeOptions),
    applicationScopeOptions: normalizeScopeOptionList(value.applicationScopeOptions, fallback.applicationScopeOptions),
    osiLayerOptions: normalizeScopeOptionList(value.osiLayerOptions, fallback.osiLayerOptions),
    protocolOsiMappings: normalizeProtocolOsiMappings(value.protocolOsiMappings, fallback.protocolOsiMappings)
  };
};

const parseDelimitedProtocols = (value: string): string[] =>
  value
    .split(/[;,/|]/g)
    .map(item => item.trim())
    .filter(Boolean);

const normalizeAssessmentScopeItem = (
  item: unknown,
  fallbackType: AssessmentScopeType,
  fallbackName: string
): AssessmentScopeItem | null => {
  if (!isRecord(item)) {
    return null;
  }
  const type = normalizeAssessmentScopeType(item.type, fallbackType);
  const value = asString(item.value).trim() || asString(item.id).trim() || fallbackName;
  const name = asString(item.name, value || fallbackName).trim() || fallbackName;
  return {
    id: asString(item.id, `${type}-${toSlug(value || name) || createId('scope')}`),
    type,
    value,
    name
  };
};

const createDefaultRiskManagementPlan = (): GrcRiskManagementPlan => ({
  objective: undefined,
  strategy: undefined,
  residualRiskStatement: undefined,
  monitoringApproach: undefined,
  communicationPlan: undefined,
  reviewCadenceDays: undefined,
  actions: [],
  updatedAt: nowIso()
});

const parseRiskPlanActionStatus = (value: unknown): GrcRiskPlanActionStatus => {
  const candidate = asString(value);
  return candidate === 'planned' || candidate === 'in_progress' || candidate === 'blocked' || candidate === 'done'
    ? candidate
    : 'planned';
};

const validTreatmentStrategies = new Set<RiskTreatmentStrategy>(['mitigate', 'transfer', 'avoid', 'accept']);
const validActionPriorities = new Set<GrcTaskPriority>(['low', 'medium', 'high', 'critical']);

const parseRiskManagementPlan = (value: unknown): GrcRiskManagementPlan => {
  const item = isRecord(value) ? value : {};
  const actions = asArray<Record<string, unknown>>(item.actions).map(action => {
    const pri = asString(action.priority) as GrcTaskPriority;
    const treat = asString(action.treatmentStrategy) as RiskTreatmentStrategy;
    return {
      id: asString(action.id, createId('rmp-action')),
      title: asString(action.title, 'Action'),
      owner: asString(action.owner) || undefined,
      dueDate: asString(action.dueDate) || undefined,
      status: parseRiskPlanActionStatus(action.status),
      priority: validActionPriorities.has(pri) ? pri : undefined,
      treatmentStrategy: validTreatmentStrategies.has(treat) ? treat : undefined,
      linkedRiskIds: asArray<string>(action.linkedRiskIds).filter(Boolean),
      notes: asString(action.notes) || undefined
    };
  }) as GrcRiskManagementPlanAction[];

  return {
    objective: asString(item.objective) || undefined,
    strategy: asString(item.strategy) || undefined,
    residualRiskStatement: asString(item.residualRiskStatement) || undefined,
    monitoringApproach: asString(item.monitoringApproach) || undefined,
    communicationPlan: asString(item.communicationPlan) || undefined,
    reviewCadenceDays: asNumber(item.reviewCadenceDays, 0) || undefined,
    actions,
    updatedAt: asString(item.updatedAt, nowIso())
  };
};

const allowedAssessmentThreatModelNodeSourceTypes = new Set<AssessmentThreatModelNodeSourceType>([
  'asset',
  'diagram_node',
  'dfd_custom'
]);

const allowedAssessmentThreatModelEdgeSourceTypes = new Set<AssessmentThreatModelEdgeSourceType>([
  'manual',
  'diagram_edge'
]);

const parseAssessmentThreatModelNodeSourceType = (value: unknown): AssessmentThreatModelNodeSourceType => {
  const candidate = asString(value, 'diagram_node');
  return allowedAssessmentThreatModelNodeSourceTypes.has(candidate as AssessmentThreatModelNodeSourceType)
    ? (candidate as AssessmentThreatModelNodeSourceType)
    : 'diagram_node';
};

const parseAssessmentThreatModelEdgeSourceType = (value: unknown): AssessmentThreatModelEdgeSourceType => {
  const candidate = asString(value, 'manual');
  return allowedAssessmentThreatModelEdgeSourceTypes.has(candidate as AssessmentThreatModelEdgeSourceType)
    ? (candidate as AssessmentThreatModelEdgeSourceType)
    : 'manual';
};

const parseAssessmentThreatModel = (value: unknown): GrcAssessmentThreatModel => {
  const item = isRecord(value) ? value : {};

  const nodes = asArray<unknown>(item.nodes)
    .map(node => {
      if (!isRecord(node)) {
        return null;
      }

      const id = asString(node.id).trim();
      if (!id) {
        return null;
      }

      const position = isRecord(node.position) ? node.position : {};
      const label = asString(node.label, id).trim() || id;

      const parsedNode: AssessmentThreatModelNode = {
        id,
        label,
        sourceType: parseAssessmentThreatModelNodeSourceType(node.sourceType),
        position: {
          x: asNumber(position.x, 0),
          y: asNumber(position.y, 0)
        },
        nodeType: asString(node.nodeType).trim() || undefined,
        shape: asString(node.shape).trim() || undefined,
        iconName: asString(node.iconName).trim() || undefined,
        commentary: asString(node.commentary).trim() || undefined,
        assetId: asString(node.assetId).trim() || undefined,
        diagramId: asString(node.diagramId).trim() || undefined,
        diagramNodeId: asString(node.diagramNodeId).trim() || undefined
      };

      return parsedNode;
    })
    .filter((node): node is AssessmentThreatModelNode => node !== null);

  const nodeIdSet = new Set(nodes.map(node => node.id));

  const edges = asArray<unknown>(item.edges)
    .map(edge => {
      if (!isRecord(edge)) {
        return null;
      }

      const id = asString(edge.id).trim();
      const source = asString(edge.source).trim();
      const target = asString(edge.target).trim();
      if (!id || !source || !target) {
        return null;
      }
      if (!nodeIdSet.has(source) || !nodeIdSet.has(target)) {
        return null;
      }

      const parsedEdge: AssessmentThreatModelEdge = {
        id,
        source,
        target,
        sourceType: parseAssessmentThreatModelEdgeSourceType(edge.sourceType),
        label: asString(edge.label).trim() || undefined,
        commentary: asString(edge.commentary).trim() || undefined,
        diagramId: asString(edge.diagramId).trim() || undefined,
        diagramEdgeId: asString(edge.diagramEdgeId).trim() || undefined,
        pathOrder: (() => {
          const parsed = Math.floor(asNumber(edge.pathOrder, 0));
          return parsed > 0 ? parsed : undefined;
        })()
      };

      return parsedEdge;
    })
    .filter((edge): edge is AssessmentThreatModelEdge => edge !== null);

  return {
    nodes,
    edges,
    attackPathDescription: asString(item.attackPathDescription).trim() || undefined,
    updatedAt: asString(item.updatedAt, nowIso())
  };
};

const normalizeCategoryList = (raw: unknown, fallback: string[]): string[] => {
  const parsed = asArray<string>(raw)
    .map(item => (typeof item === 'string' ? item.trim() : ''))
    .filter(Boolean);

  if (parsed.length > 0) {
    return Array.from(new Set(parsed));
  }
  return [...fallback];
};

const normalizeAssetCategories = (raw: unknown, fallback: GrcAssetCategoryMap): GrcAssetCategoryMap => {
  const value = isRecord(raw) ? raw : {};
  return {
    it: normalizeCategoryList(value.it, fallback.it),
    ot: normalizeCategoryList(value.ot, fallback.ot),
    cloud: normalizeCategoryList(value.cloud, fallback.cloud),
    iot: normalizeCategoryList(value.iot, fallback.iot),
    application: normalizeCategoryList(value.application, fallback.application),
    data: normalizeCategoryList(value.data, fallback.data),
    network: normalizeCategoryList(value.network, fallback.network),
    physical: normalizeCategoryList(value.physical, fallback.physical),
    people: normalizeCategoryList(value.people, fallback.people)
  };
};

const normalizeAssetCriticalityScale = (
  levels: GrcAssetCriticalityLevel[],
  fallback: GrcAssetCriticalityLevel[]
): GrcAssetCriticalityLevel[] => {
  const parsed = levels
    .map((level, index) => ({
      value: Math.max(1, Math.round(asNumber(level.value, fallback[index]?.value ?? (index + 1)))),
      label: asString(level.label, fallback[index]?.label || `Level ${index + 1}`).trim()
    }))
    .filter(level => level.label.length > 0);

  const dedupedByValue = new Map<number, GrcAssetCriticalityLevel>();
  parsed.forEach(level => {
    if (!dedupedByValue.has(level.value)) {
      dedupedByValue.set(level.value, level);
    }
  });

  const candidate = Array.from(dedupedByValue.values());
  if (candidate.length < 2) {
    return fallback.map(item => ({ ...item }));
  }
  return candidate.sort((a, b) => a.value - b.value);
};

const ALL_ASSET_DOMAINS: GrcAssetDomain[] = ['it', 'ot', 'cloud', 'iot', 'application', 'data', 'network', 'physical', 'people'];
const assetDomainSet = new Set<string>(ALL_ASSET_DOMAINS);

const normalizeAssetDomain = (value: string, fallback: GrcAssetDomain): GrcAssetDomain => {
  if (assetDomainSet.has(value)) {
    return value as GrcAssetDomain;
  }
  return fallback;
};

const clampToCriticalityScale = (value: number, scale: GrcAssetCriticalityLevel[]): number => {
  const sorted = scale.length > 0
    ? [...scale].sort((a, b) => a.value - b.value)
    : defaultAssetCriticalityScale();
  const fallback = sorted[Math.floor((sorted.length - 1) / 2)]?.value ?? 3;
  const rounded = Math.round(Number.isFinite(value) ? value : fallback);
  const match = sorted.find(level => level.value === rounded);
  if (match) {
    return match.value;
  }
  return sorted.reduce((closest, level) =>
    Math.abs(level.value - rounded) < Math.abs(closest.value - rounded) ? level : closest
  ).value;
};

export const deriveSecurityCriticality = (criticality: GrcAssetCriticality): number =>
  Math.max(criticality.confidentiality, criticality.integrity, criticality.availability);

export const deriveBusinessCriticality = (criticality: GrcAssetCriticality): number =>
  Math.max(criticality.financial, criticality.reputation, criticality.availability);

const inferAssetDomainFromType = (assetType: string): GrcAssetDomain => {
  const normalized = assetType.toLowerCase();
  if (/(plc|scada|hmi|ics|sensor|rtu|industrial|plant|factory)/.test(normalized)) {
    return 'ot';
  }
  if (/(aws|gcp|azure|lambda|ec2|s3|cloudfront|cloud)/.test(normalized)) {
    return 'cloud';
  }
  if (/(mqtt|iot|device|edge|gateway|sensor)/.test(normalized)) {
    return 'iot';
  }
  if (/(warehouse|data.?lake|etl|pipeline|backup)/.test(normalized)) {
    return 'data';
  }
  if (/(vpn|tunnel|link|connection|loadbalancer|load.?balancer)/.test(normalized)) {
    return 'network';
  }
  if (/(building|door|camera|cctv|badge|facility|data.?center)/.test(normalized)) {
    return 'physical';
  }
  if (/(user|person|employee|actor|admin|contractor)/.test(normalized)) {
    return 'people';
  }
  if (/(app|api|service|web|database|db|identity)/.test(normalized)) {
    return 'application';
  }
  return 'it';
};

const DOMAIN_FALLBACK_CATEGORIES: Record<GrcAssetDomain, string> = {
  it: 'IT Asset',
  ot: 'OT Asset',
  cloud: 'Cloud Service',
  iot: 'IoT Device',
  application: 'Application Component',
  data: 'Data Store',
  network: 'Network Link',
  physical: 'Physical Asset',
  people: 'User/Employee'
};

const getDefaultCategoryForDomain = (config: GrcWorkspaceConfig, domain: GrcAssetDomain): string => {
  const categories = config.assetCategories[domain];
  if (categories && categories.length > 0) {
    return categories[0];
  }
  return DOMAIN_FALLBACK_CATEGORIES[domain] || 'IT Asset';
};

const LEGACY_RATING_THRESHOLDS: RiskRatingThresholds = {
  criticalThreshold: 0.75,
  highThreshold: 0.50,
  mediumThreshold: 0.25
};

const LEGACY_RATING_COLORS: RiskRatingColors = {
  critical: '#dc2626',
  high: '#ea580c',
  medium: '#d97706',
  low: '#16a34a',
  unrated: '#64748b'
};

const clampRatio = (value: number): number => Math.min(1, Math.max(0, value));

const defaultRiskRatingBands = (): RiskRatingBand[] => [
  { id: 'rating-catastrophic', label: 'Catastrophic', value: 6, minScoreRatio: 0.90, color: '#7f1d1d' },
  { id: 'rating-severe', label: 'Severe', value: 5, minScoreRatio: 0.75, color: '#b91c1c' },
  { id: 'rating-major', label: 'Major', value: 4, minScoreRatio: 0.60, color: '#ea580c' },
  { id: 'rating-moderate', label: 'Moderate', value: 3, minScoreRatio: 0.45, color: '#d97706' },
  { id: 'rating-minor', label: 'Minor', value: 2, minScoreRatio: 0.25, color: '#65a30d' },
  { id: 'rating-negligible', label: 'Negligible', value: 1, minScoreRatio: 0.00, color: '#16a34a' }
];

const normalizeRatingBands = (bands: RiskRatingBand[], fallback: RiskRatingBand[]): RiskRatingBand[] => {
  const parsed = bands
    .map((band, index) => ({
      id: asString(band.id, `rating-band-${index + 1}`),
      label: asString(band.label, `Rating ${index + 1}`).trim(),
      value: Math.max(1, Math.round(asNumber(band.value, fallback[index]?.value ?? index + 1))),
      minScoreRatio: clampRatio(asNumber(band.minScoreRatio, fallback[index]?.minScoreRatio ?? 0)),
      color: asString(band.color, fallback[index]?.color ?? LEGACY_RATING_COLORS.low)
    }))
    .filter(band => band.label.length > 0);

  const candidate = parsed.length >= 2 ? parsed : fallback.map(item => ({ ...item }));
  const sortedByThreshold = [...candidate].sort((a, b) => b.minScoreRatio - a.minScoreRatio || b.value - a.value);

  const dedupedThresholds = new Set<number>();
  const adjusted = sortedByThreshold.map((band, index) => {
    let threshold = band.minScoreRatio;
    while (dedupedThresholds.has(Number(threshold.toFixed(4)))) {
      threshold = Math.max(0, threshold - 0.01);
    }
    dedupedThresholds.add(Number(threshold.toFixed(4)));
    return {
      ...band,
      id: band.id || `rating-band-${index + 1}`,
      minScoreRatio: clampRatio(threshold)
    };
  });

  const lastIndex = adjusted.length - 1;
  adjusted[lastIndex] = {
    ...adjusted[lastIndex],
    minScoreRatio: 0
  };

  return adjusted;
};

const bandsToLegacyThresholds = (bands: RiskRatingBand[]): RiskRatingThresholds => {
  const sorted = [...bands].sort((a, b) => b.minScoreRatio - a.minScoreRatio);
  if (sorted.length === 0) {
    return { ...LEGACY_RATING_THRESHOLDS };
  }

  const critical = clampRatio(sorted[0]?.minScoreRatio ?? LEGACY_RATING_THRESHOLDS.criticalThreshold);
  const highRaw = clampRatio(sorted[Math.min(1, sorted.length - 1)]?.minScoreRatio ?? LEGACY_RATING_THRESHOLDS.highThreshold);
  const mediumRaw = clampRatio(
    sorted[Math.min(Math.max(2, Math.floor(sorted.length / 2)), sorted.length - 1)]?.minScoreRatio
      ?? LEGACY_RATING_THRESHOLDS.mediumThreshold
  );
  const high = Math.max(0, Math.min(highRaw, critical - 0.01));
  const medium = Math.max(0, Math.min(mediumRaw, high - 0.01));

  return {
    criticalThreshold: critical,
    highThreshold: high,
    mediumThreshold: medium
  };
};

const bandsToLegacyColors = (bands: RiskRatingBand[]): RiskRatingColors => {
  const sorted = [...bands].sort((a, b) => b.minScoreRatio - a.minScoreRatio);
  return {
    critical: sorted[0]?.color || LEGACY_RATING_COLORS.critical,
    high: sorted[Math.min(1, sorted.length - 1)]?.color || LEGACY_RATING_COLORS.high,
    medium: sorted[Math.min(Math.max(2, Math.floor(sorted.length / 2)), sorted.length - 1)]?.color || LEGACY_RATING_COLORS.medium,
    low: sorted[sorted.length - 1]?.color || LEGACY_RATING_COLORS.low,
    unrated: LEGACY_RATING_COLORS.unrated
  };
};

const legacyToBands = (
  thresholds: RiskRatingThresholds,
  colors: RiskRatingColors
): RiskRatingBand[] => [
  { id: 'legacy-critical', label: 'Critical', value: 4, minScoreRatio: clampRatio(thresholds.criticalThreshold), color: colors.critical },
  { id: 'legacy-high', label: 'High', value: 3, minScoreRatio: clampRatio(thresholds.highThreshold), color: colors.high },
  { id: 'legacy-medium', label: 'Medium', value: 2, minScoreRatio: clampRatio(thresholds.mediumThreshold), color: colors.medium },
  { id: 'legacy-low', label: 'Low', value: 1, minScoreRatio: 0, color: colors.low }
];

const getElevatedRiskLabels = (workspace: GrcWorkspace): Set<string> => {
  const bands = normalizeRatingBands(getConfig(workspace).ratingBands, defaultRiskRatingBands());
  const sortedBySeverity = [...bands].sort((a, b) => b.value - a.value || b.minScoreRatio - a.minScoreRatio);
  const topLabels = sortedBySeverity.slice(0, Math.min(2, sortedBySeverity.length)).map(item => item.label.toLowerCase());
  return new Set(['critical', 'high', ...topLabels]);
};

const getElevatedAssetCriticalityValues = (workspace: GrcWorkspace): Set<number> => {
  const scale = getAssetCriticalityScale(workspace);
  const sorted = [...scale].sort((a, b) => b.value - a.value);
  const topValues = sorted.slice(0, Math.min(2, sorted.length)).map(level => level.value);
  return new Set(topValues);
};

export const defaultMaturityModels = (): MaturityModel[] => [
  {
    id: 'aescsf',
    name: 'AESCSF (Australian Energy Sector)',
    levels: [
      { level: 0, label: 'ML0 — Not Performed', description: 'Practice is not performed' },
      { level: 1, label: 'ML1 — Initial', description: 'Practice is performed but may be ad hoc' },
      { level: 2, label: 'ML2 — Managed', description: 'Practice is documented, planned, and tracked' },
      { level: 3, label: 'ML3 — Defined', description: 'Practice follows organisational standards and is integrated' }
    ]
  },
  {
    id: 'cmmi',
    name: 'CMMI',
    levels: [
      { level: 1, label: 'Level 1 — Initial', description: 'Processes are unpredictable, poorly controlled, and reactive' },
      { level: 2, label: 'Level 2 — Managed', description: 'Processes are characterised for projects and often reactive' },
      { level: 3, label: 'Level 3 — Defined', description: 'Processes are characterised for the organisation and proactive' },
      { level: 4, label: 'Level 4 — Quantitatively Managed', description: 'Processes are measured and controlled' },
      { level: 5, label: 'Level 5 — Optimising', description: 'Focus on process improvement' }
    ]
  },
  {
    id: 'c2m2',
    name: 'C2M2 (Cybersecurity Capability)',
    levels: [
      { level: 0, label: 'MIL0 — Not Performed', description: 'Practice is not performed' },
      { level: 1, label: 'MIL1 — Initiated', description: 'Initial practices are performed but may be ad hoc' },
      { level: 2, label: 'MIL2 — Performed', description: 'Practices are documented, stakeholders identified, and adequate resources provided' },
      { level: 3, label: 'MIL3 — Managed', description: 'Activities are guided by policy, monitored, and periodically evaluated for effectiveness' }
    ]
  },
  {
    id: 'ssecmm',
    name: 'SSE-CMM / ISO 21827',
    levels: [
      { level: 1, label: 'Level 1 — Performed Informally', description: 'Base practices are performed' },
      { level: 2, label: 'Level 2 — Planned and Tracked', description: 'Performance is planned and tracked' },
      { level: 3, label: 'Level 3 — Well Defined', description: 'Defined using approved, tailored standard processes' },
      { level: 4, label: 'Level 4 — Quantitatively Controlled', description: 'Detailed measures of performance collected and analysed' },
      { level: 5, label: 'Level 5 — Continuously Improving', description: 'Quantitative feedback and piloting innovative ideas and technologies' }
    ]
  },
  {
    id: 'nist-csf',
    name: 'NIST CSF Implementation Tiers',
    levels: [
      { level: 1, label: 'Tier 1 — Partial', description: 'Risk management practices are not formalised' },
      { level: 2, label: 'Tier 2 — Risk Informed', description: 'Risk management practices approved but may not be established as policy' },
      { level: 3, label: 'Tier 3 — Repeatable', description: 'Formally approved risk management practices expressed as policy' },
      { level: 4, label: 'Tier 4 — Adaptive', description: 'Organisation adapts based on lessons learned and predictive indicators' }
    ]
  },
  {
    id: 'essential-eight',
    name: 'Essential Eight Maturity',
    levels: [
      { level: 0, label: 'Level 0', description: 'Not aligned with the intent of the mitigation strategy' },
      { level: 1, label: 'Level 1', description: 'Partly aligned with the intent of the mitigation strategy' },
      { level: 2, label: 'Level 2', description: 'Mostly aligned with the intent of the mitigation strategy' },
      { level: 3, label: 'Level 3', description: 'Fully aligned with the intent of the mitigation strategy' }
    ]
  }
];

export const createDefaultConfig = (): GrcWorkspaceConfig => ({
  ratingBands: defaultRiskRatingBands(),
  ratingThresholds: bandsToLegacyThresholds(defaultRiskRatingBands()),
  ratingColors: bandsToLegacyColors(defaultRiskRatingBands()),
  assetCategories: defaultAssetCategories(),
  assetCriticalityScale: defaultAssetCriticalityScale(),
  assessmentScopes: defaultAssessmentScopeConfig(),
  recordDefaults: {
    assetDomain: 'application',
    assetCategory: defaultAssetCategories().application[0],
    assetBusinessCriticality: 4,
    assetSecurityCriticality: 4,
    assetCriticality: defaultCriticality(),
    riskStatus: 'draft',
    treatmentStrategy: 'mitigate',
    tier1Label: 'Cyber Risk',
    assessmentScopeType: 'system',
    assessmentScopeValue: 'system',
    assessmentScopeName: 'Current System',
    assessmentTierFilter: {}
  },
  soaLabels: {
    applicability: { applicable: 'Applicable', not_applicable: 'Not Applicable', partially_applicable: 'Partially Applicable' },
    implementationStatus: { implemented: 'Implemented', in_progress: 'In Progress', planned: 'Planned', not_implemented: 'Not Implemented' }
  },
  exportFilenames: {
    assetsCsv: 'grc-assets.csv',
    risksCsv: 'grc-risks.csv',
    soaCsv: 'grc-soa.csv',
    tasksCsv: 'grc-tasks.csv',
    plansCsv: 'grc-risk-management-plans.csv',
    threatProfilesCsv: 'grc-threat-profiles.csv',
    appetiteRulesCsv: 'grc-appetite-rules.csv',
    findingsCsv: 'grc-findings.csv',
    governanceDocsCsv: 'grc-governance-documents.csv',
    thirdPartiesCsv: 'grc-third-parties.csv',
    initiativesCsv: 'grc-security-initiatives.csv',
    implementedControlsCsv: 'grc-implemented-controls.csv',
    riskAcceptancesCsv: 'grc-risk-acceptances.csv',
    frameworkMappingsCsv: 'grc-framework-mappings.csv',
    incidentsCsv: 'grc-incidents.csv'
  }
});

export const getConfig = (workspace: GrcWorkspace): GrcWorkspaceConfig =>
  workspace.config ?? createDefaultConfig();

export const createDefaultAIAssistConfig = (): GrcAIAssistConfig => ({
  enabled: false,
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
  maxItemsPerSection: 20
});

export const getAIAssistConfig = (workspace: GrcWorkspace): GrcAIAssistConfig =>
  workspace.aiAssist ?? createDefaultAIAssistConfig();

export const getAssetCriticalityScale = (workspace: GrcWorkspace): GrcAssetCriticalityLevel[] =>
  normalizeAssetCriticalityScale(getConfig(workspace).assetCriticalityScale, defaultAssetCriticalityScale());

export const getAssetCriticalityLabel = (workspace: GrcWorkspace, value: number): string => {
  const scale = getAssetCriticalityScale(workspace);
  return scale.find(level => level.value === value)?.label || `Level ${value}`;
};

const defaultLikelihoodScale = (): RiskScaleValue[] => [
  { id: 'likelihood-1', label: 'Rare', value: 1, description: 'Unlikely but possible' },
  { id: 'likelihood-2', label: 'Unlikely', value: 2, description: 'Possible in exceptional cases' },
  { id: 'likelihood-3', label: 'Possible', value: 3, description: 'Could happen in normal operation' },
  { id: 'likelihood-4', label: 'Likely', value: 4, description: 'Expected to happen periodically' },
  { id: 'likelihood-5', label: 'Almost Certain', value: 5, description: 'Expected to happen frequently' }
];

const defaultImpactScale = (): RiskScaleValue[] => [
  { id: 'impact-1', label: 'Negligible', value: 1, description: 'Minimal business impact' },
  { id: 'impact-2', label: 'Minor', value: 2, description: 'Low impact and short disruption' },
  { id: 'impact-3', label: 'Moderate', value: 3, description: 'Noticeable business impact' },
  { id: 'impact-4', label: 'Major', value: 4, description: 'Significant impact requiring escalation' },
  { id: 'impact-5', label: 'Severe', value: 5, description: 'Critical impact to business operations' }
];

const deriveRating = (
  score: number,
  maxScore: number,
  bands?: RiskRatingBand[],
  thresholds?: RiskRatingThresholds,
  colors?: RiskRatingColors
): { label: string; color: string } => {
  const fallbackBands = normalizeRatingBands(
    bands && bands.length > 0 ? bands : legacyToBands(
      thresholds ?? LEGACY_RATING_THRESHOLDS,
      colors ?? LEGACY_RATING_COLORS
    ),
    defaultRiskRatingBands()
  );
  const c = colors ?? LEGACY_RATING_COLORS;

  if (maxScore <= 0) {
    return { label: 'Unrated', color: c.unrated };
  }

  const ratio = score / maxScore;

  for (const band of fallbackBands) {
    if (ratio >= band.minScoreRatio) {
      return { label: band.label, color: band.color };
    }
  }

  const lowestBand = fallbackBands[fallbackBands.length - 1];
  return { label: lowestBand?.label || 'Low', color: lowestBand?.color || c.low };
};

const buildMatrix = (
  likelihoodScale: RiskScaleValue[],
  impactScale: RiskScaleValue[],
  appetiteThresholdScore: number,
  bands?: RiskRatingBand[],
  thresholds?: RiskRatingThresholds,
  colors?: RiskRatingColors
): RiskMatrixCell[] => {
  const maxLikelihood = Math.max(...likelihoodScale.map(item => item.value), 1);
  const maxImpact = Math.max(...impactScale.map(item => item.value), 1);
  const maxScore = maxLikelihood * maxImpact;

  return likelihoodScale.flatMap(likelihood =>
    impactScale.map(impact => {
      const score = likelihood.value * impact.value;
      const rating = deriveRating(score, maxScore, bands, thresholds, colors);

      return {
        likelihoodId: likelihood.id,
        impactId: impact.id,
        score,
        ratingLabel: rating.label,
        color: rating.color,
        exceedsAppetite: score >= appetiteThresholdScore
      };
    })
  );
};

export const buildRiskMatrix = (
  likelihoodScale: RiskScaleValue[],
  impactScale: RiskScaleValue[],
  appetiteThresholdScore: number,
  config?: GrcWorkspaceConfig
): RiskMatrixCell[] => buildMatrix(
  likelihoodScale, impactScale, appetiteThresholdScore,
  config?.ratingBands,
  config?.ratingThresholds, config?.ratingColors
);

export const createDefaultRiskModel = (config?: GrcWorkspaceConfig): GrcRiskModel => {
  const likelihoodScale = defaultLikelihoodScale();
  const impactScale = defaultImpactScale();
  const appetiteThresholdScore = 12;

  return {
    version: 'v1',
    likelihoodScale,
    impactScale,
    matrix: buildMatrix(
      likelihoodScale,
      impactScale,
      appetiteThresholdScore,
      config?.ratingBands,
      config?.ratingThresholds,
      config?.ratingColors
    ),
    appetiteThresholdScore,
    updatedAt: nowIso()
  };
};

const tier2BoardCategories = [
  { id: 'tier2-critical-disruption', label: 'Critical System Disruption Risk',
    description: 'Critical systems become unavailable, caused by cyber attacks or technical failures, resulting in disruption to essential services and operations.' },
  { id: 'tier2-unauthorized-access', label: 'Unauthorized Access Risk',
    description: 'Unauthorized access to systems and data, caused by credential compromise, exploitation, or access control failures, resulting in breach of security controls.' },
  { id: 'tier2-data-breach', label: 'Data Breach Risk',
    description: 'Sensitive or personal data is exposed, caused by technical attacks, insider threats, or process failures, resulting in regulatory, financial, and reputational harm.' },
  { id: 'tier2-system-integrity', label: 'System Integrity Risk',
    description: 'Systems or data are maliciously modified, caused by malware, supply chain compromise, or insider actions, resulting in loss of trust in system reliability.' },
  { id: 'tier2-cyber-detection', label: 'Cyber Detection Risk',
    description: 'Cyber incidents are not detected or contained in a timely manner, caused by insufficient monitoring, expertise, or response capability, resulting in extended impact and recovery delays.' },
  { id: 'tier2-third-party', label: 'Third Party Security Risk',
    description: 'Security incidents originate from or are enabled by third parties, caused by supply chain compromise, vendor access, or telecommunications dependencies, resulting in cascading business impact.' }
] as const;

type RiskDomain = 'OT' | 'IT' | 'Both';

interface DefaultTier3RiskSeed {
  riskId: string;
  riskName: string;
  riskStatement: string;
  domain: RiskDomain;
  tier2CategoryId: string;
  ciaTriad: 'Confidentiality' | 'Integrity' | 'Availability';
  impactCategory?: string;
}

const defaultTier3RiskSeeds: DefaultTier3RiskSeed[] = [
  {
    riskId: 'GRCT3001',
    riskName: 'OT System Loss of Visibility',
    riskStatement: 'OT control system compromise caused by operational or technical threats resulting in loss of operational visibility.',
    domain: 'OT',
    tier2CategoryId: 'tier2-critical-disruption',
    ciaTriad: 'Availability',
    impactCategory: 'Loss of View'
  },
  {
    riskId: 'GRCT3002',
    riskName: 'OT System Manipulation of Control',
    riskStatement: 'OT control system compromise caused by operational or technical threats resulting in manipulation of operational control.',
    domain: 'OT',
    tier2CategoryId: 'tier2-system-integrity',
    ciaTriad: 'Integrity',
    impactCategory: 'Manipulation of Control'
  },
  {
    riskId: 'GRCT3003',
    riskName: 'OT System Loss or Denial of Control',
    riskStatement: 'OT control system compromise caused by operational or technical threats resulting in loss or denial of operational control.',
    domain: 'OT',
    tier2CategoryId: 'tier2-critical-disruption',
    ciaTriad: 'Integrity',
    impactCategory: 'Manipulation of Control'
  },
  {
    riskId: 'GRCT3004',
    riskName: 'OT Unauthorised Substation Access',
    riskStatement: 'Unauthorised access to digital equipment caused by inadequate physical security controls resulting in equipment tampering.',
    domain: 'OT',
    tier2CategoryId: 'tier2-unauthorized-access',
    ciaTriad: 'Integrity',
    impactCategory: 'Degradation of Platform Trust'
  },
  {
    riskId: 'GRCT3005',
    riskName: 'OT Field Device Tampering (Physical)',
    riskStatement: 'Field device tampering caused by physical access to remote equipment resulting in loss of trust.',
    domain: 'OT',
    tier2CategoryId: 'tier2-unauthorized-access',
    ciaTriad: 'Integrity',
    impactCategory: 'Degradation of Platform Trust'
  },
  {
    riskId: 'GRCT3006',
    riskName: 'OT Network Interception',
    riskStatement: 'Interception of network traffic caused by abuse of data in transit resulting in data theft or tampering.',
    domain: 'OT',
    tier2CategoryId: 'tier2-data-breach',
    ciaTriad: 'Confidentiality',
    impactCategory: 'Theft of Operational Information'
  },
  {
    riskId: 'GRCT3007',
    riskName: 'OT Data Tampering',
    riskStatement: 'Unauthorised access or modification of records caused by abuse of data at rest or in transit resulting in data theft or tampering.',
    domain: 'OT',
    tier2CategoryId: 'tier2-system-integrity',
    ciaTriad: 'Integrity',
    impactCategory: 'Data Tampering'
  },
  {
    riskId: 'GRCT3008',
    riskName: 'OT Device Compromise (Supply Chain)',
    riskStatement: 'Unauthorised modification of appliances, field devices, or network infrastructure caused by supply chain threats resulting in loss of trust in OT systems.',
    domain: 'OT',
    tier2CategoryId: 'tier2-system-integrity',
    ciaTriad: 'Integrity',
    impactCategory: 'Code Execution / Modify Application'
  },
  {
    riskId: 'GRCT3009',
    riskName: 'OT Credential Abuse',
    riskStatement: 'Unauthorised system access in OT caused by credential abuse resulting in degradation of platform trust.',
    domain: 'OT',
    tier2CategoryId: 'tier2-unauthorized-access',
    ciaTriad: 'Confidentiality',
    impactCategory: 'Credential Exposure'
  },
  {
    riskId: 'GRCT3010',
    riskName: 'OT-IT Network Boundary Breach',
    riskStatement: 'Unintentional cross-domain access to OT networks caused by technical threats resulting in unauthorised access to OT networks.',
    domain: 'OT',
    tier2CategoryId: 'tier2-unauthorized-access',
    ciaTriad: 'Integrity',
    impactCategory: 'Broaden Network Access'
  },
  {
    riskId: 'GRCT3011',
    riskName: 'OT Network Denial of Service',
    riskStatement: 'OT network congestion caused by technical threats resulting in system or data disruption.',
    domain: 'OT',
    tier2CategoryId: 'tier2-critical-disruption',
    ciaTriad: 'Availability',
    impactCategory: 'Denial of Service'
  },
  {
    riskId: 'GRCT3012',
    riskName: 'Exposure of Operational Information',
    riskStatement: 'Unauthorised access to digital equipment caused by physical, technical, or operational threats resulting in exposure of sensitive operational information.',
    domain: 'OT',
    tier2CategoryId: 'tier2-data-breach',
    ciaTriad: 'Confidentiality'
  },
  {
    riskId: 'GRCT3013',
    riskName: 'Personal Information Breach',
    riskStatement: 'Unauthorised access to sensitive data caused by technical or operational threats resulting in exposure of personal information.',
    domain: 'IT',
    tier2CategoryId: 'tier2-data-breach',
    ciaTriad: 'Confidentiality',
    impactCategory: 'Data Exposure'
  },
  {
    riskId: 'GRCT3014',
    riskName: 'Email System Compromise',
    riskStatement: 'Email system compromise caused by targeted phishing attacks resulting in unauthorised access to sensitive communications.',
    domain: 'IT',
    tier2CategoryId: 'tier2-data-breach',
    ciaTriad: 'Confidentiality',
    impactCategory: 'Data Theft / Data Tampering'
  },
  {
    riskId: 'GRCT3015',
    riskName: 'Web Application Exploitation',
    riskStatement: 'Web application compromise caused by abuse of business applications resulting in unauthorised data access.',
    domain: 'IT',
    tier2CategoryId: 'tier2-data-breach',
    ciaTriad: 'Confidentiality',
    impactCategory: 'Data Exposure'
  },
  {
    riskId: 'GRCT3016',
    riskName: 'Unauthorised Physical Access',
    riskStatement: 'Unauthorised access to digital equipment caused by inadequate physical security controls resulting in equipment tampering.',
    domain: 'Both',
    tier2CategoryId: 'tier2-unauthorized-access',
    ciaTriad: 'Integrity',
    impactCategory: 'Degradation of Platform Trust'
  },
  {
    riskId: 'GRCT3017',
    riskName: 'Digital System Compromise (People and Process)',
    riskStatement: 'Supporting asset compromise caused by operational threats, including negligent personnel, social engineering, or system abuse, resulting in system or data impairment.',
    domain: 'Both',
    tier2CategoryId: 'tier2-system-integrity',
    ciaTriad: 'Integrity',
    impactCategory: 'Degradation of Platform Trust'
  },
  {
    riskId: 'GRCT3018',
    riskName: 'Digital System Compromise (Technology)',
    riskStatement: 'Supporting asset compromise caused by technical threats, including malware, resulting in system or data impairment.',
    domain: 'Both',
    tier2CategoryId: 'tier2-system-integrity',
    ciaTriad: 'Integrity',
    impactCategory: 'Degradation of Platform Trust'
  },
  {
    riskId: 'GRCT3019',
    riskName: 'IT Credential Abuse',
    riskStatement: 'Supporting asset abuse caused by operational threats, including credential abuse, resulting in system or data impairment.',
    domain: 'Both',
    tier2CategoryId: 'tier2-unauthorized-access',
    ciaTriad: 'Integrity',
    impactCategory: 'Degradation of Platform Trust'
  },
  {
    riskId: 'GRCT3020',
    riskName: 'Remote Access Exploitation',
    riskStatement: 'Supporting asset compromise caused by operational threats, including credential abuse or abuse of system software, resulting in system or data impairment.',
    domain: 'Both',
    tier2CategoryId: 'tier2-unauthorized-access',
    ciaTriad: 'Integrity',
    impactCategory: 'Degradation of Platform Trust'
  },
  {
    riskId: 'GRCT3021',
    riskName: 'Telecommunications Loss',
    riskStatement: 'Underlying telecommunications loss caused by resource or business supplier disruption resulting in system or data disruption.',
    domain: 'Both',
    tier2CategoryId: 'tier2-critical-disruption',
    ciaTriad: 'Availability',
    impactCategory: 'System or Data Disruption / Loss of Reliability'
  },
  {
    riskId: 'GRCT3022',
    riskName: 'Telecommunications Compromise',
    riskStatement: 'Unauthorised access to underlying telecommunications caused by business supplier disruption resulting in system or data disruption.',
    domain: 'Both',
    tier2CategoryId: 'tier2-third-party',
    ciaTriad: 'Integrity',
    impactCategory: 'System or Data Impairment'
  },
  {
    riskId: 'GRCT3023',
    riskName: 'Insider Threat to Systems',
    riskStatement: 'Unauthorised system modifications caused by malicious insider actions resulting in system or data impairment.',
    domain: 'Both',
    tier2CategoryId: 'tier2-system-integrity',
    ciaTriad: 'Integrity',
    impactCategory: 'System or Data Impairment'
  },
  {
    riskId: 'GRCT3024',
    riskName: 'Security Culture',
    riskStatement: 'Adverse security events caused by culture and awareness weaknesses resulting in system or data impairment.',
    domain: 'Both',
    tier2CategoryId: 'tier2-system-integrity',
    ciaTriad: 'Integrity',
    impactCategory: 'System or Data Impairment'
  },
  {
    riskId: 'GRCT3025',
    riskName: 'Incident Response (Containment)',
    riskStatement: 'Delayed detection and containment caused by insufficient security knowledge and expertise resulting in inability to identify or contain cyber incidents in a timely manner.',
    domain: 'Both',
    tier2CategoryId: 'tier2-cyber-detection',
    ciaTriad: 'Integrity',
    impactCategory: 'Inhibit Response Function'
  },
  {
    riskId: 'GRCT3026',
    riskName: 'Incident Response (Recovery)',
    riskStatement: 'Extended unavailability of dependent systems caused by insufficient platform resilience resulting in inability to recover from major cyber incidents in a timely manner.',
    domain: 'Both',
    tier2CategoryId: 'tier2-critical-disruption',
    ciaTriad: 'Availability',
    impactCategory: 'System or Data Disruption / Loss of Reliability'
  },
  {
    riskId: 'GRCT3027',
    riskName: 'Malicious Software - Access',
    riskStatement: 'Unauthorised access caused by malicious software resulting in degradation of platform trust.',
    domain: 'Both',
    tier2CategoryId: 'tier2-system-integrity',
    ciaTriad: 'Integrity',
    impactCategory: 'Degradation of Platform Trust'
  },
  {
    riskId: 'GRCT3028',
    riskName: 'Malicious Software - Command and Control',
    riskStatement: 'Functional command and control caused by malicious software resulting in broadening of network access.',
    domain: 'Both',
    tier2CategoryId: 'tier2-system-integrity',
    ciaTriad: 'Integrity',
    impactCategory: 'Broaden Network Access'
  },
  {
    riskId: 'GRCT3029',
    riskName: 'Data Loss by Technical Means',
    riskStatement: 'Unauthorised data access caused by software abuse resulting in data theft.',
    domain: 'Both',
    tier2CategoryId: 'tier2-data-breach',
    ciaTriad: 'Confidentiality',
    impactCategory: 'Data Theft / Data Tampering'
  },
  {
    riskId: 'GRCT3030',
    riskName: 'Privileged Account Compromise',
    riskStatement: 'Administrative account compromise caused by credential abuse resulting in unauthorised system access.',
    domain: 'Both',
    tier2CategoryId: 'tier2-unauthorized-access',
    ciaTriad: 'Integrity',
    impactCategory: 'Privilege Escalation'
  },
  {
    riskId: 'GRCT3031',
    riskName: 'Network Infrastructure Compromise',
    riskStatement: 'Unauthorised modification of network devices caused by technical or operational threats resulting in network infrastructure compromise.',
    domain: 'Both',
    tier2CategoryId: 'tier2-system-integrity',
    ciaTriad: 'Integrity',
    impactCategory: 'Data Tampering'
  },
  {
    riskId: 'GRCT3032',
    riskName: 'Third-Party Access',
    riskStatement: 'Third-party initiated incidents caused by operational threats resulting in data theft, tampering, or broadening of network access.',
    domain: 'Both',
    tier2CategoryId: 'tier2-third-party',
    ciaTriad: 'Confidentiality',
    impactCategory: 'Data Exposure'
  },
  {
    riskId: 'GRCT3033',
    riskName: 'Supply Chain Software Compromise',
    riskStatement: 'System compromise caused by malicious code in vendor software resulting in unauthorised system access.',
    domain: 'Both',
    tier2CategoryId: 'tier2-third-party',
    ciaTriad: 'Integrity',
    impactCategory: 'Code Execution / Modify Application'
  },
  {
    riskId: 'GRCT3034',
    riskName: 'Equipment Loss or Theft',
    riskStatement: 'Unauthorised access to digital equipment caused by physical loss of assets resulting in data theft.',
    domain: 'Both',
    tier2CategoryId: 'tier2-data-breach',
    ciaTriad: 'Confidentiality',
    impactCategory: 'Data Theft / Data Tampering'
  },
  {
    riskId: 'GRCT3035',
    riskName: 'Trust Boundary Violation',
    riskStatement: 'Unauthorised access to supporting assets caused by trust boundary violations resulting in privilege escalation or expanded network access.',
    domain: 'Both',
    tier2CategoryId: 'tier2-system-integrity',
    ciaTriad: 'Integrity',
    impactCategory: 'Broaden Network Access'
  }
];

const defaultTierCatalogue = (): GrcWorkspace['tierCatalogue'] => {
  const tierCatalogue: GrcWorkspace['tierCatalogue'] = [
    { id: 'tier1-cyber-risk', tier: 1, label: 'Cyber Risk', description: 'Enterprise cyber risk umbrella' },
    ...tier2BoardCategories.map(cat => ({
      id: cat.id,
      tier: 2 as const,
      parentId: 'tier1-cyber-risk',
      label: cat.label,
      description: cat.description
    }))
  ];

  defaultTier3RiskSeeds.forEach(seed => {
    const normalizedStatement = seed.riskStatement.replace(/\s+/g, ' ').trim();
    const tier3Id = `tier3-${seed.riskId.toLowerCase()}`;

    tierCatalogue.push({
      id: tier3Id,
      tier: 3,
      parentId: seed.tier2CategoryId,
      label: `${seed.riskId} ${seed.riskName}`,
      description: normalizedStatement,
      tags: [
        `risk_id:${seed.riskId.toLowerCase()}`,
        `domain:${seed.domain.toLowerCase()}`,
        `cia:${seed.ciaTriad.toLowerCase()}`,
        ...(seed.impactCategory ? [`impact:${toSlug(seed.impactCategory)}`] : [])
      ]
    });
  });

  return tierCatalogue;
};

export const createDefaultGrcWorkspace = (): GrcWorkspace => {
  const createdAt = nowIso();
  const config = createDefaultConfig();

  return {
    schemaVersion: '1.0',
    createdAt,
    updatedAt: createdAt,
    riskModel: createDefaultRiskModel(config),
    tierCatalogue: defaultTierCatalogue(),
    assets: [],
    findings: [],
    risks: [],
    assessments: [],
    controlSets: [],
    soaEntries: [],
    workflowTasks: [],
    governanceDocuments: [],
    threatActors: [],
    threatScenarios: [],
    appetiteRules: [],
    thirdParties: [],
    securityInitiatives: [],
    implementedControls: [],
    riskAcceptances: [],
    frameworkMappings: [],
    incidents: [],
    aiAssist: createDefaultAIAssistConfig(),
    config
  };
};

const allowedRiskStatus = new Set<RiskStatus>(['draft', 'assessed', 'treated', 'accepted', 'closed']);
const allowedTreatment = new Set<RiskTreatmentStrategy>(['mitigate', 'transfer', 'avoid', 'accept']);
const allowedApplicability = new Set<SoaApplicability>(['applicable', 'not_applicable', 'partially_applicable']);
const allowedImplementation = new Set<SoaImplementationStatus>([
  'implemented',
  'planned',
  'not_implemented',
  'in_progress'
]);
const allowedTaskStatus = new Set<GrcTaskStatus>(['todo', 'in_progress', 'blocked', 'done']);
const allowedTaskPriority = new Set<GrcTaskPriority>(['low', 'medium', 'high', 'critical']);
const allowedTaskType = new Set<GrcTaskType>([
  'risk_treatment',
  'control_implementation',
  'assessment',
  'evidence',
  'review'
]);
const allowedFindingType = new Set<GrcFindingType>(['threat', 'vulnerability', 'weakness', 'observation']);
const allowedFindingSeverity = new Set<GrcFindingSeverity>(['critical', 'high', 'medium', 'low', 'info']);
const allowedFindingSource = new Set<GrcFindingSource>(['rule_engine', 'manual', 'ai_analysis']);
const allowedFindingStatus = new Set<GrcFindingStatus>(['open', 'in_review', 'accepted', 'mitigated', 'dismissed']);

const parseRiskScale = (value: unknown, fallback: RiskScaleValue[]): RiskScaleValue[] => {
  const parsed = asArray<Record<string, unknown>>(value)
    .map((row, index) => ({
      id: asString(row.id, `scale-${index + 1}`),
      label: asString(row.label, `Level ${index + 1}`),
      value: asNumber(row.value, index + 1),
      description: asString(row.description) || undefined
    }))
    .filter(row => row.id && row.label && row.value > 0);

  return parsed.length > 0 ? parsed : fallback;
};

const parseMatrix = (
  value: unknown,
  likelihoodScale: RiskScaleValue[],
  impactScale: RiskScaleValue[],
  appetiteThresholdScore: number
): RiskMatrixCell[] => {
  const parsed = asArray<Record<string, unknown>>(value)
    .map(row => ({
      likelihoodId: asString(row.likelihoodId),
      impactId: asString(row.impactId),
      score: asNumber(row.score, 0),
      ratingLabel: asString(row.ratingLabel, 'Unrated'),
      color: asString(row.color, '#64748b'),
      exceedsAppetite: asBoolean(row.exceedsAppetite, false)
    }))
    .filter(row => row.likelihoodId && row.impactId);

  if (parsed.length > 0) {
    return parsed;
  }

  return buildMatrix(likelihoodScale, impactScale, appetiteThresholdScore);
};

const parseDiagramRefs = (value: unknown): DiagramNodeRef[] =>
  asArray<Record<string, unknown>>(value)
    .map(item => ({
      diagramId: asString(item.diagramId),
      nodeId: asString(item.nodeId),
      nodeLabel: asString(item.nodeLabel) || undefined,
      nodeType: asString(item.nodeType) || undefined,
      sourceNodeId: asString(item.sourceNodeId) || undefined,
      targetNodeId: asString(item.targetNodeId) || undefined
    }))
    .filter(item => item.diagramId && item.nodeId);

const parseEvidenceArray = (value: unknown): GrcEvidenceReference[] => {
  const evidenceItems = asArray<unknown>(value);

  return evidenceItems
    .map(item => {
      if (typeof item === 'string') {
        return {
          id: createId('evidence'),
          kind: item.startsWith('http://') || item.startsWith('https://') ? 'link' : 'file_reference',
          name: item.length > 80 ? `${item.slice(0, 77)}...` : item,
          url: item.startsWith('http://') || item.startsWith('https://') ? item : undefined,
          note: item.startsWith('http://') || item.startsWith('https://') ? undefined : item,
          createdAt: nowIso()
        } as GrcEvidenceReference;
      }

      if (!isRecord(item)) {
        return null;
      }

      const kind = asString(item.kind, 'file_reference');
      const normalizedKind: GrcEvidenceReference['kind'] = kind === 'link' ? 'link' : 'file_reference';

      return {
        id: asString(item.id, createId('evidence')),
        kind: normalizedKind,
        name: asString(item.name, 'Evidence'),
        url: asString(item.url) || undefined,
        mimeType: asString(item.mimeType) || undefined,
        sizeBytes: asNumber(item.sizeBytes, 0) || undefined,
        hash: asString(item.hash) || undefined,
        note: asString(item.note) || undefined,
        governanceDocId: asString(item.governanceDocId) || undefined,
        createdAt: asString(item.createdAt, nowIso())
      } as GrcEvidenceReference;
    })
    .filter((item): item is GrcEvidenceReference => item !== null);
};

const parseLegacyEvidence = (value: Record<string, unknown>): GrcEvidenceReference[] => {
  const combined = [
    ...parseEvidenceArray(value.evidence),
    ...parseEvidenceArray(value.evidenceLinks),
    ...parseEvidenceArray(value.evidenceRefs)
  ];

  const deduped = new Map<string, GrcEvidenceReference>();
  combined.forEach(item => {
    const key = `${item.kind}:${item.url || ''}:${item.name}:${item.note || ''}`;
    if (!deduped.has(key)) {
      deduped.set(key, item);
    }
  });

  return Array.from(deduped.values());
};

export const calculateRiskScore = (
  riskModel: GrcRiskModel,
  likelihoodId: string,
  impactId: string,
  config?: GrcWorkspaceConfig,
  resolvedAppetiteThreshold?: number
) => {
  const likelihood = riskModel.likelihoodScale.find(item => item.id === likelihoodId);
  const impact = riskModel.impactScale.find(item => item.id === impactId);
  const maxLikelihood = Math.max(...riskModel.likelihoodScale.map(item => item.value), 1);
  const maxImpact = Math.max(...riskModel.impactScale.map(item => item.value), 1);
  const maxScore = maxLikelihood * maxImpact;
  const rawScore = (likelihood?.value || 0) * (impact?.value || 0);

  const fallbackRating = deriveRating(rawScore, maxScore, config?.ratingBands, config?.ratingThresholds, config?.ratingColors);
  const effectiveThreshold = resolvedAppetiteThreshold ?? riskModel.appetiteThresholdScore;

  return {
    likelihoodId,
    impactId,
    rawScore,
    ratingLabel: fallbackRating.label,
    color: fallbackRating.color,
    exceedsAppetite: rawScore >= effectiveThreshold,
    riskModelVersion: riskModel.version,
    scoredAt: nowIso(),
    resolvedAppetiteThreshold: resolvedAppetiteThreshold ?? undefined
  };
};

const parseRiskModel = (value: unknown, fallback: GrcRiskModel): GrcRiskModel => {
  if (!isRecord(value)) {
    return fallback;
  }

  const likelihoodScale = parseRiskScale(value.likelihoodScale, fallback.likelihoodScale);
  const impactScale = parseRiskScale(value.impactScale, fallback.impactScale);
  const appetiteThresholdScore = asNumber(value.appetiteThresholdScore, fallback.appetiteThresholdScore);
  const matrix = parseMatrix(value.matrix, likelihoodScale, impactScale, appetiteThresholdScore);

  return {
    version: asString(value.version, fallback.version),
    likelihoodScale,
    impactScale,
    matrix,
    appetiteThresholdScore,
    updatedAt: asString(value.updatedAt, nowIso())
  };
};

const allowedThreatActorType = new Set<GrcThreatActorType>([
  'nation_state', 'organised_crime', 'insider', 'hacktivist', 'opportunistic', 'competitor', 'supply_chain'
]);
const allowedThreatActorResourceLevel = new Set<GrcThreatActorResourceLevel>([
  'very_low', 'low', 'moderate', 'high', 'very_high'
]);

export const resolveRiskAppetite = (risk: GrcRisk, workspace: GrcWorkspace): number => {
  const rules = workspace.appetiteRules || [];
  if (rules.length === 0) return workspace.riskModel.appetiteThresholdScore;

  const assetMap = new Map(workspace.assets.map(a => [a.id, a]));
  const riskAssets = risk.assetIds.map(id => assetMap.get(id)).filter(Boolean) as GrcAsset[];

  let bestSpecificity = -1;
  let bestThreshold = workspace.riskModel.appetiteThresholdScore;

  for (const rule of rules) {
    let specificity = 0;
    let matches = true;

    if (rule.scopeAssetDomain) {
      if (riskAssets.some(a => a.domain === rule.scopeAssetDomain)) {
        specificity += 1;
      } else {
        matches = false;
      }
    }
    if (rule.scopeTier1) {
      if (risk.tierPath.tier1 && risk.tierPath.tier1.toLowerCase() === rule.scopeTier1.toLowerCase()) {
        specificity += 2;
      } else {
        matches = false;
      }
    }
    if (rule.scopeAssetCriticalityMin != null) {
      const maxCrit = riskAssets.length > 0
        ? Math.max(...riskAssets.map(a => Math.max(a.businessCriticality, a.securityCriticality)))
        : 0;
      if (maxCrit >= rule.scopeAssetCriticalityMin) {
        specificity += 1;
      } else {
        matches = false;
      }
    }

    if (!matches) continue;
    if (specificity > bestSpecificity || (specificity === bestSpecificity && rule.thresholdScore < bestThreshold)) {
      bestSpecificity = specificity;
      bestThreshold = rule.thresholdScore;
    }
  }

  return bestThreshold;
};

export const rescoreRisk = (risk: GrcRisk, riskModel: GrcRiskModel, config?: GrcWorkspaceConfig, resolvedAppetiteThreshold?: number): GrcRisk => {
  const inherentScore = calculateRiskScore(
    riskModel,
    risk.inherentScore.likelihoodId,
    risk.inherentScore.impactId,
    config,
    resolvedAppetiteThreshold
  );

  const residualScore = risk.residualScore
    ? calculateRiskScore(riskModel, risk.residualScore.likelihoodId, risk.residualScore.impactId, config, resolvedAppetiteThreshold)
    : undefined;

  return {
    ...risk,
    inherentScore,
    residualScore,
    updatedAt: nowIso()
  };
};

export const rescoreRisks = (workspace: GrcWorkspace): GrcWorkspace => ({
  ...workspace,
  risks: workspace.risks.map(risk => {
    const threshold = resolveRiskAppetite(risk, workspace);
    return rescoreRisk(risk, workspace.riskModel, workspace.config, threshold);
  }),
  updatedAt: nowIso()
});

const parseConfig = (value: unknown): GrcWorkspaceConfig => {
  const defaults = createDefaultConfig();
  if (!isRecord(value)) return defaults;

  const rt = isRecord(value.ratingThresholds) ? value.ratingThresholds : {};
  const rc = isRecord(value.ratingColors) ? value.ratingColors : {};
  const rb = asArray<Record<string, unknown>>(value.ratingBands);
  const ac = isRecord(value.assetCategories) ? value.assetCategories : {};
  const aScale = asArray<Record<string, unknown>>(value.assetCriticalityScale);
  const asc = isRecord(value.assessmentScopes) ? value.assessmentScopes : {};
  const rd = isRecord(value.recordDefaults) ? value.recordDefaults : {};
  const sl = isRecord(value.soaLabels) ? value.soaLabels : {};
  const ef = isRecord(value.exportFilenames) ? value.exportFilenames : {};

  const rdCrit = isRecord(rd.assetCriticality) ? rd.assetCriticality : {};

  const slApp = isRecord(sl.applicability) ? sl.applicability : {};
  const slImpl = isRecord(sl.implementationStatus) ? sl.implementationStatus : {};

  const parsedThresholds: RiskRatingThresholds = {
    criticalThreshold: clampRatio(asNumber(rt.criticalThreshold, defaults.ratingThresholds.criticalThreshold)),
    highThreshold: clampRatio(asNumber(rt.highThreshold, defaults.ratingThresholds.highThreshold)),
    mediumThreshold: clampRatio(asNumber(rt.mediumThreshold, defaults.ratingThresholds.mediumThreshold))
  };

  const parsedColors: RiskRatingColors = {
    critical: asString(rc.critical, defaults.ratingColors.critical),
    high: asString(rc.high, defaults.ratingColors.high),
    medium: asString(rc.medium, defaults.ratingColors.medium),
    low: asString(rc.low, defaults.ratingColors.low),
    unrated: asString(rc.unrated, defaults.ratingColors.unrated)
  };

  const parsedBands: RiskRatingBand[] = rb.map((band, index) => ({
    id: asString(band.id, `rating-band-${index + 1}`),
    label: asString(band.label, `Rating ${index + 1}`),
    value: asNumber(band.value, index + 1),
    minScoreRatio: asNumber(band.minScoreRatio, 0),
    color: asString(band.color, parsedColors.low)
  }));

  const normalizedBands = normalizeRatingBands(
    parsedBands.length > 0 ? parsedBands : legacyToBands(parsedThresholds, parsedColors),
    defaults.ratingBands
  );
  const normalizedThresholds = bandsToLegacyThresholds(normalizedBands);
  const normalizedColors = { ...bandsToLegacyColors(normalizedBands), unrated: parsedColors.unrated };
  const normalizedAssetCategories = normalizeAssetCategories(ac, defaults.assetCategories);
  const parsedAssetCriticalityScale = normalizeAssetCriticalityScale(
    aScale.map((level, index) => ({
      value: asNumber(level.value, defaults.assetCriticalityScale[index]?.value ?? (index + 1)),
      label: asString(level.label, defaults.assetCriticalityScale[index]?.label || `Level ${index + 1}`)
    })),
    defaults.assetCriticalityScale
  );
  const normalizedAssessmentScopes = normalizeAssessmentScopeConfig(asc, defaults.assessmentScopes);
  const parsedAssetDomain = normalizeAssetDomain(
    asString(rd.assetDomain, defaults.recordDefaults.assetDomain),
    defaults.recordDefaults.assetDomain
  );
  const parsedAssetCategory = asString(
    rd.assetCategory,
    normalizedAssetCategories[parsedAssetDomain][0] || defaults.recordDefaults.assetCategory
  ).trim();
  const fallbackBusinessCriticality = deriveBusinessCriticality({
    confidentiality: asNumber(rdCrit.confidentiality, defaults.recordDefaults.assetCriticality.confidentiality),
    integrity: asNumber(rdCrit.integrity, defaults.recordDefaults.assetCriticality.integrity),
    availability: asNumber(rdCrit.availability, defaults.recordDefaults.assetCriticality.availability),
    financial: asNumber(rdCrit.financial, defaults.recordDefaults.assetCriticality.financial),
    reputation: asNumber(rdCrit.reputation, defaults.recordDefaults.assetCriticality.reputation),
    safety: asNumber(rdCrit.safety, defaults.recordDefaults.assetCriticality.safety)
  });
  const fallbackSecurityCriticality = deriveSecurityCriticality({
    confidentiality: asNumber(rdCrit.confidentiality, defaults.recordDefaults.assetCriticality.confidentiality),
    integrity: asNumber(rdCrit.integrity, defaults.recordDefaults.assetCriticality.integrity),
    availability: asNumber(rdCrit.availability, defaults.recordDefaults.assetCriticality.availability),
    financial: asNumber(rdCrit.financial, defaults.recordDefaults.assetCriticality.financial),
    reputation: asNumber(rdCrit.reputation, defaults.recordDefaults.assetCriticality.reputation),
    safety: asNumber(rdCrit.safety, defaults.recordDefaults.assetCriticality.safety)
  });

  return {
    ratingBands: normalizedBands,
    ratingThresholds: normalizedThresholds,
    ratingColors: normalizedColors,
    assetCategories: normalizedAssetCategories,
    assetCriticalityScale: parsedAssetCriticalityScale,
    recordDefaults: {
      assetDomain: parsedAssetDomain,
      assetCategory: parsedAssetCategory || getDefaultCategoryForDomain({
        ...defaults,
        assetCategories: normalizedAssetCategories
      }, parsedAssetDomain),
      assetBusinessCriticality: clampToCriticalityScale(
        asNumber(rd.assetBusinessCriticality, fallbackBusinessCriticality),
        parsedAssetCriticalityScale
      ),
      assetSecurityCriticality: clampToCriticalityScale(
        asNumber(rd.assetSecurityCriticality, fallbackSecurityCriticality),
        parsedAssetCriticalityScale
      ),
      assetCriticality: {
        confidentiality: asNumber(rdCrit.confidentiality, defaults.recordDefaults.assetCriticality.confidentiality),
        integrity: asNumber(rdCrit.integrity, defaults.recordDefaults.assetCriticality.integrity),
        availability: asNumber(rdCrit.availability, defaults.recordDefaults.assetCriticality.availability),
        financial: asNumber(rdCrit.financial, defaults.recordDefaults.assetCriticality.financial),
        reputation: asNumber(rdCrit.reputation, defaults.recordDefaults.assetCriticality.reputation),
        safety: asNumber(rdCrit.safety, defaults.recordDefaults.assetCriticality.safety)
      },
      riskStatus: (allowedRiskStatus.has(asString(rd.riskStatus) as RiskStatus)
        ? asString(rd.riskStatus)
        : defaults.recordDefaults.riskStatus) as RiskStatus,
      treatmentStrategy: (allowedTreatment.has(asString(rd.treatmentStrategy) as RiskTreatmentStrategy)
        ? asString(rd.treatmentStrategy)
        : defaults.recordDefaults.treatmentStrategy) as RiskTreatmentStrategy,
      tier1Label: asString(rd.tier1Label, defaults.recordDefaults.tier1Label),
      assessmentScopeType: normalizeAssessmentScopeType(
        rd.assessmentScopeType,
        defaults.recordDefaults.assessmentScopeType
      ),
      assessmentScopeValue: asString(rd.assessmentScopeValue, defaults.recordDefaults.assessmentScopeValue),
      assessmentScopeName: asString(rd.assessmentScopeName, defaults.recordDefaults.assessmentScopeName),
      assessmentTierFilter: {
        tier1: asString((isRecord(rd.assessmentTierFilter) ? rd.assessmentTierFilter.tier1 : undefined)) || undefined,
        tier2: asString((isRecord(rd.assessmentTierFilter) ? rd.assessmentTierFilter.tier2 : undefined)) || undefined,
        tier3: asString((isRecord(rd.assessmentTierFilter) ? rd.assessmentTierFilter.tier3 : undefined)) || undefined,
        tier4: asString((isRecord(rd.assessmentTierFilter) ? rd.assessmentTierFilter.tier4 : undefined)) || undefined
      }
    },
    assessmentScopes: normalizedAssessmentScopes,
    soaLabels: {
      applicability: {
        applicable: asString(slApp.applicable, defaults.soaLabels.applicability.applicable),
        not_applicable: asString(slApp.not_applicable, defaults.soaLabels.applicability.not_applicable),
        partially_applicable: asString(slApp.partially_applicable, defaults.soaLabels.applicability.partially_applicable)
      },
      implementationStatus: {
        implemented: asString(slImpl.implemented, defaults.soaLabels.implementationStatus.implemented),
        in_progress: asString(slImpl.in_progress, defaults.soaLabels.implementationStatus.in_progress),
        planned: asString(slImpl.planned, defaults.soaLabels.implementationStatus.planned),
        not_implemented: asString(slImpl.not_implemented, defaults.soaLabels.implementationStatus.not_implemented)
      }
    },
    exportFilenames: {
      assetsCsv: asString(ef.assetsCsv, defaults.exportFilenames.assetsCsv),
      risksCsv: asString(ef.risksCsv, defaults.exportFilenames.risksCsv),
      soaCsv: asString(ef.soaCsv, defaults.exportFilenames.soaCsv),
      tasksCsv: asString(ef.tasksCsv, defaults.exportFilenames.tasksCsv),
      plansCsv: asString(ef.plansCsv, defaults.exportFilenames.plansCsv),
      threatProfilesCsv: asString(ef.threatProfilesCsv, defaults.exportFilenames.threatProfilesCsv),
      appetiteRulesCsv: asString(ef.appetiteRulesCsv, defaults.exportFilenames.appetiteRulesCsv),
      findingsCsv: asString(ef.findingsCsv, defaults.exportFilenames.findingsCsv),
      governanceDocsCsv: asString(ef.governanceDocsCsv, defaults.exportFilenames.governanceDocsCsv),
      thirdPartiesCsv: asString(ef.thirdPartiesCsv, defaults.exportFilenames.thirdPartiesCsv),
      initiativesCsv: asString(ef.initiativesCsv, defaults.exportFilenames.initiativesCsv),
      implementedControlsCsv: asString(ef.implementedControlsCsv, defaults.exportFilenames.implementedControlsCsv),
      riskAcceptancesCsv: asString(ef.riskAcceptancesCsv, defaults.exportFilenames.riskAcceptancesCsv),
      frameworkMappingsCsv: asString(ef.frameworkMappingsCsv, defaults.exportFilenames.frameworkMappingsCsv),
      incidentsCsv: asString(ef.incidentsCsv, defaults.exportFilenames.incidentsCsv)
    },
    tableColumns: isRecord(value.tableColumns)
      ? Object.fromEntries(
          Object.entries(value.tableColumns as Record<string, unknown>)
            .filter(([, v]) => isRecord(v))
            .map(([key, v]) => [key, { visibleColumnIds: asArray<string>((v as Record<string, unknown>).visibleColumnIds).filter(Boolean) }])
        )
      : undefined,
    reportSections: isRecord(value.reportSections)
      ? Object.fromEntries(
          Object.entries(value.reportSections as Record<string, unknown>)
            .filter(([, v]) => isRecord(v))
            .map(([key, v]) => [key, { visibleSectionIds: asArray<string>((v as Record<string, unknown>).visibleSectionIds).filter(Boolean) }])
        )
      : undefined,
    customCharts: asArray<Record<string, unknown>>(value.customCharts)
      .map(chart => ({
        id: asString(chart.id, createId('cchart')),
        title: asString(chart.title, 'Untitled'),
        chartType: asString(chart.chartType, 'bar') as CustomChartType,
        dataSource: asString(chart.dataSource, 'risks') as CustomChartDataSourceKey,
        groupByField: asString(chart.groupByField, 'status'),
        secondaryGroupByField: chart.secondaryGroupByField ? asString(chart.secondaryGroupByField as string) : undefined,
        timeGranularity: chart.timeGranularity ? asString(chart.timeGranularity as string, 'month') as CustomChartTimeGranularity : undefined,
        colorScheme: asString(chart.colorScheme, 'default') as CustomChartColorScheme,
        createdAt: asString(chart.createdAt, nowIso()),
        updatedAt: asString(chart.updatedAt, nowIso())
      }))
      .filter(c => c.title && c.dataSource && c.groupByField) || undefined,
    maturityModels: asArray<Record<string, unknown>>(value.maturityModels).length > 0
      ? asArray<Record<string, unknown>>(value.maturityModels).map(model => ({
          id: asString(model.id, createId('mm')),
          name: asString(model.name, 'Untitled Model'),
          levels: asArray<Record<string, unknown>>(model.levels).map(level => ({
            level: asNumber(level.level, 0),
            label: asString(level.label, ''),
            description: level.description ? asString(level.description as string) : undefined
          }))
        }))
      : undefined,
    activeMaturityModelId: value.activeMaturityModelId ? asString(value.activeMaturityModelId as string) : undefined,
    businessUnits: asArray<string>(value.businessUnits).filter(s => typeof s === 'string' && s.trim()).map(s => s.trim()) || undefined
  };
};

export const ensureGrcWorkspace = (value: unknown): GrcWorkspace => {
  const fallback = createDefaultGrcWorkspace();
  if (!isRecord(value)) {
    return fallback;
  }

  const riskModel = parseRiskModel(value.riskModel, fallback.riskModel);
  const parsedConfig = parseConfig(value.config);

  const assets = asArray<Record<string, unknown>>(value.assets).map(item => {
    const criticalityRecord = isRecord(item.criticality) ? item.criticality : {};
    const normalizedCriticality: GrcAssetCriticality = {
      confidentiality: asNumber(criticalityRecord.confidentiality, 3),
      integrity: asNumber(criticalityRecord.integrity, 3),
      availability: asNumber(criticalityRecord.availability, 3),
      financial: asNumber(criticalityRecord.financial, 3),
      reputation: asNumber(criticalityRecord.reputation, 3),
      safety: asNumber(criticalityRecord.safety, 3)
    };
    const rawType = asString(item.type, '').trim();
    const rawCategory = asString(item.category, rawType || '').trim();
    const inferredDomain = inferAssetDomainFromType(rawCategory || rawType || asString(item.name));
    const domain = normalizeAssetDomain(
      asString(item.domain, inferredDomain),
      parsedConfig.recordDefaults.assetDomain
    );
    const category = rawCategory || getDefaultCategoryForDomain(parsedConfig, domain);

    return {
      id: asString(item.id, createId('asset')),
      name: asString(item.name, 'Unnamed Asset'),
      type: rawType || category,
      domain,
      category,
      owner: asString(item.owner) || undefined,
      businessProcess: asString(item.businessProcess) || undefined,
      description: asString(item.description) || undefined,
      businessCriticality: clampToCriticalityScale(
        asNumber(item.businessCriticality, deriveBusinessCriticality(normalizedCriticality)),
        parsedConfig.assetCriticalityScale
      ),
      securityCriticality: clampToCriticalityScale(
        asNumber(item.securityCriticality, deriveSecurityCriticality(normalizedCriticality)),
        parsedConfig.assetCriticalityScale
      ),
      criticality: normalizedCriticality,
      diagramRefs: parseDiagramRefs(item.diagramRefs),
      isConnection: asBoolean(item.isConnection, false) || undefined,
      businessUnit: asString(item.businessUnit) || undefined,
      createdAt: asString(item.createdAt, nowIso()),
      updatedAt: asString(item.updatedAt, nowIso())
    } as GrcAsset;
  });

  const findings = asArray<Record<string, unknown>>(value.findings).map(item => {
    const fType = asString(item.type, 'vulnerability') as GrcFindingType;
    const fSeverity = asString(item.severity, 'medium') as GrcFindingSeverity;
    const fSource = asString(item.source, 'manual') as GrcFindingSource;
    const fStatus = asString(item.status, 'open') as GrcFindingStatus;
    return {
      id: asString(item.id, createId('finding')),
      title: asString(item.title, 'Untitled Finding'),
      description: asString(item.description, ''),
      type: allowedFindingType.has(fType) ? fType : 'vulnerability',
      severity: allowedFindingSeverity.has(fSeverity) ? fSeverity : 'medium',
      source: allowedFindingSource.has(fSource) ? fSource : 'manual',
      status: allowedFindingStatus.has(fStatus) ? fStatus : 'open',
      category: asString(item.category) || undefined,
      ruleId: asString(item.ruleId) || undefined,
      strideCategories: asArray<string>(item.strideCategories).filter(Boolean),
      relatedNodeIds: asArray<string>(item.relatedNodeIds).filter(Boolean),
      relatedEdgeIds: asArray<string>(item.relatedEdgeIds).filter(Boolean),
      linkedRiskIds: asArray<string>(item.linkedRiskIds).filter(Boolean),
      linkedTaskIds: asArray<string>(item.linkedTaskIds).filter(Boolean),
      linkedAssetIds: asArray<string>(item.linkedAssetIds).filter(Boolean),
      recommendations: asArray<string>(item.recommendations).filter(Boolean),
      owner: asString(item.owner) || undefined,
      notes: asString(item.notes) || undefined,
      remediationStatus: (() => {
        const v = asString(item.remediationStatus);
        const allowed = new Set(['identified','confirmed','remediation_planned','remediation_in_progress','remediated','verified','false_positive']);
        return allowed.has(v) ? v as GrcRemediationStatus : undefined;
      })(),
      cvssScore: typeof item.cvssScore === 'number' && Number.isFinite(item.cvssScore as number) ? item.cvssScore as number : undefined,
      createdAt: asString(item.createdAt, nowIso()),
      updatedAt: asString(item.updatedAt, nowIso())
    } as GrcFinding;
  });

  const risks = asArray<Record<string, unknown>>(value.risks).map(item => {
    const inherent = isRecord(item.inherentScore) ? item.inherentScore : {};
    const residual = isRecord(item.residualScore) ? item.residualScore : null;
    const status = asString(item.status, 'draft') as RiskStatus;
    const treatment = asString(item.treatmentStrategy, 'mitigate') as RiskTreatmentStrategy;

    const inherentLikelihoodId = asString(inherent.likelihoodId, riskModel.likelihoodScale[0]?.id || '');
    const inherentImpactId = asString(inherent.impactId, riskModel.impactScale[0]?.id || '');

    const residualLikelihoodId = asString(residual?.likelihoodId, '');
    const residualImpactId = asString(residual?.impactId, '');

    const tierPath = isRecord(item.tierPath) ? item.tierPath : {};

    return {
      id: asString(item.id, createId('risk')),
      title: asString(item.title, 'Unnamed Risk'),
      description: asString(item.description) || undefined,
      status: allowedRiskStatus.has(status) ? status : 'draft',
      owner: asString(item.owner) || undefined,
      dueDate: asString(item.dueDate) || undefined,
      reviewCadenceDays: asNumber(item.reviewCadenceDays, 0) || undefined,
      tierPath: {
        tier1: asString(tierPath.tier1) || undefined,
        tier2: asString(tierPath.tier2) || undefined,
        tier3: asString(tierPath.tier3) || undefined,
        tier4: asString(tierPath.tier4) || undefined
      },
      categoryId: asString(item.categoryId) || undefined,
      threatActorIds: (() => {
        const ids = asArray<string>(item.threatActorIds).filter(Boolean);
        if (ids.length > 0) return ids;
        const legacy = asString(item.threatActorId);
        return legacy ? [legacy] : undefined;
      })(),
      assetIds: asArray<string>(item.assetIds).filter(Boolean),
      diagramLinks: asArray<Record<string, unknown>>(item.diagramLinks)
        .map(link => ({
          diagramId: asString(link.diagramId),
          nodeIds: asArray<string>(link.nodeIds).filter(Boolean)
        }))
        .filter(link => link.diagramId),
      inherentScore: calculateRiskScore(riskModel, inherentLikelihoodId, inherentImpactId, parsedConfig),
      residualScore:
        residualLikelihoodId && residualImpactId
          ? calculateRiskScore(riskModel, residualLikelihoodId, residualImpactId, parsedConfig)
          : undefined,
      treatmentStrategy: allowedTreatment.has(treatment) ? treatment : 'mitigate',
      treatmentPlan: asString(item.treatmentPlan) || undefined,
      sourceFindingId: asString(item.sourceFindingId) || undefined,
      businessUnit: asString(item.businessUnit) || undefined,
      createdAt: asString(item.createdAt, nowIso()),
      updatedAt: asString(item.updatedAt, nowIso())
    } as GrcRisk;
  });

  const assessments = asArray<Record<string, unknown>>(value.assessments).map(item => {
    const status = asString(item.status, 'draft');
    const fallbackScopeType = parsedConfig.recordDefaults.assessmentScopeType;
    const fallbackScopeValue = parsedConfig.recordDefaults.assessmentScopeValue || parsedConfig.recordDefaults.assessmentScopeName;
    const fallbackScopeName = parsedConfig.recordDefaults.assessmentScopeName || fallbackScopeValue || 'Scope';
    const parsedScopeItems = asArray<unknown>(item.scopeItems)
      .map(scopeItem => normalizeAssessmentScopeItem(scopeItem, fallbackScopeType, fallbackScopeName))
      .filter((scopeItem): scopeItem is AssessmentScopeItem => scopeItem !== null);
    const scopeItems = parsedScopeItems.length > 0
      ? parsedScopeItems
      : [{
          id: `${fallbackScopeType}-${toSlug(fallbackScopeValue || fallbackScopeName) || createId('scope')}`,
          type: fallbackScopeType,
          value: fallbackScopeValue || fallbackScopeName,
          name: fallbackScopeName
        }];
    const parsedTierFilter = isRecord(item.tierFilter) ? item.tierFilter : {};

    return {
      id: asString(item.id, createId('assessment')),
      title: asString(item.title, 'Assessment'),
      status:
        status === 'draft' || status === 'in_review' || status === 'completed' || status === 'archived'
          ? status
          : 'draft',
      scopeItems,
      tierFilter: {
        tier1: asString(parsedTierFilter.tier1) || undefined,
        tier2: asString(parsedTierFilter.tier2) || undefined,
        tier3: asString(parsedTierFilter.tier3) || undefined,
        tier4: asString(parsedTierFilter.tier4) || undefined
      },
      riskManagementPlan: parseRiskManagementPlan(item.riskManagementPlan),
      threatModel: parseAssessmentThreatModel(item.threatModel),
      owner: asString(item.owner) || undefined,
      reviewer: asString(item.reviewer) || undefined,
      startDate: asString(item.startDate) || undefined,
      dueDate: asString(item.dueDate) || undefined,
      completedDate: asString(item.completedDate) || undefined,
      methodologyNote: asString(item.methodologyNote) || undefined,
      assumptionNote: asString(item.assumptionNote) || undefined,
      riskIds: asArray<string>(item.riskIds).filter(Boolean),
      threatActorIds: asArray<string>(item.threatActorIds).filter(Boolean),
      soaGapIds: asArray<string>(item.soaGapIds).filter(Boolean),
      taskIds: asArray<string>(item.taskIds).filter(Boolean),
      linkedImplementedControlIds: asArray<string>(item.linkedImplementedControlIds).filter(Boolean),
      linkedInitiativeIds: asArray<string>(item.linkedInitiativeIds).filter(Boolean),
      summary: asString(item.summary) || undefined,
      findings: asString(item.findings) || undefined,
      recommendations: asString(item.recommendations) || undefined,
      evidenceSummary: asString(item.evidenceSummary) || undefined,
      businessUnit: asString(item.businessUnit) || undefined,
      createdAt: asString(item.createdAt, nowIso()),
      updatedAt: asString(item.updatedAt, nowIso())
    } as GrcAssessment;
  });

  const controlSets = asArray<Record<string, unknown>>(value.controlSets).map(item => {
    const controls = asArray<Record<string, unknown>>(item.controls).map((control, index) => ({
      id: asString(control.id, `control-${index + 1}`),
      controlId: asString(control.controlId, `CONTROL-${index + 1}`),
      title: asString(control.title, asString(control.controlId, `Control ${index + 1}`)),
      description: asString(control.description) || undefined,
      family: asString(control.family) || undefined,
      tags: asArray<string>(control.tags).filter(Boolean),
      sourceRow: asNumber(control.sourceRow, 0) || undefined
    }));

    return {
      id: asString(item.id, createId('controlset')),
      name: asString(item.name, 'Imported Control Set'),
      version: asString(item.version) || undefined,
      releaseDate: asString(item.releaseDate) || undefined,
      sourceType: asString(item.sourceType) === 'built_in' ? 'built_in' : 'imported',
      importedAt: asString(item.importedAt) || undefined,
      importSourceName: asString(item.importSourceName) || undefined,
      controls
    } as GrcControlSet;
  });

  const soaEntries = asArray<Record<string, unknown>>(value.soaEntries).map(item => {
    const applicability = asString(item.applicability, 'applicable') as SoaApplicability;
    const implementationStatus = asString(item.implementationStatus, 'not_implemented') as SoaImplementationStatus;

    return {
      id: asString(item.id, createId('soa')),
      controlSetId: asString(item.controlSetId),
      controlId: asString(item.controlId),
      scopeType: asString(item.scopeType, 'system') as GrcSoaEntry['scopeType'],
      scopeId: asString(item.scopeId, 'system'),
      applicability: allowedApplicability.has(applicability) ? applicability : 'applicable',
      implementationStatus: allowedImplementation.has(implementationStatus)
        ? implementationStatus
        : 'not_implemented',
      justification: asString(item.justification) || undefined,
      mitigatesRiskIds: asArray<string>(item.mitigatesRiskIds).filter(Boolean),
      diagramRefs: parseDiagramRefs(item.diagramRefs),
      evidence: parseLegacyEvidence(item),
      maturityLevel: typeof item.maturityLevel === 'number' && item.maturityLevel >= 0 ? item.maturityLevel : undefined,
      weight: typeof item.weight === 'number' && Number.isFinite(item.weight as number) && (item.weight as number) > 0 ? item.weight as number : undefined,
      importance: (() => {
        const v = asString(item.importance);
        return v === 'mandatory' || v === 'recommended' || v === 'optional' ? v as GrcSoaImportance : undefined;
      })(),
      updatedAt: asString(item.updatedAt, nowIso())
    } as GrcSoaEntry;
  });

  const workflowTasks = asArray<Record<string, unknown>>(value.workflowTasks).map(item => {
    const status = asString(item.status, 'todo') as GrcTaskStatus;
    const priority = asString(item.priority, 'medium') as GrcTaskPriority;
    const type = asString(item.type, 'review') as GrcTaskType;

    return {
      id: asString(item.id, createId('task')),
      title: asString(item.title, 'Workflow Task'),
      description: asString(item.description) || undefined,
      type: allowedTaskType.has(type) ? type : 'review',
      status: allowedTaskStatus.has(status) ? status : 'todo',
      priority: allowedTaskPriority.has(priority) ? priority : 'medium',
      owner: asString(item.owner) || undefined,
      dueDate: asString(item.dueDate) || undefined,
      riskId: asString(item.riskId) || undefined,
      controlSetId: asString(item.controlSetId) || undefined,
      controlId: asString(item.controlId) || undefined,
      assessmentId: asString(item.assessmentId) || undefined,
      assetId: asString(item.assetId) || undefined,
      sourceFindingId: asString(item.sourceFindingId) || undefined,
      createdAt: asString(item.createdAt, nowIso()),
      updatedAt: asString(item.updatedAt, nowIso())
    } as GrcTask;
  });

  const allowedDocType = new Set(['policy', 'process', 'procedure', 'guideline', 'sop', 'standard', 'framework', 'other']);
  const allowedDocStatus = new Set(['draft', 'active', 'under_review', 'archived', 'superseded']);
  const governanceDocuments = asArray<Record<string, unknown>>(value.governanceDocuments).map(item => {
    const docType = asString(item.type, 'other');
    const docStatus = asString(item.status, 'draft');
    return {
      id: asString(item.id, createId('gov')),
      title: asString(item.title, 'Untitled Document'),
      type: allowedDocType.has(docType) ? docType : 'other',
      description: asString(item.description) || undefined,
      owner: asString(item.owner) || undefined,
      reviewDate: asString(item.reviewDate) || undefined,
      nextReviewDate: asString(item.nextReviewDate) || undefined,
      status: allowedDocStatus.has(docStatus) ? docStatus : 'draft',
      version: asString(item.version) || undefined,
      url: asString(item.url) || undefined,
      tags: asArray<string>(item.tags).filter(Boolean),
      linkedRiskIds: asArray<string>(item.linkedRiskIds).filter(Boolean),
      linkedControlSetIds: asArray<string>(item.linkedControlSetIds).filter(Boolean),
      linkedAssessmentIds: asArray<string>(item.linkedAssessmentIds).filter(Boolean),
      reviewedBy: asString(item.reviewedBy) || undefined,
      approvedBy: asString(item.approvedBy) || undefined,
      approvalDate: asString(item.approvalDate) || undefined,
      createdAt: asString(item.createdAt, nowIso()),
      updatedAt: asString(item.updatedAt, nowIso())
    };
  }) as GrcWorkspace['governanceDocuments'];

  const tierCatalogue = asArray<Record<string, unknown>>(value.tierCatalogue)
    .map(item => ({
      id: asString(item.id, createId('tier')),
      tier: Math.min(Math.max(asNumber(item.tier, 4), 1), 4) as 1 | 2 | 3 | 4,
      label: asString(item.label, 'Uncategorized'),
      description: asString(item.description) || undefined,
      parentId: asString(item.parentId) || undefined,
      tags: asArray<string>(item.tags).filter(Boolean)
    }))
    .filter(item => item.label);

  const threatActors = asArray<Record<string, unknown>>(value.threatActors).map(item => {
    const actorType = asString(item.type, 'opportunistic');
    const resourceLevel = asString(item.resourceLevel, 'moderate');
    return {
      id: asString(item.id, createId('actor')),
      name: asString(item.name, 'Unnamed Actor'),
      type: (allowedThreatActorType.has(actorType as GrcThreatActorType) ? actorType : 'opportunistic') as GrcThreatActorType,
      capabilityLevel: Math.min(5, Math.max(1, Math.round(asNumber(item.capabilityLevel, 3)))),
      resourceLevel: (allowedThreatActorResourceLevel.has(resourceLevel as GrcThreatActorResourceLevel) ? resourceLevel : 'moderate') as GrcThreatActorResourceLevel,
      motivation: asString(item.motivation, ''),
      description: asString(item.description) || undefined,
      targetedAssetIds: asArray<string>(item.targetedAssetIds).filter(Boolean),
      targetedAssetDomains: asArray<string>(item.targetedAssetDomains).filter(d => assetDomainSet.has(d)) as GrcAssetDomain[] || undefined,
      tags: asArray<string>(item.tags).filter(Boolean),
      createdAt: asString(item.createdAt, nowIso()),
      updatedAt: asString(item.updatedAt, nowIso())
    } as GrcThreatActor;
  });

  const threatScenarios = asArray<Record<string, unknown>>(value.threatScenarios).map(item => ({
    id: asString(item.id, createId('scenario')),
    title: asString(item.title, 'Unnamed Scenario'),
    description: asString(item.description, ''),
    threatActorId: asString(item.threatActorId, ''),
    targetedAssetIds: asArray<string>(item.targetedAssetIds).filter(Boolean),
    attackTechniques: asArray<string>(item.attackTechniques).filter(Boolean),
    linkedRiskIds: asArray<string>(item.linkedRiskIds).filter(Boolean),
    linkedAssessmentIds: asArray<string>(item.linkedAssessmentIds).filter(Boolean) || undefined,
    likelihood: asString(item.likelihood) || undefined,
    impact: asString(item.impact) || undefined,
    createdAt: asString(item.createdAt, nowIso()),
    updatedAt: asString(item.updatedAt, nowIso())
  }) as GrcThreatScenario);

  const appetiteRules = asArray<Record<string, unknown>>(value.appetiteRules).map(item => {
    const scopeDomain = asString(item.scopeAssetDomain, '');
    const validDomain = assetDomainSet.has(scopeDomain) ? scopeDomain : undefined;
    return {
      id: asString(item.id, createId('appetite')),
      name: asString(item.name, 'Unnamed Rule'),
      description: asString(item.description) || undefined,
      scopeAssetDomain: validDomain as GrcAssetDomain | undefined,
      scopeTier1: asString(item.scopeTier1) || undefined,
      scopeAssetCriticalityMin: asNumber(item.scopeAssetCriticalityMin, 0) || undefined,
      thresholdScore: asNumber(item.thresholdScore, riskModel.appetiteThresholdScore),
      createdAt: asString(item.createdAt, nowIso()),
      updatedAt: asString(item.updatedAt, nowIso())
    } as GrcAppetiteRule;
  });

  const IC_TYPES = new Set<string>(['technical','administrative','physical','operational']);
  const IC_STATUSES = new Set<string>(['active','planned','under_review','deprecated','inactive']);
  const IC_AUTOMATION = new Set<string>(['manual','semi_automated','fully_automated']);
  const IC_CATEGORIES = new Set<string>(['access_control','encryption','monitoring','network_security','endpoint_protection','identity_management','logging','backup_recovery','incident_response','policy','training','physical_security','other']);

  const implementedControls = asArray<Record<string, unknown>>(value.implementedControls).map(ic => ({
    id: asString(ic.id, createId('ic')),
    title: asString(ic.title, ''),
    description: asString(ic.description, ''),
    controlType: (IC_TYPES.has(asString(ic.controlType, '')) ? asString(ic.controlType, 'technical') : 'technical') as GrcImplementedControlType,
    category: (IC_CATEGORIES.has(asString(ic.category, '')) ? asString(ic.category, 'other') : 'other') as GrcImplementedControlCategory,
    status: (IC_STATUSES.has(asString(ic.status, '')) ? asString(ic.status, 'active') : 'active') as GrcImplementedControlStatus,
    automationLevel: (IC_AUTOMATION.has(asString(ic.automationLevel, '')) ? asString(ic.automationLevel, 'manual') : 'manual') as GrcImplementedControlAutomation,
    owner: asString(ic.owner, ''),
    vendor: asString(ic.vendor, ''),
    product: asString(ic.product, ''),
    version: asString(ic.version, ''),
    implementedDate: asString(ic.implementedDate, ''),
    lastReviewDate: asString(ic.lastReviewDate, ''),
    nextReviewDate: asString(ic.nextReviewDate, ''),
    linkedSoaEntryIds: asArray<string>(ic.linkedSoaEntryIds).filter(v => typeof v === 'string'),
    linkedRiskIds: asArray<string>(ic.linkedRiskIds).filter(v => typeof v === 'string'),
    linkedAssetIds: asArray<string>(ic.linkedAssetIds).filter(v => typeof v === 'string'),
    linkedAssessmentIds: asArray<string>(ic.linkedAssessmentIds).filter(v => typeof v === 'string'),
    notes: asString(ic.notes, ''),
    auditHistory: asArray<Record<string, unknown>>(ic.auditHistory).map(audit => {
      const AUDIT_RESULTS = new Set(['pass','fail','partial','pending']);
      const r = asString(audit.result, 'pending');
      return {
        id: asString(audit.id, createId('audit')),
        plannedDate: asString(audit.plannedDate, ''),
        actualDate: asString(audit.actualDate, ''),
        auditor: asString(audit.auditor, ''),
        result: (AUDIT_RESULTS.has(r) ? r : 'pending') as GrcControlAuditResult,
        evidenceRefs: asArray<string>(audit.evidenceRefs).filter(Boolean),
        notes: asString(audit.notes, ''),
        createdAt: asString(audit.createdAt, nowIso()),
      };
    }) || undefined,
    createdAt: asString(ic.createdAt, nowIso()),
    updatedAt: asString(ic.updatedAt, nowIso()),
  }) as GrcImplementedControl);

  const THIRD_PARTY_CATEGORIES = new Set<string>(['cloud_provider','saas','managed_service','contractor','supplier','partner','other']);
  const THIRD_PARTY_STATUSES = new Set<string>(['active','under_review','onboarding','offboarding','terminated']);
  const THIRD_PARTY_RATINGS = new Set<string>(['critical','high','medium','low','not_assessed']);
  const THIRD_PARTY_CLASSIFICATIONS = new Set<string>(['public','internal','confidential','restricted']);
  const thirdParties = asArray<Record<string, unknown>>(value.thirdParties).map(tp => ({
    id: asString(tp.id, createId('tp')),
    name: asString(tp.name, ''),
    description: asString(tp.description, ''),
    category: (THIRD_PARTY_CATEGORIES.has(asString(tp.category, '')) ? asString(tp.category, 'other') : 'other') as GrcThirdPartyCategory,
    status: (THIRD_PARTY_STATUSES.has(asString(tp.status, '')) ? asString(tp.status, 'active') : 'active') as GrcThirdPartyStatus,
    riskRating: (THIRD_PARTY_RATINGS.has(asString(tp.riskRating, '')) ? asString(tp.riskRating, 'not_assessed') : 'not_assessed') as GrcThirdPartyRiskRating,
    dataClassification: (THIRD_PARTY_CLASSIFICATIONS.has(asString(tp.dataClassification, '')) ? asString(tp.dataClassification, 'internal') : 'internal') as GrcThirdPartyDataClassification,
    linkedAssetIds: asArray<string>(tp.linkedAssetIds).filter(v => typeof v === 'string'),
    linkedRiskIds: asArray<string>(tp.linkedRiskIds).filter(v => typeof v === 'string'),
    contactName: asString(tp.contactName, ''),
    contactEmail: asString(tp.contactEmail, ''),
    contractExpiry: asString(tp.contractExpiry, ''),
    lastAssessmentDate: asString(tp.lastAssessmentDate, ''),
    nextReviewDate: asString(tp.nextReviewDate, ''),
    notes: asString(tp.notes, ''),
  }) as GrcThirdParty);

  const INITIATIVE_CATEGORIES = new Set<string>(['uplift','remediation','compliance','transformation','hardening','other']);
  const INITIATIVE_STATUSES = new Set<string>(['proposed','approved','in_progress','on_hold','completed','cancelled']);
  const INITIATIVE_PRIORITIES = new Set<string>(['critical','high','medium','low']);
  const MILESTONE_STATUSES = new Set<string>(['pending','in_progress','completed','skipped']);

  const securityInitiatives = asArray<Record<string, unknown>>(value.securityInitiatives).map(si => {
    const milestones = asArray<Record<string, unknown>>(si.milestones).map(ms => ({
      id: asString(ms.id, createId('ms')),
      title: asString(ms.title, ''),
      description: asString(ms.description, ''),
      status: (MILESTONE_STATUSES.has(asString(ms.status, '')) ? asString(ms.status, 'pending') : 'pending') as GrcMilestoneStatus,
      dueDate: asString(ms.dueDate, ''),
      completedDate: asString(ms.completedDate, ''),
      owner: asString(ms.owner, ''),
    }));
    return {
      id: asString(si.id, createId('si')),
      title: asString(si.title, ''),
      description: asString(si.description, ''),
      category: (INITIATIVE_CATEGORIES.has(asString(si.category, '')) ? asString(si.category, 'other') : 'other') as GrcInitiativeCategory,
      status: (INITIATIVE_STATUSES.has(asString(si.status, '')) ? asString(si.status, 'proposed') : 'proposed') as GrcInitiativeStatus,
      priority: (INITIATIVE_PRIORITIES.has(asString(si.priority, '')) ? asString(si.priority, 'medium') : 'medium') as GrcInitiativePriority,
      owner: asString(si.owner, ''),
      executiveSponsor: asString(si.executiveSponsor, ''),
      currentState: asString(si.currentState, ''),
      targetState: asString(si.targetState, ''),
      startDate: asString(si.startDate, ''),
      targetDate: asString(si.targetDate, ''),
      completedDate: asString(si.completedDate, ''),
      milestones,
      linkedRiskIds: asArray<string>(si.linkedRiskIds).filter(v => typeof v === 'string'),
      linkedControlSetIds: asArray<string>(si.linkedControlSetIds).filter(v => typeof v === 'string'),
      linkedAssetIds: asArray<string>(si.linkedAssetIds).filter(v => typeof v === 'string'),
      linkedImplementedControlIds: asArray<string>(si.linkedImplementedControlIds).filter(v => typeof v === 'string'),
      linkedAssessmentIds: asArray<string>(si.linkedAssessmentIds).filter(v => typeof v === 'string'),
      notes: asString(si.notes, ''),
      createdAt: asString(si.createdAt, nowIso()),
      updatedAt: asString(si.updatedAt, nowIso()),
    } as GrcSecurityInitiative;
  });

  const ACCEPTANCE_STATUSES = new Set(['draft','pending_review','approved','rejected','expired']);
  const ACCEPTANCE_SCOPES = new Set(['risk','compliance','policy']);
  const riskAcceptances = asArray<Record<string, unknown>>(value.riskAcceptances).map(ra => ({
    id: asString(ra.id, createId('ra')),
    riskId: asString(ra.riskId, ''),
    title: asString(ra.title, ''),
    scopeType: (ACCEPTANCE_SCOPES.has(asString(ra.scopeType, '')) ? asString(ra.scopeType, 'risk') : 'risk') as GrcRiskAcceptanceScopeType,
    requestedBy: asString(ra.requestedBy, ''),
    approvedBy: asString(ra.approvedBy, ''),
    status: (ACCEPTANCE_STATUSES.has(asString(ra.status, '')) ? asString(ra.status, 'draft') : 'draft') as GrcRiskAcceptanceStatus,
    justification: asString(ra.justification, ''),
    conditions: asString(ra.conditions, ''),
    emailLink: asString(ra.emailLink) || undefined,
    effectiveDate: asString(ra.effectiveDate, ''),
    expirationDate: asString(ra.expirationDate, ''),
    reviewDate: asString(ra.reviewDate, ''),
    notes: asString(ra.notes, ''),
    createdAt: asString(ra.createdAt, nowIso()),
    updatedAt: asString(ra.updatedAt, nowIso()),
  }) as GrcRiskAcceptance);

  const MAPPING_RELATIONSHIPS = new Set(['equivalent','partial','related']);
  const frameworkMappings = asArray<Record<string, unknown>>(value.frameworkMappings).map(fm => ({
    id: asString(fm.id, createId('fmap')),
    sourceControlSetId: asString(fm.sourceControlSetId, ''),
    sourceControlId: asString(fm.sourceControlId, ''),
    targetControlSetId: asString(fm.targetControlSetId, ''),
    targetControlId: asString(fm.targetControlId, ''),
    relationship: (MAPPING_RELATIONSHIPS.has(asString(fm.relationship, '')) ? asString(fm.relationship, 'related') : 'related') as GrcFrameworkMappingRelationship,
    notes: asString(fm.notes, ''),
    createdAt: asString(fm.createdAt, nowIso()),
  }) as GrcFrameworkMapping);

  const INCIDENT_SEVERITIES = new Set(['critical','high','medium','low']);
  const INCIDENT_STATUSES = new Set(['identified','triaged','investigating','contained','resolved','closed']);
  const incidents = asArray<Record<string, unknown>>(value.incidents).map(inc => ({
    id: asString(inc.id, createId('inc')),
    title: asString(inc.title, ''),
    description: asString(inc.description, ''),
    severity: (INCIDENT_SEVERITIES.has(asString(inc.severity, '')) ? asString(inc.severity, 'medium') : 'medium') as GrcIncidentSeverity,
    status: (INCIDENT_STATUSES.has(asString(inc.status, '')) ? asString(inc.status, 'identified') : 'identified') as GrcIncidentStatus,
    detectedDate: asString(inc.detectedDate, ''),
    resolvedDate: asString(inc.resolvedDate, ''),
    closedDate: asString(inc.closedDate, ''),
    owner: asString(inc.owner, ''),
    linkedRiskIds: asArray<string>(inc.linkedRiskIds).filter(Boolean),
    linkedAssetIds: asArray<string>(inc.linkedAssetIds).filter(Boolean),
    linkedFindingIds: asArray<string>(inc.linkedFindingIds).filter(Boolean),
    timelineEntries: asArray<Record<string, unknown>>(inc.timelineEntries).map(te => ({
      id: asString(te.id, createId('tle')),
      date: asString(te.date, ''),
      description: asString(te.description, ''),
      actor: asString(te.actor, ''),
    })),
    lessonsLearned: asString(inc.lessonsLearned, ''),
    notes: asString(inc.notes, ''),
    createdAt: asString(inc.createdAt, nowIso()),
    updatedAt: asString(inc.updatedAt, nowIso()),
  }) as GrcIncident);

  const aiAssist = isRecord(value.aiAssist) ? value.aiAssist : {};
  const aiDefaults = createDefaultAIAssistConfig();

  const incomingVersion = asString((value as Record<string, unknown>).schemaVersion, '1.0');
  if (incomingVersion !== '1.0') {
    console.warn(`GRC workspace schemaVersion "${incomingVersion}" is newer than supported "1.0"; loading with best-effort normalisation.`);
  }

  return {
    schemaVersion: '1.0',
    createdAt: asString(value.createdAt, fallback.createdAt),
    updatedAt: nowIso(),
    riskModel,
    tierCatalogue: tierCatalogue.length > 0 ? tierCatalogue : fallback.tierCatalogue,
    assets,
    findings,
    risks,
    assessments,
    controlSets,
    soaEntries,
    workflowTasks,
    governanceDocuments,
    threatActors,
    threatScenarios,
    appetiteRules,
    thirdParties,
    securityInitiatives,
    implementedControls,
    riskAcceptances,
    frameworkMappings,
    incidents,
    aiAssist: {
      enabled: asBoolean(aiAssist.enabled, aiDefaults.enabled),
      contextScope: asString(aiAssist.contextScope, aiDefaults.contextScope) === 'workspace' ? 'workspace' : 'linked',
      contextDetail: asString(aiAssist.contextDetail, aiDefaults.contextDetail) === 'detailed' ? 'detailed' : 'summary',
      includeAssets: asBoolean(aiAssist.includeAssets, aiDefaults.includeAssets),
      includeRisks: asBoolean(aiAssist.includeRisks, aiDefaults.includeRisks),
      includeSoaEntries: asBoolean(aiAssist.includeSoaEntries, aiDefaults.includeSoaEntries),
      includeTasks: asBoolean(aiAssist.includeTasks, aiDefaults.includeTasks),
      includeAssessments: asBoolean(aiAssist.includeAssessments, aiDefaults.includeAssessments),
      includeThreatProfiles: asBoolean(aiAssist.includeThreatProfiles, aiDefaults.includeThreatProfiles),
      includeGovernanceDocuments: asBoolean(aiAssist.includeGovernanceDocuments, aiDefaults.includeGovernanceDocuments),
      includeAppetiteRules: asBoolean(aiAssist.includeAppetiteRules, aiDefaults.includeAppetiteRules),
      includeFindings: asBoolean(aiAssist.includeFindings, aiDefaults.includeFindings),
      includeThirdParties: asBoolean(aiAssist.includeThirdParties, aiDefaults.includeThirdParties),
      includeSecurityInitiatives: asBoolean(aiAssist.includeSecurityInitiatives, aiDefaults.includeSecurityInitiatives),
      includeImplementedControls: asBoolean(aiAssist.includeImplementedControls, aiDefaults.includeImplementedControls),
      includeRiskAcceptances: asBoolean(aiAssist.includeRiskAcceptances, aiDefaults.includeRiskAcceptances),
      includeFrameworkMappings: asBoolean(aiAssist.includeFrameworkMappings, aiDefaults.includeFrameworkMappings),
      includeIncidents: asBoolean(aiAssist.includeIncidents, aiDefaults.includeIncidents),
      maxItemsPerSection: Math.min(
        100,
        Math.max(5, Math.round(asNumber(aiAssist.maxItemsPerSection, aiDefaults.maxItemsPerSection)))
      )
    },
    config: parsedConfig
  };
};

const ignoredNodeTypes = new Set([
  'securityZone',
  'freehand',
  'freehandNode',
  'drawingNode',
  'shapeNode',
  'textAnnotation'
]);

const inferNodeLabel = (node: DiagramNodeSummary): string => node.label || node.type || node.id;

export const syncAssetsFromDiagram = (
  workspace: GrcWorkspace,
  diagramSnapshot: DiagramContextSnapshot
): { workspace: GrcWorkspace; createdCount: number; linkedCount: number } => {
  const nextAssets = [...workspace.assets];
  const config = getConfig(workspace);
  let createdCount = 0;
  let linkedCount = 0;

  diagramSnapshot.nodes.forEach(node => {
    if (!node.id || ignoredNodeTypes.has(node.type || '')) {
      return;
    }

    const nodeRef: DiagramNodeRef = {
      diagramId: diagramSnapshot.diagramId,
      nodeId: node.id,
      nodeLabel: inferNodeLabel(node),
      nodeType: node.type
    };

    const existingByRef = nextAssets.find(asset =>
      asset.diagramRefs.some(ref => ref.diagramId === nodeRef.diagramId && ref.nodeId === nodeRef.nodeId)
    );
    if (existingByRef) {
      linkedCount += 1;
      return;
    }

    const inferredDomain = inferAssetDomainFromType(node.type || inferNodeLabel(node));
    const domain = config.assetCategories[inferredDomain].length > 0
      ? inferredDomain
      : config.recordDefaults.assetDomain;
    const category = getDefaultCategoryForDomain(config, domain);
    nextAssets.push({
      id: createId('asset'),
      name: inferNodeLabel(node),
      type: node.type || category,
      domain,
      category,
      businessCriticality: clampToCriticalityScale(
        config.recordDefaults.assetBusinessCriticality,
        config.assetCriticalityScale
      ),
      securityCriticality: clampToCriticalityScale(
        config.recordDefaults.assetSecurityCriticality,
        config.assetCriticalityScale
      ),
      criticality: { ...config.recordDefaults.assetCriticality },
      diagramRefs: [nodeRef],
      createdAt: nowIso(),
      updatedAt: nowIso()
    });
    createdCount += 1;
  });

  return {
    workspace: {
      ...workspace,
      assets: nextAssets,
      updatedAt: nowIso()
    },
    createdCount,
    linkedCount
  };
};

export const syncConnectionsFromDiagram = (
  workspace: GrcWorkspace,
  diagramSnapshot: DiagramContextSnapshot
): { workspace: GrcWorkspace; createdCount: number; linkedCount: number } => {
  const nextAssets = [...workspace.assets];
  const config = getConfig(workspace);
  let createdCount = 0;
  let linkedCount = 0;

  const diagramEdges = diagramSnapshot.edges || [];
  const nodeMap = new Map(diagramSnapshot.nodes.map(n => [n.id, n]));

  diagramEdges.forEach(edge => {
    if (!edge.id) return;

    const existingByRef = nextAssets.find(asset =>
      asset.diagramRefs.some(ref => ref.diagramId === diagramSnapshot.diagramId && ref.nodeId === edge.id)
    );
    if (existingByRef) {
      linkedCount += 1;
      return;
    }

    const sourceNode = nodeMap.get(edge.source);
    const targetNode = nodeMap.get(edge.target);
    const sourceName = sourceNode?.label || edge.source;
    const targetName = targetNode?.label || edge.target;
    const edgeLabel = edge.label || `${sourceName} -> ${targetName}`;
    const category = getDefaultCategoryForDomain(config, 'network');

    const edgeRef: DiagramNodeRef = {
      diagramId: diagramSnapshot.diagramId,
      nodeId: edge.id,
      nodeLabel: edgeLabel,
      nodeType: 'edge',
      sourceNodeId: edge.source,
      targetNodeId: edge.target
    };

    nextAssets.push({
      id: createId('asset'),
      name: edgeLabel,
      type: edge.protocol || category,
      domain: 'network' as GrcAssetDomain,
      category,
      isConnection: true,
      businessCriticality: clampToCriticalityScale(
        config.recordDefaults.assetBusinessCriticality,
        config.assetCriticalityScale
      ),
      securityCriticality: clampToCriticalityScale(
        config.recordDefaults.assetSecurityCriticality,
        config.assetCriticalityScale
      ),
      criticality: { ...config.recordDefaults.assetCriticality },
      diagramRefs: [edgeRef],
      createdAt: nowIso(),
      updatedAt: nowIso()
    });
    createdCount += 1;
  });

  return {
    workspace: {
      ...workspace,
      assets: nextAssets,
      updatedAt: nowIso()
    },
    createdCount,
    linkedCount
  };
};

export interface DiagramGrcContextSummary {
  linkedAssets: GrcAsset[];
  linkedRisks: GrcRisk[];
  linkedSoaEntries: GrcSoaEntry[];
  linkedTasks: GrcTask[];
}

const normalizeScopeValue = (value: string | undefined): string => (value || '').trim().toLowerCase();

const normalizeProtocolToken = (value: string): string => value.trim().toLowerCase();

const protocolLayerLookup = (workspace: GrcWorkspace): Map<string, string> => {
  const lookup = new Map<string, string>();
  getConfig(workspace).assessmentScopes.protocolOsiMappings.forEach(mapping => {
    const protocol = normalizeProtocolToken(mapping.protocol);
    const layer = mapping.osiLayer.trim();
    if (!lookup.has(protocol) && protocol.length > 0 && layer.length > 0) {
      lookup.set(protocol, layer);
    }
  });
  return lookup;
};

const normalizeTierValue = (value?: string): string => normalizeScopeValue(value);

const matchesTierFilter = (risk: GrcRisk, tierFilter: GrcAssessment['tierFilter']): boolean => {
  if (tierFilter.tier1 && normalizeTierValue(risk.tierPath.tier1) !== normalizeTierValue(tierFilter.tier1)) {
    return false;
  }
  if (tierFilter.tier2 && normalizeTierValue(risk.tierPath.tier2) !== normalizeTierValue(tierFilter.tier2)) {
    return false;
  }
  if (tierFilter.tier3 && normalizeTierValue(risk.tierPath.tier3) !== normalizeTierValue(tierFilter.tier3)) {
    return false;
  }
  if (tierFilter.tier4 && normalizeTierValue(risk.tierPath.tier4) !== normalizeTierValue(tierFilter.tier4)) {
    return false;
  }
  return true;
};

const buildNodeZoneMap = (diagramSnapshot?: DiagramContextSnapshot | null): Map<string, string> => {
  const map = new Map<string, string>();
  if (!diagramSnapshot) {
    return map;
  }
  diagramSnapshot.nodes.forEach(node => {
    const zone = normalizeScopeValue(node.zone);
    if (zone.length > 0) {
      map.set(node.id, zone);
    }
  });
  return map;
};

const buildNodeProtocolMap = (diagramSnapshot?: DiagramContextSnapshot | null): Map<string, string[]> => {
  const map = new Map<string, string[]>();
  if (!diagramSnapshot) {
    return map;
  }
  diagramSnapshot.nodes.forEach(node => {
    const protocols = (node.protocols || [])
      .flatMap(protocol => parseDelimitedProtocols(protocol))
      .map(normalizeProtocolToken);
    if (protocols.length > 0) {
      map.set(node.id, Array.from(new Set(protocols)));
    }
  });
  return map;
};

const buildEdgeProtocolMap = (diagramSnapshot?: DiagramContextSnapshot | null): Array<{ edge: DiagramEdgeSummary; protocols: string[] }> => {
  if (!diagramSnapshot || !diagramSnapshot.edges) {
    return [];
  }
  return diagramSnapshot.edges.map(edge => ({
    edge,
    protocols: parseDelimitedProtocols(edge.protocol || '').map(normalizeProtocolToken)
  }));
};

const riskLinkedNodeIds = (
  risk: GrcRisk,
  workspace: GrcWorkspace,
  targetDiagramId?: string
): Set<string> => {
  const nodeIds = new Set<string>();
  risk.diagramLinks.forEach(link => {
    if (!targetDiagramId || link.diagramId === targetDiagramId) {
      link.nodeIds.forEach(nodeId => nodeIds.add(nodeId));
    }
  });
  risk.assetIds.forEach(assetId => {
    const asset = workspace.assets.find(item => item.id === assetId);
    if (!asset) {
      return;
    }
    asset.diagramRefs.forEach(ref => {
      if (!targetDiagramId || ref.diagramId === targetDiagramId) {
        nodeIds.add(ref.nodeId);
      }
    });
  });
  return nodeIds;
};

const riskLinkedAssets = (risk: GrcRisk, workspace: GrcWorkspace): GrcAsset[] =>
  risk.assetIds
    .map(assetId => workspace.assets.find(asset => asset.id === assetId))
    .filter((asset): asset is GrcAsset => Boolean(asset));

interface ScopeResolutionContext {
  targetDiagramId?: string;
  nodeZoneMap: Map<string, string>;
  nodeProtocolMap: Map<string, string[]>;
  edgeProtocolMap: Array<{ edge: DiagramEdgeSummary; protocols: string[] }>;
  layerLookup: Map<string, string>;
}

const buildScopeResolutionContext = (
  workspace: GrcWorkspace,
  diagramSnapshot?: DiagramContextSnapshot | null
): ScopeResolutionContext => ({
  targetDiagramId: diagramSnapshot?.diagramId,
  nodeZoneMap: buildNodeZoneMap(diagramSnapshot),
  nodeProtocolMap: buildNodeProtocolMap(diagramSnapshot),
  edgeProtocolMap: buildEdgeProtocolMap(diagramSnapshot),
  layerLookup: protocolLayerLookup(workspace)
});

const riskMatchesScopeItem = (
  risk: GrcRisk,
  scopeItem: AssessmentScopeItem,
  workspace: GrcWorkspace,
  context: ScopeResolutionContext
): boolean => {
  const normalizedValue = normalizeScopeValue(scopeItem.value || scopeItem.name);
  const nodeIds = riskLinkedNodeIds(risk, workspace, context.targetDiagramId);

  if (scopeItem.type === 'system') {
    return true;
  }

  if (scopeItem.type === 'diagram') {
    return risk.diagramLinks.some(link => normalizeScopeValue(link.diagramId) === normalizedValue);
  }

  if (scopeItem.type === 'asset_group') {
    return risk.assetIds.length > 0;
  }

  if (scopeItem.type === 'application') {
    const linkedAssets = riskLinkedAssets(risk, workspace).filter(asset => asset.domain === 'application');
    if (linkedAssets.length === 0) {
      return false;
    }
    if (!normalizedValue || normalizedValue === 'all' || normalizedValue === 'all applications') {
      return true;
    }
    return linkedAssets.some(asset =>
      normalizeScopeValue(asset.name) === normalizedValue
      || normalizeScopeValue(asset.category) === normalizedValue
    );
  }

  if (scopeItem.type === 'diagram_segment') {
    if (!normalizedValue) {
      return false;
    }
    const matchedNodeZone = Array.from(nodeIds.values()).some(nodeId => context.nodeZoneMap.get(nodeId) === normalizedValue);
    if (matchedNodeZone) {
      return true;
    }
    if (context.targetDiagramId) {
      const matchingZoneEdges = context.edgeProtocolMap
        .map(({ edge }) => edge)
        .filter(edge => normalizeScopeValue(edge.zone) === normalizedValue);
      if (matchingZoneEdges.some(edge => nodeIds.has(edge.source) || nodeIds.has(edge.target))) {
        return true;
      }
    }
    return false;
  }

  if (scopeItem.type === 'osi_layer') {
    if (!normalizedValue) {
      return false;
    }
    const protocolSet = new Set<string>();
    nodeIds.forEach(nodeId => {
      (context.nodeProtocolMap.get(nodeId) || []).forEach(protocol => protocolSet.add(protocol));
    });
    context.edgeProtocolMap.forEach(({ edge, protocols }) => {
      if (nodeIds.has(edge.source) || nodeIds.has(edge.target)) {
        protocols.forEach(protocol => protocolSet.add(protocol));
      }
    });
    return Array.from(protocolSet.values()).some(protocol => {
      const mappedLayer = context.layerLookup.get(protocol);
      return normalizeScopeValue(mappedLayer) === normalizedValue;
    });
  }

  return false;
};

export const summarizeAssessmentScopes = (assessment: GrcAssessment): string =>
  assessment.scopeItems.map(item => `${assessmentScopeTypeLabels[item.type]}: ${item.name}`).join(' | ');

export const resolveAssessmentRiskIds = (
  workspace: GrcWorkspace,
  scopeItems: AssessmentScopeItem[],
  tierFilter: GrcAssessment['tierFilter'],
  diagramSnapshot?: DiagramContextSnapshot | null
): string[] => {
  const context = buildScopeResolutionContext(workspace, diagramSnapshot);
  const scoped = scopeItems.length > 0
    ? workspace.risks.filter(risk =>
        scopeItems.some(scopeItem => riskMatchesScopeItem(risk, scopeItem, workspace, context))
      )
    : [...workspace.risks];
  return scoped
    .filter(risk => matchesTierFilter(risk, tierFilter))
    .map(risk => risk.id);
};

export const findAssessmentsForSecurityZone = (
  workspace: GrcWorkspace,
  zone: string,
  diagramId?: string
): GrcAssessment[] => {
  const normalizedZone = normalizeScopeValue(zone);
  const normalizedDiagramId = normalizeScopeValue(diagramId);
  return workspace.assessments.filter(assessment => {
    const hasZoneScope = assessment.scopeItems.some(scope =>
      scope.type === 'diagram_segment' && normalizeScopeValue(scope.value || scope.name) === normalizedZone
    );
    if (!hasZoneScope) {
      return false;
    }
    if (!normalizedDiagramId) {
      return true;
    }
    const diagramScope = assessment.scopeItems.some(scope =>
      scope.type === 'diagram' && normalizeScopeValue(scope.value || scope.name) === normalizedDiagramId
    );
    return diagramScope;
  });
};

export const buildDiagramGrcContext = (
  workspace: GrcWorkspace,
  diagramId: string,
  selectedNodeIds: string[] = []
): DiagramGrcContextSummary => {
  const selectedSet = new Set(selectedNodeIds);

  const linkedAssets = workspace.assets.filter(asset =>
    asset.diagramRefs.some(ref =>
      ref.diagramId === diagramId && (selectedSet.size === 0 || selectedSet.has(ref.nodeId))
    )
  );

  const linkedAssetIdSet = new Set(linkedAssets.map(asset => asset.id));
  const linkedRisks = workspace.risks.filter(risk => {
    const byAsset = risk.assetIds.some(assetId => linkedAssetIdSet.has(assetId));
    const byDiagram = risk.diagramLinks.some(link => {
      if (link.diagramId !== diagramId) {
        return false;
      }
      if (selectedSet.size === 0) {
        return true;
      }
      return link.nodeIds.some(nodeId => selectedSet.has(nodeId));
    });
    return byAsset || byDiagram;
  });

  const linkedRiskIdSet = new Set(linkedRisks.map(risk => risk.id));
  const linkedSoaEntries = workspace.soaEntries.filter(entry => {
    const byDiagram = entry.diagramRefs.some(ref =>
      ref.diagramId === diagramId && (selectedSet.size === 0 || selectedSet.has(ref.nodeId))
    );
    const byRisk = entry.mitigatesRiskIds.some(riskId => linkedRiskIdSet.has(riskId));
    return byDiagram || byRisk;
  });

  const linkedAssetIdSetAll = new Set(linkedAssets.map(asset => asset.id));
  const linkedControlKeySet = new Set(linkedSoaEntries.map(entry => `${entry.controlSetId}:${entry.controlId}`));
  const linkedAssessmentIdSet = new Set(
    workspace.assessments
      .filter(assessment => assessment.scopeItems.some(scope => scope.type === 'diagram' && scope.value === diagramId))
      .map(assessment => assessment.id)
  );

  const linkedTasks = workspace.workflowTasks.filter(task => {
    const byRisk = !!task.riskId && linkedRiskIdSet.has(task.riskId);
    const byAsset = !!task.assetId && linkedAssetIdSetAll.has(task.assetId);
    const byAssessment = !!task.assessmentId && linkedAssessmentIdSet.has(task.assessmentId);
    const byControl = !!task.controlSetId && !!task.controlId && linkedControlKeySet.has(`${task.controlSetId}:${task.controlId}`);
    return byRisk || byAsset || byAssessment || byControl;
  });

  return { linkedAssets, linkedRisks, linkedSoaEntries, linkedTasks };
};

const truncateText = (value: string | undefined, maxLength = 220): string => {
  if (!value) return '';
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 3)}...`;
};

const formatShownCount = (shown: number, total: number): string =>
  shown < total ? `${shown}/${total}` : `${total}`;

export const buildGrcPromptContext = (
  workspace: GrcWorkspace,
  options: GrcAIAssistConfig,
  diagramId?: string,
  selectedNodeIds: string[] = [],
  diagramAttackPaths: DiagramAttackPath[] = []
): string => {
  if (!options.enabled) {
    return '';
  }

  const maxItems = Math.min(100, Math.max(5, Math.round(options.maxItemsPerSection || 20)));
  const useLinkedContext = options.contextScope === 'linked' && Boolean(diagramId);
  const detail = options.contextDetail === 'detailed' ? 'detailed' : 'summary';

  const linked = useLinkedContext
    ? buildDiagramGrcContext(workspace, diagramId as string, selectedNodeIds)
    : null;

  const risks = linked ? linked.linkedRisks : workspace.risks;
  const assets = linked ? linked.linkedAssets : workspace.assets;
  const soaEntries = linked ? linked.linkedSoaEntries : workspace.soaEntries;
  const tasks = linked ? linked.linkedTasks : workspace.workflowTasks;
  const linkedRiskIds = new Set(risks.map(risk => risk.id));
  const assessments = useLinkedContext
    ? workspace.assessments.filter(assessment =>
        assessment.scopeItems.some(scope => scope.type === 'diagram' && scope.value === diagramId) ||
        assessment.riskIds.some(riskId => linkedRiskIds.has(riskId))
      )
    : workspace.assessments;

  const controlSetNameById = new Map(workspace.controlSets.map(controlSet => [controlSet.id, controlSet.name]));

  const sections: string[] = [];
  sections.push('=== GRC WORKSPACE CONTEXT ===');
  sections.push(
    `Scope: ${useLinkedContext ? `Linked to active diagram (${diagramId})` : 'Full workspace'}` +
    `${selectedNodeIds.length > 0 ? ` | Selected nodes: ${selectedNodeIds.length}` : ''}`
  );
  sections.push(
    `Detail: ${detail} | Totals => Assets ${workspace.assets.length}, Risks ${workspace.risks.length}, ` +
    `SoA Entries ${workspace.soaEntries.length}, Tasks ${workspace.workflowTasks.length}, Assessments ${workspace.assessments.length}, ` +
    `Threat Actors ${(workspace.threatActors || []).length}, Threat Scenarios ${(workspace.threatScenarios || []).length}, ` +
    `Governance Docs ${(workspace.governanceDocuments || []).length}, Appetite Rules ${(workspace.appetiteRules || []).length}, ` +
    `Findings ${workspace.findings.length}, Third Parties ${(workspace.thirdParties || []).length}, ` +
    `Security Initiatives ${(workspace.securityInitiatives || []).length}, Implemented Controls ${(workspace.implementedControls || []).length}`
  );

  if (options.includeAssets && assets.length > 0) {
    const shown = assets.slice(0, maxItems);
    const lines = shown.map(asset => {
      if (detail === 'detailed') {
        return `- ${asset.name} [${asset.domain}/${asset.category}] owner=${asset.owner || 'Unassigned'} ` +
          `businessCriticality=${asset.businessCriticality} securityCriticality=${asset.securityCriticality} ` +
          `securityProfile(C=${asset.criticality.confidentiality},I=${asset.criticality.integrity},A=${asset.criticality.availability}) ` +
          `${asset.description ? `desc="${truncateText(asset.description, 180)}"` : ''}`.trim();
      }
      return `- ${asset.name} [${asset.domain}/${asset.category}] owner=${asset.owner || 'Unassigned'} ` +
        `biz=${asset.businessCriticality} sec=${asset.securityCriticality}`;
    });
    sections.push(`ASSETS (${formatShownCount(shown.length, assets.length)}):\n${lines.join('\n')}`);
  }

  if (options.includeThirdParties) {
    const allTp = workspace.thirdParties || [];
    const tps = useLinkedContext
      ? allTp.filter(tp => tp.linkedAssetIds.some(aid => assets.some(a => a.id === aid)))
      : allTp;
    if (tps.length > 0) {
      const shown = tps.slice(0, maxItems);
      const lines = shown.map(tp => {
        const base = `- ${tp.name} [${tp.category}] risk=${tp.riskRating} status=${tp.status} data=${tp.dataClassification}`;
        if (detail === 'detailed') {
          return `${base} | assets=${tp.linkedAssetIds.length} | risks=${tp.linkedRiskIds.length}` +
            `${tp.contractExpiry ? ` | expires=${tp.contractExpiry}` : ''}` +
            `${tp.nextReviewDate ? ` | nextReview=${tp.nextReviewDate}` : ''}` +
            `${tp.description ? ` | desc="${truncateText(tp.description, 180)}"` : ''}`;
        }
        return `${base} | assets=${tp.linkedAssetIds.length}`;
      });
      sections.push(`THIRD PARTIES / VENDORS (${formatShownCount(shown.length, tps.length)}):\n${lines.join('\n')}`);
    }
  }

  if (options.includeSecurityInitiatives) {
    const allSi = workspace.securityInitiatives || [];
    const sis = useLinkedContext
      ? allSi.filter(si => si.linkedRiskIds.some(rid => linkedRiskIds.has(rid)) || si.linkedAssetIds.some(aid => assets.some(a => a.id === aid)))
      : allSi;
    if (sis.length > 0) {
      const shown = sis.slice(0, maxItems);
      const lines = shown.map(si => {
        const completedMs = si.milestones.filter(m => m.status === 'completed').length;
        const totalMs = si.milestones.length;
        const progress = totalMs > 0 ? `${completedMs}/${totalMs}` : 'no milestones';
        const base = `- ${si.title} [${si.category}] status=${si.status} priority=${si.priority} progress=${progress}`;
        if (detail === 'detailed') {
          return `${base} | owner=${si.owner || 'Unassigned'} | sponsor=${si.executiveSponsor || 'None'}` +
            `${si.targetDate ? ` | target=${si.targetDate}` : ''}` +
            ` | risks=${si.linkedRiskIds.length} | controls=${si.linkedControlSetIds.length} | assets=${si.linkedAssetIds.length}` +
            `${si.currentState ? ` | current="${truncateText(si.currentState, 120)}"` : ''}` +
            `${si.targetState ? ` | target="${truncateText(si.targetState, 120)}"` : ''}`;
        }
        return `${base} | risks=${si.linkedRiskIds.length} | controls=${si.linkedControlSetIds.length}`;
      });
      sections.push(`SECURITY INITIATIVES (${formatShownCount(shown.length, sis.length)}):\n${lines.join('\n')}`);
    }
  }

  if (options.includeImplementedControls) {
    const allIc = workspace.implementedControls || [];
    const ics = useLinkedContext
      ? allIc.filter(ic => ic.linkedRiskIds.some(rid => linkedRiskIds.has(rid)) || ic.linkedAssetIds.some(aid => assets.some(a => a.id === aid)))
      : allIc;
    if (ics.length > 0) {
      const shown = ics.slice(0, maxItems);
      const lines = shown.map(ic => {
        const base = `- ${ic.title} [${ic.controlType}/${ic.category}] status=${ic.status} automation=${ic.automationLevel}`;
        if (detail === 'detailed') {
          return `${base} | owner=${ic.owner || 'Unassigned'} | vendor=${ic.vendor || 'N/A'} | product=${ic.product || 'N/A'}` +
            `${ic.nextReviewDate ? ` | nextReview=${ic.nextReviewDate}` : ''}` +
            ` | soaLinks=${ic.linkedSoaEntryIds.length} | risks=${ic.linkedRiskIds.length} | assets=${ic.linkedAssetIds.length} | assessments=${ic.linkedAssessmentIds.length}` +
            `${ic.description ? ` | desc="${truncateText(ic.description, 180)}"` : ''}`;
        }
        return `${base} | soaLinks=${ic.linkedSoaEntryIds.length} | risks=${ic.linkedRiskIds.length}`;
      });
      sections.push(`IMPLEMENTED CONTROLS (${formatShownCount(shown.length, ics.length)}):\n${lines.join('\n')}`);
    }
  }

  if (options.includeRisks && risks.length > 0) {
    const actorNameById = new Map((workspace.threatActors || []).map(a => [a.id, a.name]));
    const shown = risks.slice(0, maxItems);
    const lines = shown.map(risk => {
      const appetiteThreshold = resolveRiskAppetite(risk, workspace);
      const breached = risk.inherentScore.rawScore >= appetiteThreshold;
      const actorNames = (risk.threatActorIds || []).map(id => actorNameById.get(id)).filter(Boolean);
      const base = `- ${risk.title} | status=${risk.status} | rating=${risk.inherentScore.ratingLabel}(${risk.inherentScore.rawScore})` +
        `${breached ? ' | APPETITE_BREACH' : ''}` +
        `${actorNames.length > 0 ? ` | actors=${actorNames.join(',')}` : ''}`;
      if (detail === 'detailed') {
        return `${base} | treatment=${risk.treatmentStrategy} | owner=${risk.owner || 'Unassigned'} ` +
          `| appetiteThreshold=${appetiteThreshold}` +
          `${risk.description ? ` | desc="${truncateText(risk.description, 180)}"` : ''}`;
      }
      return `${base} | treatment=${risk.treatmentStrategy}`;
    });
    sections.push(`RISKS (${formatShownCount(shown.length, risks.length)}):\n${lines.join('\n')}`);
  }

  if (options.includeSoaEntries && soaEntries.length > 0) {
    const shown = soaEntries.slice(0, maxItems);
    const lines = shown.map(entry => {
      const controlSetName = controlSetNameById.get(entry.controlSetId) || entry.controlSetId;
      const base = `- ${controlSetName} :: ${entry.controlId} | applicability=${entry.applicability} | implementation=${entry.implementationStatus}`;
      if (detail === 'detailed') {
        return `${base} | linkedRisks=${entry.mitigatesRiskIds.length} | evidence=${entry.evidence.length}` +
          `${entry.justification ? ` | justification="${truncateText(entry.justification, 160)}"` : ''}`;
      }
      return `${base} | linkedRisks=${entry.mitigatesRiskIds.length}`;
    });
    sections.push(`SOA ENTRIES (${formatShownCount(shown.length, soaEntries.length)}):\n${lines.join('\n')}`);
  }

  if (options.includeTasks && tasks.length > 0) {
    const shown = tasks.slice(0, maxItems);
    const lines = shown.map(task => {
      const base = `- ${task.title} | type=${task.type} | status=${task.status} | priority=${task.priority}`;
      if (detail === 'detailed') {
        return `${base} | owner=${task.owner || 'Unassigned'}${task.dueDate ? ` | due=${task.dueDate}` : ''}`;
      }
      return base;
    });
    sections.push(`WORKFLOW TASKS (${formatShownCount(shown.length, tasks.length)}):\n${lines.join('\n')}`);
  }

  if (options.includeAssessments && assessments.length > 0) {
    const actorNameById = new Map((workspace.threatActors || []).map(a => [a.id, a.name]));
    const shown = assessments.slice(0, maxItems);
    const lines = shown.map(assessment => {
      const scopeSummary = assessment.scopeItems.map(scope => `${scope.type}:${scope.value}`).join(',') || 'system:system';
      const linkedActorNames = (assessment.threatActorIds || [])
        .map(id => actorNameById.get(id)).filter(Boolean);
      const base = `- ${assessment.title} | status=${assessment.status} | scopes=${scopeSummary}` +
        `${linkedActorNames.length > 0 ? ` | threatActors=${linkedActorNames.join(',')}` : ''}`;
      if (detail === 'detailed') {
        return `${base} | risks=${assessment.riskIds.length}` +
          `${assessment.summary ? ` | summary="${truncateText(assessment.summary, 180)}"` : ''}`;
      }
      return `${base} | risks=${assessment.riskIds.length}`;
    });
    sections.push(`ASSESSMENTS (${formatShownCount(shown.length, assessments.length)}):\n${lines.join('\n')}`);
  }

  if (options.includeThreatProfiles) {
    const threatActors = workspace.threatActors || [];
    if (threatActors.length > 0) {
      const shownActors = threatActors.slice(0, maxItems);
      const actorLines = shownActors.map(actor => {
        const base = `- ${actor.name} [${actor.type}] capability=${actor.capabilityLevel}/5 resources=${actor.resourceLevel}`;
        if (detail === 'detailed') {
          return `${base} motivation="${truncateText(actor.motivation, 120)}" targets=${actor.targetedAssetIds.length} tags=${actor.tags.join(',')}`;
        }
        return `${base} motivation="${truncateText(actor.motivation, 80)}"`;
      });
      sections.push(`THREAT ACTORS (${formatShownCount(shownActors.length, threatActors.length)}):\n${actorLines.join('\n')}`);
    }

    const scenarios = workspace.threatScenarios || [];
    if (scenarios.length > 0) {
      const shownScenarios = scenarios.slice(0, maxItems);
      const scenarioLines = shownScenarios.map(scenario => {
        const base = `- ${scenario.title} | actor=${threatActors.find((a: { id: string; name: string }) => a.id === scenario.threatActorId)?.name || 'Unknown'} | techniques=${scenario.attackTechniques.join(',')} | linkedRisks=${scenario.linkedRiskIds.length}`;
        if (detail === 'detailed') {
          return `${base}${scenario.likelihood ? ` | likelihood="${truncateText(scenario.likelihood, 80)}"` : ''}${scenario.impact ? ` | impact="${truncateText(scenario.impact, 80)}"` : ''}`;
        }
        return base;
      });
      sections.push(`THREAT SCENARIOS (${formatShownCount(shownScenarios.length, scenarios.length)}):\n${scenarioLines.join('\n')}`);
    }
  }

  if (options.includeGovernanceDocuments) {
    const docs = workspace.governanceDocuments || [];
    if (docs.length > 0) {
      const shownDocs = docs.slice(0, maxItems);
      const docLines = shownDocs.map(doc => {
        const base = `- ${doc.title} [${doc.type}] status=${doc.status} owner=${doc.owner || 'Unassigned'}`;
        if (detail === 'detailed') {
          return `${base} version=${doc.version || 'N/A'}${doc.nextReviewDate ? ` nextReview=${doc.nextReviewDate}` : ''} linkedRisks=${doc.linkedRiskIds.length} linkedControls=${doc.linkedControlSetIds.length}`;
        }
        return base;
      });
      sections.push(`GOVERNANCE DOCUMENTS (${formatShownCount(shownDocs.length, docs.length)}):\n${docLines.join('\n')}`);
    }
  }

  if (options.includeAppetiteRules) {
    const rules = workspace.appetiteRules || [];
    if (rules.length > 0) {
      const shownRules = rules.slice(0, maxItems);
      const ruleLines = shownRules.map(rule => {
        const scopes: string[] = [];
        if (rule.scopeAssetDomain) scopes.push(`domain=${rule.scopeAssetDomain}`);
        if (rule.scopeTier1) scopes.push(`tier1=${rule.scopeTier1}`);
        if (rule.scopeAssetCriticalityMin != null) scopes.push(`critMin=${rule.scopeAssetCriticalityMin}`);
        return `- ${rule.name} | threshold=${rule.thresholdScore} | scope=[${scopes.join(', ')}]${detail === 'detailed' && rule.description ? ` | desc="${truncateText(rule.description, 120)}"` : ''}`;
      });
      sections.push(`APPETITE RULES (${formatShownCount(shownRules.length, rules.length)}, global threshold=${workspace.riskModel.appetiteThresholdScore}):\n${ruleLines.join('\n')}`);
    }
  }

  if (options.includeFindings) {
    const allFindings = workspace.findings || [];
    const findings = useLinkedContext
      ? allFindings.filter(f =>
          f.relatedNodeIds.some(nid => linked!.linkedAssets.some(a => a.diagramRefs.some(r => r.nodeId === nid))) ||
          f.linkedRiskIds.some(rid => linkedRiskIds.has(rid)) ||
          f.linkedAssetIds.some(aid => assets.some(a => a.id === aid))
        )
      : allFindings;
    if (findings.length > 0) {
      const shown = findings.slice(0, maxItems);
      const lines = shown.map(finding => {
        const base = `- ${finding.title} [${finding.type}] severity=${finding.severity} status=${finding.status} source=${finding.source}`;
        if (detail === 'detailed') {
          return `${base} | linkedRisks=${finding.linkedRiskIds.length} | linkedAssets=${finding.linkedAssetIds.length}` +
            `${finding.strideCategories?.length ? ` | stride=${finding.strideCategories.join(',')}` : ''}` +
            `${finding.description ? ` | desc="${truncateText(finding.description, 180)}"` : ''}`;
        }
        return `${base} | risks=${finding.linkedRiskIds.length}`;
      });
      sections.push(`FINDINGS (${formatShownCount(shown.length, findings.length)}):\n${lines.join('\n')}`);
    }
  }

  if (options.includeRiskAcceptances) {
    const allRa = workspace.riskAcceptances || [];
    if (allRa.length > 0) {
      const shown = allRa.slice(0, maxItems);
      const lines = shown.map(ra =>
        `- ${ra.title} | risk=${ra.riskId} | status=${ra.status} | scope=${ra.scopeType} | expires=${ra.expirationDate || 'N/A'}`
      );
      sections.push(`RISK ACCEPTANCES (${formatShownCount(shown.length, allRa.length)}):\n${lines.join('\n')}`);
    }
  }

  if (options.includeFrameworkMappings) {
    const allFm = workspace.frameworkMappings || [];
    if (allFm.length > 0) {
      const shown = allFm.slice(0, maxItems);
      const lines = shown.map(fm => {
        const srcSet = workspace.controlSets.find(cs => cs.id === fm.sourceControlSetId)?.name || fm.sourceControlSetId;
        const tgtSet = workspace.controlSets.find(cs => cs.id === fm.targetControlSetId)?.name || fm.targetControlSetId;
        return `- ${srcSet}::${fm.sourceControlId} -> ${tgtSet}::${fm.targetControlId} [${fm.relationship}]`;
      });
      sections.push(`FRAMEWORK MAPPINGS (${formatShownCount(shown.length, allFm.length)}):\n${lines.join('\n')}`);
    }
  }

  if (options.includeIncidents) {
    const allInc = workspace.incidents || [];
    if (allInc.length > 0) {
      const shown = allInc.slice(0, maxItems);
      const lines = shown.map(inc => {
        const base = `- ${inc.title} [${inc.severity}] status=${inc.status} detected=${inc.detectedDate || 'N/A'}`;
        if (detail === 'detailed') {
          return `${base} | owner=${inc.owner || 'Unassigned'} | risks=${inc.linkedRiskIds.length} | assets=${inc.linkedAssetIds.length}` +
            `${inc.description ? ` | desc="${truncateText(inc.description, 180)}"` : ''}`;
        }
        return `${base} | risks=${inc.linkedRiskIds.length}`;
      });
      sections.push(`INCIDENTS (${formatShownCount(shown.length, allInc.length)}):\n${lines.join('\n')}`);
    }
  }

  if (diagramAttackPaths.length > 0) {
    const shown = diagramAttackPaths.slice(0, maxItems);
    const lines = shown.map(ap => {
      const base = `- ${ap.name} [${ap.strideCategory}] risk=${ap.riskLevel} steps=${ap.steps.length}`;
      if (detail === 'detailed') {
        return `${base}${ap.mitreTechniques?.length ? ` | mitre=${ap.mitreTechniques.join(',')}` : ''}` +
          ` | desc="${truncateText(ap.description, 180)}"`;
      }
      return base;
    });
    sections.push(`DIAGRAM ATTACK PATHS (${formatShownCount(shown.length, diagramAttackPaths.length)}):\n${lines.join('\n')}`);
  }

  return sections.join('\n\n');
};

export const computeGrcDashboardMetrics = (workspace: GrcWorkspace): GrcDashboardMetrics => {
  const elevatedRiskLabels = getElevatedRiskLabels(workspace);
  const elevatedAssetCriticality = getElevatedAssetCriticalityValues(workspace);
  const riskByRating: Record<string, number> = {};
  const domainDisplayLabels: Record<GrcAssetDomain, string> = {
    it: 'IT', ot: 'OT', cloud: 'Cloud', iot: 'IoT',
    application: 'Application', data: 'Data', network: 'Network',
    physical: 'Physical', people: 'People'
  };
  const assetsByDomain: Record<string, number> = {};
  workspace.risks.forEach(risk => {
    const key = risk.inherentScore.ratingLabel || 'Unrated';
    riskByRating[key] = (riskByRating[key] || 0) + 1;
  });
  workspace.assets.forEach(asset => {
    const label = domainDisplayLabels[asset.domain] || asset.domain;
    assetsByDomain[label] = (assetsByDomain[label] || 0) + 1;
  });

  let implementedControlCount = 0;
  let notImplementedControlCount = 0;
  let applicableControlCount = 0;

  workspace.soaEntries.forEach(entry => {
    if (entry.applicability === 'applicable' || entry.applicability === 'partially_applicable') {
      applicableControlCount += 1;
    }

    if (entry.implementationStatus === 'implemented') {
      implementedControlCount += 1;
    } else if (entry.implementationStatus === 'not_implemented') {
      notImplementedControlCount += 1;
    }
  });

  const highAndCriticalRiskCount = workspace.risks.filter(risk =>
    elevatedRiskLabels.has((risk.inherentScore.ratingLabel || '').toLowerCase())
  ).length;
  const highBusinessCriticalAssetCount = workspace.assets.filter(asset =>
    elevatedAssetCriticality.has(asset.businessCriticality)
  ).length;
  const highSecurityCriticalAssetCount = workspace.assets.filter(asset =>
    elevatedAssetCriticality.has(asset.securityCriticality)
  ).length;
  const assessmentsWithPlansCount = workspace.assessments.filter(assessment =>
    Boolean(
      (assessment.riskManagementPlan.objective && assessment.riskManagementPlan.objective.trim())
      || (assessment.riskManagementPlan.strategy && assessment.riskManagementPlan.strategy.trim())
      || assessment.riskManagementPlan.actions.length > 0
    )
  ).length;
  const openPlanActionCount = workspace.assessments.reduce((count, assessment) =>
    count + assessment.riskManagementPlan.actions.filter(action => action.status !== 'done').length
  , 0);
  const openTasks = workspace.workflowTasks.filter(task => task.status !== 'done');
  const now = Date.now();
  const within7Days = now + 7 * 24 * 60 * 60 * 1000;

  const overdueTaskCount = openTasks.filter(task => {
    if (!task.dueDate) return false;
    const dueAt = new Date(task.dueDate).getTime();
    return Number.isFinite(dueAt) && dueAt < now;
  }).length;

  const dueSoonTaskCount = openTasks.filter(task => {
    if (!task.dueDate) return false;
    const dueAt = new Date(task.dueDate).getTime();
    return Number.isFinite(dueAt) && dueAt >= now && dueAt <= within7Days;
  }).length;

  return {
    assetCount: workspace.assets.length,
    highBusinessCriticalAssetCount,
    highSecurityCriticalAssetCount,
    assetsByDomain,
    riskCount: workspace.risks.length,
    highAndCriticalRiskCount,
    openAssessmentCount: workspace.assessments.filter(assessment => assessment.status !== 'completed').length,
    assessmentsWithPlansCount,
    openPlanActionCount,
    controlSetCount: workspace.controlSets.length,
    soaEntryCount: workspace.soaEntries.length,
    implementedControlCount,
    notImplementedControlCount,
    applicableControlCount,
    openTaskCount: openTasks.length,
    overdueTaskCount,
    dueSoonTaskCount,
    riskByRating,
    governanceDocumentCount: (workspace.governanceDocuments || []).length,
    activeGovernanceDocumentCount: (workspace.governanceDocuments || []).filter(doc => doc.status === 'active').length,
    threatActorCount: (workspace.threatActors || []).length,
    threatScenarioCount: (workspace.threatScenarios || []).length,
    appetiteBreachCount: workspace.risks.filter(risk => {
      const threshold = resolveRiskAppetite(risk, workspace);
      return risk.inherentScore.rawScore >= threshold;
    }).length,
    findingCount: (workspace.findings || []).length,
    openFindingCount: (workspace.findings || []).filter(f => f.status === 'open' || f.status === 'in_review').length,
    criticalHighFindingCount: (workspace.findings || []).filter(f => f.severity === 'critical' || f.severity === 'high').length,
    thirdPartyCount: (workspace.thirdParties || []).length,
    highRiskThirdPartyCount: (workspace.thirdParties || []).filter(tp =>
      tp.riskRating === 'critical' || tp.riskRating === 'high'
    ).length,
    initiativeCount: (workspace.securityInitiatives || []).length,
    activeInitiativeCount: (workspace.securityInitiatives || []).filter(si =>
      si.status === 'in_progress' || si.status === 'approved'
    ).length,
    overdueInitiativeCount: (workspace.securityInitiatives || []).filter(si => {
      if (si.status === 'completed' || si.status === 'cancelled' || !si.targetDate) return false;
      const targetAt = new Date(si.targetDate).getTime();
      return Number.isFinite(targetAt) && targetAt < now;
    }).length,
    implementedControlRegistryCount: (workspace.implementedControls || []).length,
    activeImplementedControlRegistryCount: (workspace.implementedControls || []).filter(ic => ic.status === 'active').length,
    controlsOverdueForReviewCount: (workspace.implementedControls || []).filter(ic => {
      if (ic.status !== 'active' || !ic.nextReviewDate) return false;
      const reviewAt = new Date(ic.nextReviewDate).getTime();
      return Number.isFinite(reviewAt) && reviewAt < now;
    }).length,
    expiredAcceptanceCount: (workspace.riskAcceptances || []).filter(ra => ra.status === 'expired').length,
    pendingAcceptanceCount: (workspace.riskAcceptances || []).filter(ra => ra.status === 'pending_review').length,
    failedAuditCount: (workspace.implementedControls || []).reduce((count, ic) =>
      count + (ic.auditHistory || []).filter(a => a.result === 'fail').length
    , 0),
    incidentCount: (workspace.incidents || []).length,
    openIncidentCount: (workspace.incidents || []).filter(inc =>
      inc.status !== 'resolved' && inc.status !== 'closed'
    ).length
  };
};

export const computeWorkflowHealth = (workspace: GrcWorkspace): GrcWorkflowHealth => {
  const elevatedRiskLabels = getElevatedRiskLabels(workspace);
  const highRiskIds = new Set(
    workspace.risks
      .filter(risk => elevatedRiskLabels.has((risk.inherentScore.ratingLabel || '').toLowerCase()))
      .map(risk => risk.id)
  );

  const mitigatedRiskIds = new Set(
    workspace.soaEntries
      .filter(entry => entry.applicability !== 'not_applicable')
      .flatMap(entry => entry.mitigatesRiskIds)
  );

  const orphanRiskCount = workspace.risks.filter(
    risk =>
      risk.assetIds.length === 0 &&
      !risk.diagramLinks.some(link => Array.isArray(link.nodeIds) && link.nodeIds.length > 0)
  ).length;

  const unmitigatedHighRiskCount = Array.from(highRiskIds).filter(riskId => !mitigatedRiskIds.has(riskId)).length;

  const controlsWithoutRiskLinksCount = workspace.soaEntries.filter(
    entry => entry.applicability !== 'not_applicable' && entry.mitigatesRiskIds.length === 0
  ).length;

  const implementedControlsWithoutEvidenceCount = workspace.soaEntries.filter(
    entry => entry.implementationStatus === 'implemented' && entry.evidence.length === 0
  ).length;

  const now = Date.now();
  const within7Days = now + 7 * 24 * 60 * 60 * 1000;
  const openTasks = workspace.workflowTasks.filter(task => task.status !== 'done');
  const overdueTaskCount = openTasks.filter(task => {
    if (!task.dueDate) return false;
    const dueAt = new Date(task.dueDate).getTime();
    return Number.isFinite(dueAt) && dueAt < now;
  }).length;
  const dueSoonTaskCount = openTasks.filter(task => {
    if (!task.dueDate) return false;
    const dueAt = new Date(task.dueDate).getTime();
    return Number.isFinite(dueAt) && dueAt >= now && dueAt <= within7Days;
  }).length;

  const assessedRiskIds = new Set(
    workspace.assessments
      .filter(assessment => assessment.status !== 'archived')
      .flatMap(assessment => assessment.riskIds)
  );
  const assessmentCoveragePercent = workspace.risks.length
    ? Math.round((workspace.risks.filter(risk => assessedRiskIds.has(risk.id)).length / workspace.risks.length) * 100)
    : 100;

  const appetiteBreachCount = workspace.risks.filter(risk => {
    const threshold = resolveRiskAppetite(risk, workspace);
    return risk.inherentScore.rawScore >= threshold;
  }).length;

  const governanceOverdueReviewCount = (workspace.governanceDocuments || []).filter(doc => {
    if (doc.status !== 'active' || !doc.nextReviewDate) return false;
    const reviewAt = new Date(doc.nextReviewDate).getTime();
    return Number.isFinite(reviewAt) && reviewAt < now;
  }).length;

  const recommendedActions: string[] = [];
  if (unmitigatedHighRiskCount > 0) {
    recommendedActions.push(`Create treatment tasks for ${unmitigatedHighRiskCount} highest-severity risks without linked SoA mitigations.`);
  }
  if (appetiteBreachCount > 0) {
    recommendedActions.push(`${appetiteBreachCount} risk(s) exceed their resolved appetite threshold. Escalate or define treatment plans.`);
  }
  if (implementedControlsWithoutEvidenceCount > 0) {
    recommendedActions.push(`Collect evidence for ${implementedControlsWithoutEvidenceCount} implemented controls to support audits.`);
  }
  if (overdueTaskCount > 0) {
    recommendedActions.push(`Review and replan ${overdueTaskCount} overdue workflow tasks.`);
  }
  if (governanceOverdueReviewCount > 0) {
    recommendedActions.push(`${governanceOverdueReviewCount} governance document(s) are past their next review date.`);
  }

  const nowDateStr = new Date().toISOString().slice(0, 10);
  const thirdPartyOverdueReviewCount = (workspace.thirdParties || []).filter(tp =>
    tp.status === 'active' && tp.nextReviewDate && tp.nextReviewDate < nowDateStr
  ).length;
  if (thirdPartyOverdueReviewCount > 0) {
    recommendedActions.push(`${thirdPartyOverdueReviewCount} third-party vendor(s) are past their next review date.`);
  }

  const stalledInitiativeCount = (workspace.securityInitiatives || []).filter(si =>
    si.status === 'on_hold'
  ).length;
  if (stalledInitiativeCount > 0) {
    recommendedActions.push(`${stalledInitiativeCount} security initiative(s) are on hold. Review and resume or cancel.`);
  }

  const overdueInitiativeMilestoneCount = (workspace.securityInitiatives || []).reduce((count, si) => {
    if (si.status === 'completed' || si.status === 'cancelled') return count;
    return count + si.milestones.filter(ms => {
      if (ms.status === 'completed' || ms.status === 'skipped' || !ms.dueDate) return false;
      const dueAt = new Date(ms.dueDate).getTime();
      return Number.isFinite(dueAt) && dueAt < now;
    }).length;
  }, 0);
  if (overdueInitiativeMilestoneCount > 0) {
    recommendedActions.push(`${overdueInitiativeMilestoneCount} initiative milestone(s) are overdue. Update status or adjust timelines.`);
  }

  const implementedControlsOverdueReviewCount = (workspace.implementedControls || []).filter(ic => {
    if (ic.status !== 'active' || !ic.nextReviewDate) return false;
    const reviewAt = new Date(ic.nextReviewDate).getTime();
    return Number.isFinite(reviewAt) && reviewAt < now;
  }).length;
  if (implementedControlsOverdueReviewCount > 0) {
    recommendedActions.push(`${implementedControlsOverdueReviewCount} implemented control(s) are past their next review date.`);
  }

  const expiredAcceptanceCount = (workspace.riskAcceptances || []).filter(ra => ra.status === 'expired').length;
  if (expiredAcceptanceCount > 0) {
    recommendedActions.push(`${expiredAcceptanceCount} risk acceptance(s) have expired. Review and renew or close.`);
  }
  const pendingReviewAcceptanceCount = (workspace.riskAcceptances || []).filter(ra => ra.status === 'pending_review').length;
  if (pendingReviewAcceptanceCount > 0) {
    recommendedActions.push(`${pendingReviewAcceptanceCount} risk acceptance(s) are pending review.`);
  }
  const pendingAuditCount = (workspace.implementedControls || []).reduce((count, ic) =>
    count + (ic.auditHistory || []).filter(a => a.result === 'pending').length
  , 0);
  if (pendingAuditCount > 0) {
    recommendedActions.push(`${pendingAuditCount} control audit(s) are pending completion.`);
  }
  const staleOpenIncidentCount = (workspace.incidents || []).filter(inc => {
    if (inc.status === 'resolved' || inc.status === 'closed') return false;
    const detectedAt = new Date(inc.detectedDate).getTime();
    return Number.isFinite(detectedAt) && detectedAt < now - 30 * 24 * 60 * 60 * 1000;
  }).length;
  if (staleOpenIncidentCount > 0) {
    recommendedActions.push(`${staleOpenIncidentCount} incident(s) have been open for more than 30 days.`);
  }

  if (assessmentCoveragePercent < 100) {
    recommendedActions.push(`Assess uncovered risks. Current assessment coverage is ${assessmentCoveragePercent}%.`);
  }
  if (recommendedActions.length === 0) {
    recommendedActions.push('Workflow health is strong. Continue with recurring control reviews and evidence refresh.');
  }

  return {
    orphanRiskCount,
    unmitigatedHighRiskCount,
    controlsWithoutRiskLinksCount,
    implementedControlsWithoutEvidenceCount,
    overdueTaskCount,
    dueSoonTaskCount,
    assessmentCoveragePercent,
    appetiteBreachCount,
    governanceOverdueReviewCount,
    thirdPartyOverdueReviewCount,
    stalledInitiativeCount,
    overdueInitiativeMilestoneCount,
    implementedControlsOverdueReviewCount,
    expiredAcceptanceCount,
    pendingReviewAcceptanceCount,
    pendingAuditCount,
    staleOpenIncidentCount,
    recommendedActions
  };
};

const csvEscape = (value: string | number | undefined): string => {
  if (value === undefined) {
    return '';
  }

  const asText = String(value);
  if (/[",\n]/.test(asText)) {
    return `"${asText.replace(/"/g, '""')}"`;
  }
  return asText;
};

const toCsv = (headers: string[], rows: Array<Array<string | number | undefined>>): string => {
  const headerLine = headers.map(csvEscape).join(',');
  const rowLines = rows.map(row => row.map(csvEscape).join(','));
  return [headerLine, ...rowLines].join('\n');
};

export const exportAssetsCsv = (workspace: GrcWorkspace): string =>
  toCsv(
    [
      'Asset ID',
      'Name',
      'Description',
      'Domain',
      'Category',
      'Type (Legacy)',
      'Business Criticality',
      'Security Criticality',
      'Owner',
      'Business Process',
      'Business Unit',
      'Is Connection',
      'Linked Diagram Nodes'
    ],
    workspace.assets.map(asset => [
      asset.id,
      asset.name,
      asset.description,
      asset.domain,
      asset.category,
      asset.type,
      `${asset.businessCriticality} (${getAssetCriticalityLabel(workspace, asset.businessCriticality)})`,
      `${asset.securityCriticality} (${getAssetCriticalityLabel(workspace, asset.securityCriticality)})`,
      asset.owner,
      asset.businessProcess,
      asset.businessUnit,
      asset.isConnection ? 'Yes' : 'No',
      asset.diagramRefs.map(ref => `${ref.diagramId}:${ref.nodeId}`).join('; ')
    ])
  );

const resolveRiskTier4ForExport = (workspace: GrcWorkspace, risk: GrcRisk): string | undefined => {
  const explicitTier4 = risk.tierPath.tier4?.trim();
  if (explicitTier4) {
    return explicitTier4;
  }
  if (!risk.sourceFindingId) {
    return undefined;
  }
  return workspace.findings.find(finding => finding.id === risk.sourceFindingId)?.title?.trim() || undefined;
};

export const exportRisksCsv = (workspace: GrcWorkspace): string =>
  toCsv(
    [
      'Risk ID',
      'Title',
      'Status',
      'Tier 1',
      'Tier 2',
      'Tier 3',
      'Tier 4',
      'Inherent Rating',
      'Inherent Score',
      'Treatment',
      'Owner',
      'Due Date',
      'Business Unit'
    ],
    workspace.risks.map(risk => [
      risk.id,
      risk.title,
      risk.status,
      risk.tierPath.tier1,
      risk.tierPath.tier2,
      risk.tierPath.tier3,
      resolveRiskTier4ForExport(workspace, risk),
      risk.inherentScore.ratingLabel,
      risk.inherentScore.rawScore,
      risk.treatmentStrategy,
      risk.owner,
      risk.dueDate,
      risk.businessUnit
    ])
  );

export const exportSoaCsv = (workspace: GrcWorkspace): string =>
  toCsv(
    [
      'Entry ID',
      'Control Set',
      'Control ID',
      'Scope',
      'Applicability',
      'Implementation',
      'Justification',
      'Linked Risks',
      'Evidence Count',
      'Maturity Level',
      'Weight',
      'Importance'
    ],
    workspace.soaEntries.map(entry => {
      const controlSet = workspace.controlSets.find(set => set.id === entry.controlSetId);
      return [
        entry.id,
        controlSet?.name || entry.controlSetId,
        entry.controlId,
        `${entry.scopeType}:${entry.scopeId}`,
        entry.applicability,
        entry.implementationStatus,
        entry.justification,
        entry.mitigatesRiskIds.join('; '),
        entry.evidence.length,
        entry.maturityLevel ?? '',
        entry.weight ?? '',
        entry.importance ?? ''
      ];
    })
  );

export const exportTasksCsv = (workspace: GrcWorkspace): string =>
  toCsv(
    [
      'Task ID',
      'Title',
      'Type',
      'Status',
      'Priority',
      'Owner',
      'Due Date',
      'Risk ID',
      'Control',
      'Assessment ID',
      'Asset ID'
    ],
    workspace.workflowTasks.map(task => [
      task.id,
      task.title,
      task.type,
      task.status,
      task.priority,
      task.owner,
      task.dueDate,
      task.riskId,
      task.controlSetId && task.controlId ? `${task.controlSetId}:${task.controlId}` : undefined,
      task.assessmentId,
      task.assetId
    ])
  );

export const exportPlansCsv = (workspace: GrcWorkspace): string =>
  toCsv(
    [
      'Assessment ID',
      'Assessment Title',
      'Assessment Status',
      'Scope Items',
      'Tier Filter',
      'Plan Objective',
      'Plan Strategy',
      'Plan Residual Risk Statement',
      'Plan Monitoring Approach',
      'Plan Communication Plan',
      'Plan Review Cadence (Days)',
      'Action ID',
      'Action Title',
      'Action Owner',
      'Action Due Date',
      'Action Status',
      'Action Priority',
      'Action Treatment Strategy',
      'Action Linked Risk IDs',
      'Action Notes'
    ],
    workspace.assessments.flatMap(assessment => {
      const scopeSummary = assessment.scopeItems.map(scope => `${scope.type}:${scope.value}`).join('; ');
      const tierFilterSummary = [
        assessment.tierFilter.tier1 ? `tier1=${assessment.tierFilter.tier1}` : '',
        assessment.tierFilter.tier2 ? `tier2=${assessment.tierFilter.tier2}` : '',
        assessment.tierFilter.tier3 ? `tier3=${assessment.tierFilter.tier3}` : '',
        assessment.tierFilter.tier4 ? `tier4=${assessment.tierFilter.tier4}` : ''
      ].filter(Boolean).join('; ');

      if (assessment.riskManagementPlan.actions.length === 0) {
        return [[
          assessment.id,
          assessment.title,
          assessment.status,
          scopeSummary,
          tierFilterSummary,
          assessment.riskManagementPlan.objective,
          assessment.riskManagementPlan.strategy,
          assessment.riskManagementPlan.residualRiskStatement,
          assessment.riskManagementPlan.monitoringApproach,
          assessment.riskManagementPlan.communicationPlan,
          assessment.riskManagementPlan.reviewCadenceDays,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined
        ]];
      }

      return assessment.riskManagementPlan.actions.map(action => [
        assessment.id,
        assessment.title,
        assessment.status,
        scopeSummary,
        tierFilterSummary,
        assessment.riskManagementPlan.objective,
        assessment.riskManagementPlan.strategy,
        assessment.riskManagementPlan.residualRiskStatement,
        assessment.riskManagementPlan.monitoringApproach,
        assessment.riskManagementPlan.communicationPlan,
        assessment.riskManagementPlan.reviewCadenceDays,
        action.id,
        action.title,
        action.owner,
        action.dueDate,
        action.status,
        action.priority,
        action.treatmentStrategy,
        action.linkedRiskIds.join('; '),
        action.notes
      ]);
    })
  );

export const exportThreatProfilesCsv = (workspace: GrcWorkspace): string => {
  const actors = workspace.threatActors || [];
  const scenarios = workspace.threatScenarios || [];
  const actorRows = actors.map(actor => [
    'Actor',
    actor.id,
    actor.name,
    actor.type,
    actor.capabilityLevel,
    actor.resourceLevel,
    actor.motivation,
    actor.targetedAssetIds.join('; '),
    (actor.targetedAssetDomains || []).join('; '),
    actor.tags.join('; '),
    undefined,
    undefined,
    undefined,
    undefined
  ]);
  const scenarioRows = scenarios.map(scenario => [
    'Scenario',
    scenario.id,
    scenario.title,
    actors.find(a => a.id === scenario.threatActorId)?.name || scenario.threatActorId,
    undefined,
    undefined,
    scenario.description,
    scenario.targetedAssetIds.join('; '),
    undefined,
    scenario.attackTechniques.join('; '),
    scenario.linkedRiskIds.join('; '),
    (scenario.linkedAssessmentIds || []).join('; '),
    scenario.likelihood,
    scenario.impact
  ]);
  return toCsv(
    ['Record Type', 'ID', 'Name/Title', 'Type/Actor', 'Capability', 'Resources', 'Motivation/Description', 'Targeted Assets', 'Targeted Domains', 'Tags/Techniques', 'Linked Risks', 'Linked Assessments', 'Likelihood', 'Impact'],
    [...actorRows, ...scenarioRows]
  );
};

export const exportAppetiteRulesCsv = (workspace: GrcWorkspace): string =>
  toCsv(
    ['Rule ID', 'Name', 'Description', 'Scope Domain', 'Scope Tier 1', 'Scope Min Criticality', 'Threshold Score'],
    (workspace.appetiteRules || []).map(rule => [
      rule.id,
      rule.name,
      rule.description,
      rule.scopeAssetDomain,
      rule.scopeTier1,
      rule.scopeAssetCriticalityMin,
      rule.thresholdScore
    ])
  );

export const exportGovernanceDocsCsv = (workspace: GrcWorkspace): string =>
  toCsv(
    ['ID', 'Title', 'Type', 'Status', 'Owner', 'Version', 'Next Review Date', 'URL', 'Reviewed By', 'Approved By', 'Approval Date', 'Description', 'Tags', 'Linked Risk IDs', 'Linked Control Set IDs'],
    (workspace.governanceDocuments || []).map(doc => [
      doc.id,
      doc.title,
      doc.type,
      doc.status,
      doc.owner,
      doc.version,
      doc.nextReviewDate,
      doc.url,
      doc.reviewedBy,
      doc.approvedBy,
      doc.approvalDate,
      doc.description,
      (doc.tags || []).join('; '),
      doc.linkedRiskIds.join('; '),
      doc.linkedControlSetIds.join('; ')
    ])
  );

export const exportFindingsCsv = (workspace: GrcWorkspace): string =>
  toCsv(
    [
      'Finding ID', 'Title', 'Type', 'Severity', 'Source', 'Status', 'Category',
      'Rule ID', 'STRIDE', 'Related Nodes', 'Related Edges', 'Linked Risks',
      'Linked Assets', 'Owner', 'Remediation Status', 'CVSS Score', 'Description'
    ],
    (workspace.findings || []).map(f => [
      f.id,
      f.title,
      f.type,
      f.severity,
      f.source,
      f.status,
      f.category,
      f.ruleId,
      (f.strideCategories || []).join('; '),
      f.relatedNodeIds.join('; '),
      f.relatedEdgeIds.join('; '),
      f.linkedRiskIds.join('; '),
      f.linkedAssetIds.join('; '),
      f.owner,
      f.remediationStatus ?? '',
      f.cvssScore ?? '',
      f.description
    ])
  );

export const exportThirdPartiesCsv = (workspace: GrcWorkspace): string =>
  toCsv(
    ['ID', 'Name', 'Category', 'Status', 'Risk Rating', 'Data Classification',
      'Contact Name', 'Contact Email', 'Contract Expiry', 'Last Assessment', 'Next Review',
      'Linked Assets', 'Linked Risks', 'Description', 'Notes'],
    (workspace.thirdParties || []).map(tp => [
      tp.id, tp.name, tp.category, tp.status, tp.riskRating, tp.dataClassification,
      tp.contactName, tp.contactEmail, tp.contractExpiry, tp.lastAssessmentDate,
      tp.nextReviewDate, tp.linkedAssetIds.length, tp.linkedRiskIds.length,
      tp.description, tp.notes
    ])
  );

export const exportInitiativesCsv = (workspace: GrcWorkspace): string =>
  toCsv(
    ['ID', 'Title', 'Category', 'Status', 'Priority', 'Owner', 'Executive Sponsor',
      'Start Date', 'Target Date', 'Completed Date', 'Milestones Total', 'Milestones Completed',
      'Linked Risks', 'Linked Control Sets', 'Linked Assets', 'Linked Assessments', 'Current State', 'Target State', 'Notes'],
    (workspace.securityInitiatives || []).map(si => {
      const completedMs = si.milestones.filter(m => m.status === 'completed').length;
      return [
        si.id, si.title, si.category, si.status, si.priority, si.owner, si.executiveSponsor,
        si.startDate, si.targetDate, si.completedDate, si.milestones.length, completedMs,
        si.linkedRiskIds.length, si.linkedControlSetIds.length, si.linkedAssetIds.length, si.linkedAssessmentIds.length,
        si.currentState, si.targetState, si.notes
      ];
    })
  );

export const exportImplementedControlsCsv = (workspace: GrcWorkspace): string =>
  toCsv(
    ['ID', 'Title', 'Control Type', 'Category', 'Status', 'Automation Level',
      'Owner', 'Vendor', 'Product', 'Version', 'Implemented Date', 'Last Review Date',
      'Next Review Date', 'Linked SoA Entries', 'Linked Risks', 'Linked Assets', 'Linked Assessments',
      'Description', 'Notes'],
    (workspace.implementedControls || []).map(ic => [
      ic.id, ic.title, ic.controlType, ic.category, ic.status, ic.automationLevel,
      ic.owner, ic.vendor, ic.product, ic.version, ic.implementedDate, ic.lastReviewDate,
      ic.nextReviewDate, ic.linkedSoaEntryIds.length, ic.linkedRiskIds.length,
      ic.linkedAssetIds.length, ic.linkedAssessmentIds.length, ic.description, ic.notes
    ])
  );

export const exportRiskAcceptancesCsv = (workspace: GrcWorkspace): string =>
  toCsv(
    ['ID', 'Risk ID', 'Title', 'Scope Type', 'Status', 'Requested By', 'Approved By',
      'Effective Date', 'Expiration Date', 'Review Date', 'Justification', 'Conditions', 'Email Link', 'Notes'],
    (workspace.riskAcceptances || []).map(ra => [
      ra.id, ra.riskId, ra.title, ra.scopeType, ra.status, ra.requestedBy, ra.approvedBy,
      ra.effectiveDate, ra.expirationDate, ra.reviewDate, ra.justification, ra.conditions,
      ra.emailLink, ra.notes
    ])
  );

export const exportFrameworkMappingsCsv = (workspace: GrcWorkspace): string =>
  toCsv(
    ['ID', 'Source Control Set', 'Source Control ID', 'Target Control Set', 'Target Control ID',
      'Relationship', 'Notes'],
    (workspace.frameworkMappings || []).map(fm => {
      const srcSet = workspace.controlSets.find(cs => cs.id === fm.sourceControlSetId);
      const tgtSet = workspace.controlSets.find(cs => cs.id === fm.targetControlSetId);
      return [
        fm.id, srcSet?.name || fm.sourceControlSetId, fm.sourceControlId,
        tgtSet?.name || fm.targetControlSetId, fm.targetControlId,
        fm.relationship, fm.notes
      ];
    })
  );

export const exportIncidentsCsv = (workspace: GrcWorkspace): string =>
  toCsv(
    ['ID', 'Title', 'Severity', 'Status', 'Detected Date', 'Resolved Date', 'Closed Date',
      'Owner', 'Linked Risks', 'Linked Assets', 'Linked Findings', 'Timeline Entries',
      'Lessons Learned', 'Description', 'Notes'],
    (workspace.incidents || []).map(inc => [
      inc.id, inc.title, inc.severity, inc.status, inc.detectedDate, inc.resolvedDate,
      inc.closedDate, inc.owner, inc.linkedRiskIds.length, inc.linkedAssetIds.length,
      inc.linkedFindingIds.length, inc.timelineEntries.length, inc.lessonsLearned,
      inc.description, inc.notes
    ])
  );

export const computeSoaCoverageMap = (workspace: GrcWorkspace): Map<string, string[]> => {
  const map = new Map<string, string[]>();
  (workspace.implementedControls || []).forEach(ic => {
    (ic.linkedSoaEntryIds || []).forEach(soaId => {
      const existing = map.get(soaId) || [];
      existing.push(ic.id);
      map.set(soaId, existing);
    });
  });
  return map;
};

export const computeRiskHealth = (risk: GrcRisk, workspace: GrcWorkspace): GrcEntityHealth => {
  const reasons: string[] = [];
  let level: GrcEntityHealthLevel = 'green';

  const threshold = resolveRiskAppetite(risk, workspace);
  const breachesAppetite = risk.inherentScore.rawScore >= threshold;
  const hasTreatmentPlan = Boolean(risk.treatmentPlan?.trim());
  const hasSoaCoverage = workspace.soaEntries.some(e =>
    e.applicability !== 'not_applicable' && e.mitigatesRiskIds.includes(risk.id)
  );
  const elevatedLabels = getElevatedRiskLabels(workspace);
  const isHighSeverity = elevatedLabels.has((risk.inherentScore.ratingLabel || '').toLowerCase());

  if (breachesAppetite && !hasTreatmentPlan) {
    level = 'red';
    reasons.push('Appetite breach with no treatment plan');
  }
  if (isHighSeverity && !hasSoaCoverage) {
    level = 'red';
    reasons.push('High severity risk without SoA coverage');
  }
  if (level !== 'red') {
    if (breachesAppetite && hasTreatmentPlan) {
      level = 'yellow';
      reasons.push('Appetite breach with treatment plan in place');
    }
    if (risk.dueDate) {
      const dueAt = new Date(risk.dueDate).getTime();
      if (Number.isFinite(dueAt) && dueAt < Date.now()) {
        level = 'yellow';
        reasons.push('Overdue review date');
      }
    }
  }
  if (reasons.length === 0) reasons.push('Healthy');
  return { level, reasons };
};

export const computeSoaHealth = (entry: GrcSoaEntry, workspace: GrcWorkspace): GrcEntityHealth => {
  const reasons: string[] = [];
  let level: GrcEntityHealthLevel = 'green';

  if (entry.implementationStatus === 'implemented' && entry.evidence.length === 0) {
    level = 'red';
    reasons.push('Implemented but has zero evidence');
  }
  const linkedControls = (workspace.implementedControls || []).filter(ic =>
    ic.linkedSoaEntryIds.includes(entry.id)
  );
  if (linkedControls.some(ic => ic.status === 'deprecated')) {
    level = 'red';
    reasons.push('Linked control is deprecated');
  }
  if (level !== 'red' && entry.implementationStatus === 'in_progress') {
    level = 'yellow';
    reasons.push('Implementation in progress');
  }
  if (reasons.length === 0) reasons.push('Healthy');
  return { level, reasons };
};

export const computeAssessmentHealth = (assessment: GrcAssessment, workspace: GrcWorkspace): GrcEntityHealth => {
  const reasons: string[] = [];
  let level: GrcEntityHealthLevel = 'green';

  if (assessment.riskIds.length > 0) {
    const treatedCount = assessment.riskIds.filter(rid => {
      const risk = workspace.risks.find(r => r.id === rid);
      return risk && risk.treatmentStrategy !== 'accept' && Boolean(risk.treatmentPlan?.trim());
    }).length;
    const coverage = treatedCount / assessment.riskIds.length;
    if (coverage < 0.5) {
      level = 'red';
      reasons.push(`Only ${Math.round(coverage * 100)}% of risks have treatment coverage`);
    } else if (coverage < 0.8) {
      level = 'yellow';
      reasons.push(`${Math.round(coverage * 100)}% risk treatment coverage`);
    }
  }
  if (reasons.length === 0) reasons.push('Healthy');
  return { level, reasons };
};

const escapeHtml = (text: string): string =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const reportCss = `
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1e293b;margin:0;padding:24px 32px;line-height:1.6;font-size:14px}
h1{font-size:22px;margin:0 0 4px}h2{font-size:17px;margin:28px 0 10px;padding-bottom:4px;border-bottom:2px solid #e2e8f0}h3{font-size:15px;margin:18px 0 6px}
table{border-collapse:collapse;width:100%;margin:10px 0 18px}th,td{border:1px solid #cbd5e1;padding:6px 10px;text-align:left;font-size:13px}th{background:#f1f5f9;font-weight:600}
tr:nth-child(even){background:#f8fafc}.badge{display:inline-block;padding:2px 8px;border-radius:4px;font-size:12px;font-weight:600;color:#fff}
.badge-critical{background:#dc2626}.badge-high{background:#ea580c}.badge-medium{background:#d97706}.badge-low{background:#16a34a}.badge-info{background:#6366f1}
.metric-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:12px;margin:12px 0}
.metric-card{background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px;text-align:center}
.metric-value{font-size:28px;font-weight:700;color:#0f172a}.metric-label{font-size:12px;color:#64748b;margin-top:2px}
.footer{margin-top:32px;padding-top:12px;border-top:1px solid #e2e8f0;font-size:11px;color:#94a3b8}
ul{margin:4px 0 12px;padding-left:20px}li{margin:2px 0}
@media print{body{padding:12px 16px}h2{break-after:avoid}table{break-inside:auto;font-size:11px}tr{break-inside:avoid}}
`;

const wrapHtmlReport = (title: string, generatedAt: string, bodyContent: string): string =>
  `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">` +
  `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'">` +
  `<title>${escapeHtml(title)}</title><style>${reportCss}</style></head><body>` +
  `<h1>${escapeHtml(title)}</h1><p style="color:#64748b;margin:0 0 18px">Generated ${escapeHtml(generatedAt)}</p>` +
  bodyContent +
  `<div class="footer">Generated by ContextCypher GRC Module</div></body></html>`;

type ReportCell = string | { severity: string };
const severityBadge = (severity: string): ReportCell => ({ severity });

const renderReportCell = (cell: ReportCell): string => {
  if (typeof cell === 'string') return escapeHtml(cell);
  const severity = cell.severity;
  const cls = (['critical', 'high', 'medium', 'low', 'info'].includes(severity.toLowerCase()))
    ? `badge-${severity.toLowerCase()}` : 'badge-info';
  return `<span class="badge ${cls}">${escapeHtml(severity)}</span>`;
};

const toDisplayDate = (dateStr?: string): string => {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return Number.isFinite(d.getTime()) ? d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : dateStr;
};

const metricCard = (value: string | number, label: string): string =>
  `<div class="metric-card"><div class="metric-value">${escapeHtml(String(value))}</div><div class="metric-label">${escapeHtml(label)}</div></div>`;

const htmlTable = (headers: string[], rows: ReportCell[][]): string => {
  if (rows.length === 0) return '<p><em>No data available.</em></p>';
  const ths = headers.map(h => `<th>${escapeHtml(h)}</th>`).join('');
  const trs = rows.map(row => '<tr>' + row.map(cell => `<td>${renderReportCell(cell)}</td>`).join('') + '</tr>').join('\n');
  return `<table><thead><tr>${ths}</tr></thead><tbody>${trs}</tbody></table>`;
};

const shouldInclude = (sectionId: string, config?: GrcReportSectionConfig, defaults?: string[]): boolean => {
  const ids = config?.visibleSectionIds ?? defaults ?? [];
  return ids.includes(sectionId);
};

export const GRC_REPORT_CATALOG: GrcReportCatalogEntry[] = [
  {
    id: 'executive_summary', title: 'Executive Summary', icon: '📊',
    description: 'High-level overview of risk posture, compliance status, and recommended actions.',
    defaultSections: [
      { id: 'key_metrics', label: 'Key Metrics' },
      { id: 'risk_distribution', label: 'Risk Distribution' },
      { id: 'compliance_overview', label: 'Compliance Overview' },
      { id: 'top_risks', label: 'Top Risks' },
      { id: 'findings_summary', label: 'Findings Summary' },
      { id: 'workflow_health', label: 'Workflow Health' },
      { id: 'recommendations', label: 'Recommendations' }
    ]
  },
  {
    id: 'risk_register', title: 'Risk Register', icon: '⚠️',
    description: 'Complete risk register with ratings, ownership, and appetite breach status.',
    defaultSections: [
      { id: 'summary_stats', label: 'Summary Statistics' },
      { id: 'risk_table', label: 'Risk Table' },
      { id: 'risks_by_rating', label: 'Risks by Rating' },
      { id: 'appetite_breaches', label: 'Appetite Breaches' },
      { id: 'unlinked_risks', label: 'Unlinked Risks' }
    ]
  },
  {
    id: 'compliance_status', title: 'Compliance Status', icon: '✅',
    description: 'Framework implementation progress, gaps, maturity distribution, and evidence coverage.',
    defaultSections: [
      { id: 'framework_summary', label: 'Framework Summary' },
      { id: 'implementation_status', label: 'Implementation Status' },
      { id: 'gaps', label: 'Implementation Gaps' },
      { id: 'maturity_distribution', label: 'Maturity Distribution' },
      { id: 'evidence_coverage', label: 'Evidence Coverage' }
    ]
  },
  {
    id: 'assessment_summary', title: 'Assessment Summary', icon: '📋',
    description: 'Assessment overview with scope, status, plan actions, and coverage analysis.',
    defaultSections: [
      { id: 'overview_table', label: 'Overview Table' },
      { id: 'individual_details', label: 'Individual Assessment Details' },
      { id: 'plan_actions', label: 'Plan Actions' },
      { id: 'scope_coverage', label: 'Scope Coverage' }
    ]
  },
  {
    id: 'findings_report', title: 'Findings Report', icon: '🔍',
    description: 'Security findings with severity breakdown, STRIDE distribution, and open recommendations.',
    defaultSections: [
      { id: 'severity_breakdown', label: 'Severity Breakdown' },
      { id: 'findings_table', label: 'Findings Table' },
      { id: 'stride_distribution', label: 'STRIDE Distribution' },
      { id: 'source_breakdown', label: 'Source Breakdown' },
      { id: 'open_recommendations', label: 'Open Recommendations' }
    ]
  },
  {
    id: 'threat_landscape', title: 'Threat Landscape', icon: '🎯',
    description: 'Threat actor profiles, scenarios, targeted assets, and attack technique summary.',
    defaultSections: [
      { id: 'actor_profiles', label: 'Actor Profiles' },
      { id: 'scenarios', label: 'Threat Scenarios' },
      { id: 'targeted_assets', label: 'Targeted Assets' },
      { id: 'technique_summary', label: 'Technique Summary' }
    ]
  },
  {
    id: 'governance_status', title: 'Governance Status', icon: '📜',
    description: 'Governance document register with review status and coverage analysis.',
    defaultSections: [
      { id: 'document_summary', label: 'Document Summary' },
      { id: 'document_register', label: 'Document Register' },
      { id: 'overdue_reviews', label: 'Overdue Reviews' },
      { id: 'coverage_analysis', label: 'Coverage Analysis' }
    ]
  },
  {
    id: 'risk_treatment_progress', title: 'Risk Treatment Progress', icon: '🛡️',
    description: 'Treatment plan actions, overdue items, strategy breakdown, and risk coverage.',
    defaultSections: [
      { id: 'treatment_summary', label: 'Treatment Summary' },
      { id: 'actions_table', label: 'Actions Table' },
      { id: 'overdue_actions', label: 'Overdue Actions' },
      { id: 'strategy_breakdown', label: 'Strategy Breakdown' },
      { id: 'risk_coverage', label: 'Risk Coverage' }
    ]
  }
];

const buildExecutiveSummary = (ws: GrcWorkspace, sec?: GrcReportSectionConfig): string => {
  const m = computeGrcDashboardMetrics(ws);
  const wh = computeWorkflowHealth(ws);
  const defaults = GRC_REPORT_CATALOG.find(r => r.id === 'executive_summary')!.defaultSections.map(s => s.id);
  let html = '';

  if (shouldInclude('key_metrics', sec, defaults)) {
    html += '<h2>Key Metrics</h2><div class="metric-grid">';
    html += metricCard(m.assetCount, 'Assets');
    html += metricCard(m.riskCount, 'Risks');
    html += metricCard(m.highAndCriticalRiskCount, 'High/Critical Risks');
    html += metricCard(m.findingCount, 'Findings');
    html += metricCard(m.openFindingCount, 'Open Findings');
    html += metricCard(m.soaEntryCount, 'SoA Entries');
    html += metricCard(m.implementedControlCount, 'Implemented Controls');
    html += metricCard(m.openTaskCount, 'Open Tasks');
    html += metricCard(m.overdueTaskCount, 'Overdue Tasks');
    html += metricCard(m.appetiteBreachCount, 'Appetite Breaches');
    html += '</div>';
  }

  if (shouldInclude('risk_distribution', sec, defaults) && Object.keys(m.riskByRating).length > 0) {
    html += '<h2>Risk Distribution</h2>';
    html += htmlTable(['Rating', 'Count'], Object.entries(m.riskByRating).map(([rating, count]) => [rating, String(count)]));
  }

  if (shouldInclude('compliance_overview', sec, defaults)) {
    html += '<h2>Compliance Overview</h2><div class="metric-grid">';
    html += metricCard(m.controlSetCount, 'Control Frameworks');
    html += metricCard(m.applicableControlCount, 'Applicable Controls');
    html += metricCard(m.implementedControlCount, 'Implemented');
    html += metricCard(m.notImplementedControlCount, 'Not Implemented');
    html += '</div>';
  }

  if (shouldInclude('top_risks', sec, defaults) && ws.risks.length > 0) {
    html += '<h2>Top Risks</h2>';
    const sorted = [...ws.risks].sort((a, b) => b.inherentScore.rawScore - a.inherentScore.rawScore).slice(0, 10);
    html += htmlTable(['Risk', 'Rating', 'Score', 'Owner', 'Treatment'],
      sorted.map(r => [r.title, severityBadge(r.inherentScore.ratingLabel || 'Unrated'), String(r.inherentScore.rawScore), r.owner || '—', r.treatmentStrategy]));
  }

  if (shouldInclude('findings_summary', sec, defaults) && ws.findings.length > 0) {
    html += '<h2>Findings Summary</h2>';
    const bySeverity: Record<string, number> = {};
    ws.findings.forEach(f => { bySeverity[f.severity] = (bySeverity[f.severity] || 0) + 1; });
    html += htmlTable(['Severity', 'Count'], Object.entries(bySeverity).map(([sev, count]) => [severityBadge(sev), String(count)]));
  }

  if (shouldInclude('workflow_health', sec, defaults)) {
    html += '<h2>Workflow Health</h2><div class="metric-grid">';
    html += metricCard(wh.orphanRiskCount, 'Orphan Risks');
    html += metricCard(wh.unmitigatedHighRiskCount, 'Unmitigated High Risks');
    html += metricCard(`${wh.assessmentCoveragePercent}%`, 'Assessment Coverage');
    html += metricCard(wh.governanceOverdueReviewCount, 'Overdue Reviews');
    html += '</div>';
  }

  if (shouldInclude('recommendations', sec, defaults) && wh.recommendedActions.length > 0) {
    html += '<h2>Recommendations</h2><ul>';
    wh.recommendedActions.forEach(a => { html += `<li>${escapeHtml(a)}</li>`; });
    html += '</ul>';
  }

  return html;
};

const buildRiskRegister = (ws: GrcWorkspace, sec?: GrcReportSectionConfig): string => {
  const defaults = GRC_REPORT_CATALOG.find(r => r.id === 'risk_register')!.defaultSections.map(s => s.id);
  let html = '';

  if (shouldInclude('summary_stats', sec, defaults)) {
    const m = computeGrcDashboardMetrics(ws);
    html += '<h2>Summary Statistics</h2><div class="metric-grid">';
    html += metricCard(m.riskCount, 'Total Risks');
    html += metricCard(m.highAndCriticalRiskCount, 'High/Critical');
    html += metricCard(m.appetiteBreachCount, 'Appetite Breaches');
    html += metricCard(ws.risks.filter(r => r.status === 'treated').length, 'Treated');
    html += '</div>';
  }

  if (shouldInclude('risk_table', sec, defaults) && ws.risks.length > 0) {
    html += '<h2>Risk Register</h2>';
    html += htmlTable(['Title', 'Status', 'Rating', 'Score', 'Treatment', 'Owner', 'Due Date'],
      ws.risks.map(r => [
        r.title, r.status,
        severityBadge(r.inherentScore.ratingLabel || 'Unrated'),
        String(r.inherentScore.rawScore), r.treatmentStrategy,
        r.owner || '—', toDisplayDate(r.dueDate)
      ]));
  }

  if (shouldInclude('risks_by_rating', sec, defaults) && ws.risks.length > 0) {
    html += '<h2>Risks by Rating</h2>';
    const byRating: Record<string, number> = {};
    ws.risks.forEach(r => { const k = r.inherentScore.ratingLabel || 'Unrated'; byRating[k] = (byRating[k] || 0) + 1; });
    html += htmlTable(['Rating', 'Count'], Object.entries(byRating).map(([k, v]) => [severityBadge(k), String(v)]));
  }

  if (shouldInclude('appetite_breaches', sec, defaults)) {
    const breaches = ws.risks.filter(r => {
      const threshold = resolveRiskAppetite(r, ws);
      return r.inherentScore.rawScore >= threshold;
    });
    if (breaches.length > 0) {
      html += '<h2>Appetite Breaches</h2>';
      html += htmlTable(['Risk', 'Score', 'Threshold', 'Owner'],
        breaches.map(r => [r.title, String(r.inherentScore.rawScore), String(resolveRiskAppetite(r, ws)), r.owner || '—']));
    }
  }

  if (shouldInclude('unlinked_risks', sec, defaults)) {
    const unlinked = ws.risks.filter(r => r.assetIds.length === 0 && !r.diagramLinks.some(l => l.nodeIds.length > 0));
    if (unlinked.length > 0) {
      html += '<h2>Unlinked Risks</h2><p>Risks not linked to any asset or diagram node:</p>';
      html += htmlTable(['Risk', 'Status', 'Rating'], unlinked.map(r => [r.title, r.status, severityBadge(r.inherentScore.ratingLabel || 'Unrated')]));
    }
  }

  return html;
};

const buildComplianceStatus = (ws: GrcWorkspace, sec?: GrcReportSectionConfig): string => {
  const defaults = GRC_REPORT_CATALOG.find(r => r.id === 'compliance_status')!.defaultSections.map(s => s.id);
  let html = '';

  if (shouldInclude('framework_summary', sec, defaults) && ws.controlSets.length > 0) {
    html += '<h2>Framework Summary</h2>';
    html += htmlTable(['Framework', 'Controls', 'Version'],
      ws.controlSets.map(cs => [cs.name, String(cs.controls.length), cs.version || '—']));
  }

  if (shouldInclude('implementation_status', sec, defaults) && ws.soaEntries.length > 0) {
    html += '<h2>Implementation Status</h2>';
    const byStatus: Record<string, number> = {};
    ws.soaEntries.forEach(e => { byStatus[e.implementationStatus] = (byStatus[e.implementationStatus] || 0) + 1; });
    html += htmlTable(['Status', 'Count'], Object.entries(byStatus).map(([k, v]) => [k.replace(/_/g, ' '), String(v)]));
  }

  if (shouldInclude('gaps', sec, defaults)) {
    const gaps = ws.soaEntries.filter(e => e.applicability !== 'not_applicable' && e.implementationStatus === 'not_implemented');
    if (gaps.length > 0) {
      html += '<h2>Implementation Gaps</h2>';
      html += htmlTable(['Control ID', 'Framework', 'Scope', 'Justification'],
        gaps.map(e => {
          const cs = ws.controlSets.find(s => s.id === e.controlSetId);
          return [e.controlId, cs?.name || '—', `${e.scopeType}:${e.scopeId}`, e.justification || '—'];
        }));
    }
  }

  if (shouldInclude('maturity_distribution', sec, defaults)) {
    const withMaturity = ws.soaEntries.filter(e => e.maturityLevel !== undefined && e.maturityLevel !== null);
    if (withMaturity.length > 0) {
      const byLevel: Record<number, number> = {};
      withMaturity.forEach(e => { byLevel[e.maturityLevel!] = (byLevel[e.maturityLevel!] || 0) + 1; });
      html += '<h2>Maturity Distribution</h2>';
      html += htmlTable(['Level', 'Count'], Object.entries(byLevel).sort(([a], [b]) => Number(a) - Number(b)).map(([k, v]) => [k, String(v)]));
    }
  }

  if (shouldInclude('evidence_coverage', sec, defaults) && ws.soaEntries.length > 0) {
    const implemented = ws.soaEntries.filter(e => e.implementationStatus === 'implemented');
    const withEvidence = implemented.filter(e => e.evidence.length > 0);
    html += '<h2>Evidence Coverage</h2><div class="metric-grid">';
    html += metricCard(implemented.length, 'Implemented Controls');
    html += metricCard(withEvidence.length, 'With Evidence');
    html += metricCard(implemented.length - withEvidence.length, 'Missing Evidence');
    html += '</div>';
  }

  return html;
};

const buildAssessmentSummary = (ws: GrcWorkspace, sec?: GrcReportSectionConfig): string => {
  const defaults = GRC_REPORT_CATALOG.find(r => r.id === 'assessment_summary')!.defaultSections.map(s => s.id);
  let html = '';

  if (shouldInclude('overview_table', sec, defaults) && ws.assessments.length > 0) {
    html += '<h2>Assessment Overview</h2>';
    html += htmlTable(['Title', 'Status', 'Scope Items', 'Risks', 'Owner', 'Due Date'],
      ws.assessments.map(a => [
        a.title, a.status,
        String(a.scopeItems.length), String(a.riskIds.length),
        a.owner || '—', toDisplayDate(a.dueDate)
      ]));
  }

  if (shouldInclude('individual_details', sec, defaults) && ws.assessments.length > 0) {
    html += '<h2>Assessment Details</h2>';
    ws.assessments.forEach(a => {
      html += `<h3>${escapeHtml(a.title)}</h3>`;
      html += `<p><strong>Status:</strong> ${escapeHtml(a.status)} | <strong>Owner:</strong> ${escapeHtml(a.owner || '—')} | <strong>Due:</strong> ${escapeHtml(toDisplayDate(a.dueDate))}</p>`;
      if (a.summary) html += `<p>${escapeHtml(a.summary)}</p>`;
      if (a.scopeItems.length > 0) {
        html += '<p><strong>Scope:</strong> ' + a.scopeItems.map(s => escapeHtml(`${s.name} (${s.type})`)).join(', ') + '</p>';
      }
    });
  }

  if (shouldInclude('plan_actions', sec, defaults)) {
    const allActions = ws.assessments.flatMap(a =>
      a.riskManagementPlan.actions.map(act => ({ assessmentTitle: a.title, ...act }))
    );
    if (allActions.length > 0) {
      html += '<h2>Plan Actions</h2>';
      html += htmlTable(['Assessment', 'Action', 'Owner', 'Status', 'Priority', 'Due Date'],
        allActions.map(a => [
          a.assessmentTitle, a.title,
          a.owner || '—', a.status,
          a.priority || '—', toDisplayDate(a.dueDate)
        ]));
    }
  }

  if (shouldInclude('scope_coverage', sec, defaults) && ws.assessments.length > 0) {
    const scopeTypes: Record<string, number> = {};
    ws.assessments.forEach(a => a.scopeItems.forEach(s => { scopeTypes[s.type] = (scopeTypes[s.type] || 0) + 1; }));
    html += '<h2>Scope Coverage</h2>';
    html += htmlTable(['Scope Type', 'Entries'], Object.entries(scopeTypes).map(([k, v]) => [k, String(v)]));
  }

  return html;
};

const buildFindingsReport = (ws: GrcWorkspace, sec?: GrcReportSectionConfig): string => {
  const defaults = GRC_REPORT_CATALOG.find(r => r.id === 'findings_report')!.defaultSections.map(s => s.id);
  const findings = ws.findings || [];
  let html = '';

  if (shouldInclude('severity_breakdown', sec, defaults) && findings.length > 0) {
    const bySev: Record<string, number> = {};
    findings.forEach(f => { bySev[f.severity] = (bySev[f.severity] || 0) + 1; });
    html += '<h2>Severity Breakdown</h2>';
    html += htmlTable(['Severity', 'Count'], Object.entries(bySev).map(([k, v]) => [severityBadge(k), String(v)]));
  }

  if (shouldInclude('findings_table', sec, defaults) && findings.length > 0) {
    html += '<h2>Findings</h2>';
    html += htmlTable(['Title', 'Type', 'Severity', 'Status', 'Source', 'Owner'],
      findings.map(f => [
        f.title, f.type,
        severityBadge(f.severity), f.status,
        f.source.replace(/_/g, ' '), f.owner || '—'
      ]));
  }

  if (shouldInclude('stride_distribution', sec, defaults)) {
    const stride: Record<string, number> = {};
    findings.forEach(f => (f.strideCategories || []).forEach(s => { stride[s] = (stride[s] || 0) + 1; }));
    if (Object.keys(stride).length > 0) {
      html += '<h2>STRIDE Distribution</h2>';
      html += htmlTable(['Category', 'Count'], Object.entries(stride).map(([k, v]) => [k, String(v)]));
    }
  }

  if (shouldInclude('source_breakdown', sec, defaults) && findings.length > 0) {
    const bySource: Record<string, number> = {};
    findings.forEach(f => { bySource[f.source] = (bySource[f.source] || 0) + 1; });
    html += '<h2>Source Breakdown</h2>';
    html += htmlTable(['Source', 'Count'], Object.entries(bySource).map(([k, v]) => [k.replace(/_/g, ' '), String(v)]));
  }

  if (shouldInclude('open_recommendations', sec, defaults)) {
    const openFindings = findings.filter(f => f.status === 'open' || f.status === 'in_review');
    const recs = openFindings.flatMap(f => f.recommendations.map(r => ({ finding: f.title, rec: r })));
    if (recs.length > 0) {
      html += '<h2>Open Recommendations</h2>';
      html += htmlTable(['Finding', 'Recommendation'], recs.map(r => [r.finding, r.rec]));
    }
  }

  return html;
};

const buildThreatLandscape = (ws: GrcWorkspace, sec?: GrcReportSectionConfig): string => {
  const defaults = GRC_REPORT_CATALOG.find(r => r.id === 'threat_landscape')!.defaultSections.map(s => s.id);
  const actors = ws.threatActors || [];
  const scenarios = ws.threatScenarios || [];
  let html = '';

  if (shouldInclude('actor_profiles', sec, defaults) && actors.length > 0) {
    html += '<h2>Threat Actor Profiles</h2>';
    html += htmlTable(['Name', 'Type', 'Capability', 'Resources', 'Motivation', 'Targeted Domains'],
      actors.map(a => [
        a.name, a.type.replace(/_/g, ' '),
        String(a.capabilityLevel), a.resourceLevel.replace(/_/g, ' '),
        a.motivation, (a.targetedAssetDomains || []).join(', ') || '—'
      ]));
  }

  if (shouldInclude('scenarios', sec, defaults) && scenarios.length > 0) {
    html += '<h2>Threat Scenarios</h2>';
    html += htmlTable(['Title', 'Actor', 'Techniques', 'Likelihood', 'Impact'],
      scenarios.map(s => {
        const actor = actors.find(a => a.id === s.threatActorId);
        return [
          s.title, actor?.name || '—',
          s.attackTechniques.join(', ') || '—',
          s.likelihood || '—', s.impact || '—'
        ];
      }));
  }

  if (shouldInclude('targeted_assets', sec, defaults)) {
    const assetMap = new Map(ws.assets.map(a => [a.id, a]));
    const targetedIdArr = [...actors.flatMap(a => a.targetedAssetIds), ...scenarios.flatMap(s => s.targetedAssetIds)];
    const targetedIds = new Set(targetedIdArr);
    const targetedAssets = Array.from(targetedIds).map(id => assetMap.get(id)).filter(Boolean);
    if (targetedAssets.length > 0) {
      html += '<h2>Targeted Assets</h2>';
      html += htmlTable(['Asset', 'Domain', 'Category', 'Business Criticality'],
        targetedAssets.map(a => [a!.name, a!.domain, a!.category, String(a!.businessCriticality)]));
    }
  }

  if (shouldInclude('technique_summary', sec, defaults)) {
    const techs: Record<string, number> = {};
    scenarios.forEach(s => s.attackTechniques.forEach(t => { techs[t] = (techs[t] || 0) + 1; }));
    if (Object.keys(techs).length > 0) {
      html += '<h2>Attack Technique Summary</h2>';
      html += htmlTable(['Technique', 'Occurrences'],
        Object.entries(techs).sort(([, a], [, b]) => b - a).map(([k, v]) => [k, String(v)]));
    }
  }

  return html;
};

const buildGovernanceStatus = (ws: GrcWorkspace, sec?: GrcReportSectionConfig): string => {
  const defaults = GRC_REPORT_CATALOG.find(r => r.id === 'governance_status')!.defaultSections.map(s => s.id);
  const docs = ws.governanceDocuments || [];
  let html = '';

  if (shouldInclude('document_summary', sec, defaults) && docs.length > 0) {
    const byType: Record<string, number> = {};
    const byStatus: Record<string, number> = {};
    docs.forEach(d => {
      byType[d.type] = (byType[d.type] || 0) + 1;
      byStatus[d.status] = (byStatus[d.status] || 0) + 1;
    });
    html += '<h2>Document Summary</h2><div class="metric-grid">';
    html += metricCard(docs.length, 'Total Documents');
    html += metricCard(docs.filter(d => d.status === 'active').length, 'Active');
    html += metricCard(docs.filter(d => d.status === 'draft').length, 'Draft');
    html += '</div>';
    html += htmlTable(['Type', 'Count'], Object.entries(byType).map(([k, v]) => [k, String(v)]));
  }

  if (shouldInclude('document_register', sec, defaults) && docs.length > 0) {
    html += '<h2>Document Register</h2>';
    html += htmlTable(['Title', 'Type', 'Status', 'Owner', 'Version', 'Next Review'],
      docs.map(d => [
        d.title, d.type, d.status,
        d.owner || '—', d.version || '—', toDisplayDate(d.nextReviewDate)
      ]));
  }

  if (shouldInclude('overdue_reviews', sec, defaults)) {
    const now = Date.now();
    const overdue = docs.filter(d => {
      if (d.status !== 'active' || !d.nextReviewDate) return false;
      const reviewAt = new Date(d.nextReviewDate).getTime();
      return Number.isFinite(reviewAt) && reviewAt < now;
    });
    if (overdue.length > 0) {
      html += '<h2>Overdue Reviews</h2>';
      html += htmlTable(['Title', 'Type', 'Owner', 'Review Due'],
        overdue.map(d => [d.title, d.type, d.owner || '—', toDisplayDate(d.nextReviewDate)]));
    }
  }

  if (shouldInclude('coverage_analysis', sec, defaults) && docs.length > 0) {
    const linkedRiskCount = new Set(docs.flatMap(d => d.linkedRiskIds)).size;
    const linkedControlSetCount = new Set(docs.flatMap(d => d.linkedControlSetIds)).size;
    html += '<h2>Coverage Analysis</h2><div class="metric-grid">';
    html += metricCard(linkedRiskCount, 'Risks Linked to Docs');
    html += metricCard(linkedControlSetCount, 'Frameworks Linked');
    html += '</div>';
  }

  return html;
};

const buildRiskTreatmentProgress = (ws: GrcWorkspace, sec?: GrcReportSectionConfig): string => {
  const defaults = GRC_REPORT_CATALOG.find(r => r.id === 'risk_treatment_progress')!.defaultSections.map(s => s.id);
  const allActions = ws.assessments.flatMap(a =>
    a.riskManagementPlan.actions.map(act => ({ assessmentTitle: a.title, assessmentId: a.id, ...act }))
  );
  let html = '';

  if (shouldInclude('treatment_summary', sec, defaults)) {
    const done = allActions.filter(a => a.status === 'done').length;
    const inProgress = allActions.filter(a => a.status === 'in_progress').length;
    const blocked = allActions.filter(a => a.status === 'blocked').length;
    html += '<h2>Treatment Summary</h2><div class="metric-grid">';
    html += metricCard(allActions.length, 'Total Actions');
    html += metricCard(done, 'Completed');
    html += metricCard(inProgress, 'In Progress');
    html += metricCard(blocked, 'Blocked');
    html += '</div>';
  }

  if (shouldInclude('actions_table', sec, defaults) && allActions.length > 0) {
    html += '<h2>Treatment Actions</h2>';
    html += htmlTable(['Assessment', 'Action', 'Owner', 'Status', 'Priority', 'Strategy', 'Due Date'],
      allActions.map(a => [
        a.assessmentTitle, a.title,
        a.owner || '—', a.status,
        a.priority || '—', a.treatmentStrategy || '—',
        toDisplayDate(a.dueDate)
      ]));
  }

  if (shouldInclude('overdue_actions', sec, defaults)) {
    const now = Date.now();
    const overdue = allActions.filter(a => {
      if (a.status === 'done' || !a.dueDate) return false;
      const dueAt = new Date(a.dueDate).getTime();
      return Number.isFinite(dueAt) && dueAt < now;
    });
    if (overdue.length > 0) {
      html += '<h2>Overdue Actions</h2>';
      html += htmlTable(['Assessment', 'Action', 'Owner', 'Due Date'],
        overdue.map(a => [a.assessmentTitle, a.title, a.owner || '—', toDisplayDate(a.dueDate)]));
    }
  }

  if (shouldInclude('strategy_breakdown', sec, defaults)) {
    const byStrategy: Record<string, number> = {};
    allActions.forEach(a => { const k = a.treatmentStrategy || 'unspecified'; byStrategy[k] = (byStrategy[k] || 0) + 1; });
    if (Object.keys(byStrategy).length > 0) {
      html += '<h2>Strategy Breakdown</h2>';
      html += htmlTable(['Strategy', 'Count'], Object.entries(byStrategy).map(([k, v]) => [k, String(v)]));
    }
  }

  if (shouldInclude('risk_coverage', sec, defaults)) {
    const coveredRiskIds = new Set(allActions.flatMap(a => a.linkedRiskIds));
    const uncovered = ws.risks.filter(r => !coveredRiskIds.has(r.id) && r.status !== 'closed' && r.status !== 'accepted');
    html += '<h2>Risk Coverage</h2><div class="metric-grid">';
    html += metricCard(coveredRiskIds.size, 'Risks with Actions');
    html += metricCard(uncovered.length, 'Risks without Actions');
    html += '</div>';
  }

  return html;
};

const reportBuilders: Record<GrcReportId, (ws: GrcWorkspace, sec?: GrcReportSectionConfig) => string> = {
  executive_summary: buildExecutiveSummary,
  risk_register: buildRiskRegister,
  compliance_status: buildComplianceStatus,
  assessment_summary: buildAssessmentSummary,
  findings_report: buildFindingsReport,
  threat_landscape: buildThreatLandscape,
  governance_status: buildGovernanceStatus,
  risk_treatment_progress: buildRiskTreatmentProgress
};

export const generateReportHtml = (reportId: GrcReportId, workspace: GrcWorkspace, sectionConfig?: GrcReportSectionConfig): string => {
  const catalog = GRC_REPORT_CATALOG.find(r => r.id === reportId);
  const title = catalog?.title || reportId;
  const generatedAt = new Date().toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short' });
  const builder = reportBuilders[reportId];
  const bodyContent = builder ? builder(workspace, sectionConfig) : '<p>Report not found.</p>';
  return wrapHtmlReport(title, generatedAt, bodyContent);
};

type ManualFindingCategoryKey =
  | 'dfd' | 'boundary' | 'data' | 'identity' | 'encryption'
  | 'availability' | 'logging' | 'configuration' | 'threat' | 'attackpath';

const categoryToFindingType = (cat: string): GrcFindingType => {
  if (cat === 'threat' || cat === 'attackpath') return 'threat';
  if (cat === 'data' || cat === 'encryption' || cat === 'identity') return 'vulnerability';
  return 'weakness';
};

const categoryToSeverity = (cat: string): GrcFindingSeverity => {
  if (cat === 'threat' || cat === 'attackpath') return 'high';
  if (cat === 'encryption' || cat === 'identity' || cat === 'data') return 'high';
  return 'medium';
};

interface RuleFinding {
  id: string;
  category: ManualFindingCategoryKey;
  title: string;
  description: string;
  related: { nodeIds: string[]; edgeIds: string[]; zoneIds: string[] };
  recommendations: string[];
  ruleId: string;
  strideCategories?: string[];
}

export const syncFindingsFromRuleEngine = (
  workspace: GrcWorkspace,
  ruleFindings: RuleFinding[]
): { workspace: GrcWorkspace; newCount: number; updatedCount: number } => {
  const now = nowIso();
  const existingByKey = new Map<string, GrcFinding>();
  for (const f of (workspace.findings || [])) {
    if (f.ruleId) {
      const key = `${f.ruleId}:${[...f.relatedNodeIds].sort().join(',')}`;
      existingByKey.set(key, f);
    }
  }

  let newCount = 0;
  let updatedCount = 0;
  const nextFindings = [...(workspace.findings || [])];
  const nextRisks = [...(workspace.risks || [])];

  const normLabel = (value?: string): string => (value || '').trim().toLowerCase();
  const buildTierPath = (nodeId: string | undefined): GrcRisk['tierPath'] => {
    if (!nodeId) return {};
    const nodeMap = new Map(workspace.tierCatalogue.map(n => [n.id, n]));
    const tp: GrcRisk['tierPath'] = {};
    let cur = nodeMap.get(nodeId);
    while (cur) {
      if (cur.tier === 1) tp.tier1 = cur.label;
      if (cur.tier === 2) tp.tier2 = cur.label;
      if (cur.tier === 3) tp.tier3 = cur.label;
      if (cur.tier === 4) tp.tier4 = cur.label;
      cur = cur.parentId ? nodeMap.get(cur.parentId) : undefined;
    }
    return tp;
  };

  const defaultL = workspace.riskModel.likelihoodScale[Math.floor(workspace.riskModel.likelihoodScale.length / 2)]?.id || workspace.riskModel.likelihoodScale[0]?.id || '';
  const defaultI = workspace.riskModel.impactScale[Math.floor(workspace.riskModel.impactScale.length / 2)]?.id || workspace.riskModel.impactScale[0]?.id || '';
  const defaultScore = calculateRiskScore(workspace.riskModel, defaultL, defaultI, workspace.config);

  for (const rf of ruleFindings) {
    const nodeIds = rf.related.nodeIds || [];
    const edgeIds = rf.related.edgeIds || [];
    const key = `${rf.ruleId}:${[...nodeIds].sort().join(',')}`;

    if (existingByKey.has(key)) {
      updatedCount++;
      continue;
    }

    const linkedAssetIds = workspace.assets
      .filter(a => a.diagramRefs.some(ref => nodeIds.includes(ref.nodeId)))
      .map(a => a.id);

    const riskId = createId('risk');
    const newFinding: GrcFinding = {
      id: generateFindingId(nextFindings, workspace.assets, linkedAssetIds),
      title: rf.title,
      description: rf.description,
      type: categoryToFindingType(rf.category),
      severity: categoryToSeverity(rf.category),
      source: 'rule_engine',
      status: 'open',
      category: rf.category as GrcFinding['category'],
      ruleId: rf.ruleId,
      strideCategories: (rf.strideCategories || []) as GrcFinding['strideCategories'],
      relatedNodeIds: nodeIds,
      relatedEdgeIds: edgeIds,
      linkedRiskIds: [riskId],
      linkedTaskIds: [],
      linkedAssetIds: linkedAssetIds,
      recommendations: rf.recommendations || [],
      createdAt: now,
      updatedAt: now
    };

    const matchingTier4Node = workspace.tierCatalogue.find(n =>
      n.tier === 4 && normLabel(n.label) === normLabel(rf.title)
    );
    const derivedTierPath = buildTierPath(matchingTier4Node?.id);

    const autoRisk: GrcRisk = {
      id: riskId,
      title: rf.title,
      description: rf.description,
      status: 'draft',
      assetIds: linkedAssetIds,
      diagramLinks: [],
      inherentScore: defaultScore,
      residualScore: undefined,
      treatmentStrategy: 'mitigate',
      tierPath: { ...derivedTierPath, tier4: derivedTierPath.tier4 || rf.title || undefined },
      sourceFindingId: newFinding.id,
      createdAt: now,
      updatedAt: now
    };

    nextFindings.push(newFinding);
    nextRisks.push(autoRisk);
    newCount++;
  }

  return {
    workspace: { ...workspace, findings: nextFindings, risks: nextRisks, updatedAt: now },
    newCount,
    updatedCount
  };
};

export type GrcWorkflowTemplate = 'onboarding' | 'monthly' | 'incident';

interface WorkflowTemplateSeedTask {
  title: string;
  description: string;
  type: GrcTaskType;
  priority: GrcTaskPriority;
  dueInDays: number;
}

const workflowTemplateSeeds: Record<GrcWorkflowTemplate, WorkflowTemplateSeedTask[]> = {
  onboarding: [
    {
      title: 'Sync in-scope assets from active diagram',
      description: 'Run asset sync and validate owner assignments for critical components.',
      type: 'review',
      priority: 'medium',
      dueInDays: 1
    },
    {
      title: 'Register initial high-impact risks with owners',
      description: 'Capture top risks, assign owners, and set initial due dates for treatment.',
      type: 'risk_treatment',
      priority: 'high',
      dueInDays: 2
    },
    {
      title: 'Import baseline control set and set SoA applicability',
      description: 'Import framework controls and complete first-pass applicability decisions.',
      type: 'control_implementation',
      priority: 'high',
      dueInDays: 3
    },
    {
      title: 'Link controls to prioritized risks in SoA',
      description: 'Populate mitigatesRiskIds so top risks have explicit mapped controls.',
      type: 'control_implementation',
      priority: 'high',
      dueInDays: 5
    },
    {
      title: 'Attach evidence references for implemented controls',
      description: 'Document links/files proving control operation for audit-readiness.',
      type: 'evidence',
      priority: 'medium',
      dueInDays: 7
    },
    {
      title: 'Run initial scoped assessment and export reports',
      description: 'Create first assessment workspace and export PDF/TXT/HTML evidence reports.',
      type: 'assessment',
      priority: 'medium',
      dueInDays: 10
    }
  ],
  monthly: [
    {
      title: 'Review risk statuses, owners, and due dates',
      description: 'Update risk register and escalate high-risk items drifting from target dates.',
      type: 'review',
      priority: 'high',
      dueInDays: 2
    },
    {
      title: 'Resolve overdue and blocked workflow tasks',
      description: 'Replan or escalate blocked tasks and close stale items with validated outcomes.',
      type: 'review',
      priority: 'high',
      dueInDays: 3
    },
    {
      title: 'Refresh SoA implementation and evidence links',
      description: 'Update implementation states and attach fresh evidence where controls changed.',
      type: 'evidence',
      priority: 'medium',
      dueInDays: 5
    },
    {
      title: 'Generate and assign new gap-driven remediation tasks',
      description: 'Use gap detection outputs and assign owners for new treatment work.',
      type: 'risk_treatment',
      priority: 'medium',
      dueInDays: 6
    },
    {
      title: 'Run monthly scoped assessment and export reports',
      description: 'Update monthly assessment workspace and publish PDF/TXT/HTML evidence reports.',
      type: 'assessment',
      priority: 'medium',
      dueInDays: 9
    }
  ],
  incident: [
    {
      title: 'Re-score incident-impacted risks immediately',
      description: 'Update likelihood/impact to reflect incident realities and current exposure.',
      type: 'risk_treatment',
      priority: 'critical',
      dueInDays: 1
    },
    {
      title: 'Update SoA entries for impacted controls',
      description: 'Mark control implementation status changes and annotate incident-specific rationale.',
      type: 'control_implementation',
      priority: 'high',
      dueInDays: 2
    },
    {
      title: 'Create and assign incident remediation tasks',
      description: 'Track remediation actions with owners and target completion dates.',
      type: 'risk_treatment',
      priority: 'critical',
      dueInDays: 2
    },
    {
      title: 'Collect post-incident evidence artifacts',
      description: 'Attach test results, remediation logs, and validation outputs as evidence references.',
      type: 'evidence',
      priority: 'high',
      dueInDays: 4
    },
    {
      title: 'Run closure assessment and export incident reports',
      description: 'Document closure posture in a scoped assessment workspace and export final reports.',
      type: 'assessment',
      priority: 'high',
      dueInDays: 5
    }
  ]
};

const isoDatePlusDays = (days: number): string => {
  const date = new Date();
  date.setDate(date.getDate() + Math.max(0, Math.floor(days)));
  return date.toISOString().slice(0, 10);
};

export const generateWorkflowTasksFromGaps = (
  workspace: GrcWorkspace
): { workspace: GrcWorkspace; addedCount: number } => {
  const elevatedRiskLabels = getElevatedRiskLabels(workspace);
  const nextTasks = [...workspace.workflowTasks];
  let addedCount = 0;
  const dedupe = new Set(
    nextTasks.map(task => `${task.type}|${task.riskId || ''}|${task.controlSetId || ''}|${task.controlId || ''}|${task.title.trim().toLowerCase()}`)
  );

  const now = nowIso();
  const highOrCriticalRisks = workspace.risks.filter(risk =>
    elevatedRiskLabels.has((risk.inherentScore.ratingLabel || '').toLowerCase())
  );
  highOrCriticalRisks.forEach(risk => {
    const isMitigated = workspace.soaEntries.some(entry => entry.mitigatesRiskIds.includes(risk.id));
    if (isMitigated) {
      return;
    }

    const title = `Plan treatment for ${risk.title}`;
    const key = `risk_treatment|${risk.id}|||${title.toLowerCase()}`;
    if (dedupe.has(key)) {
      return;
    }

    nextTasks.push({
      id: createId('task'),
      title,
      description: 'Highest-severity risk has no linked SoA mitigation. Define treatment owner, due date, and implementation approach.',
      type: 'risk_treatment',
      status: 'todo',
      priority: 'high',
      riskId: risk.id,
      owner: risk.owner,
      dueDate: risk.dueDate,
      createdAt: now,
      updatedAt: now
    });
    dedupe.add(key);
    addedCount += 1;
  });

  workspace.soaEntries
    .filter(entry => entry.implementationStatus === 'implemented' && entry.evidence.length === 0)
    .forEach(entry => {
      const controlSet = workspace.controlSets.find(set => set.id === entry.controlSetId);
      const control = controlSet?.controls.find(item => item.controlId === entry.controlId);
      const title = `Collect evidence for ${entry.controlId}${control?.title ? ` - ${control.title}` : ''}`;
      const key = `evidence||${entry.controlSetId}|${entry.controlId}|${title.toLowerCase()}`;
      if (dedupe.has(key)) {
        return;
      }

      nextTasks.push({
        id: createId('task'),
        title,
        description: 'Control is marked implemented but has no evidence references attached.',
        type: 'evidence',
        status: 'todo',
        priority: 'medium',
        controlSetId: entry.controlSetId,
        controlId: entry.controlId,
        createdAt: now,
        updatedAt: now
      });
      dedupe.add(key);
      addedCount += 1;
    });

  workspace.risks.forEach(risk => {
    const threshold = resolveRiskAppetite(risk, workspace);
    if (risk.inherentScore.rawScore < threshold) return;
    const title = `Escalate appetite breach for ${risk.title}`;
    const key = `risk_treatment|${risk.id}|||${title.toLowerCase()}`;
    if (dedupe.has(key)) return;

    nextTasks.push({
      id: createId('task'),
      title,
      description: `Risk score ${risk.inherentScore.rawScore} meets or exceeds the resolved appetite threshold of ${threshold}. Define treatment or escalation path.`,
      type: 'risk_treatment',
      status: 'todo',
      priority: 'critical',
      riskId: risk.id,
      owner: risk.owner,
      dueDate: risk.dueDate,
      createdAt: now,
      updatedAt: now
    });
    dedupe.add(key);
    addedCount += 1;
  });

  const govNow = Date.now();
  (workspace.governanceDocuments || []).forEach(doc => {
    if (doc.status !== 'active' || !doc.nextReviewDate) return;
    const reviewAt = new Date(doc.nextReviewDate).getTime();
    if (!Number.isFinite(reviewAt) || reviewAt >= govNow) return;
    const title = `Review overdue governance document: ${doc.title}`;
    const key = `review||||${title.toLowerCase()}`;
    if (dedupe.has(key)) return;

    nextTasks.push({
      id: createId('task'),
      title,
      description: `Document "${doc.title}" is past its next review date of ${doc.nextReviewDate}. Update and re-approve.`,
      type: 'review',
      status: 'todo',
      priority: 'high',
      createdAt: now,
      updatedAt: now
    });
    dedupe.add(key);
    addedCount += 1;
  });

  const within30Days = govNow + 30 * 24 * 60 * 60 * 1000;
  (workspace.riskAcceptances || []).forEach(ra => {
    if (ra.status !== 'approved' || !ra.expirationDate) return;
    const expiresAt = new Date(ra.expirationDate).getTime();
    if (!Number.isFinite(expiresAt) || expiresAt >= within30Days) return;
    const title = `Risk acceptance expiring soon: ${ra.title}`;
    const key = `review||||${title.toLowerCase()}`;
    if (dedupe.has(key)) return;
    nextTasks.push({
      id: createId('task'),
      title,
      description: `Risk acceptance "${ra.title}" expires on ${ra.expirationDate}. Review and renew or close.`,
      type: 'review',
      status: 'todo',
      priority: 'high',
      createdAt: now,
      updatedAt: now
    });
    dedupe.add(key);
    addedCount += 1;
  });

  (workspace.incidents || []).forEach(inc => {
    if (inc.status === 'resolved' || inc.status === 'closed') return;
    const detectedAt = new Date(inc.detectedDate).getTime();
    if (!Number.isFinite(detectedAt) || detectedAt >= govNow - 30 * 24 * 60 * 60 * 1000) return;
    const title = `Stale open incident: ${inc.title}`;
    const key = `review||||${title.toLowerCase()}`;
    if (dedupe.has(key)) return;
    nextTasks.push({
      id: createId('task'),
      title,
      description: `Incident "${inc.title}" has been open for more than 30 days. Investigate and resolve or escalate.`,
      type: 'review',
      status: 'todo',
      priority: 'high',
      createdAt: now,
      updatedAt: now
    });
    dedupe.add(key);
    addedCount += 1;
  });

  return {
    workspace: {
      ...workspace,
      workflowTasks: nextTasks,
      updatedAt: nowIso()
    },
    addedCount
  };
};

export const generateWorkflowTemplateTasks = (
  workspace: GrcWorkspace,
  template: GrcWorkflowTemplate
): { workspace: GrcWorkspace; addedCount: number } => {
  const seeds = workflowTemplateSeeds[template];
  if (!seeds) {
    return { workspace, addedCount: 0 };
  }

  const now = nowIso();
  const nextTasks = [...workspace.workflowTasks];
  const activeDedupe = new Set(
    nextTasks
      .filter(task => task.status !== 'done')
      .map(task => `${task.type}|${task.title.trim().toLowerCase()}`)
  );

  let addedCount = 0;
  seeds.forEach(seed => {
    const key = `${seed.type}|${seed.title.trim().toLowerCase()}`;
    if (activeDedupe.has(key)) {
      return;
    }

    nextTasks.push({
      id: createId('task'),
      title: seed.title,
      description: seed.description,
      type: seed.type,
      status: 'todo',
      priority: seed.priority,
      dueDate: isoDatePlusDays(seed.dueInDays),
      createdAt: now,
      updatedAt: now
    });
    activeDedupe.add(key);
    addedCount += 1;
  });

  return {
    workspace: {
      ...workspace,
      workflowTasks: nextTasks,
      updatedAt: nowIso()
    },
    addedCount
  };
};

const detectDelimiter = (line: string): string => {
  const candidates = [',', '\t', ';', '|'];
  let selected = ',';
  let maxCount = 0;

  candidates.forEach(candidate => {
    const count = line.split(candidate).length - 1;
    if (count > maxCount) {
      maxCount = count;
      selected = candidate;
    }
  });

  return selected;
};

const parseDelimitedRows = (text: string, delimiter?: string): string[][] => {
  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const rows: string[][] = [];
  const firstLine = normalized.split('\n').find(line => line.trim().length > 0) || '';
  const selectedDelimiter = delimiter || detectDelimiter(firstLine);

  let row: string[] = [];
  let field = '';
  let insideQuotes = false;

  for (let i = 0; i < normalized.length; i += 1) {
    const char = normalized[i];
    const next = normalized[i + 1];

    if (char === '"') {
      if (insideQuotes && next === '"') {
        field += '"';
        i += 1;
      } else {
        insideQuotes = !insideQuotes;
      }
      continue;
    }

    if (!insideQuotes && char === selectedDelimiter) {
      row.push(field.trim());
      field = '';
      continue;
    }

    if (!insideQuotes && char === '\n') {
      row.push(field.trim());
      field = '';
      if (row.some(cell => cell.length > 0)) {
        rows.push(row);
      }
      row = [];
      continue;
    }

    field += char;
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field.trim());
    if (row.some(cell => cell.length > 0)) {
      rows.push(row);
    }
  }

  return rows;
};

const normalizeHeader = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const headerIndex = (headers: string[], candidates: string[]): number => {
  for (let i = 0; i < headers.length; i += 1) {
    if (candidates.includes(headers[i])) {
      return i;
    }
  }
  return -1;
};

export const parseTier3CatalogueCsv = (csvText: string): Tier3ImportRow[] => {
  const rows = parseDelimitedRows(csvText);
  if (rows.length === 0) {
    return [];
  }

  const headers = rows[0].map(normalizeHeader);
  const tier2Index = headerIndex(headers, ['tier 2', 'tier2', 'category', 'risk category', 'domain']);
  const tier3Index = headerIndex(headers, ['tier 3', 'tier3', 'risk scenario', 'scenario', 'risk', 'risk name']);
  const descriptionIndex = headerIndex(headers, ['description', 'details', 'summary', 'risk statement']);
  const riskIdIndex = headerIndex(headers, ['risk id', 'id']);
  const ciaTriadIndex = headerIndex(headers, ['cia triad', 'cia']);
  const impactCategoryIndex = headerIndex(headers, ['impact category', 'impact']);
  const tagsIndex = headerIndex(headers, ['tags', 'keywords', 'labels']);

  const seen = new Set<string>();
  const result: Tier3ImportRow[] = [];

  rows.slice(1).forEach(row => {
    const riskId = (riskIdIndex >= 0 ? row[riskIdIndex] : '').trim();
    const tier3Raw = (tier3Index >= 0 ? row[tier3Index] : '').trim();
    const fallbackTier3 = riskId || (row[0] || '').trim();
    const tier3 = tier3Raw || fallbackTier3;
    if (!tier3) {
      return;
    }

    const rawTier2 = (tier2Index >= 0 ? row[tier2Index] : '').trim();
    const tier2 = rawTier2;
    const description = (descriptionIndex >= 0 ? row[descriptionIndex] : '').trim();
    const ciaTriad = (ciaTriadIndex >= 0 ? row[ciaTriadIndex] : '').trim();
    const impactCategory = (impactCategoryIndex >= 0 ? row[impactCategoryIndex] : '').trim();
    const freeformTags = (tagsIndex >= 0 ? row[tagsIndex] : '')
      .split(/[;,|]/g)
      .map(tag => tag.trim())
      .filter(Boolean);
    const tags = [
      ...freeformTags,
      riskId ? `risk_id:${riskId.toLowerCase()}` : undefined,
      rawTier2 ? `domain:${toSlug(rawTier2)}` : undefined,
      ciaTriad ? `cia:${toSlug(ciaTriad)}` : undefined,
      impactCategory ? `impact:${toSlug(impactCategory)}` : undefined
    ].filter(Boolean) as string[];
    const enrichedDescription = description || [
      ciaTriad ? `CIA triad focus: ${ciaTriad}` : undefined,
      impactCategory ? `Impact category: ${impactCategory}` : undefined
    ].filter(Boolean).join(' | ');

    const dedupeKey = `${tier2.toLowerCase()}::${tier3.toLowerCase()}`;
    if (seen.has(dedupeKey)) {
      return;
    }
    seen.add(dedupeKey);

    result.push({
      tier2: tier2 || undefined,
      tier3,
      description: enrichedDescription || undefined,
      tags: tags.length > 0 ? tags : undefined
    });
  });

  return result;
};

export const upsertTier3Catalogue = (
  workspace: GrcWorkspace,
  rows: Tier3ImportRow[]
): { workspace: GrcWorkspace; addedCount: number } => {
  if (rows.length === 0) {
    return { workspace, addedCount: 0 };
  }

  const nextTierCatalogue = [...workspace.tierCatalogue];
  let addedCount = 0;

  const ensureTier2 = (label: string): string => {
    const normalized = label.trim().toLowerCase();
    const existing = nextTierCatalogue.find(node => node.tier === 2 && node.label.trim().toLowerCase() === normalized);
    if (existing) {
      return existing.id;
    }

    const nodeId = `tier2-${toSlug(label) || createId('tier2')}`;
    nextTierCatalogue.push({
      id: nodeId,
      tier: 2,
      parentId: 'tier1-cyber-risk',
      label,
      description: 'Imported Tier 2 risk statement'
    });
    return nodeId;
  };

  rows.forEach(row => {
    const tier2Label = row.tier2 || tier2BoardCategories[0].label;
    const tier2Id = ensureTier2(tier2Label);
    const tier3Slug = toSlug(row.tier3);
    const existingTier3 = nextTierCatalogue.find(
      node => node.tier === 3 && node.parentId === tier2Id && node.label.trim().toLowerCase() === row.tier3.trim().toLowerCase()
    );

    if (existingTier3) {
      return;
    }

    nextTierCatalogue.push({
      id: `tier3-${tier3Slug || createId('tier3')}`,
      tier: 3,
      parentId: tier2Id,
      label: row.tier3,
      description: row.description,
      tags: row.tags
    });
    addedCount += 1;
  });

  return {
    workspace: {
      ...workspace,
      tierCatalogue: nextTierCatalogue,
      updatedAt: nowIso()
    },
    addedCount
  };
};

export const parseControlSetCsvRows = (csvText: string): ControlImportRow[] => {
  const rows = parseDelimitedRows(csvText);
  if (rows.length === 0) {
    return [];
  }

  const headers = rows[0].map(normalizeHeader);
  const controlIdIndex = headerIndex(headers, ['control id', 'control', 'id', 'reference', 'control reference']);
  const titleIndex = headerIndex(headers, ['title', 'name', 'control name', 'statement']);
  const descriptionIndex = headerIndex(headers, ['description', 'guidance', 'details']);
  const familyIndex = headerIndex(headers, ['family', 'domain', 'category']);
  const tagsIndex = headerIndex(headers, ['tags', 'keywords']);

  return rows
    .slice(1)
    .map((row, rowIndex) => {
      const controlId = (controlIdIndex >= 0 ? row[controlIdIndex] : row[0] || '').trim();
      const title = (titleIndex >= 0 ? row[titleIndex] : row[1] || '').trim();
      const description = (descriptionIndex >= 0 ? row[descriptionIndex] : '').trim();
      const family = (familyIndex >= 0 ? row[familyIndex] : '').trim();
      const tags = (tagsIndex >= 0 ? row[tagsIndex] : '')
        .split(/[;,]/g)
        .map(tag => tag.trim())
        .filter(Boolean);

      return {
        controlId,
        title: title || controlId,
        description: description || undefined,
        family: family || undefined,
        tags: tags.length > 0 ? tags : undefined,
        sourceRow: rowIndex + 2
      };
    })
    .filter(row => row.controlId || row.title);
};

export const controlRowsToControlSet = (
  controlSetName: string,
  rows: ControlImportRow[],
  sourceType: GrcControlSet['sourceType'] = 'imported'
): GrcControlSet => {
  const controls: GrcControl[] = rows.map((row, index) => ({
    id: `control-${toSlug(row.controlId || row.title) || index + 1}-${index + 1}`,
    controlId: row.controlId || `CONTROL-${index + 1}`,
    title: row.title || row.controlId || `Control ${index + 1}`,
    description: row.description,
    family: row.family,
    tags: row.tags,
    sourceRow: row.sourceRow
  }));

  return {
    id: createId('controlset'),
    name: controlSetName,
    sourceType,
    importedAt: nowIso(),
    importSourceName: controlSetName,
    controls
  };
};

export const withUpdatedTimestamp = (workspace: GrcWorkspace): GrcWorkspace => ({
  ...workspace,
  updatedAt: nowIso()
});
