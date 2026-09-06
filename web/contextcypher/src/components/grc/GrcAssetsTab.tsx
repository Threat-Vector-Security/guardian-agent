import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box, Button, Chip, Collapse, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle,
  IconButton, MenuItem, Paper, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, TableSortLabel, TextField, Tooltip, Typography
} from '@mui/material';
import { ChevronDown, ChevronRight, Crosshair, Link2, Plus, Trash2, Undo } from 'lucide-react';
import { GrcAssetCriticality, GrcAssetDomain } from '../../types/GrcTypes';
import {
  deriveBusinessCriticality,
  deriveSecurityCriticality,
  getConfig,
  syncAssetsFromDiagram,
  syncConnectionsFromDiagram
} from '../../services/GrcWorkspaceService';
import { GrcTabProps, cardSx, createId } from './grcShared';
import { useTableColumnConfig, ColumnDef } from './useTableColumnConfig';
import TableColumnConfigPopover from './TableColumnConfigPopover';

const domainOptions: Array<{ value: GrcAssetDomain; label: string }> = [
  { value: 'it', label: 'IT' },
  { value: 'ot', label: 'OT' },
  { value: 'cloud', label: 'Cloud' },
  { value: 'iot', label: 'IoT' },
  { value: 'application', label: 'Application' },
  { value: 'data', label: 'Data' },
  { value: 'network', label: 'Network' },
  { value: 'physical', label: 'Physical' },
  { value: 'people', label: 'People' }
];

const domainLabelMap: Record<GrcAssetDomain, string> = Object.fromEntries(
  domainOptions.map(o => [o.value, o.label])
) as Record<GrcAssetDomain, string>;

type SortDirection = 'asc' | 'desc';

const ASSET_COLUMNS: ColumnDef[] = [
  { id: 'indexCode', label: 'ID', defaultVisible: true, removable: true, width: 160 },
  { id: 'name', label: 'Asset', defaultVisible: true, removable: false },
  { id: 'domain', label: 'Domain', defaultVisible: true, removable: true },
  { id: 'category', label: 'Category', defaultVisible: true, removable: true },
  { id: 'owner', label: 'Owner', defaultVisible: true, removable: true },
  { id: 'zone', label: 'Security Zone', defaultVisible: true, removable: true },
  { id: 'businessCriticality', label: 'Business Criticality', defaultVisible: true, removable: true },
  { id: 'securityCriticality', label: 'Security Criticality', defaultVisible: true, removable: true },
  { id: 'linkedRisks', label: 'Linked Risks', defaultVisible: true, removable: true },
  { id: 'linkedNodes', label: 'Linked Nodes', defaultVisible: true, removable: true },
  { id: 'businessUnit', label: 'Business Unit', defaultVisible: false, removable: true },
  { id: 'actions', label: 'Actions', defaultVisible: true, removable: false }
];

const CONNECTION_COLUMNS: ColumnDef[] = [
  { id: 'indexCode', label: 'ID', defaultVisible: true, removable: true, width: 160 },
  { id: 'name', label: 'Connection', defaultVisible: true, removable: false },
  { id: 'sourceTarget', label: 'Source / Target', defaultVisible: true, removable: true },
  { id: 'domain', label: 'Domain', defaultVisible: true, removable: true },
  { id: 'category', label: 'Category', defaultVisible: true, removable: true },
  { id: 'owner', label: 'Owner', defaultVisible: true, removable: true },
  { id: 'zone', label: 'Security Zone', defaultVisible: true, removable: true },
  { id: 'businessCriticality', label: 'Business Criticality', defaultVisible: true, removable: true },
  { id: 'securityCriticality', label: 'Security Criticality', defaultVisible: true, removable: true },
  { id: 'linkedRisks', label: 'Linked Risks', defaultVisible: true, removable: true },
  { id: 'businessUnit', label: 'Business Unit', defaultVisible: false, removable: true },
  { id: 'actions', label: 'Actions', defaultVisible: true, removable: false }
];

const zoneColorMap: Record<string, string> = {
  'DMZ': '#fb923c',
  'External': '#ef4444',
  'Internal': '#22c55e',
  'Trusted': '#3b82f6',
  'Untrusted': '#ef4444',
  'Management': '#8b5cf6',
  'Cloud': '#06b6d4'
};

const getZoneColor = (zone: string): string => {
  for (const [key, color] of Object.entries(zoneColorMap)) {
    if (zone.toLowerCase().includes(key.toLowerCase())) return color;
  }
  return '#64748b';
};

const GrcAssetsTab: React.FC<GrcTabProps> = ({
  workspace,
  applyWorkspace,
  setStatusMessage,
  diagramSnapshot,
  onSwitchModule,
  onSwitchTab,
  focusRequest,
  getTabViewState,
  setTabViewState
}) => {
  const config = getConfig(workspace);
  const criticalityScale = useMemo(
    () => [...config.assetCriticalityScale].sort((a, b) => a.value - b.value),
    [config.assetCriticalityScale]
  );

  const [assetSearch, setAssetSearch] = useState('');
  const [newAssetName, setNewAssetName] = useState('');
  const [newAssetDescription, setNewAssetDescription] = useState('');
  const [newAssetOwner, setNewAssetOwner] = useState('');
  const [newAssetDomain, setNewAssetDomain] = useState<GrcAssetDomain>(config.recordDefaults.assetDomain);
  const [newAssetCategory, setNewAssetCategory] = useState(config.recordDefaults.assetCategory);
  const [newBusinessCriticality, setNewBusinessCriticality] = useState(config.recordDefaults.assetBusinessCriticality);
  const [newSecurityCriticality, setNewSecurityCriticality] = useState(config.recordDefaults.assetSecurityCriticality);
  const [newBusinessUnit, setNewBusinessUnit] = useState('');
  const [businessUnitFilter, setBusinessUnitFilter] = useState('');
  const businessUnits = useMemo(() => workspace.config?.businessUnits || [], [workspace.config?.businessUnits]);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [editingNameId, setEditingNameId] = useState<string | null>(null);
  const [editingNameValue, setEditingNameValue] = useState('');
  const [sortColumn, setSortColumn] = useState<string>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const persistedView = getTabViewState?.('assets', {
    expandedAssetId: null,
    expandedConnId: null
  }) ?? {
    expandedAssetId: null,
    expandedConnId: null
  };
  const [expandedAssetId, setExpandedAssetId] = useState<string | null>((persistedView.expandedAssetId as string | null) ?? null);
  const [expandedConnId, setExpandedConnId] = useState<string | null>((persistedView.expandedConnId as string | null) ?? null);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [connSearch, setConnSearch] = useState('');
  const [connSortColumn, setConnSortColumn] = useState<string>('name');
  const [connSortDirection, setConnSortDirection] = useState<SortDirection>('asc');

  useEffect(() => {
    if (focusRequest?.tab === 'assets' && focusRequest.entityId) {
      const id = focusRequest.entityId;
      const asset = workspace.assets.find(a => a.id === id);
      if (asset) {
        if (asset.isConnection) {
          setExpandedConnId(id);
        } else {
          setExpandedAssetId(id);
        }
        setHighlightId(id);
        setTimeout(() => {
          document.getElementById(`grc-asset-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 100);
        setTimeout(() => setHighlightId(null), 2000);
      }
    }
  }, [focusRequest, workspace.assets]);

  useEffect(() => {
    setTabViewState?.('assets', {
      expandedAssetId,
      expandedConnId
    });
  }, [expandedAssetId, expandedConnId, setTabViewState]);

  const columnConfig = useTableColumnConfig('assets', ASSET_COLUMNS, workspace, applyWorkspace);
  const connColumnConfig = useTableColumnConfig('connections', CONNECTION_COLUMNS, workspace, applyWorkspace);

  const categoriesForNewDomain = config.assetCategories[newAssetDomain] || [];

  const nodeAssets = useMemo(
    () => workspace.assets.filter(a => !a.isConnection),
    [workspace.assets]
  );
  const connectionAssets = useMemo(
    () => workspace.assets.filter(a => a.isConnection),
    [workspace.assets]
  );

  const linkedRiskCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const risk of workspace.risks) {
      for (const assetId of risk.assetIds) {
        counts[assetId] = (counts[assetId] || 0) + 1;
      }
    }
    return counts;
  }, [workspace.risks]);

  const linkedTaskCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const task of workspace.workflowTasks) {
      if (task.assetId) {
        counts[task.assetId] = (counts[task.assetId] || 0) + 1;
      }
    }
    return counts;
  }, [workspace.workflowTasks]);

  const linkedThreatActorCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const actor of workspace.threatActors) {
      for (const assetId of actor.targetedAssetIds) {
        counts[assetId] = (counts[assetId] || 0) + 1;
      }
    }
    return counts;
  }, [workspace.threatActors]);

  const linkedThreatScenarioCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const scenario of workspace.threatScenarios) {
      for (const assetId of scenario.targetedAssetIds) {
        counts[assetId] = (counts[assetId] || 0) + 1;
      }
    }
    return counts;
  }, [workspace.threatScenarios]);

  const nodeSnapshotMap = useMemo(() => {
    const map = new Map<string, { label?: string; zone?: string; indexCode?: string }>();
    if (!diagramSnapshot) return map;
    for (const node of diagramSnapshot.nodes) {
      map.set(node.id, {
        label: node.label,
        zone: node.zone,
        indexCode: node.indexCode
      });
    }
    return map;
  }, [diagramSnapshot]);

  const edgeSnapshotMap = useMemo(() => {
    const map = new Map<string, { label?: string; zone?: string; source: string; target: string; indexCode?: string }>();
    if (!diagramSnapshot?.edges) return map;
    for (const edge of diagramSnapshot.edges) {
      map.set(edge.id, {
        label: edge.label,
        zone: edge.zone,
        source: edge.source,
        target: edge.target,
        indexCode: edge.indexCode
      });
    }
    return map;
  }, [diagramSnapshot]);

  const getAssetIndexCode = useCallback((asset: typeof workspace.assets[0]) => {
    const ref = asset.diagramRefs[0];
    if (!ref) return undefined;
    if (asset.isConnection) {
      const edgeInfo = edgeSnapshotMap.get(ref.nodeId);
      return edgeInfo?.indexCode || ref.nodeId;
    }
    const nodeInfo = nodeSnapshotMap.get(ref.nodeId);
    return nodeInfo?.indexCode || ref.nodeId;
  }, [edgeSnapshotMap, nodeSnapshotMap]);

  const getAssetZone = useCallback((asset: typeof workspace.assets[0]) => {
    const ref = asset.diagramRefs[0];
    if (!ref) return undefined;
    if (asset.isConnection) {
      return edgeSnapshotMap.get(ref.nodeId)?.zone;
    }
    return nodeSnapshotMap.get(ref.nodeId)?.zone;
  }, [edgeSnapshotMap, nodeSnapshotMap]);

  useEffect(() => {
    if (categoriesForNewDomain.length === 0) return;
    if (!categoriesForNewDomain.includes(newAssetCategory)) {
      setNewAssetCategory(categoriesForNewDomain[0]);
    }
  }, [categoriesForNewDomain, newAssetCategory]);

  const updateAsset = useCallback((assetId: string, patch: Record<string, unknown>) => {
    const now = new Date().toISOString();
    applyWorkspace({
      ...workspace,
      assets: workspace.assets.map(asset =>
        asset.id === assetId ? { ...asset, ...patch, updatedAt: now } : asset
      ),
      updatedAt: now
    });
  }, [applyWorkspace, workspace]);

  const handleAddAsset = useCallback(() => {
    const assetName = newAssetName.trim();
    if (!assetName) {
      setStatusMessage({ severity: 'warning', text: 'Asset name is required.' });
      return;
    }
    const category = newAssetCategory.trim();
    if (!category) {
      setStatusMessage({ severity: 'warning', text: 'Select an asset category.' });
      return;
    }

    const now = new Date().toISOString();
    const nextAsset = {
      id: createId('asset'),
      name: assetName,
      type: category,
      domain: newAssetDomain,
      category,
      owner: newAssetOwner.trim() || undefined,
      description: newAssetDescription.trim() || undefined,
      businessCriticality: newBusinessCriticality,
      securityCriticality: newSecurityCriticality,
      criticality: { ...config.recordDefaults.assetCriticality },
      diagramRefs: [],
      businessUnit: newBusinessUnit.trim() || undefined,
      createdAt: now,
      updatedAt: now
    };

    applyWorkspace({ ...workspace, assets: [...workspace.assets, nextAsset] });
    setNewAssetName('');
    setNewAssetDescription('');
    setNewAssetOwner('');
    setNewBusinessUnit('');
    setStatusMessage({ severity: 'success', text: `Added asset "${assetName}".` });
  }, [
    applyWorkspace, config.recordDefaults.assetCriticality,
    newAssetCategory, newAssetDescription, newAssetDomain, newAssetName,
    newAssetOwner, newBusinessCriticality, newSecurityCriticality,
    setStatusMessage, workspace
  ]);

  const handleDeleteAsset = useCallback((assetId: string) => {
    const asset = workspace.assets.find(a => a.id === assetId);
    if (!asset) return;
    const now = new Date().toISOString();
    let riskUpdates = 0;
    const nextRisks = workspace.risks.map(risk => {
      if (!risk.assetIds.includes(assetId)) return risk;
      riskUpdates += 1;
      return { ...risk, assetIds: risk.assetIds.filter(id => id !== assetId), updatedAt: now };
    });

    let threatActorUpdates = 0;
    const nextThreatActors = workspace.threatActors.map(actor => {
      if (!actor.targetedAssetIds.includes(assetId)) return actor;
      threatActorUpdates += 1;
      return { ...actor, targetedAssetIds: actor.targetedAssetIds.filter(id => id !== assetId), updatedAt: now };
    });

    let threatScenarioUpdates = 0;
    const nextThreatScenarios = workspace.threatScenarios.map(scenario => {
      if (!scenario.targetedAssetIds.includes(assetId)) return scenario;
      threatScenarioUpdates += 1;
      return { ...scenario, targetedAssetIds: scenario.targetedAssetIds.filter(id => id !== assetId), updatedAt: now };
    });

    let taskUpdates = 0;
    const nextTasks = workspace.workflowTasks.map(task => {
      if (task.assetId !== assetId) return task;
      taskUpdates += 1;
      return { ...task, assetId: undefined, updatedAt: now };
    });

    applyWorkspace({
      ...workspace,
      assets: workspace.assets.filter(a => a.id !== assetId),
      risks: nextRisks,
      threatActors: nextThreatActors,
      threatScenarios: nextThreatScenarios,
      workflowTasks: nextTasks,
      updatedAt: now
    });
    setDeleteConfirmId(null);
    const cleanupSegments = [
      riskUpdates > 0 ? `${riskUpdates} risk link${riskUpdates === 1 ? '' : 's'}` : '',
      threatActorUpdates > 0 ? `${threatActorUpdates} threat actor${threatActorUpdates === 1 ? '' : 's'}` : '',
      threatScenarioUpdates > 0 ? `${threatScenarioUpdates} threat scenario${threatScenarioUpdates === 1 ? '' : 's'}` : '',
      taskUpdates > 0 ? `${taskUpdates} workflow task${taskUpdates === 1 ? '' : 's'}` : ''
    ].filter(Boolean);
    const cleanupText = cleanupSegments.length > 0 ? ` Cleaned ${cleanupSegments.join(', ')}.` : '';
    setStatusMessage({ severity: 'success', text: `Deleted asset "${asset.name}".${cleanupText}` });
  }, [applyWorkspace, setStatusMessage, workspace]);

  const handleSyncAssetsFromDiagram = useCallback(() => {
    if (!diagramSnapshot) {
      setStatusMessage({ severity: 'warning', text: 'No diagram context available to sync assets.' });
      return;
    }
    const result = syncAssetsFromDiagram(workspace, diagramSnapshot);
    applyWorkspace(result.workspace);
    setStatusMessage({
      severity: 'success',
      text: `Asset sync complete. Created ${result.createdCount}, linked ${result.linkedCount}.`
    });
  }, [applyWorkspace, diagramSnapshot, workspace, setStatusMessage]);

  const handleSyncConnectionsFromDiagram = useCallback(() => {
    if (!diagramSnapshot) {
      setStatusMessage({ severity: 'warning', text: 'No diagram context available to sync connections.' });
      return;
    }
    const result = syncConnectionsFromDiagram(workspace, diagramSnapshot);
    applyWorkspace(result.workspace);
    setStatusMessage({
      severity: 'success',
      text: `Connection sync complete. Created ${result.createdCount}, linked ${result.linkedCount}.`
    });
  }, [applyWorkspace, diagramSnapshot, workspace, setStatusMessage]);

  const handleOpenAssetNode = useCallback((assetId: string) => {
    const asset = workspace.assets.find(entry => entry.id === assetId);
    if (!asset) return;

    const preferredRef = diagramSnapshot
      ? asset.diagramRefs.find(ref => ref.diagramId === diagramSnapshot.diagramId)
      : undefined;
    const nodeRef = preferredRef || asset.diagramRefs[0];

    if (!nodeRef?.nodeId) {
      setStatusMessage({ severity: 'warning', text: `Asset "${asset.name}" has no linked diagram node.` });
      return;
    }

    onSwitchModule?.('diagram');
    window.dispatchEvent(new CustomEvent('grc-focus-diagram-node', {
      detail: { nodeId: nodeRef.nodeId, diagramId: nodeRef.diagramId, force2D: true }
    }));
  }, [diagramSnapshot, onSwitchModule, setStatusMessage, workspace.assets]);

  const handleStartEditName = useCallback((assetId: string, currentName: string) => {
    setEditingNameId(assetId);
    setEditingNameValue(currentName);
  }, []);

  const handleCommitEditName = useCallback(() => {
    if (!editingNameId) return;
    const trimmed = editingNameValue.trim();
    if (!trimmed) {
      setStatusMessage({ severity: 'warning', text: 'Asset name cannot be empty.' });
      return;
    }
    updateAsset(editingNameId, { name: trimmed });
    setEditingNameId(null);
    setEditingNameValue('');
  }, [editingNameId, editingNameValue, setStatusMessage, updateAsset]);

  const handleCancelEditName = useCallback(() => {
    setEditingNameId(null);
    setEditingNameValue('');
  }, []);

  const handleSort = useCallback((column: string) => {
    setSortDirection(prev => sortColumn === column ? (prev === 'asc' ? 'desc' : 'asc') : 'asc');
    setSortColumn(column);
  }, [sortColumn]);

  const presentBusinessUnits = useMemo(() => {
    const units = new Set<string>();
    workspace.assets.forEach(a => { if (a.businessUnit) units.add(a.businessUnit); });
    return Array.from(units).sort();
  }, [workspace.assets]);

  const filteredNodeAssets = useMemo(() => {
    let result = nodeAssets;
    if (businessUnitFilter) {
      result = result.filter(a => a.businessUnit === businessUnitFilter);
    }
    if (assetSearch.trim()) {
      const q = assetSearch.trim().toLowerCase();
      result = result.filter(a =>
        a.name.toLowerCase().includes(q) ||
        a.category.toLowerCase().includes(q) ||
        a.domain.toLowerCase().includes(q) ||
        (a.owner || '').toLowerCase().includes(q) ||
        (a.description || '').toLowerCase().includes(q)
      );
    }
    return result;
  }, [nodeAssets, assetSearch]);

  const sortedNodeAssets = useMemo(() => {
    const items = [...filteredNodeAssets];
    const dir = sortDirection === 'asc' ? 1 : -1;
    items.sort((a, b) => {
      let cmp = 0;
      switch (sortColumn) {
        case 'indexCode': {
          const aCode = getAssetIndexCode(a) || '';
          const bCode = getAssetIndexCode(b) || '';
          cmp = aCode.localeCompare(bCode);
          break;
        }
        case 'name': cmp = a.name.localeCompare(b.name); break;
        case 'domain': cmp = a.domain.localeCompare(b.domain); break;
        case 'category': cmp = a.category.localeCompare(b.category); break;
        case 'owner': cmp = (a.owner || '').localeCompare(b.owner || ''); break;
        case 'zone': {
          const aZone = getAssetZone(a) || '';
          const bZone = getAssetZone(b) || '';
          cmp = aZone.localeCompare(bZone);
          break;
        }
        case 'businessCriticality': cmp = a.businessCriticality - b.businessCriticality; break;
        case 'securityCriticality': cmp = a.securityCriticality - b.securityCriticality; break;
        case 'linkedRisks': cmp = (linkedRiskCounts[a.id] || 0) - (linkedRiskCounts[b.id] || 0); break;
        case 'linkedNodes': cmp = a.diagramRefs.length - b.diagramRefs.length; break;
        case 'businessUnit': cmp = (a.businessUnit || '').localeCompare(b.businessUnit || ''); break;
        default: break;
      }
      return cmp * dir;
    });
    return items;
  }, [filteredNodeAssets, sortColumn, sortDirection, getAssetIndexCode, getAssetZone, linkedRiskCounts]);

  const filteredConnectionAssets = useMemo(() => {
    let result = connectionAssets;
    if (connSearch.trim()) {
      const q = connSearch.trim().toLowerCase();
      result = result.filter(a =>
        a.name.toLowerCase().includes(q) ||
        a.category.toLowerCase().includes(q) ||
        a.domain.toLowerCase().includes(q) ||
        (a.owner || '').toLowerCase().includes(q) ||
        (a.description || '').toLowerCase().includes(q)
      );
    }
    return result;
  }, [connectionAssets, connSearch]);

  const sortedConnectionAssets = useMemo(() => {
    const items = [...filteredConnectionAssets];
    const dir = connSortDirection === 'asc' ? 1 : -1;
    items.sort((a, b) => {
      let cmp = 0;
      switch (connSortColumn) {
        case 'indexCode': {
          const aCode = getAssetIndexCode(a) || '';
          const bCode = getAssetIndexCode(b) || '';
          cmp = aCode.localeCompare(bCode);
          break;
        }
        case 'name': cmp = a.name.localeCompare(b.name); break;
        case 'domain': cmp = a.domain.localeCompare(b.domain); break;
        case 'category': cmp = a.category.localeCompare(b.category); break;
        case 'owner': cmp = (a.owner || '').localeCompare(b.owner || ''); break;
        case 'zone': {
          const aZone = getAssetZone(a) || '';
          const bZone = getAssetZone(b) || '';
          cmp = aZone.localeCompare(bZone);
          break;
        }
        case 'businessCriticality': cmp = a.businessCriticality - b.businessCriticality; break;
        case 'securityCriticality': cmp = a.securityCriticality - b.securityCriticality; break;
        case 'linkedRisks': cmp = (linkedRiskCounts[a.id] || 0) - (linkedRiskCounts[b.id] || 0); break;
        case 'sourceTarget': {
          const aRef = a.diagramRefs[0];
          const bRef = b.diagramRefs[0];
          const aEdge = aRef ? edgeSnapshotMap.get(aRef.nodeId) : undefined;
          const bEdge = bRef ? edgeSnapshotMap.get(bRef.nodeId) : undefined;
          const aSource = aEdge ? (nodeSnapshotMap.get(aEdge.source)?.label || aEdge.source) : '';
          const bSource = bEdge ? (nodeSnapshotMap.get(bEdge.source)?.label || bEdge.source) : '';
          cmp = aSource.localeCompare(bSource);
          break;
        }
        case 'businessUnit': cmp = (a.businessUnit || '').localeCompare(b.businessUnit || ''); break;
        default: break;
      }
      return cmp * dir;
    });
    return items;
  }, [filteredConnectionAssets, connSortColumn, connSortDirection, getAssetIndexCode, getAssetZone, linkedRiskCounts, edgeSnapshotMap, nodeSnapshotMap]);

  const handleConnSort = useCallback((column: string) => {
    setConnSortDirection(prev => connSortColumn === column ? (prev === 'asc' ? 'desc' : 'asc') : 'asc');
    setConnSortColumn(column);
  }, [connSortColumn]);

  const deleteTarget = deleteConfirmId
    ? workspace.assets.find(a => a.id === deleteConfirmId)
    : null;

  const renderSortLabel = (colId: string, label: string) => {
    const sortable = ['indexCode', 'name', 'domain', 'category', 'owner', 'zone', 'businessCriticality', 'securityCriticality', 'linkedRisks', 'linkedNodes', 'businessUnit'];
    if (!sortable.includes(colId)) return label;
    return (
      <TableSortLabel
        active={sortColumn === colId}
        direction={sortColumn === colId ? sortDirection : 'asc'}
        onClick={() => handleSort(colId)}
      >
        {label}
      </TableSortLabel>
    );
  };

  const renderConnSortLabel = (colId: string, label: string) => {
    const sortable = ['indexCode', 'name', 'sourceTarget', 'domain', 'category', 'owner', 'zone', 'businessCriticality', 'securityCriticality', 'linkedRisks', 'businessUnit'];
    if (!sortable.includes(colId)) return label;
    return (
      <TableSortLabel
        active={connSortColumn === colId}
        direction={connSortColumn === colId ? connSortDirection : 'asc'}
        onClick={() => handleConnSort(colId)}
      >
        {label}
      </TableSortLabel>
    );
  };

  const renderCellContent = (colId: string, asset: typeof workspace.assets[0]) => {
    const categories = config.assetCategories[asset.domain] || [];
    const riskCount = linkedRiskCounts[asset.id] || 0;

    switch (colId) {
      case 'indexCode': {
        const code = getAssetIndexCode(asset);
        return <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{code || '\u2014'}</Typography>;
      }
      case 'name':
        return editingNameId === asset.id ? (
          <TextField
            size="small"
            value={editingNameValue}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditingNameValue(e.target.value)}
            onBlur={handleCommitEditName}
            onKeyDown={(e: React.KeyboardEvent) => {
              if (e.key === 'Enter') handleCommitEditName();
              if (e.key === 'Escape') handleCancelEditName();
            }}
            autoFocus
            sx={{ minWidth: 140 }}
          />
        ) : (
          <Tooltip title="Click to edit name" arrow placement="top">
            <Typography
              variant="body2"
              sx={{ cursor: 'pointer', '&:hover': { textDecoration: 'underline', color: 'primary.main' } }}
              onClick={() => handleStartEditName(asset.id, asset.name)}
            >
              {asset.name}
            </Typography>
          </Tooltip>
        );
      case 'domain':
        return (
          <TextField
            select size="small" value={asset.domain}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
              const domain = e.target.value as GrcAssetDomain;
              const domainCategories = config.assetCategories[domain] || [];
              const nextCategory = domainCategories.includes(asset.category)
                ? asset.category : (domainCategories[0] || asset.category);
              updateAsset(asset.id, { domain, category: nextCategory, type: nextCategory });
            }}
            sx={{ minWidth: 110 }}
          >
            {domainOptions.map(option => (
              <MenuItem key={`${asset.id}-${option.value}`} value={option.value}>{option.label}</MenuItem>
            ))}
          </TextField>
        );
      case 'category':
        return (
          <TextField
            select size="small" value={asset.category}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              updateAsset(asset.id, { category: e.target.value, type: e.target.value })
            }
            sx={{ minWidth: 150 }}
          >
            {categories.map(category => (
              <MenuItem key={`${asset.id}-${category}`} value={category}>{category}</MenuItem>
            ))}
          </TextField>
        );
      case 'sourceTarget': {
        const ref = asset.diagramRefs[0];
        const edgeInfo = ref ? edgeSnapshotMap.get(ref.nodeId) : undefined;
        const sourceLabel = edgeInfo ? (nodeSnapshotMap.get(edgeInfo.source)?.label || edgeInfo.source) : (ref?.sourceNodeId || '\u2014');
        const targetLabel = edgeInfo ? (nodeSnapshotMap.get(edgeInfo.target)?.label || edgeInfo.target) : (ref?.targetNodeId || '\u2014');
        return <Typography variant="body2">{sourceLabel} {'\u2192'} {targetLabel}</Typography>;
      }
      case 'owner':
        return (
          <TextField
            size="small" value={asset.owner || ''} placeholder="Unassigned"
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              updateAsset(asset.id, { owner: e.target.value.trim() || undefined })
            }
            sx={{ minWidth: 140 }}
          />
        );
      case 'zone': {
        const zone = getAssetZone(asset);
        if (!zone) return <Typography variant="body2" color="text.secondary">{'\u2014'}</Typography>;
        return <Chip label={zone} size="small" sx={{ backgroundColor: getZoneColor(zone), color: '#fff', fontWeight: 500, fontSize: '0.75rem' }} />;
      }
      case 'businessCriticality':
        return (
          <TextField
            select size="small" value={asset.businessCriticality}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              updateAsset(asset.id, { businessCriticality: Number(e.target.value) })
            }
            sx={{ minWidth: 150 }}
          >
            {criticalityScale.map(level => (
              <MenuItem key={`${asset.id}-business-${level.value}`} value={level.value}>
                {level.value} - {level.label}
              </MenuItem>
            ))}
          </TextField>
        );
      case 'securityCriticality':
        return (
          <TextField
            select size="small" value={asset.securityCriticality}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              updateAsset(asset.id, { securityCriticality: Number(e.target.value) })
            }
            sx={{ minWidth: 150 }}
          >
            {criticalityScale.map(level => (
              <MenuItem key={`${asset.id}-security-${level.value}`} value={level.value}>
                {level.value} - {level.label}
              </MenuItem>
            ))}
          </TextField>
        );
      case 'linkedRisks':
        return (
          <Tooltip title={riskCount > 0 ? `${riskCount} risk${riskCount !== 1 ? 's' : ''} linked` : 'No risks linked'} arrow>
            <Chip
              label={riskCount} size="small"
              color={riskCount > 0 ? 'warning' : 'default'}
              variant={riskCount > 0 ? 'filled' : 'outlined'}
              onClick={riskCount > 0 ? () => {
                const firstRisk = workspace.risks.find(r => r.assetIds.includes(asset.id));
                onSwitchTab?.('risks', firstRisk?.id);
              } : undefined}
              sx={{ cursor: riskCount > 0 ? 'pointer' : 'default', minWidth: 32 }}
            />
          </Tooltip>
        );
      case 'linkedNodes':
        return <>{asset.diagramRefs.length}</>;
      case 'businessUnit':
        return businessUnits.length > 0 ? (
          <TextField
            select size="small" value={asset.businessUnit || ''}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              updateAsset(asset.id, { businessUnit: e.target.value || undefined })
            }
            sx={{ minWidth: 140 }}
          >
            <MenuItem value="">—</MenuItem>
            {businessUnits.map(bu => (
              <MenuItem key={bu} value={bu}>{bu}</MenuItem>
            ))}
          </TextField>
        ) : (
          <TextField
            size="small" value={asset.businessUnit || ''} placeholder="—"
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              updateAsset(asset.id, { businessUnit: e.target.value.trim() || undefined })
            }
            sx={{ minWidth: 120 }}
          />
        );
      case 'actions':
        return (
          <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'flex-end' }}>
            <Tooltip describeChild title={`Switch to Diagram (2D) and focus the linked ${asset.isConnection ? 'edge' : 'node'}.`} arrow>
              <span>
                <Button
                  size="small" variant="outlined" startIcon={<Crosshair size={14} />}
                  disabled={asset.diagramRefs.length === 0}
                  onClick={() => handleOpenAssetNode(asset.id)}
                >
                  {asset.isConnection ? 'Open Edge' : 'Open Node'}
                </Button>
              </span>
            </Tooltip>
            <Tooltip title="Delete this asset" arrow>
              <IconButton size="small" color="error" onClick={() => setDeleteConfirmId(asset.id)}>
                <Trash2 size={16} />
              </IconButton>
            </Tooltip>
          </Box>
        );
      default: return null;
    }
  };

  const renderExpandedDetail = (asset: typeof workspace.assets[0]) => {
    const linkedRisks = workspace.risks.filter(r => r.assetIds.includes(asset.id));
    const linkedTasks = workspace.workflowTasks.filter(t => t.assetId === asset.id);
    const linkedActors = workspace.threatActors.filter(a => a.targetedAssetIds.includes(asset.id));
    const linkedScenarios = workspace.threatScenarios.filter(s => s.targetedAssetIds.includes(asset.id));

    const handleCIAChange = (field: keyof GrcAssetCriticality, value: number) => {
      const next: GrcAssetCriticality = { ...asset.criticality, [field]: value };
      const secCrit = deriveSecurityCriticality(next);
      const busCrit = deriveBusinessCriticality(next);
      updateAsset(asset.id, {
        criticality: next,
        securityCriticality: secCrit,
        businessCriticality: busCrit
      });
    };

    return (
      <Box sx={{ p: 2, display: 'grid', gap: 2 }}>
        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
          <TextField
            size="small" label="Description" multiline minRows={2} maxRows={4}
            value={asset.description || ''}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              updateAsset(asset.id, { description: e.target.value || undefined })
            }
          />
          <TextField
            size="small" label="Business Process"
            value={asset.businessProcess || ''}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              updateAsset(asset.id, { businessProcess: e.target.value || undefined })
            }
          />
          {businessUnits.length > 0 ? (
            <TextField
              select size="small" label="Business Unit"
              value={asset.businessUnit || ''}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                updateAsset(asset.id, { businessUnit: e.target.value || undefined })
              }
            >
              <MenuItem value="">—</MenuItem>
              {businessUnits.map(bu => (
                <MenuItem key={bu} value={bu}>{bu}</MenuItem>
              ))}
            </TextField>
          ) : (
            <TextField
              size="small" label="Business Unit"
              value={asset.businessUnit || ''} placeholder="e.g. Finance, HR"
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                updateAsset(asset.id, { businessUnit: e.target.value.trim() || undefined })
              }
            />
          )}
        </Box>

        <Box>
          <Typography variant="caption" color="text.secondary" sx={{ mb: 0.75, display: 'block' }}>
            CIA Criticality Ratings
          </Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1 }}>
            {(['confidentiality', 'integrity', 'availability'] as const).map(field => (
              <TextField
                key={field} select size="small"
                label={field.charAt(0).toUpperCase() + field.slice(1)}
                value={asset.criticality[field]}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleCIAChange(field, Number(e.target.value))}
              >
                {criticalityScale.map(level => (
                  <MenuItem key={`${asset.id}-cia-${field}-${level.value}`} value={level.value}>
                    {level.value} - {level.label}
                  </MenuItem>
                ))}
              </TextField>
            ))}
            {(['financial', 'reputation', 'safety'] as const).map(field => (
              <TextField
                key={field} select size="small"
                label={field.charAt(0).toUpperCase() + field.slice(1)}
                value={asset.criticality[field]}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleCIAChange(field, Number(e.target.value))}
              >
                {criticalityScale.map(level => (
                  <MenuItem key={`${asset.id}-cia-${field}-${level.value}`} value={level.value}>
                    {level.value} - {level.label}
                  </MenuItem>
                ))}
              </TextField>
            ))}
          </Box>
        </Box>

        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5 }}>
          {linkedRisks.length > 0 && (
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>Linked Risks</Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.25 }}>
                {linkedRisks.map(r => (
                  <Chip key={r.id} size="small" label={r.title} color="warning" variant="outlined"
                    onClick={() => onSwitchTab?.('risks', r.id)}
                    sx={{ fontSize: '0.68rem', height: 18, cursor: 'pointer' }} />
                ))}
              </Box>
            </Box>
          )}
          {linkedTasks.length > 0 && (
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>Linked Tasks</Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.25 }}>
                {linkedTasks.map(t => (
                  <Chip key={t.id} size="small" label={t.title} variant="outlined"
                    onClick={() => onSwitchTab?.('workflow_config')}
                    sx={{ fontSize: '0.68rem', height: 18, cursor: 'pointer' }} />
                ))}
              </Box>
            </Box>
          )}
          {linkedActors.length > 0 && (
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>Threat Actors</Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.25 }}>
                {linkedActors.map(a => (
                  <Chip key={a.id} size="small" label={a.name} variant="outlined"
                    onClick={() => onSwitchTab?.('threat_profile', a.id)}
                    sx={{ fontSize: '0.68rem', height: 18, cursor: 'pointer' }} />
                ))}
              </Box>
            </Box>
          )}
          {linkedScenarios.length > 0 && (
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>Threat Scenarios</Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.25 }}>
                {linkedScenarios.map(s => (
                  <Chip key={s.id} size="small" label={s.title} variant="outlined"
                    onClick={() => onSwitchTab?.('threat_profile', s.id)}
                    sx={{ fontSize: '0.68rem', height: 18, cursor: 'pointer' }} />
                ))}
              </Box>
            </Box>
          )}
        </Box>

        {asset.diagramRefs.length > 0 && (
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>Diagram Refs</Typography>
            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
              {asset.diagramRefs.map((ref, i) => (
                <Chip
                  key={i}
                  label={ref.nodeLabel || ref.nodeId}
                  size="small"
                  icon={<Crosshair size={12} />}
                  onClick={() => {
                    onSwitchModule?.('diagram');
                    window.dispatchEvent(new CustomEvent('grc-focus-diagram-node', {
                      detail: { nodeId: ref.nodeId, diagramId: ref.diagramId, force2D: true }
                    }));
                  }}
                  sx={{ cursor: 'pointer' }}
                />
              ))}
            </Box>
          </Box>
        )}

        <Typography variant="caption" color="text.secondary">
          Created: {new Date(asset.createdAt).toLocaleString()} | Updated: {new Date(asset.updatedAt).toLocaleString()}
        </Typography>
      </Box>
    );
  };

  const totalColspan = columnConfig.visibleColumns.length + 1;
  const connTotalColspan = connColumnConfig.visibleColumns.length + 1;

  return (
    <Box sx={{ display: 'grid', gap: 2 }}>
      <Paper sx={cardSx}>
        <Typography variant="h6" sx={{ mb: 1 }}>Asset Register</Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.25 }}>
          Classify assets by domain and maintain business/security criticality ratings.
        </Typography>
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 1.5 }}>
          <Tooltip title="Name identifying this business or technical asset" arrow placement="top">
            <TextField
              size="small" label="Asset Name" value={newAssetName}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewAssetName(e.target.value)}
            />
          </Tooltip>
          <Tooltip title="Asset domain classification" arrow placement="top">
            <TextField
              size="small" select label="Domain" value={newAssetDomain}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewAssetDomain(e.target.value as GrcAssetDomain)}
            >
              {domainOptions.map(option => (
                <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>
              ))}
            </TextField>
          </Tooltip>
          <Tooltip title="Specific asset category within the selected domain" arrow placement="top">
            <TextField
              size="small" select label="Category" value={newAssetCategory}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewAssetCategory(e.target.value)}
            >
              {categoriesForNewDomain.map(category => (
                <MenuItem key={category} value={category}>{category}</MenuItem>
              ))}
            </TextField>
          </Tooltip>
          <Tooltip title="Person or team responsible for this asset" arrow placement="top">
            <TextField
              size="small" label="Owner" value={newAssetOwner}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewAssetOwner(e.target.value)}
            />
          </Tooltip>
          <Tooltip title="Optional description of this asset" arrow placement="top">
            <TextField
              size="small" label="Description" multiline minRows={1} maxRows={2}
              value={newAssetDescription}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewAssetDescription(e.target.value)}
            />
          </Tooltip>
          <Tooltip title="Business impact criticality" arrow placement="top">
            <TextField
              size="small" select label="Business Criticality" value={newBusinessCriticality}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewBusinessCriticality(Number(e.target.value))}
            >
              {criticalityScale.map(level => (
                <MenuItem key={`new-business-${level.value}`} value={level.value}>
                  {level.value} - {level.label}
                </MenuItem>
              ))}
            </TextField>
          </Tooltip>
          <Tooltip title="Security impact criticality" arrow placement="top">
            <TextField
              size="small" select label="Security Criticality" value={newSecurityCriticality}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewSecurityCriticality(Number(e.target.value))}
            >
              {criticalityScale.map(level => (
                <MenuItem key={`new-security-${level.value}`} value={level.value}>
                  {level.value} - {level.label}
                </MenuItem>
              ))}
            </TextField>
          </Tooltip>
          {businessUnits.length > 0 ? (
            <Tooltip title="Business unit owning this asset" arrow placement="top">
              <TextField
                size="small" select label="Business Unit" value={newBusinessUnit}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewBusinessUnit(e.target.value)}
              >
                <MenuItem value="">—</MenuItem>
                {businessUnits.map(bu => (
                  <MenuItem key={bu} value={bu}>{bu}</MenuItem>
                ))}
              </TextField>
            </Tooltip>
          ) : (
            <Tooltip title="Business unit owning this asset" arrow placement="top">
              <TextField
                size="small" label="Business Unit" value={newBusinessUnit}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewBusinessUnit(e.target.value)}
              />
            </Tooltip>
          )}
          <Tooltip describeChild title="Create a new asset entry." arrow>
            <Button startIcon={<Plus size={16} />} variant="contained" onClick={handleAddAsset}>Add Asset</Button>
          </Tooltip>
          <Tooltip title="Creates new assets from diagram nodes and links existing ones." arrow>
            <Button startIcon={<Undo size={16} />} variant="outlined" onClick={handleSyncAssetsFromDiagram}>Sync from Diagram</Button>
          </Tooltip>
        </Box>
      </Paper>

      {/* Node Assets Table */}
      <TableContainer component={Paper} sx={cardSx}>
        <Box sx={{ p: 1.5, borderBottom: '1px solid', borderColor: 'divider', display: 'flex', alignItems: 'center', gap: 1 }}>
          <Tooltip describeChild title="Filter assets by name, category, domain, or owner." arrow>
            <TextField
              size="small" placeholder="Search assets..."
              value={assetSearch}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAssetSearch(e.target.value)}
              sx={{ minWidth: 260 }}
            />
          </Tooltip>
          {assetSearch && (
            <Typography variant="caption" color="text.secondary">
              {filteredNodeAssets.length} of {nodeAssets.length} assets
            </Typography>
          )}
          {presentBusinessUnits.length > 0 && (
            <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
              <Typography variant="caption" color="text.secondary" sx={{ mr: 0.5 }}>BU:</Typography>
              <Chip size="small" label="All"
                variant={!businessUnitFilter ? 'filled' : 'outlined'}
                color={!businessUnitFilter ? 'primary' : 'default'}
                onClick={() => setBusinessUnitFilter('')} />
              {presentBusinessUnits.map(bu => (
                <Chip key={bu} size="small" label={bu}
                  variant={businessUnitFilter === bu ? 'filled' : 'outlined'}
                  color={businessUnitFilter === bu ? 'primary' : 'default'}
                  onClick={() => setBusinessUnitFilter(businessUnitFilter === bu ? '' : bu)} />
              ))}
            </Box>
          )}
          <Box sx={{ flex: 1 }} />
          <TableColumnConfigPopover
            allColumns={columnConfig.allColumns}
            visibleIds={columnConfig.visibleIds}
            onToggle={columnConfig.toggleColumn}
            onMove={columnConfig.moveColumn}
            onReset={columnConfig.resetToDefaults}
          />
        </Box>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ width: 32 }} />
              {columnConfig.visibleColumns.map(col => (
                <TableCell key={col.id} align={col.id === 'actions' ? 'right' : 'left'} sx={col.width ? { width: col.width } : undefined}>
                  {renderSortLabel(col.id, col.label)}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {sortedNodeAssets.map(asset => {
              const isExpanded = expandedAssetId === asset.id;
              return (
                <React.Fragment key={asset.id}>
                  <TableRow id={`grc-asset-${asset.id}`} hover sx={{
                    ...(highlightId === asset.id && { bgcolor: 'action.selected', transition: 'background-color 0.3s' })
                  }}>
                    <TableCell sx={{ width: 32, px: 0.5 }}>
                      <IconButton size="small" onClick={() => setExpandedAssetId(isExpanded ? null : asset.id)}>
                        {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                      </IconButton>
                    </TableCell>
                    {columnConfig.visibleColumns.map(col => (
                      <TableCell key={col.id} align={col.id === 'actions' ? 'right' : 'left'}>
                        {renderCellContent(col.id, asset)}
                      </TableCell>
                    ))}
                  </TableRow>
                  <TableRow>
                    <TableCell sx={{ py: 0, borderBottom: isExpanded ? undefined : 'none' }} colSpan={totalColspan}>
                      <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                        {renderExpandedDetail(asset)}
                      </Collapse>
                    </TableCell>
                  </TableRow>
                </React.Fragment>
              );
            })}
            {nodeAssets.length === 0 && (
              <TableRow>
                <TableCell colSpan={totalColspan}>
                  <Box sx={{ py: 4, px: 2, textAlign: 'center' }}>
                    <Typography variant="subtitle1" color="text.secondary" sx={{ mb: 1.5 }}>
                      No assets registered yet
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2, maxWidth: 520, mx: 'auto' }}>
                      Assets represent the business and technical components in your threat model scope.
                    </Typography>
                    <Box component="ul" sx={{ textAlign: 'left', display: 'inline-block', m: 0, pl: 2.5 }}>
                      <Typography component="li" variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                        Click <strong>Sync from Diagram</strong> to auto-import assets from your architecture diagram
                      </Typography>
                      <Typography component="li" variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                        Or manually add assets using the form above
                      </Typography>
                    </Box>
                  </Box>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Connection Assets Table */}
      <TableContainer component={Paper} sx={cardSx}>
        <Box sx={{ p: 1.5, borderBottom: '1px solid', borderColor: 'divider', display: 'flex', alignItems: 'center', gap: 1 }}>
          <Tooltip describeChild title="Filter connections by name, category, domain, or owner." arrow>
            <TextField
              size="small" placeholder="Search connections..."
              value={connSearch}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setConnSearch(e.target.value)}
              sx={{ minWidth: 260 }}
            />
          </Tooltip>
          {connSearch && (
            <Typography variant="caption" color="text.secondary">
              {filteredConnectionAssets.length} of {connectionAssets.length} connections
            </Typography>
          )}
          <Box sx={{ flex: 1 }} />
          <Tooltip title="Creates connection assets from diagram edges." arrow>
            <Button size="small" startIcon={<Link2 size={14} />} variant="outlined" onClick={handleSyncConnectionsFromDiagram}>
              Sync Connections from Diagram
            </Button>
          </Tooltip>
          <TableColumnConfigPopover
            allColumns={connColumnConfig.allColumns}
            visibleIds={connColumnConfig.visibleIds}
            onToggle={connColumnConfig.toggleColumn}
            onMove={connColumnConfig.moveColumn}
            onReset={connColumnConfig.resetToDefaults}
          />
        </Box>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ width: 32 }} />
              {connColumnConfig.visibleColumns.map(col => (
                <TableCell key={col.id} align={col.id === 'actions' ? 'right' : 'left'} sx={col.width ? { width: col.width } : undefined}>
                  {renderConnSortLabel(col.id, col.label)}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {sortedConnectionAssets.map(asset => {
              const isExpanded = expandedConnId === asset.id;
              return (
                <React.Fragment key={asset.id}>
                  <TableRow id={`grc-asset-${asset.id}`} hover sx={{
                    ...(highlightId === asset.id && { bgcolor: 'action.selected', transition: 'background-color 0.3s' })
                  }}>
                    <TableCell sx={{ width: 32, px: 0.5 }}>
                      <IconButton size="small" onClick={() => setExpandedConnId(isExpanded ? null : asset.id)}>
                        {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                      </IconButton>
                    </TableCell>
                    {connColumnConfig.visibleColumns.map(col => (
                      <TableCell key={col.id} align={col.id === 'actions' ? 'right' : 'left'}>
                        {renderCellContent(col.id, asset)}
                      </TableCell>
                    ))}
                  </TableRow>
                  <TableRow>
                    <TableCell sx={{ py: 0, borderBottom: isExpanded ? undefined : 'none' }} colSpan={connTotalColspan}>
                      <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                        {renderExpandedDetail(asset)}
                      </Collapse>
                    </TableCell>
                  </TableRow>
                </React.Fragment>
              );
            })}
            {connectionAssets.length === 0 && (
              <TableRow>
                <TableCell colSpan={connTotalColspan}>
                  <Box sx={{ py: 2, textAlign: 'center' }}>
                    <Typography variant="body2" color="text.secondary">
                      No connection assets. Click "Sync Connections from Diagram" to import diagram edges.
                    </Typography>
                  </Box>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={deleteConfirmId !== null} onClose={() => setDeleteConfirmId(null)}>
        <DialogTitle>Delete Asset</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete the asset <strong>{deleteTarget?.name}</strong>?
            {(linkedRiskCounts[deleteConfirmId || ''] || 0) > 0 && (
              <> This asset is referenced by {linkedRiskCounts[deleteConfirmId || '']} risk{linkedRiskCounts[deleteConfirmId || ''] !== 1 ? 's' : ''}. Those references will become orphaned.</>
            )}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Tooltip describeChild title="Keep this asset in the register." arrow>
            <Button onClick={() => setDeleteConfirmId(null)}>Cancel</Button>
          </Tooltip>
          <Tooltip describeChild title="Delete this asset and clean linked references." arrow>
            <Button color="error" variant="contained" onClick={() => deleteConfirmId && handleDeleteAsset(deleteConfirmId)}>
              Delete
            </Button>
          </Tooltip>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default GrcAssetsTab;
