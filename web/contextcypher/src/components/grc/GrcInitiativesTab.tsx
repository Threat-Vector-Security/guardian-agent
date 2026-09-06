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
  LinearProgress,
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
import { ChevronDown, ChevronRight, Plus, Trash2 } from 'lucide-react';
import RocketLaunchOutlined from '@mui/icons-material/RocketLaunchOutlined';
import {
  GrcSecurityInitiative,
  GrcInitiativeCategory,
  GrcInitiativeStatus,
  GrcInitiativePriority,
  GrcMilestoneStatus,
  GrcInitiativeMilestone
} from '../../types/GrcTypes';
import { GrcTabProps, cardSx, createId } from './grcShared';
import { useTableColumnConfig, ColumnDef } from './useTableColumnConfig';
import TableColumnConfigPopover from './TableColumnConfigPopover';

const categoryLabels: Record<GrcInitiativeCategory, string> = {
  uplift: 'Uplift',
  remediation: 'Remediation',
  compliance: 'Compliance',
  transformation: 'Transformation',
  hardening: 'Hardening',
  other: 'Other'
};

const statusLabels: Record<GrcInitiativeStatus, string> = {
  proposed: 'Proposed',
  approved: 'Approved',
  in_progress: 'In Progress',
  on_hold: 'On Hold',
  completed: 'Completed',
  cancelled: 'Cancelled'
};

const priorityLabels: Record<GrcInitiativePriority, string> = {
  critical: 'Critical',
  high: 'High',
  medium: 'Medium',
  low: 'Low'
};

const milestoneStatusLabels: Record<GrcMilestoneStatus, string> = {
  pending: 'Pending',
  in_progress: 'In Progress',
  completed: 'Completed',
  skipped: 'Skipped'
};

const CATEGORY_COLORS: Record<GrcInitiativeCategory, string> = {
  uplift: '#2563eb',
  remediation: '#dc2626',
  compliance: '#7c3aed',
  transformation: '#059669',
  hardening: '#ca8a04',
  other: '#6b7280'
};

const STATUS_COLORS: Record<GrcInitiativeStatus, string> = {
  proposed: '#6b7280',
  approved: '#2563eb',
  in_progress: '#059669',
  on_hold: '#ca8a04',
  completed: '#16a34a',
  cancelled: '#94a3b8'
};

const PRIORITY_COLORS: Record<GrcInitiativePriority, string> = {
  critical: '#dc2626',
  high: '#ea580c',
  medium: '#ca8a04',
  low: '#16a34a'
};

const MILESTONE_STATUS_COLORS: Record<GrcMilestoneStatus, string> = {
  pending: '#94a3b8',
  in_progress: '#3b82f6',
  completed: '#16a34a',
  skipped: '#6b7280'
};

const COLUMNS: ColumnDef[] = [
  { id: 'title', label: 'Title', defaultVisible: true, removable: false },
  { id: 'category', label: 'Category', defaultVisible: true, removable: true },
  { id: 'status', label: 'Status', defaultVisible: true, removable: true },
  { id: 'priority', label: 'Priority', defaultVisible: true, removable: true },
  { id: 'owner', label: 'Owner', defaultVisible: true, removable: true },
  { id: 'targetDate', label: 'Target Date', defaultVisible: true, removable: true },
  { id: 'progress', label: 'Progress', defaultVisible: true, removable: true },
  { id: 'linkedRisks', label: 'Risks', defaultVisible: true, removable: true },
  { id: 'actions', label: '', defaultVisible: true, removable: false }
];

const SORTABLE = new Set(['title', 'category', 'status', 'priority', 'owner', 'targetDate', 'progress', 'linkedRisks']);

type SortDir = 'asc' | 'desc';

const priorityOrder: Record<GrcInitiativePriority, number> = {
  critical: 4, high: 3, medium: 2, low: 1
};

const statusOrder: Record<GrcInitiativeStatus, number> = {
  in_progress: 5, approved: 4, proposed: 3, on_hold: 2, completed: 1, cancelled: 0
};

const getProgress = (si: GrcSecurityInitiative): number => {
  if (si.milestones.length === 0) return 0;
  return Math.round((si.milestones.filter(m => m.status === 'completed').length / si.milestones.length) * 100);
};

const GrcInitiativesTab: React.FC<GrcTabProps> = ({
  workspace,
  applyWorkspace,
  setStatusMessage,
  onSwitchTab,
  focusRequest,
  getTabViewState,
  setTabViewState
}) => {
  const initiatives = useMemo(() => workspace.securityInitiatives || [], [workspace.securityInitiatives]);
  const assets = useMemo(() => workspace.assets || [], [workspace.assets]);
  const risks = useMemo(() => workspace.risks || [], [workspace.risks]);
  const controlSets = useMemo(() => workspace.controlSets || [], [workspace.controlSets]);
  const implementedControls = useMemo(() => workspace.implementedControls || [], [workspace.implementedControls]);
  const assessments = useMemo(() => workspace.assessments || [], [workspace.assessments]);
  const persistedView = getTabViewState?.('initiatives', { expandedId: null }) ?? { expandedId: null };

  const columnConfig = useTableColumnConfig('initiatives-table', COLUMNS, workspace, applyWorkspace);

  const [sortCol, setSortCol] = useState<string>('priority');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [categoryFilter, setCategoryFilter] = useState<GrcInitiativeCategory | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<GrcInitiativeStatus | 'all'>('all');
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>((persistedView.expandedId as string | null) ?? null);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => {
    if (focusRequest?.tab === 'initiatives' && focusRequest.entityId) {
      const id = focusRequest.entityId;
      if (initiatives.some(si => si.id === id)) {
        setExpandedId(id);
        setHighlightId(id);
        setTimeout(() => {
          document.getElementById(`grc-si-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 100);
        setTimeout(() => setHighlightId(null), 2000);
      }
    }
  }, [focusRequest, initiatives]);

  useEffect(() => {
    setTabViewState?.('initiatives', { expandedId });
  }, [expandedId, setTabViewState]);

  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState<GrcInitiativeCategory>('uplift');
  const [newPriority, setNewPriority] = useState<GrcInitiativePriority>('medium');
  const [newOwner, setNewOwner] = useState('');

  const filtered = useMemo(() => {
    let result = initiatives;
    if (categoryFilter !== 'all') result = result.filter(si => si.category === categoryFilter);
    if (statusFilter !== 'all') result = result.filter(si => si.status === statusFilter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter(si =>
        si.title.toLowerCase().includes(q) ||
        si.description.toLowerCase().includes(q) ||
        si.owner.toLowerCase().includes(q) ||
        si.currentState.toLowerCase().includes(q) ||
        si.targetState.toLowerCase().includes(q)
      );
    }
    return result;
  }, [initiatives, categoryFilter, statusFilter, search]);

  const sorted = useMemo(() => {
    const list = [...filtered];
    const dir = sortDir === 'asc' ? 1 : -1;
    list.sort((a, b) => {
      let cmp = 0;
      switch (sortCol) {
        case 'title': cmp = a.title.localeCompare(b.title); break;
        case 'category': cmp = a.category.localeCompare(b.category); break;
        case 'status': cmp = statusOrder[a.status] - statusOrder[b.status]; break;
        case 'priority': cmp = priorityOrder[a.priority] - priorityOrder[b.priority]; break;
        case 'owner': cmp = (a.owner || '').localeCompare(b.owner || ''); break;
        case 'targetDate': cmp = (a.targetDate || '').localeCompare(b.targetDate || ''); break;
        case 'progress': cmp = getProgress(a) - getProgress(b); break;
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

  const updateInitiative = useCallback((id: string, patch: Partial<GrcSecurityInitiative>) => {
    applyWorkspace({
      ...workspace,
      securityInitiatives: initiatives.map(si => si.id === id ? { ...si, ...patch, updatedAt: new Date().toISOString() } : si)
    });
  }, [applyWorkspace, workspace, initiatives]);

  const handleAdd = useCallback(() => {
    const title = newTitle.trim();
    if (!title) { setStatusMessage({ severity: 'warning', text: 'Initiative title is required.' }); return; }
    const now = new Date().toISOString();
    const si: GrcSecurityInitiative = {
      id: createId('si'), title, description: '', category: newCategory,
      status: 'proposed', priority: newPriority, owner: newOwner.trim(),
      executiveSponsor: '', currentState: '', targetState: '',
      startDate: '', targetDate: '', completedDate: '',
      milestones: [], linkedRiskIds: [], linkedControlSetIds: [], linkedAssetIds: [], linkedImplementedControlIds: [], linkedAssessmentIds: [],
      notes: '', createdAt: now, updatedAt: now
    };
    applyWorkspace({ ...workspace, securityInitiatives: [...initiatives, si] });
    setNewTitle(''); setNewOwner('');
    setNewCategory('uplift'); setNewPriority('medium');
    setShowForm(false);
    setStatusMessage({ severity: 'success', text: `Added initiative "${title}".` });
  }, [applyWorkspace, workspace, initiatives, newTitle, newCategory, newPriority, newOwner, setStatusMessage]);

  const handleDelete = useCallback((id: string) => {
    const si = initiatives.find(i => i.id === id);
    applyWorkspace({ ...workspace, securityInitiatives: initiatives.filter(i => i.id !== id) });
    setDeleteId(null);
    if (expandedId === id) setExpandedId(null);
    if (si) setStatusMessage({ severity: 'success', text: `Deleted initiative "${si.title}".` });
  }, [applyWorkspace, workspace, initiatives, expandedId, setStatusMessage]);

  const addMilestone = useCallback((siId: string) => {
    const si = initiatives.find(i => i.id === siId);
    if (!si) return;
    const ms: GrcInitiativeMilestone = {
      id: createId('ms'), title: '', description: '', status: 'pending',
      dueDate: '', completedDate: '', owner: ''
    };
    updateInitiative(siId, { milestones: [...si.milestones, ms] });
  }, [initiatives, updateInitiative]);

  const updateMilestone = useCallback((siId: string, msId: string, patch: Partial<GrcInitiativeMilestone>) => {
    const si = initiatives.find(i => i.id === siId);
    if (!si) return;
    updateInitiative(siId, {
      milestones: si.milestones.map(ms => ms.id === msId ? { ...ms, ...patch } : ms)
    });
  }, [initiatives, updateInitiative]);

  const deleteMilestone = useCallback((siId: string, msId: string) => {
    const si = initiatives.find(i => i.id === siId);
    if (!si) return;
    updateInitiative(siId, { milestones: si.milestones.filter(ms => ms.id !== msId) });
  }, [initiatives, updateInitiative]);

  const toDelete = deleteId ? initiatives.find(i => i.id === deleteId) : null;

  const renderCell = useCallback((colId: string, si: GrcSecurityInitiative) => {
    switch (colId) {
      case 'title':
        return (
          <TextField size="small" value={si.title} variant="standard"
            sx={{ minWidth: 160 }}
            InputProps={{ disableUnderline: true, sx: { fontWeight: 600, fontSize: '0.875rem' } }}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
              if (e.target.value.trim()) updateInitiative(si.id, { title: e.target.value });
            }} />
        );
      case 'category': {
        const color = CATEGORY_COLORS[si.category];
        return (
          <Box component="span" sx={{
            px: 1, py: 0.25, borderRadius: 1, fontSize: '0.75rem', fontWeight: 600,
            bgcolor: color + '22', color, border: `1px solid ${color}44`
          }}>
            {categoryLabels[si.category]}
          </Box>
        );
      }
      case 'status': {
        const color = STATUS_COLORS[si.status];
        return (
          <Box component="span" sx={{
            px: 1, py: 0.25, borderRadius: 1, fontSize: '0.75rem', fontWeight: 600,
            bgcolor: color + '22', color
          }}>
            {statusLabels[si.status]}
          </Box>
        );
      }
      case 'priority': {
        const color = PRIORITY_COLORS[si.priority];
        return (
          <Box component="span" sx={{
            px: 1, py: 0.25, borderRadius: 1, fontSize: '0.75rem', fontWeight: 600,
            bgcolor: color + '22', color
          }}>
            {priorityLabels[si.priority]}
          </Box>
        );
      }
      case 'owner':
        return si.owner
          ? <Typography variant="body2" sx={{ fontSize: '0.85rem' }}>{si.owner}</Typography>
          : <Typography variant="caption" color="text.disabled">—</Typography>;
      case 'targetDate':
        return si.targetDate
          ? <Typography variant="body2" sx={{ fontSize: '0.85rem' }}>{si.targetDate}</Typography>
          : <Typography variant="caption" color="text.disabled">—</Typography>;
      case 'progress': {
        const pct = getProgress(si);
        const total = si.milestones.length;
        const completed = si.milestones.filter(m => m.status === 'completed').length;
        return (
          <Tooltip title={total > 0 ? `${completed}/${total} milestones completed` : 'No milestones'} arrow>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 100 }}>
              <LinearProgress variant="determinate" value={pct} sx={{ flex: 1, height: 6, borderRadius: 3 }} />
              <Typography variant="caption" sx={{ minWidth: 30 }}>{pct}%</Typography>
            </Box>
          </Tooltip>
        );
      }
      case 'linkedRisks': {
        const count = si.linkedRiskIds.length;
        return count > 0
          ? <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.25 }}>
              {si.linkedRiskIds.slice(0, 3).map(id => {
                const r = risks.find(x => x.id === id);
                return (
                  <Chip key={id} size="small" label={r?.title || id} variant="outlined"
                    onClick={(e) => { e.stopPropagation(); onSwitchTab?.('risks', id); }}
                    sx={{ cursor: 'pointer', maxWidth: 120 }} />
                );
              })}
              {count > 3 && <Typography variant="caption" color="text.secondary">+{count - 3}</Typography>}
            </Box>
          : <Typography variant="caption" color="text.disabled">0</Typography>;
      }
      case 'actions':
        return (
          <Tooltip title="Delete this initiative" arrow>
            <IconButton size="small" onClick={(e) => { e.stopPropagation(); setDeleteId(si.id); }}>
              <Trash2 size={16} />
            </IconButton>
          </Tooltip>
        );
      default: return null;
    }
  }, [updateInitiative, risks, onSwitchTab]);

  const renderExpanded = useCallback((si: GrcSecurityInitiative) => (
    <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 2, bgcolor: 'action.hover' }}>
      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
        <Box sx={{ flex: 3, minWidth: 300, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, mb: 0.5, display: 'block' }}>Description</Typography>
            <TextField size="small" fullWidth multiline minRows={3} maxRows={8}
              value={si.description} placeholder="What is this initiative about?"
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateInitiative(si.id, { description: e.target.value })} />
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, mb: 0.5, display: 'block' }}>Current State</Typography>
            <TextField size="small" fullWidth multiline minRows={2} maxRows={6}
              value={si.currentState} placeholder="Describe the current security posture..."
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateInitiative(si.id, { currentState: e.target.value })} />
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, mb: 0.5, display: 'block' }}>Target State</Typography>
            <TextField size="small" fullWidth multiline minRows={2} maxRows={6}
              value={si.targetState} placeholder="Describe the desired future security posture..."
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateInitiative(si.id, { targetState: e.target.value })} />
          </Box>
        </Box>
        <Box sx={{ flex: 2, minWidth: 300, display: 'grid', gap: 2, gridTemplateColumns: '1fr 1fr', alignContent: 'start' }}>
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, mb: 0.5, display: 'block' }}>Category</Typography>
            <TextField size="small" fullWidth select value={si.category}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateInitiative(si.id, { category: e.target.value as GrcInitiativeCategory })}>
              {(Object.keys(categoryLabels) as GrcInitiativeCategory[]).map(k => <MenuItem key={k} value={k}>{categoryLabels[k]}</MenuItem>)}
            </TextField>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, mb: 0.5, display: 'block' }}>Status</Typography>
            <TextField size="small" fullWidth select value={si.status}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateInitiative(si.id, { status: e.target.value as GrcInitiativeStatus })}>
              {(Object.keys(statusLabels) as GrcInitiativeStatus[]).map(k => <MenuItem key={k} value={k}>{statusLabels[k]}</MenuItem>)}
            </TextField>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, mb: 0.5, display: 'block' }}>Priority</Typography>
            <TextField size="small" fullWidth select value={si.priority}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateInitiative(si.id, { priority: e.target.value as GrcInitiativePriority })}>
              {(Object.keys(priorityLabels) as GrcInitiativePriority[]).map(k => <MenuItem key={k} value={k}>{priorityLabels[k]}</MenuItem>)}
            </TextField>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, mb: 0.5, display: 'block' }}>Owner</Typography>
            <TextField size="small" fullWidth value={si.owner}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateInitiative(si.id, { owner: e.target.value })} />
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, mb: 0.5, display: 'block' }}>Executive Sponsor</Typography>
            <TextField size="small" fullWidth value={si.executiveSponsor}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateInitiative(si.id, { executiveSponsor: e.target.value })} />
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, mb: 0.5, display: 'block' }}>Start Date</Typography>
            <TextField size="small" fullWidth type="date" value={si.startDate} InputLabelProps={{ shrink: true }}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateInitiative(si.id, { startDate: e.target.value })} />
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, mb: 0.5, display: 'block' }}>Target Date</Typography>
            <TextField size="small" fullWidth type="date" value={si.targetDate} InputLabelProps={{ shrink: true }}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateInitiative(si.id, { targetDate: e.target.value })} />
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, mb: 0.5, display: 'block' }}>Completed Date</Typography>
            <TextField size="small" fullWidth type="date" value={si.completedDate} InputLabelProps={{ shrink: true }}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateInitiative(si.id, { completedDate: e.target.value })} />
          </Box>
        </Box>
      </Box>

      {/* Linkages */}
      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
        <Box sx={{ flex: 1, minWidth: 200 }}>
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, mb: 0.5, display: 'block' }}>Linked Risks</Typography>
          <FormControl size="small" fullWidth>
            <InputLabel>Risks</InputLabel>
            <Select multiple value={si.linkedRiskIds}
              input={<OutlinedInput label="Risks" />}
              onChange={(e) => updateInitiative(si.id, { linkedRiskIds: e.target.value as string[] })}
              renderValue={(selected) => (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {(selected as string[]).map(id => {
                    const r = risks.find(x => x.id === id);
                    return <Chip key={id} size="small" label={r?.title || id}
                      onClick={(e) => { e.stopPropagation(); onSwitchTab?.('risks', id); }}
                      sx={{ cursor: 'pointer' }} />;
                  })}
                </Box>
              )}>
              {risks.map(r => <MenuItem key={r.id} value={r.id}>{r.title}</MenuItem>)}
            </Select>
          </FormControl>
        </Box>
        <Box sx={{ flex: 1, minWidth: 200 }}>
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, mb: 0.5, display: 'block' }}>Linked Control Sets</Typography>
          <FormControl size="small" fullWidth>
            <InputLabel>Control Sets</InputLabel>
            <Select multiple value={si.linkedControlSetIds}
              input={<OutlinedInput label="Control Sets" />}
              onChange={(e) => updateInitiative(si.id, { linkedControlSetIds: e.target.value as string[] })}
              renderValue={(selected) => (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {(selected as string[]).map(id => {
                    const cs = controlSets.find(x => x.id === id);
                    return <Chip key={id} size="small" label={cs?.name || id}
                      onClick={(e) => { e.stopPropagation(); onSwitchTab?.('compliance', id); }}
                      sx={{ cursor: 'pointer' }} />;
                  })}
                </Box>
              )}>
              {controlSets.map(cs => <MenuItem key={cs.id} value={cs.id}>{cs.name}</MenuItem>)}
            </Select>
          </FormControl>
        </Box>
        <Box sx={{ flex: 1, minWidth: 200 }}>
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, mb: 0.5, display: 'block' }}>Linked Assets</Typography>
          <FormControl size="small" fullWidth>
            <InputLabel>Assets</InputLabel>
            <Select multiple value={si.linkedAssetIds}
              input={<OutlinedInput label="Assets" />}
              onChange={(e) => updateInitiative(si.id, { linkedAssetIds: e.target.value as string[] })}
              renderValue={(selected) => (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {(selected as string[]).map(id => {
                    const a = assets.find(x => x.id === id);
                    return <Chip key={id} size="small" label={a?.name || id}
                      onClick={(e) => { e.stopPropagation(); onSwitchTab?.('assets', id); }}
                      sx={{ cursor: 'pointer' }} />;
                  })}
                </Box>
              )}>
              {assets.map(a => <MenuItem key={a.id} value={a.id}>{a.name}</MenuItem>)}
            </Select>
          </FormControl>
        </Box>
        <Box sx={{ flex: 1, minWidth: 200 }}>
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, mb: 0.5, display: 'block' }}>Linked Implemented Controls</Typography>
          <FormControl size="small" fullWidth>
            <InputLabel>Implemented Controls</InputLabel>
            <Select multiple value={si.linkedImplementedControlIds || []}
              input={<OutlinedInput label="Implemented Controls" />}
              onChange={(e) => updateInitiative(si.id, { linkedImplementedControlIds: e.target.value as string[] })}
              renderValue={(selected) => (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {(selected as string[]).map(id => {
                    const ic = implementedControls.find(x => x.id === id);
                    return <Chip key={id} size="small" label={ic?.title || id}
                      onClick={(e) => { e.stopPropagation(); onSwitchTab?.('controls', id); }}
                      sx={{ cursor: 'pointer' }} />;
                  })}
                </Box>
              )}>
              {implementedControls.map(ic => <MenuItem key={ic.id} value={ic.id}>{ic.title}</MenuItem>)}
            </Select>
          </FormControl>
        </Box>
        <Box sx={{ flex: 1, minWidth: 200 }}>
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, mb: 0.5, display: 'block' }}>Linked Assessments</Typography>
          <FormControl size="small" fullWidth>
            <InputLabel>Assessments</InputLabel>
            <Select multiple value={si.linkedAssessmentIds || []}
              input={<OutlinedInput label="Assessments" />}
              onChange={(e) => updateInitiative(si.id, { linkedAssessmentIds: e.target.value as string[] })}
              renderValue={(selected) => (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {(selected as string[]).map(id => {
                    const a = assessments.find(x => x.id === id);
                    return <Chip key={id} size="small" label={a?.title || id}
                      onClick={(e) => { e.stopPropagation(); onSwitchTab?.('assessments', id); }}
                      sx={{ cursor: 'pointer' }} />;
                  })}
                </Box>
              )}>
              {assessments.map(a => <MenuItem key={a.id} value={a.id}>{a.title}</MenuItem>)}
            </Select>
          </FormControl>
        </Box>
      </Box>

      {/* Milestones */}
      <Box>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
            Milestones ({si.milestones.filter(m => m.status === 'completed').length}/{si.milestones.length} completed)
          </Typography>
          <Button size="small" startIcon={<Plus size={14} />} onClick={() => addMilestone(si.id)}>
            Add Milestone
          </Button>
        </Box>
        {si.milestones.length > 0 && (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem' }}>Title</TableCell>
                  <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem' }}>Status</TableCell>
                  <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem' }}>Due Date</TableCell>
                  <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem' }}>Owner</TableCell>
                  <TableCell sx={{ width: 40 }} />
                </TableRow>
              </TableHead>
              <TableBody>
                {si.milestones.map(ms => (
                  <TableRow key={ms.id}>
                    <TableCell>
                      <TextField size="small" variant="standard" value={ms.title} placeholder="Milestone title..."
                        InputProps={{ disableUnderline: true, sx: { fontSize: '0.85rem' } }}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateMilestone(si.id, ms.id, { title: e.target.value })} />
                    </TableCell>
                    <TableCell>
                      <TextField size="small" select value={ms.status} variant="standard"
                        InputProps={{ disableUnderline: true, sx: { fontSize: '0.8rem' } }}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                          const newStatus = e.target.value as GrcMilestoneStatus;
                          const patch: Partial<GrcInitiativeMilestone> = { status: newStatus };
                          if (newStatus === 'completed' && !ms.completedDate) {
                            patch.completedDate = new Date().toISOString().slice(0, 10);
                          }
                          updateMilestone(si.id, ms.id, patch);
                        }}>
                        {(Object.keys(milestoneStatusLabels) as GrcMilestoneStatus[]).map(k => (
                          <MenuItem key={k} value={k}>
                            <Box component="span" sx={{ color: MILESTONE_STATUS_COLORS[k], fontWeight: 600 }}>
                              {milestoneStatusLabels[k]}
                            </Box>
                          </MenuItem>
                        ))}
                      </TextField>
                    </TableCell>
                    <TableCell>
                      <TextField size="small" variant="standard" type="date" value={ms.dueDate}
                        InputProps={{ disableUnderline: true, sx: { fontSize: '0.85rem' } }}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateMilestone(si.id, ms.id, { dueDate: e.target.value })} />
                    </TableCell>
                    <TableCell>
                      <TextField size="small" variant="standard" value={ms.owner} placeholder="Owner..."
                        InputProps={{ disableUnderline: true, sx: { fontSize: '0.85rem' } }}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateMilestone(si.id, ms.id, { owner: e.target.value })} />
                    </TableCell>
                    <TableCell>
                      <IconButton size="small" onClick={() => deleteMilestone(si.id, ms.id)}>
                        <Trash2 size={14} />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Box>

      {/* Notes */}
      <Box>
        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, mb: 0.5, display: 'block' }}>Notes</Typography>
        <TextField size="small" fullWidth multiline minRows={2} maxRows={6}
          value={si.notes} placeholder="Additional notes..."
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateInitiative(si.id, { notes: e.target.value })} />
      </Box>
    </Box>
  ), [updateInitiative, addMilestone, updateMilestone, deleteMilestone, risks, controlSets, assets, implementedControls, assessments, onSwitchTab]);

  if (initiatives.length === 0 && !showForm) {
    return (
      <Box sx={{ textAlign: 'center', py: 8 }}>
        <RocketLaunchOutlined sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
        <Typography variant="h6" color="text.secondary" sx={{ mb: 1 }}>No Security Initiatives</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3, maxWidth: 480, mx: 'auto' }}>
          Security initiatives track strategic improvement programs like uplift projects, remediation campaigns,
          compliance transformations, and hardening efforts. Link them to risks, controls, and assets for full traceability.
        </Typography>
        <Button variant="contained" startIcon={<Plus size={16} />} onClick={() => setShowForm(true)}>
          Add First Initiative
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'grid', gap: 2 }}>
      {/* Filters and actions */}
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
        <TextField size="small" placeholder="Search initiatives..." value={search}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
          sx={{ minWidth: 200 }} />
        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
          <Chip label="All" size="small" variant={categoryFilter === 'all' ? 'filled' : 'outlined'}
            onClick={() => setCategoryFilter('all')} />
          {(Object.keys(categoryLabels) as GrcInitiativeCategory[]).map(k => (
            <Chip key={k} label={categoryLabels[k]} size="small"
              variant={categoryFilter === k ? 'filled' : 'outlined'}
              sx={categoryFilter === k ? { bgcolor: CATEGORY_COLORS[k] + '22', color: CATEGORY_COLORS[k], borderColor: CATEGORY_COLORS[k] } : {}}
              onClick={() => setCategoryFilter(categoryFilter === k ? 'all' : k)} />
          ))}
        </Box>
        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
          <Chip label="All Status" size="small" variant={statusFilter === 'all' ? 'filled' : 'outlined'}
            onClick={() => setStatusFilter('all')} />
          {(Object.keys(statusLabels) as GrcInitiativeStatus[]).map(k => (
            <Chip key={k} label={statusLabels[k]} size="small"
              variant={statusFilter === k ? 'filled' : 'outlined'}
              onClick={() => setStatusFilter(statusFilter === k ? 'all' : k)} />
          ))}
        </Box>
        <Box sx={{ flex: 1 }} />
        <TableColumnConfigPopover
          allColumns={columnConfig.allColumns}
          visibleIds={columnConfig.visibleIds}
          onToggle={columnConfig.toggleColumn}
          onMove={columnConfig.moveColumn}
          onReset={columnConfig.resetToDefaults} />
        <Button size="small" variant="outlined" startIcon={showForm ? <ChevronDown size={14} /> : <Plus size={14} />}
          onClick={() => setShowForm(p => !p)}>
          {showForm ? 'Cancel' : 'Add Initiative'}
        </Button>
      </Box>

      {/* Add form */}
      <Collapse in={showForm}>
        <Paper sx={{ ...cardSx, display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <TextField size="small" label="Title" value={newTitle} sx={{ minWidth: 200, flex: 2 }}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewTitle(e.target.value)} />
          <TextField size="small" label="Category" select value={newCategory} sx={{ minWidth: 140 }}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewCategory(e.target.value as GrcInitiativeCategory)}>
            {(Object.keys(categoryLabels) as GrcInitiativeCategory[]).map(k => <MenuItem key={k} value={k}>{categoryLabels[k]}</MenuItem>)}
          </TextField>
          <TextField size="small" label="Priority" select value={newPriority} sx={{ minWidth: 120 }}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewPriority(e.target.value as GrcInitiativePriority)}>
            {(Object.keys(priorityLabels) as GrcInitiativePriority[]).map(k => <MenuItem key={k} value={k}>{priorityLabels[k]}</MenuItem>)}
          </TextField>
          <TextField size="small" label="Owner" value={newOwner} sx={{ minWidth: 140, flex: 1 }}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewOwner(e.target.value)} />
          <Button variant="contained" size="small" onClick={handleAdd}>Add</Button>
        </Paper>
      </Collapse>

      {/* Table */}
      <TableContainer component={Paper} sx={{ borderRadius: 2 }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ width: 32 }} />
              {columnConfig.visibleColumns.map(col => (
                <TableCell key={col.id}>
                  {SORTABLE.has(col.id) ? (
                    <TableSortLabel active={sortCol === col.id} direction={sortCol === col.id ? sortDir : 'asc'}
                      onClick={() => handleSort(col.id)}>
                      {col.label}
                    </TableSortLabel>
                  ) : col.label}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {sorted.map(si => {
              const isExpanded = expandedId === si.id;
              const isHighlighted = highlightId === si.id;
              return (
                <React.Fragment key={si.id}>
                  <TableRow
                    id={`grc-si-${si.id}`}
                    hover
                    onClick={() => setExpandedId(prev => prev === si.id ? null : si.id)}
                    sx={{
                      cursor: 'pointer',
                      ...(isHighlighted ? {
                        animation: 'grc-highlight-fade 2s ease-out',
                        '@keyframes grc-highlight-fade': {
                          '0%': { bgcolor: 'primary.main', opacity: 0.2 },
                          '100%': { bgcolor: 'transparent' }
                        }
                      } : {})
                    }}
                  >
                    <TableCell sx={{ width: 32 }}>
                      {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    </TableCell>
                    {columnConfig.visibleColumns.map(col => (
                      <TableCell key={col.id}>{renderCell(col.id, si)}</TableCell>
                    ))}
                  </TableRow>
                  {isExpanded && (
                    <TableRow>
                      <TableCell colSpan={columnConfig.visibleColumns.length + 1} sx={{ p: 0 }}>
                        {renderExpanded(si)}
                      </TableCell>
                    </TableRow>
                  )}
                </React.Fragment>
              );
            })}
            {sorted.length === 0 && (
              <TableRow>
                <TableCell colSpan={columnConfig.visibleColumns.length + 1} align="center" sx={{ py: 4 }}>
                  <Typography variant="body2" color="text.secondary">
                    No initiatives match the current filters.
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Delete dialog */}
      <Dialog open={Boolean(toDelete)} onClose={() => setDeleteId(null)}>
        <DialogTitle>Delete Initiative</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Delete &quot;{toDelete?.title}&quot;? This cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteId(null)}>Cancel</Button>
          <Button color="error" onClick={() => deleteId && handleDelete(deleteId)}>Delete</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default GrcInitiativesTab;
