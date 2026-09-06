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
  AssessmentStatus,
  GrcAssessment,
  GrcRisk,
  GrcRiskManagementPlanAction,
  GrcRiskPlanActionStatus,
  GrcTask,
  GrcTaskPriority,
  RiskTreatmentStrategy
} from '../../types/GrcTypes';
import { assessmentScopeTypeLabels, summarizeAssessmentScopes } from '../../services/GrcWorkspaceService';
import { GrcTabProps, cardSx, createId } from './grcShared';
import { useTableColumnConfig, ColumnDef } from './useTableColumnConfig';
import TableColumnConfigPopover from './TableColumnConfigPopover';

const ACTION_COLUMNS: ColumnDef[] = [
  { id: 'title',             label: 'Action',       defaultVisible: true,  removable: false },
  { id: 'status',            label: 'Status',       defaultVisible: true,  removable: true },
  { id: 'priority',          label: 'Priority',     defaultVisible: true,  removable: true },
  { id: 'treatmentStrategy', label: 'Treatment',    defaultVisible: true,  removable: true },
  { id: 'linkedRisks',       label: 'Linked Risks', defaultVisible: true,  removable: true },
  { id: 'owner',             label: 'Owner',        defaultVisible: true,  removable: true },
  { id: 'dueDate',           label: 'Due Date',     defaultVisible: true,  removable: true },
  { id: 'notes',             label: 'Notes',        defaultVisible: false, removable: true },
  { id: 'actions',           label: 'Actions',      defaultVisible: true,  removable: false }
];

const STATUS_LABELS: Record<GrcRiskPlanActionStatus, string> = {
  planned: 'Planned', in_progress: 'In Progress', blocked: 'Blocked', done: 'Done'
};
const STATUS_COLORS: Record<GrcRiskPlanActionStatus, string> = {
  planned: '#6366f1', in_progress: '#2563eb', blocked: '#dc2626', done: '#059669'
};

const PRIORITY_LABELS: Record<GrcTaskPriority, string> = {
  low: 'Low', medium: 'Medium', high: 'High', critical: 'Critical'
};
const PRIORITY_COLORS: Record<GrcTaskPriority, string> = {
  low: '#6b7280', medium: '#ca8a04', high: '#ea580c', critical: '#dc2626'
};
const PRIORITY_ORDER: Record<GrcTaskPriority, number> = {
  critical: 4, high: 3, medium: 2, low: 1
};

const TREATMENT_LABELS: Record<RiskTreatmentStrategy, string> = {
  mitigate: 'Mitigate', transfer: 'Transfer', avoid: 'Avoid', accept: 'Accept'
};

const SORTABLE_COLUMNS = new Set(['title', 'status', 'priority', 'treatmentStrategy', 'linkedRisks', 'owner', 'dueDate']);
type SortDirection = 'asc' | 'desc';

const formatDueDate = (isoDate: string | undefined): string => {
  if (!isoDate) return '';
  const d = new Date(isoDate);
  if (isNaN(d.getTime())) return isoDate;
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
};

const dueDateStatus = (isoDate: string | undefined): 'overdue' | 'due-soon' | 'ok' | 'none' => {
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

const dueDateColor = (status: ReturnType<typeof dueDateStatus>): string | undefined => {
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

const GrcRiskManagementPlanTab: React.FC<GrcTabProps> = ({
  workspace,
  applyWorkspace,
  setStatusMessage,
  assessmentFocusRequest,
  onSwitchTab,
  focusRequest,
  getTabViewState,
  setTabViewState
}) => {
  const persistedView = getTabViewState?.('risk_management_plan', {
    activeAssessmentId: workspace.assessments[0]?.id ?? null,
    expandedId: null
  }) ?? {
    activeAssessmentId: workspace.assessments[0]?.id ?? null,
    expandedId: null
  };

  const [activeAssessmentId, setActiveAssessmentId] = useState<string | null>(
    (persistedView.activeAssessmentId as string | null) ?? workspace.assessments[0]?.id ?? null
  );
  const [newActionTitle, setNewActionTitle] = useState('');
  const [newActionOwner, setNewActionOwner] = useState('');
  const [newActionDueDate, setNewActionDueDate] = useState('');
  const [newActionStatus, setNewActionStatus] = useState<GrcRiskPlanActionStatus>('planned');
  const [newActionPriority, setNewActionPriority] = useState<GrcTaskPriority>('medium');
  const [newActionTreatmentStrategy, setNewActionTreatmentStrategy] = useState<RiskTreatmentStrategy | ''>('');
  const [newActionNotes, setNewActionNotes] = useState('');

  const [statusFilter, setStatusFilter] = useState<GrcRiskPlanActionStatus | 'all'>('all');
  const [priorityFilter, setPriorityFilter] = useState<GrcTaskPriority | 'all'>('all');
  const [searchText, setSearchText] = useState('');
  const [sortColumn, setSortColumn] = useState<string>('status');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [expandedId, setExpandedId] = useState<string | null>((persistedView.expandedId as string | null) ?? null);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  useEffect(() => {
    if (focusRequest?.tab === 'risk_management_plan' && focusRequest.entityId) {
      const id = focusRequest.entityId;
      const allActions = workspace.assessments.flatMap(a => a.riskManagementPlan?.actions || []);
      if (allActions.some(a => a.id === id)) {
        setExpandedId(id);
        setHighlightId(id);
        setTimeout(() => {
          document.getElementById(`grc-rmp-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 100);
        setTimeout(() => setHighlightId(null), 2000);
      }
    }
  }, [focusRequest, workspace.assessments]);

  const columnConfig = useTableColumnConfig('rmpActions', ACTION_COLUMNS, workspace, applyWorkspace);

  const riskById = useMemo(
    () => new Map(workspace.risks.map(risk => [risk.id, risk])),
    [workspace.risks]
  );

  useEffect(() => {
    if (activeAssessmentId && workspace.assessments.some(a => a.id === activeAssessmentId)) return;
    setActiveAssessmentId(workspace.assessments[0]?.id ?? null);
  }, [activeAssessmentId, workspace.assessments]);

  useEffect(() => {
    setTabViewState?.('risk_management_plan', {
      activeAssessmentId,
      expandedId
    });
  }, [activeAssessmentId, expandedId, setTabViewState]);

  useEffect(() => {
    if (!assessmentFocusRequest?.openRiskPlan) return;
    const normalizedScopeValue = assessmentFocusRequest.scopeValue.trim().toLowerCase();
    const normalizedDiagramId = (assessmentFocusRequest.diagramId || '').trim().toLowerCase();
    const match = workspace.assessments.find(assessment => {
      const hasScope = assessment.scopeItems.some(scope =>
        scope.type === assessmentFocusRequest.scopeType
        && (scope.value || scope.name).trim().toLowerCase() === normalizedScopeValue
      );
      if (!hasScope) return false;
      if (!normalizedDiagramId) return true;
      return assessment.scopeItems.some(scope =>
        scope.type === 'diagram' && (scope.value || scope.name).trim().toLowerCase() === normalizedDiagramId
      );
    });
    if (match) {
      setActiveAssessmentId(match.id);
      setStatusMessage({ severity: 'info', text: `Opened Risk Management Plan for assessment "${match.title}".` });
    }
  }, [assessmentFocusRequest, setStatusMessage, workspace.assessments]);

  const activeAssessment = useMemo(
    () => workspace.assessments.find(a => a.id === activeAssessmentId) || null,
    [activeAssessmentId, workspace.assessments]
  );

  const updateAssessment = useCallback((assessmentId: string, updater: (a: GrcAssessment) => GrcAssessment) => {
    const nextAssessments = workspace.assessments.map(a => {
      if (a.id !== assessmentId) return a;
      const next = updater(a);
      return {
        ...next,
        riskManagementPlan: { ...next.riskManagementPlan, updatedAt: new Date().toISOString() },
        updatedAt: new Date().toISOString()
      };
    });
    applyWorkspace({ ...workspace, assessments: nextAssessments });
  }, [applyWorkspace, workspace]);

  const updateActivePlan = useCallback((patch: Partial<GrcAssessment['riskManagementPlan']>) => {
    if (!activeAssessment) return;
    updateAssessment(activeAssessment.id, a => ({
      ...a,
      riskManagementPlan: { ...a.riskManagementPlan, ...patch }
    }));
  }, [activeAssessment, updateAssessment]);

  const handleAddAction = useCallback(() => {
    if (!activeAssessment) {
      setStatusMessage({ severity: 'warning', text: 'Select an assessment first.' });
      return;
    }
    const title = newActionTitle.trim();
    if (!title) {
      setStatusMessage({ severity: 'warning', text: 'Action title is required.' });
      return;
    }
    const action: GrcRiskManagementPlanAction = {
      id: createId('rmp-action'),
      title,
      owner: newActionOwner.trim() || undefined,
      dueDate: newActionDueDate || undefined,
      status: newActionStatus,
      priority: newActionPriority,
      treatmentStrategy: newActionTreatmentStrategy || undefined,
      linkedRiskIds: [],
      notes: newActionNotes.trim() || undefined
    };
    updateAssessment(activeAssessment.id, a => ({
      ...a,
      riskManagementPlan: { ...a.riskManagementPlan, actions: [...a.riskManagementPlan.actions, action] }
    }));
    setNewActionTitle('');
    setNewActionOwner('');
    setNewActionDueDate('');
    setNewActionStatus('planned');
    setNewActionPriority('medium');
    setNewActionTreatmentStrategy('');
    setNewActionNotes('');
    setStatusMessage({ severity: 'success', text: `Added plan action "${title}".` });
  }, [activeAssessment, newActionDueDate, newActionNotes, newActionOwner, newActionStatus, newActionPriority, newActionTreatmentStrategy, newActionTitle, setStatusMessage, updateAssessment]);

  const handleActionUpdate = useCallback((actionId: string, updater: (a: GrcRiskManagementPlanAction) => GrcRiskManagementPlanAction) => {
    if (!activeAssessment) return;
    updateAssessment(activeAssessment.id, a => ({
      ...a,
      riskManagementPlan: {
        ...a.riskManagementPlan,
        actions: a.riskManagementPlan.actions.map(act => act.id === actionId ? updater(act) : act)
      }
    }));
  }, [activeAssessment, updateAssessment]);

  const handleRemoveAction = useCallback((actionId: string) => {
    if (!activeAssessment) return;
    const action = activeAssessment.riskManagementPlan.actions.find(a => a.id === actionId);
    updateAssessment(activeAssessment.id, a => ({
      ...a,
      riskManagementPlan: {
        ...a.riskManagementPlan,
        actions: a.riskManagementPlan.actions.filter(act => act.id !== actionId)
      }
    }));
    setDeleteConfirmId(null);
    if (action) {
      setStatusMessage({ severity: 'success', text: `Deleted plan action "${action.title}".` });
    }
  }, [activeAssessment, setStatusMessage, updateAssessment]);

  const handleGenerateWorkflowTasks = useCallback(() => {
    if (!activeAssessment) {
      setStatusMessage({ severity: 'warning', text: 'Select an assessment first.' });
      return;
    }
    const openActions = activeAssessment.riskManagementPlan.actions.filter(a => a.status !== 'done');
    if (openActions.length === 0) {
      setStatusMessage({ severity: 'info', text: 'No open plan actions to generate tasks from.' });
      return;
    }
    const existingKeys = new Set(
      workspace.workflowTasks.map(task => `${task.assessmentId || ''}:${task.title.trim().toLowerCase()}`)
    );
    const now = new Date().toISOString();
    const nextTasks: GrcTask[] = [...workspace.workflowTasks];
    let addedCount = 0;
    openActions.forEach(action => {
      const key = `${activeAssessment.id}:${action.title.trim().toLowerCase()}`;
      if (existingKeys.has(key)) return;
      nextTasks.push({
        id: createId('task'),
        title: action.title,
        description: action.notes,
        type: 'risk_treatment',
        status: action.status === 'in_progress' ? 'in_progress' : action.status === 'blocked' ? 'blocked' : 'todo',
        priority: action.priority || (action.status === 'blocked' ? 'high' : 'medium'),
        owner: action.owner,
        dueDate: action.dueDate,
        assessmentId: activeAssessment.id,
        riskId: action.linkedRiskIds[0],
        createdAt: now,
        updatedAt: now
      });
      existingKeys.add(key);
      addedCount += 1;
    });
    applyWorkspace({ ...workspace, workflowTasks: nextTasks });
    setStatusMessage({
      severity: addedCount > 0 ? 'success' : 'info',
      text: addedCount > 0
        ? `Generated ${addedCount} workflow tasks from open risk plan actions.`
        : 'No new workflow tasks generated (existing items already tracked).'
    });
  }, [activeAssessment, applyWorkspace, setStatusMessage, workspace]);

  const handleSort = useCallback((colId: string) => {
    if (sortColumn === colId) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(colId);
      setSortDirection('asc');
    }
  }, [sortColumn]);

  const actions = activeAssessment?.riskManagementPlan.actions ?? [];

  const filteredActions = useMemo(() => {
    let result = actions;
    if (statusFilter !== 'all') result = result.filter(a => a.status === statusFilter);
    if (priorityFilter !== 'all') result = result.filter(a => a.priority === priorityFilter);
    if (searchText.trim()) {
      const lower = searchText.toLowerCase();
      result = result.filter(a =>
        a.title.toLowerCase().includes(lower) ||
        (a.owner || '').toLowerCase().includes(lower) ||
        (a.notes || '').toLowerCase().includes(lower) ||
        a.linkedRiskIds.some(rid => {
          const r = riskById.get(rid);
          return r && r.title.toLowerCase().includes(lower);
        })
      );
    }
    return result;
  }, [actions, statusFilter, priorityFilter, searchText, riskById]);

  const sortedActions = useMemo(() => {
    const arr = [...filteredActions];
    const dir = sortDirection === 'asc' ? 1 : -1;
    arr.sort((a, b) => {
      let cmp = 0;
      switch (sortColumn) {
        case 'title': cmp = a.title.localeCompare(b.title); break;
        case 'status': {
          const order: Record<string, number> = { done: 4, blocked: 3, in_progress: 2, planned: 1 };
          cmp = (order[a.status] || 0) - (order[b.status] || 0);
          break;
        }
        case 'priority': cmp = (PRIORITY_ORDER[a.priority || 'medium'] || 0) - (PRIORITY_ORDER[b.priority || 'medium'] || 0); break;
        case 'treatmentStrategy': cmp = (a.treatmentStrategy || '').localeCompare(b.treatmentStrategy || ''); break;
        case 'linkedRisks': cmp = a.linkedRiskIds.length - b.linkedRiskIds.length; break;
        case 'owner': cmp = (a.owner || '').localeCompare(b.owner || ''); break;
        case 'dueDate': cmp = (a.dueDate || '').localeCompare(b.dueDate || ''); break;
        default: break;
      }
      return cmp * dir;
    });
    return arr;
  }, [filteredActions, sortColumn, sortDirection]);

  const deleteTarget = deleteConfirmId ? actions.find(a => a.id === deleteConfirmId) : null;

  const assessmentCompletion = useCallback((assessment: GrcAssessment) => {
    const total = assessment.riskManagementPlan.actions.length;
    if (total === 0) return null;
    const done = assessment.riskManagementPlan.actions.filter(a => a.status === 'done').length;
    return Math.round((done / total) * 100);
  }, []);

  const renderCellContent = useCallback((col: ColumnDef, action: GrcRiskManagementPlanAction) => {
    switch (col.id) {
      case 'title':
        return <Typography variant="body2" sx={{ fontWeight: 500 }}>{action.title}</Typography>;

      case 'status':
        return (
          <Tooltip describeChild title="Inline edit: action progress status." arrow>
            <TextField
              size="small"
              select
              variant="standard"
              value={action.status}
              onChange={e => handleActionUpdate(action.id, cur => ({ ...cur, status: e.target.value as GrcRiskPlanActionStatus }))}
              InputProps={{ disableUnderline: true }}
              sx={{ minWidth: 110 }}
            >
              {(Object.keys(STATUS_LABELS) as GrcRiskPlanActionStatus[]).map(s => (
                <MenuItem key={s} value={s}>
                  <Box component="span" sx={{
                    display: 'inline-block', px: 0.75, py: 0.25, borderRadius: 1, fontSize: '0.75rem', fontWeight: 600,
                    bgcolor: STATUS_COLORS[s] + '22', color: STATUS_COLORS[s], border: `1px solid ${STATUS_COLORS[s]}44`
                  }}>
                    {STATUS_LABELS[s]}
                  </Box>
                </MenuItem>
              ))}
            </TextField>
          </Tooltip>
        );

      case 'priority':
        return (
          <Tooltip describeChild title="Inline edit: action priority level." arrow>
            <TextField
              size="small"
              select
              variant="standard"
              value={action.priority || 'medium'}
              onChange={e => handleActionUpdate(action.id, cur => ({ ...cur, priority: e.target.value as GrcTaskPriority }))}
              InputProps={{ disableUnderline: true }}
              sx={{ minWidth: 90, '& .MuiSelect-select': { color: PRIORITY_COLORS[action.priority || 'medium'], fontWeight: 600, fontSize: '0.8rem' } }}
            >
              {(Object.keys(PRIORITY_LABELS) as GrcTaskPriority[]).map(p => (
                <MenuItem key={p} value={p} sx={{ color: PRIORITY_COLORS[p], fontWeight: 600 }}>
                  {PRIORITY_LABELS[p]}
                </MenuItem>
              ))}
            </TextField>
          </Tooltip>
        );

      case 'treatmentStrategy':
        return (
          <Tooltip describeChild title="Inline edit: treatment strategy for this action." arrow>
            <TextField
              size="small"
              select
              variant="standard"
              value={action.treatmentStrategy || ''}
              onChange={e => handleActionUpdate(action.id, cur => ({ ...cur, treatmentStrategy: (e.target.value as RiskTreatmentStrategy) || undefined }))}
              InputProps={{ disableUnderline: true }}
              sx={{ minWidth: 100 }}
            >
              <MenuItem value=""><em>None</em></MenuItem>
              {(Object.keys(TREATMENT_LABELS) as RiskTreatmentStrategy[]).map(t => (
                <MenuItem key={t} value={t}>{TREATMENT_LABELS[t]}</MenuItem>
              ))}
            </TextField>
          </Tooltip>
        );

      case 'linkedRisks': {
        const count = action.linkedRiskIds.length;
        return (
          <Chip
            size="small"
            label={`${count} risk${count !== 1 ? 's' : ''}`}
            variant="outlined"
            onClick={() => setExpandedId(expandedId === action.id ? null : action.id)}
            sx={{ cursor: 'pointer', fontWeight: count > 0 ? 600 : 400 }}
          />
        );
      }

      case 'owner':
        return (
          <Tooltip describeChild title="Inline edit: owner responsible for this plan action." arrow>
            <TextField
              size="small"
              variant="standard"
              value={action.owner || ''}
              onChange={e => handleActionUpdate(action.id, cur => ({ ...cur, owner: e.target.value || undefined }))}
              InputProps={{ disableUnderline: true }}
              placeholder="-"
              sx={{ minWidth: 80 }}
            />
          </Tooltip>
        );

      case 'dueDate': {
        const status = dueDateStatus(action.dueDate);
        const color = dueDateColor(status);
        return (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Tooltip describeChild title="Inline edit: action due date." arrow>
              <TextField
                size="small"
                type="date"
                variant="standard"
                value={toDateInputValue(action.dueDate)}
                onChange={e => handleActionUpdate(action.id, cur => ({ ...cur, dueDate: e.target.value || undefined }))}
                InputProps={{ disableUnderline: true }}
                InputLabelProps={{ shrink: true }}
                sx={{ minWidth: 120, '& input': { color: color || 'inherit', fontWeight: status === 'overdue' ? 700 : 400 } }}
              />
            </Tooltip>
            {status === 'overdue' && (
              <Typography variant="caption" sx={{ color: '#dc2626', fontWeight: 700, whiteSpace: 'nowrap' }}>Overdue</Typography>
            )}
          </Box>
        );
      }

      case 'notes':
        return (
          <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {action.notes || '-'}
          </Typography>
        );

      case 'actions':
        return (
          <Tooltip describeChild title="Delete this plan action." arrow>
            <IconButton size="small" color="error" onClick={() => setDeleteConfirmId(action.id)}>
              <Trash2 size={16} />
            </IconButton>
          </Tooltip>
        );

      default:
        return null;
    }
  }, [expandedId, handleActionUpdate]);

  const renderExpandedDetail = useCallback((action: GrcRiskManagementPlanAction) => {
    const linkedRisks: GrcRisk[] = action.linkedRiskIds.map(rid => riskById.get(rid)).filter(Boolean) as GrcRisk[];

    return (
      <Box sx={{ px: 3, py: 2, bgcolor: 'action.hover' }}>
        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, mb: 2 }}>
          <Tooltip describeChild title="Editable notes for this plan action." arrow>
            <TextField
              size="small"
              multiline
              minRows={2}
              label="Notes"
              value={action.notes || ''}
              onChange={e => handleActionUpdate(action.id, cur => ({ ...cur, notes: e.target.value || undefined }))}
              fullWidth
            />
          </Tooltip>
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, mb: 0.5, display: 'block' }}>
              Due Date
            </Typography>
            {action.dueDate ? (
              <Typography variant="body2" sx={{ color: dueDateColor(dueDateStatus(action.dueDate)) || 'text.primary', fontWeight: dueDateStatus(action.dueDate) === 'overdue' ? 700 : 400 }}>
                {formatDueDate(action.dueDate)}
                {dueDateStatus(action.dueDate) === 'overdue' && ' (Overdue)'}
                {dueDateStatus(action.dueDate) === 'due-soon' && ' (Due soon)'}
              </Typography>
            ) : (
              <Typography variant="body2" color="text.secondary">No due date set</Typography>
            )}
          </Box>
        </Box>

        {linkedRisks.length > 0 && (
          <Box sx={{ mb: 2 }}>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, mb: 1, display: 'block' }}>
              Linked Risk Treatment Plans
            </Typography>
            <Box sx={{ display: 'grid', gap: 1 }}>
              {linkedRisks.map(risk => (
                <Paper key={risk.id} variant="outlined" sx={{ p: 1.5 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1, mb: 0.75 }}>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>{risk.title}</Typography>
                    <Chip
                      size="small"
                      label={risk.inherentScore.ratingLabel}
                      sx={{ bgcolor: risk.inherentScore.color, color: '#fff', height: 20, fontSize: '0.65rem', fontWeight: 700 }}
                    />
                    <Chip
                      size="small"
                      label={TREATMENT_LABELS[risk.treatmentStrategy] || risk.treatmentStrategy}
                      variant="outlined"
                      sx={{ height: 20, fontSize: '0.65rem' }}
                    />
                    {risk.owner && (
                      <Typography variant="caption" color="text.secondary">Owner: {risk.owner}</Typography>
                    )}
                  </Box>
                  {risk.treatmentPlan ? (
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>{risk.treatmentPlan}</Typography>
                  ) : (
                    <Typography variant="body2" color="text.disabled" sx={{ fontStyle: 'italic', mb: 0.5 }}>
                      No treatment plan defined on this risk.
                    </Typography>
                  )}
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {risk.residualScore && (
                      <Chip
                        size="small"
                        label={`Residual: ${risk.residualScore.ratingLabel} (${risk.residualScore.rawScore})`}
                        sx={{ bgcolor: risk.residualScore.color + '22', color: risk.residualScore.color, border: `1px solid ${risk.residualScore.color}44`, height: 20, fontSize: '0.65rem' }}
                      />
                    )}
                    <Chip
                      size="small"
                      label="Go to Risk"
                      variant="outlined"
                      onClick={() => onSwitchTab?.('risks', risk.id)}
                      sx={{ cursor: 'pointer', height: 20, fontSize: '0.65rem' }}
                    />
                  </Box>
                </Paper>
              ))}
            </Box>
          </Box>
        )}

        <Box>
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, mb: 0.5, display: 'block' }}>
            Link Risks
          </Typography>
          <Tooltip describeChild title="Select risks mitigated by this action." arrow>
            <FormControl size="small" sx={{ minWidth: 280 }}>
              <InputLabel id={`action-risks-${action.id}`}>Linked Risks</InputLabel>
              <Select
                labelId={`action-risks-${action.id}`}
                multiple
                value={action.linkedRiskIds}
                onChange={e => {
                  const value = e.target.value;
                  const nextIds = typeof value === 'string' ? value.split(',') : (value as string[]);
                  handleActionUpdate(action.id, cur => ({ ...cur, linkedRiskIds: nextIds }));
                }}
                input={<OutlinedInput label="Linked Risks" />}
                renderValue={selected =>
                  (selected as string[]).map(rid => riskById.get(rid)?.title || rid).join(', ') || '-'
                }
              >
                {workspace.risks.map(risk => (
                  <MenuItem key={risk.id} value={risk.id}>
                    <Chip
                      size="small"
                      label={risk.inherentScore.ratingLabel}
                      sx={{ mr: 1, bgcolor: risk.inherentScore.color, color: '#fff', height: 18, fontSize: '0.65rem' }}
                    />
                    {risk.title}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Tooltip>
        </Box>
      </Box>
    );
  }, [handleActionUpdate, onSwitchTab, riskById, workspace.risks]);

  return (
    <Box sx={{ display: 'grid', gap: 2 }}>
      {workspace.assessments.length === 0 && (
        <Paper sx={{ ...cardSx, textAlign: 'center', py: 4 }}>
          <Shield size={32} style={{ opacity: 0.3, marginBottom: 8 }} />
          <Typography variant="h6" sx={{ mb: 1 }}>No assessments created yet</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 520, mx: 'auto' }}>
            Each assessment contains its own Risk Management Plan. Create an assessment in the Assessments tab first.
          </Typography>
        </Paper>
      )}

      {workspace.assessments.length > 0 && (
        <Paper sx={cardSx}>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            Assessments ({workspace.assessments.length})
          </Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 1.5 }}>
            {workspace.assessments.map(assessment => {
              const isActive = assessment.id === activeAssessmentId;
              const completion = assessmentCompletion(assessment);
              const completionColor = completion === null ? undefined
                : completion >= 100 ? '#059669'
                : completion >= 50 ? '#ca8a04'
                : '#dc2626';
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
                        const status = e.target.value as AssessmentStatus;
                        updateAssessment(assessment.id, cur => ({ ...cur, status }));
                      }}
                      sx={{ minWidth: 110, '& .MuiInputBase-input': { py: 0.5, fontSize: '0.75rem' } }}
                    >
                      <MenuItem value="draft">Draft</MenuItem>
                      <MenuItem value="in_review">In Review</MenuItem>
                      <MenuItem value="completed">Completed</MenuItem>
                      <MenuItem value="archived">Archived</MenuItem>
                    </TextField>
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
                  <Box sx={{ display: 'flex', gap: 1, mt: 0.5, alignItems: 'center' }}>
                    <Typography variant="caption" color="text.secondary">
                      Actions: {assessment.riskManagementPlan.actions.filter(a => a.status !== 'done').length} open
                    </Typography>
                    {completion !== null && (
                      <Typography variant="caption" sx={{ fontWeight: 600, color: completionColor }}>
                        {completion}% done
                      </Typography>
                    )}
                  </Box>
                </Paper>
              );
            })}
          </Box>
        </Paper>
      )}

      {/* Active assessment plan workspace */}
      {activeAssessment && (
        <Paper sx={cardSx}>
          <Typography variant="h6" sx={{ mb: 1 }}>{activeAssessment.title}</Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
            Scope: {summarizeAssessmentScopes(activeAssessment)} | Linked Risks: {activeAssessment.riskIds.length}
          </Typography>

          {/* Plan fields */}
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 1.5, mb: 1.5 }}>
            <Tooltip describeChild title="High-level goal of the risk management plan, e.g. 'Reduce externally exposed attack paths'." arrow>
              <TextField
                size="small" label="Plan Objective"
                value={activeAssessment.riskManagementPlan.objective || ''}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateActivePlan({ objective: e.target.value || undefined })}
              />
            </Tooltip>
            <Tooltip describeChild title="Overarching treatment approach: mitigate, transfer, accept, or avoid." arrow>
              <TextField
                size="small" label="Plan Strategy"
                value={activeAssessment.riskManagementPlan.strategy || ''}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateActivePlan({ strategy: e.target.value || undefined })}
              />
            </Tooltip>
            <Tooltip describeChild title="How often (in days) this plan should be reviewed and re-assessed." arrow>
              <TextField
                size="small" type="number" label="Review Cadence (Days)"
                value={activeAssessment.riskManagementPlan.reviewCadenceDays || ''}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateActivePlan({ reviewCadenceDays: Number(e.target.value) || undefined })}
              />
            </Tooltip>
            <Tooltip describeChild title="Statement of remaining risk after treatment actions are completed." arrow>
              <TextField
                size="small" multiline minRows={2} label="Residual Risk Statement"
                value={activeAssessment.riskManagementPlan.residualRiskStatement || ''}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateActivePlan({ residualRiskStatement: e.target.value || undefined })}
              />
            </Tooltip>
            <Tooltip describeChild title="How residual risks and treatment effectiveness will be monitored over time." arrow>
              <TextField
                size="small" multiline minRows={2} label="Monitoring Approach"
                value={activeAssessment.riskManagementPlan.monitoringApproach || ''}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateActivePlan({ monitoringApproach: e.target.value || undefined })}
              />
            </Tooltip>
            <Tooltip describeChild title="How progress and decisions will be communicated to stakeholders." arrow>
              <TextField
                size="small" multiline minRows={2} label="Communication Plan"
                value={activeAssessment.riskManagementPlan.communicationPlan || ''}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateActivePlan({ communicationPlan: e.target.value || undefined })}
              />
            </Tooltip>
          </Box>

          {/* Add action form */}
          <Typography variant="subtitle2" sx={{ mb: 1 }}>Plan Actions</Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 1, mb: 1.5 }}>
            <Tooltip describeChild title="Short descriptive title for this treatment action." arrow>
              <TextField
                size="small" label="Action Title"
                value={newActionTitle}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewActionTitle(e.target.value)}
              />
            </Tooltip>
            <Tooltip describeChild title="Person or team responsible for completing this action." arrow>
              <TextField
                size="small" label="Owner"
                value={newActionOwner}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewActionOwner(e.target.value)}
              />
            </Tooltip>
            <Tooltip describeChild title="Target completion date for this action." arrow>
              <TextField
                size="small" type="date" label="Due Date"
                value={newActionDueDate}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewActionDueDate(e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
            </Tooltip>
            <Tooltip describeChild title="Current progress status: Planned, In Progress, Blocked, or Done." arrow>
              <TextField
                size="small" select label="Status"
                value={newActionStatus}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewActionStatus(e.target.value as GrcRiskPlanActionStatus)}
              >
                {(Object.keys(STATUS_LABELS) as GrcRiskPlanActionStatus[]).map(s => (
                  <MenuItem key={s} value={s}>{STATUS_LABELS[s]}</MenuItem>
                ))}
              </TextField>
            </Tooltip>
            <Tooltip describeChild title="Priority level for this action." arrow>
              <TextField
                size="small" select label="Priority"
                value={newActionPriority}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewActionPriority(e.target.value as GrcTaskPriority)}
              >
                {(Object.keys(PRIORITY_LABELS) as GrcTaskPriority[]).map(p => (
                  <MenuItem key={p} value={p} sx={{ color: PRIORITY_COLORS[p], fontWeight: 600 }}>
                    {PRIORITY_LABELS[p]}
                  </MenuItem>
                ))}
              </TextField>
            </Tooltip>
            <Tooltip describeChild title="Treatment strategy for this action (optional)." arrow>
              <TextField
                size="small" select label="Treatment"
                value={newActionTreatmentStrategy}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewActionTreatmentStrategy(e.target.value as RiskTreatmentStrategy | '')}
              >
                <MenuItem value=""><em>None</em></MenuItem>
                {(Object.keys(TREATMENT_LABELS) as RiskTreatmentStrategy[]).map(t => (
                  <MenuItem key={t} value={t}>{TREATMENT_LABELS[t]}</MenuItem>
                ))}
              </TextField>
            </Tooltip>
            <Tooltip describeChild title="Additional context or implementation details for this action." arrow>
              <TextField
                size="small" label="Notes"
                value={newActionNotes}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewActionNotes(e.target.value)}
              />
            </Tooltip>
            <Tooltip describeChild title="Add action to this assessment's risk management plan." arrow>
              <Button variant="contained" startIcon={<Plus size={16} />} onClick={handleAddAction}>
                Add Plan Action
              </Button>
            </Tooltip>
          </Box>

          {/* Filter bar */}
          {actions.length > 0 && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75, mb: 1.5 }}>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, alignItems: 'center' }}>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 500, minWidth: 50 }}>Status:</Typography>
                {(['all', 'planned', 'in_progress', 'blocked', 'done'] as const).map(s => (
                  <Chip
                    key={s}
                    label={s === 'all' ? 'All' : STATUS_LABELS[s]}
                    size="small"
                    variant={statusFilter === s ? 'filled' : 'outlined'}
                    onClick={() => setStatusFilter(s)}
                    sx={{ fontWeight: statusFilter === s ? 700 : 400 }}
                  />
                ))}
              </Box>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, alignItems: 'center' }}>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 500, minWidth: 50 }}>Priority:</Typography>
                {(['all', 'critical', 'high', 'medium', 'low'] as const).map(p => (
                  <Chip
                    key={p}
                    label={p === 'all' ? 'All' : PRIORITY_LABELS[p]}
                    size="small"
                    variant={priorityFilter === p ? 'filled' : 'outlined'}
                    onClick={() => setPriorityFilter(p)}
                    sx={{ fontWeight: priorityFilter === p ? 700 : 400 }}
                  />
                ))}
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <TextField
                  size="small" placeholder="Search actions..."
                  value={searchText} onChange={e => setSearchText(e.target.value)}
                  sx={{ maxWidth: 300 }}
                />
                {(filteredActions.length !== actions.length || searchText) && (
                  <Typography variant="caption" color="text.secondary">
                    {filteredActions.length} of {actions.length} actions
                  </Typography>
                )}
              </Box>
            </Box>
          )}

          {/* Actions table or empty state */}
          {actions.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 6 }}>
              <Shield size={48} style={{ marginBottom: 12, opacity: 0.4 }} />
              <Typography variant="h6" color="text.secondary" gutterBottom>
                No plan actions yet
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 520, mx: 'auto', mb: 2 }}>
                Plan actions track the specific steps needed to treat risks identified in this assessment.
                Each action can be assigned an owner, due date, priority, and treatment strategy.
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 520, mx: 'auto' }}>
                Link actions to risks to surface treatment plans and residual scores inline.
                Open actions can be converted to workflow tasks for execution tracking.
              </Typography>
            </Box>
          ) : (
            <TableContainer component={Box} sx={{ maxHeight: 480, overflow: 'auto', mb: 1.5 }}>
              <Table size="small" stickyHeader>
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
                    <TableCell sx={{ width: 40, p: 0.5 }}>
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
                  {sortedActions.map(action => (
                    <React.Fragment key={action.id}>
                      <TableRow id={`grc-rmp-${action.id}`} hover sx={{
                        '& > *': { borderBottom: expandedId === action.id ? 'none' : undefined },
                        ...(highlightId === action.id && { bgcolor: 'action.selected', transition: 'background-color 0.3s' })
                      }}>
                        <TableCell sx={{ width: 30, p: 0.5 }}>
                          <IconButton size="small" onClick={() => setExpandedId(expandedId === action.id ? null : action.id)}>
                            {expandedId === action.id ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                          </IconButton>
                        </TableCell>
                        {columnConfig.visibleColumns.map(col => (
                          <TableCell key={col.id}>{renderCellContent(col, action)}</TableCell>
                        ))}
                        <TableCell />
                      </TableRow>
                      <TableRow>
                        <TableCell colSpan={columnConfig.visibleColumns.length + 2} sx={{ p: 0, border: 0 }}>
                          <Collapse in={expandedId === action.id} timeout="auto" unmountOnExit>
                            {renderExpandedDetail(action)}
                          </Collapse>
                        </TableCell>
                      </TableRow>
                    </React.Fragment>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}

          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            <Tooltip describeChild title="Generate workflow tasks from open plan actions for execution tracking." arrow>
              <Button variant="outlined" onClick={handleGenerateWorkflowTasks}>
                Generate Workflow Tasks From Open Actions
              </Button>
            </Tooltip>
          </Box>
        </Paper>
      )}

      {/* Delete confirmation dialog */}
      <Dialog open={!!deleteConfirmId} onClose={() => setDeleteConfirmId(null)}>
        <DialogTitle>Delete Plan Action</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete the plan action "{deleteTarget?.title}"? This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Tooltip describeChild title="Keep this plan action." arrow>
            <Button onClick={() => setDeleteConfirmId(null)}>Cancel</Button>
          </Tooltip>
          <Tooltip describeChild title="Permanently delete this plan action." arrow>
            <Button color="error" variant="contained" onClick={() => deleteConfirmId && handleRemoveAction(deleteConfirmId)}>
              Delete
            </Button>
          </Tooltip>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default GrcRiskManagementPlanTab;
