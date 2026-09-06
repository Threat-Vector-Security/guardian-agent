import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box, Button, Chip, Collapse, Dialog, DialogActions, DialogContent, DialogContentText,
  DialogTitle, IconButton, MenuItem, Paper, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, TableSortLabel, TextField, Tooltip, Typography
} from '@mui/material';
import {
  AlertTriangle, ChevronDown, ChevronRight, Crosshair, Plus, RefreshCw, Shield, Trash2
} from 'lucide-react';
import { GrcTabProps, LBL, cardSx, createId } from './grcShared';
import { useManualAnalysis } from '../../contexts/ManualAnalysisContext';
import { ManualFindingCategory } from '../../types/ManualAnalysisTypes';
import { StrideCategory } from '../../types/ThreatIntelTypes';
import {
  GrcFinding, GrcFindingSeverity, GrcFindingStatus, GrcFindingType, GrcRemediationStatus, GrcRisk, GrcTask
} from '../../types/GrcTypes';
import { STRIDE_SHORT, STRIDE_COLORS } from '../../utils/attackPathUtils';
import { manualRuleCatalog } from '../../data/manualRuleCatalog';
import { calculateRiskScore, generateFindingId, syncFindingsFromRuleEngine } from '../../services/GrcWorkspaceService';
import { useTableColumnConfig, ColumnDef } from './useTableColumnConfig';
import TableColumnConfigPopover from './TableColumnConfigPopover';

const CATEGORY_LABELS: Record<ManualFindingCategory, string> = {
  dfd: 'DFD', boundary: 'Boundary', data: 'Data', identity: 'Identity',
  encryption: 'Encryption', availability: 'Availability', logging: 'Logging',
  configuration: 'Config', threat: 'Threat', attackpath: 'Attack Path',
};

const CATEGORY_COLORS: Record<ManualFindingCategory, string> = {
  dfd: '#6366f1', boundary: '#f59e0b', data: '#ec4899', identity: '#8b5cf6',
  encryption: '#06b6d4', availability: '#f43f5e', logging: '#14b8a6',
  configuration: '#84cc16', threat: '#ef4444', attackpath: '#f97316',
};

const SEVERITY_COLORS: Record<GrcFindingSeverity, string> = {
  critical: '#dc2626', high: '#ea580c', medium: '#ca8a04', low: '#2563eb', info: '#6b7280'
};

const TYPE_LABELS: Record<GrcFindingType, string> = {
  threat: 'Threat', vulnerability: 'Vulnerability', weakness: 'Weakness', observation: 'Observation'
};

const STATUS_LABELS: Record<GrcFindingStatus, string> = {
  open: 'Open', in_review: 'In Review', accepted: 'Accepted', mitigated: 'Mitigated', dismissed: 'Dismissed'
};

const SOURCE_LABELS: Record<string, string> = {
  rule_engine: 'Rule Engine', manual: 'Manual', ai_analysis: 'AI Analysis'
};

const ALL_STRIDE: StrideCategory[] = [
  'Spoofing', 'Tampering', 'Repudiation', 'Information Disclosure', 'Denial of Service', 'Elevation of Privilege'
];

const FINDING_COLUMNS: ColumnDef[] = [
  { id: 'findingId', label: 'ID', defaultVisible: true, removable: true, width: 140 },
  { id: 'title', label: 'Finding', defaultVisible: true, removable: false },
  { id: 'type', label: 'Type', defaultVisible: true, removable: true },
  { id: 'severity', label: 'Severity', defaultVisible: true, removable: true },
  { id: 'source', label: 'Source', defaultVisible: true, removable: true },
  { id: 'status', label: 'Status', defaultVisible: true, removable: true },
  { id: 'category', label: 'Category', defaultVisible: true, removable: true },
  { id: 'stride', label: 'STRIDE', defaultVisible: true, removable: true },
  { id: 'component', label: 'Component', defaultVisible: true, removable: true },
  { id: 'linkedRisks', label: 'Linked Risks', defaultVisible: true, removable: true },
  { id: 'owner', label: 'Owner', defaultVisible: false, removable: true },
  { id: 'remediationStatus', label: 'Remediation', defaultVisible: false, removable: true },
  { id: 'cvssScore', label: 'CVSS', defaultVisible: false, removable: true },
  { id: 'actions', label: 'Actions', defaultVisible: true, removable: false }
];

const REMEDIATION_STATUSES: GrcRemediationStatus[] = [
  'identified', 'confirmed', 'remediation_planned', 'remediation_in_progress', 'remediated', 'verified', 'false_positive'
];

const SEVERITY_ORDER: Record<GrcFindingSeverity, number> = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };

type SortDirection = 'asc' | 'desc';

const normalizeTierLabel = (value?: string): string => (value || '').trim().toLowerCase();

const buildTierPathFromNodeId = (
  nodeId: string | undefined,
  tierCatalogue: Array<{ id: string; tier: 1 | 2 | 3 | 4; label: string; parentId?: string }>
): GrcRisk['tierPath'] => {
  if (!nodeId) {
    return {};
  }
  const nodeById = new Map(tierCatalogue.map(node => [node.id, node]));
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
};

const GrcFindingsTab: React.FC<GrcTabProps> = ({
  workspace, applyWorkspace, setStatusMessage, diagramSnapshot, onSwitchModule, onSwitchTab, focusRequest, getTabViewState, setTabViewState
}) => {
  const { findings: ruleFindings } = useManualAnalysis();
  const persistedFindings = workspace.findings || [];
  const persistedView = getTabViewState?.('findings', {
    expandedId: null
  }) ?? {
    expandedId: null
  };

  const [selectedType, setSelectedType] = useState<GrcFindingType | 'all'>('all');
  const [selectedSeverity, setSelectedSeverity] = useState<GrcFindingSeverity | 'all'>('all');
  const [selectedCategory, setSelectedCategory] = useState<ManualFindingCategory | 'all'>('all');
  const [selectedStride, setSelectedStride] = useState<StrideCategory | 'all'>('all');
  const [searchText, setSearchText] = useState('');
  const [sortColumn, setSortColumn] = useState<string>('severity');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [expandedId, setExpandedId] = useState<string | null>((persistedView.expandedId as string | null) ?? null);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newType, setNewType] = useState<GrcFindingType>('vulnerability');
  const [newSeverity, setNewSeverity] = useState<GrcFindingSeverity>('medium');
  const [newOwner, setNewOwner] = useState('');
  const [newRemediationStatus, setNewRemediationStatus] = useState<GrcRemediationStatus>('identified');
  const [newCvssScore, setNewCvssScore] = useState<string>('');

  const columnConfig = useTableColumnConfig('findings', FINDING_COLUMNS, workspace, applyWorkspace);

  useEffect(() => {
    if (focusRequest?.tab === 'findings' && focusRequest.entityId) {
      const id = focusRequest.entityId;
      if (persistedFindings.some(f => f.id === id)) {
        setExpandedId(id);
        setHighlightId(id);
        setTimeout(() => {
          document.getElementById(`grc-finding-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 100);
        setTimeout(() => setHighlightId(null), 2000);
      }
    }
  }, [focusRequest, persistedFindings]);

  useEffect(() => {
    setTabViewState?.('findings', {
      expandedId
    });
  }, [expandedId, setTabViewState]);

  const nodeLabelMap = useMemo(() => {
    const map = new Map<string, string>();
    diagramSnapshot?.nodes?.forEach(n => map.set(n.id, n.label || n.id));
    return map;
  }, [diagramSnapshot]);

  const edgeInfoMap = useMemo(() => {
    const map = new Map<string, { label: string; source: string; target: string; sourceName: string; targetName: string; indexCode?: string }>();
    diagramSnapshot?.edges?.forEach(e => {
      const srcLabel = diagramSnapshot.nodes.find(n => n.id === e.source)?.label || e.source;
      const tgtLabel = diagramSnapshot.nodes.find(n => n.id === e.target)?.label || e.target;
      map.set(e.id, { label: e.label || e.id, source: e.source, target: e.target, sourceName: srcLabel, targetName: tgtLabel, indexCode: e.indexCode });
    });
    return map;
  }, [diagramSnapshot]);

  const nodeIndexCodeMap = useMemo(() => {
    const map = new Map<string, string>();
    if (!diagramSnapshot) return map;
    for (const node of diagramSnapshot.nodes) {
      map.set(node.id, node.indexCode || node.id);
    }
    return map;
  }, [diagramSnapshot]);

  const getComponentLabel = useCallback((finding: GrcFinding): { text: string; parts: { label: string; code: string }[] } => {
    const parts: { label: string; code: string }[] = [];
    for (const nid of finding.relatedNodeIds) {
      const label = nodeLabelMap.get(nid);
      const code = nodeIndexCodeMap.get(nid) || '';
      if (label) parts.push({ label, code });
    }
    for (const eid of finding.relatedEdgeIds) {
      const info = edgeInfoMap.get(eid);
      if (info) parts.push({ label: `${info.sourceName} → ${info.targetName}`, code: info.indexCode || '' });
    }
    const text = parts.map(p => p.code ? `${p.label} (${p.code})` : p.label).join(', ') || '-';
    return { text, parts };
  }, [nodeLabelMap, nodeIndexCodeMap, edgeInfoMap]);

  const presentCategories = useMemo(() => {
    const cats = new Set<ManualFindingCategory>();
    persistedFindings.forEach(f => { if (f.category) cats.add(f.category as ManualFindingCategory); });
    return Array.from(cats);
  }, [persistedFindings]);

  const presentStride = useMemo(() => {
    const cats = new Set<StrideCategory>();
    persistedFindings.forEach(f => (f.strideCategories || []).forEach(s => cats.add(s as StrideCategory)));
    return Array.from(cats);
  }, [persistedFindings]);

  const filteredFindings = useMemo(() => {
    let result = persistedFindings;
    if (selectedType !== 'all') result = result.filter(f => f.type === selectedType);
    if (selectedSeverity !== 'all') result = result.filter(f => f.severity === selectedSeverity);
    if (selectedCategory !== 'all') result = result.filter(f => f.category === selectedCategory);
    if (selectedStride !== 'all') result = result.filter(f => (f.strideCategories || []).includes(selectedStride));
    if (searchText.trim()) {
      const lower = searchText.toLowerCase();
      result = result.filter(f =>
        f.title.toLowerCase().includes(lower) ||
        f.description.toLowerCase().includes(lower) ||
        (f.ruleId || '').toLowerCase().includes(lower)
      );
    }
    return result;
  }, [persistedFindings, selectedType, selectedSeverity, selectedCategory, selectedStride, searchText]);

  const sortedFindings = useMemo(() => {
    const arr = [...filteredFindings];
    const dir = sortDirection === 'asc' ? 1 : -1;
    arr.sort((a, b) => {
      let cmp = 0;
      switch (sortColumn) {
        case 'findingId': cmp = a.id.localeCompare(b.id); break;
        case 'title': cmp = a.title.localeCompare(b.title); break;
        case 'type': cmp = a.type.localeCompare(b.type); break;
        case 'severity': cmp = (SEVERITY_ORDER[a.severity] ?? 9) - (SEVERITY_ORDER[b.severity] ?? 9); break;
        case 'source': cmp = a.source.localeCompare(b.source); break;
        case 'status': cmp = a.status.localeCompare(b.status); break;
        case 'category': cmp = (a.category || '').localeCompare(b.category || ''); break;
        case 'component': cmp = getComponentLabel(a).text.localeCompare(getComponentLabel(b).text); break;
        case 'linkedRisks': cmp = a.linkedRiskIds.length - b.linkedRiskIds.length; break;
        default: break;
      }
      return cmp * dir;
    });
    return arr;
  }, [filteredFindings, sortColumn, sortDirection, getComponentLabel]);

  const handleSort = (col: string) => {
    if (sortColumn === col) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(col);
      setSortDirection(col === 'severity' ? 'asc' : 'asc');
    }
  };

  const updateFinding = useCallback((findingId: string, patch: Partial<GrcFinding>) => {
    const now = new Date().toISOString();
    applyWorkspace({
      ...workspace,
      findings: persistedFindings.map(f =>
        f.id === findingId ? { ...f, ...patch, updatedAt: now } : f
      ),
      updatedAt: now
    });
  }, [applyWorkspace, workspace, persistedFindings]);

  const handleSync = useCallback(() => {
    if (!ruleFindings || ruleFindings.length === 0) {
      setStatusMessage({ severity: 'info', text: 'No rule engine findings to sync. Open a diagram first.' });
      return;
    }
    const { workspace: nextWs, newCount, updatedCount } = syncFindingsFromRuleEngine(workspace, ruleFindings);
    applyWorkspace(nextWs);
    setStatusMessage({
      severity: 'success',
      text: `Synced: ${newCount} new finding${newCount !== 1 ? 's' : ''} added${updatedCount > 0 ? `, ${updatedCount} already existed` : ''}.`
    });
  }, [applyWorkspace, ruleFindings, setStatusMessage, workspace]);

  const handleAddFinding = useCallback(() => {
    const title = newTitle.trim();
    if (!title) {
      setStatusMessage({ severity: 'warning', text: 'Finding title is required.' });
      return;
    }
    const now = new Date().toISOString();
    const finding: GrcFinding = {
      id: generateFindingId(persistedFindings, workspace.assets, []),
      title,
      description: newDescription.trim(),
      type: newType,
      severity: newSeverity,
      source: 'manual',
      status: 'open',
      relatedNodeIds: [],
      relatedEdgeIds: [],
      linkedRiskIds: [],
      linkedTaskIds: [],
      linkedAssetIds: [],
      recommendations: [],
      owner: newOwner.trim() || undefined,
      remediationStatus: newType === 'vulnerability' ? newRemediationStatus : undefined,
      cvssScore: newType === 'vulnerability' && newCvssScore ? Number(newCvssScore) : undefined,
      createdAt: now,
      updatedAt: now
    };

    const riskId = createId('risk');
    const findingTitle = finding.title.trim();
    const matchingTier4Node = workspace.tierCatalogue.find(node =>
      node.tier === 4 && normalizeTierLabel(node.label) === normalizeTierLabel(findingTitle)
    );
    const derivedTierPath = buildTierPathFromNodeId(matchingTier4Node?.id, workspace.tierCatalogue);
    const defaultL = workspace.riskModel.likelihoodScale[Math.floor(workspace.riskModel.likelihoodScale.length / 2)]?.id || workspace.riskModel.likelihoodScale[0]?.id || '';
    const defaultI = workspace.riskModel.impactScale[Math.floor(workspace.riskModel.impactScale.length / 2)]?.id || workspace.riskModel.impactScale[0]?.id || '';
    const inherentScore = calculateRiskScore(workspace.riskModel, defaultL, defaultI, workspace.config);

    const autoRisk: GrcRisk = {
      id: riskId,
      title: finding.title,
      description: finding.description,
      status: 'draft',
      assetIds: [],
      diagramLinks: [],
      inherentScore,
      residualScore: undefined,
      treatmentStrategy: 'mitigate',
      tierPath: { ...derivedTierPath, tier4: derivedTierPath.tier4 || findingTitle || undefined },
      sourceFindingId: finding.id,
      createdAt: now,
      updatedAt: now
    };

    const findingWithRisk: GrcFinding = { ...finding, linkedRiskIds: [riskId] };

    applyWorkspace({
      ...workspace,
      findings: [...persistedFindings, findingWithRisk],
      risks: [...workspace.risks, autoRisk],
      updatedAt: now
    });
    setNewTitle('');
    setNewDescription('');
    setNewOwner('');
    setNewRemediationStatus('identified');
    setNewCvssScore('');
    setShowAddForm(false);
    setStatusMessage({ severity: 'success', text: `Finding "${title}" added with linked Tier 4 risk.` });
  }, [applyWorkspace, newCvssScore, newDescription, newOwner, newRemediationStatus, newSeverity, newTitle, newType, persistedFindings, setStatusMessage, workspace]);

  const handleCreateRisk = useCallback((finding: GrcFinding) => {
    const now = new Date().toISOString();
    const defaultL = workspace.riskModel.likelihoodScale[Math.floor(workspace.riskModel.likelihoodScale.length / 2)]?.id || workspace.riskModel.likelihoodScale[0]?.id || '';
    const defaultI = workspace.riskModel.impactScale[Math.floor(workspace.riskModel.impactScale.length / 2)]?.id || workspace.riskModel.impactScale[0]?.id || '';
    const inherentScore = calculateRiskScore(workspace.riskModel, defaultL, defaultI, workspace.config);
    const riskId = createId('risk');
    const findingTitle = finding.title.trim();
    const matchingTier4Node = workspace.tierCatalogue.find(node =>
      node.tier === 4 && normalizeTierLabel(node.label) === normalizeTierLabel(findingTitle)
    );
    const derivedTierPath = buildTierPathFromNodeId(matchingTier4Node?.id, workspace.tierCatalogue);
    const tierPath: GrcRisk['tierPath'] = {
      ...derivedTierPath,
      tier4: derivedTierPath.tier4 || findingTitle || undefined
    };

    const newRisk: GrcRisk = {
      id: riskId,
      title: finding.title,
      description: finding.description,
      status: 'draft',
      assetIds: finding.linkedAssetIds || [],
      diagramLinks: [],
      inherentScore,
      residualScore: undefined,
      treatmentStrategy: 'mitigate',
      tierPath,
      sourceFindingId: finding.id,
      createdAt: now,
      updatedAt: now
    };

    const updatedFindings = persistedFindings.map(f =>
      f.id === finding.id ? { ...f, linkedRiskIds: [...f.linkedRiskIds, riskId], updatedAt: now } : f
    );

    applyWorkspace({ ...workspace, risks: [...workspace.risks, newRisk], findings: updatedFindings, updatedAt: now });
    setStatusMessage({ severity: 'success', text: `Risk "${finding.title}" created. Go to Risks tab to complete it.` });
  }, [applyWorkspace, persistedFindings, setStatusMessage, workspace]);

  const handleCreateTask = useCallback((finding: GrcFinding) => {
    const now = new Date().toISOString();
    const taskId = createId('task');
    const newTask: GrcTask = {
      id: taskId,
      title: `Remediate: ${finding.title}`,
      description: finding.description,
      type: 'control_implementation',
      status: 'todo',
      priority: finding.severity === 'critical' ? 'critical' : finding.severity === 'high' ? 'high' : 'medium',
      sourceFindingId: finding.id,
      createdAt: now,
      updatedAt: now
    };

    const updatedFindings = persistedFindings.map(f =>
      f.id === finding.id ? { ...f, linkedTaskIds: [...f.linkedTaskIds, taskId], updatedAt: now } : f
    );

    applyWorkspace({ ...workspace, workflowTasks: [...workspace.workflowTasks, newTask], findings: updatedFindings, updatedAt: now });
    setStatusMessage({ severity: 'success', text: `Task created for "${finding.title}".` });
  }, [applyWorkspace, persistedFindings, setStatusMessage, workspace]);

  const handleDeleteFinding = useCallback((findingId: string) => {
    const finding = persistedFindings.find(f => f.id === findingId);
    if (!finding) return;
    const now = new Date().toISOString();

    const nextRisks = workspace.risks.map(r =>
      r.sourceFindingId === findingId ? { ...r, sourceFindingId: undefined, updatedAt: now } : r
    );
    const nextTasks = workspace.workflowTasks.map(t =>
      t.sourceFindingId === findingId ? { ...t, sourceFindingId: undefined, updatedAt: now } : t
    );

    applyWorkspace({
      ...workspace,
      findings: persistedFindings.filter(f => f.id !== findingId),
      risks: nextRisks,
      workflowTasks: nextTasks,
      updatedAt: now
    });
    setDeleteConfirmId(null);
    setStatusMessage({ severity: 'info', text: `Finding "${finding.title}" deleted.` });
  }, [applyWorkspace, persistedFindings, setStatusMessage, workspace]);

  const handleFocusNode = useCallback((nodeId: string) => {
    if (!diagramSnapshot) return;
    onSwitchModule?.('diagram');
    window.dispatchEvent(new CustomEvent('grc-focus-diagram-node', {
      detail: { nodeId, diagramId: diagramSnapshot.diagramId, force2D: true }
    }));
  }, [diagramSnapshot, onSwitchModule]);

  const sortableColumns = new Set(['findingId', 'title', 'type', 'severity', 'source', 'status', 'category', 'component', 'linkedRisks']);

  const renderCellContent = (col: ColumnDef, finding: GrcFinding) => {
    switch (col.id) {
      case 'findingId':
        return (
          <Tooltip title={finding.id} arrow>
            <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.75rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 130 }}>
              {finding.id}
            </Typography>
          </Tooltip>
        );
      case 'title':
        return <Typography variant="body2" sx={{ fontWeight: 500 }}>{finding.title}</Typography>;
      case 'type':
        return <Chip size="small" label={TYPE_LABELS[finding.type]} sx={{ fontSize: '0.7rem', height: 22 }} />;
      case 'severity': {
        const color = SEVERITY_COLORS[finding.severity];
        return (
          <Chip
            size="small"
            label={finding.severity.charAt(0).toUpperCase() + finding.severity.slice(1)}
            sx={{ fontSize: '0.7rem', height: 22, fontWeight: 700, bgcolor: color + '22', color, border: `1px solid ${color}66` }}
          />
        );
      }
      case 'source':
        return <Typography variant="body2" sx={{ fontSize: '0.8rem' }}>{SOURCE_LABELS[finding.source] || finding.source}</Typography>;
      case 'status':
        return (
          <TextField
            select size="small" variant="standard"
            value={finding.status}
            onChange={e => updateFinding(finding.id, { status: e.target.value as GrcFindingStatus })}
            sx={{ minWidth: 90, '& .MuiInput-input': { fontSize: '0.8rem' } }}
          >
            {Object.entries(STATUS_LABELS).map(([val, label]) => (
              <MenuItem key={val} value={val} sx={{ fontSize: '0.8rem' }}>{label}</MenuItem>
            ))}
          </TextField>
        );
      case 'category': {
        if (!finding.category) return <Typography variant="body2">-</Typography>;
        const catColor = CATEGORY_COLORS[finding.category as ManualFindingCategory];
        return catColor ? (
          <Chip
            size="small"
            label={CATEGORY_LABELS[finding.category as ManualFindingCategory]}
            sx={{ fontSize: '0.7rem', height: 20, bgcolor: catColor + '22', color: catColor, border: `1px solid ${catColor}66` }}
          />
        ) : <Typography variant="body2">{finding.category}</Typography>;
      }
      case 'stride':
        return (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.25 }}>
            {(finding.strideCategories || []).map((s: string) => {
              const sc = s as StrideCategory;
              return (
                <Tooltip key={s} title={s} arrow>
                  <Chip
                    size="small"
                    label={STRIDE_SHORT[sc] || s.charAt(0)}
                    sx={{
                      fontSize: '0.65rem', height: 18, fontWeight: 700,
                      bgcolor: (STRIDE_COLORS[sc] || '#999') + '22',
                      color: STRIDE_COLORS[sc] || '#999',
                      border: `1px solid ${(STRIDE_COLORS[sc] || '#999')}66`,
                      '& .MuiChip-label': { px: 0.5 }
                    }}
                  />
                </Tooltip>
              );
            })}
            {(!finding.strideCategories || finding.strideCategories.length === 0) && (
              <Typography variant="body2" sx={{ fontSize: '0.8rem' }}>-</Typography>
            )}
          </Box>
        );
      case 'component': {
        const firstNodeId = finding.relatedNodeIds[0];
        const comp = getComponentLabel(finding);
        return (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Box sx={{ minWidth: 0 }}>
              {comp.parts.length > 0 ? comp.parts.map((p, i) => (
                <Box key={i} sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5, flexWrap: 'wrap' }}>
                  <Typography variant="body2" sx={{ fontSize: '0.8rem' }}>{p.label}</Typography>
                  {p.code && (
                    <Typography variant="caption" sx={{ fontFamily: 'monospace', fontSize: '0.65rem', color: 'text.secondary' }}>
                      {p.code}
                    </Typography>
                  )}
                </Box>
              )) : (
                <Typography variant="body2" sx={{ fontSize: '0.8rem' }}>-</Typography>
              )}
            </Box>
            {firstNodeId && diagramSnapshot && (
              <Tooltip title="Focus node in diagram" arrow>
                <IconButton size="small" onClick={() => handleFocusNode(firstNodeId)} sx={{ p: 0.25 }}>
                  <Crosshair size={14} />
                </IconButton>
              </Tooltip>
            )}
          </Box>
        );
      }
      case 'linkedRisks':
        return (
          <Chip
            size="small"
            label={finding.linkedRiskIds.length}
            variant="outlined"
            onClick={finding.linkedRiskIds.length > 0 ? () => onSwitchTab?.('risks', finding.linkedRiskIds[0]) : undefined}
            sx={{ fontSize: '0.7rem', height: 20, cursor: finding.linkedRiskIds.length > 0 ? 'pointer' : 'default' }}
          />
        );
      case 'owner':
        return <Typography variant="body2" sx={{ fontSize: '0.8rem' }}>{finding.owner || '-'}</Typography>;
      case 'remediationStatus':
        return finding.type === 'vulnerability' && finding.remediationStatus ? (
          <Chip size="small" label={LBL[finding.remediationStatus] || finding.remediationStatus} sx={{ fontSize: '0.7rem', height: 22 }} />
        ) : <Typography variant="body2" sx={{ fontSize: '0.8rem' }}>-</Typography>;
      case 'cvssScore':
        return finding.type === 'vulnerability' && finding.cvssScore != null ? (
          <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.8rem', fontWeight: 600 }}>{finding.cvssScore.toFixed(1)}</Typography>
        ) : <Typography variant="body2" sx={{ fontSize: '0.8rem' }}>-</Typography>;
      case 'actions':
        return (
          <Box sx={{ display: 'flex', gap: 0.25 }}>
            {finding.relatedNodeIds[0] && diagramSnapshot && (
              <Tooltip title="Focus node" arrow>
                <IconButton size="small" onClick={() => handleFocusNode(finding.relatedNodeIds[0])}>
                  <Crosshair size={14} />
                </IconButton>
              </Tooltip>
            )}
            <Tooltip title="Create Risk" arrow>
              <IconButton size="small" onClick={() => handleCreateRisk(finding)}>
                <Shield size={14} />
              </IconButton>
            </Tooltip>
            <Tooltip title="Create Task" arrow>
              <IconButton size="small" onClick={() => handleCreateTask(finding)}>
                <Plus size={14} />
              </IconButton>
            </Tooltip>
            <Tooltip title="Delete" arrow>
              <IconButton size="small" onClick={() => setDeleteConfirmId(finding.id)}>
                <Trash2 size={14} />
              </IconButton>
            </Tooltip>
          </Box>
        );
      default: return null;
    }
  };

  const renderExpandedDetail = (finding: GrcFinding) => {
    const ruleInfo = finding.ruleId ? manualRuleCatalog[finding.ruleId] : undefined;
    const linkedAssets = workspace.assets.filter(a => finding.linkedAssetIds.includes(a.id));
    const linkedRisks = workspace.risks.filter(r => finding.linkedRiskIds.includes(r.id));
    const linkedTasks = workspace.workflowTasks.filter(t => finding.linkedTaskIds.includes(t.id));

    return (
      <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1.5, bgcolor: 'action.hover' }}>
        {finding.description && (
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>Description</Typography>
            <Typography variant="body2">{finding.description}</Typography>
          </Box>
        )}

        {finding.recommendations.length > 0 && (
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>Recommendations</Typography>
            {finding.recommendations.map((rec, i) => (
              <Typography key={i} variant="body2">{i + 1}. {rec}</Typography>
            ))}
          </Box>
        )}

        {ruleInfo && (
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>Rule Details ({finding.ruleId})</Typography>
            {ruleInfo.whyItMatters && <Typography variant="body2">{ruleInfo.whyItMatters}</Typography>}
            {ruleInfo.howToFix && ruleInfo.howToFix.length > 0 && (
              <Box sx={{ mt: 0.5 }}>
                {ruleInfo.howToFix.map((fix: string, i: number) => (
                  <Typography key={i} variant="body2" sx={{ fontSize: '0.8rem' }}>- {fix}</Typography>
                ))}
              </Box>
            )}
          </Box>
        )}

        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <TextField
            size="small" label="Owner" variant="outlined" value={finding.owner || ''}
            onChange={e => updateFinding(finding.id, { owner: e.target.value || undefined })}
            sx={{ width: 200 }}
          />
          {finding.type === 'vulnerability' && (
            <TextField
              select size="small" label="Remediation Status" variant="outlined"
              value={finding.remediationStatus || 'identified'}
              onChange={e => updateFinding(finding.id, { remediationStatus: e.target.value as GrcRemediationStatus })}
              sx={{ width: 220 }}
            >
              {REMEDIATION_STATUSES.map(rs => (
                <MenuItem key={rs} value={rs}>{LBL[rs] || rs}</MenuItem>
              ))}
            </TextField>
          )}
          {finding.type === 'vulnerability' && (
            <TextField
              size="small" label="CVSS Score" variant="outlined" type="number"
              value={finding.cvssScore ?? ''}
              inputProps={{ min: 0, max: 10, step: 0.1 }}
              onChange={e => updateFinding(finding.id, { cvssScore: e.target.value ? Number(e.target.value) : undefined })}
              sx={{ width: 120 }}
            />
          )}
          <TextField
            size="small" label="Notes" variant="outlined" multiline maxRows={3}
            value={finding.notes || ''}
            onChange={e => updateFinding(finding.id, { notes: e.target.value || undefined })}
            sx={{ flex: 1 }}
          />
        </Box>

        {(finding.relatedNodeIds.length > 0 || finding.relatedEdgeIds.length > 0) && (
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>Related Components</Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
              {finding.relatedNodeIds.map(nid => (
                <Chip
                  key={nid} size="small"
                  label={nodeLabelMap.get(nid) || nid}
                  icon={diagramSnapshot ? <Crosshair size={12} /> : undefined}
                  onClick={diagramSnapshot ? () => handleFocusNode(nid) : undefined}
                  sx={{ fontSize: '0.7rem', height: 22, cursor: diagramSnapshot ? 'pointer' : 'default' }}
                />
              ))}
              {finding.relatedEdgeIds.map(eid => {
                const info = edgeInfoMap.get(eid);
                const focusId = info?.source;
                return (
                  <Chip
                    key={eid} size="small" variant="outlined"
                    label={info ? `${info.sourceName} → ${info.targetName}` : eid}
                    icon={diagramSnapshot && focusId ? <Crosshair size={12} /> : undefined}
                    onClick={diagramSnapshot && focusId ? () => handleFocusNode(focusId) : undefined}
                    sx={{ fontSize: '0.7rem', height: 22, cursor: diagramSnapshot && focusId ? 'pointer' : 'default' }}
                  />
                );
              })}
            </Box>
          </Box>
        )}

        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
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
          {linkedRisks.length > 0 && (
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>Linked Risks</Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.25 }}>
                {linkedRisks.map(r => (
                  <Chip
                    key={r.id} size="small" label={r.title} variant="outlined"
                    onClick={() => onSwitchTab?.('risks', r.id)}
                    sx={{ fontSize: '0.68rem', height: 18, cursor: 'pointer' }}
                  />
                ))}
              </Box>
            </Box>
          )}
          {linkedTasks.length > 0 && (
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>Linked Tasks</Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.25 }}>
                {linkedTasks.map(t => (
                  <Chip
                    key={t.id} size="small" label={t.title} variant="outlined"
                    onClick={() => onSwitchTab?.('workflow_config')}
                    sx={{ fontSize: '0.68rem', height: 18, cursor: 'pointer' }}
                  />
                ))}
              </Box>
            </Box>
          )}
        </Box>

        <Typography variant="caption" color="text.secondary">
          Created: {new Date(finding.createdAt).toLocaleString()} | Updated: {new Date(finding.updatedAt).toLocaleString()}
        </Typography>
      </Box>
    );
  };

  if (persistedFindings.length === 0 && ruleFindings.length === 0) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 300, gap: 2 }}>
        <AlertTriangle size={40} style={{ opacity: 0.3 }} />
        <Typography variant="h6" color="text.secondary">No findings</Typography>
        <Typography variant="body2" color="text.secondary" textAlign="center" sx={{ maxWidth: 400 }}>
          Open a diagram and run the rule-based analysis engine, then click "Sync from Rule Engine" to import findings.
          You can also add findings manually.
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button variant="outlined" size="small" startIcon={<Plus size={14} />} onClick={() => setShowAddForm(true)}>
            Add Manual Finding
          </Button>
          {ruleFindings.length > 0 && (
            <Button variant="contained" size="small" startIcon={<RefreshCw size={14} />} onClick={handleSync}>
              Sync from Rule Engine
            </Button>
          )}
        </Box>
        <Collapse in={showAddForm} sx={{ width: '100%', maxWidth: 600 }}>
          <Paper sx={{ ...cardSx, mt: 1 }}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              <TextField size="small" label="Title *" value={newTitle} onChange={e => setNewTitle(e.target.value)} fullWidth />
              <TextField size="small" label="Description" value={newDescription} onChange={e => setNewDescription(e.target.value)} multiline rows={2} fullWidth />
              <Box sx={{ display: 'flex', gap: 1 }}>
                <TextField select size="small" label="Type" value={newType} onChange={e => setNewType(e.target.value as GrcFindingType)} sx={{ minWidth: 140 }}>
                  {Object.entries(TYPE_LABELS).map(([v, l]) => <MenuItem key={v} value={v}>{l}</MenuItem>)}
                </TextField>
                <TextField select size="small" label="Severity" value={newSeverity} onChange={e => setNewSeverity(e.target.value as GrcFindingSeverity)} sx={{ minWidth: 120 }}>
                  {Object.keys(SEVERITY_COLORS).map(v => <MenuItem key={v} value={v}>{v.charAt(0).toUpperCase() + v.slice(1)}</MenuItem>)}
                </TextField>
                <TextField size="small" label="Owner" value={newOwner} onChange={e => setNewOwner(e.target.value)} sx={{ flex: 1 }} />
              </Box>
              {newType === 'vulnerability' && (
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <TextField select size="small" label="Remediation Status" value={newRemediationStatus}
                    onChange={e => setNewRemediationStatus(e.target.value as GrcRemediationStatus)} sx={{ minWidth: 200 }}>
                    {REMEDIATION_STATUSES.map(rs => <MenuItem key={rs} value={rs}>{LBL[rs] || rs}</MenuItem>)}
                  </TextField>
                  <TextField size="small" label="CVSS Score" type="number" value={newCvssScore}
                    inputProps={{ min: 0, max: 10, step: 0.1 }}
                    onChange={e => setNewCvssScore(e.target.value)} sx={{ width: 120 }} />
                </Box>
              )}
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button variant="contained" size="small" onClick={handleAddFinding}>Add Finding</Button>
                <Button variant="text" size="small" onClick={() => setShowAddForm(false)}>Cancel</Button>
              </Box>
            </Box>
          </Paper>
        </Collapse>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, p: 2 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
        <AlertTriangle size={18} />
        <Typography variant="h6" sx={{ fontWeight: 600 }}>Security Findings</Typography>
        <Chip label={`${persistedFindings.length} total`} size="small" />
        {filteredFindings.length !== persistedFindings.length && (
          <Chip label={`${filteredFindings.length} shown`} size="small" variant="outlined" />
        )}
        <Box sx={{ flex: 1 }} />
        <Button
          variant="outlined" size="small" startIcon={<RefreshCw size={14} />}
          onClick={handleSync}
          disabled={!ruleFindings || ruleFindings.length === 0}
        >
          Sync from Rule Engine{ruleFindings.length > 0 ? ` (${ruleFindings.length})` : ''}
        </Button>
        <Button variant="outlined" size="small" startIcon={<Plus size={14} />} onClick={() => setShowAddForm(!showAddForm)}>
          Add Finding
        </Button>
        <TableColumnConfigPopover
          allColumns={columnConfig.allColumns}
          visibleIds={columnConfig.visibleIds}
          onToggle={columnConfig.toggleColumn}
          onMove={columnConfig.moveColumn}
          onReset={columnConfig.resetToDefaults}
        />
      </Box>

      {/* Add form */}
      <Collapse in={showAddForm}>
        <Paper sx={cardSx}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            <TextField size="small" label="Title *" value={newTitle} onChange={e => setNewTitle(e.target.value)} fullWidth />
            <TextField size="small" label="Description" value={newDescription} onChange={e => setNewDescription(e.target.value)} multiline rows={2} fullWidth />
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              <TextField select size="small" label="Type" value={newType} onChange={e => setNewType(e.target.value as GrcFindingType)} sx={{ minWidth: 140 }}>
                {Object.entries(TYPE_LABELS).map(([v, l]) => <MenuItem key={v} value={v}>{l}</MenuItem>)}
              </TextField>
              <TextField select size="small" label="Severity" value={newSeverity} onChange={e => setNewSeverity(e.target.value as GrcFindingSeverity)} sx={{ minWidth: 120 }}>
                {Object.keys(SEVERITY_COLORS).map(v => <MenuItem key={v} value={v}>{v.charAt(0).toUpperCase() + v.slice(1)}</MenuItem>)}
              </TextField>
              <TextField size="small" label="Owner" value={newOwner} onChange={e => setNewOwner(e.target.value)} sx={{ flex: 1, minWidth: 120 }} />
            </Box>
            {newType === 'vulnerability' && (
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                <TextField select size="small" label="Remediation Status" value={newRemediationStatus}
                  onChange={e => setNewRemediationStatus(e.target.value as GrcRemediationStatus)} sx={{ minWidth: 200 }}>
                  {REMEDIATION_STATUSES.map(rs => <MenuItem key={rs} value={rs}>{LBL[rs] || rs}</MenuItem>)}
                </TextField>
                <TextField size="small" label="CVSS Score" type="number" value={newCvssScore}
                  inputProps={{ min: 0, max: 10, step: 0.1 }}
                  onChange={e => setNewCvssScore(e.target.value)} sx={{ width: 120 }} />
              </Box>
            )}
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button variant="contained" size="small" onClick={handleAddFinding}>Add Finding</Button>
              <Button variant="text" size="small" onClick={() => setShowAddForm(false)}>Cancel</Button>
            </Box>
          </Box>
        </Paper>
      </Collapse>

      {/* Filters */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, alignItems: 'center' }}>
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 500, minWidth: 40 }}>Type:</Typography>
          <Chip label="All" size="small" onClick={() => setSelectedType('all')} variant={selectedType === 'all' ? 'filled' : 'outlined'} sx={{ fontWeight: selectedType === 'all' ? 700 : 400 }} />
          {(Object.entries(TYPE_LABELS) as [GrcFindingType, string][]).map(([val, label]) => (
            <Chip key={val} label={label} size="small" onClick={() => setSelectedType(selectedType === val ? 'all' : val)} variant={selectedType === val ? 'filled' : 'outlined'} sx={{ fontWeight: selectedType === val ? 700 : 400 }} />
          ))}
        </Box>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, alignItems: 'center' }}>
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 500, minWidth: 40 }}>Sev:</Typography>
          <Chip label="All" size="small" onClick={() => setSelectedSeverity('all')} variant={selectedSeverity === 'all' ? 'filled' : 'outlined'} sx={{ fontWeight: selectedSeverity === 'all' ? 700 : 400 }} />
          {(Object.keys(SEVERITY_COLORS) as GrcFindingSeverity[]).map(sev => (
            <Chip
              key={sev} size="small"
              label={sev.charAt(0).toUpperCase() + sev.slice(1)}
              onClick={() => setSelectedSeverity(selectedSeverity === sev ? 'all' : sev)}
              variant={selectedSeverity === sev ? 'filled' : 'outlined'}
              sx={{
                fontWeight: selectedSeverity === sev ? 700 : 400,
                bgcolor: selectedSeverity === sev ? SEVERITY_COLORS[sev] + '22' : undefined,
                color: selectedSeverity === sev ? SEVERITY_COLORS[sev] : undefined,
                borderColor: selectedSeverity === sev ? SEVERITY_COLORS[sev] + '88' : undefined
              }}
            />
          ))}
        </Box>
        {presentCategories.length > 0 && (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, alignItems: 'center' }}>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 500, minWidth: 40 }}>Cat:</Typography>
            <Chip label="All" size="small" onClick={() => setSelectedCategory('all')} variant={selectedCategory === 'all' ? 'filled' : 'outlined'} sx={{ fontWeight: selectedCategory === 'all' ? 700 : 400 }} />
            {presentCategories.map(cat => (
              <Chip
                key={cat} size="small"
                label={CATEGORY_LABELS[cat]}
                onClick={() => setSelectedCategory(selectedCategory === cat ? 'all' : cat)}
                variant={selectedCategory === cat ? 'filled' : 'outlined'}
                sx={{
                  fontWeight: selectedCategory === cat ? 700 : 400,
                  bgcolor: selectedCategory === cat ? CATEGORY_COLORS[cat] + '22' : undefined,
                  color: selectedCategory === cat ? CATEGORY_COLORS[cat] : undefined,
                  borderColor: selectedCategory === cat ? CATEGORY_COLORS[cat] + '88' : undefined
                }}
              />
            ))}
          </Box>
        )}
        {presentStride.length > 0 && (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, alignItems: 'center' }}>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 500, minWidth: 40 }}>STRIDE:</Typography>
            <Chip label="All" size="small" onClick={() => setSelectedStride('all')} variant={selectedStride === 'all' ? 'filled' : 'outlined'} sx={{ fontWeight: selectedStride === 'all' ? 700 : 400 }} />
            {ALL_STRIDE.filter(s => presentStride.includes(s)).map(s => (
              <Tooltip key={s} title={s} arrow>
                <Chip
                  size="small" label={STRIDE_SHORT[s]}
                  onClick={() => setSelectedStride(selectedStride === s ? 'all' : s)}
                  variant={selectedStride === s ? 'filled' : 'outlined'}
                  sx={{
                    fontWeight: 700,
                    bgcolor: selectedStride === s ? STRIDE_COLORS[s] + '33' : undefined,
                    color: selectedStride === s ? STRIDE_COLORS[s] : undefined,
                    borderColor: selectedStride === s ? STRIDE_COLORS[s] + '88' : undefined,
                    '& .MuiChip-label': { px: 0.75 }
                  }}
                />
              </Tooltip>
            ))}
          </Box>
        )}
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, alignItems: 'center' }}>
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 500, minWidth: 40 }}>Quick:</Typography>
          <Chip
            label="Vulnerabilities"
            size="small"
            onClick={() => setSelectedType(selectedType === 'vulnerability' ? 'all' : 'vulnerability')}
            variant={selectedType === 'vulnerability' ? 'filled' : 'outlined'}
            sx={{ fontWeight: selectedType === 'vulnerability' ? 700 : 400 }}
          />
        </Box>
        <TextField
          size="small" placeholder="Search findings..." value={searchText}
          onChange={e => setSearchText(e.target.value)}
          sx={{ maxWidth: 300 }}
        />
      </Box>

      {/* Table */}
      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ width: 30 }} />
              {columnConfig.visibleColumns.map(col => (
                <TableCell key={col.id} sx={col.width ? { width: col.width } : undefined}>
                  {sortableColumns.has(col.id) ? (
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
            {sortedFindings.map(finding => {
              const isExpanded = expandedId === finding.id;
              return (
                <React.Fragment key={finding.id}>
                  <TableRow id={`grc-finding-${finding.id}`} hover sx={{
                    '& > td': { borderBottom: isExpanded ? 'none' : undefined },
                    ...(highlightId === finding.id && { bgcolor: 'action.selected', transition: 'background-color 0.3s' })
                  }}>
                    <TableCell sx={{ width: 30, p: 0.5 }}>
                      <IconButton size="small" onClick={() => setExpandedId(isExpanded ? null : finding.id)}>
                        {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                      </IconButton>
                    </TableCell>
                    {columnConfig.visibleColumns.map(col => (
                      <TableCell key={col.id}>{renderCellContent(col, finding)}</TableCell>
                    ))}
                  </TableRow>
                  <TableRow>
                    <TableCell colSpan={columnConfig.visibleColumns.length + 1} sx={{ p: 0 }}>
                      <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                        {renderExpandedDetail(finding)}
                      </Collapse>
                    </TableCell>
                  </TableRow>
                </React.Fragment>
              );
            })}
            {sortedFindings.length === 0 && (
              <TableRow>
                <TableCell colSpan={columnConfig.visibleColumns.length + 1} align="center">
                  <Typography variant="body2" color="text.secondary" sx={{ py: 3 }}>
                    No findings match the current filters.
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Delete confirmation dialog */}
      <Dialog open={Boolean(deleteConfirmId)} onClose={() => setDeleteConfirmId(null)}>
        <DialogTitle>Delete Finding</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete this finding? This will also remove linkages from any associated risks and tasks.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirmId(null)}>Cancel</Button>
          <Button color="error" onClick={() => deleteConfirmId && handleDeleteFinding(deleteConfirmId)}>Delete</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default GrcFindingsTab;
