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
  Link,
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
import { ChevronDown, ChevronRight, ExternalLink, FileText, Plus, Trash2 } from 'lucide-react';
import {
  GrcGovernanceDocStatus,
  GrcGovernanceDocType,
  GrcGovernanceDocument
} from '../../types/GrcTypes';
import { GrcTabProps, cardSx, createId } from './grcShared';
import { useTableColumnConfig, ColumnDef } from './useTableColumnConfig';
import TableColumnConfigPopover from './TableColumnConfigPopover';

const docTypeLabels: Record<GrcGovernanceDocType, string> = {
  policy: 'Policy',
  process: 'Process',
  procedure: 'Procedure',
  guideline: 'Guideline',
  sop: 'SOP',
  standard: 'Standard',
  framework: 'Framework',
  other: 'Other'
};

const docStatusLabels: Record<GrcGovernanceDocStatus, string> = {
  draft: 'Draft',
  active: 'Active',
  under_review: 'Under Review',
  archived: 'Archived',
  superseded: 'Superseded'
};

const STATUS_COLORS: Record<GrcGovernanceDocStatus, string> = {
  draft: '#6b7280',
  active: '#059669',
  under_review: '#ca8a04',
  archived: '#6366f1',
  superseded: '#dc2626'
};

const TYPE_COLORS: Record<GrcGovernanceDocType, string> = {
  policy: '#2563eb',
  process: '#7c3aed',
  procedure: '#0891b2',
  guideline: '#059669',
  sop: '#ea580c',
  standard: '#6366f1',
  framework: '#be185d',
  other: '#6b7280'
};

const GOV_COLUMNS: ColumnDef[] = [
  { id: 'title', label: 'Document', defaultVisible: true, removable: false },
  { id: 'type', label: 'Type', defaultVisible: true, removable: true },
  { id: 'status', label: 'Status', defaultVisible: true, removable: true },
  { id: 'owner', label: 'Owner', defaultVisible: true, removable: true },
  { id: 'version', label: 'Version', defaultVisible: true, removable: true },
  { id: 'nextReview', label: 'Next Review', defaultVisible: true, removable: true },
  { id: 'linkedRisks', label: 'Linked Risks', defaultVisible: true, removable: true },
  { id: 'linkedControlSets', label: 'Control Sets', defaultVisible: false, removable: true },
  { id: 'reviewedBy', label: 'Reviewed By', defaultVisible: false, removable: true },
  { id: 'approvedBy', label: 'Approved By', defaultVisible: false, removable: true },
  { id: 'approvalDate', label: 'Approval Date', defaultVisible: false, removable: true },
  { id: 'link', label: 'Link', defaultVisible: true, removable: true },
  { id: 'actions', label: 'Actions', defaultVisible: true, removable: false }
];

const SORTABLE_COLUMNS = new Set([
  'title', 'type', 'status', 'owner', 'version', 'nextReview', 'linkedRisks', 'reviewedBy', 'approvedBy', 'approvalDate'
]);

type SortDir = 'asc' | 'desc';

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

const toDateInputValue = (value?: string): string => {
  if (!value) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toISOString().slice(0, 10);
};

const GrcGovernanceTab: React.FC<GrcTabProps> = ({
  workspace,
  applyWorkspace,
  setStatusMessage,
  focusRequest,
  getTabViewState,
  setTabViewState
}) => {
  const documents = useMemo(() => workspace.governanceDocuments || [], [workspace.governanceDocuments]);
  const persistedView = getTabViewState?.('governance', {
    expandedId: null
  }) ?? {
    expandedId: null
  };

  const [addFormOpen, setAddFormOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newType, setNewType] = useState<GrcGovernanceDocType>('policy');
  const [newDescription, setNewDescription] = useState('');
  const [newOwner, setNewOwner] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [newVersion, setNewVersion] = useState('');
  const [newStatus, setNewStatus] = useState<GrcGovernanceDocStatus>('draft');
  const [newNextReviewDate, setNewNextReviewDate] = useState('');
  const [newLinkedRiskIds, setNewLinkedRiskIds] = useState<string[]>([]);
  const [newLinkedControlSetIds, setNewLinkedControlSetIds] = useState<string[]>([]);
  const [newReviewedBy, setNewReviewedBy] = useState('');
  const [newApprovedBy, setNewApprovedBy] = useState('');
  const [newApprovalDate, setNewApprovalDate] = useState('');

  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<GrcGovernanceDocType | 'all'>('all');
  const [filterStatus, setFilterStatus] = useState<GrcGovernanceDocStatus | 'all'>('all');
  const [searchText, setSearchText] = useState('');

  const [sortColumn, setSortColumn] = useState<string>('title');
  const [sortDirection, setSortDirection] = useState<SortDir>('asc');
  const [expandedId, setExpandedId] = useState<string | null>((persistedView.expandedId as string | null) ?? null);
  const [highlightId, setHighlightId] = useState<string | null>(null);

  useEffect(() => {
    if (focusRequest?.tab === 'governance' && focusRequest.entityId) {
      const id = focusRequest.entityId;
      if (documents.some(d => d.id === id)) {
        setExpandedId(id);
        setHighlightId(id);
        setTimeout(() => {
          document.getElementById(`grc-gov-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 100);
        setTimeout(() => setHighlightId(null), 2000);
      }
    }
  }, [focusRequest, documents]);

  useEffect(() => {
    setTabViewState?.('governance', {
      expandedId
    });
  }, [expandedId, setTabViewState]);

  const columnConfig = useTableColumnConfig('governance', GOV_COLUMNS, workspace, applyWorkspace);

  const filteredDocuments = useMemo(() => {
    let result = documents;
    if (filterType !== 'all') {
      result = result.filter(doc => doc.type === filterType);
    }
    if (filterStatus !== 'all') {
      result = result.filter(doc => doc.status === filterStatus);
    }
    if (searchText.trim()) {
      const query = searchText.trim().toLowerCase();
      result = result.filter(doc =>
        doc.title.toLowerCase().includes(query)
        || (doc.description || '').toLowerCase().includes(query)
        || (doc.owner || '').toLowerCase().includes(query)
        || (doc.tags || []).some(tag => tag.toLowerCase().includes(query))
      );
    }
    return result;
  }, [documents, filterType, filterStatus, searchText]);

  const sortedDocuments = useMemo(() => {
    const list = [...filteredDocuments];
    const dir = sortDirection === 'asc' ? 1 : -1;
    list.sort((a, b) => {
      let cmp = 0;
      switch (sortColumn) {
        case 'title':
          cmp = a.title.localeCompare(b.title);
          break;
        case 'type':
          cmp = a.type.localeCompare(b.type);
          break;
        case 'status':
          cmp = a.status.localeCompare(b.status);
          break;
        case 'owner':
          cmp = (a.owner || '').localeCompare(b.owner || '');
          break;
        case 'version':
          cmp = (a.version || '').localeCompare(b.version || '');
          break;
        case 'nextReview':
          cmp = (a.nextReviewDate || '').localeCompare(b.nextReviewDate || '');
          break;
        case 'linkedRisks':
          cmp = a.linkedRiskIds.length - b.linkedRiskIds.length;
          break;
        case 'reviewedBy':
          cmp = (a.reviewedBy || '').localeCompare(b.reviewedBy || '');
          break;
        case 'approvedBy':
          cmp = (a.approvedBy || '').localeCompare(b.approvedBy || '');
          break;
        case 'approvalDate':
          cmp = (a.approvalDate || '').localeCompare(b.approvalDate || '');
          break;
        default:
          cmp = a.title.localeCompare(b.title);
      }
      return cmp * dir;
    });
    return list;
  }, [filteredDocuments, sortColumn, sortDirection]);

  const handleSort = useCallback((columnId: string) => {
    setSortDirection(prev => sortColumn === columnId ? (prev === 'asc' ? 'desc' : 'asc') : 'asc');
    setSortColumn(columnId);
  }, [sortColumn]);

  const handleAddDocument = useCallback(() => {
    const title = newTitle.trim();
    if (!title) {
      setStatusMessage({ severity: 'warning', text: 'Document title is required.' });
      return;
    }

    const now = new Date().toISOString();
    const doc: GrcGovernanceDocument = {
      id: createId('gov'),
      title,
      type: newType,
      description: newDescription.trim() || undefined,
      owner: newOwner.trim() || undefined,
      reviewDate: undefined,
      nextReviewDate: newNextReviewDate || undefined,
      status: newStatus,
      version: newVersion.trim() || undefined,
      url: newUrl.trim() || undefined,
      tags: [],
      linkedRiskIds: [...newLinkedRiskIds],
      linkedControlSetIds: [...newLinkedControlSetIds],
      linkedAssessmentIds: [],
      reviewedBy: newReviewedBy.trim() || undefined,
      approvedBy: newApprovedBy.trim() || undefined,
      approvalDate: newApprovalDate || undefined,
      createdAt: now,
      updatedAt: now
    };

    applyWorkspace({
      ...workspace,
      governanceDocuments: [...documents, doc]
    });
    setNewTitle('');
    setNewDescription('');
    setNewOwner('');
    setNewUrl('');
    setNewVersion('');
    setNewNextReviewDate('');
    setNewLinkedRiskIds([]);
    setNewLinkedControlSetIds([]);
    setNewReviewedBy('');
    setNewApprovedBy('');
    setNewApprovalDate('');
    setAddFormOpen(false);
    setStatusMessage({ severity: 'success', text: `Added governance document "${title}".` });
  }, [
    applyWorkspace, documents, newApprovalDate, newApprovedBy, newDescription, newLinkedControlSetIds,
    newLinkedRiskIds, newNextReviewDate, newOwner, newReviewedBy, newStatus, newTitle,
    newType, newUrl, newVersion, setStatusMessage, workspace
  ]);

  const updateDocument = useCallback((docId: string, patch: Partial<GrcGovernanceDocument>) => {
    const now = new Date().toISOString();
    applyWorkspace({
      ...workspace,
      governanceDocuments: documents.map(doc =>
        doc.id === docId ? { ...doc, ...patch, updatedAt: now } : doc
      )
    });
  }, [applyWorkspace, documents, workspace]);

  const handleDeleteDocument = useCallback((docId: string) => {
    const cleanedSoaEntries = workspace.soaEntries.map(entry => {
      const hasRef = entry.evidence.some(ev => ev.governanceDocId === docId);
      if (!hasRef) return entry;
      return {
        ...entry,
        evidence: entry.evidence.map(ev =>
          ev.governanceDocId === docId ? { ...ev, governanceDocId: undefined } : ev
        )
      };
    });
    applyWorkspace({
      ...workspace,
      governanceDocuments: documents.filter(doc => doc.id !== docId),
      soaEntries: cleanedSoaEntries
    });
    setDeleteConfirmId(null);
    setStatusMessage({ severity: 'success', text: 'Governance document removed.' });
  }, [applyWorkspace, documents, setStatusMessage, workspace]);

  const deleteTarget = useMemo(
    () => documents.find(doc => doc.id === deleteConfirmId),
    [deleteConfirmId, documents]
  );

  const renderCellContent = useCallback((columnId: string, doc: GrcGovernanceDocument) => {
    const statusColor = STATUS_COLORS[doc.status];
    const typeColor = TYPE_COLORS[doc.type];

    switch (columnId) {
      case 'title':
        return (
          <TextField
            size="small"
            value={doc.title}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              updateDocument(doc.id, { title: e.target.value })
            }
            variant="standard"
            sx={{ minWidth: 180 }}
            InputProps={{ disableUnderline: true, sx: { fontWeight: 600, fontSize: '0.875rem' } }}
          />
        );
      case 'type':
        return (
          <Box
            component="span"
            sx={{
              px: 1, py: 0.25, borderRadius: 1, fontSize: '0.75rem', fontWeight: 600,
              bgcolor: typeColor + '22', color: typeColor, border: `1px solid ${typeColor}44`
            }}
          >
            {docTypeLabels[doc.type]}
          </Box>
        );
      case 'status':
        return (
          <Box
            component="span"
            sx={{
              px: 1, py: 0.25, borderRadius: 1, fontSize: '0.75rem', fontWeight: 600,
              bgcolor: statusColor + '22', color: statusColor, border: `1px solid ${statusColor}44`
            }}
          >
            {docStatusLabels[doc.status]}
          </Box>
        );
      case 'owner':
        return (
          <TextField
            size="small"
            value={doc.owner || ''}
            placeholder="—"
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              updateDocument(doc.id, { owner: e.target.value.trim() || undefined })
            }
            variant="standard"
            InputProps={{ disableUnderline: true }}
            sx={{ minWidth: 100 }}
          />
        );
      case 'version':
        return (
          <TextField
            size="small"
            value={doc.version || ''}
            placeholder="—"
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              updateDocument(doc.id, { version: e.target.value.trim() || undefined })
            }
            variant="standard"
            InputProps={{ disableUnderline: true }}
            sx={{ minWidth: 60 }}
          />
        );
      case 'nextReview': {
        const status = reviewDateStatus(doc.nextReviewDate);
        const color = reviewDateColor(status);
        return (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <TextField
              size="small"
              type="date"
              variant="standard"
              value={toDateInputValue(doc.nextReviewDate)}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                updateDocument(doc.id, { nextReviewDate: e.target.value || undefined })
              }
              InputProps={{ disableUnderline: true }}
              InputLabelProps={{ shrink: true }}
              sx={{ minWidth: 120 }}
            />
            {status === 'overdue' && (
              <Typography variant="caption" sx={{ color, fontWeight: 700 }}>Overdue</Typography>
            )}
            {status === 'due-soon' && (
              <Typography variant="caption" sx={{ color, fontWeight: 600 }}>Due soon</Typography>
            )}
          </Box>
        );
      }
      case 'linkedRisks': {
        const count = doc.linkedRiskIds.length;
        return count > 0
          ? <Tooltip title={doc.linkedRiskIds.map(rId => workspace.risks.find(r => r.id === rId)?.title || rId).join(', ')} arrow>
              <Chip size="small" label={`${count} risk${count !== 1 ? 's' : ''}`} variant="outlined"
                onClick={() => setExpandedId(expandedId === doc.id ? null : doc.id)} />
            </Tooltip>
          : <Typography variant="caption" color="text.disabled">—</Typography>;
      }
      case 'linkedControlSets': {
        const count = doc.linkedControlSetIds.length;
        return count > 0
          ? <Chip size="small" label={`${count} set${count !== 1 ? 's' : ''}`} variant="outlined" />
          : <Typography variant="caption" color="text.disabled">—</Typography>;
      }
      case 'reviewedBy':
        return (
          <TextField
            size="small"
            value={doc.reviewedBy || ''}
            placeholder="—"
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              updateDocument(doc.id, { reviewedBy: e.target.value.trim() || undefined })
            }
            variant="standard"
            InputProps={{ disableUnderline: true }}
            sx={{ minWidth: 100 }}
          />
        );
      case 'approvedBy':
        return (
          <TextField
            size="small"
            value={doc.approvedBy || ''}
            placeholder="—"
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              updateDocument(doc.id, { approvedBy: e.target.value.trim() || undefined })
            }
            variant="standard"
            InputProps={{ disableUnderline: true }}
            sx={{ minWidth: 100 }}
          />
        );
      case 'approvalDate':
        return (
          <TextField
            size="small"
            type="date"
            variant="standard"
            value={toDateInputValue(doc.approvalDate)}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              updateDocument(doc.id, { approvalDate: e.target.value || undefined })
            }
            InputProps={{ disableUnderline: true }}
            InputLabelProps={{ shrink: true }}
            sx={{ minWidth: 120 }}
          />
        );
      case 'link':
        return doc.url ? (
          <Tooltip title={`Open: ${doc.url}`} arrow>
            <Link href={doc.url} target="_blank" rel="noopener noreferrer"
              sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <ExternalLink size={14} />
              <Typography variant="caption">Open</Typography>
            </Link>
          </Tooltip>
        ) : (
          <Typography variant="caption" color="text.disabled">—</Typography>
        );
      case 'actions':
        return (
          <Tooltip title="Remove this document from the registry" arrow>
            <IconButton size="small" onClick={() => setDeleteConfirmId(doc.id)}>
              <Trash2 size={16} />
            </IconButton>
          </Tooltip>
        );
      default:
        return null;
    }
  }, [expandedId, updateDocument, workspace.risks]);

  const renderExpandedDetail = useCallback((doc: GrcGovernanceDocument) => {
    return (
      <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 2, bgcolor: 'action.hover', overflow: 'hidden', maxWidth: '100%' }}>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', minWidth: 0 }}>
          <Box sx={{ flex: 3, minWidth: 200 }}>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, mb: 0.5, display: 'block' }}>
              Description
            </Typography>
            <TextField
              size="small"
              fullWidth
              multiline
              minRows={6}
              maxRows={12}
              value={doc.description || ''}
              placeholder="Brief description of the document's purpose, scope, and key content"
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                updateDocument(doc.id, { description: e.target.value || undefined })
              }
            />
          </Box>
          <Box sx={{ flex: 2, minWidth: 0, display: 'grid', gap: 2, gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', alignContent: 'start' }}>
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, mb: 0.5, display: 'block' }}>
                Type
              </Typography>
              <TextField size="small" fullWidth select value={doc.type}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  updateDocument(doc.id, { type: e.target.value as GrcGovernanceDocType })
                }>
                {(Object.keys(docTypeLabels) as GrcGovernanceDocType[]).map(key => (
                  <MenuItem key={key} value={key}>{docTypeLabels[key]}</MenuItem>
                ))}
              </TextField>
            </Box>

            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, mb: 0.5, display: 'block' }}>
                Status
              </Typography>
              <TextField size="small" fullWidth select value={doc.status}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  updateDocument(doc.id, { status: e.target.value as GrcGovernanceDocStatus })
                }>
                {(Object.keys(docStatusLabels) as GrcGovernanceDocStatus[]).map(key => (
                  <MenuItem key={key} value={key}>{docStatusLabels[key]}</MenuItem>
                ))}
              </TextField>
            </Box>

            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, mb: 0.5, display: 'block' }}>
                Tags
              </Typography>
              <TextField
                size="small"
                fullWidth
                value={(doc.tags || []).join(', ')}
                placeholder="Comma-separated tags"
                onBlur={(e) => {
                  const tags = e.target.value.split(',').map(t => t.trim()).filter(Boolean);
                  updateDocument(doc.id, { tags });
                }}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                  updateDocument(doc.id, { tags: e.target.value.split(',').map(t => t.trim()).filter(Boolean) });
                }}
              />
            </Box>

            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, mb: 0.5, display: 'block' }}>
                Reviewed By
              </Typography>
              <TextField
                size="small"
                fullWidth
                value={doc.reviewedBy || ''}
                placeholder="Reviewer name"
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  updateDocument(doc.id, { reviewedBy: e.target.value.trim() || undefined })
                }
              />
            </Box>

            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, mb: 0.5, display: 'block' }}>
                Approved By
              </Typography>
              <TextField
                size="small"
                fullWidth
                value={doc.approvedBy || ''}
                placeholder="Approver name"
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  updateDocument(doc.id, { approvedBy: e.target.value.trim() || undefined })
                }
              />
            </Box>

            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, mb: 0.5, display: 'block' }}>
                Approval Date
              </Typography>
              <TextField
                size="small"
                fullWidth
                type="date"
                value={toDateInputValue(doc.approvalDate)}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  updateDocument(doc.id, { approvalDate: e.target.value || undefined })
                }
                InputLabelProps={{ shrink: true }}
              />
            </Box>

            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, mb: 0.5, display: 'block' }}>
                Document URL
              </Typography>
              <TextField
                size="small"
                fullWidth
                value={doc.url || ''}
                placeholder="https://sharepoint.com/sites/..."
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  updateDocument(doc.id, { url: e.target.value.trim() || undefined })
                }
              />
            </Box>

            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, mb: 0.5, display: 'block' }}>
                Linked Risks
              </Typography>
          <FormControl size="small" fullWidth>
            <InputLabel id={`${doc.id}-detail-risks-label`}>Linked Risks</InputLabel>
            <Select
              labelId={`${doc.id}-detail-risks-label`}
              multiple
              value={doc.linkedRiskIds}
              onChange={e => {
                const value = e.target.value;
                const nextRiskIds = typeof value === 'string' ? value.split(',') : (value as string[]);
                updateDocument(doc.id, { linkedRiskIds: nextRiskIds });
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
            Linked Control Sets
          </Typography>
          <FormControl size="small" fullWidth>
            <InputLabel id={`${doc.id}-detail-cs-label`}>Linked Control Sets</InputLabel>
            <Select
              labelId={`${doc.id}-detail-cs-label`}
              multiple
              value={doc.linkedControlSetIds}
              onChange={e => {
                const value = e.target.value;
                const nextIds = typeof value === 'string' ? value.split(',') : (value as string[]);
                updateDocument(doc.id, { linkedControlSetIds: nextIds });
              }}
              input={<OutlinedInput label="Linked Control Sets" />}
              renderValue={selected =>
                (selected as string[])
                  .map(csId => workspace.controlSets.find(cs => cs.id === csId)?.name || csId)
                  .join(', ')
              }
            >
              {workspace.controlSets.map(cs => (
                <MenuItem key={cs.id} value={cs.id}>{cs.name}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>

        <Box>
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, mb: 0.5, display: 'block' }}>
            Linked Assessments
          </Typography>
          <FormControl size="small" fullWidth>
            <InputLabel id={`${doc.id}-detail-assess-label`}>Linked Assessments</InputLabel>
            <Select
              labelId={`${doc.id}-detail-assess-label`}
              multiple
              value={doc.linkedAssessmentIds}
              onChange={e => {
                const value = e.target.value;
                const nextIds = typeof value === 'string' ? value.split(',') : (value as string[]);
                updateDocument(doc.id, { linkedAssessmentIds: nextIds });
              }}
              input={<OutlinedInput label="Linked Assessments" />}
              renderValue={selected =>
                (selected as string[])
                  .map(aId => workspace.assessments.find(a => a.id === aId)?.title || aId)
                  .join(', ')
              }
            >
              {workspace.assessments.map(a => (
                <MenuItem key={a.id} value={a.id}>{a.title}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>
          </Box>
        </Box>

        <Typography variant="caption" color="text.disabled">
          Created: {new Date(doc.createdAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
          {doc.updatedAt && ` | Updated: ${new Date(doc.updatedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}`}
        </Typography>
      </Box>
    );
  }, [updateDocument, workspace.assessments, workspace.controlSets, workspace.risks]);

  if (documents.length === 0 && !addFormOpen) {
    return (
      <Box sx={{ display: 'grid', gap: 2 }}>
        <Paper sx={{ ...cardSx, textAlign: 'center', py: 6 }}>
          <FileText size={40} style={{ opacity: 0.3, marginBottom: 8 }} />
          <Typography variant="h6" sx={{ mb: 1 }}>
            No governance documents registered yet
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 520, mx: 'auto', mb: 1, lineHeight: 1.8 }}>
            Register your organisation's policies, processes, procedures, guidelines, and SOPs here.
            Documents are stored as references with links to your document management system.
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 520, mx: 'auto', mb: 3, lineHeight: 1.8 }}>
            Provide a title, type, and a URL (SharePoint, file share, Confluence, etc.) so the document
            can be opened directly from here. Link documents to risks and control sets for traceability.
          </Typography>
          <Button variant="contained" startIcon={<Plus size={16} />} onClick={() => setAddFormOpen(true)}>
            Add First Document
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
            <Typography variant="h6" sx={{ mb: 0.5 }}>Governance Document Registry</Typography>
            <Typography variant="body2" color="text.secondary">
              Register policies, processes, procedures, guidelines, SOPs, and standards.
              Documents are stored as references with links to your document management system.
            </Typography>
          </Box>
          <Button variant="contained" startIcon={<Plus size={16} />} onClick={() => setAddFormOpen(!addFormOpen)}
            size="small">
            Add Document
          </Button>
        </Box>

        <Collapse in={addFormOpen} timeout="auto" unmountOnExit>
          <Box sx={{ mt: 2, p: 2, bgcolor: 'action.hover', borderRadius: 1, display: 'grid', gap: 1.5 }}>
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 1.5 }}>
              <TextField size="small" label="Document Title" value={newTitle}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewTitle(e.target.value)} />
              <TextField size="small" select label="Document Type" value={newType}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewType(e.target.value as GrcGovernanceDocType)}>
                {(Object.keys(docTypeLabels) as GrcGovernanceDocType[]).map(key => (
                  <MenuItem key={key} value={key}>{docTypeLabels[key]}</MenuItem>
                ))}
              </TextField>
              <TextField size="small" select label="Status" value={newStatus}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewStatus(e.target.value as GrcGovernanceDocStatus)}>
                {(Object.keys(docStatusLabels) as GrcGovernanceDocStatus[]).map(key => (
                  <MenuItem key={key} value={key}>{docStatusLabels[key]}</MenuItem>
                ))}
              </TextField>
              <TextField size="small" label="Owner" value={newOwner}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewOwner(e.target.value)} />
              <TextField size="small" label="Version" value={newVersion}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewVersion(e.target.value)} />
              <TextField size="small" label="Document URL / Link" placeholder="https://sharepoint.com/sites/..."
                value={newUrl} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewUrl(e.target.value)} />
              <TextField size="small" type="date" label="Next Review Date" value={newNextReviewDate}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewNextReviewDate(e.target.value)}
                InputLabelProps={{ shrink: true }} />
              <TextField size="small" label="Reviewed By" value={newReviewedBy}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewReviewedBy(e.target.value)} />
              <TextField size="small" label="Approved By" value={newApprovedBy}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewApprovedBy(e.target.value)} />
              <TextField size="small" type="date" label="Approval Date" value={newApprovalDate}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewApprovalDate(e.target.value)}
                InputLabelProps={{ shrink: true }} />
            </Box>
            <TextField size="small" label="Description" value={newDescription}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewDescription(e.target.value)}
              fullWidth multiline minRows={2} />
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 1.5 }}>
              <FormControl size="small">
                <InputLabel id="gov-linked-risks-label">Linked Risks</InputLabel>
                <Select
                  labelId="gov-linked-risks-label"
                  multiple
                  value={newLinkedRiskIds}
                  onChange={e => {
                    const value = e.target.value;
                    setNewLinkedRiskIds(typeof value === 'string' ? value.split(',') : (value as string[]));
                  }}
                  input={<OutlinedInput label="Linked Risks" />}
                  renderValue={selected =>
                    (selected as string[]).map(riskId => workspace.risks.find(r => r.id === riskId)?.title || riskId).join(', ')
                  }
                >
                  {workspace.risks.map(risk => (
                    <MenuItem key={risk.id} value={risk.id}>{risk.title}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl size="small">
                <InputLabel id="gov-linked-controls-label">Linked Control Sets</InputLabel>
                <Select
                  labelId="gov-linked-controls-label"
                  multiple
                  value={newLinkedControlSetIds}
                  onChange={e => {
                    const value = e.target.value;
                    setNewLinkedControlSetIds(typeof value === 'string' ? value.split(',') : (value as string[]));
                  }}
                  input={<OutlinedInput label="Linked Control Sets" />}
                  renderValue={selected =>
                    (selected as string[]).map(csId => workspace.controlSets.find(cs => cs.id === csId)?.name || csId).join(', ')
                  }
                >
                  {workspace.controlSets.map(cs => (
                    <MenuItem key={cs.id} value={cs.id}>{cs.name}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>
            <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
              <Button size="small" onClick={() => setAddFormOpen(false)}>Cancel</Button>
              <Button variant="contained" size="small" startIcon={<Plus size={16} />} onClick={handleAddDocument}
                disabled={!newTitle.trim()}>
                Add Document
              </Button>
            </Box>
          </Box>
        </Collapse>
      </Paper>

      {documents.length > 0 && (
        <TableContainer component={Paper} sx={{ ...cardSx, overflow: 'hidden' }}>
          <Box sx={{ p: 1.5, borderBottom: '1px solid', borderColor: 'divider', display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center' }}>
            <TextField
              size="small"
              placeholder="Search documents..."
              value={searchText}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchText(e.target.value)}
              sx={{ minWidth: 200 }}
            />

            <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
              <Typography variant="caption" color="text.secondary" sx={{ mr: 0.5 }}>Type:</Typography>
              <Chip size="small" label="All"
                variant={filterType === 'all' ? 'filled' : 'outlined'}
                color={filterType === 'all' ? 'primary' : 'default'}
                onClick={() => setFilterType('all')} />
              {(Object.keys(docTypeLabels) as GrcGovernanceDocType[]).map(key => (
                <Chip key={key} size="small" label={docTypeLabels[key]}
                  variant={filterType === key ? 'filled' : 'outlined'}
                  color={filterType === key ? 'primary' : 'default'}
                  onClick={() => setFilterType(key)} />
              ))}
            </Box>

            <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
              <Typography variant="caption" color="text.secondary" sx={{ mr: 0.5 }}>Status:</Typography>
              <Chip size="small" label="All"
                variant={filterStatus === 'all' ? 'filled' : 'outlined'}
                color={filterStatus === 'all' ? 'primary' : 'default'}
                onClick={() => setFilterStatus('all')} />
              {(Object.keys(docStatusLabels) as GrcGovernanceDocStatus[]).map(key => (
                <Chip key={key} size="small" label={docStatusLabels[key]}
                  variant={filterStatus === key ? 'filled' : 'outlined'}
                  color={filterStatus === key ? 'primary' : 'default'}
                  onClick={() => setFilterStatus(key)} />
              ))}
            </Box>

            <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto' }}>
              {sortedDocuments.length} of {documents.length} documents
            </Typography>
          </Box>

          <Table size="small" sx={{ tableLayout: 'fixed', width: '100%' }}>
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
              {sortedDocuments.map(doc => {
                const isExpanded = expandedId === doc.id;
                return (
                  <React.Fragment key={doc.id}>
                    <TableRow
                      id={`grc-gov-${doc.id}`}
                      hover
                      sx={{
                        cursor: 'pointer', '& > *': { borderBottom: isExpanded ? 'none' : undefined },
                        ...(highlightId === doc.id && { bgcolor: 'action.selected', transition: 'background-color 0.3s' })
                      }}
                      onClick={() => setExpandedId(isExpanded ? null : doc.id)}
                    >
                      <TableCell padding="checkbox">
                        <IconButton size="small" sx={{ p: 0.25 }}>
                          {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                        </IconButton>
                      </TableCell>
                      {columnConfig.visibleColumns.map(col => (
                        <TableCell key={col.id} onClick={e => {
                          if (['title', 'owner', 'version', 'nextReview', 'reviewedBy', 'approvedBy', 'approvalDate'].includes(col.id)) e.stopPropagation();
                        }}>
                          {renderCellContent(col.id, doc)}
                        </TableCell>
                      ))}
                      <TableCell padding="none" />
                    </TableRow>
                    {isExpanded && (
                      <TableRow>
                        <TableCell colSpan={columnConfig.visibleColumns.length + 2} sx={{ py: 0, px: 0 }}>
                          <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                            {renderExpandedDetail(doc)}
                          </Collapse>
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                );
              })}
              {sortedDocuments.length === 0 && documents.length > 0 && (
                <TableRow>
                  <TableCell colSpan={columnConfig.visibleColumns.length + 2}>
                    <Typography variant="body2" color="text.secondary" sx={{ py: 1 }}>
                      No documents match the current filters.
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Dialog open={Boolean(deleteConfirmId)} onClose={() => setDeleteConfirmId(null)}>
        <DialogTitle>Remove Governance Document</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Remove "{deleteTarget?.title}" from the governance registry? This does not delete the actual document file.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirmId(null)}>Cancel</Button>
          <Button variant="contained" color="error" onClick={() => deleteConfirmId && handleDeleteDocument(deleteConfirmId)}>
            Remove
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default GrcGovernanceTab;
