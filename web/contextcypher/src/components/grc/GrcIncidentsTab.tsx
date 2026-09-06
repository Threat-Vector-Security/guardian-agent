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
import CrisisAlertOutlined from '@mui/icons-material/CrisisAlertOutlined';
import { ChevronDown, ChevronRight, Plus, Trash2 } from 'lucide-react';
import {
  GrcIncident,
  GrcIncidentSeverity,
  GrcIncidentStatus,
  GrcIncidentTimelineEntry
} from '../../types/GrcTypes';
import { GrcTabProps, cardSx, createId, SEVERITY_COLORS, LBL } from './grcShared';
import { useTableColumnConfig, ColumnDef } from './useTableColumnConfig';
import TableColumnConfigPopover from './TableColumnConfigPopover';

const severityLabels: Record<GrcIncidentSeverity, string> = {
  critical: 'Critical', high: 'High', medium: 'Medium', low: 'Low'
};

const statusLabels: Record<GrcIncidentStatus, string> = {
  identified: 'Identified', triaged: 'Triaged', investigating: 'Investigating',
  contained: 'Contained', resolved: 'Resolved', closed: 'Closed'
};

const STATUS_COLORS: Record<GrcIncidentStatus, string> = {
  identified: '#dc2626', triaged: '#ea580c', investigating: '#ca8a04',
  contained: '#3b82f6', resolved: '#16a34a', closed: '#94a3b8'
};

const COLUMNS: ColumnDef[] = [
  { id: 'title', label: 'Title', defaultVisible: true, removable: false },
  { id: 'severity', label: 'Severity', defaultVisible: true, removable: true },
  { id: 'status', label: 'Status', defaultVisible: true, removable: true },
  { id: 'detectedDate', label: 'Detected', defaultVisible: true, removable: true },
  { id: 'owner', label: 'Owner', defaultVisible: true, removable: true },
  { id: 'linkedRisks', label: 'Risks', defaultVisible: true, removable: true },
  { id: 'linkedAssets', label: 'Assets', defaultVisible: true, removable: true },
  { id: 'actions', label: '', defaultVisible: true, removable: false }
];

const SORTABLE = new Set(['title', 'severity', 'status', 'detectedDate', 'owner', 'linkedRisks', 'linkedAssets']);

const SEVERITY_ORDER: Record<GrcIncidentSeverity, number> = { critical: 0, high: 1, medium: 2, low: 3 };
const STATUS_ORDER: Record<GrcIncidentStatus, number> = {
  identified: 0, triaged: 1, investigating: 2, contained: 3, resolved: 4, closed: 5
};

type SortDir = 'asc' | 'desc';

const GrcIncidentsTab: React.FC<GrcTabProps> = ({
  workspace,
  applyWorkspace,
  setStatusMessage,
  onSwitchTab,
  focusRequest,
  getTabViewState,
  setTabViewState
}) => {
  const incidents = useMemo(() => workspace.incidents || [], [workspace.incidents]);
  const risks = useMemo(() => workspace.risks || [], [workspace.risks]);
  const assets = useMemo(() => workspace.assets || [], [workspace.assets]);
  const findings = useMemo(() => workspace.findings || [], [workspace.findings]);

  const persistedView = getTabViewState?.('incidents' as any, { expandedId: null }) ?? { expandedId: null };
  const columnConfig = useTableColumnConfig('incidents-table', COLUMNS, workspace, applyWorkspace);

  const [sortCol, setSortCol] = useState<string>('detectedDate');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [sevFilter, setSevFilter] = useState<GrcIncidentSeverity | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<GrcIncidentStatus | 'all'>('all');
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>((persistedView.expandedId as string | null) ?? null);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const [newTitle, setNewTitle] = useState('');
  const [newSeverity, setNewSeverity] = useState<GrcIncidentSeverity>('medium');
  const [newStatus, setNewStatus] = useState<GrcIncidentStatus>('identified');
  const [newOwner, setNewOwner] = useState('');
  const [newDetected, setNewDetected] = useState('');

  useEffect(() => {
    if (focusRequest && focusRequest.tab === ('incidents' as any) && focusRequest.entityId) {
      const id = focusRequest.entityId;
      if (incidents.some(inc => inc.id === id)) {
        setExpandedId(id);
        setHighlightId(id);
        setTimeout(() => {
          document.getElementById(`grc-inc-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 100);
        setTimeout(() => setHighlightId(null), 2000);
      }
    }
  }, [focusRequest, incidents]);

  useEffect(() => {
    setTabViewState?.('incidents' as any, { expandedId });
  }, [expandedId, setTabViewState]);

  const filtered = useMemo(() => {
    let result = incidents;
    if (sevFilter !== 'all') result = result.filter(i => i.severity === sevFilter);
    if (statusFilter !== 'all') result = result.filter(i => i.status === statusFilter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter(i =>
        i.title.toLowerCase().includes(q) ||
        i.description.toLowerCase().includes(q) ||
        i.owner.toLowerCase().includes(q)
      );
    }
    return result;
  }, [incidents, sevFilter, statusFilter, search]);

  const sorted = useMemo(() => {
    const list = [...filtered];
    const dir = sortDir === 'asc' ? 1 : -1;
    list.sort((a, b) => {
      let cmp = 0;
      switch (sortCol) {
        case 'title': cmp = a.title.localeCompare(b.title); break;
        case 'severity': cmp = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]; break;
        case 'status': cmp = STATUS_ORDER[a.status] - STATUS_ORDER[b.status]; break;
        case 'detectedDate': cmp = a.detectedDate.localeCompare(b.detectedDate); break;
        case 'owner': cmp = a.owner.localeCompare(b.owner); break;
        case 'linkedRisks': cmp = a.linkedRiskIds.length - b.linkedRiskIds.length; break;
        case 'linkedAssets': cmp = a.linkedAssetIds.length - b.linkedAssetIds.length; break;
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

  const updateIncident = useCallback((id: string, patch: Partial<GrcIncident>) => {
    const now = new Date().toISOString();
    applyWorkspace({
      ...workspace,
      incidents: incidents.map(i => i.id === id ? { ...i, ...patch, updatedAt: now } : i),
      updatedAt: now
    });
  }, [applyWorkspace, workspace, incidents]);

  const handleAdd = useCallback(() => {
    const title = newTitle.trim();
    if (!title) { setStatusMessage({ severity: 'warning', text: 'Incident title is required.' }); return; }
    const now = new Date().toISOString();
    const inc: GrcIncident = {
      id: createId('inc'), title, description: '', severity: newSeverity, status: newStatus,
      detectedDate: newDetected || now.slice(0, 10), resolvedDate: '', closedDate: '',
      owner: newOwner.trim(), linkedRiskIds: [], linkedAssetIds: [], linkedFindingIds: [],
      timelineEntries: [], lessonsLearned: '', notes: '',
      createdAt: now, updatedAt: now
    };
    applyWorkspace({ ...workspace, incidents: [...incidents, inc], updatedAt: now });
    setNewTitle(''); setNewOwner(''); setNewDetected('');
    setNewSeverity('medium'); setNewStatus('identified');
    setShowForm(false);
    setStatusMessage({ severity: 'success', text: `Added incident "${title}".` });
  }, [applyWorkspace, workspace, incidents, newTitle, newSeverity, newStatus, newOwner, newDetected, setStatusMessage]);

  const handleDelete = useCallback((id: string) => {
    const inc = incidents.find(i => i.id === id);
    applyWorkspace({
      ...workspace,
      incidents: incidents.filter(i => i.id !== id),
      updatedAt: new Date().toISOString()
    });
    setDeleteId(null);
    if (inc) setStatusMessage({ severity: 'success', text: `Deleted incident "${inc.title}".` });
  }, [applyWorkspace, workspace, incidents, setStatusMessage]);

  const addTimelineEntry = useCallback((incId: string) => {
    const inc = incidents.find(i => i.id === incId);
    if (!inc) return;
    const entry: GrcIncidentTimelineEntry = {
      id: createId('tle'),
      date: new Date().toISOString().slice(0, 10),
      description: '',
      actor: ''
    };
    updateIncident(incId, { timelineEntries: [...inc.timelineEntries, entry] });
  }, [incidents, updateIncident]);

  const updateTimelineEntry = useCallback((incId: string, entryId: string, patch: Partial<GrcIncidentTimelineEntry>) => {
    const inc = incidents.find(i => i.id === incId);
    if (!inc) return;
    updateIncident(incId, {
      timelineEntries: inc.timelineEntries.map(e => e.id === entryId ? { ...e, ...patch } : e)
    });
  }, [incidents, updateIncident]);

  const deleteTimelineEntry = useCallback((incId: string, entryId: string) => {
    const inc = incidents.find(i => i.id === incId);
    if (!inc) return;
    updateIncident(incId, {
      timelineEntries: inc.timelineEntries.filter(e => e.id !== entryId)
    });
  }, [incidents, updateIncident]);

  const toDelete = deleteId ? incidents.find(i => i.id === deleteId) : null;

  const renderCell = useCallback((colId: string, inc: GrcIncident) => {
    switch (colId) {
      case 'title':
        return (
          <TextField size="small" value={inc.title} variant="standard"
            sx={{ minWidth: 140 }}
            InputProps={{ disableUnderline: true, sx: { fontWeight: 600, fontSize: '0.875rem' } }}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
              if (e.target.value.trim()) updateIncident(inc.id, { title: e.target.value });
            }} />
        );
      case 'severity': {
        const color = SEVERITY_COLORS[inc.severity] || '#6b7280';
        return (
          <Box component="span" sx={{
            px: 1, py: 0.25, borderRadius: 1, fontSize: '0.75rem', fontWeight: 600,
            bgcolor: color + '22', color, border: `1px solid ${color}44`
          }}>
            {severityLabels[inc.severity]}
          </Box>
        );
      }
      case 'status': {
        const color = STATUS_COLORS[inc.status];
        return (
          <Box component="span" sx={{
            px: 1, py: 0.25, borderRadius: 1, fontSize: '0.75rem', fontWeight: 600,
            bgcolor: color + '22', color
          }}>
            {statusLabels[inc.status]}
          </Box>
        );
      }
      case 'detectedDate':
        return inc.detectedDate
          ? <Typography variant="body2" sx={{ fontSize: '0.85rem' }}>{inc.detectedDate}</Typography>
          : <Typography variant="caption" color="text.disabled">{'\u2014'}</Typography>;
      case 'owner':
        return inc.owner
          ? <Typography variant="body2" sx={{ fontSize: '0.85rem' }}>{inc.owner}</Typography>
          : <Typography variant="caption" color="text.disabled">{'\u2014'}</Typography>;
      case 'linkedRisks': {
        const count = inc.linkedRiskIds.length;
        return count > 0
          ? <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.25 }}>
              {inc.linkedRiskIds.map(id => {
                const r = risks.find(x => x.id === id);
                return (
                  <Chip key={id} size="small" label={r?.title || id} variant="outlined"
                    onClick={e => { e.stopPropagation(); onSwitchTab?.('risks', id); }}
                    sx={{ cursor: 'pointer' }} />
                );
              })}
            </Box>
          : <Typography variant="caption" color="text.disabled">0</Typography>;
      }
      case 'linkedAssets': {
        const count = inc.linkedAssetIds.length;
        return count > 0
          ? <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.25 }}>
              {inc.linkedAssetIds.map(id => {
                const a = assets.find(x => x.id === id);
                return (
                  <Chip key={id} size="small" label={a?.name || id} variant="outlined"
                    onClick={e => { e.stopPropagation(); onSwitchTab?.('assets', id); }}
                    sx={{ cursor: 'pointer' }} />
                );
              })}
            </Box>
          : <Typography variant="caption" color="text.disabled">0</Typography>;
      }
      case 'actions':
        return (
          <Tooltip title="Delete this incident" arrow>
            <IconButton size="small" onClick={e => { e.stopPropagation(); setDeleteId(inc.id); }}>
              <Trash2 size={16} />
            </IconButton>
          </Tooltip>
        );
      default: return null;
    }
  }, [updateIncident, risks, assets, onSwitchTab]);

  const renderExpanded = useCallback((inc: GrcIncident) => (
    <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 2, bgcolor: 'action.hover' }}>
      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
        <Box sx={{ flex: 3, minWidth: 300 }}>
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, mb: 0.5, display: 'block' }}>Description</Typography>
          <TextField size="small" fullWidth multiline minRows={4} maxRows={10}
            value={inc.description} placeholder="Incident description"
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateIncident(inc.id, { description: e.target.value })} />
        </Box>
        <Box sx={{ flex: 2, minWidth: 300, display: 'grid', gap: 2, gridTemplateColumns: '1fr 1fr', alignContent: 'start' }}>
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, mb: 0.5, display: 'block' }}>Severity</Typography>
            <TextField size="small" fullWidth select value={inc.severity}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateIncident(inc.id, { severity: e.target.value as GrcIncidentSeverity })}>
              {(Object.keys(severityLabels) as GrcIncidentSeverity[]).map(k => <MenuItem key={k} value={k}>{severityLabels[k]}</MenuItem>)}
            </TextField>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, mb: 0.5, display: 'block' }}>Status</Typography>
            <TextField size="small" fullWidth select value={inc.status}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateIncident(inc.id, { status: e.target.value as GrcIncidentStatus })}>
              {(Object.keys(statusLabels) as GrcIncidentStatus[]).map(k => <MenuItem key={k} value={k}>{statusLabels[k]}</MenuItem>)}
            </TextField>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, mb: 0.5, display: 'block' }}>Owner</Typography>
            <TextField size="small" fullWidth value={inc.owner}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateIncident(inc.id, { owner: e.target.value })} />
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, mb: 0.5, display: 'block' }}>Detected Date</Typography>
            <TextField size="small" fullWidth type="date" value={inc.detectedDate}
              InputLabelProps={{ shrink: true }}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateIncident(inc.id, { detectedDate: e.target.value })} />
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, mb: 0.5, display: 'block' }}>Resolved Date</Typography>
            <TextField size="small" fullWidth type="date" value={inc.resolvedDate}
              InputLabelProps={{ shrink: true }}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateIncident(inc.id, { resolvedDate: e.target.value })} />
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, mb: 0.5, display: 'block' }}>Closed Date</Typography>
            <TextField size="small" fullWidth type="date" value={inc.closedDate}
              InputLabelProps={{ shrink: true }}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateIncident(inc.id, { closedDate: e.target.value })} />
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, mb: 0.5, display: 'block' }}>Linked Risks</Typography>
            <FormControl size="small" fullWidth>
              <InputLabel>Risks</InputLabel>
              <Select multiple value={inc.linkedRiskIds}
                onChange={e => updateIncident(inc.id, { linkedRiskIds: typeof e.target.value === 'string' ? e.target.value.split(',') : e.target.value as string[] })}
                input={<OutlinedInput label="Risks" />}
                renderValue={sel => (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.25 }}>
                    {(sel as string[]).map(id => (
                      <Chip key={id} size="small" label={risks.find(r => r.id === id)?.title || id} variant="outlined"
                        onClick={e => { e.stopPropagation(); onSwitchTab?.('risks', id); }}
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
              <Select multiple value={inc.linkedAssetIds}
                onChange={e => updateIncident(inc.id, { linkedAssetIds: typeof e.target.value === 'string' ? e.target.value.split(',') : e.target.value as string[] })}
                input={<OutlinedInput label="Assets" />}
                renderValue={sel => (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.25 }}>
                    {(sel as string[]).map(id => (
                      <Chip key={id} size="small" label={assets.find(a => a.id === id)?.name || id} variant="outlined"
                        onClick={e => { e.stopPropagation(); onSwitchTab?.('assets', id); }}
                        sx={{ cursor: 'pointer' }} />
                    ))}
                  </Box>
                )}>
                {assets.map(a => <MenuItem key={a.id} value={a.id}>{a.name}</MenuItem>)}
              </Select>
            </FormControl>
          </Box>
          <Box sx={{ gridColumn: '1 / -1' }}>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, mb: 0.5, display: 'block' }}>Linked Findings</Typography>
            <FormControl size="small" fullWidth>
              <InputLabel>Findings</InputLabel>
              <Select multiple value={inc.linkedFindingIds}
                onChange={e => updateIncident(inc.id, { linkedFindingIds: typeof e.target.value === 'string' ? e.target.value.split(',') : e.target.value as string[] })}
                input={<OutlinedInput label="Findings" />}
                renderValue={sel => (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.25 }}>
                    {(sel as string[]).map(id => (
                      <Chip key={id} size="small" label={findings.find(f => f.id === id)?.title || id} variant="outlined"
                        onClick={e => { e.stopPropagation(); onSwitchTab?.('findings', id); }}
                        sx={{ cursor: 'pointer' }} />
                    ))}
                  </Box>
                )}>
                {findings.map(f => <MenuItem key={f.id} value={f.id}>{f.title}</MenuItem>)}
              </Select>
            </FormControl>
          </Box>
        </Box>
      </Box>

      <Box>
        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, mb: 0.5, display: 'block' }}>Lessons Learned</Typography>
        <TextField size="small" fullWidth multiline minRows={2} maxRows={6}
          value={inc.lessonsLearned} placeholder="Post-incident lessons learned"
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateIncident(inc.id, { lessonsLearned: e.target.value })} />
      </Box>
      <Box>
        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, mb: 0.5, display: 'block' }}>Notes</Typography>
        <TextField size="small" fullWidth multiline minRows={2} maxRows={6}
          value={inc.notes} placeholder="Internal notes"
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateIncident(inc.id, { notes: e.target.value })} />
      </Box>

      <Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>Timeline</Typography>
          <Button size="small" startIcon={<Plus size={14} />} onClick={() => addTimelineEntry(inc.id)}>
            Add Entry
          </Button>
        </Box>
        {inc.timelineEntries.length > 0 ? (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem' }}>Date</TableCell>
                <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem' }}>Description</TableCell>
                <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem' }}>Actor</TableCell>
                <TableCell sx={{ width: 40 }} />
              </TableRow>
            </TableHead>
            <TableBody>
              {inc.timelineEntries.map(entry => (
                <TableRow key={entry.id}>
                  <TableCell sx={{ width: 140 }}>
                    <TextField size="small" type="date" value={entry.date} variant="standard"
                      InputProps={{ disableUnderline: true, sx: { fontSize: '0.8rem' } }}
                      onChange={e => updateTimelineEntry(inc.id, entry.id, { date: e.target.value })} />
                  </TableCell>
                  <TableCell>
                    <TextField size="small" fullWidth value={entry.description} variant="standard"
                      InputProps={{ disableUnderline: true, sx: { fontSize: '0.8rem' } }}
                      placeholder="What happened"
                      onChange={e => updateTimelineEntry(inc.id, entry.id, { description: e.target.value })} />
                  </TableCell>
                  <TableCell sx={{ width: 140 }}>
                    <TextField size="small" value={entry.actor} variant="standard"
                      InputProps={{ disableUnderline: true, sx: { fontSize: '0.8rem' } }}
                      placeholder="Who"
                      onChange={e => updateTimelineEntry(inc.id, entry.id, { actor: e.target.value })} />
                  </TableCell>
                  <TableCell>
                    <IconButton size="small" onClick={() => deleteTimelineEntry(inc.id, entry.id)}>
                      <Trash2 size={14} />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <Typography variant="body2" color="text.secondary" sx={{ py: 0.5 }}>
            No timeline entries yet.
          </Typography>
        )}
      </Box>
    </Box>
  ), [updateIncident, risks, assets, findings, onSwitchTab, addTimelineEntry, updateTimelineEntry, deleteTimelineEntry]);

  if (incidents.length === 0 && !showForm) {
    return (
      <Box sx={{ display: 'grid', gap: 2 }}>
        <Paper sx={{ ...cardSx, textAlign: 'center', py: 6 }}>
          <CrisisAlertOutlined sx={{ fontSize: 40, opacity: 0.3, mb: 1 }} />
          <Typography variant="h6" sx={{ mb: 1 }}>No incidents recorded yet</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 520, mx: 'auto', mb: 1, lineHeight: 1.8 }}>
            Track security incidents from detection through resolution. Link incidents to risks,
            assets, and findings for comprehensive post-incident analysis and lessons learned.
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 520, mx: 'auto', mb: 3, lineHeight: 1.8 }}>
            Each incident can carry a detailed timeline, severity classification, owner assignment,
            and linkages to your risk management and compliance workflows.
          </Typography>
          <Button variant="contained" startIcon={<Plus size={16} />} onClick={() => setShowForm(true)}>
            Record First Incident
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
            <Typography variant="h6" sx={{ mb: 0.5 }}>Incidents</Typography>
            <Typography variant="body2" color="text.secondary">
              Security incident tracking with timeline, severity classification, and risk/asset linkage.
            </Typography>
          </Box>
          <Button variant="contained" startIcon={<Plus size={16} />} size="small"
            onClick={() => setShowForm(!showForm)}>
            Add Incident
          </Button>
        </Box>

        <Collapse in={showForm} timeout="auto" unmountOnExit>
          <Box sx={{ mt: 2, p: 2, bgcolor: 'action.hover', borderRadius: 1, display: 'grid', gap: 1.5 }}>
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 1.5 }}>
              <TextField size="small" label="Title" value={newTitle}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewTitle(e.target.value)} />
              <TextField size="small" select label="Severity" value={newSeverity}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewSeverity(e.target.value as GrcIncidentSeverity)}>
                {(Object.keys(severityLabels) as GrcIncidentSeverity[]).map(k => <MenuItem key={k} value={k}>{severityLabels[k]}</MenuItem>)}
              </TextField>
              <TextField size="small" select label="Status" value={newStatus}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewStatus(e.target.value as GrcIncidentStatus)}>
                {(Object.keys(statusLabels) as GrcIncidentStatus[]).map(k => <MenuItem key={k} value={k}>{statusLabels[k]}</MenuItem>)}
              </TextField>
              <TextField size="small" label="Owner" value={newOwner}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewOwner(e.target.value)} />
              <TextField size="small" type="date" label="Detected Date" value={newDetected}
                InputLabelProps={{ shrink: true }}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewDetected(e.target.value)} />
            </Box>
            <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
              <Button size="small" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button variant="contained" size="small" startIcon={<Plus size={16} />} onClick={handleAdd}
                disabled={!newTitle.trim()}>Add Incident</Button>
            </Box>
          </Box>
        </Collapse>
      </Paper>

      {incidents.length > 0 && (
        <TableContainer component={Paper} sx={cardSx}>
          <Box sx={{ p: 1.5, borderBottom: '1px solid', borderColor: 'divider', display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center' }}>
            <TextField size="small" placeholder="Search incidents..." value={search}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)} sx={{ minWidth: 180 }} />
            <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
              <Typography variant="caption" color="text.secondary" sx={{ mr: 0.5 }}>Severity:</Typography>
              <Chip size="small" label="All"
                variant={sevFilter === 'all' ? 'filled' : 'outlined'}
                color={sevFilter === 'all' ? 'primary' : 'default'}
                onClick={() => setSevFilter('all')} />
              {(Object.keys(severityLabels) as GrcIncidentSeverity[]).map(k => (
                <Chip key={k} size="small" label={severityLabels[k]}
                  variant={sevFilter === k ? 'filled' : 'outlined'}
                  color={sevFilter === k ? 'primary' : 'default'}
                  onClick={() => setSevFilter(k)} />
              ))}
            </Box>
            <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
              <Typography variant="caption" color="text.secondary" sx={{ mr: 0.5 }}>Status:</Typography>
              <Chip size="small" label="All"
                variant={statusFilter === 'all' ? 'filled' : 'outlined'}
                color={statusFilter === 'all' ? 'primary' : 'default'}
                onClick={() => setStatusFilter('all')} />
              {(Object.keys(statusLabels) as GrcIncidentStatus[]).map(k => (
                <Chip key={k} size="small" label={statusLabels[k]}
                  variant={statusFilter === k ? 'filled' : 'outlined'}
                  color={statusFilter === k ? 'primary' : 'default'}
                  onClick={() => setStatusFilter(k)} />
              ))}
            </Box>
            <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto' }}>
              {sorted.length} of {incidents.length} incidents
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
              {sorted.map(inc => {
                const isExpanded = expandedId === inc.id;
                return (
                  <React.Fragment key={inc.id}>
                    <TableRow id={`grc-inc-${inc.id}`} hover sx={{
                      cursor: 'pointer', '& > *': { borderBottom: isExpanded ? 'none' : undefined },
                      ...(highlightId === inc.id && { bgcolor: 'action.selected', transition: 'background-color 0.3s' })
                    }}
                      onClick={() => setExpandedId(isExpanded ? null : inc.id)}>
                      <TableCell padding="checkbox">
                        <IconButton size="small" sx={{ p: 0.25 }}>
                          {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                        </IconButton>
                      </TableCell>
                      {columnConfig.visibleColumns.map(col => (
                        <TableCell key={col.id} onClick={e => {
                          if (col.id === 'title') e.stopPropagation();
                        }}>
                          {renderCell(col.id, inc)}
                        </TableCell>
                      ))}
                      <TableCell padding="none" />
                    </TableRow>
                    {isExpanded && (
                      <TableRow>
                        <TableCell colSpan={columnConfig.visibleColumns.length + 2} sx={{ py: 0, px: 0 }}>
                          <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                            {renderExpanded(inc)}
                          </Collapse>
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                );
              })}
              {sorted.length === 0 && incidents.length > 0 && (
                <TableRow>
                  <TableCell colSpan={columnConfig.visibleColumns.length + 2}>
                    <Typography variant="body2" color="text.secondary" sx={{ py: 1 }}>
                      No incidents match the current filters.
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Dialog open={Boolean(toDelete)} onClose={() => setDeleteId(null)}>
        <DialogTitle>Delete Incident</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Delete "{toDelete?.title}"? This will permanently remove the incident record.
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

export default GrcIncidentsTab;
