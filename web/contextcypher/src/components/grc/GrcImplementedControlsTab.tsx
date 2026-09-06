import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
  TableSortLabel,
  TextField,
  Tooltip,
  Typography
} from '@mui/material';
import SecurityOutlined from '@mui/icons-material/SecurityOutlined';
import { ChevronDown, ChevronRight, Plus, Trash2 } from 'lucide-react';
import {
  GrcImplementedControl,
  GrcImplementedControlType,
  GrcImplementedControlStatus,
  GrcImplementedControlAutomation,
  GrcImplementedControlCategory,
  GrcControlAudit,
  GrcControlAuditResult
} from '../../types/GrcTypes';
import { GrcTabProps, cardSx, createId, LBL } from './grcShared';
import { useTableColumnConfig, ColumnDef } from './useTableColumnConfig';
import TableColumnConfigPopover from './TableColumnConfigPopover';

const controlTypeLabels: Record<GrcImplementedControlType, string> = {
  technical: 'Technical',
  administrative: 'Administrative',
  physical: 'Physical',
  operational: 'Operational'
};

const statusLabels: Record<GrcImplementedControlStatus, string> = {
  active: 'Active',
  planned: 'Planned',
  under_review: 'Under Review',
  deprecated: 'Deprecated',
  inactive: 'Inactive'
};

const automationLabels: Record<GrcImplementedControlAutomation, string> = {
  manual: 'Manual',
  semi_automated: 'Semi-Automated',
  fully_automated: 'Fully Automated'
};

const categoryLabels: Record<GrcImplementedControlCategory, string> = {
  access_control: 'Access Control',
  encryption: 'Encryption',
  monitoring: 'Monitoring',
  network_security: 'Network Security',
  endpoint_protection: 'Endpoint Protection',
  identity_management: 'Identity Management',
  logging: 'Logging',
  backup_recovery: 'Backup & Recovery',
  incident_response: 'Incident Response',
  policy: 'Policy',
  training: 'Training',
  physical_security: 'Physical Security',
  other: 'Other'
};

const CONTROL_TYPE_COLORS: Record<GrcImplementedControlType, string> = {
  technical: '#2563eb',
  administrative: '#7c3aed',
  physical: '#ca8a04',
  operational: '#059669'
};

const STATUS_COLORS: Record<GrcImplementedControlStatus, string> = {
  active: '#16a34a',
  planned: '#ca8a04',
  under_review: '#3b82f6',
  deprecated: '#94a3b8',
  inactive: '#ef4444'
};

const AUTOMATION_COLORS: Record<GrcImplementedControlAutomation, string> = {
  manual: '#94a3b8',
  semi_automated: '#f59e0b',
  fully_automated: '#16a34a'
};

const CATEGORY_COLORS: Record<GrcImplementedControlCategory, string> = {
  access_control: '#2563eb',
  encryption: '#7c3aed',
  monitoring: '#059669',
  network_security: '#ea580c',
  endpoint_protection: '#dc2626',
  identity_management: '#8b5cf6',
  logging: '#0891b2',
  backup_recovery: '#65a30d',
  incident_response: '#e11d48',
  policy: '#6366f1',
  training: '#d97706',
  physical_security: '#78716c',
  other: '#94a3b8'
};

const AUDIT_RESULT_LABELS: Record<GrcControlAuditResult, string> = {
  pass: 'Pass', fail: 'Fail', partial: 'Partial', pending: 'Pending'
};
const AUDIT_RESULT_COLORS: Record<GrcControlAuditResult, string> = {
  pass: '#16a34a', fail: '#dc2626', partial: '#ca8a04', pending: '#94a3b8'
};

const COLUMNS: ColumnDef[] = [
  { id: 'title', label: 'Title', defaultVisible: true, removable: false },
  { id: 'controlType', label: 'Type', defaultVisible: true, removable: true },
  { id: 'category', label: 'Category', defaultVisible: true, removable: true },
  { id: 'status', label: 'Status', defaultVisible: true, removable: true },
  { id: 'automation', label: 'Automation', defaultVisible: true, removable: true },
  { id: 'owner', label: 'Owner', defaultVisible: true, removable: true },
  { id: 'vendorProduct', label: 'Vendor/Product', defaultVisible: true, removable: true },
  { id: 'soaLinks', label: 'SoA Links', defaultVisible: true, removable: true },
  { id: 'linkedRisks', label: 'Risks', defaultVisible: true, removable: true },
  { id: 'actions', label: '', defaultVisible: true, removable: false }
];

const SORTABLE = new Set(['title', 'controlType', 'category', 'status', 'automation', 'owner', 'vendorProduct', 'soaLinks', 'linkedRisks']);

type SortDir = 'asc' | 'desc';

const GrcImplementedControlsTab: React.FC<GrcTabProps> = ({
  workspace,
  applyWorkspace,
  setStatusMessage,
  onSwitchTab,
  focusRequest,
  getTabViewState,
  setTabViewState
}) => {
  const controls = useMemo(() => workspace.implementedControls || [], [workspace.implementedControls]);
  const assets = useMemo(() => workspace.assets || [], [workspace.assets]);
  const risks = useMemo(() => workspace.risks || [], [workspace.risks]);
  const assessments = useMemo(() => workspace.assessments || [], [workspace.assessments]);
  const soaEntries = useMemo(() => workspace.soaEntries || [], [workspace.soaEntries]);
  const controlSets = useMemo(() => workspace.controlSets || [], [workspace.controlSets]);

  const persistedView = getTabViewState?.('controls' as any, {
    expandedId: null
  }) ?? {
    expandedId: null
  };

  const columnConfig = useTableColumnConfig('implemented-controls-table', COLUMNS, workspace, applyWorkspace);

  const [sortCol, setSortCol] = useState<string>('title');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [typeFilter, setTypeFilter] = useState<GrcImplementedControlType | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<GrcImplementedControlStatus | 'all'>('all');
  const [categoryFilter, setCategoryFilter] = useState<GrcImplementedControlCategory | 'all'>('all');
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>((persistedView.expandedId as string | null) ?? null);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => {
    if (focusRequest && focusRequest.tab === ('controls' as any) && focusRequest.entityId) {
      const id = focusRequest.entityId;
      if (controls.some(c => c.id === id)) {
        setExpandedId(id);
        setHighlightId(id);
        setTimeout(() => {
          document.getElementById(`grc-ic-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 100);
        setTimeout(() => setHighlightId(null), 2000);
      }
    }
  }, [focusRequest, controls]);

  useEffect(() => {
    setTabViewState?.('controls' as any, {
      expandedId
    });
  }, [expandedId, setTabViewState]);

  const [newTitle, setNewTitle] = useState('');
  const [newType, setNewType] = useState<GrcImplementedControlType>('technical');
  const [newCategory, setNewCategory] = useState<GrcImplementedControlCategory>('access_control');
  const [newStatus, setNewStatus] = useState<GrcImplementedControlStatus>('planned');
  const [newAutomation, setNewAutomation] = useState<GrcImplementedControlAutomation>('manual');
  const [newOwner, setNewOwner] = useState('');

  const filtered = useMemo(() => {
    let result = controls;
    if (typeFilter !== 'all') result = result.filter(c => c.controlType === typeFilter);
    if (statusFilter !== 'all') result = result.filter(c => c.status === statusFilter);
    if (categoryFilter !== 'all') result = result.filter(c => c.category === categoryFilter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter(c =>
        c.title.toLowerCase().includes(q) ||
        c.description.toLowerCase().includes(q) ||
        c.owner.toLowerCase().includes(q) ||
        c.vendor.toLowerCase().includes(q) ||
        c.product.toLowerCase().includes(q) ||
        c.notes.toLowerCase().includes(q)
      );
    }
    return result;
  }, [controls, typeFilter, statusFilter, categoryFilter, search]);

  const sorted = useMemo(() => {
    const list = [...filtered];
    const dir = sortDir === 'asc' ? 1 : -1;
    list.sort((a, b) => {
      let cmp = 0;
      switch (sortCol) {
        case 'title': cmp = a.title.localeCompare(b.title); break;
        case 'controlType': cmp = a.controlType.localeCompare(b.controlType); break;
        case 'category': cmp = a.category.localeCompare(b.category); break;
        case 'status': cmp = a.status.localeCompare(b.status); break;
        case 'automation': cmp = a.automationLevel.localeCompare(b.automationLevel); break;
        case 'owner': cmp = a.owner.localeCompare(b.owner); break;
        case 'vendorProduct': cmp = `${a.vendor} ${a.product}`.localeCompare(`${b.vendor} ${b.product}`); break;
        case 'soaLinks': cmp = a.linkedSoaEntryIds.length - b.linkedSoaEntryIds.length; break;
        case 'linkedRisks': cmp = a.linkedRiskIds.length - b.linkedRiskIds.length; break;
        default: cmp = a.title.localeCompare(b.title);
      }
      return cmp * dir;
    });
    return list;
  }, [filtered, sortCol, sortDir]);

  const handleSort = useCallback((col: string) => {
    setSortDir(prev => sortCol === col ? (prev === 'asc' ? 'desc' : 'asc') : 'asc');
    setSortCol(col);
  }, [sortCol]);

  const updateControl = useCallback((id: string, patch: Partial<GrcImplementedControl>) => {
    const now = new Date().toISOString();
    applyWorkspace({
      ...workspace,
      implementedControls: controls.map(c => c.id === id ? { ...c, ...patch, updatedAt: now } : c)
    });
  }, [applyWorkspace, workspace, controls]);

  const handleAdd = useCallback(() => {
    const title = newTitle.trim();
    if (!title) { setStatusMessage({ severity: 'warning', text: 'Control title is required.' }); return; }
    const now = new Date().toISOString();
    const ic: GrcImplementedControl = {
      id: createId('ic'), title, description: '', controlType: newType,
      category: newCategory, status: newStatus, automationLevel: newAutomation,
      owner: newOwner.trim(), vendor: '', product: '', version: '',
      implementedDate: '', lastReviewDate: '', nextReviewDate: '',
      linkedSoaEntryIds: [], linkedRiskIds: [], linkedAssetIds: [], linkedAssessmentIds: [],
      notes: '', createdAt: now, updatedAt: now
    };
    applyWorkspace({ ...workspace, implementedControls: [...controls, ic] });
    setNewTitle(''); setNewOwner('');
    setNewType('technical'); setNewCategory('access_control');
    setNewStatus('planned'); setNewAutomation('manual');
    setShowForm(false);
    setStatusMessage({ severity: 'success', text: `Added implemented control "${title}".` });
  }, [applyWorkspace, workspace, controls, newTitle, newType, newCategory, newStatus, newAutomation, newOwner, setStatusMessage]);

  const handleDelete = useCallback((id: string) => {
    const ic = controls.find(c => c.id === id);
    const updatedInitiatives = (workspace.securityInitiatives || []).map(si => {
      if (si.linkedImplementedControlIds?.includes(id)) {
        return { ...si, linkedImplementedControlIds: si.linkedImplementedControlIds.filter(cid => cid !== id) };
      }
      return si;
    });
    applyWorkspace({
      ...workspace,
      implementedControls: controls.filter(c => c.id !== id),
      securityInitiatives: updatedInitiatives
    });
    setDeleteId(null);
    if (ic) setStatusMessage({ severity: 'success', text: `Deleted implemented control "${ic.title}".` });
  }, [applyWorkspace, workspace, controls, setStatusMessage]);

  const toDelete = deleteId ? controls.find(c => c.id === deleteId) : null;

  const soaOptionLabel = useCallback((entryId: string) => {
    const entry = soaEntries.find(e => e.id === entryId);
    if (!entry) return entryId;
    const csName = controlSets.find(cs => cs.id === entry.controlSetId)?.name || entry.controlSetId;
    return `${csName} :: ${entry.controlId}`;
  }, [soaEntries, controlSets]);

  const renderCell = useCallback((colId: string, ic: GrcImplementedControl) => {
    switch (colId) {
      case 'title':
        return (
          <TextField size="small" value={ic.title} variant="standard"
            sx={{ minWidth: 140 }}
            InputProps={{ disableUnderline: true, sx: { fontWeight: 600, fontSize: '0.875rem' } }}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
              if (e.target.value.trim()) updateControl(ic.id, { title: e.target.value });
            }} />
        );
      case 'controlType': {
        const color = CONTROL_TYPE_COLORS[ic.controlType];
        return (
          <Box component="span" sx={{
            px: 1, py: 0.25, borderRadius: 1, fontSize: '0.75rem', fontWeight: 600,
            bgcolor: color + '22', color, border: `1px solid ${color}44`
          }}>
            {controlTypeLabels[ic.controlType]}
          </Box>
        );
      }
      case 'category': {
        const color = CATEGORY_COLORS[ic.category];
        return (
          <Box component="span" sx={{
            px: 1, py: 0.25, borderRadius: 1, fontSize: '0.75rem', fontWeight: 600,
            bgcolor: color + '22', color, border: `1px solid ${color}44`
          }}>
            {categoryLabels[ic.category]}
          </Box>
        );
      }
      case 'status': {
        const color = STATUS_COLORS[ic.status];
        return (
          <Box component="span" sx={{
            px: 1, py: 0.25, borderRadius: 1, fontSize: '0.75rem', fontWeight: 600,
            bgcolor: color + '22', color
          }}>
            {statusLabels[ic.status]}
          </Box>
        );
      }
      case 'automation': {
        const color = AUTOMATION_COLORS[ic.automationLevel];
        return (
          <Box component="span" sx={{
            px: 1, py: 0.25, borderRadius: 1, fontSize: '0.75rem', fontWeight: 600,
            bgcolor: color + '22', color
          }}>
            {automationLabels[ic.automationLevel]}
          </Box>
        );
      }
      case 'owner':
        return ic.owner
          ? <Typography variant="body2" sx={{ fontSize: '0.85rem' }}>{ic.owner}</Typography>
          : <Typography variant="caption" color="text.disabled">—</Typography>;
      case 'vendorProduct': {
        const text = [ic.vendor, ic.product].filter(Boolean).join(' / ');
        return text
          ? <Typography variant="body2" sx={{ fontSize: '0.85rem' }}>{text}</Typography>
          : <Typography variant="caption" color="text.disabled">—</Typography>;
      }
      case 'soaLinks': {
        const count = ic.linkedSoaEntryIds.length;
        return count > 0
          ? <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.25 }}>
              {ic.linkedSoaEntryIds.map(id => (
                <Chip key={id} size="small" label={soaOptionLabel(id)} variant="outlined"
                  onClick={(e) => { e.stopPropagation(); onSwitchTab?.('compliance', id); }}
                  sx={{ cursor: 'pointer' }} />
              ))}
            </Box>
          : <Typography variant="caption" color="text.disabled">—</Typography>;
      }
      case 'linkedRisks': {
        const count = ic.linkedRiskIds.length;
        return count > 0
          ? <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.25 }}>
              {ic.linkedRiskIds.map(id => {
                const r = risks.find(x => x.id === id);
                return (
                  <Chip key={id} size="small" label={r?.title || id} variant="outlined"
                    onClick={(e) => { e.stopPropagation(); onSwitchTab?.('risks', id); }}
                    sx={{ cursor: 'pointer' }} />
                );
              })}
            </Box>
          : <Typography variant="caption" color="text.disabled">0</Typography>;
      }
      case 'actions':
        return (
          <Tooltip title="Delete this control" arrow>
            <IconButton size="small" onClick={(e) => { e.stopPropagation(); setDeleteId(ic.id); }}>
              <Trash2 size={16} />
            </IconButton>
          </Tooltip>
        );
      default: return null;
    }
  }, [updateControl, risks, soaOptionLabel, onSwitchTab]);

  const renderExpanded = useCallback((ic: GrcImplementedControl) => (
    <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 2, bgcolor: 'action.hover' }}>
      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
        <Box sx={{ flex: 3, minWidth: 300 }}>
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, mb: 0.5, display: 'block' }}>Description</Typography>
          <TextField size="small" fullWidth multiline minRows={6} maxRows={12}
            value={ic.description} placeholder="Detailed description of this implemented control"
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateControl(ic.id, { description: e.target.value })} />
        </Box>
        <Box sx={{ flex: 2, minWidth: 300, display: 'grid', gap: 2, gridTemplateColumns: '1fr 1fr', alignContent: 'start' }}>
      <Box>
        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, mb: 0.5, display: 'block' }}>Control Type</Typography>
        <TextField size="small" fullWidth select value={ic.controlType}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateControl(ic.id, { controlType: e.target.value as GrcImplementedControlType })}>
          {(Object.keys(controlTypeLabels) as GrcImplementedControlType[]).map(k => <MenuItem key={k} value={k}>{controlTypeLabels[k]}</MenuItem>)}
        </TextField>
      </Box>
      <Box>
        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, mb: 0.5, display: 'block' }}>Category</Typography>
        <TextField size="small" fullWidth select value={ic.category}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateControl(ic.id, { category: e.target.value as GrcImplementedControlCategory })}>
          {(Object.keys(categoryLabels) as GrcImplementedControlCategory[]).map(k => <MenuItem key={k} value={k}>{categoryLabels[k]}</MenuItem>)}
        </TextField>
      </Box>
      <Box>
        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, mb: 0.5, display: 'block' }}>Status</Typography>
        <TextField size="small" fullWidth select value={ic.status}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateControl(ic.id, { status: e.target.value as GrcImplementedControlStatus })}>
          {(Object.keys(statusLabels) as GrcImplementedControlStatus[]).map(k => <MenuItem key={k} value={k}>{statusLabels[k]}</MenuItem>)}
        </TextField>
      </Box>
      <Box>
        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, mb: 0.5, display: 'block' }}>Automation Level</Typography>
        <TextField size="small" fullWidth select value={ic.automationLevel}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateControl(ic.id, { automationLevel: e.target.value as GrcImplementedControlAutomation })}>
          {(Object.keys(automationLabels) as GrcImplementedControlAutomation[]).map(k => <MenuItem key={k} value={k}>{automationLabels[k]}</MenuItem>)}
        </TextField>
      </Box>
      <Box>
        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, mb: 0.5, display: 'block' }}>Owner</Typography>
        <TextField size="small" fullWidth value={ic.owner}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateControl(ic.id, { owner: e.target.value })} />
      </Box>
      <Box>
        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, mb: 0.5, display: 'block' }}>Vendor</Typography>
        <TextField size="small" fullWidth value={ic.vendor}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateControl(ic.id, { vendor: e.target.value })} />
      </Box>
      <Box>
        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, mb: 0.5, display: 'block' }}>Product</Typography>
        <TextField size="small" fullWidth value={ic.product}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateControl(ic.id, { product: e.target.value })} />
      </Box>
      <Box>
        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, mb: 0.5, display: 'block' }}>Version</Typography>
        <TextField size="small" fullWidth value={ic.version}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateControl(ic.id, { version: e.target.value })} />
      </Box>
      <Box>
        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, mb: 0.5, display: 'block' }}>Implemented Date</Typography>
        <TextField size="small" fullWidth type="date" value={ic.implementedDate}
          InputLabelProps={{ shrink: true }}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateControl(ic.id, { implementedDate: e.target.value })} />
      </Box>
      <Box>
        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, mb: 0.5, display: 'block' }}>Last Review Date</Typography>
        <TextField size="small" fullWidth type="date" value={ic.lastReviewDate}
          InputLabelProps={{ shrink: true }}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateControl(ic.id, { lastReviewDate: e.target.value })} />
      </Box>
      <Box>
        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, mb: 0.5, display: 'block' }}>Next Review Date</Typography>
        <TextField size="small" fullWidth type="date" value={ic.nextReviewDate}
          InputLabelProps={{ shrink: true }}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateControl(ic.id, { nextReviewDate: e.target.value })} />
      </Box>
      <Box>
        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, mb: 0.5, display: 'block' }}>Linked SoA Entries</Typography>
        <FormControl size="small" fullWidth>
          <InputLabel>SoA Entries</InputLabel>
          <Select multiple value={ic.linkedSoaEntryIds}
            onChange={e => updateControl(ic.id, { linkedSoaEntryIds: typeof e.target.value === 'string' ? e.target.value.split(',') : e.target.value as string[] })}
            input={<OutlinedInput label="SoA Entries" />}
            renderValue={sel => (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.25 }}>
                {(sel as string[]).map(id => (
                  <Chip key={id} size="small" label={soaOptionLabel(id)} variant="outlined"
                    onClick={(e) => { e.stopPropagation(); onSwitchTab?.('compliance', id); }}
                    sx={{ cursor: 'pointer' }} />
                ))}
              </Box>
            )}>
            {soaEntries.map(entry => (
              <MenuItem key={entry.id} value={entry.id}>{soaOptionLabel(entry.id)}</MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>
      <Box>
        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, mb: 0.5, display: 'block' }}>Linked Risks</Typography>
        <FormControl size="small" fullWidth>
          <InputLabel>Risks</InputLabel>
          <Select multiple value={ic.linkedRiskIds}
            onChange={e => updateControl(ic.id, { linkedRiskIds: typeof e.target.value === 'string' ? e.target.value.split(',') : e.target.value as string[] })}
            input={<OutlinedInput label="Risks" />}
            renderValue={sel => (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.25 }}>
                {(sel as string[]).map(id => (
                  <Chip key={id} size="small" label={risks.find(r => r.id === id)?.title || id} variant="outlined"
                    onClick={(e) => { e.stopPropagation(); onSwitchTab?.('risks', id); }}
                    sx={{ cursor: 'pointer' }} />
                ))}
              </Box>
            )}>
            {risks.map(r => <MenuItem key={r.id} value={r.id}>{r.title}</MenuItem>)}
          </Select>
        </FormControl>
      </Box>
      <Box>
        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, mb: 0.5, display: 'block' }}>Linked Assets</Typography>
        <FormControl size="small" fullWidth>
          <InputLabel>Assets</InputLabel>
          <Select multiple value={ic.linkedAssetIds}
            onChange={e => updateControl(ic.id, { linkedAssetIds: typeof e.target.value === 'string' ? e.target.value.split(',') : e.target.value as string[] })}
            input={<OutlinedInput label="Assets" />}
            renderValue={sel => (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.25 }}>
                {(sel as string[]).map(id => (
                  <Chip key={id} size="small" label={assets.find(a => a.id === id)?.name || id} variant="outlined"
                    onClick={(e) => { e.stopPropagation(); onSwitchTab?.('assets', id); }}
                    sx={{ cursor: 'pointer' }} />
                ))}
              </Box>
            )}>
            {assets.map(a => <MenuItem key={a.id} value={a.id}>{a.name}</MenuItem>)}
          </Select>
        </FormControl>
      </Box>
      <Box>
        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, mb: 0.5, display: 'block' }}>Linked Assessments</Typography>
        <FormControl size="small" fullWidth>
          <InputLabel>Assessments</InputLabel>
          <Select multiple value={ic.linkedAssessmentIds || []}
            onChange={e => updateControl(ic.id, { linkedAssessmentIds: typeof e.target.value === 'string' ? e.target.value.split(',') : e.target.value as string[] })}
            input={<OutlinedInput label="Assessments" />}
            renderValue={sel => (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.25 }}>
                {(sel as string[]).map(id => (
                  <Chip key={id} size="small" label={assessments.find(a => a.id === id)?.title || id} variant="outlined"
                    onClick={(e) => { e.stopPropagation(); onSwitchTab?.('assessments', id); }}
                    sx={{ cursor: 'pointer' }} />
                ))}
              </Box>
            )}>
            {assessments.map(a => <MenuItem key={a.id} value={a.id}>{a.title}</MenuItem>)}
          </Select>
        </FormControl>
      </Box>
        </Box>
      </Box>
      <Box>
        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, mb: 0.5, display: 'block' }}>Satisfies Requirements</Typography>
        {ic.linkedSoaEntryIds.length > 0 ? (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
            {ic.linkedSoaEntryIds.map(entryId => {
              const entry = soaEntries.find(e => e.id === entryId);
              if (!entry) return <Chip key={entryId} size="small" label={entryId} variant="outlined" />;
              const csName = controlSets.find(cs => cs.id === entry.controlSetId)?.name || entry.controlSetId;
              return (
                <Chip key={entryId} size="small"
                  label={`${csName}: ${entry.controlId}`}
                  variant="outlined"
                  onClick={(e) => { e.stopPropagation(); onSwitchTab?.('compliance', entryId); }}
                  sx={{ cursor: 'pointer', fontSize: '0.75rem' }} />
              );
            })}
          </Box>
        ) : (
          <Typography variant="body2" color="text.disabled">No linked requirements</Typography>
        )}
      </Box>
      <Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>Audit History</Typography>
          <Button size="small" startIcon={<Plus size={14} />} onClick={() => {
            const now = new Date().toISOString();
            const audit: GrcControlAudit = {
              id: createId('aud'),
              plannedDate: now.slice(0, 10),
              actualDate: '',
              auditor: '',
              result: 'pending',
              evidenceRefs: [],
              notes: '',
              createdAt: now
            };
            updateControl(ic.id, { auditHistory: [...(ic.auditHistory || []), audit] });
          }}>
            Add Audit Record
          </Button>
        </Box>
        {(ic.auditHistory || []).length > 0 ? (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem' }}>Planned Date</TableCell>
                <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem' }}>Actual Date</TableCell>
                <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem' }}>Auditor</TableCell>
                <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem' }}>Result</TableCell>
                <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem' }}>Evidence Refs</TableCell>
                <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem' }}>Notes</TableCell>
                <TableCell sx={{ width: 40 }} />
              </TableRow>
            </TableHead>
            <TableBody>
              {(ic.auditHistory || []).map(audit => {
                const resultColor = AUDIT_RESULT_COLORS[audit.result];
                return (
                <TableRow key={audit.id}>
                  <TableCell sx={{ width: 130 }}>
                    <TextField size="small" type="date" value={audit.plannedDate} variant="standard"
                      InputProps={{ disableUnderline: true, sx: { fontSize: '0.8rem' } }}
                      onChange={e => {
                        const updated = (ic.auditHistory || []).map(a => a.id === audit.id ? { ...a, plannedDate: e.target.value } : a);
                        updateControl(ic.id, { auditHistory: updated });
                      }} />
                  </TableCell>
                  <TableCell sx={{ width: 130 }}>
                    <TextField size="small" type="date" value={audit.actualDate} variant="standard"
                      InputProps={{ disableUnderline: true, sx: { fontSize: '0.8rem' } }}
                      onChange={e => {
                        const updated = (ic.auditHistory || []).map(a => a.id === audit.id ? { ...a, actualDate: e.target.value } : a);
                        updateControl(ic.id, { auditHistory: updated });
                      }} />
                  </TableCell>
                  <TableCell sx={{ width: 120 }}>
                    <TextField size="small" value={audit.auditor} variant="standard"
                      InputProps={{ disableUnderline: true, sx: { fontSize: '0.8rem' } }}
                      placeholder="Auditor"
                      onChange={e => {
                        const updated = (ic.auditHistory || []).map(a => a.id === audit.id ? { ...a, auditor: e.target.value } : a);
                        updateControl(ic.id, { auditHistory: updated });
                      }} />
                  </TableCell>
                  <TableCell sx={{ width: 120 }}>
                    <TextField size="small" select value={audit.result} variant="standard"
                      InputProps={{ sx: { fontSize: '0.8rem' } }}
                      onChange={e => {
                        const updated = (ic.auditHistory || []).map(a => a.id === audit.id ? { ...a, result: e.target.value as GrcControlAuditResult } : a);
                        updateControl(ic.id, { auditHistory: updated });
                      }}>
                      {(Object.keys(AUDIT_RESULT_LABELS) as GrcControlAuditResult[]).map(k => (
                        <MenuItem key={k} value={k}>
                          <Chip size="small" label={AUDIT_RESULT_LABELS[k]}
                            sx={{ bgcolor: AUDIT_RESULT_COLORS[k] + '22', color: AUDIT_RESULT_COLORS[k], fontWeight: 600, fontSize: '0.7rem', height: 20 }} />
                        </MenuItem>
                      ))}
                    </TextField>
                  </TableCell>
                  <TableCell sx={{ width: 100 }}>
                    <Typography variant="caption" color="text.secondary">
                      {(audit.evidenceRefs || []).length > 0
                        ? (audit.evidenceRefs || []).join(', ')
                        : '-'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <TextField size="small" fullWidth value={audit.notes} variant="standard"
                      InputProps={{ disableUnderline: true, sx: { fontSize: '0.8rem' } }}
                      placeholder="Audit notes"
                      onChange={e => {
                        const updated = (ic.auditHistory || []).map(a => a.id === audit.id ? { ...a, notes: e.target.value } : a);
                        updateControl(ic.id, { auditHistory: updated });
                      }} />
                  </TableCell>
                  <TableCell>
                    <IconButton size="small" onClick={() => {
                      const updated = (ic.auditHistory || []).filter(a => a.id !== audit.id);
                      updateControl(ic.id, { auditHistory: updated });
                    }}>
                      <Trash2 size={14} />
                    </IconButton>
                  </TableCell>
                </TableRow>
                );
              })}
            </TableBody>
          </Table>
        ) : (
          <Typography variant="body2" color="text.secondary" sx={{ py: 0.5 }}>
            No audit records yet.
          </Typography>
        )}
      </Box>
      <Box>
        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, mb: 0.5, display: 'block' }}>Notes</Typography>
        <TextField size="small" fullWidth multiline minRows={2} maxRows={6}
          value={ic.notes} placeholder="Internal notes"
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateControl(ic.id, { notes: e.target.value })} />
      </Box>
    </Box>
  ), [updateControl, assets, risks, assessments, soaEntries, controlSets, soaOptionLabel, onSwitchTab]);

  if (controls.length === 0 && !showForm) {
    return (
      <Box sx={{ display: 'grid', gap: 2 }}>
        <Paper sx={{ ...cardSx, textAlign: 'center', py: 6 }}>
          <SecurityOutlined sx={{ fontSize: 40, opacity: 0.3, mb: 1 }} />
          <Typography variant="h6" sx={{ mb: 1 }}>No implemented controls registered yet</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 520, mx: 'auto', mb: 1, lineHeight: 1.8 }}>
            Track the security controls deployed across your environment. Link them to SoA entries,
            risks, and assets to maintain a comprehensive view of your control landscape.
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 520, mx: 'auto', mb: 3, lineHeight: 1.8 }}>
            Each control can carry type classification, automation level, vendor details,
            review scheduling, and linkage to your compliance and risk management workflows.
          </Typography>
          <Button variant="contained" startIcon={<Plus size={16} />} onClick={() => setShowForm(true)}>
            Add First Control
          </Button>
        </Paper>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'grid', gap: 2 }}>
      <Paper sx={cardSx}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
          <Box>
            <Typography variant="h6" sx={{ mb: 0.5 }}>Implemented Controls</Typography>
            <Typography variant="body2" color="text.secondary">
              Security controls deployed across your environment with vendor, automation, and compliance linkage.
            </Typography>
          </Box>
          <Button variant="contained" startIcon={<Plus size={16} />} size="small"
            onClick={() => setShowForm(!showForm)}>
            Add Control
          </Button>
        </Box>

        <Collapse in={showForm} timeout="auto" unmountOnExit>
          <Box sx={{ mt: 2, p: 2, bgcolor: 'action.hover', borderRadius: 1, display: 'grid', gap: 1.5 }}>
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 1.5 }}>
              <TextField size="small" label="Title" value={newTitle}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewTitle(e.target.value)} />
              <TextField size="small" select label="Type" value={newType}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewType(e.target.value as GrcImplementedControlType)}>
                {(Object.keys(controlTypeLabels) as GrcImplementedControlType[]).map(k => <MenuItem key={k} value={k}>{controlTypeLabels[k]}</MenuItem>)}
              </TextField>
              <TextField size="small" select label="Category" value={newCategory}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewCategory(e.target.value as GrcImplementedControlCategory)}>
                {(Object.keys(categoryLabels) as GrcImplementedControlCategory[]).map(k => <MenuItem key={k} value={k}>{categoryLabels[k]}</MenuItem>)}
              </TextField>
              <TextField size="small" select label="Status" value={newStatus}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewStatus(e.target.value as GrcImplementedControlStatus)}>
                {(Object.keys(statusLabels) as GrcImplementedControlStatus[]).map(k => <MenuItem key={k} value={k}>{statusLabels[k]}</MenuItem>)}
              </TextField>
              <TextField size="small" select label="Automation" value={newAutomation}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewAutomation(e.target.value as GrcImplementedControlAutomation)}>
                {(Object.keys(automationLabels) as GrcImplementedControlAutomation[]).map(k => <MenuItem key={k} value={k}>{automationLabels[k]}</MenuItem>)}
              </TextField>
              <TextField size="small" label="Owner" value={newOwner}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewOwner(e.target.value)} />
            </Box>
            <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
              <Button size="small" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button variant="contained" size="small" startIcon={<Plus size={16} />} onClick={handleAdd}
                disabled={!newTitle.trim()}>Add Control</Button>
            </Box>
          </Box>
        </Collapse>
      </Paper>

      {controls.length > 0 && (
        <TableContainer component={Paper} sx={cardSx}>
          <Box sx={{ p: 1.5, borderBottom: '1px solid', borderColor: 'divider', display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center' }}>
            <TextField size="small" placeholder="Search controls..." value={search}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)} sx={{ minWidth: 180 }} />
            <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
              <Typography variant="caption" color="text.secondary" sx={{ mr: 0.5 }}>Type:</Typography>
              <Chip size="small" label="All"
                variant={typeFilter === 'all' ? 'filled' : 'outlined'}
                color={typeFilter === 'all' ? 'primary' : 'default'}
                onClick={() => setTypeFilter('all')} />
              {(Object.keys(controlTypeLabels) as GrcImplementedControlType[]).map(k => (
                <Chip key={k} size="small" label={controlTypeLabels[k]}
                  variant={typeFilter === k ? 'filled' : 'outlined'}
                  color={typeFilter === k ? 'primary' : 'default'}
                  onClick={() => setTypeFilter(k)} />
              ))}
            </Box>
            <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
              <Typography variant="caption" color="text.secondary" sx={{ mr: 0.5 }}>Status:</Typography>
              <Chip size="small" label="All"
                variant={statusFilter === 'all' ? 'filled' : 'outlined'}
                color={statusFilter === 'all' ? 'primary' : 'default'}
                onClick={() => setStatusFilter('all')} />
              {(Object.keys(statusLabels) as GrcImplementedControlStatus[]).map(k => (
                <Chip key={k} size="small" label={statusLabels[k]}
                  variant={statusFilter === k ? 'filled' : 'outlined'}
                  color={statusFilter === k ? 'primary' : 'default'}
                  onClick={() => setStatusFilter(k)} />
              ))}
            </Box>
            <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
              <Typography variant="caption" color="text.secondary" sx={{ mr: 0.5 }}>Category:</Typography>
              <Chip size="small" label="All"
                variant={categoryFilter === 'all' ? 'filled' : 'outlined'}
                color={categoryFilter === 'all' ? 'primary' : 'default'}
                onClick={() => setCategoryFilter('all')} />
              {(Object.keys(categoryLabels) as GrcImplementedControlCategory[]).map(k => (
                <Chip key={k} size="small" label={categoryLabels[k]}
                  variant={categoryFilter === k ? 'filled' : 'outlined'}
                  color={categoryFilter === k ? 'primary' : 'default'}
                  onClick={() => setCategoryFilter(k)} />
              ))}
            </Box>
            <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto' }}>
              {sorted.length} of {controls.length} controls
            </Typography>
          </Box>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell padding="checkbox" sx={{ width: 40 }}><Box sx={{ width: 28 }} /></TableCell>
                {columnConfig.visibleColumns.map(col => (
                  <TableCell key={col.id}>
                    {SORTABLE.has(col.id) ? (
                      <TableSortLabel active={sortCol === col.id}
                        direction={sortCol === col.id ? sortDir : 'asc'}
                        onClick={() => handleSort(col.id)}>
                        {col.label}
                      </TableSortLabel>
                    ) : col.label}
                  </TableCell>
                ))}
                <TableCell padding="none" sx={{ width: 40 }}>
                  <TableColumnConfigPopover
                    allColumns={columnConfig.allColumns}
                    visibleIds={columnConfig.visibleIds}
                    onToggle={columnConfig.toggleColumn}
                    onMove={columnConfig.moveColumn}
                    onReset={columnConfig.resetToDefaults} />
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {sorted.map(ic => {
                const isExpanded = expandedId === ic.id;
                return (
                  <React.Fragment key={ic.id}>
                    <TableRow id={`grc-ic-${ic.id}`} hover sx={{
                      cursor: 'pointer', '& > *': { borderBottom: isExpanded ? 'none' : undefined },
                      ...(highlightId === ic.id && { bgcolor: 'action.selected', transition: 'background-color 0.3s' })
                    }}
                      onClick={() => setExpandedId(isExpanded ? null : ic.id)}>
                      <TableCell padding="checkbox">
                        <IconButton size="small" sx={{ p: 0.25 }}>
                          {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                        </IconButton>
                      </TableCell>
                      {columnConfig.visibleColumns.map(col => (
                        <TableCell key={col.id} onClick={e => {
                          if (col.id === 'title') e.stopPropagation();
                        }}>
                          {renderCell(col.id, ic)}
                        </TableCell>
                      ))}
                      <TableCell padding="none" />
                    </TableRow>
                    {isExpanded && (
                      <TableRow>
                        <TableCell colSpan={columnConfig.visibleColumns.length + 2} sx={{ py: 0, px: 0 }}>
                          <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                            {renderExpanded(ic)}
                          </Collapse>
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                );
              })}
              {sorted.length === 0 && controls.length > 0 && (
                <TableRow>
                  <TableCell colSpan={columnConfig.visibleColumns.length + 2}>
                    <Typography variant="body2" color="text.secondary" sx={{ py: 1 }}>
                      No controls match the current filters.
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Dialog open={Boolean(toDelete)} onClose={() => setDeleteId(null)}>
        <DialogTitle>Delete Implemented Control</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Delete "{toDelete?.title}"? This will remove the control record and unlink it from any security initiatives.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteId(null)}>Cancel</Button>
          <Button variant="contained" color="error" onClick={() => deleteId && handleDelete(deleteId)}>Delete</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default GrcImplementedControlsTab;
