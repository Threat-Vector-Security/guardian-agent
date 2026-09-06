import { nodeToDFDCategory } from '../utils/dfdCategoryMappings';
import { nodeTypeContextHints } from '../data/nodeTypeContextHints';
import type { SecurityEdge, SecurityNode, DataClassification, DFDCategory, SecurityZone } from '../types/SecurityTypes';
import type { ManualAnalysisIndex, ManualAnalysisInputs, ManualAnalysisResult, ManualFinding } from '../types/ManualAnalysisTypes';
import { isSecurityZoneNode } from '../types/SecurityTypes';
import { threatPatternLibrary, type ThreatPattern } from '../data/manualThreatLibrary';
import type { DiagramAttackPath } from '../types/GrcTypes';

const RULE_NAMESPACE = 'manual';

const trustRank: Record<SecurityZone, number> = {
  Internet: 0,
  External: 1,
  Guest: 1,
  DMZ: 2,
  Edge: 2,
  Partner: 2,
  ThirdParty: 2,
  Cloud: 2,
  Development: 3,
  Staging: 3,
  Internal: 3,
  Management: 4,
  ServiceMesh: 4,
  BackOffice: 4,
  ControlPlane: 4,
  DataPlane: 4,
  Trusted: 5,
  Restricted: 6,
  Critical: 6,
  Compliance: 6,
  OT: 6,
  Production: 6,
  Recovery: 6,
  Quarantine: 6,
  Hybrid: 4,
  MultiCloud: 4,
  RedTeam: 5,
  BlueTeam: 5,
  PurpleTeam: 5,
  YellowTeam: 4,
  GreenTeam: 4,
  OrangeTeam: 4,
  WhiteTeam: 5,
  Generic: 3
};

const dataClassRank: Record<DataClassification, number> = {
  Public: 0,
  Internal: 1,
  Sensitive: 2,
  Confidential: 3
};

const encryptionKeywords = [
  'encryption', 'encrypt', 'tls', 'ssl', 'mtls', 'kms', 'hsm', 'ipsec', 'vpn', 'ssh', 'aes', 'cmk', 'key management'
];
const loggingKeywords = [
  'logging', 'log', 'siem', 'monitor', 'monitoring', 'audit', 'observability', 'telemetry', 'trace', 'alert'
];
const authKeywords = [
  'auth', 'oauth', 'oidc', 'mfa', 'sso', 'jwt', 'token', 'saml', 'apikey', 'api key', 'ldap', 'radius'
];
const authorizationKeywords = [
  'authorize', 'authorization', 'rbac', 'abac', 'role', 'policy', 'scope', 'permission', 'iam', 'acl'
];
const validationKeywords = [
  'validate', 'validation', 'sanitize', 'sanitization', 'input', 'parameter', 'prepared', 'waf', 'allowlist',
  'allow-list', 'escape', 'csrf', 'xss', 'sql', 'injection'
];
const integrityKeywords = [
  'integrity', 'checksum', 'hash', 'signature', 'signed', 'attestation', 'sbom', 'provenance', 'code signing', 'sigstore'
];
const egressKeywords = [
  'egress', 'allowlist', 'allow-list', 'proxy', 'forward proxy', 'gateway', 'network policy',
  'firewall rule', 'egress filter', 'nat', 'secure web gateway'
];
const redundancyKeywords = [
  'redundant', 'redundancy', 'ha', 'failover', 'cluster', 'replica', 'active-active',
  'active-passive', 'load balance', 'load balancer', 'geo', 'multi-region', 'backup'
];
const mfaKeywords = ['mfa', 'multi-factor', 'multifactor', '2fa', 'step-up'];
const ignoredNodeTypes = new Set(['freehand', 'shape', 'textAnnotation']);

const severityRank: Record<string, number> = {
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
  CRITICAL: 4
};

const likelihoodRank: Record<string, number> = {
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
  VERY_HIGH: 4
};

const targetKeywordMap: Record<string, string[]> = {
  'web-application': ['web', 'frontend', 'browser', 'portal', 'website', 'webapp', 'ui', 'spa'],
  'user-interface': ['ui', 'console', 'dashboard', 'admin portal'],
  'api': ['api', 'gateway', 'endpoint', 'rest', 'graphql', 'grpc', 'swagger', 'openapi'],
  'web-service': ['web service', 'service', 'backend', 'bff'],
  'application': ['application', 'app', 'microservice', 'service'],
  'mobile-app': ['mobile', 'ios', 'android', 'tablet', 'phone'],
  'database': ['database', 'db', 'sql', 'postgres', 'mysql', 'oracle', 'mongodb', 'redis', 'dynamo', 'cassandra'],
  'cloud-storage': ['storage', 'object storage', 'bucket', 's3', 'blob', 'gcs'],
  'file-system': ['file system', 'filesystem', 'nfs', 'efs', 'share'],
  'server': ['server', 'vm', 'instance', 'compute', 'host', 'container', 'kubernetes', 'k8s'],
  'network': ['network', 'vpc', 'subnet', 'router', 'switch', 'firewall', 'load balancer', 'proxy', 'gateway'],
  'email-system': ['email', 'smtp', 'imap', 'mail'],
  'system': ['system', 'platform', 'cluster'],
  'user': ['user', 'customer', 'employee', 'admin', 'operator']
};

const categoryTargetMap: Record<string, string[]> = {
  application: ['application', 'web-service'],
  network: ['network'],
  infrastructure: ['server'],
  cloud: ['system'],
  ot: ['system']
};

const lowTrustZones = new Set<SecurityZone>(['Internet', 'External', 'Guest', 'DMZ', 'Edge', 'Partner', 'ThirdParty']);
const highTrustZones = new Set<SecurityZone>([
  'Internal', 'Management', 'Restricted', 'Critical', 'Compliance', 'Production',
  'ControlPlane', 'DataPlane', 'Trusted', 'BackOffice', 'ServiceMesh'
]);

const getDFDCategory = (node: SecurityNode): DFDCategory | null => {
  const explicit = (node.data as any)?.dfdCategory as DFDCategory | undefined;
  if (explicit) {
    return explicit;
  }
  if (node.type === 'dfdActor') return 'actor';
  if (node.type === 'dfdProcess') return 'process';
  if (node.type === 'dfdDataStore') return 'dataStore';
  if (node.type === 'dfdTrustBoundary') return 'trustBoundary';
  return nodeToDFDCategory[node.type as keyof typeof nodeToDFDCategory] || null;
};

const getNodeZone = (node: SecurityNode): SecurityZone | undefined => {
  if (isSecurityZoneNode(node)) {
    return node.data.zoneType;
  }
  return (node.data as any)?.zone as SecurityZone | undefined;
};

const getClassification = (edge: SecurityEdge, source?: SecurityNode, target?: SecurityNode): DataClassification | undefined => {
  const edgeClass = (edge.data as any)?.dataClassification as DataClassification | undefined;
  if (edgeClass) {
    return edgeClass;
  }
  const sourceClass = (source?.data as any)?.dataClassification as DataClassification | undefined;
  const targetClass = (target?.data as any)?.dataClassification as DataClassification | undefined;
  if (sourceClass && targetClass) {
    return dataClassRank[sourceClass] >= dataClassRank[targetClass] ? sourceClass : targetClass;
  }
  return sourceClass || targetClass;
};

const hasKeyword = (values: string[] | undefined, keywords: string[]): boolean => {
  if (!values || values.length === 0) {
    return false;
  }
  const combined = values.join(' ').toLowerCase();
  return keywords.some(keyword => combined.includes(keyword.toLowerCase()));
};

const getEdgeTextValues = (edge?: SecurityEdge): string[] => {
  if (!edge) return [];
  const data = edge.data as any;
  return [
    data?.label,
    data?.description,
    data?.protocol,
    data?.encryption,
    data?.portRange
  ].filter(Boolean);
};

const getNodeControlValues = (node?: SecurityNode): string[] => {
  if (!node) return [];
  const data = node.data as any;
  const components = (data?.components as Array<{ name: string; version: string }> | undefined) || [];
  const componentStrings = components.map(component => `${component.name} ${component.version || ''}`.trim());
  return [
    ...(data?.securityControls || []),
    ...(data?.protocols || []),
    data?.description,
    data?.additionalContext,
    data?.vendor,
    data?.product,
    data?.technology,
    ...componentStrings
  ].filter(Boolean);
};

const hasAuth = (edge: SecurityEdge, source?: SecurityNode, target?: SecurityNode): boolean => {
  const edgeControls = (edge.data as any)?.securityControls as string[] | undefined;
  if (hasKeyword(edgeControls, authKeywords)) {
    return true;
  }
  const sourceAuth = (source?.data as any)?.accessControl?.authentication as string[] | undefined;
  const targetAuth = (target?.data as any)?.accessControl?.authentication as string[] | undefined;
  return (sourceAuth?.length ?? 0) > 0 || (targetAuth?.length ?? 0) > 0;
};

const hasAuthorization = (edge: SecurityEdge, source?: SecurityNode, target?: SecurityNode): boolean => {
  const edgeControls = (edge.data as any)?.securityControls as string[] | undefined;
  const edgeSignals = [...(edgeControls || []), ...getEdgeTextValues(edge)];
  if (hasKeyword(edgeSignals, authorizationKeywords)) {
    return true;
  }
  const sourceAuthz = (source?.data as any)?.accessControl?.authorization as string[] | undefined;
  const targetAuthz = (target?.data as any)?.accessControl?.authorization as string[] | undefined;
  const sourceControls = getNodeControlValues(source);
  const targetControls = getNodeControlValues(target);
  return (
    (sourceAuthz?.length ?? 0) > 0 ||
    (targetAuthz?.length ?? 0) > 0 ||
    hasKeyword(sourceControls, authorizationKeywords) ||
    hasKeyword(targetControls, authorizationKeywords)
  );
};

const hasMfa = (node?: SecurityNode): boolean => {
  if (!node) return false;
  const auth = (node.data as any)?.accessControl?.authentication as string[] | undefined;
  const controls = getNodeControlValues(node);
  return hasKeyword(auth, mfaKeywords) || hasKeyword(controls, mfaKeywords);
};

const hasInputValidation = (edge?: SecurityEdge, target?: SecurityNode): boolean => {
  const edgeControls = (edge?.data as any)?.securityControls as string[] | undefined;
  const edgeSignals = [...(edgeControls || []), ...getEdgeTextValues(edge)];
  const targetControls = getNodeControlValues(target);
  return hasKeyword(edgeSignals, validationKeywords) || hasKeyword(targetControls, validationKeywords);
};

const hasIntegrityControl = (node?: SecurityNode): boolean => {
  const controls = getNodeControlValues(node);
  return hasKeyword(controls, integrityKeywords);
};

const hasEgressControl = (edge?: SecurityEdge, source?: SecurityNode): boolean => {
  const edgeControls = (edge?.data as any)?.securityControls as string[] | undefined;
  const edgeSignals = [...(edgeControls || []), ...getEdgeTextValues(edge)];
  const sourceControls = getNodeControlValues(source);
  return hasKeyword(edgeSignals, egressKeywords) || hasKeyword(sourceControls, egressKeywords);
};

const hasRedundancyControl = (node?: SecurityNode): boolean => {
  const controls = getNodeControlValues(node);
  return hasKeyword(controls, redundancyKeywords);
};

const buildNodeText = (node: SecurityNode): string => {
  const data = node.data as any;
  return [
    node.type,
    data?.label,
    data?.description,
    data?.vendor,
    data?.product,
    data?.technology,
    data?.category,
    data?.indexCode
  ].filter(Boolean).join(' ').toLowerCase();
};

const isLikelyApplicationNode = (node: SecurityNode): boolean => {
  const category = (node.data as any)?.category as string | undefined;
  if (category === 'application') return true;
  const type = node.type.toLowerCase();
  return ['api', 'gateway', 'web', 'app', 'service', 'function', 'frontend', 'backend', 'bff'].some(keyword =>
    type.includes(keyword)
  );
};

const isSupplyChainNode = (node: SecurityNode): boolean => {
  const nodeText = buildNodeText(node);
  return [
    'repository', 'repo', 'registry', 'artifact', 'package', 'dependency',
    'pipeline', 'ci', 'cd', 'build', 'deploy', 'supply chain', 'sbom'
  ].some(keyword => nodeText.includes(keyword));
};

const getThreatTargetsForNode = (node: SecurityNode): Set<string> => {
  const targets = new Set<string>();
  const nodeText = buildNodeText(node);

  for (const [target, keywords] of Object.entries(targetKeywordMap)) {
    if (keywords.some(keyword => nodeText.includes(keyword))) {
      targets.add(target);
    }
  }

  const category = (node.data as any)?.category as string | undefined;
  if (category && categoryTargetMap[category]) {
    categoryTargetMap[category].forEach(target => targets.add(target));
  }

  return targets;
};

const scoreThreatPattern = (pattern: ThreatPattern, nodeText: string, targetMatches: number): number => {
  const severityScore = severityRank[pattern.severity?.toUpperCase() || 'MEDIUM'] || 1;
  const likelihoodKey = pattern.likelihood ? pattern.likelihood.toUpperCase().replace(' ', '_') : 'MEDIUM';
  const likelihoodScore = likelihoodRank[likelihoodKey] || 1;
  const keywordMatches = pattern.matchKeywords
    ? pattern.matchKeywords.filter(keyword => nodeText.includes(keyword.toLowerCase())).length
    : 0;
  return targetMatches * 3 + keywordMatches * 2 + severityScore + likelihoodScore;
};

const matchThreatPatternsForNode = (node: SecurityNode): ThreatPattern[] => {
  const nodeText = buildNodeText(node);
  const targets = getThreatTargetsForNode(node);

  const matches = threatPatternLibrary
    .map(pattern => {
      const targetMatches = pattern.commonTargets
        ? pattern.commonTargets.filter(target => targets.has(target)).length
        : 0;
      const keywordMatches = pattern.matchKeywords
        ? pattern.matchKeywords.some(keyword => nodeText.includes(keyword.toLowerCase()))
        : false;

      if (targetMatches === 0 && !keywordMatches) {
        return null;
      }

      return {
        pattern,
        score: scoreThreatPattern(pattern, nodeText, targetMatches)
      };
    })
    .filter((entry): entry is { pattern: ThreatPattern; score: number } => entry !== null)
    .sort((a, b) => b.score - a.score)
    .map(entry => entry.pattern);

  return matches.slice(0, 3);
};

const buildRiskDetails = (pattern: ThreatPattern, classification?: DataClassification): string[] => {
  const severity = pattern.severity?.toUpperCase() || 'MEDIUM';
  const likelihood = pattern.likelihood?.toUpperCase() || 'MEDIUM';
  const impact = pattern.impact?.toUpperCase() || 'MEDIUM';
  const severityScore = severityRank[severity] || 2;
  const likelihoodScore = likelihoodRank[likelihood.replace(' ', '_')] || 2;
  const riskScore = Math.min(10, severityScore * 2 + likelihoodScore);
  const riskLevel = riskScore >= 8 ? 'High' : riskScore >= 5 ? 'Medium' : 'Low';

  const details = [
    `Severity: ${severity} | Likelihood: ${likelihood} | Impact: ${impact}`,
    `Risk Level: ${riskLevel} (${riskScore})`
  ];

  if (classification) {
    details.push(`Data Sensitivity: ${classification}`);
  }

  if (pattern.stride && pattern.stride.length > 0) {
    details.push(`STRIDE: ${pattern.stride.join(', ')}`);
  }

  if (pattern.mitreTechniques && pattern.mitreTechniques.length > 0) {
    details.push(`MITRE ATT&CK: ${pattern.mitreTechniques.join(', ')}`);
  }

  if (pattern.owaspCategories && pattern.owaspCategories.length > 0) {
    details.push(`OWASP: ${pattern.owaspCategories.join(', ')}`);
  }

  return details;
};

const addFinding = (findings: ManualFinding[], finding: Omit<ManualFinding, 'id' | 'createdAt' | 'updatedAt'>) => {
  const timestamp = Date.now();
  const idBase = `${finding.ruleId}:${finding.related.nodeIds.join(',')}:${finding.related.edgeIds.join(',')}:${finding.related.zoneIds.join(',')}`;
  findings.push({
    ...finding,
    id: `${RULE_NAMESPACE}:${idBase}`,
    createdAt: timestamp,
    updatedAt: timestamp
  });
};

const buildIndex = (findings: ManualFinding[]): ManualAnalysisIndex => {
  const index: ManualAnalysisIndex = {
    nodeFindings: {},
    edgeFindings: {},
    zoneFindings: {}
  };

  for (const finding of findings) {
    for (const nodeId of finding.related.nodeIds) {
      if (!index.nodeFindings[nodeId]) {
        index.nodeFindings[nodeId] = [];
      }
      index.nodeFindings[nodeId].push(finding);
    }
    for (const edgeId of finding.related.edgeIds) {
      if (!index.edgeFindings[edgeId]) {
        index.edgeFindings[edgeId] = [];
      }
      index.edgeFindings[edgeId].push(finding);
    }
    for (const zoneId of finding.related.zoneIds) {
      if (!index.zoneFindings[zoneId]) {
        index.zoneFindings[zoneId] = [];
      }
      index.zoneFindings[zoneId].push(finding);
    }
  }

  return index;
};

export const runManualAnalysis = ({ nodes, edges, zones, attackPaths }: ManualAnalysisInputs): ManualAnalysisResult => {
  const findings: ManualFinding[] = [];
  const nodeById = new Map(nodes.map(node => [node.id, node]));
  const edgeById = new Map(edges.map(edge => [edge.id, edge]));
  const inbound: Record<string, SecurityEdge[]> = {};
  const outbound: Record<string, SecurityEdge[]> = {};

  for (const edge of edges) {
    if (!outbound[edge.source]) outbound[edge.source] = [];
    if (!inbound[edge.target]) inbound[edge.target] = [];
    outbound[edge.source].push(edge);
    inbound[edge.target].push(edge);
  }

  // DFD-001: External actor directly connected to data store.
  for (const edge of edges) {
    const source = nodeById.get(edge.source);
    const target = nodeById.get(edge.target);
    if (!source || !target) continue;
    const sourceCategory = getDFDCategory(source);
    const targetCategory = getDFDCategory(target);
    if ((sourceCategory === 'actor' && targetCategory === 'dataStore') ||
        (targetCategory === 'actor' && sourceCategory === 'dataStore')) {
      addFinding(findings, {
        category: 'dfd',
        title: 'External entity connected directly to data store',
        description: 'DFD best practice expects external entities to interact with data stores via a process.',
        related: { nodeIds: [source.id, target.id], edgeIds: [edge.id], zoneIds: [] },
        recommendations: ['Insert a process between the external entity and the data store.'],
        ruleId: 'DFD-001'
      });
    }
  }

  // DFD-002: Data flow missing label.
  for (const edge of edges) {
    const label = (edge.data as any)?.label;
    if (!label || String(label).trim() === '') {
      addFinding(findings, {
        category: 'dfd',
        title: 'Data flow missing label',
        description: 'DFD data flows should be labeled with the data being transmitted.',
        related: { nodeIds: [edge.source, edge.target], edgeIds: [edge.id], zoneIds: [] },
        recommendations: ['Add a data label describing the flow contents.'],
        ruleId: 'DFD-002'
      });
    }
  }

  // DFD-003: Process requires input and output.
  for (const node of nodes) {
    if (isSecurityZoneNode(node)) continue;
    const category = getDFDCategory(node);
    if (category !== 'process') continue;
    const inEdges = inbound[node.id] || [];
    const outEdges = outbound[node.id] || [];
    if (inEdges.length === 0 || outEdges.length === 0) {
      addFinding(findings, {
        category: 'dfd',
        title: 'Process missing input or output',
        description: 'DFD processes should have at least one input and one output.',
        related: { nodeIds: [node.id], edgeIds: [], zoneIds: [] },
        recommendations: ['Ensure the process has both inbound and outbound data flows.'],
        ruleId: 'DFD-003'
      });
    }
  }

  // DFD-004: Data store must connect to a process.
  for (const node of nodes) {
    if (isSecurityZoneNode(node)) continue;
    const category = getDFDCategory(node);
    if (category !== 'dataStore') continue;
    const connections = [...(inbound[node.id] || []), ...(outbound[node.id] || [])];
    const hasProcessLink = connections.some(edge => {
      const otherId = edge.source === node.id ? edge.target : edge.source;
      const otherNode = nodeById.get(otherId);
      return otherNode && getDFDCategory(otherNode) === 'process';
    });
    if (!hasProcessLink) {
      addFinding(findings, {
        category: 'dfd',
        title: 'Data store not connected to a process',
        description: 'DFD data stores should connect to at least one process.',
        related: { nodeIds: [node.id], edgeIds: [], zoneIds: [] },
        recommendations: ['Connect the data store to a process that reads or writes it.'],
        ruleId: 'DFD-004'
      });
    }
  }

  // DFD-005: Unconnected node.
  for (const node of nodes) {
    if (isSecurityZoneNode(node) || node.type === 'dfdTrustBoundary' || ignoredNodeTypes.has(node.type)) continue;
    const connections = (inbound[node.id] || []).length + (outbound[node.id] || []).length;
    if (connections === 0) {
      addFinding(findings, {
        category: 'dfd',
        title: 'Unconnected element',
        description: 'This element is not connected to any data flow.',
        related: { nodeIds: [node.id], edgeIds: [], zoneIds: [] },
        recommendations: ['Connect the element or remove it if it is not part of the model.'],
        ruleId: 'DFD-005'
      });
    }
  }

  // DFD-006: DFD nodes missing specific type annotations.
  for (const node of nodes) {
    if (node.type === 'dfdActor') {
      const actorType = (node.data as any)?.actorType as string | undefined;
      if (!actorType) {
        addFinding(findings, {
          category: 'dfd',
          title: 'DFD actor missing type',
          description: 'DFD actors should specify what kind of external entity they represent.',
          related: { nodeIds: [node.id], edgeIds: [], zoneIds: [] },
          recommendations: ['Set an Actor Type (e.g., user, partner, system).'],
          ruleId: 'DFD-006'
        });
      }
    }
    if (node.type === 'dfdProcess') {
      const processType = (node.data as any)?.processType as string | undefined;
      if (!processType) {
        addFinding(findings, {
          category: 'dfd',
          title: 'DFD process missing type',
          description: 'DFD processes should specify what kind of processing they perform.',
          related: { nodeIds: [node.id], edgeIds: [], zoneIds: [] },
          recommendations: ['Set a Process Type (e.g., auth service, transformer, API handler).'],
          ruleId: 'DFD-006'
        });
      }
    }
    if (node.type === 'dfdDataStore') {
      const storeType = (node.data as any)?.storeType as string | undefined;
      if (!storeType) {
        addFinding(findings, {
          category: 'dfd',
          title: 'DFD data store missing type',
          description: 'DFD data stores should specify the kind of data they store.',
          related: { nodeIds: [node.id], edgeIds: [], zoneIds: [] },
          recommendations: ['Set a Storage Type (e.g., user database, logs, cache).'],
          ruleId: 'DFD-006'
        });
      }
    }
  }

  // TB-003: Trust boundary missing type.
  for (const node of nodes) {
    if (node.type !== 'dfdTrustBoundary') continue;
    const boundaryType = (node.data as any)?.boundaryType as string | undefined;
    if (!boundaryType) {
      addFinding(findings, {
        category: 'boundary',
        title: 'Trust boundary missing type',
        description: 'Trust boundaries should describe the boundary they represent.',
        related: { nodeIds: [node.id], edgeIds: [], zoneIds: [] },
        recommendations: ['Specify a boundary type (e.g., Internet, DMZ, container boundary).'],
        ruleId: 'TB-003'
      });
    }
  }

  // Pass 2.5 — Node-type contextual STRIDE hints (one finding per node, type-driven only).
  const dfdStructuralTypes = new Set(['dfdActor', 'dfdProcess', 'dfdDataStore', 'dfdTrustBoundary', 'securityZone']);
  for (const node of nodes) {
    if (isSecurityZoneNode(node) || ignoredNodeTypes.has(node.type) || dfdStructuralTypes.has(node.type ?? '')) continue;
    const dfdCat = getDFDCategory(node);
    const hint =
      nodeTypeContextHints[node.type ?? ''] ??
      (dfdCat ? nodeTypeContextHints[dfdCat] : undefined);
    if (!hint) continue;
    addFinding(findings, {
      category: 'threat',
      ruleId: hint.ruleId,
      title: hint.title,
      description: hint.description,
      strideCategories: hint.strideCategories,
      recommendations: hint.recommendations,
      related: { nodeIds: [node.id], edgeIds: [], zoneIds: [] },
      mitigationStatus: 'not_addressed',
    });
  }

  // Architecture threat patterns for non-DFD nodes.
  for (const node of nodes) {
    if (isSecurityZoneNode(node) || ignoredNodeTypes.has(node.type)) continue;
    if (getDFDCategory(node)) continue;
    const patterns = matchThreatPatternsForNode(node);
    if (patterns.length === 0) continue;

    const classification = (node.data as any)?.dataClassification as DataClassification | undefined;
    for (const pattern of patterns) {
      addFinding(findings, {
        category: 'threat',
        title: pattern.name,
        description: [
          pattern.description,
          ...buildRiskDetails(pattern, classification)
        ].filter(Boolean).join('\n'),
        related: { nodeIds: [node.id], edgeIds: [], zoneIds: [] },
        recommendations: pattern.mitigations && pattern.mitigations.length > 0
          ? pattern.mitigations
          : ['Review security controls for this component and apply least-privilege access.'],
        ruleId: pattern.id
      });
    }
  }

  // Trust boundary and encryption checks.
  for (const edge of edges) {
    const source = nodeById.get(edge.source);
    const target = nodeById.get(edge.target);
    if (!source || !target) continue;
    const sourceZone = getNodeZone(source);
    const targetZone = getNodeZone(target);
    const crossesZone = sourceZone && targetZone && sourceZone !== targetZone;
    const protocol = (edge.data as any)?.protocol;
    const encryption = (edge.data as any)?.encryption;
    const edgeZone = (edge.data as any)?.zone as SecurityZone | undefined;
    const edgeControls = (edge.data as any)?.securityControls as string[] | undefined;
    const edgeSignals = [...(edgeControls || []), ...getEdgeTextValues(edge)];
    const sourceCategory = getDFDCategory(source);
    const targetCategory = getDFDCategory(target);
    const isDFDFlow = !!(sourceCategory && targetCategory);
    const sourceRank = sourceZone ? trustRank[sourceZone] ?? 0 : 0;
    const targetRank = targetZone ? trustRank[targetZone] ?? 0 : 0;
    const isLowToHigh = sourceZone && targetZone ? sourceRank < targetRank : false;

    if (crossesZone && (!protocol || !encryption)) {
      addFinding(findings, {
        category: 'boundary',
        title: 'Cross-zone flow missing protocol or encryption',
        description: 'Crossing trust boundaries should specify protocol and encryption.',
        related: { nodeIds: [source.id, target.id], edgeIds: [edge.id], zoneIds: [] },
        recommendations: ['Specify the protocol and encryption used for this flow.'],
        ruleId: 'TB-001'
      });
    }

    if (!isDFDFlow && sourceZone && targetZone) {
      const sourceIsLowTrust = lowTrustZones.has(sourceZone);
      const targetIsHighTrust = highTrustZones.has(targetZone);
      if (sourceIsLowTrust && targetIsHighTrust) {
        const controlText = (edgeControls || []).join(' ').toLowerCase();
        const hasTrafficProtection = [
          'waf', 'rate', 'rate limit', 'ddos', 'bot', 'api gateway', 'gateway', 'shield', 'front door', 'cdn'
        ].some(keyword => controlText.includes(keyword));

        if (!hasTrafficProtection) {
          addFinding(findings, {
            category: 'threat',
            title: 'Public entrypoint lacks traffic protections',
            description: [
              'Inbound traffic from untrusted zones lacks explicit rate limiting or application-layer protection.',
              'Risk Level: Medium (6)'
            ].join('\n'),
            related: { nodeIds: [source.id, target.id], edgeIds: [edge.id], zoneIds: [] },
            recommendations: [
              'Add WAF or API gateway protections.',
              'Enable rate limiting and bot mitigation.',
              'Apply DDoS protection for public entrypoints.'
            ],
            ruleId: 'ARC-EDGE-001'
          });
        }
      }
    }

    if (crossesZone && isLowToHigh && !hasAuth(edge, source, target)) {
      addFinding(findings, {
        category: 'identity',
        title: 'Cross-zone flow missing authentication',
        description: 'Flows from lower-trust zones into higher-trust zones should specify authentication.',
        related: { nodeIds: [source.id, target.id], edgeIds: [edge.id], zoneIds: [] },
        recommendations: ['Define authentication requirements for this flow.'],
        ruleId: 'TB-002'
      });
    }

    if (crossesZone && isLowToHigh && hasAuth(edge, source, target) && !hasAuthorization(edge, source, target)) {
      addFinding(findings, {
        category: 'identity',
        title: 'Cross-zone flow missing authorization control',
        description: 'Authenticated flows into higher-trust zones should specify authorization or access control.',
        related: { nodeIds: [source.id, target.id], edgeIds: [edge.id], zoneIds: [] },
        recommendations: [
          'Define authorization controls such as RBAC, ABAC, or scoped tokens.',
          'Document permission checks and enforcement points.'
        ],
        ruleId: 'IA-002'
      });
    }

    if (crossesZone && isLowToHigh && hasAuth(edge, source, target) && !hasMfa(target)) {
      addFinding(findings, {
        category: 'identity',
        title: 'Privileged access missing MFA',
        description: 'Privileged or high-trust components should require MFA or step-up authentication.',
        related: { nodeIds: [target.id], edgeIds: [edge.id], zoneIds: [] },
        recommendations: [
          'Require MFA for access to privileged components.',
          'Add step-up authentication for sensitive operations.'
        ],
        ruleId: 'IA-003'
      });
    }

    const classification = getClassification(edge, source, target);
    if (classification && dataClassRank[classification] >= dataClassRank.Sensitive) {
      if (!encryption && !hasKeyword(edgeSignals, encryptionKeywords)) {
        addFinding(findings, {
          category: 'encryption',
          title: 'Sensitive data flow lacks encryption',
          description: 'Flows carrying sensitive data should be encrypted in transit.',
          related: { nodeIds: [source.id, target.id], edgeIds: [edge.id], zoneIds: [] },
          recommendations: ['Specify encryption such as TLS or mTLS for this flow.'],
          ruleId: 'DP-001'
        });
      }

      if (!hasKeyword(edgeSignals, loggingKeywords)) {
        addFinding(findings, {
          category: 'logging',
          title: 'Sensitive data flow lacks monitoring',
          description: 'Sensitive data flows should have logging or monitoring controls.',
          related: { nodeIds: [source.id, target.id], edgeIds: [edge.id], zoneIds: [] },
          recommendations: ['Add logging, monitoring, or SIEM controls for this flow.'],
          ruleId: 'DP-003'
        });
      }
    }

    if (crossesZone && isLowToHigh && isLikelyApplicationNode(target) && !hasInputValidation(edge, target)) {
      addFinding(findings, {
        category: 'threat',
        title: 'External-facing component missing input validation controls',
        description: 'External-facing application flows should specify input validation or sanitization controls.',
        related: { nodeIds: [source.id, target.id], edgeIds: [edge.id], zoneIds: [] },
        recommendations: [
          'Add input validation and sanitization controls for this flow.',
          'Document parameterized queries or request filtering (WAF) where applicable.'
        ],
        ruleId: 'OWASP-A03-001'
      });
    }

    if (crossesZone && isLowToHigh && protocol && String(protocol).toLowerCase().includes('http') &&
        sourceZone && targetZone && !lowTrustZones.has(targetZone) && !hasEgressControl(edge, source)) {
      addFinding(findings, {
        category: 'threat',
        title: 'Potential SSRF path without egress controls',
        description: 'Outbound HTTP/S flows from externally reachable components to internal services should enforce egress controls.',
        related: { nodeIds: [source.id, target.id], edgeIds: [edge.id], zoneIds: [] },
        recommendations: [
          'Implement egress allowlists or proxy enforcement.',
          'Restrict access to internal metadata endpoints.'
        ],
        ruleId: 'OWASP-A10-001'
      });
    }

    if (protocol && /tcp|udp/i.test(String(protocol)) && !(edge.data as any)?.portRange) {
      addFinding(findings, {
        category: 'configuration',
        title: 'Flow missing port range for TCP/UDP',
        description: 'TCP/UDP flows should specify port ranges to clarify exposure and filtering needs.',
        related: { nodeIds: [source.id, target.id], edgeIds: [edge.id], zoneIds: [] },
        recommendations: ['Specify the port range for this connection.'],
        ruleId: 'OWASP-A05-002'
      });
    }

    const redundancy = (edge.data as any)?.redundancy as boolean | undefined;
    const bandwidth = (edge.data as any)?.bandwidth as string | undefined;
    const latency = (edge.data as any)?.latency as string | undefined;
    const isCriticalFlow = classification
      ? dataClassRank[classification] >= dataClassRank.Sensitive
      : !!(bandwidth || latency);
    if (isCriticalFlow && (redundancy === false || redundancy === undefined)) {
      addFinding(findings, {
        category: 'availability',
        title: 'Sensitive flow missing redundancy',
        description: 'Sensitive data flows should document redundancy or failover expectations.',
        related: { nodeIds: [source.id, target.id], edgeIds: [edge.id], zoneIds: [] },
        recommendations: [
          'Document redundant paths or failover strategies.',
          'Use load balancing or alternate routes for critical flows.'
        ],
        ruleId: 'AR-EDGE-001'
      });
    }

    if (edgeZone && sourceZone && targetZone && edgeZone !== sourceZone && edgeZone !== targetZone) {
      addFinding(findings, {
        category: 'configuration',
        title: 'Flow zone does not match connected nodes',
        description: 'Flow zone annotations should match the source or target zone to avoid misclassification.',
        related: { nodeIds: [source.id, target.id], edgeIds: [edge.id], zoneIds: [] },
        recommendations: [
          'Align the flow zone with the source or target zone.',
          'Update node zones if the boundary assignment has changed.'
        ],
        ruleId: 'OWASP-A05-003'
      });
    }
  }

  // Data at rest protection.
  for (const node of nodes) {
    if (isSecurityZoneNode(node)) continue;
    const category = getDFDCategory(node);
    if (category !== 'dataStore') continue;
    const classification = (node.data as any)?.dataClassification as DataClassification | undefined;
    if (classification && dataClassRank[classification] >= dataClassRank.Sensitive) {
      const controls = (node.data as any)?.securityControls as string[] | undefined;
      const controlSignals = [...(controls || []), ...getNodeControlValues(node)];
      if (!hasKeyword(controlSignals, encryptionKeywords)) {
        addFinding(findings, {
          category: 'encryption',
          title: 'Sensitive data store lacks encryption control',
          description: 'Data stores containing sensitive data should be protected with encryption controls.',
          related: { nodeIds: [node.id], edgeIds: [], zoneIds: [] },
          recommendations: ['Add encryption controls such as KMS, HSM, or disk encryption.'],
          ruleId: 'DP-002'
        });
      }
    }
  }

  // Availability and misconfiguration checks.
  for (const node of nodes) {
    if (isSecurityZoneNode(node) || node.type === 'dfdTrustBoundary' || ignoredNodeTypes.has(node.type)) continue;
    const nodeZone = getNodeZone(node);
    const nodeControls = (node.data as any)?.securityControls as string[] | undefined;
    const inboundEdges = inbound[node.id] || [];
    const hasInboundFromLowTrust = inboundEdges.some(edge => {
      const source = nodeById.get(edge.source);
      const sourceZone = source ? getNodeZone(source) : undefined;
      return sourceZone ? lowTrustZones.has(sourceZone) : false;
    });

    if ((hasInboundFromLowTrust || (nodeZone && lowTrustZones.has(nodeZone))) && !nodeControls?.length) {
      addFinding(findings, {
        category: 'configuration',
        title: 'Exposed component missing security controls',
        description: 'Externally reachable components should list baseline security controls.',
        related: { nodeIds: [node.id], edgeIds: [], zoneIds: [] },
        recommendations: [
          'Document security controls such as WAF, rate limiting, and authentication.',
          'Add monitoring and alerting for exposed services.'
        ],
        ruleId: 'OWASP-A05-001'
      });
    }

    const data = node.data as any;
    const hasVersionInfo = !!(data?.version || data?.patchLevel || data?.lastUpdated);
    if (!hasVersionInfo && (data?.vendor || data?.technology)) {
      addFinding(findings, {
        category: 'configuration',
        title: 'Component missing version or patch metadata',
        description: 'Components should record version or patch levels to assess exposure to known vulnerabilities.',
        related: { nodeIds: [node.id], edgeIds: [], zoneIds: [] },
        recommendations: [
          'Add version, patch level, or last updated metadata.',
          'Track CVE exposure for this component.'
        ],
        ruleId: 'OWASP-A06-001'
      });
    }

    if (isSupplyChainNode(node) && !hasIntegrityControl(node)) {
      addFinding(findings, {
        category: 'configuration',
        title: 'Supply chain component missing integrity controls',
        description: 'Software supply chain components should use integrity controls like signing, checksums, or provenance.',
        related: { nodeIds: [node.id], edgeIds: [], zoneIds: [] },
        recommendations: [
          'Enable artifact signing or checksums.',
          'Adopt SBOM and provenance checks in the pipeline.'
        ],
        ruleId: 'OWASP-A08-001'
      });
    }

    const connectionCount = (inbound[node.id] || []).length + (outbound[node.id] || []).length;
    if (connectionCount >= 6 && !hasRedundancyControl(node)) {
      addFinding(findings, {
        category: 'availability',
        title: 'Potential single point of failure',
        description: 'Highly connected components should document redundancy or failover controls.',
        related: { nodeIds: [node.id], edgeIds: [], zoneIds: [] },
        recommendations: [
          'Add redundancy, failover, or clustering controls.',
          'Document load balancing or replication strategies.'
        ],
        ruleId: 'AR-001'
      });
    }

    const components = (node.data as any)?.components as Array<{ name: string; version: string }> | undefined;
    if (components && components.some(component => component.name && !component.version)) {
      addFinding(findings, {
        category: 'configuration',
        title: 'Component list missing versions',
        description: 'All listed components should include version information to assess known vulnerabilities.',
        related: { nodeIds: [node.id], edgeIds: [], zoneIds: [] },
        recommendations: [
          'Add version data for each listed component.',
          'Use SBOM tooling to track component versions.'
        ],
        ruleId: 'OWASP-A06-002'
      });
    }
  }

  // Zone data classification check.
  for (const zone of zones) {
    const zoneType = (zone.data as any)?.zoneType as SecurityZone | undefined;
    if (!zoneType) continue;
    const zoneId = zone.id;
    const zoneNodes = nodes.filter(node => getNodeZone(node) === zoneType && node.id !== zoneId);
    const hasSensitive = zoneNodes.some(node => {
      const classification = (node.data as any)?.dataClassification as DataClassification | undefined;
      return classification && dataClassRank[classification] >= dataClassRank.Sensitive;
    });
    const zoneClassification = (zone.data as any)?.dataClassification as DataClassification | undefined;
    if (hasSensitive && !zoneClassification) {
      addFinding(findings, {
        category: 'data',
        title: 'Zone contains sensitive data without classification',
        description: 'Zones containing sensitive elements should declare a data classification level.',
        related: { nodeIds: [], edgeIds: [], zoneIds: [zoneId] },
        recommendations: ['Set a data classification for the zone.'],
        ruleId: 'TB-004'
      });
    }
  }

  // AP-001: Attack path step crosses trust boundary without auth.
  if (attackPaths && attackPaths.length > 0) {
    for (const path of attackPaths) {
      for (const step of path.steps) {
        const edge = edgeById.get(step.edgeId);
        if (!edge) continue;
        const source = nodeById.get(step.sourceNodeId);
        const target = nodeById.get(step.targetNodeId);
        if (!source || !target) continue;
        const sourceZone = getNodeZone(source);
        const targetZone = getNodeZone(target);
        if (sourceZone && targetZone && sourceZone !== targetZone) {
          const sourceRank = trustRank[sourceZone] ?? 3;
          const targetRank = trustRank[targetZone] ?? 3;
          if (targetRank > sourceRank && !hasAuth(edge, source, target)) {
            addFinding(findings, {
              category: 'attackpath',
              title: 'Attack path crosses trust boundary without authentication',
              description: `Step in "${path.name}" crosses from ${sourceZone} to ${targetZone} without authentication controls.`,
              related: { nodeIds: [source.id, target.id], edgeIds: [edge.id], zoneIds: [] },
              recommendations: [
                'Add authentication controls on this boundary crossing.',
                'Consider mTLS, OAuth, or API key validation.'
              ],
              ruleId: 'AP-001',
              attackPathId: path.id,
              strideCategories: ['Spoofing', 'Elevation of Privilege']
            });
          }
        }
      }
    }

    // AP-002: Attack path carries sensitive data without encryption.
    for (const path of attackPaths) {
      for (const step of path.steps) {
        const edge = edgeById.get(step.edgeId);
        if (!edge) continue;
        const source = nodeById.get(step.sourceNodeId);
        const target = nodeById.get(step.targetNodeId);
        const classification = getClassification(edge, source, target);
        if (classification && dataClassRank[classification] >= dataClassRank.Sensitive) {
          const edgeValues = getEdgeTextValues(edge);
          const edgeControls = (edge.data as any)?.securityControls as string[] | undefined;
          if (!hasKeyword([...edgeValues, ...(edgeControls || [])], encryptionKeywords)) {
            addFinding(findings, {
              category: 'attackpath',
              title: 'Attack path carries sensitive data without encryption',
              description: `Step in "${path.name}" transmits ${classification} data without encryption controls.`,
              related: { nodeIds: [step.sourceNodeId, step.targetNodeId], edgeIds: [edge.id], zoneIds: [] },
              recommendations: [
                'Use TLS or mTLS for sensitive data flows.',
                'Document encryption and key management controls.'
              ],
              ruleId: 'AP-002',
              attackPathId: path.id,
              strideCategories: ['Information Disclosure', 'Tampering']
            });
          }
        }
      }
    }

    // AP-003: Attack path targets internal resource from external zone.
    for (const path of attackPaths) {
      for (const step of path.steps) {
        const source = nodeById.get(step.sourceNodeId);
        const target = nodeById.get(step.targetNodeId);
        if (!source || !target) continue;
        const sourceZone = getNodeZone(source);
        const targetZone = getNodeZone(target);
        if (sourceZone && targetZone && lowTrustZones.has(sourceZone) && highTrustZones.has(targetZone)) {
          const edge = edgeById.get(step.edgeId);
          if (!edge) continue;
          if (!hasInputValidation(edge, target)) {
            addFinding(findings, {
              category: 'attackpath',
              title: 'Attack path targets internal resource from external zone without validation',
              description: `Step in "${path.name}" goes from ${sourceZone} to ${targetZone} without input validation.`,
              related: { nodeIds: [source.id, target.id], edgeIds: [edge.id], zoneIds: [] },
              recommendations: [
                'Add input validation and sanitization at the boundary.',
                'Apply WAF or API gateway protections.'
              ],
              ruleId: 'AP-003',
              attackPathId: path.id,
              strideCategories: ['Tampering', 'Elevation of Privilege']
            });
          }
        }
      }
    }
  }

  const index = buildIndex(findings);
  return { findings, index };
};

export const prepareManualAnalysisInputs = (
  nodes: SecurityNode[],
  edges: SecurityEdge[],
  attackPaths?: DiagramAttackPath[]
): ManualAnalysisInputs => {
  const zones = nodes.filter(node => isSecurityZoneNode(node));
  return { nodes, edges, zones, attackPaths };
};
