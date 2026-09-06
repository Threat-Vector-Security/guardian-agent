import React, { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  InputLabel,
  IconButton,
  LinearProgress,
  MenuItem,
  Select,
  Tab,
  Tabs,
  Autocomplete,
  TextField,
  Tooltip,
  Typography
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import type { ManualFinding, MitigationStatus, StrideApplicability, StrideElementOverride, ThreatModelUserState } from '../types/ManualAnalysisTypes';
import type { DiagramAttackPath } from '../types/GrcTypes';
import type { StrideCategory } from '../types/ThreatIntelTypes';
import type { SecurityEdge, SecurityNode, SecurityNodeType, DataClassification, DFDCategory, SecurityZone } from '../types/SecurityTypes';
import { isSecurityZoneNode } from '../types/SecurityTypes';
import { nodeToDFDCategory } from '../utils/dfdCategoryMappings';
import { materialIconMappings } from '../utils/materialIconMappings';
import { deserializeIcon } from '../utils/iconSerialization';
import { useManualAnalysis } from '../contexts/ManualAnalysisContext';
import { manualRuleCatalog, type ManualRuleDetails } from '../data/manualRuleCatalog';
import { getThreatPatternById, threatPatternLibrary } from '../data/manualThreatLibrary';
import { STRIDE_CATEGORIES, STRIDE_SHORT, STRIDE_COLORS, RISK_LEVEL_COLORS, STRIDE_DETAILS, PASTA_STAGES } from '../utils/attackPathUtils';
import DescriptionIcon from '@mui/icons-material/Description';
import LanguageIcon from '@mui/icons-material/Language';
import { downloadHtmlFile, downloadTextFile } from '../utils/exportUtils';

interface ManualFindingsWindowProps {
  findings: ManualFinding[];
  nodes?: SecurityNode[];
  edges?: SecurityEdge[];
  systemName?: string;
  onFocusNode?: (nodeId: string) => void;
  onFocusEdge?: (edgeId: string) => void;
  onFocusZone?: (zoneId: string) => void;
  selectedEntry?: { id: string; type: 'node' | 'edge' } | null;
  onSelectedEntryChange?: (entry: { id: string; type: 'node' | 'edge' } | null) => void;
  attackPaths?: DiagramAttackPath[];
  threatModelUserState?: ThreatModelUserState;
  onMitigationChange?: (findingId: string, status: MitigationStatus, notes?: string) => void;
  onStrideOverrideChange?: (override: StrideElementOverride) => void;
}

type WorkbenchTab = 'findings' | 'stride' | 'attackpaths' | 'methodology';

const MITIGATION_OPTIONS: { value: MitigationStatus; label: string; color: string }[] = [
  { value: 'not_addressed', label: 'Not Addressed', color: '#ef4444' },
  { value: 'in_progress', label: 'In Progress', color: '#f59e0b' },
  { value: 'mitigated', label: 'Mitigated', color: '#22c55e' },
  { value: 'accepted', label: 'Accepted', color: '#3b82f6' },
  { value: 'transferred', label: 'Transferred', color: '#8b5cf6' }
];

const STRIDE_OVERRIDE_OPTIONS: { value: StrideApplicability; label: string }[] = [
  { value: 'applicable', label: 'Applicable' },
  { value: 'not_applicable', label: 'N/A' },
  { value: 'mitigated', label: 'Mitigated' },
  { value: 'accepted', label: 'Accepted' }
];

const getDFDCategoryForNode = (node: SecurityNode): DFDCategory | null => {
  const explicit = (node.data as any)?.dfdCategory as DFDCategory | undefined;
  if (explicit) return explicit;
  if (node.type === 'dfdActor') return 'actor';
  if (node.type === 'dfdProcess') return 'process';
  if (node.type === 'dfdDataStore') return 'dataStore';
  if (node.type === 'dfdTrustBoundary') return 'trustBoundary';
  return nodeToDFDCategory[node.type as keyof typeof nodeToDFDCategory] || null;
};

const STRIDE_APPLICABILITY: Record<string, StrideCategory[]> = {
  process: ['Spoofing', 'Tampering', 'Repudiation', 'Information Disclosure', 'Denial of Service', 'Elevation of Privilege'],
  dataStore: ['Tampering', 'Information Disclosure', 'Denial of Service'],
  actor: ['Spoofing', 'Repudiation', 'Elevation of Privilege'],
  dataFlow: ['Tampering', 'Information Disclosure', 'Denial of Service']
};

type TabEntry = {
  id: string;
  type: 'node' | 'edge';
  label: string;
  subLabel?: string;
  icon?: React.ElementType | null;
  findings: ManualFinding[];
  node?: SecurityNode;
  edge?: SecurityEdge;
};

const getNodeLabel = (node?: SecurityNode): string => {
  if (!node) return 'Unknown Node';
  return (node.data as any)?.label || node.id;
};

const getNodeIndexCode = (node?: SecurityNode): string | undefined =>
  (node?.data as any)?.indexCode || node?.id;

const getNodeZone = (node?: SecurityNode): SecurityZone | undefined => {
  if (!node) return undefined;
  if (isSecurityZoneNode(node)) {
    return (node.data as any)?.zoneType as SecurityZone | undefined;
  }
  return (node.data as any)?.zone as SecurityZone | undefined;
};

const getEdgeClassification = (edge?: SecurityEdge, source?: SecurityNode, target?: SecurityNode): DataClassification | undefined => {
  const edgeClass = (edge?.data as any)?.dataClassification as DataClassification | undefined;
  if (edgeClass) return edgeClass;
  const sourceClass = (source?.data as any)?.dataClassification as DataClassification | undefined;
  const targetClass = (target?.data as any)?.dataClassification as DataClassification | undefined;
  return sourceClass || targetClass;
};

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const buildThreatRuleDetails = (ruleId: string, fallbackFixes: string[]): ManualRuleDetails | null => {
  const pattern = getThreatPatternById(ruleId);
  if (!pattern) return null;

  const severity = pattern.severity?.toUpperCase() || 'MEDIUM';
  const likelihood = pattern.likelihood?.toUpperCase() || 'MEDIUM';
  const impact = pattern.impact?.toUpperCase() || 'MEDIUM';
  const whyDetails = [
    `Severity: ${severity}`,
    `Likelihood: ${likelihood}`,
    `Impact: ${impact}`
  ].join(' | ');

  return {
    id: pattern.id,
    title: pattern.name,
    summary: pattern.description,
    whyItMatters: `${whyDetails}. ${pattern.category ? `Category: ${pattern.category}.` : ''}`.trim(),
    conditions: [
      'Node metadata matches threat pattern keywords or target categories.'
    ],
    howToFix: pattern.mitigations && pattern.mitigations.length > 0 ? pattern.mitigations : fallbackFixes,
    dataSources: [
      'Node metadata: label, description, vendor, product, technology, category, index code',
      'Threat pattern keyword and target matching'
    ],
    frameworks: ['OWASP', 'STRIDE', 'MITRE'],
    references: {
      owasp: pattern.owaspCategories,
      stride: pattern.stride
    }
  };
};

const resolveFindingStrideCategories = (finding: ManualFinding): StrideCategory[] => {
  if (finding.strideCategories && finding.strideCategories.length > 0) {
    return finding.strideCategories;
  }
  const catalogStride = manualRuleCatalog[finding.ruleId]?.references?.stride as StrideCategory[] | undefined;
  if (catalogStride && catalogStride.length > 0) {
    return catalogStride;
  }
  const patternStride = getThreatPatternById(finding.ruleId)?.stride as StrideCategory[] | undefined;
  return patternStride || [];
};

const ManualFindingsWindow: React.FC<ManualFindingsWindowProps> = ({
  findings,
  nodes = [],
  edges = [],
  systemName = '',
  onFocusNode,
  onFocusEdge,
  onFocusZone,
  selectedEntry,
  onSelectedEntryChange,
  attackPaths = [],
  threatModelUserState,
  onMitigationChange,
  onStrideOverrideChange
}) => {
  const theme = useTheme();
  const { index } = useManualAnalysis();
  const nodeById = useMemo(() => new Map(nodes.map(node => [node.id, node])), [nodes]);
  const edgeById = useMemo(() => new Map(edges.map(edge => [edge.id, edge])), [edges]);
  const totalFindings = findings.length;
  const [isRuleCatalogOpen, setIsRuleCatalogOpen] = useState(false);

  const nodeFindingsById = useMemo(() => {
    const map = new Map<string, ManualFinding[]>();
    Object.entries(index.nodeFindings).forEach(([nodeId, nodeFindings]) => {
      map.set(nodeId, nodeFindings);
    });
    Object.entries(index.zoneFindings).forEach(([zoneId, zoneFindings]) => {
      if (map.has(zoneId)) {
        map.set(zoneId, [...(map.get(zoneId) || []), ...zoneFindings]);
      } else {
        map.set(zoneId, zoneFindings);
      }
    });
    return map;
  }, [index.nodeFindings, index.zoneFindings]);

  const getNodeIcon = (node?: SecurityNode): React.ElementType | null => {
    if (!node) return null;
    const iconValue = (node.data as any)?.icon;
    if (!iconValue) {
      return materialIconMappings[node.type as SecurityNodeType]?.icon || materialIconMappings.generic.icon;
    }
    if (typeof iconValue === 'function' ||
        (typeof iconValue === 'object' && iconValue !== null && (iconValue as any).$$typeof)) {
      return iconValue as React.ElementType;
    }
    return deserializeIcon(iconValue, node.type as SecurityNodeType);
  };

  const tabs = useMemo(() => {
    const nodeTabs: TabEntry[] = [];
    const edgeTabs: TabEntry[] = [];

    for (const node of nodes) {
      const nodeFindings = nodeFindingsById.get(node.id) || [];
      if (nodeFindings.length === 0) continue;
      const nodeLabel = getNodeLabel(node);
      nodeTabs.push({
        id: node.id,
        type: 'node',
        label: `${isSecurityZoneNode(node) ? 'Zone' : 'Node'}: ${nodeLabel}`,
        subLabel: getNodeIndexCode(node),
        icon: getNodeIcon(node),
        findings: nodeFindings,
        node
      });
    }

    for (const edge of edges) {
      const edgeFindings = index.edgeFindings[edge.id] || [];
      if (edgeFindings.length === 0) continue;
      const sourceLabel = getNodeLabel(nodeById.get(edge.source));
      const targetLabel = getNodeLabel(nodeById.get(edge.target));
      const edgeLabel = (edge.data as any)?.label as string | undefined;
      edgeTabs.push({
        id: edge.id,
        type: 'edge',
        label: `Edge: ${sourceLabel} -> ${targetLabel}`,
        subLabel: edgeLabel || (edge.data as any)?.indexCode || edge.id,
        findings: edgeFindings,
        edge
      });
    }

    nodeTabs.sort((a, b) => a.label.localeCompare(b.label));
    edgeTabs.sort((a, b) => a.label.localeCompare(b.label));
    return [...nodeTabs, ...edgeTabs];
  }, [nodes, edges, nodeFindingsById, index.edgeFindings, nodeById]);

  const searchOptions = useMemo(() => (
    tabs.map(tab => ({
      id: tab.id,
      type: tab.type,
      primary: tab.label,
      secondary: tab.subLabel
    }))
  ), [tabs]);

  const [activeTab, setActiveTab] = useState(0);
  const [workbenchTab, setWorkbenchTab] = useState<WorkbenchTab>('findings');
  const [expandedPathIds, setExpandedPathIds] = useState<Set<string>>(new Set());
  const [strideGuideCategory, setStrideGuideCategory] = useState<StrideCategory | null>(null);
  const [pastaExpandedStages, setPastaExpandedStages] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (activeTab >= tabs.length) {
      setActiveTab(0);
    }
  }, [activeTab, tabs.length]);

  useEffect(() => {
    if (!selectedEntry) return;
    const selectedIndex = tabs.findIndex(tab => tab.id === selectedEntry.id && tab.type === selectedEntry.type);
    if (selectedIndex >= 0 && selectedIndex !== activeTab) {
      setActiveTab(selectedIndex);
    }
  }, [selectedEntry, tabs, activeTab]);

  const mitigationByFinding = threatModelUserState?.mitigations || {};
  const strideOverridesByElement = useMemo(
    () => new Map((threatModelUserState?.strideOverrides || []).map(override => [override.elementId, override])),
    [threatModelUserState?.strideOverrides]
  );

  const getMitigationState = (finding: ManualFinding): { status: MitigationStatus; notes: string } => {
    const state = mitigationByFinding[finding.id];
    if (state) {
      return { status: state.status, notes: state.notes || '' };
    }
    return {
      status: finding.mitigationStatus || 'not_addressed',
      notes: finding.mitigationNotes || ''
    };
  };

  const handleMitigationStatusChange = (finding: ManualFinding, status: MitigationStatus) => {
    const current = getMitigationState(finding);
    onMitigationChange?.(finding.id, status, current.notes);
  };

  const handleMitigationNotesChange = (finding: ManualFinding, notes: string) => {
    const current = getMitigationState(finding);
    onMitigationChange?.(finding.id, current.status, notes);
  };

  const buildRuleDetails = (finding: ManualFinding): ManualRuleDetails | null =>
    manualRuleCatalog[finding.ruleId] || buildThreatRuleDetails(finding.ruleId, finding.recommendations);

  const getFindingStrideCategories = (finding: ManualFinding): StrideCategory[] => {
    return resolveFindingStrideCategories(finding);
  };

  const updateStrideOverride = (
    elementId: string,
    strideCategory: StrideCategory,
    nextValue: StrideApplicability
  ) => {
    const existing = strideOverridesByElement.get(elementId);
    const next: StrideElementOverride = {
      elementId,
      overrides: {
        ...(existing?.overrides || {}),
        [strideCategory]: nextValue
      }
    };
    onStrideOverrideChange?.(next);
  };

  const getRuleGroups = () => {
    const rules = Object.values(manualRuleCatalog);
    const owaspRules = rules
      .filter(rule => rule.id.startsWith('OWASP-'))
      .sort((a, b) => {
        const getNum = (id: string) => {
          const match = id.match(/A(\d+)/);
          return match ? Number(match[1]) : 99;
        };
        return getNum(a.id) - getNum(b.id) || a.id.localeCompare(b.id);
      });
    const groupByPrefix = (prefix: string) =>
      rules.filter(rule => rule.id.startsWith(prefix)).sort((a, b) => a.id.localeCompare(b.id));

    return [
      { title: 'OWASP Top 10 Checks', rules: owaspRules },
      { title: 'DFD Integrity Rules', rules: groupByPrefix('DFD-') },
      { title: 'Trust Boundary Rules', rules: groupByPrefix('TB-') },
      { title: 'Identity & Access Rules', rules: groupByPrefix('IA-') },
      { title: 'Data Protection Rules', rules: groupByPrefix('DP-') },
      { title: 'Availability & Resilience Rules', rules: rules.filter(rule => rule.id.startsWith('AR-')).sort((a, b) => a.id.localeCompare(b.id)) },
      { title: 'Architecture Rules', rules: groupByPrefix('ARC-') }
    ].filter(group => group.rules.length > 0);
  };

  const getStrideMappings = () => {
    const rules = Object.values(manualRuleCatalog);
    const categories = [
      'Spoofing',
      'Tampering',
      'Repudiation',
      'Information Disclosure',
      'Denial of Service',
      'Elevation of Privilege'
    ];
    return categories
      .map(category => ({
        category,
        rules: rules
          .filter(rule => rule.references?.stride?.includes(category))
          .map(rule => rule.id)
          .sort((a, b) => a.localeCompare(b))
      }))
      .filter(mapping => mapping.rules.length > 0);
  };

  const buildTriggerExplanation = (finding: ManualFinding): string[] => {
    const edge = finding.related.edgeIds[0] ? edgeById.get(finding.related.edgeIds[0]) : undefined;
    const source = edge ? nodeById.get(edge.source) : undefined;
    const target = edge ? nodeById.get(edge.target) : undefined;
    const edgeLabel = (edge?.data as any)?.label;
    const protocol = (edge?.data as any)?.protocol as string | undefined;
    const encryption = (edge?.data as any)?.encryption as string | undefined;
    const portRange = (edge?.data as any)?.portRange as string | undefined;
    const redundancy = (edge?.data as any)?.redundancy as boolean | undefined;
    const edgeZone = (edge?.data as any)?.zone as string | undefined;
    const edgeControls = (edge?.data as any)?.securityControls as string[] | undefined;
    const edgeDescription = (edge?.data as any)?.description as string | undefined;
    const sourceZone = getNodeZone(source);
    const targetZone = getNodeZone(target);
    const classification = getEdgeClassification(edge, source, target);

    const node = finding.related.nodeIds[0] ? nodeById.get(finding.related.nodeIds[0]) : undefined;
    const nodeControls = (node?.data as any)?.securityControls as string[] | undefined;
    const nodeAuth = (node?.data as any)?.accessControl?.authentication as string[] | undefined;
    const nodeAuthz = (node?.data as any)?.accessControl?.authorization as string[] | undefined;
    const nodeVersion = (node?.data as any)?.version as string | undefined;
    const nodePatch = (node?.data as any)?.patchLevel as string | undefined;
    const nodeVendor = (node?.data as any)?.vendor as string | undefined;
    const nodeTechnology = (node?.data as any)?.technology as string | undefined;
    const components = (node?.data as any)?.components as Array<{ name: string; version: string }> | undefined;

    switch (finding.ruleId) {
      case 'DFD-002':
        return [`Edge label is empty${edgeLabel ? ` (${edgeLabel})` : ''}.`];
      case 'DFD-003': {
        if (!node) return [];
        const inCount = edges.filter(e => e.target === node.id).length;
        const outCount = edges.filter(e => e.source === node.id).length;
        return [`Process has inbound=${inCount}, outbound=${outCount}.`];
      }
      case 'DFD-004':
        return ['Data store has no connected process nodes.'];
      case 'DFD-005':
        return ['No inbound or outbound edges connected.'];
      case 'DFD-006':
        return ['DFD element is missing its type field (actor/process/store).'];
      case 'TB-001':
        return [`Cross-zone flow missing protocol or encryption (protocol=${protocol || 'none'}, encryption=${encryption || 'none'}).`];
      case 'TB-002':
        return ['Authentication not found in edge controls or node access controls.'];
      case 'IA-002':
        return ['Authorization not found in edge controls or node access controls.'];
      case 'IA-003':
        return ['MFA or step-up authentication not indicated for target component.'];
      case 'TB-003':
        return ['Trust boundary missing boundary type metadata.'];
      case 'TB-004':
        return ['Zone contains sensitive nodes but zone classification is missing.'];
      case 'DP-001':
        return [`Sensitive flow lacks encryption (classification=${classification || 'unknown'}, encryption=${encryption || 'none'}).`];
      case 'DP-002':
        return ['Sensitive data store lacks encryption controls.'];
      case 'DP-003':
        return ['Sensitive flow lacks logging/monitoring controls.'];
      case 'OWASP-A03-001':
        return ['Input validation or sanitization controls not detected.'];
      case 'OWASP-A05-001':
        return ['Exposed component has no listed security controls.'];
      case 'OWASP-A05-002':
        return [`Protocol is ${protocol || 'unknown'} but port range is missing.`];
      case 'OWASP-A05-003':
        return [`Flow zone (${edgeZone || 'none'}) does not match source/target zones (${sourceZone || 'unknown'} -> ${targetZone || 'unknown'}).`];
      case 'OWASP-A06-001':
        return [`Vendor/technology set (${nodeVendor || nodeTechnology || 'unknown'}) but version/patch missing (version=${nodeVersion || 'none'}, patch=${nodePatch || 'none'}).`];
      case 'OWASP-A06-002': {
        const missing = components?.filter(component => component.name && !component.version).map(component => component.name) || [];
        return missing.length > 0 ? [`Components missing versions: ${missing.join(', ')}.`] : [];
      }
      case 'OWASP-A08-001':
        return ['Supply chain component lacks integrity controls (signing/SBOM/provenance).'];
      case 'OWASP-A10-001':
        return ['Potential SSRF path without egress controls.'];
      case 'AR-001':
        return ['Highly connected node lacks redundancy controls.'];
      case 'AR-EDGE-001':
        return [`Flow redundancy not specified (redundant=${redundancy === undefined ? 'unspecified' : redundancy ? 'yes' : 'no'}).`];
      case 'ARC-EDGE-001':
        return ['Inbound low-trust flow without traffic protection controls.'];
      default:
        return [
          edgeDescription ? `Edge description: ${edgeDescription}` : '',
          edgeControls && edgeControls.length > 0 ? `Edge controls: ${edgeControls.join(', ')}` : '',
          nodeControls && nodeControls.length > 0 ? `Node controls: ${nodeControls.join(', ')}` : '',
          nodeAuth && nodeAuth.length > 0 ? `Auth: ${nodeAuth.join(', ')}` : '',
          nodeAuthz && nodeAuthz.length > 0 ? `Authorization: ${nodeAuthz.join(', ')}` : ''
        ].filter(Boolean);
    }
  };

  const buildFindingContext = (finding: ManualFinding): string[] => {
    const lines: string[] = [];

    const nodeLines = finding.related.nodeIds
      .map(nodeId => nodeById.get(nodeId))
      .filter(Boolean)
      .map(node => {
        const nodeLabel = getNodeLabel(node);
        const nodeZone = getNodeZone(node);
        const classification = (node?.data as any)?.dataClassification as DataClassification | undefined;
        const nodeType = node?.type;
        const nodeIndex = getNodeIndexCode(node);
        const nodeProtocols = (node?.data as any)?.protocols as string[] | undefined;
        const vendor = (node?.data as any)?.vendor as string | undefined;
        const product = (node?.data as any)?.product as string | undefined;
        const version = (node?.data as any)?.version as string | undefined;
        const patchLevel = (node?.data as any)?.patchLevel as string | undefined;
        return `Node: ${nodeLabel} (${nodeIndex || nodeType || 'Unknown'})` +
          `${nodeZone ? ` | Zone: ${nodeZone}` : ''}` +
          `${classification ? ` | Data: ${classification}` : ''}` +
          `${nodeProtocols && nodeProtocols.length > 0 ? ` | Protocols: ${nodeProtocols.join(', ')}` : ''}` +
          `${vendor ? ` | Vendor: ${vendor}` : ''}` +
          `${product ? ` | Product: ${product}` : ''}` +
          `${version ? ` | Version: ${version}` : ''}` +
          `${patchLevel ? ` | Patch: ${patchLevel}` : ''}`;
      });

    const edgeLines = finding.related.edgeIds
      .map(edgeId => edgeById.get(edgeId))
      .filter(Boolean)
      .map(edge => {
        const source = nodeById.get(edge!.source);
        const target = nodeById.get(edge!.target);
        const sourceLabel = getNodeLabel(source);
        const targetLabel = getNodeLabel(target);
        const protocol = (edge?.data as any)?.protocol as string | undefined;
        const encryption = (edge?.data as any)?.encryption as string | undefined;
        const edgeZone = (edge?.data as any)?.zone as string | undefined;
        const portRange = (edge?.data as any)?.portRange as string | undefined;
        const bandwidth = (edge?.data as any)?.bandwidth as string | undefined;
        const latency = (edge?.data as any)?.latency as string | undefined;
        const redundancy = (edge?.data as any)?.redundancy as boolean | undefined;
        const classification = getEdgeClassification(edge, source, target);
        return `Edge: ${sourceLabel} -> ${targetLabel}` +
          `${protocol ? ` | Protocol: ${protocol}` : ''}` +
          `${encryption ? ` | Encryption: ${encryption}` : ''}` +
          `${portRange ? ` | Ports: ${portRange}` : ''}` +
          `${bandwidth ? ` | Bandwidth: ${bandwidth}` : ''}` +
          `${latency ? ` | Latency: ${latency}` : ''}` +
          `${edgeZone ? ` | Zone: ${edgeZone}` : ''}` +
          `${redundancy !== undefined ? ` | Redundant: ${redundancy ? 'Yes' : 'No'}` : ''}` +
          `${classification ? ` | Data: ${classification}` : ''}`;
      });

    const zoneLines = finding.related.zoneIds
      .map(zoneId => nodeById.get(zoneId))
      .filter(Boolean)
      .map(zone => {
        const zoneLabel = getNodeLabel(zone);
        const zoneType = (zone?.data as any)?.zoneType as string | undefined;
        const zoneClassification = (zone?.data as any)?.dataClassification as DataClassification | undefined;
        return `Zone: ${zoneLabel}` +
          `${zoneType ? ` | Type: ${zoneType}` : ''}` +
          `${zoneClassification ? ` | Data: ${zoneClassification}` : ''}`;
      });

    lines.push(...nodeLines, ...edgeLines, ...zoneLines);
    return lines;
  };

  const buildTabContext = (tab: TabEntry): string[] => {
    if (tab.type === 'node' && tab.node) {
      const nodeZone = getNodeZone(tab.node);
      const classification = (tab.node.data as any)?.dataClassification as DataClassification | undefined;
      const controls = (tab.node.data as any)?.securityControls as string[] | undefined;
      const dfdCategory = (tab.node.data as any)?.dfdCategory as string | undefined;
      const dfdType = (tab.node.data as any)?.dfdType as string | undefined;
      const protocols = (tab.node.data as any)?.protocols as string[] | undefined;
      const vendor = (tab.node.data as any)?.vendor as string | undefined;
      const product = (tab.node.data as any)?.product as string | undefined;
      const version = (tab.node.data as any)?.version as string | undefined;
      const patchLevel = (tab.node.data as any)?.patchLevel as string | undefined;
      const components = (tab.node.data as any)?.components as Array<{ name: string; version: string }> | undefined;
      const componentSummary = components && components.length > 0
        ? components.map(component => `${component.name}${component.version ? `:${component.version}` : ''}`).join(', ')
        : '';
      return [
        `Type: ${tab.node.type}`,
        nodeZone ? `Zone: ${nodeZone}` : '',
        classification ? `Data Classification: ${classification}` : '',
        dfdCategory ? `DFD Category: ${dfdCategory}` : '',
        dfdType ? `DFD Type: ${dfdType}` : '',
        protocols && protocols.length > 0 ? `Protocols: ${protocols.join(', ')}` : '',
        vendor ? `Vendor: ${vendor}` : '',
        product ? `Product: ${product}` : '',
        version ? `Version: ${version}` : '',
        patchLevel ? `Patch Level: ${patchLevel}` : '',
        componentSummary ? `Components: ${componentSummary}` : '',
        controls && controls.length > 0 ? `Controls: ${controls.join(', ')}` : ''
      ].filter(Boolean);
    }

    if (tab.type === 'edge' && tab.edge) {
      const source = nodeById.get(tab.edge.source);
      const target = nodeById.get(tab.edge.target);
      const protocol = (tab.edge.data as any)?.protocol as string | undefined;
      const encryption = (tab.edge.data as any)?.encryption as string | undefined;
      const portRange = (tab.edge.data as any)?.portRange as string | undefined;
      const bandwidth = (tab.edge.data as any)?.bandwidth as string | undefined;
      const latency = (tab.edge.data as any)?.latency as string | undefined;
      const redundancy = (tab.edge.data as any)?.redundancy as boolean | undefined;
      const edgeZone = (tab.edge.data as any)?.zone as string | undefined;
      const controls = (tab.edge.data as any)?.securityControls as string[] | undefined;
      const classification = getEdgeClassification(tab.edge, source, target);
      const sourceZone = getNodeZone(source);
      const targetZone = getNodeZone(target);
      return [
        `Flow: ${getNodeLabel(source)} -> ${getNodeLabel(target)}`,
        sourceZone || targetZone ? `Zones: ${sourceZone || 'Unknown'} -> ${targetZone || 'Unknown'}` : '',
        protocol ? `Protocol: ${protocol}` : '',
        encryption ? `Encryption: ${encryption}` : '',
        portRange ? `Ports: ${portRange}` : '',
        bandwidth ? `Bandwidth: ${bandwidth}` : '',
        latency ? `Latency: ${latency}` : '',
        edgeZone ? `Flow Zone: ${edgeZone}` : '',
        redundancy !== undefined ? `Redundant: ${redundancy ? 'Yes' : 'No'}` : '',
        classification ? `Data Classification: ${classification}` : '',
        controls && controls.length > 0 ? `Controls: ${controls.join(', ')}` : ''
      ].filter(Boolean);
    }

    return [];
  };

  type StrideMatrixRow = {
    elementId: string;
    elementKind: 'node' | 'edge';
    label: string;
    typeLabel: string;
    applicableCategories: StrideCategory[];
    findingsByCategory: Partial<Record<StrideCategory, ManualFinding[]>>;
  };

  const strideMatrixRows = useMemo(() => {
    const rows: StrideMatrixRow[] = [];

    nodes.forEach(node => {
      const dfdCategory = getDFDCategoryForNode(node);
      if (!dfdCategory || dfdCategory === 'trustBoundary') return;

      const nodeFindings = nodeFindingsById.get(node.id) || [];
      const applicableCategories = STRIDE_APPLICABILITY[dfdCategory] || [];
      const findingsByCategory: Partial<Record<StrideCategory, ManualFinding[]>> = {};

      STRIDE_CATEGORIES.forEach(category => {
        findingsByCategory[category] = nodeFindings.filter(finding =>
          getFindingStrideCategories(finding).includes(category)
        );
      });

      rows.push({
        elementId: node.id,
        elementKind: 'node',
        label: getNodeLabel(node),
        typeLabel: dfdCategory,
        applicableCategories,
        findingsByCategory
      });
    });

    edges.forEach(edge => {
      const source = nodeById.get(edge.source);
      const target = nodeById.get(edge.target);
      const edgeFindings = index.edgeFindings[edge.id] || [];
      const findingsByCategory: Partial<Record<StrideCategory, ManualFinding[]>> = {};

      STRIDE_CATEGORIES.forEach(category => {
        findingsByCategory[category] = edgeFindings.filter(finding =>
          getFindingStrideCategories(finding).includes(category)
        );
      });

      rows.push({
        elementId: edge.id,
        elementKind: 'edge',
        label: `${getNodeLabel(source)} -> ${getNodeLabel(target)}`,
        typeLabel: 'dataFlow',
        applicableCategories: STRIDE_APPLICABILITY.dataFlow || [],
        findingsByCategory
      });
    });

    return rows;
  }, [edges, index.edgeFindings, nodeById, nodeFindingsById, nodes]);

  const attackPathFindingsById = useMemo(() => {
    const map = new Map<string, ManualFinding[]>();
    findings
      .filter(finding => finding.category === 'attackpath' && finding.attackPathId)
      .forEach(finding => {
        const key = finding.attackPathId as string;
        map.set(key, [...(map.get(key) || []), finding]);
      });
    return map;
  }, [findings]);

  const dfdIntegrityFindingCount = findings.filter(finding => /^DFD-00[1-6]$/.test(finding.ruleId)).length;
  const zoneCount = nodes.filter(node => isSecurityZoneNode(node)).length;

  const getMatrixCellState = (row: StrideMatrixRow, category: StrideCategory): {
    status: StrideApplicability | 'in_progress';
    color: string;
    findingsCount: number;
  } => {
    const isApplicable = row.applicableCategories.includes(category);
    if (!isApplicable) {
      return { status: 'not_applicable', color: '#9ca3af', findingsCount: 0 };
    }

    const override = strideOverridesByElement.get(row.elementId)?.overrides?.[category];
    if (override) {
      if (override === 'mitigated' || override === 'accepted') {
        return { status: override, color: '#16a34a', findingsCount: (row.findingsByCategory[category] || []).length };
      }
      if (override === 'not_applicable') {
        return { status: override, color: '#9ca3af', findingsCount: (row.findingsByCategory[category] || []).length };
      }
      return { status: override, color: '#dc2626', findingsCount: (row.findingsByCategory[category] || []).length };
    }

    const relatedFindings = row.findingsByCategory[category] || [];
    if (relatedFindings.length === 0) {
      return { status: 'applicable', color: '#dc2626', findingsCount: 0 };
    }

    const statuses = relatedFindings.map(finding => getMitigationState(finding).status);
    const allClosed = statuses.every(status => status === 'mitigated' || status === 'accepted');
    if (allClosed) {
      const allAccepted = statuses.every(status => status === 'accepted');
      return {
        status: allAccepted ? 'accepted' : 'mitigated',
        color: '#16a34a',
        findingsCount: relatedFindings.length
      };
    }

    const anyInProgress = statuses.some(status => status === 'in_progress' || status === 'transferred');
    if (anyInProgress) {
      return { status: 'in_progress', color: '#f59e0b', findingsCount: relatedFindings.length };
    }

    return { status: 'applicable', color: '#dc2626', findingsCount: relatedFindings.length };
  };

  const strideMatrixSummary = useMemo(() => {
    let applicableCells = 0;
    let assessedCells = 0;
    strideMatrixRows.forEach(row => {
      STRIDE_CATEGORIES.forEach(category => {
        if (!row.applicableCategories.includes(category)) return;
        applicableCells += 1;
        const override = strideOverridesByElement.get(row.elementId)?.overrides?.[category];
        const findingsCount = (row.findingsByCategory[category] || []).length;
        if (override || findingsCount > 0) {
          assessedCells += 1;
        }
      });
    });
    return {
      applicableCells,
      assessedCells,
      assessedPercent: applicableCells === 0 ? 0 : Math.round((assessedCells / applicableCells) * 100)
    };
  }, [strideMatrixRows, strideOverridesByElement]);

  const findingsMitigatedCount = findings.filter(finding => {
    const status = getMitigationState(finding).status;
    return status !== 'not_addressed';
  }).length;

  const findingsValidatedCount = findings.filter(finding => {
    const status = getMitigationState(finding).status;
    return status === 'mitigated' || status === 'accepted';
  }).length;

  const strideMethodologySteps = useMemo(() => {
    const hasNodes = nodes.length > 0;
    const hasEdges = edges.length > 0;
    const hasZones = zoneCount > 0;
    const noDfdIntegrityGaps = dfdIntegrityFindingCount === 0;
    const step1Checks = [hasNodes, hasEdges, hasZones, noDfdIntegrityGaps];
    const step1Score = Math.round((step1Checks.filter(Boolean).length / step1Checks.length) * 100);
    const step3Score = findings.length === 0 ? 0 : Math.round((findingsMitigatedCount / findings.length) * 100);
    const step4Score = findings.length === 0 ? 0 : Math.round((findingsValidatedCount / findings.length) * 100);

    return [
      {
        title: '1. Diagram',
        percent: step1Score,
        detail: `Nodes: ${nodes.length}, Edges: ${edges.length}, Zones: ${zoneCount}, DFD integrity findings: ${dfdIntegrityFindingCount}`
      },
      {
        title: '2. Identify',
        percent: strideMatrixSummary.assessedPercent,
        detail: `Assessed STRIDE cells: ${strideMatrixSummary.assessedCells}/${strideMatrixSummary.applicableCells}, Findings: ${findings.length}`
      },
      {
        title: '3. Mitigate',
        percent: step3Score,
        detail: `Addressed findings: ${findingsMitigatedCount}/${findings.length}`
      },
      {
        title: '4. Validate',
        percent: step4Score,
        detail: `Mitigated or accepted findings: ${findingsValidatedCount}/${findings.length}`
      }
    ];
  }, [dfdIntegrityFindingCount, edges.length, findings.length, findingsMitigatedCount, findingsValidatedCount, nodes.length, strideMatrixSummary, zoneCount]);

  const pastaMethodologySteps = useMemo(() => {
    const hasThreatFindings = findings.length > 0;
    const hasThreatPatternFindings = findings.some(finding => finding.ruleId.startsWith('TM-') || finding.ruleId.startsWith('TP-'));
    const attackPathsDefined = attackPaths.length > 0;
    const riskLevelsAssigned = attackPaths.every(path => Boolean(path.riskLevel));
    const mitigationsSet = findingsMitigatedCount > 0;

    const steps = [
      {
        title: '1. Business Objectives',
        done: systemName.trim().length > 0 && nodes.length > 0,
        detail: `System name: ${systemName.trim().length > 0 ? 'set' : 'missing'}, nodes: ${nodes.length}.`
      },
      {
        title: '2. Technical Scope',
        done: nodes.length > 0 && edges.length > 0 && zoneCount > 0,
        detail: `Nodes/edges/zones present: ${nodes.length}/${edges.length}/${zoneCount}.`
      },
      {
        title: '3. Application Decomposition',
        done: dfdIntegrityFindingCount === 0,
        detail: dfdIntegrityFindingCount === 0 ? 'No DFD integrity findings.' : `${dfdIntegrityFindingCount} DFD integrity findings remain.`
      },
      {
        title: '4. Threat Analysis',
        done: hasThreatFindings && strideMatrixRows.length > 0,
        detail: `Findings: ${findings.length}, STRIDE rows: ${strideMatrixRows.length}.`
      },
      {
        title: '5. Vulnerability Analysis',
        done: hasThreatPatternFindings,
        detail: hasThreatPatternFindings ? 'Threat pattern findings are present.' : 'No TM-/TP- findings yet.'
      },
      {
        title: '6. Attack Modeling',
        done: attackPathsDefined,
        detail: `${attackPaths.length} attack path(s) defined.`
      },
      {
        title: '7. Risk/Impact Analysis',
        done: mitigationsSet && riskLevelsAssigned,
        detail: `Mitigations set: ${mitigationsSet ? 'yes' : 'no'}, risk levels assigned: ${riskLevelsAssigned ? 'yes' : 'no'}.`
      }
    ];

    return steps.map(step => ({
      ...step,
      percent: step.done ? 100 : 0
    }));
  }, [attackPaths, dfdIntegrityFindingCount, edges.length, findings, findingsMitigatedCount, nodes.length, strideMatrixRows.length, systemName, zoneCount]);

  const focusEntryFromMatrix = (row: StrideMatrixRow) => {
    const idx = tabs.findIndex(tab => tab.id === row.elementId && tab.type === row.elementKind);
    if (idx >= 0) {
      setActiveTab(idx);
    }
    onSelectedEntryChange?.({ id: row.elementId, type: row.elementKind });
    if (row.elementKind === 'node') {
      onFocusNode?.(row.elementId);
    } else {
      onFocusEdge?.(row.elementId);
    }
    setWorkbenchTab('findings');
  };

  const buildManualFindingsText = (): string => {
    const lines: string[] = [];
    lines.push('MANUAL RULE BASED FINDINGS REPORT');
    lines.push('================================');
    lines.push(`Generated: ${new Date().toLocaleString()}`);
    lines.push(`System: ${systemName || 'Unknown'}`);
    lines.push(`Total Findings: ${totalFindings}`);
    lines.push(`Attack Paths: ${attackPaths.length}`);
    lines.push('');

    tabs.forEach((tabEntry, idx) => {
      lines.push(`${idx + 1}. ${tabEntry.label}`);
      if (tabEntry.subLabel) {
        lines.push(`   Reference: ${tabEntry.subLabel}`);
      }
      const contextLines = buildTabContext(tabEntry);
      if (contextLines.length > 0) {
        lines.push('   Context:');
        contextLines.forEach(contextLine => lines.push(`     - ${contextLine}`));
      }
      lines.push(`   Findings (${tabEntry.findings.length}):`);
      tabEntry.findings.forEach((finding, findingIndex) => {
        const ruleDetails = buildRuleDetails(finding);
        const mitigation = getMitigationState(finding);
        lines.push(`     ${findingIndex + 1}) [${finding.ruleId}] ${finding.title}`);
        lines.push(`        Category: ${finding.category.toUpperCase()}`);
        lines.push(`        Detected: ${finding.description.replace(/\n/g, ' ')}`);
        lines.push(`        Mitigation: ${mitigation.status}`);
        if (mitigation.notes) {
          lines.push(`        Mitigation Notes: ${mitigation.notes}`);
        }
        if (ruleDetails) {
          lines.push(`        Rule: ${ruleDetails.summary}`);
          if (ruleDetails.conditions.length > 0) {
            lines.push('        Conditions:');
            ruleDetails.conditions.forEach((condition, conditionIndex) => lines.push(`          ${conditionIndex + 1}. ${condition}`));
          }
          lines.push(`        Why: ${ruleDetails.whyItMatters}`);
          if (ruleDetails.howToFix.length > 0) {
            lines.push('        How To Fix:');
            ruleDetails.howToFix.forEach((fix, fixIndex) => lines.push(`          ${fixIndex + 1}. ${fix}`));
          }
          if (ruleDetails.references?.owasp?.length) {
            lines.push(`        OWASP: ${ruleDetails.references.owasp.join(', ')}`);
          }
          if (ruleDetails.references?.stride?.length) {
            lines.push(`        STRIDE: ${ruleDetails.references.stride.join(', ')}`);
          }
        } else if (finding.recommendations.length > 0) {
          lines.push('        Recommendations:');
          finding.recommendations.forEach((rec, recIndex) => lines.push(`          ${recIndex + 1}. ${rec}`));
        }
        const triggeredBy = buildTriggerExplanation(finding);
        if (triggeredBy.length > 0) {
          lines.push('        Triggered By:');
          triggeredBy.forEach(reason => lines.push(`          - ${reason}`));
        }
        const context = buildFindingContext(finding);
        if (context.length > 0) {
          lines.push('        Diagram Context:');
          context.forEach(contextLine => lines.push(`          - ${contextLine}`));
        }
      });
      lines.push('');
    });

    lines.push('STRIDE MATRIX SUMMARY');
    lines.push('---------------------');
    lines.push(`Assessed Cells: ${strideMatrixSummary.assessedCells}/${strideMatrixSummary.applicableCells} (${strideMatrixSummary.assessedPercent}%)`);
    strideMatrixRows.forEach(row => {
      const cellSummary = STRIDE_CATEGORIES.map(category => {
        const cell = getMatrixCellState(row, category);
        return `${STRIDE_SHORT[category]}=${cell.status}${cell.findingsCount > 0 ? `(${cell.findingsCount})` : ''}`;
      }).join(' | ');
      lines.push(`${row.elementKind.toUpperCase()} ${row.label} [${row.typeLabel}] -> ${cellSummary}`);
    });
    lines.push('');

    lines.push('ATTACK PATHS');
    lines.push('------------');
    if (attackPaths.length === 0) {
      lines.push('No attack paths defined.');
    } else {
      attackPaths.forEach(path => {
        const relatedFindings = attackPathFindingsById.get(path.id) || [];
        const mitigated = relatedFindings.filter(finding => {
          const status = getMitigationState(finding).status;
          return status === 'mitigated' || status === 'accepted';
        }).length;
        lines.push(`${path.name} [${path.strideCategory}] [${path.riskLevel}]`);
        if (path.description) {
          lines.push(`  Description: ${path.description}`);
        }
        lines.push(`  Steps: ${path.steps.length}`);
        path.steps
          .slice()
          .sort((a, b) => a.order - b.order)
          .forEach(step => {
            lines.push(`    ${step.order}. ${getNodeLabel(nodeById.get(step.sourceNodeId))} -> ${getNodeLabel(nodeById.get(step.targetNodeId))}`);
          });
        lines.push(`  Related findings mitigated: ${mitigated}/${relatedFindings.length}`);
      });
    }
    lines.push('');

    lines.push('METHODOLOGY PROGRESS');
    lines.push('--------------------');
    lines.push('STRIDE 4-Step');
    strideMethodologySteps.forEach(step => {
      lines.push(`  ${step.title}: ${step.percent}%`);
      lines.push(`    ${step.detail}`);
    });
    lines.push('PASTA 7-Step');
    pastaMethodologySteps.forEach(step => {
      lines.push(`  ${step.title}: ${step.percent}%`);
      lines.push(`    ${step.detail}`);
    });
    lines.push('');

    const ruleGroups = getRuleGroups();
    const strideMappings = getStrideMappings();
    lines.push('RULE CHECKS (ORDERED)');
    lines.push('---------------------');
    ruleGroups.forEach(group => {
      lines.push(`${group.title}`);
      group.rules.forEach(rule => {
        lines.push(`  ${rule.id}: ${rule.title}`);
      });
    });

    lines.push('');
    lines.push('STRIDE RULE MAPPINGS');
    lines.push('--------------------');
    strideMappings.forEach(mapping => {
      lines.push(`${mapping.category}: ${mapping.rules.join(', ')}`);
    });

    lines.push('');
    lines.push('THREAT PATTERN MATCHING');
    lines.push('-----------------------');
    threatPatternLibrary.forEach(pattern => {
      lines.push(`${pattern.id}: ${pattern.name}`);
      lines.push(`  Description: ${pattern.description}`);
      if (pattern.matchKeywords?.length) {
        lines.push(`  Match Keywords: ${pattern.matchKeywords.join(', ')}`);
      }
      if (pattern.commonTargets?.length) {
        lines.push(`  Targets: ${pattern.commonTargets.join(', ')}`);
      }
    });

    return lines.join('\n');
  };

  const buildManualFindingsHtml = (): string => {
    const buildList = (items: string[]) => items.map(item => `<li>${escapeHtml(item)}</li>`).join('');
    let html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Manual Rule Based Findings - ${new Date().toISOString().split('T')[0]}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background: #f5f5f5; color: #222; }
    .container { max-width: 1100px; margin: 24px auto; padding: 32px; background: #fff; border-radius: 10px; box-shadow: 0 4px 16px rgba(0,0,0,0.08); }
    h1, h2, h3 { color: #1976d2; }
    h1 { border-bottom: 2px solid #1976d2; padding-bottom: 8px; }
    .meta { color: #555; margin-bottom: 24px; }
    .tab-card { border: 1px solid #e0e0e0; border-radius: 8px; padding: 16px; margin-bottom: 20px; background: #fafafa; }
    .finding-card { border-left: 4px solid #1976d2; background: #fff; padding: 12px 16px; margin-top: 12px; border-radius: 6px; }
    .context { color: #555; font-size: 14px; }
    .rule-list, .pattern-list { margin-top: 12px; }
    ul { padding-left: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Manual Rule Based Findings</h1>
    <div class="meta">Generated: ${escapeHtml(new Date().toLocaleString())} | System: ${escapeHtml(systemName || 'Unknown')} | Total Findings: ${totalFindings} | Attack Paths: ${attackPaths.length}</div>
`;

    tabs.forEach(tabEntry => {
      const contextLines = buildTabContext(tabEntry);
      html += `
    <div class="tab-card">
      <h2>${escapeHtml(tabEntry.label)}</h2>
      ${tabEntry.subLabel ? `<div class="context"><strong>Reference:</strong> ${escapeHtml(tabEntry.subLabel)}</div>` : ''}
      ${contextLines.length > 0 ? `<div class="context"><strong>Context:</strong><ul>${buildList(contextLines)}</ul></div>` : ''}
      <div><strong>Findings (${tabEntry.findings.length})</strong></div>
`;

      tabEntry.findings.forEach((finding) => {
        const ruleDetails = buildRuleDetails(finding);
        const context = buildFindingContext(finding);
        const mitigation = getMitigationState(finding);
        html += `
      <div class="finding-card">
        <h3>${escapeHtml(finding.title)} <small>(${escapeHtml(finding.ruleId)})</small></h3>
        <div class="context"><strong>Category:</strong> ${escapeHtml(finding.category.toUpperCase())}</div>
        <div class="context"><strong>Mitigation:</strong> ${escapeHtml(mitigation.status)}</div>
        ${mitigation.notes ? `<div class="context"><strong>Mitigation Notes:</strong> ${escapeHtml(mitigation.notes)}</div>` : ''}
        <p>${escapeHtml(finding.description).replace(/\n/g, '<br>')}</p>
`;
        if (ruleDetails) {
          html += `
        <div><strong>Rule:</strong> ${escapeHtml(ruleDetails.summary)}</div>
        ${ruleDetails.conditions.length > 0 ? `<div><strong>Conditions:</strong><ul>${buildList(ruleDetails.conditions)}</ul></div>` : ''}
        <div><strong>Why:</strong> ${escapeHtml(ruleDetails.whyItMatters)}</div>
        <div><strong>How To Fix:</strong><ol>${buildList(ruleDetails.howToFix)}</ol></div>
`;
          if (ruleDetails.references?.owasp?.length) {
            html += `<div class="context"><strong>OWASP:</strong> ${escapeHtml(ruleDetails.references.owasp.join(', '))}</div>`;
          }
          if (ruleDetails.references?.stride?.length) {
            html += `<div class="context"><strong>STRIDE:</strong> ${escapeHtml(ruleDetails.references.stride.join(', '))}</div>`;
          }
        } else if (finding.recommendations.length > 0) {
          html += `<div><strong>Recommendations:</strong><ol>${buildList(finding.recommendations)}</ol></div>`;
        }
        const triggeredBy = buildTriggerExplanation(finding);
        if (triggeredBy.length > 0) {
          html += `<div class="context"><strong>Triggered By:</strong><ul>${buildList(triggeredBy)}</ul></div>`;
        }
        if (context.length > 0) {
          html += `<div class="context"><strong>Diagram Context:</strong><ul>${buildList(context)}</ul></div>`;
        }
        html += `
      </div>
`;
      });

      html += `
    </div>
`;
    });

    html += `
    <h2>STRIDE Matrix Summary</h2>
    <div class="tab-card">
      <div>Assessed Cells: ${strideMatrixSummary.assessedCells}/${strideMatrixSummary.applicableCells} (${strideMatrixSummary.assessedPercent}%)</div>
    </div>
`;
    strideMatrixRows.forEach(row => {
      const summary = STRIDE_CATEGORIES.map(category => {
        const cell = getMatrixCellState(row, category);
        return `${STRIDE_SHORT[category]}=${cell.status}${cell.findingsCount > 0 ? `(${cell.findingsCount})` : ''}`;
      }).join(' | ');
      html += `
      <div class="tab-card">
        <h3>${escapeHtml(row.elementKind.toUpperCase())}: ${escapeHtml(row.label)}</h3>
        <div class="context">${escapeHtml(row.typeLabel)}</div>
        <div>${escapeHtml(summary)}</div>
      </div>
`;
    });

    html += `
    </div>
    <h2>Attack Paths</h2>
    <div class="pattern-list">
`;
    if (attackPaths.length === 0) {
      html += `<div class="tab-card">No attack paths defined.</div>`;
    } else {
      attackPaths.forEach(path => {
        const relatedFindings = attackPathFindingsById.get(path.id) || [];
        const mitigatedCount = relatedFindings.filter(finding => {
          const status = getMitigationState(finding).status;
          return status === 'mitigated' || status === 'accepted';
        }).length;
        const orderedSteps = path.steps.slice().sort((a, b) => a.order - b.order);
        const stepLines = orderedSteps.map(step =>
          `${step.order}. ${getNodeLabel(nodeById.get(step.sourceNodeId))} -> ${getNodeLabel(nodeById.get(step.targetNodeId))}`
        );
        html += `
      <div class="tab-card">
        <h3>${escapeHtml(path.name)}</h3>
        <div class="context">STRIDE: ${escapeHtml(path.strideCategory)} | Risk: ${escapeHtml(path.riskLevel)} | Steps: ${path.steps.length}</div>
        ${path.description ? `<div>${escapeHtml(path.description)}</div>` : ''}
        ${stepLines.length > 0 ? `<div class="context"><strong>Steps:</strong><ul>${buildList(stepLines)}</ul></div>` : ''}
        <div class="context"><strong>Threats mitigated:</strong> ${mitigatedCount}/${relatedFindings.length}</div>
      </div>
`;
      });
    }

    html += `
    </div>
    <h2>Methodology Progress</h2>
    <div class="rule-list">
      <h3>STRIDE 4-Step</h3>
`;
    strideMethodologySteps.forEach(step => {
      html += `
      <div class="tab-card">
        <h3>${escapeHtml(step.title)}</h3>
        <div><strong>${step.percent}%</strong></div>
        <div class="context">${escapeHtml(step.detail)}</div>
      </div>
`;
    });

    html += `
      <h3>PASTA 7-Step</h3>
`;
    pastaMethodologySteps.forEach(step => {
      html += `
      <div class="tab-card">
        <h3>${escapeHtml(step.title)}</h3>
        <div><strong>${step.percent}%</strong></div>
        <div class="context">${escapeHtml(step.detail)}</div>
      </div>
`;
    });

    html += `
    </div>
    <h2>Rule Checks</h2>
    <div class="rule-list">
`;
    getRuleGroups().forEach(group => {
      html += `<h3>${escapeHtml(group.title)}</h3>`;
      group.rules.forEach(rule => {
        html += `
      <div class="tab-card">
        <h3>${escapeHtml(rule.id)}: ${escapeHtml(rule.title)}</h3>
        <div>${escapeHtml(rule.summary)}</div>
        ${rule.conditions.length > 0 ? `<div class="context"><strong>Conditions:</strong><ul>${buildList(rule.conditions)}</ul></div>` : ''}
        <div class="context"><strong>Data Sources:</strong><ul>${buildList(rule.dataSources)}</ul></div>
      </div>
`;
      });
    });

    html += `
    </div>
    <h2>STRIDE Rule Mappings</h2>
    <div class="pattern-list">
`;
    getStrideMappings().forEach(mapping => {
      html += `
      <div class="tab-card">
        <h3>${escapeHtml(mapping.category)}</h3>
        <div>${escapeHtml(mapping.rules.join(', '))}</div>
      </div>
`;
    });

    html += `
    </div>
    <h2>Threat Pattern Matching</h2>
    <div class="pattern-list">
`;
    threatPatternLibrary.forEach(pattern => {
      html += `
      <div class="tab-card">
        <h3>${escapeHtml(pattern.id)}: ${escapeHtml(pattern.name)}</h3>
        <div>${escapeHtml(pattern.description)}</div>
        ${pattern.matchKeywords?.length ? `<div class="context"><strong>Match Keywords:</strong> ${escapeHtml(pattern.matchKeywords.join(', '))}</div>` : ''}
        ${pattern.commonTargets?.length ? `<div class="context"><strong>Targets:</strong> ${escapeHtml(pattern.commonTargets.join(', '))}</div>` : ''}
      </div>
`;
    });

    html += `
    </div>
  </div>
</body>
</html>`;

    return html;
  };

  const handleExportText = () => {
    downloadTextFile(buildManualFindingsText(), 'manual-rule-findings');
  };

  const handleExportHtml = () => {
    downloadHtmlFile(buildManualFindingsHtml(), 'manual-rule-findings');
  };

  const activeEntry = tabs[activeTab] || null;
  const tabContext = activeEntry ? buildTabContext(activeEntry) : [];

  return (
    <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="h6">Rule Based Findings (Non-AI)</Typography>
          <Chip size="small" label={`${totalFindings} total`} />
          <Chip size="small" variant="outlined" label={`${attackPaths.length} attack paths`} />
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Button
            size="small"
            variant="outlined"
            onClick={() => setIsRuleCatalogOpen(true)}
            sx={{ borderColor: theme.colors.border, color: theme.colors.textPrimary }}
          >
            Rule Checks
          </Button>
          <Tooltip title="Export to Text">
            <IconButton size="small" onClick={handleExportText} sx={{ color: theme.colors.textSecondary }}>
              <DescriptionIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Export to HTML">
            <IconButton size="small" onClick={handleExportHtml} sx={{ color: theme.colors.textSecondary }}>
              <LanguageIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>
      <Tabs
        value={workbenchTab}
        onChange={(_, value) => setWorkbenchTab(value)}
        variant="scrollable"
        scrollButtons="auto"
      >
        <Tab value="findings" label={`Findings (${totalFindings})`} />
        <Tab value="stride" label="STRIDE Matrix" />
        <Tab value="attackpaths" label={`Attack Paths (${attackPaths.length})`} />
        <Tab value="methodology" label="Methodology" />
      </Tabs>

      {workbenchTab === 'findings' && (
        <>
          {tabs.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              No potential problems detected.
            </Typography>
          ) : (
            <>
              <Tabs
                value={activeTab}
                onChange={(_, value) => {
                  setActiveTab(value);
                  const entry = tabs[value];
                  if (entry) {
                    onSelectedEntryChange?.({ id: entry.id, type: entry.type });
                  }
                }}
                variant="scrollable"
                scrollButtons="auto"
              >
                {tabs.map((tab) => (
                  <Tab
                    key={`${tab.type}-${tab.id}`}
                    label={(
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {tab.icon && <Box sx={{ display: 'flex', alignItems: 'center' }}>{React.createElement(tab.icon, { sx: { fontSize: 16 } })}</Box>}
                        <Typography variant="caption" sx={{ fontWeight: 600 }}>
                          {tab.label}
                        </Typography>
                        <Chip size="small" label={tab.findings.length} />
                      </Box>
                    )}
                  />
                ))}
              </Tabs>

              <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                <Autocomplete
                  size="small"
                  options={searchOptions}
                  getOptionLabel={(option) => option.secondary ? `${option.primary} (${option.secondary})` : option.primary}
                  onChange={(_, value) => {
                    if (!value) return;
                    const selectedIndex = tabs.findIndex(tab => tab.id === value.id && tab.type === value.type);
                    if (selectedIndex >= 0) {
                      setActiveTab(selectedIndex);
                    }
                    onSelectedEntryChange?.({ id: value.id, type: value.type });
                    if (value.type === 'node') {
                      onFocusNode?.(value.id);
                    } else {
                      onFocusEdge?.(value.id);
                    }
                  }}
                  renderOption={(props, option) => (
                    <li {...props} key={`${option.type}-${option.id}`} style={{ display: 'flex', flexDirection: 'column' }}>
                      <Typography variant="body2">{option.primary}</Typography>
                      {option.secondary && (
                        <Typography variant="caption" color="text.secondary">
                          {option.secondary}
                        </Typography>
                      )}
                    </li>
                  )}
                  renderInput={(params) => (
                    <TextField {...params} placeholder="Search nodes or edges" />
                  )}
                  filterOptions={(opts, state) => {
                    const input = state.inputValue.toLowerCase();
                    return opts.filter(
                      (o) =>
                        o.primary.toLowerCase().includes(input) ||
                        (o.secondary && o.secondary.toLowerCase().includes(input))
                    );
                  }}
                  isOptionEqualToValue={(opt, val) => opt.id === val.id && opt.type === val.type}
                  sx={{ width: 520, maxWidth: '90%' }}
                />
              </Box>

              {activeEntry && (
                <Box
                  sx={{
                    p: 1.5,
                    borderRadius: 1,
                    border: `1px solid ${theme.colors.border}`,
                    backgroundColor: theme.colors.surface
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                      {activeEntry.label}
                    </Typography>
                    {activeEntry.subLabel && (
                      <Chip size="small" variant="outlined" label={activeEntry.subLabel} />
                    )}
                    {activeEntry.type === 'node' && activeEntry.node && (
                      <Button size="small" variant="outlined" onClick={() => onFocusNode?.(activeEntry.node!.id)}>
                        Focus Node
                      </Button>
                    )}
                    {activeEntry.type === 'edge' && activeEntry.edge && (
                      <Button size="small" variant="outlined" onClick={() => onFocusEdge?.(activeEntry.edge!.id)}>
                        Focus Edge
                      </Button>
                    )}
                  </Box>
                  {tabContext.length > 0 && (
                    <Box sx={{ mt: 1 }}>
                      {tabContext.map(line => (
                        <Typography key={line} variant="caption" sx={{ display: 'block', color: theme.colors.textSecondary }}>
                          {line}
                        </Typography>
                      ))}
                    </Box>
                  )}
                </Box>
              )}

              {(activeEntry?.findings || []).map((finding) => {
                const ruleDetails = buildRuleDetails(finding);
                const targetNodeId = finding.related.nodeIds[0];
                const targetEdgeId = finding.related.edgeIds[0];
                const targetZoneId = finding.related.zoneIds[0];
                const relatedContext = buildFindingContext(finding);
                const mitigation = getMitigationState(finding);

                return (
                  <Box
                    key={finding.id}
                    sx={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 1.5,
                      p: 1.5,
                      borderRadius: 1,
                      border: `1px solid ${theme.colors.border}`,
                      backgroundColor: theme.colors.surface
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                      <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                        {finding.title}
                      </Typography>
                      <Chip size="small" label={finding.category.toUpperCase()} />
                      <Chip size="small" variant="outlined" label={finding.ruleId} />
                    </Box>

                    <Box>
                      <Typography variant="subtitle2" sx={{ color: theme.colors.textPrimary }}>
                        Detected
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-line' }}>
                        {finding.description}
                      </Typography>
                    </Box>

                    <Box sx={{ display: 'grid', gap: 1, gridTemplateColumns: { xs: '1fr', md: '220px 1fr' } }}>
                      <Tooltip title="Set mitigation status for this finding." arrow>
                        <FormControl size="small" fullWidth>
                          <InputLabel>Mitigation Status</InputLabel>
                          <Select
                            label="Mitigation Status"
                            value={mitigation.status}
                            onChange={event => handleMitigationStatusChange(finding, event.target.value as MitigationStatus)}
                          >
                            {MITIGATION_OPTIONS.map(option => (
                              <MenuItem key={option.value} value={option.value}>
                                {option.label}
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      </Tooltip>
                      <Tooltip title="Capture evidence or rationale for the selected mitigation status." arrow>
                        <TextField
                          size="small"
                          fullWidth
                          multiline
                          minRows={1}
                          maxRows={3}
                          label="Mitigation Notes"
                          value={mitigation.notes}
                          onChange={event => handleMitigationNotesChange(finding, event.target.value)}
                        />
                      </Tooltip>
                    </Box>

                    {ruleDetails && (
                      <>
                        <Divider />
                        <Box>
                          <Typography variant="subtitle2" sx={{ color: theme.colors.textPrimary }}>
                            Rule Explanation
                          </Typography>
                          <Typography variant="body2" sx={{ whiteSpace: 'pre-line' }}>
                            {ruleDetails.summary}
                          </Typography>
                        </Box>
                        {ruleDetails.conditions.length > 0 && (
                          <Box>
                            <Typography variant="subtitle2" sx={{ color: theme.colors.textPrimary }}>
                              Conditions
                            </Typography>
                            <Typography variant="body2" sx={{ whiteSpace: 'pre-line' }}>
                              {ruleDetails.conditions.map((condition, idx) => `${idx + 1}. ${condition}`).join('\n')}
                            </Typography>
                          </Box>
                        )}
                        <Box>
                          <Typography variant="subtitle2" sx={{ color: theme.colors.textPrimary }}>
                            Why This Matters
                          </Typography>
                          <Typography variant="body2" sx={{ whiteSpace: 'pre-line' }}>
                            {ruleDetails.whyItMatters}
                          </Typography>
                        </Box>
                        <Box>
                          <Typography variant="subtitle2" sx={{ color: theme.colors.textPrimary }}>
                            How To Fix
                          </Typography>
                          <Typography variant="body2" sx={{ whiteSpace: 'pre-line' }}>
                            {(ruleDetails.howToFix.length > 0 ? ruleDetails.howToFix : finding.recommendations)
                              .map((rec, idx) => `${idx + 1}. ${rec}`)
                              .join('\n')}
                          </Typography>
                        </Box>
                        {(ruleDetails.references?.owasp || ruleDetails.references?.stride) && (
                          <Box>
                            <Typography variant="subtitle2" sx={{ color: theme.colors.textPrimary }}>
                              References
                            </Typography>
                            {ruleDetails.references?.owasp && ruleDetails.references.owasp.length > 0 && (
                              <Typography variant="body2">
                                OWASP: {ruleDetails.references.owasp.join(', ')}
                              </Typography>
                            )}
                            {ruleDetails.references?.stride && ruleDetails.references.stride.length > 0 && (
                              <Typography variant="body2">
                                STRIDE: {ruleDetails.references.stride.join(', ')}
                              </Typography>
                            )}
                          </Box>
                        )}
                      </>
                    )}

                    {finding.recommendations.length > 0 && !ruleDetails && (
                      <Typography variant="body2" sx={{ whiteSpace: 'pre-line' }}>
                        {finding.recommendations.map((rec, idx) => `${idx + 1}. ${rec}`).join('\n')}
                      </Typography>
                    )}

                    {(() => {
                      const triggeredBy = buildTriggerExplanation(finding);
                      if (triggeredBy.length === 0) return null;
                      return (
                        <Box>
                          <Typography variant="subtitle2" sx={{ color: theme.colors.textPrimary }}>
                            Triggered By
                          </Typography>
                          {triggeredBy.map((line) => (
                            <Typography key={line} variant="body2" color="text.secondary">
                              {line}
                            </Typography>
                          ))}
                        </Box>
                      );
                    })()}

                    {relatedContext.length > 0 && (
                      <Box>
                        <Typography variant="subtitle2" sx={{ color: theme.colors.textPrimary }}>
                          Diagram Context
                        </Typography>
                        {relatedContext.map((line) => (
                          <Typography key={line} variant="caption" sx={{ display: 'block', color: theme.colors.textSecondary }}>
                            {line}
                          </Typography>
                        ))}
                      </Box>
                    )}

                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                      {targetNodeId && (
                        <Button size="small" variant="outlined" onClick={() => onFocusNode?.(targetNodeId)}>
                          Focus Node
                        </Button>
                      )}
                      {targetEdgeId && (
                        <Button size="small" variant="outlined" onClick={() => onFocusEdge?.(targetEdgeId)}>
                          Focus Edge
                        </Button>
                      )}
                      {targetZoneId && (
                        <Button size="small" variant="outlined" onClick={() => onFocusZone?.(targetZoneId)}>
                          Focus Zone
                        </Button>
                      )}
                    </Box>
                  </Box>
                );
              })}
            </>
          )}
        </>
      )}

      {workbenchTab === 'stride' && (
        <Box sx={{ display: 'grid', gap: 1.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            <Chip size="small" label={`Rows: ${strideMatrixRows.length}`} />
            <Chip size="small" variant="outlined" label={`Assessed: ${strideMatrixSummary.assessedCells}/${strideMatrixSummary.applicableCells}`} />
            <Chip size="small" variant="outlined" label={`${strideMatrixSummary.assessedPercent}% complete`} />
          </Box>

          <Box>
            <Typography variant="caption" fontWeight={600} color="text.secondary" display="block" sx={{ mb: 0.75 }}>
              Select a STRIDE category for guidance
            </Typography>
            <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
              {STRIDE_CATEGORIES.map(cat => (
                <Chip
                  key={cat}
                  label={`${STRIDE_SHORT[cat]} — ${cat}`}
                  size="small"
                  onClick={() => setStrideGuideCategory(prev => prev === cat ? null : cat)}
                  sx={{
                    bgcolor: strideGuideCategory === cat ? STRIDE_COLORS[cat] : 'transparent',
                    color: strideGuideCategory === cat ? '#fff' : 'text.primary',
                    border: `1px solid ${STRIDE_COLORS[cat]}`,
                    cursor: 'pointer',
                    fontWeight: strideGuideCategory === cat ? 700 : 400
                  }}
                />
              ))}
            </Box>
          </Box>

          {strideGuideCategory && (() => {
            const guide = STRIDE_DETAILS[strideGuideCategory];
            const categoryFindings = strideMatrixRows.flatMap(row =>
              (row.findingsByCategory[strideGuideCategory] || [])
            );
            const elementsWithThisThreat = strideMatrixRows.filter(row =>
              row.applicableCategories.includes(strideGuideCategory)
            );
            return (
              <Box
                sx={{
                  p: 1.5,
                  borderRadius: 1,
                  border: `2px solid ${STRIDE_COLORS[strideGuideCategory]}`,
                  bgcolor: `${STRIDE_COLORS[strideGuideCategory]}11`,
                  display: 'grid',
                  gap: 1.5
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                  <Chip
                    label={STRIDE_SHORT[strideGuideCategory]}
                    size="small"
                    sx={{ bgcolor: STRIDE_COLORS[strideGuideCategory], color: '#fff', fontWeight: 700 }}
                  />
                  <Typography variant="subtitle2" fontWeight={700}>{strideGuideCategory}</Typography>
                  <Chip size="small" variant="outlined" label={`${elementsWithThisThreat.length} applicable elements`} />
                  <Chip size="small" variant="outlined" label={`${categoryFindings.length} findings`} />
                </Box>

                <Typography variant="caption" color="text.secondary">{guide.description}</Typography>

                <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                  <Typography variant="caption" fontWeight={600} sx={{ mr: 0.5 }}>Applies to:</Typography>
                  {guide.dfdApplicability.map(t => (
                    <Chip key={t} label={t} size="small" variant="outlined" sx={{ fontSize: 10, height: 18 }} />
                  ))}
                </Box>

                <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
                  <Box>
                    <Typography variant="caption" fontWeight={600} display="block" sx={{ mb: 0.5 }}>
                      Questions to ask for each element
                    </Typography>
                    {guide.questionsToAsk.map((q, i) => (
                      <Typography key={i} variant="caption" display="block" sx={{ mb: 0.5, pl: 1 }}>
                        {i + 1}. {q}
                      </Typography>
                    ))}
                  </Box>
                  <Box>
                    <Typography variant="caption" fontWeight={600} display="block" sx={{ mb: 0.5, color: 'error.light' }}>
                      Attack examples
                    </Typography>
                    {guide.examples.map((ex, i) => (
                      <Typography key={i} variant="caption" display="block" color="error.light" sx={{ mb: 0.5, pl: 1 }}>
                        • {ex}
                      </Typography>
                    ))}
                    <Typography variant="caption" fontWeight={600} display="block" sx={{ mt: 1, mb: 0.5, color: 'success.light' }}>
                      Key mitigations
                    </Typography>
                    {guide.mitigations.slice(0, 3).map((m, i) => (
                      <Typography key={i} variant="caption" display="block" color="success.light" sx={{ mb: 0.5, pl: 1 }}>
                        • {m}
                      </Typography>
                    ))}
                  </Box>
                </Box>

                {guide.owasp.length > 0 && (
                  <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center', flexWrap: 'wrap' }}>
                    <Typography variant="caption" fontWeight={600}>OWASP:</Typography>
                    {guide.owasp.map(o => (
                      <Chip key={o} label={o} size="small" variant="outlined" sx={{ fontSize: 10, height: 18 }} />
                    ))}
                  </Box>
                )}
              </Box>
            );
          })()}

          <Box sx={{ overflowX: 'auto' }}>
            <Box
              sx={{
                minWidth: 980,
                display: 'grid',
                gridTemplateColumns: '260px repeat(6, minmax(120px, 1fr))',
                border: `1px solid ${theme.colors.border}`,
                borderRadius: 1
              }}
            >
              <Box sx={{ p: 1, fontWeight: 700, borderBottom: `1px solid ${theme.colors.border}` }}>Element</Box>
              {STRIDE_CATEGORIES.map(category => (
                <Box key={`head-${category}`} sx={{ p: 1, fontWeight: 700, borderBottom: `1px solid ${theme.colors.border}` }}>
                  {STRIDE_SHORT[category]}
                </Box>
              ))}
              {strideMatrixRows.map(row => (
                <React.Fragment key={row.elementId}>
                  <Box
                    sx={{
                      p: 1,
                      borderTop: `1px solid ${theme.colors.border}`,
                      borderRight: `1px solid ${theme.colors.border}`,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 0.25
                    }}
                  >
                    <Typography variant="caption" sx={{ fontWeight: 700 }}>
                      {row.label}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {row.typeLabel}
                    </Typography>
                    <Button size="small" variant="text" onClick={() => focusEntryFromMatrix(row)} sx={{ justifyContent: 'flex-start', p: 0, minWidth: 0 }}>
                      Open findings
                    </Button>
                  </Box>
                  {STRIDE_CATEGORIES.map(category => {
                    const cell = getMatrixCellState(row, category);
                    const override = strideOverridesByElement.get(row.elementId)?.overrides?.[category];
                    const relatedFindings = row.findingsByCategory[category] || [];
                    const selectValue: StrideApplicability = override ||
                      (cell.status === 'not_applicable'
                        ? 'not_applicable'
                        : cell.status === 'mitigated'
                          ? 'mitigated'
                          : cell.status === 'accepted'
                            ? 'accepted'
                            : 'applicable');
                    return (
                      <Box
                        key={`${row.elementId}-${category}`}
                        sx={{
                          p: 0.75,
                          borderTop: `1px solid ${theme.colors.border}`,
                          borderRight: `1px solid ${theme.colors.border}`,
                          backgroundColor: `${cell.color}1a`,
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 0.5
                        }}
                      >
                        <Chip
                          size="small"
                          label={cell.status.replace('_', ' ')}
                          sx={{ bgcolor: cell.color, color: '#fff', fontSize: 11 }}
                        />
                        {relatedFindings.length > 0 && (
                          <Button
                            size="small"
                            variant="text"
                            onClick={() => focusEntryFromMatrix(row)}
                            sx={{ p: 0, minWidth: 0, justifyContent: 'flex-start' }}
                          >
                            {relatedFindings.length} finding(s)
                          </Button>
                        )}
                        <Tooltip title="Override STRIDE applicability for this element/category." arrow>
                          <FormControl size="small" fullWidth>
                            <Select
                              value={selectValue}
                              onChange={event => updateStrideOverride(row.elementId, category, event.target.value as StrideApplicability)}
                              disabled={!onStrideOverrideChange}
                            >
                              {STRIDE_OVERRIDE_OPTIONS.map(option => (
                                <MenuItem key={`${row.elementId}-${category}-${option.value}`} value={option.value}>
                                  {option.label}
                                </MenuItem>
                              ))}
                            </Select>
                          </FormControl>
                        </Tooltip>
                      </Box>
                    );
                  })}
                </React.Fragment>
              ))}
            </Box>
          </Box>
        </Box>
      )}

      {workbenchTab === 'attackpaths' && (
        <Box sx={{ display: 'grid', gap: 1.5 }}>
          {attackPaths.length === 0 && (
            <Typography variant="body2" color="text.secondary">
              No attack paths defined. Build paths from the Attack Paths panel in the diagram workspace.
            </Typography>
          )}
          {attackPaths.map(path => {
            const relatedFindings = attackPathFindingsById.get(path.id) || [];
            const mitigatedCount = relatedFindings.filter(finding => {
              const status = getMitigationState(finding).status;
              return status === 'mitigated' || status === 'accepted';
            }).length;
            const isExpanded = expandedPathIds.has(path.id);
            const orderedSteps = path.steps.slice().sort((a, b) => a.order - b.order);
            return (
              <Box
                key={path.id}
                sx={{
                  p: 1.5,
                  borderRadius: 1,
                  border: `1px solid ${theme.colors.border}`,
                  backgroundColor: theme.colors.surface,
                  display: 'grid',
                  gap: 1
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>{path.name}</Typography>
                  <Chip
                    size="small"
                    label={path.strideCategory}
                    sx={{ bgcolor: STRIDE_COLORS[path.strideCategory], color: '#fff' }}
                  />
                  <Chip
                    size="small"
                    label={path.riskLevel}
                    sx={{ bgcolor: RISK_LEVEL_COLORS[path.riskLevel], color: '#fff' }}
                  />
                  <Chip size="small" variant="outlined" label={`${path.steps.length} steps`} />
                  <Button
                    size="small"
                    variant="text"
                    onClick={() => {
                      const next = new Set(expandedPathIds);
                      if (next.has(path.id)) {
                        next.delete(path.id);
                      } else {
                        next.add(path.id);
                      }
                      setExpandedPathIds(next);
                    }}
                  >
                    {isExpanded ? 'Hide Steps' : 'Show Steps'}
                  </Button>
                </Box>
                {path.description && (
                  <Typography variant="body2" color="text.secondary">
                    {path.description}
                  </Typography>
                )}
                <Typography variant="caption" color="text.secondary">
                  {mitigatedCount} of {relatedFindings.length} threats mitigated
                </Typography>
                {isExpanded && (
                  <Box sx={{ display: 'grid', gap: 0.75 }}>
                    {orderedSteps.map(step => (
                      <Box
                        key={`${path.id}-${step.edgeId}`}
                        sx={{
                          p: 0.75,
                          borderRadius: 1,
                          border: `1px solid ${theme.colors.border}`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 1
                        }}
                      >
                        <Typography variant="body2">
                          {step.order}. {getNodeLabel(nodeById.get(step.sourceNodeId))} {'\u2192'} {getNodeLabel(nodeById.get(step.targetNodeId))}
                        </Typography>
                        <Button size="small" variant="outlined" onClick={() => onFocusEdge?.(step.edgeId)}>
                          Focus Edge
                        </Button>
                      </Box>
                    ))}
                    {relatedFindings.length > 0 && (
                      <Box sx={{ display: 'grid', gap: 0.5 }}>
                        <Typography variant="subtitle2">Related Threat Findings</Typography>
                        {relatedFindings.map(finding => {
                          const mitigation = getMitigationState(finding);
                          return (
                            <Box
                              key={finding.id}
                              sx={{
                                p: 0.75,
                                borderRadius: 1,
                                border: `1px solid ${theme.colors.border}`,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: 1
                              }}
                            >
                              <Typography variant="caption">{finding.ruleId}: {finding.title}</Typography>
                              <Chip size="small" label={mitigation.status.replace('_', ' ')} />
                            </Box>
                          );
                        })}
                      </Box>
                    )}
                  </Box>
                )}
              </Box>
            );
          })}
        </Box>
      )}

      {workbenchTab === 'methodology' && (
        <Box sx={{ display: 'grid', gap: 2 }}>
          <Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>Microsoft STRIDE 4-Step</Typography>
            <Box sx={{ display: 'grid', gap: 1 }}>
              {strideMethodologySteps.map(step => (
                <Box
                  key={step.title}
                  sx={{
                    p: 1.25,
                    borderRadius: 1,
                    border: `1px solid ${theme.colors.border}`,
                    backgroundColor: theme.colors.surface
                  }}
                >
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1 }}>
                    <Typography variant="subtitle2">{step.title}</Typography>
                    <Chip
                      size="small"
                      label={`${step.percent}%`}
                      sx={{ bgcolor: step.percent === 100 ? '#16a34a' : theme.colors.border, color: step.percent === 100 ? '#fff' : theme.colors.textPrimary }}
                    />
                  </Box>
                  <LinearProgress variant="determinate" value={step.percent} sx={{ mt: 0.75, mb: 0.75 }} />
                  <Typography variant="caption" color="text.secondary">{step.detail}</Typography>
                </Box>
              ))}
            </Box>
          </Box>
          <Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 0.5 }}>PASTA 7-Step</Typography>
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
              Process for Attack Simulation and Threat Analysis. Click any stage to view guidance.
            </Typography>
            <Box sx={{ display: 'grid', gap: 1 }}>
              {pastaMethodologySteps.map((step, stepIdx) => {
                const stageData = PASTA_STAGES[stepIdx];
                const isExpanded = pastaExpandedStages.has(stepIdx);
                return (
                  <Box
                    key={step.title}
                    sx={{
                      borderRadius: 1,
                      border: `1px solid ${theme.colors.border}`,
                      backgroundColor: theme.colors.surface,
                      overflow: 'hidden'
                    }}
                  >
                    <Box
                      sx={{ p: 1.25, cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' } }}
                      onClick={() => {
                        setPastaExpandedStages(prev => {
                          const next = new Set(prev);
                          if (next.has(stepIdx)) { next.delete(stepIdx); } else { next.add(stepIdx); }
                          return next;
                        });
                      }}
                    >
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Chip
                            size="small"
                            label={stepIdx + 1}
                            sx={{ bgcolor: '#0f172a', color: '#94a3b8', fontWeight: 700, width: 24, height: 24 }}
                          />
                          <Typography variant="subtitle2">{step.title}</Typography>
                        </Box>
                        <Chip
                          size="small"
                          label={step.percent === 100 ? 'Complete' : 'Pending'}
                          sx={{ bgcolor: step.percent === 100 ? '#16a34a' : '#6b7280', color: '#fff' }}
                        />
                      </Box>
                      <LinearProgress variant="determinate" value={step.percent} sx={{ mt: 0.75, mb: 0.75 }} />
                      <Typography variant="caption" color="text.secondary">{step.detail}</Typography>
                    </Box>
                    {isExpanded && stageData && (
                      <Box
                        sx={{
                          p: 1.25,
                          borderTop: `1px solid ${theme.colors.border}`,
                          display: 'grid',
                          gap: 1,
                          bgcolor: 'action.hover'
                        }}
                      >
                        <Typography variant="caption" color="text.secondary">{stageData.description}</Typography>
                        <Box
                          sx={{
                            p: 1,
                            borderRadius: 1,
                            bgcolor: 'background.paper',
                            borderLeft: '3px solid',
                            borderColor: 'primary.main'
                          }}
                        >
                          <Typography variant="caption" color="text.secondary">{stageData.guidance}</Typography>
                        </Box>
                        <Box>
                          <Typography variant="caption" fontWeight={600} display="block" sx={{ mb: 0.5 }}>
                            Questions to ask
                          </Typography>
                          {stageData.questionsToAsk.map((q, i) => (
                            <Typography key={i} variant="caption" display="block" sx={{ mb: 0.25, pl: 1 }}>
                              {i + 1}. {q}
                            </Typography>
                          ))}
                        </Box>
                        <Box>
                          <Typography variant="caption" fontWeight={600} display="block" sx={{ mb: 0.5, color: 'success.light' }}>
                            Expected outputs
                          </Typography>
                          {stageData.outputs.map((o, i) => (
                            <Typography key={i} variant="caption" display="block" color="success.light" sx={{ mb: 0.25, pl: 1 }}>
                              • {o}
                            </Typography>
                          ))}
                        </Box>
                      </Box>
                    )}
                  </Box>
                );
              })}
            </Box>
          </Box>
        </Box>
      )}
      <Dialog
        open={isRuleCatalogOpen}
        onClose={() => setIsRuleCatalogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Manual Rule Checks</DialogTitle>
        <DialogContent dividers>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Typography variant="body2" color="text.secondary">
              These are the deterministic checks performed by the manual analysis engine and the data fields they inspect.
            </Typography>
            <Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
                STRIDE Mappings
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                {getStrideMappings().map(mapping => (
                  <Box
                    key={mapping.category}
                    sx={{
                      p: 1.5,
                      borderRadius: 1,
                      border: `1px solid ${theme.colors.border}`,
                      backgroundColor: theme.colors.surface
                    }}
                  >
                    <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                      {mapping.category}
                    </Typography>
                    <Typography variant="body2" sx={{ color: theme.colors.textSecondary }}>
                      Rules: {mapping.rules.join(', ')}
                    </Typography>
                  </Box>
                ))}
              </Box>
            </Box>
            <Divider />
            {getRuleGroups().map(group => (
              <Box key={group.title} sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                  {group.title}
                </Typography>
                {group.rules.map(rule => (
                  <Box
                    key={rule.id}
                    sx={{
                      p: 1.5,
                      borderRadius: 1,
                      border: `1px solid ${theme.colors.border}`,
                      backgroundColor: theme.colors.surface
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                      <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                        {rule.id}: {rule.title}
                      </Typography>
                      {rule.frameworks?.map(framework => (
                        <Chip key={`${rule.id}-${framework}`} size="small" label={framework} />
                      ))}
                    </Box>
                    <Typography variant="body2" sx={{ mt: 0.75 }}>
                      {rule.summary}
                    </Typography>
                    {rule.conditions.length > 0 && (
                      <>
                        <Typography variant="subtitle2" sx={{ mt: 1 }}>
                          Conditions
                        </Typography>
                        {rule.conditions.map(condition => (
                          <Typography key={`${rule.id}-${condition}`} variant="caption" sx={{ display: 'block', color: theme.colors.textSecondary }}>
                            {condition}
                          </Typography>
                        ))}
                      </>
                    )}
                    <Typography variant="subtitle2" sx={{ mt: 1 }}>
                      Data Sources
                    </Typography>
                    {rule.dataSources.map(source => (
                      <Typography key={`${rule.id}-${source}`} variant="caption" sx={{ display: 'block', color: theme.colors.textSecondary }}>
                        {source}
                      </Typography>
                    ))}
                  </Box>
                ))}
              </Box>
            ))}
            <Divider />
            <Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
                Threat Pattern Matching (TM-*)
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                Threat patterns are matched against node metadata (label, description, vendor, product, technology, category, index code)
                and keyword lists for common target types.
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                {threatPatternLibrary.map(pattern => (
                  <Box
                    key={pattern.id}
                    sx={{
                      p: 1.5,
                      borderRadius: 1,
                      border: `1px solid ${theme.colors.border}`,
                      backgroundColor: theme.colors.surface
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                        {pattern.id}: {pattern.name}
                      </Typography>
                      {pattern.stride && pattern.stride.length > 0 && (
                        <Chip size="small" variant="outlined" label={`STRIDE: ${pattern.stride.join(', ')}`} />
                      )}
                    </Box>
                    <Typography variant="body2" sx={{ mt: 0.5 }}>
                      {pattern.description}
                    </Typography>
                    <Typography variant="caption" sx={{ display: 'block', mt: 0.5, color: theme.colors.textSecondary }}>
                      Match Keywords: {(pattern.matchKeywords || []).slice(0, 12).join(', ')}{pattern.matchKeywords && pattern.matchKeywords.length > 12 ? '…' : ''}
                    </Typography>
                    {pattern.commonTargets && pattern.commonTargets.length > 0 && (
                      <Typography variant="caption" sx={{ display: 'block', color: theme.colors.textSecondary }}>
                        Targets: {pattern.commonTargets.join(', ')}
                      </Typography>
                    )}
                  </Box>
                ))}
              </Box>
            </Box>
            <Divider />
            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
                Rule ID Legend
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Prefixes indicate the rule family: DFD = Data Flow Diagram integrity, TB = Trust Boundary,
                DP = Data Protection, IA = Identity and Access, AR = Availability and Resilience,
                ARC = Architecture checks, OWASP-A## = OWASP Top 10 mappings, TM = Threat pattern matches.
              </Typography>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsRuleCatalogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ManualFindingsWindow;
