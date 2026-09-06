import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box, Button, Chip, Collapse, Dialog, DialogActions, DialogContent, DialogContentText,
  DialogTitle, FormControl, IconButton, MenuItem,
  Paper, Select, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, TableSortLabel, TextField, ToggleButton, ToggleButtonGroup, Tooltip, Typography
} from '@mui/material';
import { ChevronDown, ChevronRight, Crosshair, Plus, Shield, Trash2 } from 'lucide-react';
import { calculateRiskScore, computeRiskHealth, getConfig } from '../../services/GrcWorkspaceService';
import { GrcRisk, GrcRiskAcceptance, GrcRiskAcceptanceScopeType, GrcRiskAcceptanceStatus, RiskTierNode, RiskTreatmentStrategy } from '../../types/GrcTypes';
import { GrcTabProps, LBL, cardSx, createId } from './grcShared';
import { useTableColumnConfig, ColumnDef } from './useTableColumnConfig';
import TableColumnConfigPopover from './TableColumnConfigPopover';

const RISK_COLUMNS: ColumnDef[] = [
  { id: 'title', label: 'Risk', defaultVisible: true, removable: false },
  { id: 'status', label: 'Status', defaultVisible: true, removable: true },
  { id: 'rating', label: 'Rating', defaultVisible: true, removable: true },
  { id: 'score', label: 'Score', defaultVisible: true, removable: true },
  { id: 'likelihood', label: 'Likelihood', defaultVisible: true, removable: true },
  { id: 'impact', label: 'Impact', defaultVisible: true, removable: true },
  { id: 'treatment', label: 'Treatment', defaultVisible: true, removable: true },
  { id: 'owner', label: 'Owner', defaultVisible: true, removable: true },
  { id: 'nextReview', label: 'Next Review', defaultVisible: true, removable: true },
  { id: 'tier2', label: 'Tier 2', defaultVisible: true, removable: true },
  { id: 'tier3', label: 'Risk Scenario', defaultVisible: true, removable: true },
  { id: 'controls', label: 'Controls', defaultVisible: true, removable: true },
  { id: 'linkedAssets', label: 'Assets', defaultVisible: true, removable: true },
  { id: 'assessments', label: 'Assessments', defaultVisible: true, removable: true },
  { id: 'residual', label: 'Residual', defaultVisible: false, removable: true },
  { id: 'threatActor', label: 'Threat Actor', defaultVisible: false, removable: true },
  { id: 'tier1', label: 'Tier 1', defaultVisible: false, removable: true },
  { id: 'tier4', label: 'Tier 4', defaultVisible: false, removable: true },
  { id: 'sourceFinding', label: 'Source Finding', defaultVisible: false, removable: true },
  { id: 'businessUnit', label: 'Business Unit', defaultVisible: false, removable: true },
  { id: 'actions', label: 'Actions', defaultVisible: true, removable: false }
];

const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft', assessed: 'Assessed', treated: 'Treated', accepted: 'Accepted', closed: 'Closed'
};

const TREATMENT_LABELS: Record<string, string> = {
  mitigate: 'Mitigate', transfer: 'Transfer', avoid: 'Avoid', accept: 'Accept'
};

const SORTABLE_COLUMNS = new Set([
  'title', 'status', 'score', 'rating', 'treatment', 'owner', 'nextReview',
  'tier2', 'tier3', 'tier4', 'controls', 'linkedAssets', 'assessments', 'businessUnit'
]);

type SortDirection = 'asc' | 'desc';

const formatReviewDate = (isoDate: string | undefined): string => {
  if (!isoDate) return '';
  const d = new Date(isoDate);
  if (isNaN(d.getTime())) return isoDate;
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
};

const reviewDateStatus = (isoDate: string | undefined): 'overdue' | 'due-soon' | 'ok' | 'none' => {
  if (!isoDate) return 'none';
  const d = new Date(isoDate);
  if (isNaN(d.getTime())) return 'none';
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  const diffDays = (d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
  if (diffDays < 0) return 'overdue';
  if (diffDays <= 14) return 'due-soon';
  return 'ok';
};

const reviewDateColor = (status: ReturnType<typeof reviewDateStatus>): string | undefined => {
  if (status === 'overdue') return '#dc2626';
  if (status === 'due-soon') return '#ea580c';
  return undefined;
};

const normalizeTierLabel = (value?: string): string => (value || '').trim().toLowerCase();

const uniqueTierLabels = (values: Array<string | undefined>): string[] => {
  const seen = new Set<string>();
  const result: string[] = [];
  values.forEach(value => {
    const trimmed = (value || '').trim();
    if (!trimmed) return;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    result.push(trimmed);
  });
  return result.sort((a, b) => a.localeCompare(b));
};

const GrcRisksTab: React.FC<GrcTabProps> = ({
  workspace, applyWorkspace, setStatusMessage, diagramSnapshot, onSwitchModule, onSwitchTab, focusRequest, getTabViewState, setTabViewState
}) => {
  const persistedView = getTabViewState?.('risks', {
    expandedId: null
  }) ?? {
    expandedId: null
  };

  const [newRiskTitle, setNewRiskTitle] = useState('');
  const cfgDefaults = getConfig(workspace).recordDefaults;
  const threatActors = useMemo(() => workspace.threatActors || [], [workspace.threatActors]);

  const [newRiskTierLevel, setNewRiskTierLevel] = useState<2 | 3>(2);

  const [statusFilter, setStatusFilter] = useState<GrcRisk['status'] | 'all'>('all');
  const [treatmentFilter, setTreatmentFilter] = useState<RiskTreatmentStrategy | 'all'>('all');
  const [businessUnitFilter, setBusinessUnitFilter] = useState('');
  const [tier2Filter, setTier2Filter] = useState('');
  const [tier3Filter, setTier3Filter] = useState('');
  const [tier4Filter, setTier4Filter] = useState('');
  const [searchText, setSearchText] = useState('');
  const [newRiskBusinessUnit, setNewRiskBusinessUnit] = useState('');
  const [showAcceptanceForm, setShowAcceptanceForm] = useState<string | null>(null);
  const [acceptanceForm, setAcceptanceForm] = useState({
    title: '', scopeType: 'risk' as GrcRiskAcceptanceScopeType, justification: '',
    requestedBy: '', conditions: '', emailLink: '',
    effectiveDate: '', expirationDate: '', reviewDate: ''
  });
  const [sortColumn, setSortColumn] = useState<string>('score');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [expandedId, setExpandedId] = useState<string | null>((persistedView.expandedId as string | null) ?? null);
  const [editingCell, setEditingCell] = useState<{ riskId: string; field: string } | null>(null);
  const [editValue, setEditValue] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(() => new Set(['tier2', 'tier3']));

  useEffect(() => {
    if (focusRequest?.tab === 'risks' && focusRequest.entityId) {
      const id = focusRequest.entityId;
      if (workspace.risks.some(r => r.id === id)) {
        setExpandedId(id);
        setHighlightId(id);
        setTimeout(() => {
          document.getElementById(`grc-risk-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 100);
        setTimeout(() => setHighlightId(null), 2000);
      }
    }
  }, [focusRequest, workspace.risks]);

  useEffect(() => {
    setTabViewState?.('risks', {
      expandedId
    });
  }, [expandedId, setTabViewState]);

  const catalogue = workspace.tierCatalogue;
  const columnConfig = useTableColumnConfig('risks', RISK_COLUMNS, workspace, applyWorkspace);
  const findingById = useMemo(() => new Map(workspace.findings.map(finding => [finding.id, finding])), [workspace.findings]);
  const nodeById = useMemo(() => new Map(catalogue.map(node => [node.id, node])), [catalogue]);

  const resolveTierPathFromNodeId = useCallback((nodeId?: string): GrcRisk['tierPath'] => {
    if (!nodeId) {
      return {};
    }
    const tierPath: GrcRisk['tierPath'] = {};
    let currentNode = nodeById.get(nodeId);
    while (currentNode) {
      if (currentNode.tier === 1) tierPath.tier1 = currentNode.label;
      if (currentNode.tier === 2) tierPath.tier2 = currentNode.label;
      if (currentNode.tier === 3) tierPath.tier3 = currentNode.label;
      if (currentNode.tier === 4) tierPath.tier4 = currentNode.label;
      currentNode = currentNode.parentId ? nodeById.get(currentNode.parentId) : undefined;
    }
    return tierPath;
  }, [nodeById]);

  const getEffectiveTierPath = useCallback((risk: GrcRisk): GrcRisk['tierPath'] => {
    const sourceFindingTier4 = risk.sourceFindingId ? findingById.get(risk.sourceFindingId)?.title?.trim() : undefined;
    return {
      ...risk.tierPath,
      tier4: risk.tierPath.tier4 || sourceFindingTier4 || undefined
    };
  }, [findingById]);

  const tier2FilterOptions = useMemo(
    () => uniqueTierLabels(workspace.risks.map(risk => getEffectiveTierPath(risk).tier2)),
    [workspace.risks, getEffectiveTierPath]
  );

  const tier3FilterOptions = useMemo(() => {
    const tier2Match = normalizeTierLabel(tier2Filter);
    return uniqueTierLabels(
      workspace.risks
        .filter(risk => {
          if (!tier2Match) return true;
          return normalizeTierLabel(getEffectiveTierPath(risk).tier2) === tier2Match;
        })
        .map(risk => getEffectiveTierPath(risk).tier3)
    );
  }, [workspace.risks, tier2Filter, getEffectiveTierPath]);

  const tier4FilterOptions = useMemo(() => {
    const tier2Match = normalizeTierLabel(tier2Filter);
    const tier3Match = normalizeTierLabel(tier3Filter);
    return uniqueTierLabels(
      workspace.risks
        .filter(risk => {
          const tierPath = getEffectiveTierPath(risk);
          if (tier2Match && normalizeTierLabel(tierPath.tier2) !== tier2Match) return false;
          if (tier3Match && normalizeTierLabel(tierPath.tier3) !== tier3Match) return false;
          return true;
        })
        .map(risk => getEffectiveTierPath(risk).tier4)
    );
  }, [workspace.risks, tier2Filter, tier3Filter, getEffectiveTierPath]);

  useEffect(() => {
    if (tier2Filter && !tier2FilterOptions.some(option => normalizeTierLabel(option) === normalizeTierLabel(tier2Filter))) {
      setTier2Filter('');
      setTier3Filter('');
      setTier4Filter('');
    }
  }, [tier2Filter, tier2FilterOptions]);

  useEffect(() => {
    if (tier3Filter && !tier3FilterOptions.some(option => normalizeTierLabel(option) === normalizeTierLabel(tier3Filter))) {
      setTier3Filter('');
      setTier4Filter('');
    }
  }, [tier3Filter, tier3FilterOptions]);

  useEffect(() => {
    if (tier4Filter && !tier4FilterOptions.some(option => normalizeTierLabel(option) === normalizeTierLabel(tier4Filter))) {
      setTier4Filter('');
    }
  }, [tier4Filter, tier4FilterOptions]);

  const handleAddRisk = useCallback(() => {
    const title = newRiskTitle.trim();
    if (!title) {
      setStatusMessage({ severity: 'warning', text: 'Risk title is required.' });
      return;
    }

    const now = new Date().toISOString();
    const { likelihoodScale, impactScale } = workspace.riskModel;
    const midLikelihood = likelihoodScale[Math.floor(likelihoodScale.length / 2)];
    const midImpact = impactScale[Math.floor(impactScale.length / 2)];
    const inherentScore = calculateRiskScore(workspace.riskModel, midLikelihood.id, midImpact.id, workspace.config);
    const diagramLink = diagramSnapshot
      ? [{ diagramId: diagramSnapshot.diagramId, nodeIds: diagramSnapshot.selectedNodeIds || [] }]
      : [];

    const defaultTier1Label = catalogue.find(n => n.tier === 1)?.label || 'Enterprise Risk';
    const tierPath: GrcRisk['tierPath'] = newRiskTierLevel === 2
      ? { tier1: defaultTier1Label, tier2: title }
      : { tier1: defaultTier1Label, tier2: 'Unclassified', tier3: title };

    const nextRisk: GrcRisk = {
      id: createId('risk'),
      title,
      description: undefined,
      status: cfgDefaults.riskStatus,
      tierPath,
      assetIds: [],
      diagramLinks: diagramLink,
      inherentScore,
      residualScore: undefined,
      treatmentStrategy: cfgDefaults.treatmentStrategy,
      businessUnit: newRiskBusinessUnit || undefined,
      createdAt: now,
      updatedAt: now
    };

    applyWorkspace({ ...workspace, risks: [...workspace.risks, nextRisk] });
    setNewRiskTitle('');
    setNewRiskTierLevel(2);
    setNewRiskBusinessUnit('');
    setStatusMessage({ severity: 'success', text: `Added risk "${title}".` });
  }, [
    applyWorkspace, catalogue, cfgDefaults, diagramSnapshot, newRiskTierLevel,
    newRiskTitle, workspace, setStatusMessage
  ]);

  const updateRisk = useCallback((riskId: string, patch: Partial<GrcRisk>) => {
    const now = new Date().toISOString();
    const nextRisks = workspace.risks.map(risk =>
      risk.id === riskId ? { ...risk, ...patch, updatedAt: now } : risk
    );
    applyWorkspace({ ...workspace, risks: nextRisks });
  }, [applyWorkspace, workspace]);

  const handleDeleteRisk = useCallback((riskId: string) => {
    const risk = workspace.risks.find(r => r.id === riskId);
    const nextRisks = workspace.risks.filter(r => r.id !== riskId);
    const now = new Date().toISOString();

    let soaUpdates = 0;
    const nextSoaEntries = workspace.soaEntries.map(entry => {
      if (!entry.mitigatesRiskIds.includes(riskId)) {
        return entry;
      }
      soaUpdates += 1;
      return {
        ...entry,
        mitigatesRiskIds: entry.mitigatesRiskIds.filter(id => id !== riskId),
        updatedAt: now
      };
    });

    let assessmentUpdates = 0;
    const nextAssessments = workspace.assessments.map(assessment => {
      const nextRiskIds = assessment.riskIds.filter(id => id !== riskId);
      const nextActions = assessment.riskManagementPlan.actions.map(action => ({
        ...action,
        linkedRiskIds: action.linkedRiskIds.filter(id => id !== riskId)
      }));
      const actionsChanged = nextActions.some((action, index) =>
        action.linkedRiskIds.length !== assessment.riskManagementPlan.actions[index].linkedRiskIds.length
      );
      const risksChanged = nextRiskIds.length !== assessment.riskIds.length;
      if (!actionsChanged && !risksChanged) {
        return assessment;
      }
      assessmentUpdates += 1;
      return {
        ...assessment,
        riskIds: nextRiskIds,
        riskManagementPlan: {
          ...assessment.riskManagementPlan,
          actions: nextActions,
          updatedAt: now
        },
        updatedAt: now
      };
    });

    let taskUpdates = 0;
    const nextWorkflowTasks = workspace.workflowTasks.map(task => {
      if (task.riskId !== riskId) {
        return task;
      }
      taskUpdates += 1;
      return {
        ...task,
        riskId: undefined,
        updatedAt: now
      };
    });

    let scenarioUpdates = 0;
    const nextThreatScenarios = workspace.threatScenarios.map(scenario => {
      if (!scenario.linkedRiskIds.includes(riskId)) {
        return scenario;
      }
      scenarioUpdates += 1;
      return {
        ...scenario,
        linkedRiskIds: scenario.linkedRiskIds.filter(id => id !== riskId),
        updatedAt: now
      };
    });

    let governanceUpdates = 0;
    const nextGovernanceDocuments = workspace.governanceDocuments.map(document => {
      if (!document.linkedRiskIds.includes(riskId)) {
        return document;
      }
      governanceUpdates += 1;
      return {
        ...document,
        linkedRiskIds: document.linkedRiskIds.filter(id => id !== riskId),
        updatedAt: now
      };
    });

    let findingUpdates = 0;
    const nextFindings = workspace.findings.map(finding => {
      if (!finding.linkedRiskIds.includes(riskId)) {
        return finding;
      }
      findingUpdates += 1;
      return {
        ...finding,
        linkedRiskIds: finding.linkedRiskIds.filter(id => id !== riskId),
        updatedAt: now
      };
    });

    applyWorkspace({
      ...workspace,
      risks: nextRisks,
      soaEntries: nextSoaEntries,
      assessments: nextAssessments,
      workflowTasks: nextWorkflowTasks,
      threatScenarios: nextThreatScenarios,
      governanceDocuments: nextGovernanceDocuments,
      findings: nextFindings
    });
    setDeleteConfirm(null);
    if (risk) {
      const cleanupSegments = [
        soaUpdates > 0 ? `${soaUpdates} SoA link${soaUpdates === 1 ? '' : 's'}` : '',
        assessmentUpdates > 0 ? `${assessmentUpdates} assessment${assessmentUpdates === 1 ? '' : 's'}` : '',
        taskUpdates > 0 ? `${taskUpdates} task${taskUpdates === 1 ? '' : 's'}` : '',
        scenarioUpdates > 0 ? `${scenarioUpdates} threat scenario${scenarioUpdates === 1 ? '' : 's'}` : '',
        governanceUpdates > 0 ? `${governanceUpdates} governance doc${governanceUpdates === 1 ? '' : 's'}` : '',
        findingUpdates > 0 ? `${findingUpdates} finding${findingUpdates === 1 ? '' : 's'}` : ''
      ].filter(Boolean);
      const cleanupText = cleanupSegments.length > 0
        ? ` Cleaned ${cleanupSegments.join(', ')}.`
        : '';
      setStatusMessage({ severity: 'success', text: `Deleted risk "${risk.title}".${cleanupText}` });
    }
  }, [applyWorkspace, workspace, setStatusMessage]);

  const linkedControlCount = useCallback((riskId: string) => {
    return workspace.soaEntries.filter(entry => entry.mitigatesRiskIds.includes(riskId)).length;
  }, [workspace.soaEntries]);

  const handleFocusNode = useCallback((nodeId: string, diagramId: string) => {
    onSwitchModule?.('diagram');
    window.dispatchEvent(new CustomEvent('grc-focus-diagram-node', {
      detail: { nodeId, diagramId, force2D: true }
    }));
  }, [onSwitchModule]);

  const startEditing = (riskId: string, field: string, currentValue: string) => {
    setEditingCell({ riskId, field });
    setEditValue(currentValue);
  };

  const commitEdit = (riskId: string, field: string) => {
    setEditingCell(null);
    const risk = workspace.risks.find(r => r.id === riskId);
    if (!risk) return;

    if (field === 'title' && editValue.trim()) {
      updateRisk(riskId, { title: editValue.trim() });
    } else if (field === 'owner') {
      updateRisk(riskId, { owner: editValue.trim() || undefined });
    } else if (field === 'dueDate') {
      updateRisk(riskId, { dueDate: editValue || undefined });
    }
  };

  const isEditing = (riskId: string, field: string) =>
    editingCell?.riskId === riskId && editingCell?.field === field;

  const businessUnits = useMemo(() => getConfig(workspace).businessUnits || [], [workspace]);
  const businessUnitOptions = useMemo(() => {
    const units = new Set<string>(businessUnits);
    workspace.risks.forEach(r => { if (r.businessUnit) units.add(r.businessUnit); });
    return Array.from(units).sort((a, b) => a.localeCompare(b));
  }, [workspace.risks, businessUnits]);

  const filteredRisks = useMemo(() => {
    let result = workspace.risks;
    if (statusFilter !== 'all') result = result.filter(r => r.status === statusFilter);
    if (treatmentFilter !== 'all') result = result.filter(r => r.treatmentStrategy === treatmentFilter);
    if (businessUnitFilter) result = result.filter(r => r.businessUnit === businessUnitFilter);
    if (tier2Filter) {
      const tier2 = normalizeTierLabel(tier2Filter);
      result = result.filter(r => normalizeTierLabel(getEffectiveTierPath(r).tier2) === tier2);
    }
    if (tier3Filter) {
      const tier3 = normalizeTierLabel(tier3Filter);
      result = result.filter(r => normalizeTierLabel(getEffectiveTierPath(r).tier3) === tier3);
    }
    if (tier4Filter) {
      const tier4 = normalizeTierLabel(tier4Filter);
      result = result.filter(r => normalizeTierLabel(getEffectiveTierPath(r).tier4) === tier4);
    }
    if (searchText.trim()) {
      const lower = searchText.toLowerCase();
      result = result.filter(r =>
        r.title.toLowerCase().includes(lower) ||
        (r.description || '').toLowerCase().includes(lower) ||
        (r.owner || '').toLowerCase().includes(lower) ||
        (r.tierPath.tier1 || '').toLowerCase().includes(lower) ||
        (r.tierPath.tier2 || '').toLowerCase().includes(lower) ||
        (r.tierPath.tier3 || '').toLowerCase().includes(lower) ||
        (getEffectiveTierPath(r).tier4 || '').toLowerCase().includes(lower)
      );
    }
    return result;
  }, [workspace.risks, statusFilter, treatmentFilter, businessUnitFilter, tier2Filter, tier3Filter, tier4Filter, searchText, getEffectiveTierPath]);

  const riskAssessmentMap = useMemo(() => {
    const map = new Map<string, Array<{ id: string; title: string; status: string }>>();
    workspace.risks.forEach(r => map.set(r.id, []));
    workspace.assessments.forEach(a => {
      (a.riskIds || []).forEach(riskId => {
        const arr = map.get(riskId);
        if (arr) arr.push(a);
      });
    });
    return map;
  }, [workspace.risks, workspace.assessments]);

  const sortedRisks = useMemo(() => {
    const arr = [...filteredRisks];
    const dir = sortDirection === 'asc' ? 1 : -1;
    arr.sort((a, b) => {
      let cmp = 0;
      switch (sortColumn) {
        case 'title': cmp = a.title.localeCompare(b.title); break;
        case 'status': cmp = a.status.localeCompare(b.status); break;
        case 'score': cmp = a.inherentScore.rawScore - b.inherentScore.rawScore; break;
        case 'rating': cmp = a.inherentScore.ratingLabel.localeCompare(b.inherentScore.ratingLabel); break;
        case 'treatment': cmp = a.treatmentStrategy.localeCompare(b.treatmentStrategy); break;
        case 'owner': cmp = (a.owner || '').localeCompare(b.owner || ''); break;
        case 'nextReview': cmp = (a.dueDate || '').localeCompare(b.dueDate || ''); break;
        case 'tier2': cmp = (a.tierPath.tier2 || '').localeCompare(b.tierPath.tier2 || ''); break;
        case 'tier3': cmp = (a.tierPath.tier3 || '').localeCompare(b.tierPath.tier3 || ''); break;
        case 'tier4': cmp = (getEffectiveTierPath(a).tier4 || '').localeCompare(getEffectiveTierPath(b).tier4 || ''); break;
        case 'controls': cmp = linkedControlCount(a.id) - linkedControlCount(b.id); break;
        case 'linkedAssets': cmp = a.assetIds.length - b.assetIds.length; break;
        case 'assessments': cmp = (riskAssessmentMap.get(a.id)?.length || 0) - (riskAssessmentMap.get(b.id)?.length || 0); break;
        case 'businessUnit': cmp = (a.businessUnit || '').localeCompare(b.businessUnit || ''); break;
        default: break;
      }
      return cmp * dir;
    });
    return arr;
  }, [filteredRisks, sortColumn, sortDirection, linkedControlCount, getEffectiveTierPath, riskAssessmentMap]);

  const { tier2Risks, tier3Risks, tier4Risks, unclassifiedRisks } = useMemo(() => {
    const t2: GrcRisk[] = [];
    const t3: GrcRisk[] = [];
    const t4: GrcRisk[] = [];
    const unclassified: GrcRisk[] = [];
    sortedRisks.forEach(risk => {
      const tp = getEffectiveTierPath(risk);
      if (tp.tier4) t4.push(risk);
      else if (tp.tier3) t3.push(risk);
      else if (tp.tier2) t2.push(risk);
      else unclassified.push(risk);
    });
    return { tier2Risks: t2, tier3Risks: t3, tier4Risks: t4, unclassifiedRisks: unclassified };
  }, [sortedRisks, getEffectiveTierPath]);

  const handleSort = (col: string) => {
    if (sortColumn === col) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(col);
      setSortDirection(col === 'score' ? 'desc' : 'asc');
    }
  };

  const renderCellContent = (col: ColumnDef, risk: GrcRisk) => {
    const effectiveTierPath = getEffectiveTierPath(risk);
    switch (col.id) {
      case 'title': {
        const health = computeRiskHealth(risk, workspace);
        return isEditing(risk.id, 'title') ? (
          <TextField
            size="small" value={editValue}
            onChange={e => setEditValue(e.target.value)}
            onBlur={() => commitEdit(risk.id, 'title')}
            onKeyDown={e => { if (e.key === 'Enter') commitEdit(risk.id, 'title'); if (e.key === 'Escape') setEditingCell(null); }}
            autoFocus sx={{ minWidth: 140 }}
          />
        ) : (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Tooltip title={health.reasons.join('; ') || 'Healthy'} arrow>
              <Box component="span" sx={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
                bgcolor: health.level === 'red' ? '#dc2626' : health.level === 'yellow' ? '#ca8a04' : '#16a34a',
                flexShrink: 0 }} />
            </Tooltip>
            <Typography
              variant="body2"
              sx={{ cursor: 'pointer', fontWeight: 500, '&:hover': { textDecoration: 'underline' } }}
              onClick={() => startEditing(risk.id, 'title', risk.title)}
            >
              {risk.title}
            </Typography>
          </Box>
        );
      }

      case 'status':
        return (
          <TextField
            select size="small" variant="standard"
            value={risk.status}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              updateRisk(risk.id, { status: e.target.value as GrcRisk['status'] })
            }
            sx={{ minWidth: 90, '& .MuiInput-input': { fontSize: '0.8rem' } }}
          >
            {Object.entries(STATUS_LABELS).map(([val, label]) => (
              <MenuItem key={val} value={val} sx={{ fontSize: '0.8rem' }}>{label}</MenuItem>
            ))}
          </TextField>
        );

      case 'rating':
        return (
          <Chip
            label={risk.inherentScore.ratingLabel}
            size="small"
            sx={{
              bgcolor: risk.inherentScore.color,
              color: '#fff',
              fontWeight: 600,
              fontSize: '0.75rem'
            }}
          />
        );

      case 'score':
        return <Typography variant="body2" sx={{ fontWeight: 600, fontFamily: 'monospace' }}>{risk.inherentScore.rawScore}</Typography>;

      case 'likelihood':
        return (
          <TextField
            select size="small" variant="standard"
            value={risk.inherentScore.likelihoodId}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
              const newScore = calculateRiskScore(workspace.riskModel, e.target.value, risk.inherentScore.impactId, workspace.config);
              updateRisk(risk.id, { inherentScore: newScore });
            }}
            sx={{ minWidth: 80, '& .MuiInput-input': { fontSize: '0.8rem' } }}
          >
            {workspace.riskModel.likelihoodScale.map(item => (
              <MenuItem key={item.id} value={item.id} sx={{ fontSize: '0.8rem' }}>{item.label}</MenuItem>
            ))}
          </TextField>
        );

      case 'impact':
        return (
          <TextField
            select size="small" variant="standard"
            value={risk.inherentScore.impactId}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
              const newScore = calculateRiskScore(workspace.riskModel, risk.inherentScore.likelihoodId, e.target.value, workspace.config);
              updateRisk(risk.id, { inherentScore: newScore });
            }}
            sx={{ minWidth: 80, '& .MuiInput-input': { fontSize: '0.8rem' } }}
          >
            {workspace.riskModel.impactScale.map(item => (
              <MenuItem key={item.id} value={item.id} sx={{ fontSize: '0.8rem' }}>{item.label}</MenuItem>
            ))}
          </TextField>
        );

      case 'treatment':
        return (
          <TextField
            select size="small" variant="standard"
            value={risk.treatmentStrategy}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              updateRisk(risk.id, { treatmentStrategy: e.target.value as RiskTreatmentStrategy })
            }
            sx={{ minWidth: 85, '& .MuiInput-input': { fontSize: '0.8rem' } }}
          >
            {Object.entries(TREATMENT_LABELS).map(([val, label]) => (
              <MenuItem key={val} value={val} sx={{ fontSize: '0.8rem' }}>{label}</MenuItem>
            ))}
          </TextField>
        );

      case 'owner':
        return isEditing(risk.id, 'owner') ? (
          <TextField
            size="small" value={editValue}
            onChange={e => setEditValue(e.target.value)}
            onBlur={() => commitEdit(risk.id, 'owner')}
            onKeyDown={e => { if (e.key === 'Enter') commitEdit(risk.id, 'owner'); if (e.key === 'Escape') setEditingCell(null); }}
            autoFocus sx={{ minWidth: 100 }}
          />
        ) : (
          <Typography
            variant="body2"
            sx={{ cursor: 'pointer', '&:hover': { textDecoration: 'underline' }, minWidth: 60, fontSize: '0.8rem' }}
            onClick={() => startEditing(risk.id, 'owner', risk.owner || '')}
          >
            {risk.owner || '-'}
          </Typography>
        );

      case 'nextReview': {
        const ds = reviewDateStatus(risk.dueDate);
        const color = reviewDateColor(ds);
        return isEditing(risk.id, 'dueDate') ? (
          <TextField
            size="small" type="date" value={editValue}
            onChange={e => setEditValue(e.target.value)}
            onBlur={() => commitEdit(risk.id, 'dueDate')}
            onKeyDown={e => { if (e.key === 'Escape') setEditingCell(null); }}
            autoFocus InputLabelProps={{ shrink: true }} sx={{ minWidth: 130 }}
          />
        ) : (
          <Tooltip title="Next review or treatment completion target date" arrow>
            <Typography
              variant="body2"
              sx={{
                cursor: 'pointer', '&:hover': { textDecoration: 'underline' },
                minWidth: 80, fontSize: '0.8rem',
                color: color || 'text.primary',
                fontWeight: ds === 'overdue' ? 700 : 400
              }}
              onClick={() => startEditing(risk.id, 'dueDate', risk.dueDate || '')}
            >
              {risk.dueDate ? formatReviewDate(risk.dueDate) : '-'}
              {ds === 'overdue' && ' (overdue)'}
            </Typography>
          </Tooltip>
        );
      }

      case 'tier2':
        return <Typography variant="body2" sx={{ fontSize: '0.8rem' }}>{effectiveTierPath.tier2 || '-'}</Typography>;

      case 'tier3':
        return <Typography variant="body2" sx={{ fontSize: '0.8rem' }}>{effectiveTierPath.tier3 || '-'}</Typography>;

      case 'controls':
        return (
          <Chip
            size="small" label={linkedControlCount(risk.id)} variant="outlined"
            onClick={() => onSwitchTab?.('compliance')}
            sx={{ fontSize: '0.7rem', height: 20, cursor: 'pointer' }}
          />
        );

      case 'linkedAssets':
        return (
          <Chip
            size="small" label={risk.assetIds.length} variant="outlined"
            onClick={risk.assetIds.length > 0 ? () => onSwitchTab?.('assets') : undefined}
            sx={{ fontSize: '0.7rem', height: 20, cursor: risk.assetIds.length > 0 ? 'pointer' : 'default' }}
          />
        );

      case 'residual':
        return risk.residualScore ? (
          <Chip
            label={risk.residualScore.ratingLabel}
            size="small" variant="outlined"
            sx={{
              borderColor: risk.residualScore.color,
              color: risk.residualScore.color,
              fontWeight: 600,
              fontSize: '0.75rem'
            }}
          />
        ) : (
          <Typography variant="caption" color="text.disabled">—</Typography>
        );

      case 'threatActor': {
        const actors = (risk.threatActorIds || []).map(id => threatActors.find(a => a.id === id)).filter(Boolean);
        return actors.length > 0
          ? <Typography variant="body2" sx={{ fontSize: '0.8rem' }}>{actors.map(a => a!.name).join(', ')}</Typography>
          : <Typography variant="body2" sx={{ fontSize: '0.8rem' }}>-</Typography>;
      }

      case 'tier1':
        return <Typography variant="body2" sx={{ fontSize: '0.8rem' }}>{effectiveTierPath.tier1 || '-'}</Typography>;

      case 'tier4':
        return <Typography variant="body2" sx={{ fontSize: '0.8rem' }}>{effectiveTierPath.tier4 || '-'}</Typography>;

      case 'sourceFinding': {
        const finding = risk.sourceFindingId ? workspace.findings.find(f => f.id === risk.sourceFindingId) : null;
        return finding ? (
          <Chip
            size="small" label={finding.title} variant="outlined"
            onClick={() => onSwitchTab?.('findings', finding.id)}
            sx={{ fontSize: '0.68rem', height: 18, cursor: 'pointer', maxWidth: 160 }}
          />
        ) : (
          <Typography variant="caption" color="text.disabled">—</Typography>
        );
      }

      case 'assessments': {
        const count = riskAssessmentMap.get(risk.id)?.length || 0;
        return (
          <Chip
            size="small" label={count} variant="outlined"
            onClick={count > 0 ? () => onSwitchTab?.('assessments') : undefined}
            sx={{ fontSize: '0.7rem', height: 20, cursor: count > 0 ? 'pointer' : 'default' }}
          />
        );
      }

      case 'businessUnit':
        return businessUnits.length > 0 ? (
          <TextField
            select size="small" variant="standard"
            value={risk.businessUnit || ''}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              updateRisk(risk.id, { businessUnit: e.target.value || undefined })
            }
            sx={{ minWidth: 100, '& .MuiInput-input': { fontSize: '0.8rem' } }}
          >
            <MenuItem value=""><em>None</em></MenuItem>
            {businessUnits.map(bu => (
              <MenuItem key={bu} value={bu} sx={{ fontSize: '0.8rem' }}>{bu}</MenuItem>
            ))}
          </TextField>
        ) : (
          <Typography variant="body2" sx={{ fontSize: '0.8rem' }}>{risk.businessUnit || '-'}</Typography>
        );

      case 'actions': {
        const firstDiagramLink = risk.diagramLinks.find(dl => dl.nodeIds && dl.nodeIds.length > 0);
        return (
          <Box sx={{ display: 'flex', gap: 0.25 }}>
            {firstDiagramLink && (
              <Tooltip title="Focus node in diagram" arrow>
                <IconButton size="small" onClick={() => handleFocusNode(firstDiagramLink.nodeIds[0], firstDiagramLink.diagramId)}>
                  <Crosshair size={14} />
                </IconButton>
              </Tooltip>
            )}
            <Tooltip title="Delete risk" arrow>
              <IconButton size="small" onClick={() => setDeleteConfirm(risk.id)}>
                <Trash2 size={14} />
              </IconButton>
            </Tooltip>
          </Box>
        );
      }

      default: return null;
    }
  };

  const renderExpandedDetail = (risk: GrcRisk) => {
    const effectiveTierPath = getEffectiveTierPath(risk);
    const linkedAssets = workspace.assets.filter(a => risk.assetIds.includes(a.id));
    const controlCount = linkedControlCount(risk.id);
    const sourceFinding = risk.sourceFindingId ? workspace.findings.find(f => f.id === risk.sourceFindingId) : null;
    const linkedAssessments = riskAssessmentMap.get(risk.id) || [];
    const allTier2 = catalogue.filter(n => n.tier === 2);
    const allTier3ForRisk = catalogue.filter(n => n.tier === 3);
    const findingTier4Nodes: RiskTierNode[] = workspace.findings.map(f => ({ id: f.id, tier: 4 as const, label: f.title, description: f.description }));
    const allTier4ForRisk = [...catalogue.filter(n => n.tier === 4), ...findingTier4Nodes];
    const currentTier2Node = allTier2.find(n => normalizeTierLabel(n.label) === normalizeTierLabel(effectiveTierPath.tier2));
    const currentTier3Node = allTier3ForRisk.find(n => normalizeTierLabel(n.label) === normalizeTierLabel(effectiveTierPath.tier3));
    const filteredTier3ForEdit = currentTier2Node
      ? allTier3ForRisk.filter(n => n.parentId === currentTier2Node.id)
      : allTier3ForRisk;
    const filteredTier4ForEdit = currentTier3Node
      ? allTier4ForRisk.filter(n => n.parentId === currentTier3Node.id)
      : allTier4ForRisk;

    return (
      <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1.5, bgcolor: 'action.hover' }}>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          <Box sx={{ flex: 3, minWidth: 300, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>Description</Typography>
              <TextField
                size="small" multiline minRows={6} maxRows={12} fullWidth
                value={risk.description || ''}
                onChange={e => updateRisk(risk.id, { description: e.target.value || undefined })}
              />
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>Treatment Plan</Typography>
              <TextField
                size="small" multiline minRows={2} maxRows={4} fullWidth
                value={risk.treatmentPlan || ''}
                onChange={e => updateRisk(risk.id, { treatmentPlan: e.target.value || undefined })}
              />
            </Box>
          </Box>
          <Box sx={{ flex: 2, minWidth: 300, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>Tier Classification</Typography>
              <Typography variant="body2" sx={{ fontSize: '0.85rem', mt: 0.25, mb: 0.75 }}>
                {[effectiveTierPath.tier1, effectiveTierPath.tier2, effectiveTierPath.tier3, effectiveTierPath.tier4].filter(Boolean).join(' > ') || 'Not classified'}
              </Typography>
              {(() => {
                const riskTierLevel = effectiveTierPath.tier4 ? 4 : effectiveTierPath.tier3 ? 3 : effectiveTierPath.tier2 ? 2 : 0;
                return (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    {riskTierLevel === 3 && (
                      <TextField
                        size="small" select label="Parent Category (Tier 2)"
                        value={currentTier2Node?.id || ''}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                          const node = allTier2.find(n => n.id === e.target.value);
                          if (!node) {
                            updateRisk(risk.id, { tierPath: { ...risk.tierPath, tier2: undefined } });
                            return;
                          }
                          const resolvedTierPath = resolveTierPathFromNodeId(node.id);
                          updateRisk(risk.id, {
                            tierPath: {
                              ...risk.tierPath,
                              tier1: resolvedTierPath.tier1 || risk.tierPath.tier1,
                              tier2: resolvedTierPath.tier2 || node.label,
                            }
                          });
                        }}
                        fullWidth
                      >
                        <MenuItem value=""><em>None</em></MenuItem>
                        {allTier2.map(n => <MenuItem key={n.id} value={n.id}>{n.label}</MenuItem>)}
                      </TextField>
                    )}
                    {riskTierLevel === 4 && (
                      <>
                        <TextField
                          size="small" select label="Parent Scenario (Tier 3)"
                          value={currentTier3Node?.id || ''}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                            const node = catalogue.find(n => n.id === e.target.value);
                            if (!node) {
                              updateRisk(risk.id, { tierPath: { ...risk.tierPath, tier2: undefined, tier3: undefined } });
                              return;
                            }
                            const resolvedTierPath = resolveTierPathFromNodeId(node.id);
                            updateRisk(risk.id, {
                              tierPath: {
                                ...risk.tierPath,
                                tier1: resolvedTierPath.tier1 || risk.tierPath.tier1,
                                tier2: resolvedTierPath.tier2 || risk.tierPath.tier2,
                                tier3: resolvedTierPath.tier3 || node.label,
                              }
                            });
                          }}
                          fullWidth
                        >
                          <MenuItem value=""><em>None</em></MenuItem>
                          {filteredTier3ForEdit.map(n => <MenuItem key={n.id} value={n.id}>{n.label}</MenuItem>)}
                        </TextField>
                        <Box>
                          <Typography variant="caption" color="text.secondary">Finding / Control (Tier 4)</Typography>
                          <Box sx={{ mt: 0.25 }}>
                            <Chip
                              label={effectiveTierPath.tier4}
                              size="small" variant="outlined"
                              sx={{ fontSize: '0.75rem' }}
                            />
                          </Box>
                        </Box>
                      </>
                    )}
                  </Box>
                );
              })()}
            </Box>
            {linkedAssessments.length > 0 && (
              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>Linked Assessments</Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.25 }}>
                  {linkedAssessments.map(a => (
                    <Chip
                      key={a.id} size="small"
                      label={`${a.title} (${a.status})`}
                      onClick={() => onSwitchTab?.('assessments', a.id)}
                      sx={{ fontSize: '0.68rem', height: 18, cursor: 'pointer' }}
                    />
                  ))}
                </Box>
              </Box>
            )}
            {linkedAssets.length > 0 && (
              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>Linked Assets</Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.25 }}>
                  {linkedAssets.map(a => (
                    <Chip
                      key={a.id} size="small" label={a.name}
                      onClick={() => onSwitchTab?.('assets', a.id)}
                      sx={{ fontSize: '0.68rem', height: 18, bgcolor: 'primary.main', color: 'primary.contrastText', opacity: 0.85, cursor: 'pointer' }}
                    />
                  ))}
                </Box>
              </Box>
            )}
            {controlCount > 0 && (
              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>Linked Controls</Typography>
                <Box sx={{ mt: 0.25 }}>
                  <Chip
                    size="small" label={`${controlCount} control${controlCount !== 1 ? 's' : ''}`}
                    variant="outlined"
                    onClick={() => onSwitchTab?.('compliance')}
                    sx={{ fontSize: '0.68rem', height: 18, cursor: 'pointer' }}
                  />
                </Box>
              </Box>
            )}
            {sourceFinding && (
              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>Source Finding</Typography>
                <Box sx={{ mt: 0.25 }}>
                  <Chip
                    size="small" label={sourceFinding.title} variant="outlined"
                    onClick={() => onSwitchTab?.('findings', sourceFinding.id)}
                    sx={{ fontSize: '0.68rem', height: 18, cursor: 'pointer' }}
                  />
                </Box>
              </Box>
            )}
            {risk.diagramLinks.length > 0 && (
              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>Diagram Links</Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.25 }}>
                  {risk.diagramLinks.flatMap(dl =>
                    (dl.nodeIds || []).map(nodeId => (
                      <Chip
                        key={`${dl.diagramId}-${nodeId}`} size="small"
                        label={nodeId}
                        icon={<Crosshair size={12} />}
                        onClick={() => handleFocusNode(nodeId, dl.diagramId)}
                        sx={{ fontSize: '0.7rem', height: 22, cursor: 'pointer' }}
                      />
                    ))
                  )}
                </Box>
              </Box>
            )}
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>Threat Actors</Typography>
              <FormControl size="small" variant="standard" sx={{ minWidth: 160, display: 'block', mt: 0.25 }}>
                <Select
                  multiple
                  value={risk.threatActorIds || []}
                  onChange={e => {
                    const value = e.target.value;
                    const ids = typeof value === 'string' ? value.split(',') : (value as string[]);
                    updateRisk(risk.id, { threatActorIds: ids.length > 0 ? ids : undefined });
                  }}
                  renderValue={selected =>
                    (selected as string[])
                      .map(id => threatActors.find(a => a.id === id)?.name || id)
                      .join(', ')
                  }
                  sx={{ '& .MuiInput-input': { fontSize: '0.8rem' } }}
                  fullWidth
                >
                  {threatActors.map(a => (
                    <MenuItem key={a.id} value={a.id} sx={{ fontSize: '0.8rem' }}>{a.name}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>Business Unit</Typography>
              {businessUnits.length > 0 ? (
                <TextField
                  select size="small" variant="standard" fullWidth
                  value={risk.businessUnit || ''}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    updateRisk(risk.id, { businessUnit: e.target.value || undefined })
                  }
                  sx={{ mt: 0.25, '& .MuiInput-input': { fontSize: '0.8rem' } }}
                >
                  <MenuItem value=""><em>None</em></MenuItem>
                  {businessUnits.map(bu => (
                    <MenuItem key={bu} value={bu} sx={{ fontSize: '0.8rem' }}>{bu}</MenuItem>
                  ))}
                </TextField>
              ) : (
                <TextField
                  size="small" fullWidth
                  value={risk.businessUnit || ''}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    updateRisk(risk.id, { businessUnit: e.target.value || undefined })
                  }
                  sx={{ mt: 0.25 }}
                />
              )}
            </Box>
            {risk.residualScore && (
              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>Residual Score</Typography>
                <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center', mt: 0.25 }}>
                  <TextField
                    select size="small" variant="standard" label="L"
                    value={risk.residualScore.likelihoodId}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                      const newScore = calculateRiskScore(workspace.riskModel, e.target.value, risk.residualScore!.impactId, workspace.config);
                      updateRisk(risk.id, { residualScore: newScore });
                    }}
                    sx={{ minWidth: 80, '& .MuiInput-input': { fontSize: '0.8rem' } }}
                  >
                    {workspace.riskModel.likelihoodScale.map(item => (
                      <MenuItem key={item.id} value={item.id} sx={{ fontSize: '0.8rem' }}>{item.label}</MenuItem>
                    ))}
                  </TextField>
                  <TextField
                    select size="small" variant="standard" label="I"
                    value={risk.residualScore.impactId}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                      const newScore = calculateRiskScore(workspace.riskModel, risk.residualScore!.likelihoodId, e.target.value, workspace.config);
                      updateRisk(risk.id, { residualScore: newScore });
                    }}
                    sx={{ minWidth: 80, '& .MuiInput-input': { fontSize: '0.8rem' } }}
                  >
                    {workspace.riskModel.impactScale.map(item => (
                      <MenuItem key={item.id} value={item.id} sx={{ fontSize: '0.8rem' }}>{item.label}</MenuItem>
                    ))}
                  </TextField>
                  <Chip
                    label={`${risk.residualScore.rawScore} ${risk.residualScore.ratingLabel}`}
                    size="small" variant="outlined"
                    sx={{ borderColor: risk.residualScore.color, color: risk.residualScore.color, fontWeight: 600, fontSize: '0.7rem' }}
                  />
                </Box>
              </Box>
            )}
          </Box>
        </Box>
        {risk.treatmentStrategy === 'accept' && (() => {
          const linkedAcceptances = (workspace.riskAcceptances || []).filter(ra => ra.riskId === risk.id);
          const ACCEPTANCE_STATUS_COLORS: Record<string, string> = {
            approved: '#16a34a', pending_review: '#3b82f6', expired: '#dc2626', rejected: '#dc2626', draft: '#9e9e9e'
          };
          return (
            <Box sx={{ mt: 1.5 }}>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>Risk Acceptances</Typography>
              {linkedAcceptances.length > 0 && (
                <TableContainer component={Paper} variant="outlined" sx={{ mt: 0.5 }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Title</TableCell>
                        <TableCell>Status</TableCell>
                        <TableCell>Scope</TableCell>
                        <TableCell>Approved By</TableCell>
                        <TableCell>Expiration</TableCell>
                        <TableCell sx={{ width: 50 }} />
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {linkedAcceptances.map(ra => (
                        <TableRow key={ra.id}>
                          <TableCell sx={{ fontSize: '0.8rem' }}>{ra.title}</TableCell>
                          <TableCell>
                            <TextField
                              select size="small" variant="standard"
                              value={ra.status}
                              onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                const nextStatus = e.target.value as GrcRiskAcceptanceStatus;
                                const now = new Date().toISOString();
                                const nextAcceptances = (workspace.riskAcceptances || []).map(item =>
                                  item.id === ra.id ? { ...item, status: nextStatus, updatedAt: now } : item
                                );
                                applyWorkspace({ ...workspace, riskAcceptances: nextAcceptances });
                              }}
                              sx={{ '& .MuiInput-input': { fontSize: '0.75rem' } }}
                            >
                              <MenuItem value="draft" sx={{ fontSize: '0.75rem' }}>Draft</MenuItem>
                              <MenuItem value="pending_review" sx={{ fontSize: '0.75rem' }}>Pending Review</MenuItem>
                              <MenuItem value="approved" sx={{ fontSize: '0.75rem' }}>Approved</MenuItem>
                              <MenuItem value="rejected" sx={{ fontSize: '0.75rem' }}>Rejected</MenuItem>
                              <MenuItem value="expired" sx={{ fontSize: '0.75rem' }}>Expired</MenuItem>
                            </TextField>
                          </TableCell>
                          <TableCell sx={{ fontSize: '0.8rem' }}>{LBL[ra.scopeType] || ra.scopeType}</TableCell>
                          <TableCell sx={{ fontSize: '0.8rem' }}>{ra.approvedBy || '-'}</TableCell>
                          <TableCell sx={{ fontSize: '0.8rem' }}>{ra.expirationDate || '-'}</TableCell>
                          <TableCell>
                            <IconButton size="small" onClick={() => {
                              const nextAcceptances = (workspace.riskAcceptances || []).filter(item => item.id !== ra.id);
                              applyWorkspace({ ...workspace, riskAcceptances: nextAcceptances });
                            }}>
                              <Trash2 size={14} />
                            </IconButton>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
              {linkedAcceptances.length === 0 && (
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                  No acceptances recorded for this risk.
                </Typography>
              )}
              {showAcceptanceForm === risk.id ? (
                <Box sx={{ mt: 1, p: 1.5, border: '1px solid', borderColor: 'divider', borderRadius: 1, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 1 }}>
                  <TextField size="small" label="Title" value={acceptanceForm.title}
                    onChange={e => setAcceptanceForm(f => ({ ...f, title: e.target.value }))} />
                  <TextField size="small" select label="Scope Type" value={acceptanceForm.scopeType}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAcceptanceForm(f => ({ ...f, scopeType: e.target.value as GrcRiskAcceptanceScopeType }))}>
                    <MenuItem value="risk">Risk</MenuItem>
                    <MenuItem value="compliance">Compliance</MenuItem>
                    <MenuItem value="policy">Policy</MenuItem>
                  </TextField>
                  <TextField size="small" label="Justification" multiline minRows={2} value={acceptanceForm.justification}
                    onChange={e => setAcceptanceForm(f => ({ ...f, justification: e.target.value }))}
                    sx={{ gridColumn: 'span 2' }} />
                  <TextField size="small" label="Requested By" value={acceptanceForm.requestedBy}
                    onChange={e => setAcceptanceForm(f => ({ ...f, requestedBy: e.target.value }))} />
                  <TextField size="small" label="Conditions" value={acceptanceForm.conditions}
                    onChange={e => setAcceptanceForm(f => ({ ...f, conditions: e.target.value }))} />
                  <TextField size="small" label="Email Link" value={acceptanceForm.emailLink}
                    onChange={e => setAcceptanceForm(f => ({ ...f, emailLink: e.target.value }))} />
                  <TextField size="small" type="date" label="Effective Date" InputLabelProps={{ shrink: true }}
                    value={acceptanceForm.effectiveDate}
                    onChange={e => setAcceptanceForm(f => ({ ...f, effectiveDate: e.target.value }))} />
                  <TextField size="small" type="date" label="Expiration Date" InputLabelProps={{ shrink: true }}
                    value={acceptanceForm.expirationDate}
                    onChange={e => setAcceptanceForm(f => ({ ...f, expirationDate: e.target.value }))} />
                  <TextField size="small" type="date" label="Review Date" InputLabelProps={{ shrink: true }}
                    value={acceptanceForm.reviewDate}
                    onChange={e => setAcceptanceForm(f => ({ ...f, reviewDate: e.target.value }))} />
                  <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-end' }}>
                    <Button size="small" variant="contained" onClick={() => {
                      if (!acceptanceForm.title.trim()) {
                        setStatusMessage({ severity: 'warning', text: 'Acceptance title is required.' });
                        return;
                      }
                      const now = new Date().toISOString();
                      const newAcceptance: GrcRiskAcceptance = {
                        id: createId('ra'),
                        riskId: risk.id,
                        title: acceptanceForm.title.trim(),
                        scopeType: acceptanceForm.scopeType,
                        requestedBy: acceptanceForm.requestedBy.trim(),
                        approvedBy: '',
                        status: 'draft',
                        justification: acceptanceForm.justification.trim(),
                        conditions: acceptanceForm.conditions.trim(),
                        emailLink: acceptanceForm.emailLink.trim() || undefined,
                        effectiveDate: acceptanceForm.effectiveDate,
                        expirationDate: acceptanceForm.expirationDate,
                        reviewDate: acceptanceForm.reviewDate,
                        notes: '',
                        createdAt: now,
                        updatedAt: now
                      };
                      applyWorkspace({
                        ...workspace,
                        riskAcceptances: [...(workspace.riskAcceptances || []), newAcceptance]
                      });
                      setShowAcceptanceForm(null);
                      setAcceptanceForm({
                        title: '', scopeType: 'risk', justification: '',
                        requestedBy: '', conditions: '', emailLink: '',
                        effectiveDate: '', expirationDate: '', reviewDate: ''
                      });
                      setStatusMessage({ severity: 'success', text: `Added acceptance "${newAcceptance.title}".` });
                    }}>Save</Button>
                    <Button size="small" onClick={() => setShowAcceptanceForm(null)}>Cancel</Button>
                  </Box>
                </Box>
              ) : (
                <Button size="small" variant="outlined" sx={{ mt: 0.75, textTransform: 'none' }}
                  startIcon={<Plus size={14} />}
                  onClick={() => setShowAcceptanceForm(risk.id)}>
                  Add Acceptance
                </Button>
              )}
            </Box>
          );
        })()}
        <Typography variant="caption" color="text.secondary">
          Created: {new Date(risk.createdAt).toLocaleString()} | Updated: {new Date(risk.updatedAt).toLocaleString()}
        </Typography>
      </Box>
    );
  };

  const renderSectionHeader = (sectionKey: string, label: string, count: number) => (
    <TableRow
      sx={{ bgcolor: 'action.hover', cursor: 'pointer', '&:hover': { bgcolor: 'action.selected' } }}
      onClick={() => setCollapsedSections(prev => {
        const next = new Set(prev);
        if (next.has(sectionKey)) next.delete(sectionKey); else next.add(sectionKey);
        return next;
      })}
    >
      <TableCell colSpan={columnConfig.visibleColumns.length + 1} sx={{ py: 0.75 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {collapsedSections.has(sectionKey) ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>{label}</Typography>
          <Chip size="small" label={count} sx={{ height: 20, fontSize: '0.7rem' }} />
        </Box>
      </TableCell>
    </TableRow>
  );

  const renderRiskRows = (risks: GrcRisk[]) => risks.map(risk => (
    <React.Fragment key={risk.id}>
      <TableRow id={`grc-risk-${risk.id}`} hover sx={{
        '& > *': { borderBottom: expandedId === risk.id ? 'none' : undefined },
        ...(highlightId === risk.id && { bgcolor: 'action.selected', transition: 'background-color 0.3s' })
      }}>
        <TableCell sx={{ width: 30, p: 0.5 }}>
          <IconButton size="small" onClick={() => setExpandedId(expandedId === risk.id ? null : risk.id)}>
            {expandedId === risk.id ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </IconButton>
        </TableCell>
        {columnConfig.visibleColumns.map(col => (
          <TableCell key={col.id}>{renderCellContent(col, risk)}</TableCell>
        ))}
      </TableRow>
      <TableRow>
        <TableCell colSpan={columnConfig.visibleColumns.length + 1} sx={{ p: 0, border: 0 }}>
          <Collapse in={expandedId === risk.id} timeout="auto" unmountOnExit>
            {renderExpandedDetail(risk)}
          </Collapse>
        </TableCell>
      </TableRow>
    </React.Fragment>
  ));

  const riskToDelete = deleteConfirm ? workspace.risks.find(r => r.id === deleteConfirm) : null;

  return (
    <Box sx={{ display: 'grid', gap: 2 }}>
      {/* Creation form */}
      <Paper sx={cardSx}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1, mb: 1 }}>
          <Typography variant="h6">Risk Register</Typography>
          <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
            <TableColumnConfigPopover
              allColumns={columnConfig.allColumns}
              visibleIds={columnConfig.visibleIds}
              onToggle={columnConfig.toggleColumn}
              onMove={columnConfig.moveColumn}
              onReset={columnConfig.resetToDefaults}
            />
          </Box>
        </Box>
        <Typography variant="body2" color="text.secondary">
          Select a tier level, enter a title, then expand the row to set classification, likelihood, impact, and other details.
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ mb: 1.5, display: 'block' }}>
          Tier 4 operational risks are generated automatically from findings — no need to create them here.
        </Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center' }}>
          <ToggleButtonGroup
            size="small"
            exclusive
            value={newRiskTierLevel}
            onChange={(_, val) => { if (val !== null) setNewRiskTierLevel(val); }}
          >
            <ToggleButton value={2}>Tier 2</ToggleButton>
            <ToggleButton value={3}>Tier 3</ToggleButton>
          </ToggleButtonGroup>
          <TextField size="small" label="Risk Title" value={newRiskTitle}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewRiskTitle(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleAddRisk(); }}
            sx={{ minWidth: 300, flex: 1 }} />
          {businessUnits.length > 0 && (
            <TextField
              select size="small" label="Business Unit"
              value={newRiskBusinessUnit}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewRiskBusinessUnit(e.target.value)}
              sx={{ minWidth: 160 }}
            >
              <MenuItem value=""><em>None</em></MenuItem>
              {businessUnits.map(bu => (
                <MenuItem key={bu} value={bu}>{bu}</MenuItem>
              ))}
            </TextField>
          )}
          <Button variant="contained" startIcon={<Plus size={16} />} onClick={handleAddRisk}>Add Risk</Button>
        </Box>
      </Paper>

      {/* Filter bar */}
      {workspace.risks.length > 0 && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, alignItems: 'center' }}>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 500, minWidth: 50 }}>Status:</Typography>
            {(['all', 'draft', 'assessed', 'treated', 'accepted', 'closed'] as const).map(s => (
              <Chip
                key={s}
                label={s === 'all' ? 'All' : STATUS_LABELS[s] || s}
                size="small"
                variant={statusFilter === s ? 'filled' : 'outlined'}
                onClick={() => setStatusFilter(s)}
                sx={{ fontWeight: statusFilter === s ? 700 : 400 }}
              />
            ))}
          </Box>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, alignItems: 'center' }}>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 500, minWidth: 50 }}>Treat:</Typography>
            {(['all', 'mitigate', 'transfer', 'avoid', 'accept'] as const).map(t => (
              <Chip
                key={t}
                label={t === 'all' ? 'All' : TREATMENT_LABELS[t] || t}
                size="small"
                variant={treatmentFilter === t ? 'filled' : 'outlined'}
                onClick={() => setTreatmentFilter(t)}
                sx={{ fontWeight: treatmentFilter === t ? 700 : 400 }}
              />
            ))}
          </Box>
          {businessUnitOptions.length > 0 && (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, alignItems: 'center' }}>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 500, minWidth: 50 }}>BU:</Typography>
              <Chip
                label="All"
                size="small"
                variant={!businessUnitFilter ? 'filled' : 'outlined'}
                onClick={() => setBusinessUnitFilter('')}
                sx={{ fontWeight: !businessUnitFilter ? 700 : 400 }}
              />
              {businessUnitOptions.map(bu => (
                <Chip
                  key={bu}
                  label={bu}
                  size="small"
                  variant={businessUnitFilter === bu ? 'filled' : 'outlined'}
                  onClick={() => setBusinessUnitFilter(bu)}
                  sx={{ fontWeight: businessUnitFilter === bu ? 700 : 400 }}
                />
              ))}
            </Box>
          )}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
            <TextField
              size="small" placeholder="Search risks..."
              value={searchText} onChange={e => setSearchText(e.target.value)}
              sx={{ maxWidth: 300 }}
            />
            <TextField
              size="small"
              select
              label="Tier 2"
              value={tier2Filter}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                setTier2Filter(e.target.value);
                setTier3Filter('');
                setTier4Filter('');
              }}
              sx={{ minWidth: 180 }}
            >
              <MenuItem value=""><em>All Tier 2</em></MenuItem>
              {tier2FilterOptions.map(option => (
                <MenuItem key={option} value={option}>{option}</MenuItem>
              ))}
            </TextField>
            <TextField
              size="small"
              select
              label="Tier 3"
              value={tier3Filter}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                setTier3Filter(e.target.value);
                setTier4Filter('');
              }}
              sx={{ minWidth: 180 }}
            >
              <MenuItem value=""><em>All Tier 3</em></MenuItem>
              {tier3FilterOptions.map(option => (
                <MenuItem key={option} value={option}>{option}</MenuItem>
              ))}
            </TextField>
            <TextField
              size="small"
              select
              label="Tier 4"
              value={tier4Filter}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTier4Filter(e.target.value)}
              sx={{ minWidth: 200 }}
            >
              <MenuItem value=""><em>All Tier 4</em></MenuItem>
              {tier4FilterOptions.map(option => (
                <MenuItem key={option} value={option}>{option}</MenuItem>
              ))}
            </TextField>
            {(filteredRisks.length !== workspace.risks.length || searchText || tier2Filter || tier3Filter || tier4Filter) && (
              <Typography variant="caption" color="text.secondary">
                {filteredRisks.length} of {workspace.risks.length} risks
              </Typography>
            )}
          </Box>
        </Box>
      )}

      {/* Table or empty state */}
      {workspace.risks.length === 0 ? (
        <Paper sx={{ ...cardSx, textAlign: 'center', py: 6 }}>
          <Shield size={48} style={{ marginBottom: 12, opacity: 0.4 }} />
          <Typography variant="h6" color="text.secondary" gutterBottom>
            No risks registered yet
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 520, mx: 'auto', mb: 2 }}>
            Risks represent potential threats or vulnerabilities that could impact your organization.
            Use the form above to create your first risk by selecting a tier level and providing a title.
            Expand the row to edit tier classification, likelihood, impact, and other details.
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 520, mx: 'auto' }}>
            Each risk is scored using the likelihood/impact matrix defined in Configuration.
            You can classify risks using the tier taxonomy, assign owners, set review dates for
            treatment, and track their status through the risk lifecycle.
          </Typography>
        </Paper>
      ) : (
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ width: 30 }} />
                {columnConfig.visibleColumns.map(col => (
                  <TableCell key={col.id} sx={col.width ? { width: col.width } : undefined}>
                    {SORTABLE_COLUMNS.has(col.id) ? (
                      <TableSortLabel
                        active={sortColumn === col.id}
                        direction={sortColumn === col.id ? sortDirection : 'asc'}
                        onClick={() => handleSort(col.id)}
                      >
                        {col.label}
                      </TableSortLabel>
                    ) : col.label}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {sortedRisks.length > 0 && (
                <TableRow sx={{ bgcolor: 'primary.dark' }}>
                  <TableCell colSpan={columnConfig.visibleColumns.length + 1} sx={{ py: 0.5 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'primary.contrastText', fontSize: '0.8rem' }}>
                      {catalogue.find(n => n.tier === 1)?.label || 'Enterprise Risk'}
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
              {tier2Risks.length > 0 && (
                <>
                  {renderSectionHeader('tier2', 'Tier 2 — Risk Categories', tier2Risks.length)}
                  {!collapsedSections.has('tier2') && renderRiskRows(tier2Risks)}
                </>
              )}
              {tier3Risks.length > 0 && (
                <>
                  {renderSectionHeader('tier3', 'Tier 3 — Risk Scenarios', tier3Risks.length)}
                  {!collapsedSections.has('tier3') && renderRiskRows(tier3Risks)}
                </>
              )}
              {tier4Risks.length > 0 && (
                <>
                  {renderSectionHeader('tier4', 'Tier 4 — Operational Risks', tier4Risks.length)}
                  {!collapsedSections.has('tier4') && renderRiskRows(tier4Risks)}
                </>
              )}
              {unclassifiedRisks.length > 0 && (
                <>
                  {renderSectionHeader('unclassified', 'Unclassified', unclassifiedRisks.length)}
                  {!collapsedSections.has('unclassified') && renderRiskRows(unclassifiedRisks)}
                </>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Dialog open={!!deleteConfirm} onClose={() => setDeleteConfirm(null)}>
        <DialogTitle>Delete Risk</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete the risk "{riskToDelete?.title}"? This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Tooltip describeChild title="Keep this risk in the register." arrow>
            <Button onClick={() => setDeleteConfirm(null)}>Cancel</Button>
          </Tooltip>
          <Tooltip describeChild title="Delete this risk and clean linked references across GRC records." arrow>
            <Button color="error" variant="contained" onClick={() => deleteConfirm && handleDeleteRisk(deleteConfirm)}>
              Delete
            </Button>
          </Tooltip>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default GrcRisksTab;
