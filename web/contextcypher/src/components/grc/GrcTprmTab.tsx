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
import { ChevronDown, ChevronRight, Plus, Shield, Trash2 } from 'lucide-react';
import {
  GrcThirdParty,
  GrcThirdPartyCategory,
  GrcThirdPartyDataClassification,
  GrcThirdPartyRiskRating,
  GrcThirdPartyStatus
} from '../../types/GrcTypes';
import { GrcTabProps, cardSx, createId } from './grcShared';
import { useTableColumnConfig, ColumnDef } from './useTableColumnConfig';
import TableColumnConfigPopover from './TableColumnConfigPopover';

const categoryLabels: Record<GrcThirdPartyCategory, string> = {
  cloud_provider: 'Cloud Provider',
  saas: 'SaaS',
  managed_service: 'Managed Service',
  contractor: 'Contractor',
  supplier: 'Supplier',
  partner: 'Partner',
  other: 'Other'
};

const statusLabels: Record<GrcThirdPartyStatus, string> = {
  active: 'Active',
  under_review: 'Under Review',
  onboarding: 'Onboarding',
  offboarding: 'Offboarding',
  terminated: 'Terminated'
};

const riskRatingLabels: Record<GrcThirdPartyRiskRating, string> = {
  critical: 'Critical',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
  not_assessed: 'Not Assessed'
};

const dataClassificationLabels: Record<GrcThirdPartyDataClassification, string> = {
  public: 'Public',
  internal: 'Internal',
  confidential: 'Confidential',
  restricted: 'Restricted'
};

const CATEGORY_COLORS: Record<GrcThirdPartyCategory, string> = {
  cloud_provider: '#2563eb',
  saas: '#7c3aed',
  managed_service: '#059669',
  contractor: '#ca8a04',
  supplier: '#ea580c',
  partner: '#0891b2',
  other: '#6b7280'
};

const RISK_RATING_COLORS: Record<GrcThirdPartyRiskRating, string> = {
  critical: '#dc2626',
  high: '#ea580c',
  medium: '#ca8a04',
  low: '#16a34a',
  not_assessed: '#6b7280'
};

const STATUS_COLORS: Record<GrcThirdPartyStatus, string> = {
  active: '#16a34a',
  under_review: '#ca8a04',
  onboarding: '#2563eb',
  offboarding: '#ea580c',
  terminated: '#6b7280'
};

const COLUMNS: ColumnDef[] = [
  { id: 'name', label: 'Name', defaultVisible: true, removable: false },
  { id: 'category', label: 'Category', defaultVisible: true, removable: true },
  { id: 'status', label: 'Status', defaultVisible: true, removable: true },
  { id: 'riskRating', label: 'Risk Rating', defaultVisible: true, removable: true },
  { id: 'dataClassification', label: 'Data Class.', defaultVisible: true, removable: true },
  { id: 'contact', label: 'Contact', defaultVisible: true, removable: true },
  { id: 'contractExpiry', label: 'Contract Expiry', defaultVisible: true, removable: true },
  { id: 'nextReview', label: 'Next Review', defaultVisible: true, removable: true },
  { id: 'linkedAssets', label: 'Assets', defaultVisible: true, removable: true },
  { id: 'linkedRisks', label: 'Risks', defaultVisible: true, removable: true },
  { id: 'actions', label: '', defaultVisible: true, removable: false }
];

const SORTABLE = new Set(['name', 'category', 'status', 'riskRating', 'dataClassification', 'contractExpiry', 'nextReview', 'linkedAssets', 'linkedRisks']);

type SortDir = 'asc' | 'desc';

const riskRatingOrder: Record<GrcThirdPartyRiskRating, number> = {
  critical: 4, high: 3, medium: 2, low: 1, not_assessed: 0
};

const GrcTprmTab: React.FC<GrcTabProps> = ({
  workspace,
  applyWorkspace,
  setStatusMessage,
  onSwitchTab,
  focusRequest,
  getTabViewState,
  setTabViewState
}) => {
  const thirdParties = useMemo(() => workspace.thirdParties || [], [workspace.thirdParties]);
  const assets = useMemo(() => workspace.assets || [], [workspace.assets]);
  const risks = useMemo(() => workspace.risks || [], [workspace.risks]);
  const persistedView = getTabViewState?.('third_parties', {
    expandedId: null
  }) ?? {
    expandedId: null
  };

  const columnConfig = useTableColumnConfig('tprm-table', COLUMNS, workspace, applyWorkspace);

  const [sortCol, setSortCol] = useState<string>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [categoryFilter, setCategoryFilter] = useState<GrcThirdPartyCategory | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<GrcThirdPartyStatus | 'all'>('all');
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>((persistedView.expandedId as string | null) ?? null);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => {
    if (focusRequest?.tab === 'third_parties' && focusRequest.entityId) {
      const id = focusRequest.entityId;
      if (thirdParties.some(tp => tp.id === id)) {
        setExpandedId(id);
        setHighlightId(id);
        setTimeout(() => {
          document.getElementById(`grc-tp-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 100);
        setTimeout(() => setHighlightId(null), 2000);
      }
    }
  }, [focusRequest, thirdParties]);

  useEffect(() => {
    setTabViewState?.('third_parties', {
      expandedId
    });
  }, [expandedId, setTabViewState]);

  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState<GrcThirdPartyCategory>('saas');
  const [newStatus, setNewStatus] = useState<GrcThirdPartyStatus>('onboarding');
  const [newRiskRating, setNewRiskRating] = useState<GrcThirdPartyRiskRating>('not_assessed');
  const [newDataClass, setNewDataClass] = useState<GrcThirdPartyDataClassification>('internal');
  const [newContact, setNewContact] = useState('');
  const [newEmail, setNewEmail] = useState('');

  const filtered = useMemo(() => {
    let result = thirdParties;
    if (categoryFilter !== 'all') result = result.filter(tp => tp.category === categoryFilter);
    if (statusFilter !== 'all') result = result.filter(tp => tp.status === statusFilter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter(tp =>
        tp.name.toLowerCase().includes(q) ||
        tp.description.toLowerCase().includes(q) ||
        tp.contactName.toLowerCase().includes(q) ||
        tp.contactEmail.toLowerCase().includes(q) ||
        tp.notes.toLowerCase().includes(q)
      );
    }
    return result;
  }, [thirdParties, categoryFilter, statusFilter, search]);

  const sorted = useMemo(() => {
    const list = [...filtered];
    const dir = sortDir === 'asc' ? 1 : -1;
    list.sort((a, b) => {
      let cmp = 0;
      switch (sortCol) {
        case 'name': cmp = a.name.localeCompare(b.name); break;
        case 'category': cmp = a.category.localeCompare(b.category); break;
        case 'status': cmp = a.status.localeCompare(b.status); break;
        case 'riskRating': cmp = riskRatingOrder[a.riskRating] - riskRatingOrder[b.riskRating]; break;
        case 'dataClassification': cmp = a.dataClassification.localeCompare(b.dataClassification); break;
        case 'contractExpiry': cmp = (a.contractExpiry || '').localeCompare(b.contractExpiry || ''); break;
        case 'nextReview': cmp = (a.nextReviewDate || '').localeCompare(b.nextReviewDate || ''); break;
        case 'linkedAssets': cmp = a.linkedAssetIds.length - b.linkedAssetIds.length; break;
        case 'linkedRisks': cmp = a.linkedRiskIds.length - b.linkedRiskIds.length; break;
        default: cmp = a.name.localeCompare(b.name);
      }
      return cmp * dir;
    });
    return list;
  }, [filtered, sortCol, sortDir]);

  const handleSort = useCallback((col: string) => {
    setSortDir(prev => sortCol === col ? (prev === 'asc' ? 'desc' : 'asc') : 'asc');
    setSortCol(col);
  }, [sortCol]);

  const updateThirdParty = useCallback((id: string, patch: Partial<GrcThirdParty>) => {
    applyWorkspace({
      ...workspace,
      thirdParties: thirdParties.map(tp => tp.id === id ? { ...tp, ...patch } : tp)
    });
  }, [applyWorkspace, workspace, thirdParties]);

  const handleAdd = useCallback(() => {
    const name = newName.trim();
    if (!name) { setStatusMessage({ severity: 'warning', text: 'Third party name is required.' }); return; }
    const tp: GrcThirdParty = {
      id: createId('tp'), name, description: '', category: newCategory,
      status: newStatus, riskRating: newRiskRating, dataClassification: newDataClass,
      linkedAssetIds: [], linkedRiskIds: [],
      contactName: newContact.trim(), contactEmail: newEmail.trim(),
      contractExpiry: '', lastAssessmentDate: '', nextReviewDate: '', notes: ''
    };
    applyWorkspace({ ...workspace, thirdParties: [...thirdParties, tp] });
    setNewName(''); setNewContact(''); setNewEmail('');
    setNewCategory('saas'); setNewStatus('onboarding');
    setNewRiskRating('not_assessed'); setNewDataClass('internal');
    setShowForm(false);
    setStatusMessage({ severity: 'success', text: `Added third party "${name}".` });
  }, [applyWorkspace, workspace, thirdParties, newName, newCategory, newStatus, newRiskRating, newDataClass, newContact, newEmail, setStatusMessage]);

  const handleDelete = useCallback((id: string) => {
    const tp = thirdParties.find(t => t.id === id);
    applyWorkspace({ ...workspace, thirdParties: thirdParties.filter(t => t.id !== id) });
    setDeleteId(null);
    if (tp) setStatusMessage({ severity: 'success', text: `Deleted third party "${tp.name}".` });
  }, [applyWorkspace, workspace, thirdParties, setStatusMessage]);

  const toDelete = deleteId ? thirdParties.find(t => t.id === deleteId) : null;

  const renderCell = useCallback((colId: string, tp: GrcThirdParty) => {
    switch (colId) {
      case 'name':
        return (
          <TextField size="small" value={tp.name} variant="standard"
            sx={{ minWidth: 140 }}
            InputProps={{ disableUnderline: true, sx: { fontWeight: 600, fontSize: '0.875rem' } }}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
              if (e.target.value.trim()) updateThirdParty(tp.id, { name: e.target.value });
            }} />
        );
      case 'category': {
        const color = CATEGORY_COLORS[tp.category];
        return (
          <Box component="span" sx={{
            px: 1, py: 0.25, borderRadius: 1, fontSize: '0.75rem', fontWeight: 600,
            bgcolor: color + '22', color, border: `1px solid ${color}44`
          }}>
            {categoryLabels[tp.category]}
          </Box>
        );
      }
      case 'status': {
        const color = STATUS_COLORS[tp.status];
        return (
          <Box component="span" sx={{
            px: 1, py: 0.25, borderRadius: 1, fontSize: '0.75rem', fontWeight: 600,
            bgcolor: color + '22', color
          }}>
            {statusLabels[tp.status]}
          </Box>
        );
      }
      case 'riskRating': {
        const color = RISK_RATING_COLORS[tp.riskRating];
        return (
          <Box component="span" sx={{
            px: 1, py: 0.25, borderRadius: 1, fontSize: '0.75rem', fontWeight: 600,
            bgcolor: color + '22', color
          }}>
            {riskRatingLabels[tp.riskRating]}
          </Box>
        );
      }
      case 'dataClassification':
        return <Typography variant="body2">{dataClassificationLabels[tp.dataClassification]}</Typography>;
      case 'contact':
        return tp.contactName
          ? <Typography variant="body2" sx={{ fontSize: '0.85rem' }}>{tp.contactName}</Typography>
          : <Typography variant="caption" color="text.disabled">—</Typography>;
      case 'contractExpiry':
        return tp.contractExpiry
          ? <Typography variant="body2" sx={{ fontSize: '0.85rem' }}>{tp.contractExpiry}</Typography>
          : <Typography variant="caption" color="text.disabled">—</Typography>;
      case 'nextReview':
        return tp.nextReviewDate
          ? <Typography variant="body2" sx={{ fontSize: '0.85rem' }}>{tp.nextReviewDate}</Typography>
          : <Typography variant="caption" color="text.disabled">—</Typography>;
      case 'linkedAssets': {
        const count = tp.linkedAssetIds.length;
        return count > 0
          ? <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.25 }}>
              {tp.linkedAssetIds.map(id => {
                const a = assets.find(x => x.id === id);
                return (
                  <Chip key={id} size="small" label={a?.name || id} variant="outlined"
                    onClick={(e) => { e.stopPropagation(); onSwitchTab?.('assets', id); }}
                    sx={{ cursor: 'pointer' }} />
                );
              })}
            </Box>
          : <Typography variant="caption" color="text.disabled">—</Typography>;
      }
      case 'linkedRisks': {
        const count = tp.linkedRiskIds.length;
        return count > 0
          ? <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.25 }}>
              {tp.linkedRiskIds.map(id => {
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
          <Tooltip title="Delete this third party" arrow>
            <IconButton size="small" onClick={(e) => { e.stopPropagation(); setDeleteId(tp.id); }}>
              <Trash2 size={16} />
            </IconButton>
          </Tooltip>
        );
      default: return null;
    }
  }, [updateThirdParty, assets, risks, onSwitchTab]);

  const renderExpanded = useCallback((tp: GrcThirdParty) => (
    <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 2, bgcolor: 'action.hover' }}>
      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
        <Box sx={{ flex: 3, minWidth: 300 }}>
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, mb: 0.5, display: 'block' }}>Description</Typography>
          <TextField size="small" fullWidth multiline minRows={6} maxRows={12}
            value={tp.description} placeholder="Detailed description of this third party"
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateThirdParty(tp.id, { description: e.target.value })} />
        </Box>
        <Box sx={{ flex: 2, minWidth: 300, display: 'grid', gap: 2, gridTemplateColumns: '1fr 1fr', alignContent: 'start' }}>
      <Box>
        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, mb: 0.5, display: 'block' }}>Category</Typography>
        <TextField size="small" fullWidth select value={tp.category}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateThirdParty(tp.id, { category: e.target.value as GrcThirdPartyCategory })}>
          {(Object.keys(categoryLabels) as GrcThirdPartyCategory[]).map(k => <MenuItem key={k} value={k}>{categoryLabels[k]}</MenuItem>)}
        </TextField>
      </Box>
      <Box>
        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, mb: 0.5, display: 'block' }}>Status</Typography>
        <TextField size="small" fullWidth select value={tp.status}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateThirdParty(tp.id, { status: e.target.value as GrcThirdPartyStatus })}>
          {(Object.keys(statusLabels) as GrcThirdPartyStatus[]).map(k => <MenuItem key={k} value={k}>{statusLabels[k]}</MenuItem>)}
        </TextField>
      </Box>
      <Box>
        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, mb: 0.5, display: 'block' }}>Risk Rating</Typography>
        <TextField size="small" fullWidth select value={tp.riskRating}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateThirdParty(tp.id, { riskRating: e.target.value as GrcThirdPartyRiskRating })}>
          {(Object.keys(riskRatingLabels) as GrcThirdPartyRiskRating[]).map(k => <MenuItem key={k} value={k}>{riskRatingLabels[k]}</MenuItem>)}
        </TextField>
      </Box>
      <Box>
        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, mb: 0.5, display: 'block' }}>Data Classification</Typography>
        <TextField size="small" fullWidth select value={tp.dataClassification}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateThirdParty(tp.id, { dataClassification: e.target.value as GrcThirdPartyDataClassification })}>
          {(Object.keys(dataClassificationLabels) as GrcThirdPartyDataClassification[]).map(k => <MenuItem key={k} value={k}>{dataClassificationLabels[k]}</MenuItem>)}
        </TextField>
      </Box>
      <Box>
        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, mb: 0.5, display: 'block' }}>Contact Name</Typography>
        <TextField size="small" fullWidth value={tp.contactName}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateThirdParty(tp.id, { contactName: e.target.value })} />
      </Box>
      <Box>
        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, mb: 0.5, display: 'block' }}>Contact Email</Typography>
        <TextField size="small" fullWidth value={tp.contactEmail}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateThirdParty(tp.id, { contactEmail: e.target.value })} />
      </Box>
      <Box>
        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, mb: 0.5, display: 'block' }}>Contract Expiry</Typography>
        <TextField size="small" fullWidth type="date" value={tp.contractExpiry}
          InputLabelProps={{ shrink: true }}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateThirdParty(tp.id, { contractExpiry: e.target.value })} />
      </Box>
      <Box>
        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, mb: 0.5, display: 'block' }}>Last Assessment Date</Typography>
        <TextField size="small" fullWidth type="date" value={tp.lastAssessmentDate}
          InputLabelProps={{ shrink: true }}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateThirdParty(tp.id, { lastAssessmentDate: e.target.value })} />
      </Box>
      <Box>
        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, mb: 0.5, display: 'block' }}>Next Review Date</Typography>
        <TextField size="small" fullWidth type="date" value={tp.nextReviewDate}
          InputLabelProps={{ shrink: true }}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateThirdParty(tp.id, { nextReviewDate: e.target.value })} />
      </Box>
      <Box>
        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, mb: 0.5, display: 'block' }}>Linked Assets</Typography>
        <FormControl size="small" fullWidth>
          <InputLabel>Assets</InputLabel>
          <Select multiple value={tp.linkedAssetIds}
            onChange={e => updateThirdParty(tp.id, { linkedAssetIds: typeof e.target.value === 'string' ? e.target.value.split(',') : e.target.value as string[] })}
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
        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, mb: 0.5, display: 'block' }}>Linked Risks</Typography>
        <FormControl size="small" fullWidth>
          <InputLabel>Risks</InputLabel>
          <Select multiple value={tp.linkedRiskIds}
            onChange={e => updateThirdParty(tp.id, { linkedRiskIds: typeof e.target.value === 'string' ? e.target.value.split(',') : e.target.value as string[] })}
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
        </Box>
      </Box>
      <Box>
        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, mb: 0.5, display: 'block' }}>Notes</Typography>
        <TextField size="small" fullWidth multiline minRows={2} maxRows={6}
          value={tp.notes} placeholder="Internal notes"
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateThirdParty(tp.id, { notes: e.target.value })} />
      </Box>
    </Box>
  ), [updateThirdParty, assets, risks, onSwitchTab]);

  if (thirdParties.length === 0 && !showForm) {
    return (
      <Box sx={{ display: 'grid', gap: 2 }}>
        <Paper sx={{ ...cardSx, textAlign: 'center', py: 6 }}>
          <Shield size={40} style={{ opacity: 0.3, marginBottom: 8 }} />
          <Typography variant="h6" sx={{ mb: 1 }}>No third parties registered yet</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 520, mx: 'auto', mb: 1, lineHeight: 1.8 }}>
            Track your vendors, cloud providers, contractors, and other third-party relationships.
            Link them to assets and risks to maintain visibility over your supply chain risk posture.
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 520, mx: 'auto', mb: 3, lineHeight: 1.8 }}>
            Each third party can carry a risk rating, data classification, contract expiry tracking,
            and assessment review scheduling.
          </Typography>
          <Button variant="contained" startIcon={<Plus size={16} />} onClick={() => setShowForm(true)}>
            Add First Third Party
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
            <Typography variant="h6" sx={{ mb: 0.5 }}>Third-Party Risk Management</Typography>
            <Typography variant="body2" color="text.secondary">
              Vendor and supplier risk profiles with contract and assessment tracking.
            </Typography>
          </Box>
          <Button variant="contained" startIcon={<Plus size={16} />} size="small"
            onClick={() => setShowForm(!showForm)}>
            Add Third Party
          </Button>
        </Box>

        <Collapse in={showForm} timeout="auto" unmountOnExit>
          <Box sx={{ mt: 2, p: 2, bgcolor: 'action.hover', borderRadius: 1, display: 'grid', gap: 1.5 }}>
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 1.5 }}>
              <TextField size="small" label="Name" value={newName}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewName(e.target.value)} />
              <TextField size="small" select label="Category" value={newCategory}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewCategory(e.target.value as GrcThirdPartyCategory)}>
                {(Object.keys(categoryLabels) as GrcThirdPartyCategory[]).map(k => <MenuItem key={k} value={k}>{categoryLabels[k]}</MenuItem>)}
              </TextField>
              <TextField size="small" select label="Status" value={newStatus}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewStatus(e.target.value as GrcThirdPartyStatus)}>
                {(Object.keys(statusLabels) as GrcThirdPartyStatus[]).map(k => <MenuItem key={k} value={k}>{statusLabels[k]}</MenuItem>)}
              </TextField>
              <TextField size="small" select label="Risk Rating" value={newRiskRating}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewRiskRating(e.target.value as GrcThirdPartyRiskRating)}>
                {(Object.keys(riskRatingLabels) as GrcThirdPartyRiskRating[]).map(k => <MenuItem key={k} value={k}>{riskRatingLabels[k]}</MenuItem>)}
              </TextField>
              <TextField size="small" select label="Data Classification" value={newDataClass}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewDataClass(e.target.value as GrcThirdPartyDataClassification)}>
                {(Object.keys(dataClassificationLabels) as GrcThirdPartyDataClassification[]).map(k => <MenuItem key={k} value={k}>{dataClassificationLabels[k]}</MenuItem>)}
              </TextField>
              <TextField size="small" label="Contact Name" value={newContact}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewContact(e.target.value)} />
              <TextField size="small" label="Contact Email" value={newEmail}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewEmail(e.target.value)} />
            </Box>
            <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
              <Button size="small" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button variant="contained" size="small" startIcon={<Plus size={16} />} onClick={handleAdd}
                disabled={!newName.trim()}>Add Third Party</Button>
            </Box>
          </Box>
        </Collapse>
      </Paper>

      {thirdParties.length > 0 && (
        <TableContainer component={Paper} sx={cardSx}>
          <Box sx={{ p: 1.5, borderBottom: '1px solid', borderColor: 'divider', display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center' }}>
            <TextField size="small" placeholder="Search third parties..." value={search}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)} sx={{ minWidth: 180 }} />
            <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
              <Typography variant="caption" color="text.secondary" sx={{ mr: 0.5 }}>Category:</Typography>
              <Chip size="small" label="All"
                variant={categoryFilter === 'all' ? 'filled' : 'outlined'}
                color={categoryFilter === 'all' ? 'primary' : 'default'}
                onClick={() => setCategoryFilter('all')} />
              {(Object.keys(categoryLabels) as GrcThirdPartyCategory[]).map(k => (
                <Chip key={k} size="small" label={categoryLabels[k]}
                  variant={categoryFilter === k ? 'filled' : 'outlined'}
                  color={categoryFilter === k ? 'primary' : 'default'}
                  onClick={() => setCategoryFilter(k)} />
              ))}
            </Box>
            <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
              <Typography variant="caption" color="text.secondary" sx={{ mr: 0.5 }}>Status:</Typography>
              <Chip size="small" label="All"
                variant={statusFilter === 'all' ? 'filled' : 'outlined'}
                color={statusFilter === 'all' ? 'primary' : 'default'}
                onClick={() => setStatusFilter('all')} />
              {(Object.keys(statusLabels) as GrcThirdPartyStatus[]).map(k => (
                <Chip key={k} size="small" label={statusLabels[k]}
                  variant={statusFilter === k ? 'filled' : 'outlined'}
                  color={statusFilter === k ? 'primary' : 'default'}
                  onClick={() => setStatusFilter(k)} />
              ))}
            </Box>
            <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto' }}>
              {sorted.length} of {thirdParties.length} third parties
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
              {sorted.map(tp => {
                const isExpanded = expandedId === tp.id;
                return (
                  <React.Fragment key={tp.id}>
                    <TableRow id={`grc-tp-${tp.id}`} hover sx={{
                      cursor: 'pointer', '& > *': { borderBottom: isExpanded ? 'none' : undefined },
                      ...(highlightId === tp.id && { bgcolor: 'action.selected', transition: 'background-color 0.3s' })
                    }}
                      onClick={() => setExpandedId(isExpanded ? null : tp.id)}>
                      <TableCell padding="checkbox">
                        <IconButton size="small" sx={{ p: 0.25 }}>
                          {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                        </IconButton>
                      </TableCell>
                      {columnConfig.visibleColumns.map(col => (
                        <TableCell key={col.id} onClick={e => {
                          if (col.id === 'name') e.stopPropagation();
                        }}>
                          {renderCell(col.id, tp)}
                        </TableCell>
                      ))}
                      <TableCell padding="none" />
                    </TableRow>
                    {isExpanded && (
                      <TableRow>
                        <TableCell colSpan={columnConfig.visibleColumns.length + 2} sx={{ py: 0, px: 0 }}>
                          <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                            {renderExpanded(tp)}
                          </Collapse>
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                );
              })}
              {sorted.length === 0 && thirdParties.length > 0 && (
                <TableRow>
                  <TableCell colSpan={columnConfig.visibleColumns.length + 2}>
                    <Typography variant="body2" color="text.secondary" sx={{ py: 1 }}>
                      No third parties match the current filters.
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Dialog open={Boolean(toDelete)} onClose={() => setDeleteId(null)}>
        <DialogTitle>Delete Third Party</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Delete "{toDelete?.name}"? This will remove the third-party record. Linked assets and risks will not be affected.
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

export default GrcTprmTab;
