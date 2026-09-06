import React, { ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Box, Button, Chip, Collapse, Dialog, DialogActions, DialogContent, DialogContentText,
  DialogTitle, FormControl, IconButton, InputLabel, LinearProgress, MenuItem, OutlinedInput,
  Paper, Select, Tab, Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, TableSortLabel, Tabs, TextField, Tooltip, Typography
} from '@mui/material';
import {
  ChevronDown, ChevronRight, Crosshair, Shield, Link as LinkIcon,
  FileText, Plus, Upload, X
} from 'lucide-react';
import FrameworkPickerDialog from './FrameworkPickerDialog';
import {
  controlRowsToControlSet,
  computeSoaCoverageMap,
  computeSoaHealth,
  defaultMaturityModels,
  parseControlSetCsvRows
} from '../../services/GrcWorkspaceService';
import {
  importControlSet as importControlSetApi,
  importControlSetXlsx,
  previewControlSetImport
} from '../../api';
import {
  ControlImportRow,
  GrcControlSet,
  GrcEntityHealth,
  GrcEvidenceReference,
  GrcGovernanceDocument,
  GrcSoaEntry,
  GrcSoaImportance,
  MaturityModel,
  SoaApplicability,
  SoaImplementationStatus
} from '../../types/GrcTypes';
import { getConfig } from '../../services/GrcWorkspaceService';
import { GrcTabProps, cardSx, createId, arrayBufferToBase64 } from './grcShared';
import { useTableColumnConfig, ColumnDef } from './useTableColumnConfig';
import TableColumnConfigPopover from './TableColumnConfigPopover';
import GrcCrossFrameworkMappingsSection from './GrcCrossFrameworkMappingsSection';

type ScopeOption = { type: 'system' | 'diagram'; id: string; label: string };

interface EvidenceDialogState {
  open: boolean;
  kind: 'link' | 'file_reference' | 'governance_doc';
  controlSetId: string;
  controlId: string;
  value: string;
  governanceDocId: string;
}

const initialEvidenceDialog: EvidenceDialogState = {
  open: false,
  kind: 'link',
  controlSetId: '',
  controlId: '',
  value: '',
  governanceDocId: ''
};

const IMPORTANCE_LABELS: Record<GrcSoaImportance, string> = {
  mandatory: 'Mandatory',
  recommended: 'Recommended',
  optional: 'Optional'
};

const IMPORTANCE_COLORS: Record<GrcSoaImportance, string> = {
  mandatory: '#dc2626',
  recommended: '#ca8a04',
  optional: '#6b7280'
};

const COMPLIANCE_COLUMNS: ColumnDef[] = [
  { id: 'control', label: 'Control', defaultVisible: true, removable: false },
  { id: 'applicability', label: 'Applicability', defaultVisible: true, removable: true },
  { id: 'implementation', label: 'Implementation', defaultVisible: true, removable: true },
  { id: 'weight', label: 'Weight', defaultVisible: true, removable: true },
  { id: 'importance', label: 'Importance', defaultVisible: true, removable: true },
  { id: 'maturity', label: 'Maturity', defaultVisible: true, removable: true },
  { id: 'coveredBy', label: 'Covered By', defaultVisible: true, removable: true },
  { id: 'linkedRisks', label: 'Linked Risks', defaultVisible: true, removable: true },
  { id: 'family', label: 'Family', defaultVisible: true, removable: true },
  { id: 'justification', label: 'Justification', defaultVisible: false, removable: true },
  { id: 'evidence', label: 'Evidence', defaultVisible: false, removable: true },
  { id: 'description', label: 'Description', defaultVisible: false, removable: true },
];

const SORTABLE_COLUMNS = new Set([
  'control', 'applicability', 'implementation', 'weight', 'importance', 'maturity', 'coveredBy', 'linkedRisks', 'family'
]);

type SortDir = 'asc' | 'desc';

const GrcComplianceTab: React.FC<GrcTabProps> = ({
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
  const persistedView = getTabViewState?.('compliance', {
    activeTabIndex: 0,
    expandedControlId: null,
    selectedScopeKey: 'system:system'
  }) ?? {
    activeTabIndex: 0,
    expandedControlId: null,
    selectedScopeKey: 'system:system'
  };
  const soaLabels = getConfig(workspace).soaLabels;
  const [activeTabIndex, setActiveTabIndex] = useState<number>((persistedView.activeTabIndex as number) ?? 0);
  const [importingControlSet, setImportingControlSet] = useState(false);
  const [controlSearch, setControlSearch] = useState('');
  const controlSetInputRef = useRef<HTMLInputElement | null>(null);

  const [newCsDialogOpen, setNewCsDialogOpen] = useState(false);
  const [newCsName, setNewCsName] = useState('');
  const [newCsVersion, setNewCsVersion] = useState('');

  const [frameworkPickerOpen, setFrameworkPickerOpen] = useState(false);

  const [sortColumn, setSortColumn] = useState<string>('control');
  const [sortDirection, setSortDirection] = useState<SortDir>('asc');
  const [expandedControlId, setExpandedControlId] = useState<string | null>((persistedView.expandedControlId as string | null) ?? null);
  const [highlightControlId, setHighlightControlId] = useState<string | null>(null);

  useEffect(() => {
    if (focusRequest?.tab === 'compliance' && focusRequest.entityId) {
      const id = focusRequest.entityId;
      const allControls = workspace.controlSets.flatMap(cs => cs.controls);
      if (allControls.some(c => c.id === id)) {
        setExpandedControlId(id);
        setHighlightControlId(id);
        setTimeout(() => {
          document.getElementById(`grc-control-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 100);
        setTimeout(() => setHighlightControlId(null), 2000);
      }
    }
  }, [focusRequest, workspace.controlSets]);

  const [applicabilityFilter, setApplicabilityFilter] = useState<string>('all');
  const [implementationFilter, setImplementationFilter] = useState<string>('all');
  const [uncoveredFilter, setUncoveredFilter] = useState(false);

  const soaCoverageMap = useMemo(() => computeSoaCoverageMap(workspace), [workspace]);

  const columnConfig = useTableColumnConfig('compliance', COMPLIANCE_COLUMNS, workspace, applyWorkspace);

  const maturityModels = useMemo(() => {
    return workspace.config?.maturityModels?.length
      ? workspace.config.maturityModels
      : defaultMaturityModels();
  }, [workspace.config?.maturityModels]);

  const activeMaturityModel = useMemo(() => {
    const activeId = workspace.config?.activeMaturityModelId;
    if (activeId) {
      const found = maturityModels.find(m => m.id === activeId);
      if (found) return found;
    }
    return maturityModels[0] || null;
  }, [maturityModels, workspace.config?.activeMaturityModelId]);

  const governanceDocs: GrcGovernanceDocument[] = workspace.governanceDocuments || [];

  const scopeOptions = useMemo<ScopeOption[]>(() => {
    const opts: ScopeOption[] = [{ type: 'system', id: 'system', label: 'System (Global)' }];
    if (diagramSnapshot) {
      opts.push({
        type: 'diagram',
        id: diagramSnapshot.diagramId,
        label: `Diagram: ${diagramSnapshot.systemName || diagramSnapshot.diagramId}`
      });
    }
    return opts;
  }, [diagramSnapshot]);

  const [selectedScopeKey, setSelectedScopeKey] = useState<string>((persistedView.selectedScopeKey as string) || 'system:system');

  const currentScope = useMemo<{ type: 'system' | 'diagram'; id: string }>(() => {
    const [type, id] = selectedScopeKey.split(':');
    if ((type === 'system' || type === 'diagram') && id) {
      return { type, id };
    }
    return { type: 'system', id: 'system' };
  }, [selectedScopeKey]);

  const currentScopeType = currentScope.type;
  const currentScopeId = currentScope.id;

  const [evidenceDialog, setEvidenceDialog] = useState<EvidenceDialogState>(initialEvidenceDialog);
  const [deleteControlSetDialog, setDeleteControlSetDialog] = useState<{ open: boolean; controlSet: GrcControlSet | null }>({
    open: false,
    controlSet: null
  });

  useEffect(() => {
    if (workspace.controlSets.length > 0 && activeTabIndex >= workspace.controlSets.length) {
      setActiveTabIndex(Math.max(0, workspace.controlSets.length - 1));
    }
  }, [workspace.controlSets.length, activeTabIndex]);

  useEffect(() => {
    setTabViewState?.('compliance', {
      activeTabIndex,
      expandedControlId,
      selectedScopeKey
    });
  }, [activeTabIndex, expandedControlId, selectedScopeKey, setTabViewState]);

  const selectedControlSet = useMemo(
    () => workspace.controlSets[activeTabIndex] || null,
    [workspace.controlSets, activeTabIndex]
  );
  const selectedControlSetId = selectedControlSet?.id || '';

  const controlSetStats = useMemo(() => {
    const stats: Record<string, { implemented: number; total: number; applicable: number; weightedPct: number }> = {};
    for (const cs of workspace.controlSets) {
      let implemented = 0;
      let applicable = 0;
      let totalWeight = 0;
      let implementedWeight = 0;
      for (const control of cs.controls) {
        const entry = workspace.soaEntries.find(
          e => e.controlSetId === cs.id &&
            e.controlId === control.controlId &&
            e.scopeType === currentScopeType &&
            e.scopeId === currentScopeId
        );
        const app = entry?.applicability || 'applicable';
        if (app !== 'not_applicable') {
          applicable++;
          const w = entry?.weight || 1;
          totalWeight += w;
          if (entry?.implementationStatus === 'implemented') {
            implemented++;
            implementedWeight += w;
          }
        }
      }
      const weightedPct = totalWeight > 0 ? Math.round((implementedWeight / totalWeight) * 100) : 0;
      stats[cs.id] = { implemented, total: cs.controls.length, applicable, weightedPct };
    }
    return stats;
  }, [workspace.controlSets, workspace.soaEntries, currentScopeType, currentScopeId]);

  const findSoaEntry = useCallback(
    (controlSetId: string, controlId: string): GrcSoaEntry | undefined =>
      workspace.soaEntries.find(
        entry =>
          entry.controlSetId === controlSetId &&
          entry.controlId === controlId &&
          entry.scopeType === currentScopeType &&
          entry.scopeId === currentScopeId
      ),
    [currentScopeId, currentScopeType, workspace.soaEntries]
  );

  const filteredControls = useMemo(() => {
    if (!selectedControlSet) return [];
    let controls = selectedControlSet.controls;

    if (controlSearch.trim()) {
      const q = controlSearch.trim().toLowerCase();
      controls = controls.filter(c =>
        c.controlId.toLowerCase().includes(q) ||
        c.title.toLowerCase().includes(q) ||
        (c.family || '').toLowerCase().includes(q) ||
        (c.description || '').toLowerCase().includes(q)
      );
    }

    if (applicabilityFilter !== 'all') {
      controls = controls.filter(c => {
        const entry = findSoaEntry(selectedControlSetId, c.controlId);
        return (entry?.applicability || 'applicable') === applicabilityFilter;
      });
    }

    if (implementationFilter !== 'all') {
      controls = controls.filter(c => {
        const entry = findSoaEntry(selectedControlSetId, c.controlId);
        return (entry?.implementationStatus || 'not_implemented') === implementationFilter;
      });
    }

    if (uncoveredFilter) {
      controls = controls.filter(c => {
        const entry = findSoaEntry(selectedControlSetId, c.controlId);
        if (!entry) return true;
        const linkedIcCount = soaCoverageMap.get(entry.id)?.length || 0;
        return linkedIcCount === 0;
      });
    }

    return controls;
  }, [selectedControlSet, controlSearch, applicabilityFilter, implementationFilter, uncoveredFilter, selectedControlSetId, findSoaEntry, soaCoverageMap]);

  const sortedControls = useMemo(() => {
    const list = [...filteredControls];
    const dir = sortDirection === 'asc' ? 1 : -1;
    list.sort((a, b) => {
      let cmp = 0;
      switch (sortColumn) {
        case 'control':
          cmp = a.controlId.localeCompare(b.controlId);
          break;
        case 'applicability': {
          const aApp = findSoaEntry(selectedControlSetId, a.controlId)?.applicability || 'applicable';
          const bApp = findSoaEntry(selectedControlSetId, b.controlId)?.applicability || 'applicable';
          cmp = aApp.localeCompare(bApp);
          break;
        }
        case 'implementation': {
          const aImpl = findSoaEntry(selectedControlSetId, a.controlId)?.implementationStatus || 'not_implemented';
          const bImpl = findSoaEntry(selectedControlSetId, b.controlId)?.implementationStatus || 'not_implemented';
          cmp = aImpl.localeCompare(bImpl);
          break;
        }
        case 'weight': {
          const aW = findSoaEntry(selectedControlSetId, a.controlId)?.weight ?? 1;
          const bW = findSoaEntry(selectedControlSetId, b.controlId)?.weight ?? 1;
          cmp = aW - bW;
          break;
        }
        case 'importance': {
          const aI = findSoaEntry(selectedControlSetId, a.controlId)?.importance || 'optional';
          const bI = findSoaEntry(selectedControlSetId, b.controlId)?.importance || 'optional';
          cmp = aI.localeCompare(bI);
          break;
        }
        case 'maturity': {
          const aML = findSoaEntry(selectedControlSetId, a.controlId)?.maturityLevel ?? -1;
          const bML = findSoaEntry(selectedControlSetId, b.controlId)?.maturityLevel ?? -1;
          cmp = aML - bML;
          break;
        }
        case 'coveredBy': {
          const aEntry = findSoaEntry(selectedControlSetId, a.controlId);
          const bEntry = findSoaEntry(selectedControlSetId, b.controlId);
          const aCov = aEntry ? (soaCoverageMap.get(aEntry.id)?.length || 0) : 0;
          const bCov = bEntry ? (soaCoverageMap.get(bEntry.id)?.length || 0) : 0;
          cmp = aCov - bCov;
          break;
        }
        case 'linkedRisks': {
          const aCount = (findSoaEntry(selectedControlSetId, a.controlId)?.mitigatesRiskIds || []).length;
          const bCount = (findSoaEntry(selectedControlSetId, b.controlId)?.mitigatesRiskIds || []).length;
          cmp = aCount - bCount;
          break;
        }
        case 'family':
          cmp = (a.family || '').localeCompare(b.family || '');
          break;
        default:
          cmp = a.controlId.localeCompare(b.controlId);
      }
      return cmp * dir;
    });
    return list;
  }, [filteredControls, sortColumn, sortDirection, selectedControlSetId, findSoaEntry]);

  const handleSort = useCallback((columnId: string) => {
    setSortDirection(prev => sortColumn === columnId ? (prev === 'asc' ? 'desc' : 'asc') : 'asc');
    setSortColumn(columnId);
  }, [sortColumn]);

  const upsertSoaEntry = useCallback(
    (controlSetId: string, controlId: string, updater: (entry: GrcSoaEntry) => GrcSoaEntry) => {
      const existing = workspace.soaEntries.find(
        entry =>
          entry.controlSetId === controlSetId &&
          entry.controlId === controlId &&
          entry.scopeType === currentScopeType &&
          entry.scopeId === currentScopeId
      );

      const baseline: GrcSoaEntry = existing || {
        id: createId('soa'),
        controlSetId,
        controlId,
        scopeType: currentScopeType,
        scopeId: currentScopeId,
        applicability: 'applicable',
        implementationStatus: 'not_implemented',
        justification: undefined,
        mitigatesRiskIds: [],
        diagramRefs: [],
        evidence: [],
        updatedAt: new Date().toISOString()
      };

      const updated = { ...updater(baseline), updatedAt: new Date().toISOString() };
      const nextSoaEntries = existing
        ? workspace.soaEntries.map(entry => (entry.id === updated.id ? updated : entry))
        : [...workspace.soaEntries, updated];

      applyWorkspace({ ...workspace, soaEntries: nextSoaEntries });
    },
    [applyWorkspace, currentScopeId, currentScopeType, workspace]
  );

  const addSoaEvidence = useCallback(
    (controlSetId: string, controlId: string, evidence: GrcEvidenceReference) => {
      upsertSoaEntry(controlSetId, controlId, entry => ({
        ...entry,
        evidence: [...entry.evidence, evidence]
      }));
    },
    [upsertSoaEntry]
  );

  const removeSoaEvidence = useCallback(
    (controlSetId: string, controlId: string, evidenceId: string) => {
      upsertSoaEntry(controlSetId, controlId, entry => ({
        ...entry,
        evidence: entry.evidence.filter(e => e.id !== evidenceId)
      }));
    },
    [upsertSoaEntry]
  );

  const openEvidenceDialog = useCallback(
    (kind: 'link' | 'file_reference' | 'governance_doc', controlSetId: string, controlId: string) => {
      setEvidenceDialog({ open: true, kind, controlSetId, controlId, value: '', governanceDocId: '' });
    },
    []
  );

  const handleEvidenceDialogSubmit = useCallback(() => {
    const { kind, controlSetId, controlId, value, governanceDocId } = evidenceDialog;
    if (kind === 'governance_doc') {
      if (!governanceDocId) return;
      const doc = governanceDocs.find(d => d.id === governanceDocId);
      addSoaEvidence(controlSetId, controlId, {
        id: createId('evidence'),
        kind: 'link',
        name: doc?.title || 'Governance Document',
        url: doc?.url || '',
        governanceDocId,
        createdAt: new Date().toISOString()
      });
    } else if (!value.trim()) {
      return;
    } else if (kind === 'link') {
      addSoaEvidence(controlSetId, controlId, {
        id: createId('evidence'),
        kind: 'link',
        name: value.trim(),
        url: value.trim(),
        createdAt: new Date().toISOString()
      });
    } else {
      addSoaEvidence(controlSetId, controlId, {
        id: createId('evidence'),
        kind: 'file_reference',
        name: value.trim(),
        note: 'Reference only (file content not embedded in JSON save file)',
        createdAt: new Date().toISOString()
      });
    }
    setEvidenceDialog(initialEvidenceDialog);
  }, [evidenceDialog, addSoaEvidence, governanceDocs]);

  const handleDeleteControlSet = useCallback(() => {
    const cs = deleteControlSetDialog.controlSet;
    if (!cs) return;
    const nextControlSets = workspace.controlSets.filter(s => s.id !== cs.id);
    const nextSoaEntries = workspace.soaEntries.filter(e => e.controlSetId !== cs.id);
    applyWorkspace({ ...workspace, controlSets: nextControlSets, soaEntries: nextSoaEntries });
    setDeleteControlSetDialog({ open: false, controlSet: null });
    setStatusMessage({ severity: 'info', text: `Deleted control set "${cs.name}" and its SoA entries.` });
  }, [deleteControlSetDialog.controlSet, workspace, applyWorkspace, setStatusMessage]);

  const mergeImportedControlSet = useCallback(
    (controlSet: GrcControlSet, seededSoaEntries: GrcSoaEntry[] = []) => {
      const withoutSameName = workspace.controlSets.filter(
        set => set.name.trim().toLowerCase() !== controlSet.name.trim().toLowerCase()
      );
      const mergedControlSets = [...withoutSameName, controlSet];
      const seededMap = new Map<string, GrcSoaEntry>();
      [...workspace.soaEntries, ...seededSoaEntries].forEach(entry => {
        const key = `${entry.controlSetId}:${entry.controlId}:${entry.scopeType}:${entry.scopeId}`;
        seededMap.set(key, entry);
      });
      applyWorkspace({ ...workspace, controlSets: mergedControlSets, soaEntries: Array.from(seededMap.values()) });
      const newIdx = mergedControlSets.findIndex(cs => cs.id === controlSet.id);
      setActiveTabIndex(newIdx >= 0 ? newIdx : mergedControlSets.length - 1);
    },
    [applyWorkspace, workspace]
  );

  const existingControlSetNames = useMemo(
    () => workspace.controlSets.map(cs => cs.name),
    [workspace.controlSets]
  );

  const handleFrameworkAdded = useCallback(
    (controlSet: GrcControlSet, soaEntries: GrcSoaEntry[]) => {
      mergeImportedControlSet(controlSet, soaEntries);
      setFrameworkPickerOpen(false);
      setStatusMessage({
        severity: 'success',
        text: `Added "${controlSet.name}" with ${controlSet.controls.length} controls.`
      });
    },
    [mergeImportedControlSet, setStatusMessage]
  );

  const handleCreateBlankControlSet = useCallback(() => {
    const name = newCsName.trim();
    if (!name) {
      setStatusMessage({ severity: 'warning', text: 'Control set name is required.' });
      return;
    }
    const now = new Date().toISOString();
    const newCs: GrcControlSet = {
      id: createId('cs'),
      name,
      version: newCsVersion.trim() || undefined,
      sourceType: 'imported',
      importedAt: now,
      controls: []
    };
    mergeImportedControlSet(newCs, []);
    setNewCsName('');
    setNewCsVersion('');
    setNewCsDialogOpen(false);
    setStatusMessage({ severity: 'success', text: `Created blank control set "${name}". You can import controls via CSV/XLSX.` });
  }, [mergeImportedControlSet, newCsName, newCsVersion, setStatusMessage]);

  const handleControlSetFilePicked = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = '';
      if (!file) return;

      setImportingControlSet(true);
      try {
        const fileName = file.name;
        const lowerName = fileName.toLowerCase();

        if (lowerName.endsWith('.xlsx')) {
          const buffer = await file.arrayBuffer();
          const xlsxBase64 = arrayBufferToBase64(buffer);
          await previewControlSetImport({ name: fileName, format: 'xlsx', xlsxBase64 });
          const response = await importControlSetXlsx(fileName, xlsxBase64, undefined, currentScopeType, currentScopeId);
          if (response?.controlSet) {
            mergeImportedControlSet(response.controlSet, response.soaEntries || []);
            setStatusMessage({ severity: 'success', text: `Imported control set "${response.controlSet.name}" from ${fileName}.` });
            return;
          }
          setStatusMessage({ severity: 'warning', text: 'XLSX import did not return a control set.' });
          return;
        }

        const csvText = await file.text();
        try {
          await previewControlSetImport({ name: fileName, format: 'csv', csvText });
          const apiResult = await importControlSetApi({
            name: fileName.replace(/\.[^/.]+$/, ''),
            version: undefined,
            format: 'csv',
            csvText,
            scopeType: currentScopeType,
            scopeId: currentScopeId
          });
          if (apiResult?.controlSet) {
            mergeImportedControlSet(apiResult.controlSet, apiResult.soaEntries || []);
            setStatusMessage({ severity: 'success', text: `Imported control set "${apiResult.controlSet.name}" from ${fileName}.` });
            return;
          }
        } catch { /* Fall through to local parser */ }

        const localRows: ControlImportRow[] = parseControlSetCsvRows(csvText);
        const localControlSet = controlRowsToControlSet(fileName.replace(/\.[^/.]+$/, ''), localRows);
        const now = new Date().toISOString();
        const localSeededSoaEntries: GrcSoaEntry[] = localControlSet.controls.map(control => ({
          id: createId('soa'),
          controlSetId: localControlSet.id,
          controlId: control.controlId,
          scopeType: currentScopeType,
          scopeId: currentScopeId,
          applicability: 'applicable',
          implementationStatus: 'not_implemented',
          justification: '',
          mitigatesRiskIds: [],
          diagramRefs: [],
          evidence: [],
          updatedAt: now
        }));
        mergeImportedControlSet(localControlSet, localSeededSoaEntries);
        setStatusMessage({ severity: 'info', text: `Imported ${localControlSet.controls.length} controls from ${fileName} (local parser).` });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown import error';
        setStatusMessage({ severity: 'error', text: `Control set import failed: ${message}` });
      } finally {
        setImportingControlSet(false);
      }
    },
    [currentScopeId, currentScopeType, mergeImportedControlSet, setStatusMessage]
  );

  const handleFocusNode = useCallback((nodeId: string) => {
    onSwitchModule?.('diagram');
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('grc-focus-diagram-node', { detail: { nodeId } }));
    }, 200);
  }, [onSwitchModule]);

  const renderCellContent = useCallback((columnId: string, control: GrcControlSet['controls'][number], entry: GrcSoaEntry | undefined) => {
    const applicability = entry?.applicability || 'applicable';
    const implementation = entry?.implementationStatus || 'not_implemented';
    const linkedRiskIds = entry?.mitigatesRiskIds || [];
    const justification = entry?.justification || '';
    const evidenceList = entry?.evidence || [];

    switch (columnId) {
      case 'control': {
        const health = entry ? computeSoaHealth(entry, workspace) : null;
        return (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            {health && (
              <Tooltip title={health.reasons.join('; ') || 'Healthy'}>
                <Box component="span" sx={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
                  bgcolor: health.level === 'red' ? '#dc2626' : health.level === 'yellow' ? '#ca8a04' : '#16a34a',
                  flexShrink: 0 }} />
              </Tooltip>
            )}
            <Box>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>{control.controlId}</Typography>
              <Typography variant="caption" color="text.secondary">{control.title}</Typography>
            </Box>
          </Box>
        );
      }
      case 'applicability':
        return (
          <TextField size="small" select value={applicability}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => upsertSoaEntry(selectedControlSetId, control.controlId, soa => ({
              ...soa, applicability: e.target.value as GrcSoaEntry['applicability']
            }))} sx={{ minWidth: 150 }}>
            {(Object.entries(soaLabels.applicability) as Array<[SoaApplicability, string]>).map(([key, label]) => (
              <MenuItem key={key} value={key}>{label}</MenuItem>
            ))}
          </TextField>
        );
      case 'implementation':
        return (
          <TextField size="small" select value={implementation}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => upsertSoaEntry(selectedControlSetId, control.controlId, soa => ({
              ...soa, implementationStatus: e.target.value as GrcSoaEntry['implementationStatus']
            }))} sx={{ minWidth: 150 }}>
            {(Object.entries(soaLabels.implementationStatus) as Array<[SoaImplementationStatus, string]>).map(([key, label]) => (
              <MenuItem key={key} value={key}>{label}</MenuItem>
            ))}
          </TextField>
        );
      case 'weight':
        return (
          <TextField size="small" type="number" value={entry?.weight ?? 1}
            inputProps={{ min: 0, max: 10, step: 1 }}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
              const val = Math.max(0, Math.min(10, Number(e.target.value) || 0));
              upsertSoaEntry(selectedControlSetId, control.controlId, soa => ({
                ...soa, weight: val
              }));
            }} sx={{ width: 70 }} />
        );
      case 'importance': {
        const imp = entry?.importance || 'optional';
        const impColor = IMPORTANCE_COLORS[imp];
        return (
          <TextField size="small" select value={imp}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => upsertSoaEntry(selectedControlSetId, control.controlId, soa => ({
              ...soa, importance: e.target.value as GrcSoaImportance
            }))} sx={{ minWidth: 130 }}>
            {(Object.keys(IMPORTANCE_LABELS) as GrcSoaImportance[]).map(k => (
              <MenuItem key={k} value={k}>
                <Box component="span" sx={{ color: IMPORTANCE_COLORS[k], fontWeight: 600 }}>{IMPORTANCE_LABELS[k]}</Box>
              </MenuItem>
            ))}
          </TextField>
        );
      }
      case 'maturity': {
        const ml = entry?.maturityLevel;
        if (!activeMaturityModel) return <Typography variant="caption" color="text.disabled">-</Typography>;
        return (
          <TextField size="small" select value={ml ?? ''}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
              const val = e.target.value;
              upsertSoaEntry(selectedControlSetId, control.controlId, soa => ({
                ...soa, maturityLevel: val === '' ? undefined : Number(val)
              }));
            }} sx={{ minWidth: 180 }}>
            <MenuItem value="">
              <Typography variant="body2" color="text.disabled">Not rated</Typography>
            </MenuItem>
            {activeMaturityModel.levels.map(l => (
              <MenuItem key={l.level} value={l.level}>{l.label}</MenuItem>
            ))}
          </TextField>
        );
      }
      case 'coveredBy': {
        if (!entry) return <Typography variant="caption" color="text.disabled">-</Typography>;
        const linkedIcIds = soaCoverageMap.get(entry.id) || [];
        const icCount = linkedIcIds.length;
        if (icCount === 0) return <Typography variant="caption" color="text.disabled">0</Typography>;
        const implControls = workspace.implementedControls || [];
        return (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.25 }}>
            {linkedIcIds.slice(0, 3).map(icId => {
              const ic = implControls.find(c => c.id === icId);
              return (
                <Chip key={icId} size="small" label={ic?.title || icId} variant="outlined"
                  onClick={(e: React.MouseEvent) => { e.stopPropagation(); onSwitchTab?.('controls', icId); }}
                  sx={{ cursor: 'pointer', fontSize: '0.68rem' }} />
              );
            })}
            {icCount > 3 && <Chip size="small" label={`+${icCount - 3}`} variant="outlined" sx={{ fontSize: '0.68rem' }} />}
          </Box>
        );
      }
      case 'linkedRisks': {
        const count = linkedRiskIds.length;
        if (expandedControlId === control.id) {
          return (
            <FormControl size="small" sx={{ minWidth: 180 }}>
              <InputLabel id={`${control.id}-linked-risks-label`}>Linked Risks</InputLabel>
              <Select
                labelId={`${control.id}-linked-risks-label`}
                multiple
                value={linkedRiskIds}
                onChange={e => {
                  const value = e.target.value;
                  const nextRiskIds = typeof value === 'string' ? value.split(',') : (value as string[]);
                  upsertSoaEntry(selectedControlSetId, control.controlId, soa => ({
                    ...soa,
                    mitigatesRiskIds: nextRiskIds
                  }));
                }}
                input={<OutlinedInput label="Linked Risks" />}
                renderValue={selected =>
                  (selected as string[])
                    .map(riskId => workspace.risks.find(risk => risk.id === riskId)?.title || riskId)
                    .join(', ')
                }
              >
                {workspace.risks.map(risk => (
                  <MenuItem key={risk.id} value={risk.id}>{risk.title}</MenuItem>
                ))}
              </Select>
            </FormControl>
          );
        }
        return count > 0
          ? <Tooltip title={linkedRiskIds.map(rId => workspace.risks.find(r => r.id === rId)?.title || rId).join(', ')} arrow>
              <Chip size="small" label={`${count} risk${count !== 1 ? 's' : ''}`} variant="outlined" />
            </Tooltip>
          : <Typography variant="caption" color="text.disabled">-</Typography>;
      }
      case 'justification':
        return justification
          ? <Tooltip title={justification} arrow>
              <Typography variant="caption" sx={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
                {justification}
              </Typography>
            </Tooltip>
          : <Typography variant="caption" color="text.disabled">-</Typography>;
      case 'evidence': {
        const evCount = evidenceList.length;
        return evCount > 0
          ? <Chip size="small" label={`${evCount} item${evCount !== 1 ? 's' : ''}`} variant="outlined" />
          : <Typography variant="caption" color="text.disabled">-</Typography>;
      }
      case 'family':
        return control.family
          ? <Typography variant="caption">{control.family}</Typography>
          : <Typography variant="caption" color="text.disabled">-</Typography>;
      case 'description':
        return control.description
          ? <Tooltip title={control.description} arrow>
              <Typography variant="caption" sx={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
                {control.description}
              </Typography>
            </Tooltip>
          : <Typography variant="caption" color="text.disabled">-</Typography>;
      default:
        return null;
    }
  }, [activeMaturityModel, expandedControlId, selectedControlSetId, soaLabels, upsertSoaEntry, workspace, workspace.risks, workspace.implementedControls, soaCoverageMap, onSwitchTab]);

  const renderExpandedDetail = useCallback((control: GrcControlSet['controls'][number], entry: GrcSoaEntry | undefined) => {
    const justification = entry?.justification || '';
    const evidenceList = entry?.evidence || [];
    const diagramRefs = entry?.diagramRefs || [];

    return (
      <Box sx={{ p: 2, display: 'grid', gap: 2, gridTemplateColumns: '1fr 1fr' }}>
        {control.description && (
          <Box sx={{ gridColumn: '1 / -1' }}>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, mb: 0.5, display: 'block' }}>
              Control Description
            </Typography>
            <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.6, bgcolor: 'action.hover', p: 1.5, borderRadius: 1 }}>
              {control.description}
            </Typography>
          </Box>
        )}

        <Box>
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, mb: 0.5, display: 'block' }}>
            Justification
          </Typography>
          <TextField
            size="small"
            fullWidth
            multiline
            minRows={2}
            maxRows={6}
            value={justification}
            placeholder="Document why this control is applicable/not applicable, or describe implementation approach"
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              upsertSoaEntry(selectedControlSetId, control.controlId, soa => ({
                ...soa, justification: e.target.value
              }))
            }
          />
        </Box>

        <Box sx={{ display: 'flex', gap: 2 }}>
          <Box sx={{ flex: 1 }}>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, mb: 0.5, display: 'block' }}>
              Weight
            </Typography>
            <TextField
              size="small"
              fullWidth
              type="number"
              value={entry?.weight ?? 1}
              inputProps={{ min: 0, max: 10, step: 1 }}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                const val = Math.max(0, Math.min(10, Number(e.target.value) || 0));
                upsertSoaEntry(selectedControlSetId, control.controlId, soa => ({
                  ...soa, weight: val
                }));
              }}
            />
          </Box>
          <Box sx={{ flex: 1 }}>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, mb: 0.5, display: 'block' }}>
              Importance
            </Typography>
            <TextField
              size="small"
              fullWidth
              select
              value={entry?.importance || 'optional'}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                upsertSoaEntry(selectedControlSetId, control.controlId, soa => ({
                  ...soa, importance: e.target.value as GrcSoaImportance
                }))
              }
            >
              {(Object.keys(IMPORTANCE_LABELS) as GrcSoaImportance[]).map(k => (
                <MenuItem key={k} value={k}>
                  <Box component="span" sx={{ color: IMPORTANCE_COLORS[k], fontWeight: 600 }}>{IMPORTANCE_LABELS[k]}</Box>
                </MenuItem>
              ))}
            </TextField>
          </Box>
        </Box>

        <Box>
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, mb: 0.5, display: 'block' }}>
            Linked Risks
          </Typography>
          <FormControl size="small" fullWidth>
            <InputLabel id={`${control.id}-detail-risks-label`}>Linked Risks</InputLabel>
            <Select
              labelId={`${control.id}-detail-risks-label`}
              multiple
              value={entry?.mitigatesRiskIds || []}
              onChange={e => {
                const value = e.target.value;
                const nextRiskIds = typeof value === 'string' ? value.split(',') : (value as string[]);
                upsertSoaEntry(selectedControlSetId, control.controlId, soa => ({
                  ...soa,
                  mitigatesRiskIds: nextRiskIds
                }));
              }}
              input={<OutlinedInput label="Linked Risks" />}
              renderValue={selected =>
                (selected as string[])
                  .map(riskId => workspace.risks.find(risk => risk.id === riskId)?.title || riskId)
                  .join(', ')
              }
            >
              {workspace.risks.map(risk => (
                <MenuItem key={risk.id} value={risk.id}>{risk.title}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>

        <Box>
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, mb: 0.5, display: 'block' }}>
            Implemented Controls
          </Typography>
          {(() => {
            const linkedIcs = entry
              ? workspace.implementedControls.filter(ic => ic.linkedSoaEntryIds.includes(entry.id))
              : [];
            if (linkedIcs.length === 0) {
              return (
                <Typography variant="caption" color="text.disabled">
                  (0) No implemented controls linked
                </Typography>
              );
            }
            return (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {linkedIcs.map(ic => (
                  <Chip
                    key={ic.id}
                    size="small"
                    label={ic.title}
                    variant="outlined"
                    onClick={() => onSwitchTab?.('controls', ic.id)}
                  />
                ))}
              </Box>
            );
          })()}
        </Box>

        <Box>
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, mb: 0.5, display: 'block' }}>
            Cross-Framework Mappings
          </Typography>
          {(() => {
            const mappings = (workspace.frameworkMappings || []).filter(
              m => (m.sourceControlSetId === selectedControlSetId && m.sourceControlId === control.controlId) ||
                   (m.targetControlSetId === selectedControlSetId && m.targetControlId === control.controlId)
            );
            if (mappings.length === 0) {
              return <Typography variant="caption" color="text.disabled">No cross-framework mappings</Typography>;
            }
            return (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {mappings.map(m => {
                  const isSource = m.sourceControlSetId === selectedControlSetId && m.sourceControlId === control.controlId;
                  const otherCsId = isSource ? m.targetControlSetId : m.sourceControlSetId;
                  const otherCtrlId = isSource ? m.targetControlId : m.sourceControlId;
                  const otherCsName = workspace.controlSets.find(cs => cs.id === otherCsId)?.name || otherCsId;
                  return (
                    <Chip key={m.id} size="small" label={`${otherCsName}: ${otherCtrlId}`} variant="outlined" />
                  );
                })}
              </Box>
            );
          })()}
        </Box>

        {activeMaturityModel && (
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, mb: 0.5, display: 'block' }}>
              Maturity Level ({activeMaturityModel.name})
            </Typography>
            <TextField size="small" fullWidth select value={entry?.maturityLevel ?? ''}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                const val = e.target.value;
                upsertSoaEntry(selectedControlSetId, control.controlId, soa => ({
                  ...soa, maturityLevel: val === '' ? undefined : Number(val)
                }));
              }}>
              <MenuItem value="">
                <Typography variant="body2" color="text.disabled">Not rated</Typography>
              </MenuItem>
              {activeMaturityModel.levels.map(l => (
                <MenuItem key={l.level} value={l.level}>
                  <Box>
                    <Typography variant="body2">{l.label}</Typography>
                    {l.description && <Typography variant="caption" color="text.secondary">{l.description}</Typography>}
                  </Box>
                </MenuItem>
              ))}
            </TextField>
          </Box>
        )}

        <Box sx={{ gridColumn: '1 / -1' }}>
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, mb: 0.5, display: 'block' }}>
            Evidence ({evidenceList.length})
          </Typography>
          {evidenceList.length > 0 && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, mb: 1 }}>
              {evidenceList.map(ev => (
                <Box key={ev.id} sx={{ display: 'flex', alignItems: 'center', gap: 1, bgcolor: 'action.hover', borderRadius: 1, px: 1, py: 0.5 }}>
                  {ev.governanceDocId ? <Shield size={14} /> : ev.kind === 'link' ? <LinkIcon size={14} /> : <FileText size={14} />}
                  <Typography variant="body2" sx={{ flex: 1 }}>
                    {ev.kind === 'link' && ev.url
                      ? <a href={ev.url} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit' }}>{ev.name}</a>
                      : ev.name}
                  </Typography>
                  {ev.governanceDocId && (
                    <Chip size="small" label="Policy" variant="outlined" sx={{ height: 20, fontSize: '0.65rem' }} />
                  )}
                  <Tooltip title={`Remove evidence "${ev.name}"`} arrow>
                    <IconButton size="small" sx={{ p: 0.25 }}
                      onClick={() => removeSoaEvidence(selectedControlSetId, control.controlId, ev.id)}>
                      <X size={14} />
                    </IconButton>
                  </Tooltip>
                </Box>
              ))}
            </Box>
          )}
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button size="small" variant="outlined" startIcon={<LinkIcon size={14} />}
              onClick={() => openEvidenceDialog('link', selectedControlSetId, control.controlId)}>
              Add Link
            </Button>
            <Button size="small" variant="outlined" startIcon={<FileText size={14} />}
              onClick={() => openEvidenceDialog('file_reference', selectedControlSetId, control.controlId)}>
              Add File Ref
            </Button>
            {governanceDocs.length > 0 && (
              <Button size="small" variant="outlined" startIcon={<Shield size={14} />}
                onClick={() => openEvidenceDialog('governance_doc', selectedControlSetId, control.controlId)}>
                Link Governance Doc
              </Button>
            )}
          </Box>
        </Box>

        {diagramRefs.length > 0 && (
          <Box sx={{ gridColumn: '1 / -1' }}>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, mb: 0.5, display: 'block' }}>
              Diagram References
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
              {diagramRefs.map((ref, idx) => (
                <Chip
                  key={idx}
                  size="small"
                  label={ref.nodeLabel || ref.nodeId}
                  icon={<Crosshair size={12} />}
                  onClick={() => handleFocusNode(ref.nodeId)}
                  variant="outlined"
                />
              ))}
            </Box>
          </Box>
        )}

        {entry?.updatedAt && (
          <Box sx={{ gridColumn: '1 / -1' }}>
            <Typography variant="caption" color="text.disabled">
              Last updated: {new Date(entry.updatedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
            </Typography>
          </Box>
        )}
      </Box>
    );
  }, [activeMaturityModel, governanceDocs, handleFocusNode, onSwitchTab, openEvidenceDialog, removeSoaEvidence, selectedControlSetId, upsertSoaEntry, workspace.implementedControls, workspace.risks, workspace.frameworkMappings, workspace.controlSets]);

  if (workspace.controlSets.length === 0) {
    return (
      <Box sx={{ display: 'grid', gap: 2 }}>
        <Paper sx={{ ...cardSx, textAlign: 'center', py: 6 }}>
          <Typography variant="h6" sx={{ mb: 2 }}>No control sets imported yet</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 520, mx: 'auto', mb: 3, lineHeight: 1.8 }}>
            Control sets are security frameworks (like NIST CSF, ISO 27001, CIS Controls)
            that you assess against. You can import from CSV/XLSX or create a blank set manually.
          </Typography>
          <Box component="ul" sx={{ listStyle: 'none', p: 0, m: 0, mb: 3, textAlign: 'left', maxWidth: 520, mx: 'auto' }}>
            <Typography component="li" variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              {'Click "Import Control Set (CSV/XLSX)" to upload a framework'}
            </Typography>
            <Typography component="li" variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              {'Or click "New Blank Control Set" to create one from scratch'}
            </Typography>
            <Typography component="li" variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              Each imported control auto-creates Statement of Applicability (SoA) entries
            </Typography>
            <Typography component="li" variant="body2" color="text.secondary">
              Link controls to risks to track treatment coverage
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 1.5, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Tooltip describeChild title="Choose from built-in security frameworks like NIST 800-53, MITRE ATT&CK, ISM, and more." arrow>
              <Button variant="contained" startIcon={<Shield size={16} />}
                onClick={() => setFrameworkPickerOpen(true)}>
                Add Built-in Framework
              </Button>
            </Tooltip>
            <Tooltip describeChild title="Import a control framework CSV/XLSX and auto-seed scoped SoA entries." arrow>
              <span>
                <Button variant="outlined" startIcon={<Upload size={16} />}
                  onClick={() => controlSetInputRef.current?.click()} disabled={importingControlSet}>
                  {importingControlSet ? 'Importing...' : 'Import Control Set (CSV/XLSX)'}
                </Button>
              </span>
            </Tooltip>
            <Tooltip describeChild title="Create a new blank control set and add controls manually or import later." arrow>
              <Button variant="outlined" startIcon={<Plus size={16} />} onClick={() => setNewCsDialogOpen(true)}>
                New Blank Control Set
              </Button>
            </Tooltip>
          </Box>
          <input ref={controlSetInputRef} type="file" accept=".csv,.xlsx" style={{ display: 'none' }}
            onChange={handleControlSetFilePicked} />
          <FrameworkPickerDialog
            open={frameworkPickerOpen}
            onClose={() => setFrameworkPickerOpen(false)}
            onAdd={handleFrameworkAdded}
            existingControlSetNames={existingControlSetNames}
            scopeType={currentScopeType}
            scopeId={currentScopeId}
          />
        </Paper>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'grid', gap: 2 }}>
      <Paper sx={cardSx}>
        <Typography variant="h6" sx={{ mb: 1 }}>Compliance and SoA</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          Evidence is stored as references/links only by default so saved JSON files stay compact.
        </Typography>

        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, alignItems: 'center', mb: 2 }}>
          <Tooltip describeChild title="Choose which scope to edit Statement of Applicability entries for." arrow>
            <TextField size="small" select label="SoA Scope" value={selectedScopeKey}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSelectedScopeKey(e.target.value)}
              sx={{ minWidth: 260 }}>
              {scopeOptions.map(opt => (
                <MenuItem key={`${opt.type}:${opt.id}`} value={`${opt.type}:${opt.id}`}>{opt.label}</MenuItem>
              ))}
            </TextField>
          </Tooltip>
          <Tooltip describeChild title="Choose from built-in security frameworks like NIST 800-53, MITRE ATT&CK, ISM, and more." arrow>
            <Button variant="contained" startIcon={<Shield size={16} />}
              onClick={() => setFrameworkPickerOpen(true)}>
              Add Built-in Framework
            </Button>
          </Tooltip>
          <Tooltip describeChild title="Import a control framework CSV/XLSX and auto-seed scoped SoA entries." arrow>
            <span>
              <Button variant="outlined" startIcon={<Upload size={16} />}
                onClick={() => controlSetInputRef.current?.click()} disabled={importingControlSet}>
                {importingControlSet ? 'Importing...' : 'Import Control Set (CSV/XLSX)'}
              </Button>
            </span>
          </Tooltip>
          <Tooltip describeChild title="Create a new blank control set without importing a file." arrow>
            <Button variant="outlined" startIcon={<Plus size={16} />} onClick={() => setNewCsDialogOpen(true)}>
              New Blank Control Set
            </Button>
          </Tooltip>
        </Box>

        <Tabs
          value={activeTabIndex}
          onChange={(_: React.SyntheticEvent, idx: number) => {
            setActiveTabIndex(idx);
            setControlSearch('');
            setApplicabilityFilter('all');
            setImplementationFilter('all');
            setExpandedControlId(null);
          }}
          variant="scrollable"
          scrollButtons="auto"
          sx={{ borderBottom: 1, borderColor: 'divider' }}
        >
          {workspace.controlSets.map(cs => {
            const stats = controlSetStats[cs.id];
            const pct = stats && stats.applicable > 0 ? Math.round((stats.implemented / stats.applicable) * 100) : 0;
            const wPct = stats?.weightedPct ?? 0;
            const label = stats ? `${cs.name} (${stats.implemented}/${stats.applicable})` : cs.name;
            return (
              <Tab
                key={cs.id}
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <span>{label}</span>
                    <Chip
                      size="small"
                      label={`${pct}%`}
                      color={pct === 100 ? 'success' : pct >= 50 ? 'warning' : 'default'}
                      sx={{ height: 18, fontSize: '0.65rem', '& .MuiChip-label': { px: 0.75 } }}
                    />
                    <Tooltip title="Weighted compliance percentage" arrow>
                      <Chip
                        size="small"
                        label={`Weighted: ${wPct}%`}
                        variant="outlined"
                        sx={{ height: 18, fontSize: '0.6rem', '& .MuiChip-label': { px: 0.5 } }}
                      />
                    </Tooltip>
                    <Tooltip describeChild title={`Delete control set "${cs.name}" and all its SoA entries`} arrow>
                      <IconButton
                        component="span"
                        size="small"
                        aria-label={`Delete control set ${cs.name}`}
                        onClick={(e: React.MouseEvent) => {
                          e.stopPropagation();
                          setDeleteControlSetDialog({ open: true, controlSet: cs });
                        }}
                        sx={{ ml: 0.5, p: 0.25 }}
                      >
                        <X size={14} />
                      </IconButton>
                    </Tooltip>
                  </Box>
                }
              />
            );
          })}
        </Tabs>
        <input ref={controlSetInputRef} type="file" accept=".csv,.xlsx" style={{ display: 'none' }}
          onChange={handleControlSetFilePicked} />
      </Paper>

      {selectedControlSet && (
        <TableContainer component={Paper} sx={cardSx}>
          <Box sx={{ p: 1.5, borderBottom: '1px solid', borderColor: 'divider', display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center' }}>
            <Tooltip describeChild title="Filter controls by ID, title, family, or description." arrow>
              <TextField
                size="small"
                placeholder="Search controls..."
                value={controlSearch}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setControlSearch(e.target.value)}
                sx={{ minWidth: 240 }}
              />
            </Tooltip>

            <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
              <Typography variant="caption" color="text.secondary" sx={{ mr: 0.5 }}>Applicability:</Typography>
              {(['all', 'applicable', 'partially_applicable', 'not_applicable'] as const).map(val => (
                <Chip key={val} size="small"
                  label={val === 'all' ? 'All' : (soaLabels.applicability as Record<string, string>)[val] || val}
                  variant={applicabilityFilter === val ? 'filled' : 'outlined'}
                  color={applicabilityFilter === val ? 'primary' : 'default'}
                  onClick={() => setApplicabilityFilter(val)}
                />
              ))}
            </Box>

            <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
              <Typography variant="caption" color="text.secondary" sx={{ mr: 0.5 }}>Implementation:</Typography>
              {(['all', 'implemented', 'partially_implemented', 'planned', 'not_implemented'] as const).map(val => (
                <Chip key={val} size="small"
                  label={val === 'all' ? 'All' : (soaLabels.implementationStatus as Record<string, string>)[val] || val}
                  variant={implementationFilter === val ? 'filled' : 'outlined'}
                  color={implementationFilter === val ? 'primary' : 'default'}
                  onClick={() => setImplementationFilter(val)}
                />
              ))}
            </Box>

            <Chip size="small" label="Uncovered"
              variant={uncoveredFilter ? 'filled' : 'outlined'}
              color={uncoveredFilter ? 'warning' : 'default'}
              onClick={() => setUncoveredFilter(!uncoveredFilter)} />

            <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto' }}>
              {sortedControls.length} of {selectedControlSet.controls.length} controls
            </Typography>
          </Box>

          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell padding="checkbox" sx={{ width: 40 }}>
                  <Box sx={{ width: 28 }} />
                </TableCell>
                {columnConfig.visibleColumns.map(col => (
                  <TableCell key={col.id}>
                    {SORTABLE_COLUMNS.has(col.id) ? (
                      <TableSortLabel
                        active={sortColumn === col.id}
                        direction={sortColumn === col.id ? sortDirection : 'asc'}
                        onClick={() => handleSort(col.id)}
                      >
                        {col.label}
                      </TableSortLabel>
                    ) : (
                      col.label
                    )}
                  </TableCell>
                ))}
                <TableCell padding="none" sx={{ width: 40 }}>
                  <TableColumnConfigPopover
                    allColumns={columnConfig.allColumns}
                    visibleIds={columnConfig.visibleIds}
                    onToggle={columnConfig.toggleColumn}
                    onMove={columnConfig.moveColumn}
                    onReset={columnConfig.resetToDefaults}
                  />
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {sortedControls.map(control => {
                const entry = findSoaEntry(selectedControlSetId, control.controlId);
                const isExpanded = expandedControlId === control.id;

                return (
                  <React.Fragment key={control.id}>
                    <TableRow
                      id={`grc-control-${control.id}`}
                      hover
                      sx={{
                        cursor: 'pointer', '& > *': { borderBottom: isExpanded ? 'none' : undefined },
                        ...(highlightControlId === control.id && { bgcolor: 'action.selected', transition: 'background-color 0.3s' })
                      }}
                      onClick={() => setExpandedControlId(isExpanded ? null : control.id)}
                    >
                      <TableCell padding="checkbox">
                        <IconButton size="small" sx={{ p: 0.25 }}>
                          {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                        </IconButton>
                      </TableCell>
                      {columnConfig.visibleColumns.map(col => (
                        <TableCell key={col.id}>
                          {renderCellContent(col.id, control, entry)}
                        </TableCell>
                      ))}
                      <TableCell padding="none" />
                    </TableRow>
                    {isExpanded && (
                      <TableRow>
                        <TableCell colSpan={columnConfig.visibleColumns.length + 2} sx={{ py: 0, px: 0 }}>
                          <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                            {renderExpandedDetail(control, entry)}
                          </Collapse>
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                );
              })}
              {sortedControls.length === 0 && selectedControlSet.controls.length > 0 && (
                <TableRow>
                  <TableCell colSpan={columnConfig.visibleColumns.length + 2}>
                    <Typography variant="body2" color="text.secondary" sx={{ py: 1 }}>
                      No controls match the current filters.
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
              {selectedControlSet.controls.length === 0 && (
                <TableRow>
                  <TableCell colSpan={columnConfig.visibleColumns.length + 2}>
                    <Typography variant="body2" color="text.secondary" sx={{ py: 1 }}>
                      This control set has no controls yet. Import a CSV/XLSX to populate it.
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <GrcCrossFrameworkMappingsSection workspace={workspace} applyWorkspace={applyWorkspace} />

      <Dialog open={newCsDialogOpen} onClose={() => setNewCsDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>New Blank Control Set</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            Create a new control framework to assess against. You can import controls via CSV/XLSX afterwards,
            or use this to track a custom framework.
          </DialogContentText>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            <Tooltip describeChild title="Name of the control framework (e.g. 'NIST CSF 2.0', 'ISO 27001:2022', 'CIS Controls v8')" arrow>
              <TextField
                autoFocus
                fullWidth
                size="small"
                label="Framework Name"
                placeholder="e.g. NIST CSF 2.0"
                value={newCsName}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewCsName(e.target.value)}
                onKeyDown={(e: React.KeyboardEvent) => { if (e.key === 'Enter' && newCsName.trim()) handleCreateBlankControlSet(); }}
              />
            </Tooltip>
            <Tooltip describeChild title="Optional version identifier for this framework revision" arrow>
              <TextField
                fullWidth
                size="small"
                label="Version (optional)"
                placeholder="e.g. 2.0, 2022"
                value={newCsVersion}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewCsVersion(e.target.value)}
              />
            </Tooltip>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setNewCsDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleCreateBlankControlSet} disabled={!newCsName.trim()}>
            Create
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={evidenceDialog.open} onClose={() => setEvidenceDialog(initialEvidenceDialog)} maxWidth="sm" fullWidth>
        <DialogTitle>
          {evidenceDialog.kind === 'governance_doc' ? 'Link Governance Document' : evidenceDialog.kind === 'link' ? 'Add Evidence Link' : 'Add File Reference'}
        </DialogTitle>
        <DialogContent>
          {evidenceDialog.kind === 'governance_doc' ? (
            <>
              <DialogContentText sx={{ mb: 2 }}>
                Select a governance document to link as evidence for this control.
              </DialogContentText>
              <TextField
                autoFocus
                fullWidth
                size="small"
                select
                label="Governance Document"
                value={evidenceDialog.governanceDocId}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setEvidenceDialog(prev => ({ ...prev, governanceDocId: e.target.value }))
                }
              >
                {governanceDocs.map(doc => (
                  <MenuItem key={doc.id} value={doc.id}>
                    <Box>
                      <Typography variant="body2">{doc.title}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {doc.type} — {doc.status}{doc.version ? ` (v${doc.version})` : ''}
                      </Typography>
                    </Box>
                  </MenuItem>
                ))}
              </TextField>
            </>
          ) : (
            <>
              <DialogContentText sx={{ mb: 2 }}>
                {evidenceDialog.kind === 'link'
                  ? 'Enter the URL of the evidence document or resource.'
                  : 'Enter the file reference name. This is metadata only; no binary file is stored.'}
              </DialogContentText>
              <TextField
                autoFocus
                fullWidth
                size="small"
                label={evidenceDialog.kind === 'link' ? 'Evidence URL' : 'File Reference Name'}
                placeholder={evidenceDialog.kind === 'link' ? 'https://...' : 'e.g., SOC2_Report_2025.pdf'}
                value={evidenceDialog.value}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setEvidenceDialog(prev => ({ ...prev, value: e.target.value }))
                }
                onKeyDown={(e: React.KeyboardEvent) => {
                  if (e.key === 'Enter' && evidenceDialog.value.trim()) {
                    handleEvidenceDialogSubmit();
                  }
                }}
              />
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEvidenceDialog(initialEvidenceDialog)}>Cancel</Button>
          <Button variant="contained" onClick={handleEvidenceDialogSubmit}
            disabled={evidenceDialog.kind === 'governance_doc' ? !evidenceDialog.governanceDocId : !evidenceDialog.value.trim()}>
            {evidenceDialog.kind === 'governance_doc' ? 'Link' : 'Add'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={deleteControlSetDialog.open}
        onClose={() => setDeleteControlSetDialog({ open: false, controlSet: null })}>
        <DialogTitle>Delete Control Set</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete "{deleteControlSetDialog.controlSet?.name}"?
            This will also remove all Statement of Applicability entries associated with this control set.
            This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Tooltip describeChild title="Keep this control set and close dialog." arrow>
            <Button onClick={() => setDeleteControlSetDialog({ open: false, controlSet: null })}>Cancel</Button>
          </Tooltip>
          <Tooltip describeChild title="Delete this control set and all associated scoped SoA entries." arrow>
            <Button variant="contained" color="error" onClick={handleDeleteControlSet}>
              Delete
            </Button>
          </Tooltip>
        </DialogActions>
      </Dialog>

      <FrameworkPickerDialog
        open={frameworkPickerOpen}
        onClose={() => setFrameworkPickerOpen(false)}
        onAdd={handleFrameworkAdded}
        existingControlSetNames={existingControlSetNames}
        scopeType={currentScopeType}
        scopeId={currentScopeId}
      />
    </Box>
  );
};

export default GrcComplianceTab;
