import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { saveExport } from '../../utils/exportUtils';
import {
  Box,
  Button,
  Chip,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  OutlinedInput,
  Paper,
  Select,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography
} from '@mui/material';
import { ChevronDown, ChevronRight, FilePlus, Trash2, X } from 'lucide-react';
import {
  assessmentScopeTypeLabels,
  computeAssessmentHealth,
  getAssetCriticalityLabel,
  getConfig,
  summarizeAssessmentScopes
} from '../../services/GrcWorkspaceService';
import {
  AssessmentScopeItem,
  AssessmentScopeType,
  AssessmentStatus,
  GrcAssessment,
  GrcFinding,
  GrcRisk,
  RiskTierNode
} from '../../types/GrcTypes';
import { GrcTabProps, cardSx, createId, downloadText, toSlug } from './grcShared';
import GrcAssessmentThreatModelSection from './GrcAssessmentThreatModelSection';

interface SoaEntryDetail {
  id: string;
  label: string;
  reason: string;
  isGap: boolean;
  implementationStatus: string;
  applicability: string;
}

interface AssessmentFindingLinkView {
  finding: GrcFinding;
  matchedRiskIds: string[];
  matchedRiskTitles: string[];
}

interface AssessmentExportContext {
  generatedAt: string;
  assessment: GrcAssessment;
  scopeSummary: string;
  tierFilterSummary: string;
  linkedAssets: Array<{
    id: string;
    name: string;
    domain: string;
    category: string;
    businessCriticality: string;
    securityCriticality: string;
    owner?: string;
  }>;
  linkedRisks: Array<{
    id: string;
    title: string;
    status: string;
    ratingLabel: string;
    score: number;
    owner?: string;
  }>;
  linkedGaps: Array<{
    id: string;
    label: string;
    reason: string;
    implementationStatus: string;
    applicability: string;
  }>;
  linkedTasks: Array<{
    id: string;
    title: string;
    status: string;
    priority: string;
    owner?: string;
  }>;
}

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const toDisplayDate = (value?: string): string => {
  if (!value) {
    return 'Not set';
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleDateString();
};

const toDisplayDateTime = (value: string): string => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleString();
};

const toDateInputValue = (value?: string): string => {
  if (!value) {
    return '';
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return '';
  }
  return parsed.toISOString().slice(0, 10);
};

const normalizeTierFilter = (tierFilter: GrcAssessment['tierFilter']): GrcAssessment['tierFilter'] => ({
  tier1: tierFilter.tier1?.trim() || undefined,
  tier2: tierFilter.tier2?.trim() || undefined,
  tier3: tierFilter.tier3?.trim() || undefined,
  tier4: tierFilter.tier4?.trim() || undefined
});

const buildTierFilterSummary = (tierFilter: GrcAssessment['tierFilter']): string => {
  const items = [
    tierFilter.tier1 ? `Tier1=${tierFilter.tier1}` : '',
    tierFilter.tier2 ? `Tier2=${tierFilter.tier2}` : '',
    tierFilter.tier3 ? `Tier3=${tierFilter.tier3}` : '',
    tierFilter.tier4 ? `Tier4=${tierFilter.tier4}` : ''
  ].filter(Boolean);
  return items.length > 0 ? items.join(', ') : 'None';
};

const makeScopeItem = (type: AssessmentScopeType, value: string, name: string): AssessmentScopeItem => ({
  id: createId('scope'),
  type,
  value: value.trim() || name.trim() || type,
  name: name.trim() || value.trim() || assessmentScopeTypeLabels[type]
});

const scopeItemSignature = (item: AssessmentScopeItem): string => `${item.type}:${(item.value || item.name).trim().toLowerCase()}`;

const severityColor = (ratingLabel: string): string => {
  const label = ratingLabel.toLowerCase();
  if (label === 'critical') return '#d32f2f';
  if (label === 'high') return '#e65100';
  if (label === 'medium') return '#ed6c02';
  if (label === 'low') return '#2e7d32';
  return '#9e9e9e';
};

const findingSeverityOrder: Record<'critical' | 'high' | 'medium' | 'low' | 'info', number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
  info: 4
};

const SectionHeader: React.FC<{ label: string }> = ({ label }) => (
  <Box sx={{ mt: 1 }}>
    <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>{label}</Typography>
    <Divider sx={{ mt: 0.5, mb: 1.5 }} />
  </Box>
);

const dedupeTierNodesByLabel = (nodes: RiskTierNode[]): RiskTierNode[] => {
  const seen = new Set<string>();
  const result: RiskTierNode[] = [];
  nodes.forEach(node => {
    const key = node.label.trim().toLowerCase();
    if (!key || seen.has(key)) return;
    seen.add(key);
    result.push(node);
  });
  return result;
};

const useTierCascade = (tierCatalogue: RiskTierNode[], tierFilter: GrcAssessment['tierFilter']) => {
  const tier1Options = useMemo(
    () => dedupeTierNodesByLabel(tierCatalogue.filter(node => node.tier === 1)),
    [tierCatalogue]
  );

  const selectedTier1Node = useMemo(
    () => (tierFilter.tier1 ? tierCatalogue.find(node => node.tier === 1 && node.label === tierFilter.tier1) : undefined),
    [tierCatalogue, tierFilter.tier1]
  );

  const tier2Options = useMemo(
    () => selectedTier1Node
      ? dedupeTierNodesByLabel(tierCatalogue.filter(node => node.tier === 2 && node.parentId === selectedTier1Node.id))
      : dedupeTierNodesByLabel(tierCatalogue.filter(node => node.tier === 2)),
    [tierCatalogue, selectedTier1Node]
  );

  const selectedTier2Node = useMemo(
    () => (tierFilter.tier2 ? tierCatalogue.find(node => node.tier === 2 && node.label === tierFilter.tier2) : undefined),
    [tierCatalogue, tierFilter.tier2]
  );

  const tier3Options = useMemo(
    () => selectedTier2Node
      ? dedupeTierNodesByLabel(tierCatalogue.filter(node => node.tier === 3 && node.parentId === selectedTier2Node.id))
      : dedupeTierNodesByLabel(tierCatalogue.filter(node => node.tier === 3)),
    [tierCatalogue, selectedTier2Node]
  );

  const selectedTier3Node = useMemo(
    () => (tierFilter.tier3 ? tierCatalogue.find(node => node.tier === 3 && node.label === tierFilter.tier3) : undefined),
    [tierCatalogue, tierFilter.tier3]
  );

  const tier4Options = useMemo(
    () => selectedTier3Node
      ? dedupeTierNodesByLabel(tierCatalogue.filter(node => node.tier === 4 && node.parentId === selectedTier3Node.id))
      : dedupeTierNodesByLabel(tierCatalogue.filter(node => node.tier === 4)),
    [tierCatalogue, selectedTier3Node]
  );

  return { tier1Options, tier2Options, tier3Options, tier4Options };
};

const normalizeTierValue = (value?: string): string => (value || '').trim().toLowerCase();

const riskMatchesTierFilter = (
  risk: Pick<GrcRisk, 'tierPath'>,
  tierFilter: GrcAssessment['tierFilter']
): boolean => {
  if (tierFilter.tier1 && normalizeTierValue(risk.tierPath.tier1) !== normalizeTierValue(tierFilter.tier1)) return false;
  if (tierFilter.tier2 && normalizeTierValue(risk.tierPath.tier2) !== normalizeTierValue(tierFilter.tier2)) return false;
  if (tierFilter.tier3 && normalizeTierValue(risk.tierPath.tier3) !== normalizeTierValue(tierFilter.tier3)) return false;
  if (tierFilter.tier4 && normalizeTierValue(risk.tierPath.tier4) !== normalizeTierValue(tierFilter.tier4)) return false;
  return true;
};

const buildAssessmentText = (context: AssessmentExportContext): string => {
  const { assessment, generatedAt, scopeSummary, tierFilterSummary, linkedAssets, linkedRisks, linkedGaps, linkedTasks } = context;
  const threatModel = assessment.threatModel;
  const threatNodes = threatModel?.nodes || [];
  const threatEdges = threatModel?.edges || [];
  const threatNodeLabelById = new Map(threatNodes.map(node => [node.id, node.label]));
  const linkedNodeCount = threatNodes.filter(node => Boolean(node.diagramNodeId)).length;
  const linkedFlowCount = threatEdges.filter(edge => edge.sourceType === 'diagram_edge' && Boolean(edge.diagramEdgeId)).length;
  const attackPathSteps = threatEdges
    .filter(edge => typeof edge.pathOrder === 'number' && Number.isFinite(edge.pathOrder) && edge.pathOrder > 0)
    .sort((a, b) => (a.pathOrder as number) - (b.pathOrder as number));
  const attackPathDescription = threatModel?.attackPathDescription || '';
  const openPlanActions = assessment.riskManagementPlan.actions.filter(action => action.status !== 'done').length;

  const lines: string[] = [
    `Assessment Report: ${assessment.title}`,
    `Generated At: ${toDisplayDateTime(generatedAt)}`,
    '',
    'Assessment Details',
    `Status: ${assessment.status}`,
    `Scopes: ${scopeSummary}`,
    `Risk Tier Filter: ${tierFilterSummary}`,
    `Owner: ${assessment.owner || 'Unassigned'}`,
    `Reviewer: ${assessment.reviewer || 'Unassigned'}`,
    `Start Date: ${toDisplayDate(assessment.startDate)}`,
    `Target Date: ${toDisplayDate(assessment.dueDate)}`,
    `Completed Date: ${toDisplayDate(assessment.completedDate)}`,
    '',
    'Risk Management Plan',
    `Objective: ${assessment.riskManagementPlan.objective || 'Not set'}`,
    `Strategy: ${assessment.riskManagementPlan.strategy || 'Not set'}`,
    `Open Plan Actions: ${openPlanActions}`,
    '',
    'Summary',
    assessment.summary || 'No summary provided.',
    '',
    'Methodology',
    assessment.methodologyNote || 'No methodology note provided.',
    '',
    'Assumptions',
    assessment.assumptionNote || 'No assumptions documented.',
    '',
    'Findings',
    assessment.findings || 'No findings recorded.',
    '',
    'Recommendations',
    assessment.recommendations || 'No recommendations recorded.',
    '',
    'Evidence Summary',
    assessment.evidenceSummary || 'No evidence summary provided.',
    '',
    'Threat Model & Attack Paths',
    `Nodes: ${threatNodes.length}`,
    `Connections: ${threatEdges.length}`,
    `Diagram-linked Nodes: ${linkedNodeCount}`,
    `Diagram-linked Flows: ${linkedFlowCount}`,
    `Attack Path Steps: ${attackPathSteps.length}`,
    '',
    'Attack Path Traversal'
  ];

  if (attackPathSteps.length === 0) {
    lines.push('- None');
  } else {
    attackPathSteps.forEach(edge => {
      const sourceLabel = threatNodeLabelById.get(edge.source) || edge.source;
      const targetLabel = threatNodeLabelById.get(edge.target) || edge.target;
      lines.push(
        `- Step ${edge.pathOrder}: ${sourceLabel} -> ${targetLabel}${edge.label ? ` [${edge.label}]` : ''}${edge.diagramEdgeId ? ` [edge=${edge.diagramEdgeId}]` : ''}`
      );
    });
  }

  lines.push('', 'Attack Path Description');
  lines.push(attackPathDescription.trim() || 'No description provided.');

  lines.push('', `Linked Assets (${linkedAssets.length})`);

  if (linkedAssets.length === 0) {
    lines.push('- None');
  } else {
    linkedAssets.forEach(asset => {
      lines.push(
        `- ${asset.name} | domain=${asset.domain} | category=${asset.category} | business=${asset.businessCriticality} | security=${asset.securityCriticality} | owner=${asset.owner || 'Unassigned'}`
      );
    });
  }

  lines.push('', `Linked Risks (${linkedRisks.length})`);
  if (linkedRisks.length === 0) {
    lines.push('- None');
  } else {
    linkedRisks.forEach(risk => {
      lines.push(
        `- ${risk.title} | status=${risk.status} | rating=${risk.ratingLabel}(${risk.score}) | owner=${risk.owner || 'Unassigned'}`
      );
    });
  }

  lines.push('', `Linked Compliance Gaps (${linkedGaps.length})`);
  if (linkedGaps.length === 0) {
    lines.push('- None');
  } else {
    linkedGaps.forEach(gap => {
      lines.push(
        `- ${gap.label} | reason=${gap.reason} | implementation=${gap.implementationStatus} | applicability=${gap.applicability}`
      );
    });
  }

  lines.push('', `Linked Workflow Tasks (${linkedTasks.length})`);
  if (linkedTasks.length === 0) {
    lines.push('- None');
  } else {
    linkedTasks.forEach(task => {
      lines.push(
        `- ${task.title} | status=${task.status} | priority=${task.priority} | owner=${task.owner || 'Unassigned'}`
      );
    });
  }

  return lines.join('\n');
};

const buildAssessmentHtml = (context: AssessmentExportContext): string => {
  const { assessment, generatedAt, scopeSummary, tierFilterSummary, linkedAssets, linkedRisks, linkedGaps, linkedTasks } = context;
  const threatModel = assessment.threatModel;
  const threatNodes = threatModel?.nodes || [];
  const threatEdges = threatModel?.edges || [];
  const threatNodeLabelById = new Map(threatNodes.map(node => [node.id, node.label]));
  const linkedNodeCount = threatNodes.filter(node => Boolean(node.diagramNodeId)).length;
  const linkedFlowCount = threatEdges.filter(edge => edge.sourceType === 'diagram_edge' && Boolean(edge.diagramEdgeId)).length;
  const attackPathSteps = threatEdges
    .filter(edge => typeof edge.pathOrder === 'number' && Number.isFinite(edge.pathOrder) && edge.pathOrder > 0)
    .sort((a, b) => (a.pathOrder as number) - (b.pathOrder as number));
  const attackPathTraversal = attackPathSteps.map(edge => {
    const sourceLabel = threatNodeLabelById.get(edge.source) || edge.source;
    const targetLabel = threatNodeLabelById.get(edge.target) || edge.target;
    return escapeHtml(
      `Step ${edge.pathOrder}: ${sourceLabel} -> ${targetLabel}${edge.label ? ` [${edge.label}]` : ''}${edge.diagramEdgeId ? ` [edge=${edge.diagramEdgeId}]` : ''}`
    );
  });
  const attackPathDescription = threatModel?.attackPathDescription || '';

  const listOrEmpty = (items: string[]): string =>
    items.length > 0 ? `<ul>${items.map(item => `<li>${item}</li>`).join('')}</ul>` : '<p>None</p>';

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(assessment.title)} - Assessment Report</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 32px; color: #111827; }
    h1, h2 { margin-bottom: 8px; }
    h2 { margin-top: 24px; border-bottom: 1px solid #d1d5db; padding-bottom: 6px; }
    p, li { line-height: 1.45; }
    .meta { color: #4b5563; margin-bottom: 16px; }
  </style>
</head>
<body>
  <h1>${escapeHtml(assessment.title)}</h1>
  <p class="meta">Generated: ${escapeHtml(toDisplayDateTime(generatedAt))}</p>

  <h2>Assessment Details</h2>
  <p><strong>Status:</strong> ${escapeHtml(assessment.status)}</p>
  <p><strong>Scopes:</strong> ${escapeHtml(scopeSummary)}</p>
  <p><strong>Risk Tier Filter:</strong> ${escapeHtml(tierFilterSummary)}</p>
  <p><strong>Owner:</strong> ${escapeHtml(assessment.owner || 'Unassigned')}</p>
  <p><strong>Reviewer:</strong> ${escapeHtml(assessment.reviewer || 'Unassigned')}</p>
  <p><strong>Start Date:</strong> ${escapeHtml(toDisplayDate(assessment.startDate))}</p>
  <p><strong>Target Date:</strong> ${escapeHtml(toDisplayDate(assessment.dueDate))}</p>
  <p><strong>Completed Date:</strong> ${escapeHtml(toDisplayDate(assessment.completedDate))}</p>

  <h2>Risk Management Plan</h2>
  <p><strong>Objective:</strong> ${escapeHtml(assessment.riskManagementPlan.objective || 'Not set')}</p>
  <p><strong>Strategy:</strong> ${escapeHtml(assessment.riskManagementPlan.strategy || 'Not set')}</p>
  <p><strong>Open Plan Actions:</strong> ${assessment.riskManagementPlan.actions.filter(action => action.status !== 'done').length}</p>

  <h2>Summary</h2>
  <p>${escapeHtml(assessment.summary || 'No summary provided.')}</p>

  <h2>Methodology</h2>
  <p>${escapeHtml(assessment.methodologyNote || 'No methodology note provided.')}</p>

  <h2>Assumptions</h2>
  <p>${escapeHtml(assessment.assumptionNote || 'No assumptions documented.')}</p>

  <h2>Findings</h2>
  <p>${escapeHtml(assessment.findings || 'No findings recorded.')}</p>

  <h2>Recommendations</h2>
  <p>${escapeHtml(assessment.recommendations || 'No recommendations recorded.')}</p>

  <h2>Evidence Summary</h2>
  <p>${escapeHtml(assessment.evidenceSummary || 'No evidence summary provided.')}</p>

  <h2>Threat Model &amp; Attack Paths</h2>
  <p><strong>Nodes:</strong> ${threatNodes.length}</p>
  <p><strong>Connections:</strong> ${threatEdges.length}</p>
  <p><strong>Diagram-linked Nodes:</strong> ${linkedNodeCount}</p>
  <p><strong>Diagram-linked Flows:</strong> ${linkedFlowCount}</p>
  <p><strong>Attack Path Steps:</strong> ${attackPathSteps.length}</p>
  <p><strong>Attack Path Traversal</strong></p>
  ${listOrEmpty(attackPathTraversal)}
  <p><strong>Attack Path Description</strong></p>
  <p>${escapeHtml(attackPathDescription.trim() || 'No description provided.')}</p>

  <h2>Linked Assets (${linkedAssets.length})</h2>
  ${listOrEmpty(linkedAssets.map(asset => escapeHtml(
    `${asset.name} | domain=${asset.domain} | category=${asset.category} | business=${asset.businessCriticality} | security=${asset.securityCriticality} | owner=${asset.owner || 'Unassigned'}`
  )))}

  <h2>Linked Risks (${linkedRisks.length})</h2>
  ${listOrEmpty(linkedRisks.map(risk => escapeHtml(
    `${risk.title} | status=${risk.status} | rating=${risk.ratingLabel}(${risk.score}) | owner=${risk.owner || 'Unassigned'}`
  )))}

  <h2>Linked Compliance Gaps (${linkedGaps.length})</h2>
  ${listOrEmpty(linkedGaps.map(gap => escapeHtml(
    `${gap.label} | reason=${gap.reason} | implementation=${gap.implementationStatus} | applicability=${gap.applicability}`
  )))}

  <h2>Linked Workflow Tasks (${linkedTasks.length})</h2>
  ${listOrEmpty(linkedTasks.map(task => escapeHtml(
    `${task.title} | status=${task.status} | priority=${task.priority} | owner=${task.owner || 'Unassigned'}`
  )))}
</body>
</html>`;
};

const GrcAssessmentsTab: React.FC<GrcTabProps> = ({
  workspace,
  applyWorkspace,
  setStatusMessage,
  diagramSnapshot,
  assessmentFocusRequest,
  onSwitchModule,
  onSwitchTab,
  getTabViewState,
  setTabViewState
}) => {
  const config = getConfig(workspace);
  const cfgDefaults = config.recordDefaults;
  const scopeConfig = config.assessmentScopes;
  const enabledScopeTypes: AssessmentScopeType[] = scopeConfig.enabledTypes.length > 0
    ? scopeConfig.enabledTypes
    : ['system'];
  const persistedView = getTabViewState?.('assessments', {
    activeAssessmentId: workspace.assessments[0]?.id ?? null,
    createFormOpen: workspace.assessments.length === 0
  }) ?? {
    activeAssessmentId: workspace.assessments[0]?.id ?? null,
    createFormOpen: workspace.assessments.length === 0
  };

  const [newAssessmentTitle, setNewAssessmentTitle] = useState('');
  const [newAssessmentSummary, setNewAssessmentSummary] = useState('');
  const [newAssessmentBusinessUnit, setNewAssessmentBusinessUnit] = useState('');
  const [newScopeType, setNewScopeType] = useState<AssessmentScopeType>(cfgDefaults.assessmentScopeType);
  const [newScopeValue, setNewScopeValue] = useState(cfgDefaults.assessmentScopeValue || cfgDefaults.assessmentScopeName);
  const [newScopeName, setNewScopeName] = useState(cfgDefaults.assessmentScopeName || cfgDefaults.assessmentScopeValue);
  const [newScopeItems, setNewScopeItems] = useState<AssessmentScopeItem[]>([
    makeScopeItem(
      cfgDefaults.assessmentScopeType,
      cfgDefaults.assessmentScopeValue || cfgDefaults.assessmentScopeName,
      cfgDefaults.assessmentScopeName || cfgDefaults.assessmentScopeValue
    )
  ]);
  const [newTierFilter, setNewTierFilter] = useState<GrcAssessment['tierFilter']>(cfgDefaults.assessmentTierFilter || {});
  const [selectedRiskIds, setSelectedRiskIds] = useState<string[]>([]);
  const [newThreatActorIds, setNewThreatActorIds] = useState<string[]>([]);
  const threatActors = useMemo(() => workspace.threatActors || [], [workspace.threatActors]);
  const [activeAssessmentId, setActiveAssessmentId] = useState<string | null>(
    (persistedView.activeAssessmentId as string | null) ?? workspace.assessments[0]?.id ?? null
  );
  const [activeScopeType, setActiveScopeType] = useState<AssessmentScopeType>(cfgDefaults.assessmentScopeType);
  const [activeScopeValue, setActiveScopeValue] = useState(cfgDefaults.assessmentScopeValue || cfgDefaults.assessmentScopeName);
  const [activeScopeName, setActiveScopeName] = useState(cfgDefaults.assessmentScopeName || cfgDefaults.assessmentScopeValue);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [createFormOpen, setCreateFormOpen] = useState<boolean>(
    Boolean((persistedView.createFormOpen as boolean | undefined) ?? (workspace.assessments.length === 0))
  );

  const findingById = useMemo(
    () => new Map((workspace.findings || []).map(finding => [finding.id, finding])),
    [workspace.findings]
  );
  const getEffectiveTierPathForRisk = useCallback((risk: GrcRisk): GrcRisk['tierPath'] => {
    const sourceFindingTier4 = risk.sourceFindingId ? findingById.get(risk.sourceFindingId)?.title?.trim() : undefined;
    return {
      ...risk.tierPath,
      tier4: risk.tierPath.tier4 || sourceFindingTier4 || undefined
    };
  }, [findingById]);

  const buildDynamicTier4Options = useCallback((tierFilter: GrcAssessment['tierFilter']): RiskTierNode[] => {
    const normalizedFilter = normalizeTierFilter(tierFilter);
    const seen = new Set<string>();
    const options: RiskTierNode[] = [];
    workspace.risks.forEach(risk => {
      const tierPath = getEffectiveTierPathForRisk(risk);
      if (normalizedFilter.tier1 && normalizeTierValue(tierPath.tier1) !== normalizeTierValue(normalizedFilter.tier1)) return;
      if (normalizedFilter.tier2 && normalizeTierValue(tierPath.tier2) !== normalizeTierValue(normalizedFilter.tier2)) return;
      if (normalizedFilter.tier3 && normalizeTierValue(tierPath.tier3) !== normalizeTierValue(normalizedFilter.tier3)) return;
      const tier4 = tierPath.tier4?.trim();
      if (!tier4) return;
      const key = tier4.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      options.push({
        id: `dynamic-tier4-${toSlug(tier4)}`,
        tier: 4,
        label: tier4
      });
    });
    return options;
  }, [workspace.risks, getEffectiveTierPathForRisk]);

  const newTierCascade = useTierCascade(workspace.tierCatalogue, newTierFilter);
  const newTier4Options = useMemo(
    () => dedupeTierNodesByLabel([...newTierCascade.tier4Options, ...buildDynamicTier4Options(newTierFilter)]),
    [buildDynamicTier4Options, newTierCascade.tier4Options, newTierFilter]
  );
  const newTierFilteredRisks = useMemo(
    () => workspace.risks.filter(risk => riskMatchesTierFilter({ tierPath: getEffectiveTierPathForRisk(risk) }, newTierFilter)),
    [workspace.risks, newTierFilter, getEffectiveTierPathForRisk]
  );

  const riskById = useMemo(
    () => new Map(workspace.risks.map(risk => [risk.id, risk])),
    [workspace.risks]
  );
  const assetById = useMemo(
    () => new Map(workspace.assets.map(asset => [asset.id, asset])),
    [workspace.assets]
  );
  const taskById = useMemo(
    () => new Map(workspace.workflowTasks.map(task => [task.id, task])),
    [workspace.workflowTasks]
  );
  const controlSetById = useMemo(
    () => new Map(workspace.controlSets.map(controlSet => [controlSet.id, controlSet])),
    [workspace.controlSets]
  );

  useEffect(() => {
    if (activeAssessmentId && workspace.assessments.some(assessment => assessment.id === activeAssessmentId)) {
      return;
    }
    setActiveAssessmentId(workspace.assessments[0]?.id ?? null);
  }, [activeAssessmentId, workspace.assessments]);

  useEffect(() => {
    setTabViewState?.('assessments', {
      activeAssessmentId,
      createFormOpen
    });
  }, [activeAssessmentId, createFormOpen, setTabViewState]);

  const zoneScopeOptions = useMemo(() => {
    const values = new Set<string>();
    diagramSnapshot?.nodes.forEach(node => {
      if (node.zone && node.zone.trim()) {
        values.add(node.zone.trim());
      }
    });
    diagramSnapshot?.edges?.forEach(edge => {
      if (edge.zone && edge.zone.trim()) {
        values.add(edge.zone.trim());
      }
    });
    return Array.from(values).sort((a, b) => a.localeCompare(b));
  }, [diagramSnapshot]);

  const systemScopeOptions = useMemo(
    () => scopeConfig.systemScopeOptions,
    [scopeConfig.systemScopeOptions]
  );

  const applicationScopeOptions = useMemo(
    () => scopeConfig.applicationScopeOptions,
    [scopeConfig.applicationScopeOptions]
  );

  const osiScopeOptions = useMemo(
    () => scopeConfig.osiLayerOptions,
    [scopeConfig.osiLayerOptions]
  );

  const assetGroupScopeOptions = useMemo(
    () => Array.from(new Set(workspace.assets.map(asset => asset.category.trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
    [workspace.assets]
  );

  const diagramScopeOptions = useMemo(() => {
    const ids = new Set<string>();
    if (diagramSnapshot?.diagramId) {
      ids.add(diagramSnapshot.diagramId);
    }
    workspace.risks.forEach(risk => {
      risk.diagramLinks.forEach(link => {
        if (link.diagramId) {
          ids.add(link.diagramId);
        }
      });
    });
    return Array.from(ids).sort((a, b) => a.localeCompare(b));
  }, [diagramSnapshot?.diagramId, workspace.risks]);

  const resolveScopeValueOptions = useCallback((scopeType: AssessmentScopeType): string[] => {
    if (scopeType === 'system') {
      return systemScopeOptions.length > 0 ? systemScopeOptions : ['Whole System'];
    }
    if (scopeType === 'diagram') {
      return diagramScopeOptions;
    }
    if (scopeType === 'diagram_segment') {
      return zoneScopeOptions;
    }
    if (scopeType === 'asset_group') {
      return assetGroupScopeOptions;
    }
    if (scopeType === 'application') {
      return applicationScopeOptions;
    }
    if (scopeType === 'osi_layer') {
      return osiScopeOptions;
    }
    return [];
  }, [systemScopeOptions, applicationScopeOptions, assetGroupScopeOptions, diagramScopeOptions, osiScopeOptions, zoneScopeOptions]);

  const newScopeValueOptions = useMemo(
    () => resolveScopeValueOptions(newScopeType),
    [newScopeType, resolveScopeValueOptions]
  );

  const activeScopeValueOptions = useMemo(
    () => resolveScopeValueOptions(activeScopeType),
    [activeScopeType, resolveScopeValueOptions]
  );

  const soaEntryDetails = useMemo<SoaEntryDetail[]>(() => workspace.soaEntries.map(entry => {
    const controlSet = controlSetById.get(entry.controlSetId);
    const controlTitle = controlSet?.controls.find(control => control.controlId === entry.controlId)?.title;
    const implementedWithoutEvidence = entry.implementationStatus === 'implemented' && entry.evidence.length === 0;
    const isGap = entry.applicability !== 'not_applicable'
      && (entry.implementationStatus !== 'implemented' || implementedWithoutEvidence);
    const reason = entry.implementationStatus !== 'implemented'
      ? `implementation_${entry.implementationStatus}`
      : 'implemented_without_evidence';
    const label = `${entry.controlId}${controlTitle ? ` - ${controlTitle}` : ''} | scope=${entry.scopeType}:${entry.scopeId} | ${reason}`;

    return {
      id: entry.id,
      label,
      reason,
      isGap,
      implementationStatus: entry.implementationStatus,
      applicability: entry.applicability
    };
  }), [controlSetById, workspace.soaEntries]);

  const soaEntryDetailById = useMemo(
    () => new Map(soaEntryDetails.map(detail => [detail.id, detail])),
    [soaEntryDetails]
  );
  const soaGapOptions = useMemo(
    () => soaEntryDetails.filter(detail => detail.isGap),
    [soaEntryDetails]
  );

  const activeAssessment = useMemo(
    () => workspace.assessments.find(assessment => assessment.id === activeAssessmentId) || null,
    [activeAssessmentId, workspace.assessments]
  );

  const activeAssessmentTierCascade = useTierCascade(
    workspace.tierCatalogue,
    activeAssessment?.tierFilter ?? {}
  );
  const activeAssessmentTier4Options = useMemo(
    () => dedupeTierNodesByLabel([
      ...activeAssessmentTierCascade.tier4Options,
      ...buildDynamicTier4Options(activeAssessment?.tierFilter ?? {})
    ]),
    [activeAssessment?.tierFilter, activeAssessmentTierCascade.tier4Options, buildDynamicTier4Options]
  );
  const activeTierFilteredRisks = useMemo(() => {
    if (!activeAssessment) return [];
    return workspace.risks.filter(risk =>
      riskMatchesTierFilter({ tierPath: getEffectiveTierPathForRisk(risk) }, activeAssessment.tierFilter)
    );
  }, [activeAssessment, workspace.risks, getEffectiveTierPathForRisk]);

  const activeTierFilteredRiskIdSet = useMemo(
    () => new Set(activeTierFilteredRisks.map(risk => risk.id)),
    [activeTierFilteredRisks]
  );

  const activeAssessmentLinkedFindings = useMemo<AssessmentFindingLinkView[]>(() => {
    if (!activeAssessment) return [];
    const findingList = workspace.findings || [];
    const linkedRiskIdSet = new Set(activeAssessment.riskIds);
    const permittedRiskIdSet = new Set(
      activeAssessment.riskIds.filter(riskId => linkedRiskIdSet.has(riskId) && activeTierFilteredRiskIdSet.has(riskId))
    );

    return findingList
      .map(finding => {
        const matchedRiskIds = finding.linkedRiskIds.filter(riskId => permittedRiskIdSet.has(riskId));
        if (matchedRiskIds.length === 0) {
          return null;
        }
        const matchedRiskTitles = matchedRiskIds.map(riskId => riskById.get(riskId)?.title || riskId);
        return { finding, matchedRiskIds, matchedRiskTitles };
      })
      .filter((entry): entry is AssessmentFindingLinkView => Boolean(entry))
      .sort((a, b) => {
        const severityDiff = (findingSeverityOrder[a.finding.severity] ?? 99) - (findingSeverityOrder[b.finding.severity] ?? 99);
        if (severityDiff !== 0) return severityDiff;
        return a.finding.title.localeCompare(b.finding.title);
      });
  }, [activeAssessment, activeTierFilteredRiskIdSet, riskById, workspace.findings]);

  const autoLinkedTaskIds = useMemo(() => {
    if (!activeAssessment) return [];
    return workspace.workflowTasks
      .filter(task => task.assessmentId === activeAssessment.id)
      .map(task => task.id);
  }, [activeAssessment, workspace.workflowTasks]);

  useEffect(() => {
    if (!activeAssessment || autoLinkedTaskIds.length === 0) return;
    const existingSet = new Set(activeAssessment.taskIds);
    const missing = autoLinkedTaskIds.filter(id => !existingSet.has(id));
    if (missing.length === 0) return;
    const now = new Date().toISOString();
    const nextAssessments = workspace.assessments.map(assessment => {
      if (assessment.id !== activeAssessment.id) return assessment;
      return {
        ...assessment,
        taskIds: Array.from(new Set([...assessment.taskIds, ...missing])),
        updatedAt: now
      };
    });
    applyWorkspace({ ...workspace, assessments: nextAssessments });
  }, [activeAssessment, autoLinkedTaskIds, applyWorkspace, workspace]);

  useEffect(() => {
    if (!activeAssessment) {
      return;
    }
    const firstScope = activeAssessment.scopeItems[0];
    if (firstScope) {
      setActiveScopeType(firstScope.type);
      setActiveScopeValue(firstScope.value);
      setActiveScopeName(firstScope.name);
    }
  }, [activeAssessment]);

  useEffect(() => {
    if (!assessmentFocusRequest) {
      return;
    }

    const normalizedScopeValue = assessmentFocusRequest.scopeValue.trim().toLowerCase();
    const normalizedDiagramId = (assessmentFocusRequest.diagramId || '').trim().toLowerCase();
    const match = workspace.assessments.find(assessment => {
      const hasScope = assessment.scopeItems.some(scope =>
        scope.type === assessmentFocusRequest.scopeType
        && (scope.value || scope.name).trim().toLowerCase() === normalizedScopeValue
      );
      if (!hasScope) {
        return false;
      }
      if (!normalizedDiagramId) {
        return true;
      }
      return assessment.scopeItems.some(scope =>
        scope.type === 'diagram' && (scope.value || scope.name).trim().toLowerCase() === normalizedDiagramId
      );
    });

    if (match) {
      setActiveAssessmentId(match.id);
      setStatusMessage({ severity: 'info', text: `Opened assessment "${match.title}" for scope ${assessmentFocusRequest.scopeValue}.` });
    } else {
      setStatusMessage({ severity: 'warning', text: `No assessment found for scope ${assessmentFocusRequest.scopeValue}.` });
    }
  }, [assessmentFocusRequest, setStatusMessage, workspace.assessments]);

  useEffect(() => {
    const handler = (event: Event) => {
      const { assessmentId } = (event as CustomEvent<{ assessmentId: string }>).detail;
      const match = workspace.assessments.find(a => a.id === assessmentId);
      if (match) {
        setActiveAssessmentId(match.id);
        setStatusMessage({ severity: 'info', text: `Opened assessment "${match.title}".` });
      }
    };
    window.addEventListener('grc-open-assessment-by-id', handler as EventListener);
    return () => window.removeEventListener('grc-open-assessment-by-id', handler as EventListener);
  }, [setStatusMessage, workspace.assessments]);

  const updateActiveAssessment = useCallback((patch: Partial<GrcAssessment>) => {
    if (!activeAssessmentId) {
      return;
    }

    const now = new Date().toISOString();
    const nextAssessments = workspace.assessments.map(assessment => {
      if (assessment.id !== activeAssessmentId) {
        return assessment;
      }

      const nextAssessment: GrcAssessment = {
        ...assessment,
        ...patch,
        updatedAt: now
      };

      if (patch.status === 'completed' && !nextAssessment.completedDate) {
        nextAssessment.completedDate = now.slice(0, 10);
      }

      return nextAssessment;
    });

    applyWorkspace({
      ...workspace,
      assessments: nextAssessments
    });
  }, [activeAssessmentId, applyWorkspace, workspace]);

  const addScopeItem = useCallback((currentItems: AssessmentScopeItem[], scopeType: AssessmentScopeType, value: string, name: string): AssessmentScopeItem[] => {
    const nextItem = makeScopeItem(scopeType, value, name);
    const nextSignature = scopeItemSignature(nextItem);
    const exists = currentItems.some(item => scopeItemSignature(item) === nextSignature);
    if (exists) {
      return currentItems;
    }
    return [...currentItems, nextItem];
  }, []);

  const removeScopeItemById = useCallback((currentItems: AssessmentScopeItem[], scopeId: string): AssessmentScopeItem[] =>
    currentItems.filter(scope => scope.id !== scopeId), []);

  const buildExportContext = useCallback((assessment: GrcAssessment): AssessmentExportContext => {
    const linkedRisks = assessment.riskIds
      .map(riskId => riskById.get(riskId))
      .filter((risk): risk is NonNullable<typeof risk> => Boolean(risk))
      .map(risk => ({
        id: risk.id,
        title: risk.title,
        status: risk.status,
        ratingLabel: risk.inherentScore.ratingLabel,
        score: risk.inherentScore.rawScore,
        owner: risk.owner
      }));

    const linkedGaps = assessment.soaGapIds
      .map(gapId => soaEntryDetailById.get(gapId))
      .filter((detail): detail is SoaEntryDetail => Boolean(detail))
      .map(detail => ({
        id: detail.id,
        label: detail.label,
        reason: detail.reason,
        implementationStatus: detail.implementationStatus,
        applicability: detail.applicability
      }));

    const linkedTasks = assessment.taskIds
      .map(taskId => taskById.get(taskId))
      .filter((task): task is NonNullable<typeof task> => Boolean(task))
      .map(task => ({
        id: task.id,
        title: task.title,
        status: task.status,
        priority: task.priority,
        owner: task.owner
      }));

    const linkedAssetIdSet = new Set<string>();
    linkedRisks.forEach(risk => {
      const workspaceRisk = riskById.get(risk.id);
      workspaceRisk?.assetIds.forEach(assetId => linkedAssetIdSet.add(assetId));
    });
    linkedTasks.forEach(task => {
      const workspaceTask = taskById.get(task.id);
      if (workspaceTask?.assetId) {
        linkedAssetIdSet.add(workspaceTask.assetId);
      }
    });

    const linkedAssets = Array.from(linkedAssetIdSet)
      .map(assetId => assetById.get(assetId))
      .filter((asset): asset is NonNullable<typeof asset> => Boolean(asset))
      .map(asset => ({
        id: asset.id,
        name: asset.name,
        domain: asset.domain.toUpperCase(),
        category: asset.category,
        businessCriticality: `${asset.businessCriticality} (${getAssetCriticalityLabel(workspace, asset.businessCriticality)})`,
        securityCriticality: `${asset.securityCriticality} (${getAssetCriticalityLabel(workspace, asset.securityCriticality)})`,
        owner: asset.owner
      }));

    return {
      generatedAt: new Date().toISOString(),
      assessment,
      scopeSummary: summarizeAssessmentScopes(assessment),
      tierFilterSummary: buildTierFilterSummary(assessment.tierFilter),
      linkedAssets,
      linkedRisks,
      linkedGaps,
      linkedTasks
    };
  }, [assetById, riskById, soaEntryDetailById, taskById, workspace]);

  const activeAssessmentContext = useMemo(
    () => (activeAssessment ? buildExportContext(activeAssessment) : null),
    [activeAssessment, buildExportContext]
  );

  const exportActiveAssessmentAsText = useCallback(async () => {
    if (!activeAssessment) {
      setStatusMessage({ severity: 'warning', text: 'Open an assessment workspace before exporting.' });
      return;
    }
    const context = buildExportContext(activeAssessment);
    const saved = await downloadText(
      `${toSlug(activeAssessment.title) || activeAssessment.id}-assessment.txt`,
      buildAssessmentText(context),
      'text/plain;charset=utf-8'
    );
    if (saved) setStatusMessage({ severity: 'success', text: `Exported "${activeAssessment.title}" as text.` });
  }, [activeAssessment, buildExportContext, setStatusMessage]);

  const exportActiveAssessmentAsHtml = useCallback(async () => {
    if (!activeAssessment) {
      setStatusMessage({ severity: 'warning', text: 'Open an assessment workspace before exporting.' });
      return;
    }
    const context = buildExportContext(activeAssessment);
    const saved = await downloadText(
      `${toSlug(activeAssessment.title) || activeAssessment.id}-assessment.html`,
      buildAssessmentHtml(context),
      'text/html;charset=utf-8'
    );
    if (saved) setStatusMessage({ severity: 'success', text: `Exported "${activeAssessment.title}" as HTML.` });
  }, [activeAssessment, buildExportContext, setStatusMessage]);

  const exportActiveAssessmentAsPdf = useCallback(async () => {
    if (!activeAssessment) {
      setStatusMessage({ severity: 'warning', text: 'Open an assessment workspace before exporting.' });
      return;
    }

    const saved = await saveExport(`${toSlug(activeAssessment.title) || activeAssessment.id}-assessment.pdf`, async () => {
      const { default: jsPDF } = await import('jspdf');
      const context = buildExportContext(activeAssessment);
      const reportText = buildAssessmentText(context);
      const pdf = new jsPDF('p', 'mm', 'a4');
      const margin = 12;
      const contentWidth = pdf.internal.pageSize.getWidth() - (margin * 2);
      const pageHeight = pdf.internal.pageSize.getHeight();
      let y = margin;

      const addWrappedText = (value: string, fontSize = 10, bold = false) => {
        pdf.setFont('helvetica', bold ? 'bold' : 'normal');
        pdf.setFontSize(fontSize);
        const lines = pdf.splitTextToSize(value, contentWidth) as string[];
        lines.forEach(line => {
          if (y > pageHeight - margin) {
            pdf.addPage();
            y = margin;
          }
          pdf.text(line, margin, y);
          y += fontSize * 0.45 + 1.5;
        });
      };

      addWrappedText(`Assessment Report: ${activeAssessment.title}`, 14, true);
      y += 2;
      reportText.split('\n').slice(1).forEach(line => {
        if (!line.trim()) {
          y += 2;
          return;
        }
        const isSectionTitle =
          line === 'Assessment Details'
          || line === 'Risk Management Plan'
          || line === 'Summary'
          || line === 'Methodology'
          || line === 'Assumptions'
          || line === 'Findings'
          || line === 'Recommendations'
          || line === 'Evidence Summary'
          || line === 'Threat Model & Attack Paths'
          || line === 'Attack Path Traversal'
          || line === 'Attack Path Description'
          || line.startsWith('Linked Assets')
          || line.startsWith('Linked Risks')
          || line.startsWith('Linked Compliance Gaps')
          || line.startsWith('Linked Workflow Tasks');
        addWrappedText(line, isSectionTitle ? 11 : 10, isSectionTitle);
      });

      return pdf.output('blob');
    });
    if (saved) setStatusMessage({ severity: 'success', text: `Exported "${activeAssessment.title}" as PDF.` });
  }, [activeAssessment, buildExportContext, setStatusMessage]);

  const handleCreateAssessment = useCallback(() => {
    const title = newAssessmentTitle.trim();
    if (!title) {
      setStatusMessage({ severity: 'warning', text: 'Assessment title is required.' });
      return;
    }

    const scopeItems = newScopeItems.length > 0
      ? newScopeItems
      : [makeScopeItem(newScopeType, newScopeValue, newScopeName)];

    const now = new Date().toISOString();
    const assessment: GrcAssessment = {
      id: createId('assessment'),
      title,
      status: 'draft',
      scopeItems,
      tierFilter: normalizeTierFilter(newTierFilter),
      riskManagementPlan: {
        objective: undefined,
        strategy: undefined,
        residualRiskStatement: undefined,
        monitoringApproach: undefined,
        communicationPlan: undefined,
        reviewCadenceDays: undefined,
        actions: [],
        updatedAt: now
      },
      threatModel: {
        nodes: [],
        edges: [],
        updatedAt: now
      },
      owner: undefined,
      reviewer: undefined,
      startDate: now.slice(0, 10),
      dueDate: undefined,
      completedDate: undefined,
      methodologyNote: undefined,
      assumptionNote: undefined,
      riskIds: [...selectedRiskIds],
      threatActorIds: newThreatActorIds.length > 0 ? [...newThreatActorIds] : undefined,
      soaGapIds: [],
      taskIds: [],
      linkedImplementedControlIds: [],
      linkedInitiativeIds: [],
      summary: newAssessmentSummary.trim() || undefined,
      businessUnit: newAssessmentBusinessUnit.trim() || undefined,
      findings: undefined,
      recommendations: undefined,
      evidenceSummary: undefined,
      createdAt: now,
      updatedAt: now
    };

    applyWorkspace({
      ...workspace,
      assessments: [...workspace.assessments, assessment]
    });
    setActiveAssessmentId(assessment.id);
    setNewAssessmentTitle('');
    setNewAssessmentSummary('');
    setNewAssessmentBusinessUnit('');
    setSelectedRiskIds([]);
    setCreateFormOpen(false);
    setStatusMessage({ severity: 'success', text: `Created assessment workspace "${title}".` });
  }, [
    applyWorkspace,
    newAssessmentBusinessUnit,
    newAssessmentSummary,
    newAssessmentTitle,
    newScopeItems,
    newScopeName,
    newScopeType,
    newScopeValue,
    newTierFilter,
    selectedRiskIds,
    setStatusMessage,
    workspace
  ]);

  const handleAssessmentStatusChange = useCallback((assessmentId: string, status: AssessmentStatus) => {
    const now = new Date().toISOString();
    const nextAssessments = workspace.assessments.map(assessment => {
      if (assessment.id !== assessmentId) {
        return assessment;
      }
      return {
        ...assessment,
        status,
        completedDate:
          status === 'completed'
            ? (assessment.completedDate || now.slice(0, 10))
            : assessment.completedDate,
        updatedAt: now
      };
    });
    applyWorkspace({ ...workspace, assessments: nextAssessments });
  }, [applyWorkspace, workspace]);

  const handleDeleteAssessment = useCallback((assessmentId: string) => {
    const target = workspace.assessments.find(a => a.id === assessmentId);
    const nextAssessments = workspace.assessments.filter(a => a.id !== assessmentId);
    applyWorkspace({ ...workspace, assessments: nextAssessments });
    if (activeAssessmentId === assessmentId) {
      setActiveAssessmentId(nextAssessments[0]?.id ?? null);
    }
    setDeleteConfirmId(null);
    if (target) {
      setStatusMessage({ severity: 'success', text: `Deleted assessment "${target.title}".` });
    }
  }, [activeAssessmentId, applyWorkspace, setStatusMessage, workspace]);

  const deleteTargetTitle = useMemo(
    () => workspace.assessments.find(a => a.id === deleteConfirmId)?.title || '',
    [deleteConfirmId, workspace.assessments]
  );

  const renderTierSelect = (
    label: string,
    tooltip: string,
    value: string | undefined,
    options: RiskTierNode[],
    onChange: (value: string | undefined) => void,
    clearDownstream?: () => void
  ) => (
    <Tooltip describeChild title={tooltip} arrow>
      <FormControl size="small" fullWidth>
        <InputLabel>{label}</InputLabel>
        <Select
          value={value || ''}
          label={label}
          onChange={e => {
            const next = e.target.value || undefined;
            onChange(next);
            if (clearDownstream) clearDownstream();
          }}
        >
          <MenuItem value="">
            <em>Any</em>
          </MenuItem>
          {options.map(node => (
            <MenuItem key={node.id} value={node.label}>{node.label}</MenuItem>
          ))}
        </Select>
      </FormControl>
    </Tooltip>
  );

  return (
    <Box sx={{ display: 'grid', gap: 2 }}>
      <Paper sx={cardSx}>
        <Box
          sx={{ display: 'flex', alignItems: 'center', gap: 1, cursor: 'pointer', userSelect: 'none' }}
          onClick={() => setCreateFormOpen(prev => !prev)}
        >
          {createFormOpen ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
          <Typography variant="h6">New Assessment</Typography>
        </Box>
        <Collapse in={createFormOpen}>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1, mb: 1.5 }}>
          Build multi-scope assessments, apply optional risk tier filters, then create a one-to-one Risk Management Plan in the next tab.
        </Typography>

        <SectionHeader label="Step 1: Assessment Details" />
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 1.5 }}>
          <Tooltip describeChild title="Name for this assessment workspace (e.g., 'Q1 2026 DMZ Security Review')" arrow>
            <TextField
              size="small"
              label="Assessment Title"
              value={newAssessmentTitle}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewAssessmentTitle(e.target.value)}
            />
          </Tooltip>
          <Tooltip describeChild title="Brief description of the assessment purpose and objectives" arrow>
            <TextField
              size="small"
              label="Summary"
              value={newAssessmentSummary}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewAssessmentSummary(e.target.value)}
            />
          </Tooltip>
          {(() => {
            const bus = getConfig(workspace).businessUnits || [];
            return bus.length > 0 ? (
              <Tooltip describeChild title="Business unit this assessment is associated with" arrow>
                <TextField
                  size="small"
                  select
                  label="Business Unit"
                  value={newAssessmentBusinessUnit}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewAssessmentBusinessUnit(e.target.value)}
                >
                  <MenuItem value=""><em>None</em></MenuItem>
                  {bus.map(bu => (
                    <MenuItem key={bu} value={bu}>{bu}</MenuItem>
                  ))}
                </TextField>
              </Tooltip>
            ) : null;
          })()}
        </Box>

        <SectionHeader label="Step 2: Define Scope" />
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 1.5 }}>
          <Tooltip describeChild title="What are you assessing? System = entire system, Security Zone = a diagram segment, Application = specific app, OSI Layer = network layer focus" arrow>
            <TextField
              size="small"
              select
              label="Scope Type"
              value={newScopeType}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                const nextType = e.target.value as AssessmentScopeType;
                setNewScopeType(nextType);
                const options = resolveScopeValueOptions(nextType);
                if (options.length > 0) {
                  setNewScopeValue(options[0]);
                  setNewScopeName(options[0]);
                }
                if (nextType === 'system') {
                  setNewScopeItems(current => addScopeItem(current, 'system', 'system', 'System'));
                }
              }}
            >
              {enabledScopeTypes.map(scopeType => (
                <MenuItem key={scopeType} value={scopeType}>{assessmentScopeTypeLabels[scopeType]}</MenuItem>
              ))}
            </TextField>
          </Tooltip>
          {newScopeType !== 'system' && (
            <Tooltip describeChild title="Specific identifier for the scope (e.g., zone name, app name)" arrow>
              <TextField
                size="small"
                select={newScopeValueOptions.length > 0}
                label="Scope Value"
                value={newScopeValue}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewScopeValue(e.target.value)}
              >
                {newScopeValueOptions.map(option => (
                  <MenuItem key={option} value={option}>{option}</MenuItem>
                ))}
              </TextField>
            </Tooltip>
          )}
          {newScopeType !== 'system' && (
            <Tooltip describeChild title="Display name for this scope item" arrow>
              <TextField
                size="small"
                label="Scope Name"
                value={newScopeName}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewScopeName(e.target.value)}
              />
            </Tooltip>
          )}
          {newScopeType !== 'system' && (
            <Tooltip describeChild title="Add this scope item to the assessment scope set." arrow>
              <Button
                variant="outlined"
                onClick={() => {
                  const nextItems = addScopeItem(newScopeItems, newScopeType, newScopeValue, newScopeName);
                  if (nextItems.length === newScopeItems.length) {
                    setStatusMessage({ severity: 'info', text: 'Scope item already added.' });
                    return;
                  }
                  setNewScopeItems(nextItems);
                }}
              >
                Add Scope Item
              </Button>
            </Tooltip>
          )}
        </Box>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1.5 }}>
          {newScopeItems.map(scopeItem => (
            <Chip
              key={scopeItem.id}
              label={`${assessmentScopeTypeLabels[scopeItem.type]}: ${scopeItem.name}`}
              size="small"
              variant="outlined"
              onDelete={() => setNewScopeItems(current => removeScopeItemById(current, scopeItem.id))}
            />
          ))}
          {newScopeItems.length === 0 && (
            <Typography variant="caption" color="text.secondary">No scope items added yet.</Typography>
          )}
        </Box>
        <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
          Added scope items define what this assessment covers.
        </Typography>

        <SectionHeader label="Step 3: Tier Filters (Optional)" />
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 1.5 }}>
          {renderTierSelect(
            'Tier 1 Filter',
            'Filter risks by taxonomy tier to narrow scope. Leave empty to include all tiers',
            newTierFilter.tier1,
            newTierCascade.tier1Options,
            value => setNewTierFilter(current => ({ ...current, tier1: value, tier2: undefined, tier3: undefined, tier4: undefined }))
          )}
          {renderTierSelect(
            'Tier 2 Filter',
            'Filter risks by taxonomy tier to narrow scope. Leave empty to include all tiers',
            newTierFilter.tier2,
            newTierCascade.tier2Options,
            value => setNewTierFilter(current => ({ ...current, tier2: value, tier3: undefined, tier4: undefined }))
          )}
          {renderTierSelect(
            'Tier 3 Filter',
            'Filter risks by taxonomy tier to narrow scope. Leave empty to include all tiers',
            newTierFilter.tier3,
            newTierCascade.tier3Options,
            value => setNewTierFilter(current => ({ ...current, tier3: value, tier4: undefined }))
          )}
          {renderTierSelect(
            'Tier 4 Filter',
            'Filter risks by taxonomy tier to narrow scope. Leave empty to include all tiers',
            newTierFilter.tier4,
            newTier4Options,
            value => setNewTierFilter(current => ({ ...current, tier4: value }))
          )}
        </Box>

        <SectionHeader label="Step 4: Link Risks" />
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 1.5 }}>
          <Tooltip describeChild title="Select risks to include in this assessment" arrow disableInteractive>
            <FormControl size="small">
              <InputLabel id="assessment-risks-label">Add Risk</InputLabel>
              <Select
                labelId="assessment-risks-label"
                value=""
                label="Add Risk"
                onChange={e => {
                  const riskId = e.target.value as string;
                  if (riskId && !selectedRiskIds.includes(riskId)) {
                    setSelectedRiskIds(current => [...current, riskId]);
                  }
                }}
              >
                {newTierFilteredRisks
                  .filter(risk => !selectedRiskIds.includes(risk.id))
                  .map(risk => (
                    <MenuItem key={risk.id} value={risk.id}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
                        <Typography variant="body2" sx={{ flex: 1 }}>{risk.title}</Typography>
                        <Chip
                          label={risk.inherentScore.ratingLabel}
                          size="small"
                          sx={{
                            backgroundColor: risk.inherentScore.color || severityColor(risk.inherentScore.ratingLabel),
                            color: '#fff',
                            fontWeight: 600,
                            fontSize: '0.7rem',
                            height: 20
                          }}
                        />
                      </Box>
                    </MenuItem>
                  ))}
              </Select>
            </FormControl>
          </Tooltip>
          {selectedRiskIds.length > 0 && (
            <Tooltip describeChild title="Remove all linked risks" arrow>
              <Button variant="text" size="small" color="error" onClick={() => setSelectedRiskIds([])}>
                Clear All
              </Button>
            </Tooltip>
          )}
        </Box>
        {newTierFilteredRisks.length === 0 && (
          <Typography variant="caption" color="text.secondary">
            No risks currently match the selected tier filter. Clear or broaden the tier filter to include more risks.
          </Typography>
        )}
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mt: 1 }}>
          {selectedRiskIds.map(riskId => {
            const risk = riskById.get(riskId);
            return (
              <Chip
                key={riskId}
                label={risk ? `${risk.title} (${risk.inherentScore.ratingLabel})` : riskId}
                size="small"
                variant="outlined"
                sx={{
                  borderColor: risk ? (risk.inherentScore.color || severityColor(risk.inherentScore.ratingLabel)) : undefined,
                  fontWeight: 500
                }}
                onDelete={() => setSelectedRiskIds(current => current.filter(id => id !== riskId))}
              />
            );
          })}
          {selectedRiskIds.length === 0 && (
            <Typography variant="caption" color="text.secondary">No risks linked yet. Use the dropdown above to add risks.</Typography>
          )}
        </Box>

        {threatActors.length > 0 && (
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 1.5, mt: 1.5 }}>
            <Tooltip describeChild title="Threat actors considered in scope for this assessment" arrow>
              <FormControl size="small">
                <InputLabel>Threat Actors</InputLabel>
                <Select
                  multiple
                  value={newThreatActorIds}
                  onChange={e => {
                    const value = e.target.value;
                    setNewThreatActorIds(typeof value === 'string' ? value.split(',') : (value as string[]));
                  }}
                  input={<OutlinedInput label="Threat Actors" />}
                  renderValue={selected =>
                    (selected as string[])
                      .map(id => threatActors.find(a => a.id === id)?.name || id)
                      .join(', ')
                  }
                >
                  {threatActors.map(actor => (
                    <MenuItem key={actor.id} value={actor.id}>{actor.name}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Tooltip>
          </Box>
        )}

        <Box sx={{ mt: 2 }}>
          <Tooltip describeChild title="Create a new assessment workspace with scope set, tier filter, and linked risks." arrow>
            <Button variant="contained" startIcon={<FilePlus size={16} />} onClick={handleCreateAssessment}>
              Create Assessment
            </Button>
          </Tooltip>
        </Box>
        </Collapse>
      </Paper>

      {workspace.assessments.length === 0 && (
        <Paper sx={{ ...cardSx, textAlign: 'center', py: 4 }}>
          <Typography variant="h6" sx={{ mb: 1 }}>No assessments created yet</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 600, mx: 'auto' }}>
            Assessments are scoped review workspaces where you evaluate risks, compliance gaps, and treatment effectiveness.
          </Typography>
          <Box sx={{ mt: 2, textAlign: 'left', maxWidth: 520, mx: 'auto' }}>
            <Typography variant="body2" color="text.secondary" component="ul" sx={{ pl: 2 }}>
              <li>Define a scope (system-wide, security zone, application, or OSI layer)</li>
              <li>Optionally filter by risk taxonomy tiers</li>
              <li>Link risks and compliance gaps for structured evaluation</li>
              <li>Create a Risk Management Plan (SRMP) in the next tab</li>
            </Typography>
          </Box>
        </Paper>
      )}

      {workspace.assessments.length > 0 && (
        <Box sx={{ display: 'grid', gap: 2 }}>
          <Paper sx={cardSx}>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Assessments ({workspace.assessments.length})
            </Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 1.5 }}>
              {workspace.assessments.map(assessment => {
                const isActive = assessment.id === activeAssessmentId;
                const assessmentHealth = computeAssessmentHealth(assessment, workspace);
                return (
                  <Paper
                    key={assessment.id}
                    variant="outlined"
                    onClick={() => setActiveAssessmentId(assessment.id)}
                    sx={{
                      p: 1.5,
                      cursor: 'pointer',
                      borderColor: isActive ? 'primary.main' : 'divider',
                      borderWidth: isActive ? 2 : 1,
                      '&:hover': { borderColor: 'primary.light' },
                      transition: 'border-color 0.15s'
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Tooltip title={assessmentHealth.reasons.join('; ') || 'Healthy'} arrow>
                        <Box component="span" sx={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
                          bgcolor: assessmentHealth.level === 'red' ? '#dc2626' : assessmentHealth.level === 'yellow' ? '#ca8a04' : '#16a34a',
                          flexShrink: 0 }} />
                      </Tooltip>
                      <Typography variant="body2" sx={{ flex: 1, fontWeight: isActive ? 700 : 500 }}>
                        {assessment.title}
                      </Typography>
                      <TextField
                        select
                        size="small"
                        value={assessment.status}
                        onClick={e => e.stopPropagation()}
                        onChange={e => {
                          e.stopPropagation();
                          handleAssessmentStatusChange(assessment.id, e.target.value as AssessmentStatus);
                        }}
                        sx={{ minWidth: 110, '& .MuiInputBase-input': { py: 0.5, fontSize: '0.75rem' } }}
                      >
                        <MenuItem value="draft">Draft</MenuItem>
                        <MenuItem value="in_review">In Review</MenuItem>
                        <MenuItem value="completed">Completed</MenuItem>
                        <MenuItem value="archived">Archived</MenuItem>
                      </TextField>
                      <Tooltip describeChild title="Delete this assessment permanently." arrow>
                        <IconButton
                          size="small"
                          color="error"
                          onClick={e => { e.stopPropagation(); setDeleteConfirmId(assessment.id); }}
                        >
                          <Trash2 size={14} />
                        </IconButton>
                      </Tooltip>
                    </Box>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.75 }}>
                      {assessment.scopeItems.map(scopeItem => (
                        <Chip
                          key={scopeItem.id}
                          label={`${assessmentScopeTypeLabels[scopeItem.type]}: ${scopeItem.name}`}
                          size="small"
                          variant="outlined"
                          sx={{ fontSize: '0.65rem', height: 20 }}
                        />
                      ))}
                    </Box>
                    {assessment.startDate && (
                      <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                        Started: {toDisplayDate(assessment.startDate)}
                      </Typography>
                    )}
                  </Paper>
                );
              })}
            </Box>
          </Paper>

          <Paper sx={cardSx}>
            <Typography variant="h6" sx={{ mb: 1 }}>Assessment Workspace</Typography>
            {!activeAssessment && (
              <Typography variant="body2" color="text.secondary">
                Click an assessment card above to open its workspace.
              </Typography>
            )}

            {activeAssessment && (
              <Box sx={{ display: 'grid', gap: 1.5 }}>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                  <Chip size="small" color="primary" variant="outlined" label={`Linked Risks: ${activeAssessment.riskIds.length}`}
                    onClick={() => document.getElementById('assessment-section-linked-risks')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                    sx={{ cursor: 'pointer' }} />
                  <Chip size="small" color="warning" variant="outlined" label={`Related Findings: ${activeAssessmentLinkedFindings.length}`}
                    onClick={() => document.getElementById('assessment-section-related-findings')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                    sx={{ cursor: 'pointer' }} />
                  <Chip size="small" color="info" variant="outlined" label={`Compliance Gaps: ${activeAssessment.soaGapIds.length}`}
                    onClick={() => document.getElementById('assessment-section-compliance-gaps')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                    sx={{ cursor: 'pointer' }} />
                  <Chip size="small" color="secondary" variant="outlined" label={`Workflow Tasks: ${activeAssessment.taskIds.length}`}
                    onClick={() => document.getElementById('assessment-section-workflow-tasks')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                    sx={{ cursor: 'pointer' }} />
                  {(activeAssessment.threatActorIds?.length ?? 0) > 0 && (
                    <Chip size="small" color="error" variant="outlined" label={`Threat Actors: ${activeAssessment.threatActorIds!.length}`}
                      onClick={() => document.getElementById('assessment-section-threat-actors')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                      sx={{ cursor: 'pointer' }} />
                  )}
                  <Chip size="small" color="primary" variant="outlined" label={`Controls: ${(activeAssessment.linkedImplementedControlIds || []).length}`} onClick={() => document.getElementById('assessment-section-linked-controls')?.scrollIntoView({ behavior: 'smooth', block: 'start' })} sx={{ cursor: 'pointer' }} />
                  <Chip size="small" color="primary" variant="outlined" label={`Initiatives: ${(activeAssessment.linkedInitiativeIds || []).length}`} onClick={() => document.getElementById('assessment-section-linked-initiatives')?.scrollIntoView({ behavior: 'smooth', block: 'start' })} sx={{ cursor: 'pointer' }} />
                </Box>
                <Typography variant="caption" color="text.secondary">
                  Tier filters are applied to risks; findings appear here when they are linked to those filtered risks.
                </Typography>

                <SectionHeader label="Details & Ownership" />
                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 1.5 }}>
                  <Tooltip describeChild title="Name for this assessment workspace (e.g., 'Q1 2026 DMZ Security Review')" arrow>
                    <TextField
                      size="small"
                      label="Assessment Title"
                      value={activeAssessment.title}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateActiveAssessment({ title: e.target.value })}
                    />
                  </Tooltip>
                  <Tooltip describeChild title="Current lifecycle status for this assessment workspace." arrow>
                    <TextField
                      size="small"
                      select
                      label="Status"
                      value={activeAssessment.status}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        updateActiveAssessment({ status: e.target.value as AssessmentStatus })
                      }
                    >
                      <MenuItem value="draft">Draft</MenuItem>
                      <MenuItem value="in_review">In Review</MenuItem>
                      <MenuItem value="completed">Completed</MenuItem>
                      <MenuItem value="archived">Archived</MenuItem>
                    </TextField>
                  </Tooltip>
                  <Tooltip describeChild title="Person leading this assessment" arrow>
                    <TextField
                      size="small"
                      label="Owner"
                      value={activeAssessment.owner || ''}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        updateActiveAssessment({ owner: e.target.value.trim() || undefined })
                      }
                    />
                  </Tooltip>
                  {(() => {
                    const bus = getConfig(workspace).businessUnits || [];
                    return bus.length > 0 ? (
                      <Tooltip describeChild title="Business unit this assessment is associated with" arrow>
                        <TextField
                          size="small"
                          select
                          label="Business Unit"
                          value={activeAssessment.businessUnit || ''}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                            updateActiveAssessment({ businessUnit: e.target.value || undefined })
                          }
                        >
                          <MenuItem value=""><em>None</em></MenuItem>
                          {bus.map(bu => (
                            <MenuItem key={bu} value={bu}>{bu}</MenuItem>
                          ))}
                        </TextField>
                      </Tooltip>
                    ) : (
                      <Tooltip describeChild title="Business unit this assessment is associated with" arrow>
                        <TextField
                          size="small"
                          label="Business Unit"
                          value={activeAssessment.businessUnit || ''}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                            updateActiveAssessment({ businessUnit: e.target.value.trim() || undefined })
                          }
                        />
                      </Tooltip>
                    );
                  })()}
                </Box>
                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 1.5 }}>
                  <Tooltip describeChild title="Person reviewing and approving assessment findings" arrow>
                    <TextField
                      size="small"
                      label="Reviewer"
                      value={activeAssessment.reviewer || ''}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        updateActiveAssessment({ reviewer: e.target.value.trim() || undefined })
                      }
                    />
                  </Tooltip>
                  <Tooltip describeChild title="Date the assessment work begins" arrow>
                    <TextField
                      size="small"
                      type="date"
                      label="Start Date"
                      InputLabelProps={{ shrink: true }}
                      value={toDateInputValue(activeAssessment.startDate)}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        updateActiveAssessment({ startDate: e.target.value || undefined })
                      }
                    />
                  </Tooltip>
                  <Tooltip describeChild title="Target completion date for the assessment" arrow>
                    <TextField
                      size="small"
                      type="date"
                      label="Target Date"
                      InputLabelProps={{ shrink: true }}
                      value={toDateInputValue(activeAssessment.dueDate)}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        updateActiveAssessment({ dueDate: e.target.value || undefined })
                      }
                    />
                  </Tooltip>
                  <Tooltip describeChild title="Date the assessment was completed and signed off" arrow>
                    <TextField
                      size="small"
                      type="date"
                      label="Completed Date"
                      InputLabelProps={{ shrink: true }}
                      value={toDateInputValue(activeAssessment.completedDate)}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        updateActiveAssessment({ completedDate: e.target.value || undefined })
                      }
                    />
                  </Tooltip>
                </Box>

                <SectionHeader label="Scope & Filters" />
                <Typography variant="subtitle2">Assessment Scope Items</Typography>
                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 1.5 }}>
                  <Tooltip describeChild title="What are you assessing? System = entire system, Security Zone = a diagram segment, Application = specific app, OSI Layer = network layer focus" arrow>
                    <TextField
                      size="small"
                      select
                      label="Scope Type"
                      value={activeScopeType}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                        const nextType = e.target.value as AssessmentScopeType;
                        setActiveScopeType(nextType);
                        const options = resolveScopeValueOptions(nextType);
                        if (options.length > 0) {
                          setActiveScopeValue(options[0]);
                          setActiveScopeName(options[0]);
                        }
                      }}
                    >
                      {enabledScopeTypes.map(scopeType => (
                        <MenuItem key={scopeType} value={scopeType}>{assessmentScopeTypeLabels[scopeType]}</MenuItem>
                      ))}
                    </TextField>
                  </Tooltip>
                  <Tooltip describeChild title="Specific identifier for the scope (e.g., zone name, app name)" arrow>
                    <TextField
                      size="small"
                      select={activeScopeValueOptions.length > 0}
                      label="Scope Value"
                      value={activeScopeValue}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setActiveScopeValue(e.target.value)}
                    >
                      {activeScopeValueOptions.map(option => (
                        <MenuItem key={option} value={option}>{option}</MenuItem>
                      ))}
                    </TextField>
                  </Tooltip>
                  <Tooltip describeChild title="Display name for this scope item" arrow>
                    <TextField
                      size="small"
                      label="Scope Name"
                      value={activeScopeName}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setActiveScopeName(e.target.value)}
                    />
                  </Tooltip>
                  <Tooltip describeChild title="Append scope item to this assessment." arrow>
                    <Button
                      variant="outlined"
                      onClick={() => {
                        const nextScopeItems = addScopeItem(activeAssessment.scopeItems, activeScopeType, activeScopeValue, activeScopeName);
                        if (nextScopeItems.length === activeAssessment.scopeItems.length) {
                          setStatusMessage({ severity: 'info', text: 'Scope item already exists on this assessment.' });
                          return;
                        }
                        updateActiveAssessment({ scopeItems: nextScopeItems });
                      }}
                    >
                      Add Scope Item
                    </Button>
                  </Tooltip>
                </Box>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  {activeAssessment.scopeItems.map(scopeItem => (
                    <Chip
                      key={scopeItem.id}
                      label={`${assessmentScopeTypeLabels[scopeItem.type]}: ${scopeItem.name}`}
                      size="small"
                      variant="outlined"
                      onDelete={() => updateActiveAssessment({ scopeItems: removeScopeItemById(activeAssessment.scopeItems, scopeItem.id) })}
                    />
                  ))}
                </Box>

                <Typography variant="subtitle2" sx={{ mt: 1 }}>Risk Tier Filter</Typography>
                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 1.5 }}>
                  {renderTierSelect(
                    'Tier 1 Filter',
                    'Filter risks by taxonomy tier to narrow scope. Leave empty to include all tiers',
                    activeAssessment.tierFilter.tier1,
                    activeAssessmentTierCascade.tier1Options,
                    value => updateActiveAssessment({
                      tierFilter: { ...activeAssessment.tierFilter, tier1: value, tier2: undefined, tier3: undefined, tier4: undefined }
                    })
                  )}
                  {renderTierSelect(
                    'Tier 2 Filter',
                    'Filter risks by taxonomy tier to narrow scope. Leave empty to include all tiers',
                    activeAssessment.tierFilter.tier2,
                    activeAssessmentTierCascade.tier2Options,
                    value => updateActiveAssessment({
                      tierFilter: { ...activeAssessment.tierFilter, tier2: value, tier3: undefined, tier4: undefined }
                    })
                  )}
                  {renderTierSelect(
                    'Tier 3 Filter',
                    'Filter risks by taxonomy tier to narrow scope. Leave empty to include all tiers',
                    activeAssessment.tierFilter.tier3,
                    activeAssessmentTierCascade.tier3Options,
                    value => updateActiveAssessment({
                      tierFilter: { ...activeAssessment.tierFilter, tier3: value, tier4: undefined }
                    })
                  )}
                  {renderTierSelect(
                    'Tier 4 Filter',
                    'Filter risks by taxonomy tier to narrow scope. Leave empty to include all tiers',
                    activeAssessment.tierFilter.tier4,
                    activeAssessmentTier4Options,
                    value => updateActiveAssessment({
                      tierFilter: { ...activeAssessment.tierFilter, tier4: value }
                    })
                  )}
                </Box>

                <SectionHeader label="Findings & Evidence" />
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 1.5 }}>
                  <Tooltip describeChild title="Brief description of the assessment purpose and objectives" arrow>
                    <TextField
                      size="small"
                      multiline
                      minRows={2}
                      label="Summary"
                      value={activeAssessment.summary || ''}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                        const value = e.target.value;
                        updateActiveAssessment({ summary: value.length > 0 ? value : undefined });
                      }}
                    />
                  </Tooltip>
                  <Tooltip describeChild title="Document the assessment methodology, standards, or frameworks used" arrow>
                    <TextField
                      size="small"
                      multiline
                      minRows={2}
                      label="Methodology Notes"
                      value={activeAssessment.methodologyNote || ''}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                        const value = e.target.value;
                        updateActiveAssessment({ methodologyNote: value.length > 0 ? value : undefined });
                      }}
                    />
                  </Tooltip>
                </Box>
                <Tooltip describeChild title="Key assumptions made during the assessment" arrow>
                  <TextField
                    size="small"
                    multiline
                    minRows={2}
                    label="Assumptions"
                    value={activeAssessment.assumptionNote || ''}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                      const value = e.target.value;
                      updateActiveAssessment({ assumptionNote: value.length > 0 ? value : undefined });
                    }}
                  />
                </Tooltip>
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 1.5 }}>
                  <Tooltip describeChild title="Detailed findings from the assessment" arrow>
                    <TextField
                      size="small"
                      multiline
                      minRows={2}
                      label="Findings"
                      value={activeAssessment.findings || ''}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                        const value = e.target.value;
                        updateActiveAssessment({ findings: value.length > 0 ? value : undefined });
                      }}
                    />
                  </Tooltip>
                  <Tooltip describeChild title="Recommended actions based on findings" arrow>
                    <TextField
                      size="small"
                      multiline
                      minRows={2}
                      label="Recommendations"
                      value={activeAssessment.recommendations || ''}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                        const value = e.target.value;
                        updateActiveAssessment({ recommendations: value.length > 0 ? value : undefined });
                      }}
                    />
                  </Tooltip>
                </Box>
                <Tooltip describeChild title="Summary of evidence gathered during the assessment" arrow>
                  <TextField
                    size="small"
                    multiline
                    minRows={2}
                    label="Evidence Summary"
                    value={activeAssessment.evidenceSummary || ''}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                      const value = e.target.value;
                      updateActiveAssessment({ evidenceSummary: value.length > 0 ? value : undefined });
                    }}
                  />
                </Tooltip>

                <SectionHeader label="Threat Model & Attack Paths" />
                <GrcAssessmentThreatModelSection
                  assessment={activeAssessment}
                  workspace={workspace}
                  diagramSnapshot={diagramSnapshot}
                  onSwitchModule={onSwitchModule}
                  setStatusMessage={setStatusMessage}
                  onChange={threatModel => updateActiveAssessment({ threatModel })}
                />

                <Typography id="assessment-section-related-findings" variant="subtitle2">Related Findings ({activeAssessmentLinkedFindings.length})</Typography>
                {activeAssessmentLinkedFindings.length > 0 ? (
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Finding</TableCell>
                          <TableCell>Severity</TableCell>
                          <TableCell>Status</TableCell>
                          <TableCell>Matched Risks</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {activeAssessmentLinkedFindings.map(({ finding, matchedRiskTitles }) => (
                          <TableRow key={finding.id}>
                            <TableCell
                              sx={{ cursor: 'pointer', color: 'primary.main', '&:hover': { textDecoration: 'underline' } }}
                              onClick={() => onSwitchTab?.('findings', finding.id)}
                            >
                              {finding.title}
                            </TableCell>
                            <TableCell>
                              <Chip
                                label={finding.severity}
                                size="small"
                                sx={{
                                  textTransform: 'capitalize',
                                  fontSize: '0.7rem',
                                  height: 20,
                                  color: '#fff',
                                  backgroundColor: severityColor(finding.severity)
                                }}
                              />
                            </TableCell>
                            <TableCell sx={{ textTransform: 'capitalize' }}>{finding.status.replace(/_/g, ' ')}</TableCell>
                            <TableCell>{matchedRiskTitles.slice(0, 2).join(', ')}{matchedRiskTitles.length > 2 ? ', ...' : ''}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                ) : (
                  <Typography variant="caption" color="text.secondary">
                    No findings currently match this assessment&apos;s linked risks and tier filter. A finding does not need direct Tier 2/3 fields, but at least one linked risk must match the selected tiers.
                  </Typography>
                )}

                <SectionHeader label="Linkages" />

                <Typography id="assessment-section-linked-risks" variant="subtitle2">Linked Risks ({activeAssessment.riskIds.length})</Typography>
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap', mb: 1 }}>
                  <Tooltip describeChild title="Add a risk to this assessment" arrow disableInteractive>
                    <FormControl size="small" sx={{ minWidth: 280 }}>
                      <InputLabel id="assessment-workspace-risks-label">Add Risk</InputLabel>
                      <Select
                        labelId="assessment-workspace-risks-label"
                        value=""
                        label="Add Risk"
                        onChange={e => {
                          const riskId = e.target.value as string;
                          if (riskId && !activeAssessment.riskIds.includes(riskId)) {
                            updateActiveAssessment({ riskIds: [...activeAssessment.riskIds, riskId] });
                          }
                        }}
                      >
                        {activeTierFilteredRisks
                          .filter(risk => !activeAssessment.riskIds.includes(risk.id))
                          .map(risk => (
                            <MenuItem key={risk.id} value={risk.id}>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
                                <Typography variant="body2" sx={{ flex: 1 }}>{risk.title}</Typography>
                                <Chip
                                  label={risk.inherentScore.ratingLabel}
                                  size="small"
                                  sx={{
                                    backgroundColor: risk.inherentScore.color || severityColor(risk.inherentScore.ratingLabel),
                                    color: '#fff',
                                    fontWeight: 600,
                                    fontSize: '0.7rem',
                                    height: 20
                                  }}
                                />
                              </Box>
                            </MenuItem>
                          ))}
                      </Select>
                    </FormControl>
                  </Tooltip>
                  {activeAssessment.riskIds.length > 0 && (
                    <Tooltip describeChild title="Remove all currently linked risks from this assessment." arrow>
                      <Button variant="text" size="small" color="error" onClick={() => updateActiveAssessment({ riskIds: [] })}>
                        Clear All
                      </Button>
                    </Tooltip>
                  )}
                </Box>
                {activeTierFilteredRisks.length === 0 && (
                  <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5 }}>
                    No risks match this assessment&apos;s current tier filter.
                  </Typography>
                )}
                {activeAssessment.riskIds.length > 0 ? (
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Risk</TableCell>
                          <TableCell>Rating</TableCell>
                          <TableCell>Score</TableCell>
                          <TableCell>Treatment</TableCell>
                          <TableCell align="right">Actions</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {activeAssessment.riskIds.map(riskId => {
                          const risk = riskById.get(riskId);
                          return (
                            <TableRow key={riskId}>
                              <TableCell
                                sx={{ cursor: 'pointer', color: 'primary.main', '&:hover': { textDecoration: 'underline' } }}
                                onClick={() => onSwitchTab?.('risks', riskId)}
                              >{risk?.title || riskId}</TableCell>
                              <TableCell>
                                {risk && (
                                  <Chip
                                    label={risk.inherentScore.ratingLabel}
                                    size="small"
                                    sx={{
                                      backgroundColor: risk.inherentScore.color || severityColor(risk.inherentScore.ratingLabel),
                                      color: '#fff',
                                      fontWeight: 600,
                                      fontSize: '0.7rem',
                                      height: 20
                                    }}
                                  />
                                )}
                              </TableCell>
                              <TableCell>{risk?.inherentScore.rawScore ?? ''}</TableCell>
                              <TableCell sx={{ textTransform: 'capitalize' }}>{risk?.treatmentStrategy || ''}</TableCell>
                              <TableCell align="right">
                                <Tooltip describeChild title="Remove this risk from the assessment." arrow>
                                  <IconButton
                                    size="small"
                                    onClick={() => updateActiveAssessment({
                                      riskIds: activeAssessment.riskIds.filter(id => id !== riskId)
                                    })}
                                  >
                                    <X size={14} />
                                  </IconButton>
                                </Tooltip>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </TableContainer>
                ) : (
                  <Typography variant="caption" color="text.secondary">No risks linked.</Typography>
                )}

                <Typography id="assessment-section-compliance-gaps" variant="subtitle2" sx={{ mt: 1.5 }}>Linked Compliance Gaps ({activeAssessment.soaGapIds.length})</Typography>
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap', mb: 1 }}>
                  <Tooltip describeChild title="Add a compliance gap (not-implemented or missing-evidence control) to this assessment" arrow>
                    <FormControl size="small" sx={{ minWidth: 280 }}>
                      <InputLabel id="assessment-workspace-gaps-label">Add Gap</InputLabel>
                      <Select
                        labelId="assessment-workspace-gaps-label"
                        value=""
                        label="Add Gap"
                        onChange={e => {
                          const gapId = e.target.value as string;
                          if (gapId && !activeAssessment.soaGapIds.includes(gapId)) {
                            updateActiveAssessment({ soaGapIds: [...activeAssessment.soaGapIds, gapId] });
                          }
                        }}
                      >
                        {soaGapOptions
                          .filter(option => !activeAssessment.soaGapIds.includes(option.id))
                          .map(option => (
                            <MenuItem key={option.id} value={option.id}>{option.label}</MenuItem>
                          ))}
                      </Select>
                    </FormControl>
                  </Tooltip>
                  {activeAssessment.soaGapIds.length > 0 && (
                    <Tooltip describeChild title="Remove all linked compliance gaps from this assessment." arrow>
                      <Button variant="text" size="small" color="error" onClick={() => updateActiveAssessment({ soaGapIds: [] })}>
                        Clear All
                      </Button>
                    </Tooltip>
                  )}
                </Box>
                {activeAssessment.soaGapIds.length > 0 ? (
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Control</TableCell>
                          <TableCell>Status</TableCell>
                          <TableCell>Gap Reason</TableCell>
                          <TableCell align="right">Actions</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {activeAssessment.soaGapIds.map(gapId => {
                          const detail = soaEntryDetailById.get(gapId);
                          return (
                            <TableRow key={gapId}>
                              <TableCell
                                sx={{ cursor: 'pointer', color: 'primary.main', '&:hover': { textDecoration: 'underline' } }}
                                onClick={() => onSwitchTab?.('compliance', gapId)}
                              >{detail?.label || gapId}</TableCell>
                              <TableCell sx={{ textTransform: 'capitalize' }}>
                                {detail?.implementationStatus.replace(/_/g, ' ') || ''}
                              </TableCell>
                              <TableCell sx={{ textTransform: 'capitalize' }}>
                                {detail?.reason.replace(/_/g, ' ') || ''}
                              </TableCell>
                              <TableCell align="right">
                                <Tooltip describeChild title="Remove this gap from the assessment." arrow>
                                  <IconButton
                                    size="small"
                                    onClick={() => updateActiveAssessment({
                                      soaGapIds: activeAssessment.soaGapIds.filter(id => id !== gapId)
                                    })}
                                  >
                                    <X size={14} />
                                  </IconButton>
                                </Tooltip>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </TableContainer>
                ) : (
                  <Typography variant="caption" color="text.secondary">No compliance gaps linked.</Typography>
                )}

                <Typography id="assessment-section-workflow-tasks" variant="subtitle2" sx={{ mt: 1.5 }}>Linked Workflow Tasks ({activeAssessment.taskIds.length})</Typography>
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap', mb: 1 }}>
                  <Tooltip describeChild title="Add a workflow task to this assessment" arrow>
                    <FormControl size="small" sx={{ minWidth: 280 }}>
                      <InputLabel id="assessment-workspace-tasks-label">Add Task</InputLabel>
                      <Select
                        labelId="assessment-workspace-tasks-label"
                        value=""
                        label="Add Task"
                        onChange={e => {
                          const taskId = e.target.value as string;
                          if (taskId && !activeAssessment.taskIds.includes(taskId)) {
                            updateActiveAssessment({ taskIds: [...activeAssessment.taskIds, taskId] });
                          }
                        }}
                      >
                        {workspace.workflowTasks
                          .filter(task => !activeAssessment.taskIds.includes(task.id))
                          .map(task => (
                            <MenuItem key={task.id} value={task.id}>{task.title}</MenuItem>
                          ))}
                      </Select>
                    </FormControl>
                  </Tooltip>
                  {activeAssessment.taskIds.length > 0 && (
                    <Tooltip describeChild title="Remove all linked workflow tasks from this assessment." arrow>
                      <Button variant="text" size="small" color="error" onClick={() => updateActiveAssessment({ taskIds: [] })}>
                        Clear All
                      </Button>
                    </Tooltip>
                  )}
                </Box>
                {activeAssessment.taskIds.length > 0 ? (
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Task</TableCell>
                          <TableCell>Type</TableCell>
                          <TableCell>Status</TableCell>
                          <TableCell align="right">Actions</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {activeAssessment.taskIds.map(taskId => {
                          const task = taskById.get(taskId);
                          return (
                            <TableRow key={taskId}>
                              <TableCell
                                sx={{ cursor: 'pointer', color: 'primary.main', '&:hover': { textDecoration: 'underline' } }}
                                onClick={() => onSwitchTab?.('workflow_config', taskId)}
                              >{task?.title || taskId}</TableCell>
                              <TableCell sx={{ textTransform: 'capitalize' }}>
                                {task?.type.replace(/_/g, ' ') || ''}
                              </TableCell>
                              <TableCell>
                                {task && (
                                  <Chip
                                    label={task.status.replace(/_/g, ' ')}
                                    size="small"
                                    variant="outlined"
                                    sx={{ fontSize: '0.7rem', height: 20, textTransform: 'capitalize' }}
                                  />
                                )}
                              </TableCell>
                              <TableCell align="right">
                                <Tooltip describeChild title="Remove this task from the assessment." arrow>
                                  <IconButton
                                    size="small"
                                    onClick={() => updateActiveAssessment({
                                      taskIds: activeAssessment.taskIds.filter(id => id !== taskId)
                                    })}
                                  >
                                    <X size={14} />
                                  </IconButton>
                                </Tooltip>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </TableContainer>
                ) : (
                  <Typography variant="caption" color="text.secondary">No tasks linked.</Typography>
                )}

                <Typography id="assessment-section-threat-actors" variant="subtitle2" sx={{ mt: 1.5 }}>Linked Threat Actors ({(activeAssessment.threatActorIds || []).length})</Typography>
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap', mb: 1 }}>
                  <Tooltip describeChild title="Add a threat actor considered in scope for this assessment" arrow>
                    <FormControl size="small" sx={{ minWidth: 280 }}>
                      <InputLabel id="assessment-workspace-actors-label">Add Threat Actor</InputLabel>
                      <Select
                        labelId="assessment-workspace-actors-label"
                        value=""
                        label="Add Threat Actor"
                        onChange={e => {
                          const actorId = e.target.value as string;
                          if (actorId && !(activeAssessment.threatActorIds || []).includes(actorId)) {
                            updateActiveAssessment({ threatActorIds: [...(activeAssessment.threatActorIds || []), actorId] });
                          }
                        }}
                      >
                        {threatActors
                          .filter(actor => !(activeAssessment.threatActorIds || []).includes(actor.id))
                          .map(actor => (
                            <MenuItem key={actor.id} value={actor.id}>{actor.name}</MenuItem>
                          ))}
                      </Select>
                    </FormControl>
                  </Tooltip>
                  {(activeAssessment.threatActorIds || []).length > 0 && (
                    <Tooltip describeChild title="Remove all linked threat actors from this assessment." arrow>
                      <Button variant="text" size="small" color="error" onClick={() => updateActiveAssessment({ threatActorIds: undefined })}>
                        Clear All
                      </Button>
                    </Tooltip>
                  )}
                </Box>
                {(activeAssessment.threatActorIds || []).length > 0 ? (
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Threat Actor</TableCell>
                          <TableCell>Type</TableCell>
                          <TableCell>Capability</TableCell>
                          <TableCell align="right">Actions</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {(activeAssessment.threatActorIds || []).map(actorId => {
                          const actor = threatActors.find(a => a.id === actorId);
                          return (
                            <TableRow key={actorId}>
                              <TableCell
                                sx={{ cursor: 'pointer', color: 'primary.main', '&:hover': { textDecoration: 'underline' } }}
                                onClick={() => onSwitchTab?.('threat_profile', actorId)}
                              >{actor?.name || actorId}</TableCell>
                              <TableCell sx={{ textTransform: 'capitalize' }}>{actor?.type?.replace(/_/g, ' ') || ''}</TableCell>
                              <TableCell>{actor?.capabilityLevel ? `Level ${actor.capabilityLevel}` : ''}</TableCell>
                              <TableCell align="right">
                                <Tooltip describeChild title="Remove this threat actor from the assessment." arrow>
                                  <IconButton
                                    size="small"
                                    onClick={() => updateActiveAssessment({
                                      threatActorIds: (activeAssessment.threatActorIds || []).filter(id => id !== actorId)
                                    })}
                                  >
                                    <X size={14} />
                                  </IconButton>
                                </Tooltip>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </TableContainer>
                ) : (
                  <Typography variant="caption" color="text.secondary">No threat actors linked.</Typography>
                )}

                <Typography id="assessment-section-linked-controls" variant="subtitle2" sx={{ mt: 1.5 }}>Linked Implemented Controls ({(activeAssessment.linkedImplementedControlIds || []).length})</Typography>
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap', mb: 1 }}>
                  <Tooltip describeChild title="Add an implemented control linked to this assessment" arrow>
                    <FormControl size="small" sx={{ minWidth: 280 }}>
                      <InputLabel id="assessment-workspace-controls-label">Add Implemented Control</InputLabel>
                      <Select
                        labelId="assessment-workspace-controls-label"
                        value=""
                        label="Add Implemented Control"
                        onChange={e => {
                          const controlId = e.target.value as string;
                          if (controlId && !(activeAssessment.linkedImplementedControlIds || []).includes(controlId)) {
                            updateActiveAssessment({ linkedImplementedControlIds: [...(activeAssessment.linkedImplementedControlIds || []), controlId] });
                          }
                        }}
                      >
                        {(workspace.implementedControls || [])
                          .filter(ic => !(activeAssessment.linkedImplementedControlIds || []).includes(ic.id))
                          .map(ic => (
                            <MenuItem key={ic.id} value={ic.id}>{ic.title}</MenuItem>
                          ))}
                      </Select>
                    </FormControl>
                  </Tooltip>
                  {(activeAssessment.linkedImplementedControlIds || []).length > 0 && (
                    <Tooltip describeChild title="Remove all linked implemented controls from this assessment." arrow>
                      <Button variant="text" size="small" color="error" onClick={() => updateActiveAssessment({ linkedImplementedControlIds: [] })}>
                        Clear All
                      </Button>
                    </Tooltip>
                  )}
                </Box>
                {(activeAssessment.linkedImplementedControlIds || []).length > 0 ? (
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Control</TableCell>
                          <TableCell>Type</TableCell>
                          <TableCell>Category</TableCell>
                          <TableCell>Status</TableCell>
                          <TableCell>Automation</TableCell>
                          <TableCell align="right">Actions</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {(activeAssessment.linkedImplementedControlIds || []).map(controlId => {
                          const ic = (workspace.implementedControls || []).find(c => c.id === controlId);
                          return (
                            <TableRow key={controlId}>
                              <TableCell>{ic?.title || controlId}</TableCell>
                              <TableCell>
                                {ic?.controlType && (
                                  <Chip size="small" label={ic.controlType.replace(/_/g, ' ')} sx={{ textTransform: 'capitalize', backgroundColor: { technical: '#2563eb', administrative: '#7c3aed', physical: '#ca8a04', operational: '#059669' }[ic.controlType] || '#94a3b8', color: '#fff' }} />
                                )}
                              </TableCell>
                              <TableCell sx={{ textTransform: 'capitalize' }}>{ic?.category?.replace(/_/g, ' ') || ''}</TableCell>
                              <TableCell>
                                {ic?.status && (
                                  <Chip size="small" label={ic.status.replace(/_/g, ' ')} sx={{ textTransform: 'capitalize', backgroundColor: { active: '#16a34a', planned: '#ca8a04', under_review: '#3b82f6', deprecated: '#94a3b8', inactive: '#ef4444' }[ic.status] || '#94a3b8', color: '#fff' }} />
                                )}
                              </TableCell>
                              <TableCell sx={{ textTransform: 'capitalize' }}>{ic?.automationLevel?.replace(/_/g, ' ') || ''}</TableCell>
                              <TableCell align="right">
                                <Tooltip describeChild title="Remove this implemented control from the assessment." arrow>
                                  <IconButton
                                    size="small"
                                    onClick={() => updateActiveAssessment({
                                      linkedImplementedControlIds: (activeAssessment.linkedImplementedControlIds || []).filter(id => id !== controlId)
                                    })}
                                  >
                                    <X size={14} />
                                  </IconButton>
                                </Tooltip>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </TableContainer>
                ) : (
                  <Typography variant="caption" color="text.secondary">No implemented controls linked.</Typography>
                )}

                <Typography id="assessment-section-linked-initiatives" variant="subtitle2" sx={{ mt: 1.5 }}>Linked Initiatives ({(activeAssessment.linkedInitiativeIds || []).length})</Typography>
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap', mb: 1 }}>
                  <Tooltip describeChild title="Add a security initiative linked to this assessment" arrow>
                    <FormControl size="small" sx={{ minWidth: 280 }}>
                      <InputLabel id="assessment-workspace-initiatives-label">Add Initiative</InputLabel>
                      <Select
                        labelId="assessment-workspace-initiatives-label"
                        value=""
                        label="Add Initiative"
                        onChange={e => {
                          const initiativeId = e.target.value as string;
                          if (initiativeId && !(activeAssessment.linkedInitiativeIds || []).includes(initiativeId)) {
                            updateActiveAssessment({ linkedInitiativeIds: [...(activeAssessment.linkedInitiativeIds || []), initiativeId] });
                          }
                        }}
                      >
                        {(workspace.securityInitiatives || [])
                          .filter(si => !(activeAssessment.linkedInitiativeIds || []).includes(si.id))
                          .map(si => (
                            <MenuItem key={si.id} value={si.id}>{si.title}</MenuItem>
                          ))}
                      </Select>
                    </FormControl>
                  </Tooltip>
                  {(activeAssessment.linkedInitiativeIds || []).length > 0 && (
                    <Tooltip describeChild title="Remove all linked initiatives from this assessment." arrow>
                      <Button variant="text" size="small" color="error" onClick={() => updateActiveAssessment({ linkedInitiativeIds: [] })}>
                        Clear All
                      </Button>
                    </Tooltip>
                  )}
                </Box>
                {(activeAssessment.linkedInitiativeIds || []).length > 0 ? (
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Initiative</TableCell>
                          <TableCell>Category</TableCell>
                          <TableCell>Status</TableCell>
                          <TableCell>Priority</TableCell>
                          <TableCell align="right">Actions</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {(activeAssessment.linkedInitiativeIds || []).map(initiativeId => {
                          const si = (workspace.securityInitiatives || []).find(i => i.id === initiativeId);
                          return (
                            <TableRow key={initiativeId}>
                              <TableCell>{si?.title || initiativeId}</TableCell>
                              <TableCell>
                                {si?.category && (
                                  <Chip size="small" label={si.category.replace(/_/g, ' ')} sx={{ textTransform: 'capitalize', backgroundColor: { uplift: '#2563eb', remediation: '#ea580c', compliance: '#7c3aed', transformation: '#059669', hardening: '#ca8a04', other: '#94a3b8' }[si.category] || '#94a3b8', color: '#fff' }} />
                                )}
                              </TableCell>
                              <TableCell>
                                {si?.status && (
                                  <Chip size="small" label={si.status.replace(/_/g, ' ')} sx={{ textTransform: 'capitalize', backgroundColor: { proposed: '#94a3b8', approved: '#3b82f6', in_progress: '#f59e0b', on_hold: '#ef4444', completed: '#16a34a', cancelled: '#6b7280' }[si.status] || '#94a3b8', color: '#fff' }} />
                                )}
                              </TableCell>
                              <TableCell>
                                {si?.priority && (
                                  <Chip size="small" label={si.priority} sx={{ textTransform: 'capitalize', backgroundColor: { critical: '#dc2626', high: '#ea580c', medium: '#ca8a04', low: '#16a34a' }[si.priority] || '#94a3b8', color: '#fff' }} />
                                )}
                              </TableCell>
                              <TableCell align="right">
                                <Tooltip describeChild title="Remove this initiative from the assessment." arrow>
                                  <IconButton
                                    size="small"
                                    onClick={() => updateActiveAssessment({
                                      linkedInitiativeIds: (activeAssessment.linkedInitiativeIds || []).filter(id => id !== initiativeId)
                                    })}
                                  >
                                    <X size={14} />
                                  </IconButton>
                                </Tooltip>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </TableContainer>
                ) : (
                  <Typography variant="caption" color="text.secondary">No initiatives linked.</Typography>
                )}

                <Typography
                  variant="caption"
                  sx={{ cursor: 'pointer', color: 'primary.main', '&:hover': { textDecoration: 'underline' } }}
                  onClick={() => onSwitchTab?.('risk_management_plan')}
                >
                  Risk Management Plan actions: {activeAssessment.riskManagementPlan.actions.length} total, {' '}
                  {activeAssessment.riskManagementPlan.actions.filter(action => action.status !== 'done').length} open.
                </Typography>

                {activeAssessmentContext && (
                  <Typography
                    variant="caption"
                    sx={{ cursor: 'pointer', color: 'primary.main', '&:hover': { textDecoration: 'underline' } }}
                    onClick={() => onSwitchTab?.('assets')}
                  >
                    Linked assets in scope: {activeAssessmentContext.linkedAssets.length}
                    {activeAssessmentContext.linkedAssets.length > 0
                      ? ` (${activeAssessmentContext.linkedAssets.slice(0, 3).map(asset => asset.name).join(', ')}${
                        activeAssessmentContext.linkedAssets.length > 3 ? ', ...' : ''
                      })`
                      : ''}
                  </Typography>
                )}

                <SectionHeader label="Export" />
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  <Tooltip describeChild title="Export this assessment workspace as a plain-text report." arrow>
                    <Button variant="outlined" onClick={exportActiveAssessmentAsText}>
                      Export TXT
                    </Button>
                  </Tooltip>
                  <Tooltip describeChild title="Export this assessment workspace as an HTML report." arrow>
                    <Button variant="outlined" onClick={exportActiveAssessmentAsHtml}>
                      Export HTML
                    </Button>
                  </Tooltip>
                  <Tooltip describeChild title="Export this assessment workspace as a PDF report." arrow>
                    <Button variant="contained" onClick={exportActiveAssessmentAsPdf}>
                      Export PDF
                    </Button>
                  </Tooltip>
                </Box>
                <Typography variant="caption" color="text.secondary">
                  Workspace updates are saved automatically into the GRC workspace.
                </Typography>
              </Box>
            )}
          </Paper>
        </Box>
      )}

      <Dialog
        open={deleteConfirmId !== null}
        onClose={() => setDeleteConfirmId(null)}
      >
        <DialogTitle>Delete Assessment</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to permanently delete the assessment "{deleteTargetTitle}"? This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Tooltip describeChild title="Keep this assessment workspace." arrow>
            <Button onClick={() => setDeleteConfirmId(null)}>Cancel</Button>
          </Tooltip>
          <Tooltip describeChild title="Delete this assessment workspace permanently." arrow>
            <Button
              color="error"
              variant="contained"
              onClick={() => {
                if (deleteConfirmId) handleDeleteAssessment(deleteConfirmId);
              }}
            >
              Delete
            </Button>
          </Tooltip>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default GrcAssessmentsTab;
