import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  MenuItem,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography
} from '@mui/material';
import { Plus, Trash2 } from 'lucide-react';
import {
  generateWorkflowTasksFromGaps,
  generateWorkflowTemplateTasks
} from '../../services/GrcWorkspaceService';
import { GrcTask, GrcTaskPriority, GrcTaskStatus, GrcTaskType } from '../../types/GrcTypes';
import { GrcTabProps, createId } from './grcShared';

const statusLabel: Record<GrcTaskStatus, string> = {
  todo: 'To Do',
  in_progress: 'In Progress',
  blocked: 'Blocked',
  done: 'Done'
};

const priorityLabel: Record<GrcTaskPriority, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  critical: 'Critical'
};

const typeLabel: Record<GrcTaskType, string> = {
  risk_treatment: 'Risk Treatment',
  control_implementation: 'Control Implementation',
  assessment: 'Assessment',
  evidence: 'Evidence',
  review: 'Review'
};

const allStatuses = Object.keys(statusLabel) as GrcTaskStatus[];
const allPriorities = Object.keys(priorityLabel) as GrcTaskPriority[];
const allTypes = Object.keys(typeLabel) as GrcTaskType[];

const sortTasks = (tasks: GrcTask[]): GrcTask[] => {
  const statusRank: Record<GrcTaskStatus, number> = { in_progress: 0, blocked: 1, todo: 2, done: 3 };
  const priorityRank: Record<GrcTaskPriority, number> = { critical: 0, high: 1, medium: 2, low: 3 };

  return [...tasks].sort((a, b) => {
    const byStatus = statusRank[a.status] - statusRank[b.status];
    if (byStatus !== 0) return byStatus;

    const byPriority = priorityRank[a.priority] - priorityRank[b.priority];
    if (byPriority !== 0) return byPriority;

    const aDue = a.dueDate ? new Date(a.dueDate).getTime() : Number.POSITIVE_INFINITY;
    const bDue = b.dueDate ? new Date(b.dueDate).getTime() : Number.POSITIVE_INFINITY;
    if (aDue !== bDue) return aDue - bDue;

    return a.title.localeCompare(b.title);
  });
};

const statusColor = (status: GrcTaskStatus): 'default' | 'primary' | 'warning' | 'success' => {
  switch (status) {
    case 'todo': return 'default';
    case 'in_progress': return 'primary';
    case 'blocked': return 'warning';
    case 'done': return 'success';
  }
};

const priorityColor = (priority: GrcTaskPriority): 'default' | 'info' | 'warning' | 'error' => {
  switch (priority) {
    case 'low': return 'default';
    case 'medium': return 'info';
    case 'high': return 'warning';
    case 'critical': return 'error';
  }
};

const GrcConfigTaskBoardSection: React.FC<GrcTabProps> = ({ workspace, applyWorkspace, setStatusMessage, focusRequest }) => {
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDescription, setNewTaskDescription] = useState('');
  const [newTaskType, setNewTaskType] = useState<GrcTaskType>('risk_treatment');
  const [newTaskPriority, setNewTaskPriority] = useState<GrcTaskPriority>('medium');
  const [newTaskOwner, setNewTaskOwner] = useState('');
  const [newTaskDueDate, setNewTaskDueDate] = useState('');
  const [highlightId, setHighlightId] = useState<string | null>(null);

  useEffect(() => {
    if (focusRequest?.tab !== 'workflow_config' || !focusRequest.entityId) return;
    const targetId = focusRequest.entityId;
    setHighlightId(targetId);
    const timer = setTimeout(() => {
      const el = document.getElementById(`grc-task-${targetId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 100);
    const clearTimer = setTimeout(() => setHighlightId(null), 2000);
    return () => { clearTimeout(timer); clearTimeout(clearTimer); };
  }, [focusRequest]);
  const [newTaskRiskId, setNewTaskRiskId] = useState('');
  const [newTaskAssessmentId, setNewTaskAssessmentId] = useState('');
  const [newTaskAssetId, setNewTaskAssetId] = useState('');
  const [newTaskControlSetId, setNewTaskControlSetId] = useState('');
  const [newTaskControlId, setNewTaskControlId] = useState('');

  const [filterStatuses, setFilterStatuses] = useState<GrcTaskStatus[]>([]);
  const [filterPriorities, setFilterPriorities] = useState<GrcTaskPriority[]>([]);
  const [filterTypes, setFilterTypes] = useState<GrcTaskType[]>([]);
  const [filterSearch, setFilterSearch] = useState('');

  const [deleteTarget, setDeleteTarget] = useState<GrcTask | null>(null);

  const allTasks = useMemo(() => sortTasks(workspace.workflowTasks), [workspace.workflowTasks]);
  const selectedNewTaskControlSet = useMemo(
    () => workspace.controlSets.find(controlSet => controlSet.id === newTaskControlSetId),
    [newTaskControlSetId, workspace.controlSets]
  );

  useEffect(() => {
    if (!newTaskControlId) {
      return;
    }
    if (!newTaskControlSetId) {
      setNewTaskControlId('');
      return;
    }
    const existsInSelectedControlSet = selectedNewTaskControlSet?.controls
      .some(control => control.controlId === newTaskControlId);
    if (!existsInSelectedControlSet) {
      setNewTaskControlId('');
    }
  }, [newTaskControlId, newTaskControlSetId, selectedNewTaskControlSet]);

  const tasks = useMemo(() => {
    let result = allTasks;
    if (filterStatuses.length > 0) {
      result = result.filter(t => filterStatuses.includes(t.status));
    }
    if (filterPriorities.length > 0) {
      result = result.filter(t => filterPriorities.includes(t.priority));
    }
    if (filterTypes.length > 0) {
      result = result.filter(t => filterTypes.includes(t.type));
    }
    if (filterSearch.trim()) {
      const needle = filterSearch.trim().toLowerCase();
      result = result.filter(t => t.title.toLowerCase().includes(needle));
    }
    return result;
  }, [allTasks, filterStatuses, filterPriorities, filterTypes, filterSearch]);

  const taskCounts = useMemo(() => {
    const byStatus: Record<GrcTaskStatus, number> = { todo: 0, in_progress: 0, blocked: 0, done: 0 };
    workspace.workflowTasks.forEach(t => { byStatus[t.status]++; });
    return byStatus;
  }, [workspace.workflowTasks]);

  const handleAddTask = useCallback(() => {
    const title = newTaskTitle.trim();
    if (!title) {
      setStatusMessage({ severity: 'warning', text: 'Task title is required.' });
      return;
    }
    if (newTaskControlId && !newTaskControlSetId) {
      setStatusMessage({ severity: 'warning', text: 'Select a control set before selecting a control.' });
      return;
    }

    const now = new Date().toISOString();
    const task: GrcTask = {
      id: createId('task'),
      title,
      description: newTaskDescription.trim() || undefined,
      type: newTaskType,
      status: 'todo',
      priority: newTaskPriority,
      owner: newTaskOwner.trim() || undefined,
      dueDate: newTaskDueDate || undefined,
      riskId: newTaskRiskId || undefined,
      assessmentId: newTaskAssessmentId || undefined,
      assetId: newTaskAssetId || undefined,
      controlSetId: newTaskControlSetId || undefined,
      controlId: newTaskControlId || undefined,
      createdAt: now,
      updatedAt: now
    };

    applyWorkspace({ ...workspace, workflowTasks: [...workspace.workflowTasks, task] });
    setNewTaskTitle('');
    setNewTaskDescription('');
    setNewTaskOwner('');
    setNewTaskDueDate('');
    setNewTaskRiskId('');
    setNewTaskAssessmentId('');
    setNewTaskAssetId('');
    setNewTaskControlSetId('');
    setNewTaskControlId('');
    setStatusMessage({ severity: 'success', text: `Added workflow task "${title}".` });
  }, [
    applyWorkspace,
    newTaskAssessmentId,
    newTaskAssetId,
    newTaskControlId,
    newTaskControlSetId,
    newTaskDescription,
    newTaskDueDate,
    newTaskOwner,
    newTaskPriority,
    newTaskRiskId,
    newTaskTitle,
    newTaskType,
    setStatusMessage,
    workspace
  ]);

  const handleUpdateTask = useCallback(
    (taskId: string, updater: (task: GrcTask) => GrcTask) => {
      const now = new Date().toISOString();
      const nextTasks = workspace.workflowTasks.map(task =>
        task.id === taskId ? { ...updater(task), updatedAt: now } : task
      );
      applyWorkspace({ ...workspace, workflowTasks: nextTasks });
    },
    [applyWorkspace, workspace]
  );

  const handleDeleteTask = useCallback(() => {
    if (!deleteTarget) return;
    const nextTasks = workspace.workflowTasks.filter(t => t.id !== deleteTarget.id);
    applyWorkspace({ ...workspace, workflowTasks: nextTasks });
    setStatusMessage({ severity: 'success', text: `Deleted task "${deleteTarget.title}".` });
    setDeleteTarget(null);
  }, [applyWorkspace, deleteTarget, setStatusMessage, workspace]);

  const handleGenerateFromGaps = useCallback(() => {
    const result = generateWorkflowTasksFromGaps(workspace);
    applyWorkspace(result.workspace);
    setStatusMessage({
      severity: result.addedCount > 0 ? 'success' : 'info',
      text: result.addedCount > 0
        ? `Generated ${result.addedCount} workflow tasks from current GRC gaps.`
        : 'No new workflow tasks were generated. Existing gaps are already tracked.'
    });
  }, [applyWorkspace, setStatusMessage, workspace]);

  const handleSeedTemplate = useCallback(
    (template: 'onboarding' | 'monthly' | 'incident') => {
      const result = generateWorkflowTemplateTasks(workspace, template);
      applyWorkspace(result.workspace);
      const templateName = template === 'onboarding'
        ? 'Onboarding'
        : template === 'monthly'
          ? 'Monthly Cycle'
          : 'Incident Response';
      setStatusMessage({
        severity: result.addedCount > 0 ? 'success' : 'info',
        text: result.addedCount > 0
          ? `Added ${result.addedCount} tasks from the ${templateName} template.`
          : `No new tasks added from ${templateName}; active template tasks already exist.`
      });
    },
    [applyWorkspace, setStatusMessage, workspace]
  );

  const resolveLinkedItem = useCallback((task: GrcTask): string => {
    const links: string[] = [];
    if (task.riskId) {
      const risk = workspace.risks.find(item => item.id === task.riskId);
      links.push(risk ? `Risk: ${risk.title}` : `Risk: ${task.riskId}`);
    }
    if (task.controlSetId && task.controlId) {
      const controlSet = workspace.controlSets.find(item => item.id === task.controlSetId);
      const control = controlSet?.controls.find(item => item.controlId === task.controlId);
      if (controlSet && control) {
        links.push(`Control: ${control.controlId} (${controlSet.name})`);
      } else {
        links.push(`Control: ${task.controlSetId}:${task.controlId}`);
      }
    }
    if (task.assessmentId) {
      const assessment = workspace.assessments.find(item => item.id === task.assessmentId);
      links.push(assessment ? `Assessment: ${assessment.title}` : `Assessment: ${task.assessmentId}`);
    }
    if (task.assetId) {
      const asset = workspace.assets.find(item => item.id === task.assetId);
      links.push(asset ? `Asset: ${asset.name}` : `Asset: ${task.assetId}`);
    }
    return links.length > 0 ? links.join(' | ') : '-';
  }, [workspace.assets, workspace.assessments, workspace.controlSets, workspace.risks]);

  const newTaskLinkPreview = useMemo(() => resolveLinkedItem({
    id: '',
    title: '',
    type: newTaskType,
    status: 'todo',
    priority: newTaskPriority,
    riskId: newTaskRiskId || undefined,
    controlSetId: newTaskControlSetId || undefined,
    controlId: newTaskControlId || undefined,
    assessmentId: newTaskAssessmentId || undefined,
    assetId: newTaskAssetId || undefined,
    createdAt: '',
    updatedAt: ''
  }), [
    newTaskAssessmentId,
    newTaskAssetId,
    newTaskControlId,
    newTaskControlSetId,
    newTaskPriority,
    newTaskRiskId,
    newTaskType,
    resolveLinkedItem
  ]);

  const toggleFilterChip = <T extends string>(current: T[], value: T, setter: (v: T[]) => void) => {
    setter(current.includes(value) ? current.filter(v => v !== value) : [...current, value]);
  };

  return (
    <Box sx={{ display: 'grid', gap: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Typography variant="subtitle1">Task Board</Typography>
          <Chip label={`${workspace.workflowTasks.length} total`} size="small" variant="outlined" />
          {taskCounts.in_progress > 0 && <Chip label={`${taskCounts.in_progress} active`} size="small" color="primary" />}
          {taskCounts.blocked > 0 && <Chip label={`${taskCounts.blocked} blocked`} size="small" color="warning" />}
        </Box>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Tooltip describeChild title="Analyzes risks without linked controls, controls without evidence, appetite breaches, and governance review overdue — then creates tasks for each gap" arrow>
            <Button variant="outlined" startIcon={<Plus size={16} />} onClick={handleGenerateFromGaps}>
              Generate Tasks From Gaps
            </Button>
          </Tooltip>
          <Tooltip describeChild title="Creates a standard set of tasks for onboarding a new system into the GRC process" arrow>
            <Button variant="outlined" onClick={() => handleSeedTemplate('onboarding')}>
              Seed Onboarding
            </Button>
          </Tooltip>
          <Tooltip describeChild title="Creates recurring monthly governance tasks like risk review and SoA updates" arrow>
            <Button variant="outlined" onClick={() => handleSeedTemplate('monthly')}>
              Seed Monthly
            </Button>
          </Tooltip>
          <Tooltip describeChild title="Creates incident response workflow tasks for structured remediation" arrow>
            <Button variant="outlined" onClick={() => handleSeedTemplate('incident')}>
              Seed Incident
            </Button>
          </Tooltip>
        </Box>
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 1.5 }}>
        <Tooltip title="Short description of the action to be completed" arrow>
          <TextField size="small" label="Task Title" value={newTaskTitle} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewTaskTitle(e.target.value)} />
        </Tooltip>
        <Tooltip title="Category of work: risk treatment, control implementation, assessment, evidence collection, or review" arrow>
          <TextField size="small" select label="Type" value={newTaskType} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewTaskType(e.target.value as GrcTaskType)}>
            {allTypes.map(key => (
              <MenuItem key={key} value={key}>{typeLabel[key]}</MenuItem>
            ))}
          </TextField>
        </Tooltip>
        <Tooltip title="Urgency level - Critical and High tasks should be addressed first" arrow>
          <TextField size="small" select label="Priority" value={newTaskPriority}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewTaskPriority(e.target.value as GrcTaskPriority)}>
            {allPriorities.map(key => (
              <MenuItem key={key} value={key}>{priorityLabel[key]}</MenuItem>
            ))}
          </TextField>
        </Tooltip>
        <Tooltip title="Person or team responsible for completing this task" arrow>
          <TextField size="small" label="Owner" value={newTaskOwner} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewTaskOwner(e.target.value)} />
        </Tooltip>
        <Tooltip title="Target completion date" arrow>
          <TextField size="small" type="date" label="Due Date" value={newTaskDueDate}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewTaskDueDate(e.target.value)}
            InputLabelProps={{ shrink: true }} />
        </Tooltip>
        <Tooltip title="Optional link to the risk this task supports." arrow>
          <TextField
            size="small"
            select
            label="Linked Risk"
            value={newTaskRiskId}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewTaskRiskId(e.target.value)}
          >
            <MenuItem value=""><em>None</em></MenuItem>
            {workspace.risks.map(risk => (
              <MenuItem key={risk.id} value={risk.id}>{risk.title}</MenuItem>
            ))}
          </TextField>
        </Tooltip>
        <Tooltip title="Optional link to the assessment this task belongs to." arrow>
          <TextField
            size="small"
            select
            label="Linked Assessment"
            value={newTaskAssessmentId}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewTaskAssessmentId(e.target.value)}
          >
            <MenuItem value=""><em>None</em></MenuItem>
            {workspace.assessments.map(assessment => (
              <MenuItem key={assessment.id} value={assessment.id}>{assessment.title}</MenuItem>
            ))}
          </TextField>
        </Tooltip>
        <Tooltip title="Optional link to the impacted asset for traceability." arrow>
          <TextField
            size="small"
            select
            label="Linked Asset"
            value={newTaskAssetId}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewTaskAssetId(e.target.value)}
          >
            <MenuItem value=""><em>None</em></MenuItem>
            {workspace.assets.map(asset => (
              <MenuItem key={asset.id} value={asset.id}>{asset.name}</MenuItem>
            ))}
          </TextField>
        </Tooltip>
        <Tooltip title="Optional link to a control set for control/evidence tasks." arrow>
          <TextField
            size="small"
            select
            label="Linked Control Set"
            value={newTaskControlSetId}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewTaskControlSetId(e.target.value)}
          >
            <MenuItem value=""><em>None</em></MenuItem>
            {workspace.controlSets.map(controlSet => (
              <MenuItem key={controlSet.id} value={controlSet.id}>{controlSet.name}</MenuItem>
            ))}
          </TextField>
        </Tooltip>
        <Tooltip title="Optional control reference inside the selected control set." arrow>
          <TextField
            size="small"
            select
            label="Linked Control"
            value={newTaskControlId}
            disabled={!newTaskControlSetId}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewTaskControlId(e.target.value)}
          >
            <MenuItem value=""><em>None</em></MenuItem>
            {(selectedNewTaskControlSet?.controls || []).map(control => (
              <MenuItem key={`${control.id}-${control.controlId}`} value={control.controlId}>
                {control.controlId} - {control.title}
              </MenuItem>
            ))}
          </TextField>
        </Tooltip>
        <Tooltip title="Create this task with the selected workflow and linkage fields." arrow>
          <Button variant="contained" startIcon={<Plus size={16} />} onClick={handleAddTask}>Add Task</Button>
        </Tooltip>
      </Box>

      <Tooltip title="Optional details to clarify expected outcome and completion criteria." arrow>
        <TextField
          size="small"
          label="Description (optional)"
          value={newTaskDescription}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewTaskDescription(e.target.value)}
          fullWidth
        />
      </Tooltip>
      <Typography variant="caption" color="text.secondary">
        Link preview: {newTaskLinkPreview}
      </Typography>

      <Paper variant="outlined" sx={{ p: 1.5, display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center' }}>
        <Typography variant="caption" color="text.secondary" sx={{ mr: 0.5 }}>Filters:</Typography>

        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', alignItems: 'center' }}>
          <Typography variant="caption" color="text.secondary">Status:</Typography>
          {allStatuses.map(s => (
            <Chip
              key={s}
              label={statusLabel[s]}
              size="small"
              color={filterStatuses.includes(s) ? statusColor(s) : 'default'}
              variant={filterStatuses.includes(s) ? 'filled' : 'outlined'}
              onClick={() => toggleFilterChip(filterStatuses, s, setFilterStatuses)}
            />
          ))}
        </Box>

        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', alignItems: 'center' }}>
          <Typography variant="caption" color="text.secondary">Priority:</Typography>
          {allPriorities.map(p => (
            <Chip
              key={p}
              label={priorityLabel[p]}
              size="small"
              color={filterPriorities.includes(p) ? priorityColor(p) : 'default'}
              variant={filterPriorities.includes(p) ? 'filled' : 'outlined'}
              onClick={() => toggleFilterChip(filterPriorities, p, setFilterPriorities)}
            />
          ))}
        </Box>

        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', alignItems: 'center' }}>
          <Typography variant="caption" color="text.secondary">Type:</Typography>
          {allTypes.map(t => (
            <Chip
              key={t}
              label={typeLabel[t]}
              size="small"
              color={filterTypes.includes(t) ? 'primary' : 'default'}
              variant={filterTypes.includes(t) ? 'filled' : 'outlined'}
              onClick={() => toggleFilterChip(filterTypes, t, setFilterTypes)}
            />
          ))}
        </Box>

        <Tooltip title="Filter task rows by text in title." arrow>
          <TextField
            size="small"
            label="Search title"
            value={filterSearch}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFilterSearch(e.target.value)}
            sx={{ minWidth: 180 }}
          />
        </Tooltip>

        {(filterStatuses.length > 0 || filterPriorities.length > 0 || filterTypes.length > 0 || filterSearch.trim()) && (
          <Chip
            label="Clear all"
            size="small"
            variant="outlined"
            onDelete={() => {
              setFilterStatuses([]);
              setFilterPriorities([]);
              setFilterTypes([]);
              setFilterSearch('');
            }}
            onClick={() => {
              setFilterStatuses([]);
              setFilterPriorities([]);
              setFilterTypes([]);
              setFilterSearch('');
            }}
          />
        )}
      </Paper>

      {allTasks.length === 0 ? (
        <Paper variant="outlined" sx={{ p: 3, textAlign: 'center' }}>
          <Typography variant="body1" sx={{ mb: 1.5 }}>
            No workflow tasks yet.
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1, maxWidth: 600, mx: 'auto' }}>
            Tasks track the execution of risk treatment, control implementation, evidence collection, and review activities.
          </Typography>
          <Box sx={{ textAlign: 'left', maxWidth: 600, mx: 'auto' }}>
            <Typography variant="body2" color="text.secondary">
              {'\u2022'} Click "Generate Tasks From Gaps" to auto-create tasks from unlinked risks, controls missing evidence, appetite breaches, and governance review overdue
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {'\u2022'} Use template seeds for standard operating cycles (onboarding, monthly, incident)
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {'\u2022'} Or manually add tasks using the form above
            </Typography>
          </Box>
        </Paper>
      ) : tasks.length === 0 ? (
        <Paper variant="outlined" sx={{ p: 3, textAlign: 'center' }}>
          <Typography variant="body2" color="text.secondary">
            No tasks match the current filters. Adjust the filter criteria above or clear all filters.
          </Typography>
        </Paper>
      ) : (
        <TableContainer component={Box} sx={{ maxHeight: 480, overflow: 'auto' }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <Tooltip title="Short description of the action to be completed" arrow>
                  <TableCell>Task</TableCell>
                </Tooltip>
                <Tooltip title="Category of work: risk treatment, control implementation, assessment, evidence collection, or review" arrow>
                  <TableCell>Type</TableCell>
                </Tooltip>
                <Tooltip title="Urgency level - Critical and High tasks should be addressed first" arrow>
                  <TableCell>Priority</TableCell>
                </Tooltip>
                <Tooltip title="The risk, control, assessment, or asset this task relates to" arrow>
                  <TableCell>Linked Item</TableCell>
                </Tooltip>
                <Tooltip title="Person or team responsible for completing this task" arrow>
                  <TableCell>Owner</TableCell>
                </Tooltip>
                <Tooltip title="Target completion date" arrow>
                  <TableCell>Due Date</TableCell>
                </Tooltip>
                <Tooltip title="Current execution state of this task" arrow>
                  <TableCell>Status</TableCell>
                </Tooltip>
                <TableCell sx={{ width: 48 }} />
              </TableRow>
            </TableHead>
            <TableBody>
              {tasks.map(task => (
                <TableRow
                  key={task.id}
                  hover
                  id={`grc-task-${task.id}`}
                  sx={highlightId === task.id ? {
                    backgroundColor: 'action.selected',
                    transition: 'background-color 0.3s'
                  } : undefined}
                >
                  <TableCell sx={{ minWidth: 180 }}>
                    <Tooltip title="Short description of the action to be completed" arrow>
                      <TextField
                        size="small"
                        variant="standard"
                        value={task.title}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          handleUpdateTask(task.id, current => ({ ...current, title: e.target.value }))
                        }
                        fullWidth
                        InputProps={{ sx: { fontWeight: 600, fontSize: '0.875rem' } }}
                      />
                    </Tooltip>
                    <Tooltip title={task.description || 'No description'} arrow>
                      <TextField
                        size="small"
                        variant="standard"
                        value={task.description || ''}
                        placeholder="Description"
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          handleUpdateTask(task.id, current => ({
                            ...current,
                            description: e.target.value || undefined
                          }))
                        }
                        fullWidth
                        InputProps={{ sx: { fontSize: '0.75rem', color: 'text.secondary' } }}
                      />
                    </Tooltip>
                  </TableCell>
                  <TableCell>
                    <Tooltip title="Category of work: risk treatment, control implementation, assessment, evidence collection, or review" arrow>
                      <TextField
                        select
                        size="small"
                        variant="standard"
                        value={task.type}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          handleUpdateTask(task.id, current => ({ ...current, type: e.target.value as GrcTaskType }))
                        }
                        sx={{ minWidth: 140 }}
                      >
                        {allTypes.map(key => (
                          <MenuItem key={key} value={key}>{typeLabel[key]}</MenuItem>
                        ))}
                      </TextField>
                    </Tooltip>
                  </TableCell>
                  <TableCell>
                    <Tooltip title="Urgency level - Critical and High tasks should be addressed first" arrow>
                      <TextField
                        select
                        size="small"
                        variant="standard"
                        value={task.priority}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          handleUpdateTask(task.id, current => ({ ...current, priority: e.target.value as GrcTaskPriority }))
                        }
                        sx={{ minWidth: 90 }}
                      >
                        {allPriorities.map(key => (
                          <MenuItem key={key} value={key}>{priorityLabel[key]}</MenuItem>
                        ))}
                      </TextField>
                    </Tooltip>
                  </TableCell>
                  <TableCell>
                    <Tooltip title="The risk, control, assessment, or asset this task relates to" arrow>
                      <Typography variant="caption">{resolveLinkedItem(task)}</Typography>
                    </Tooltip>
                  </TableCell>
                  <TableCell>
                    <Tooltip title="Person or team responsible for completing this task" arrow>
                      <TextField
                        size="small"
                        variant="standard"
                        value={task.owner || ''}
                        placeholder="Owner"
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          handleUpdateTask(task.id, current => ({
                            ...current,
                            owner: e.target.value || undefined
                          }))
                        }
                        sx={{ minWidth: 100 }}
                      />
                    </Tooltip>
                  </TableCell>
                  <TableCell>
                    <Tooltip title="Target completion date" arrow>
                      <TextField
                        size="small"
                        variant="standard"
                        type="date"
                        value={task.dueDate || ''}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          handleUpdateTask(task.id, current => ({
                            ...current,
                            dueDate: e.target.value || undefined
                          }))
                        }
                        InputLabelProps={{ shrink: true }}
                        sx={{ minWidth: 130 }}
                      />
                    </Tooltip>
                  </TableCell>
                  <TableCell>
                    <Tooltip title="Current execution state of this task" arrow>
                      <TextField
                        select
                        size="small"
                        variant="standard"
                        value={task.status}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          handleUpdateTask(task.id, current => ({ ...current, status: e.target.value as GrcTaskStatus }))
                        }
                        sx={{ minWidth: 120 }}
                      >
                        {allStatuses.map(key => (
                          <MenuItem key={key} value={key}>{statusLabel[key]}</MenuItem>
                        ))}
                      </TextField>
                    </Tooltip>
                  </TableCell>
                  <TableCell>
                    <Tooltip title="Delete this task" arrow>
                      <Button
                        size="small"
                        color="error"
                        sx={{ minWidth: 32, p: 0.5 }}
                        onClick={() => setDeleteTarget(task)}
                      >
                        <Trash2 size={16} />
                      </Button>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)}>
        <DialogTitle>Delete Task</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete "{deleteTarget?.title}"? This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Tooltip describeChild title="Keep this task and close dialog." arrow>
            <Button onClick={() => setDeleteTarget(null)}>Cancel</Button>
          </Tooltip>
          <Tooltip describeChild title="Delete this workflow task permanently." arrow>
            <Button color="error" variant="contained" onClick={handleDeleteTask}>Delete</Button>
          </Tooltip>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default GrcConfigTaskBoardSection;
