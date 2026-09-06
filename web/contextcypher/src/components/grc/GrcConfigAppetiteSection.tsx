import React, { useCallback, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
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
import { GrcAppetiteRule, GrcAssetDomain } from '../../types/GrcTypes';
import { GrcTabProps, cardSx, createId } from './grcShared';

const domainLabels: Record<GrcAssetDomain, string> = {
  it: 'IT',
  ot: 'OT',
  cloud: 'Cloud',
  iot: 'IoT',
  application: 'Application',
  data: 'Data',
  network: 'Network',
  physical: 'Physical',
  people: 'People'
};

const GrcConfigAppetiteSection: React.FC<GrcTabProps> = ({ workspace, applyWorkspace, setStatusMessage }) => {
  const rules = useMemo(() => workspace.appetiteRules || [], [workspace.appetiteRules]);
  const tier1Nodes = useMemo(
    () => workspace.tierCatalogue.filter(n => n.tier === 1),
    [workspace.tierCatalogue]
  );

  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newDomain, setNewDomain] = useState<GrcAssetDomain | ''>('');
  const [newTier1, setNewTier1] = useState('');
  const [newCritMin, setNewCritMin] = useState('');
  const [newThreshold, setNewThreshold] = useState(String(workspace.riskModel.appetiteThresholdScore));
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const [editingCell, setEditingCell] = useState<{ id: string; field: string } | null>(null);
  const [editValue, setEditValue] = useState('');

  const handleAdd = useCallback(() => {
    const name = newName.trim();
    if (!name) {
      setStatusMessage({ severity: 'warning', text: 'Rule name is required.' });
      return;
    }
    const hasSomeScopeField = newDomain || newTier1.trim() || newCritMin.trim();
    if (!hasSomeScopeField) {
      setStatusMessage({ severity: 'warning', text: 'At least one scope field (domain, tier 1, or criticality) must be set.' });
      return;
    }
    const thresholdNum = Number(newThreshold);
    if (!Number.isFinite(thresholdNum) || thresholdNum <= 0) {
      setStatusMessage({ severity: 'warning', text: 'Threshold score must be a positive number.' });
      return;
    }
    const critMinNum = newCritMin.trim() ? Number(newCritMin) : undefined;
    if (critMinNum !== undefined && (!Number.isFinite(critMinNum) || critMinNum < 1 || critMinNum > 5)) {
      setStatusMessage({ severity: 'warning', text: 'Criticality minimum must be between 1 and 5.' });
      return;
    }

    const now = new Date().toISOString();
    const rule: GrcAppetiteRule = {
      id: createId('appetite'),
      name,
      description: newDescription.trim() || undefined,
      scopeAssetDomain: (newDomain || undefined) as GrcAssetDomain | undefined,
      scopeTier1: newTier1.trim() || undefined,
      scopeAssetCriticalityMin: critMinNum,
      thresholdScore: thresholdNum,
      createdAt: now,
      updatedAt: now
    };
    applyWorkspace({ ...workspace, appetiteRules: [...rules, rule] });
    setNewName('');
    setNewDescription('');
    setNewDomain('');
    setNewTier1('');
    setNewCritMin('');
    setNewThreshold(String(workspace.riskModel.appetiteThresholdScore));
    setStatusMessage({ severity: 'success', text: `Added appetite rule "${name}".` });
  }, [applyWorkspace, workspace, rules, newName, newDescription, newDomain, newTier1, newCritMin, newThreshold, setStatusMessage]);

  const handleDelete = useCallback((ruleId: string) => {
    const rule = rules.find(r => r.id === ruleId);
    const nextRules = rules.filter(r => r.id !== ruleId);
    applyWorkspace({ ...workspace, appetiteRules: nextRules });
    setDeleteConfirmId(null);
    if (rule) setStatusMessage({ severity: 'success', text: `Deleted rule "${rule.name}".` });
  }, [applyWorkspace, workspace, rules, setStatusMessage]);

  const updateRule = useCallback((ruleId: string, patch: Partial<GrcAppetiteRule>) => {
    const now = new Date().toISOString();
    const nextRules = rules.map(r => r.id === ruleId ? { ...r, ...patch, updatedAt: now } : r);
    applyWorkspace({ ...workspace, appetiteRules: nextRules });
  }, [applyWorkspace, workspace, rules]);

  const ruleToDelete = deleteConfirmId ? rules.find(r => r.id === deleteConfirmId) : null;

  return (
    <Box sx={{ display: 'grid', gap: 2 }}>
      <Paper sx={cardSx}>
        <Typography variant="subtitle2" sx={{ mb: 0.5 }}>Risk Appetite Rules</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Define scoped appetite thresholds that override the global threshold ({workspace.riskModel.appetiteThresholdScore}) for specific asset domains, tier classifications, or criticality levels.
          The most specific matching rule wins. Ties are broken by the lowest threshold.
        </Typography>

        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 1.5, mb: 2 }}>
          <Tooltip title="Descriptive name for this appetite rule" arrow>
            <TextField size="small" label="Rule Name" value={newName}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewName(e.target.value)} />
          </Tooltip>
          <Tooltip title="Optional description of when this rule applies" arrow>
            <TextField size="small" label="Description" value={newDescription}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewDescription(e.target.value)} />
          </Tooltip>
          <Tooltip title="Scope to risks whose assets belong to this domain (optional)" arrow>
            <TextField size="small" select label="Scope: Domain" value={newDomain}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewDomain(e.target.value as GrcAssetDomain | '')}>
              <MenuItem value=""><em>Any</em></MenuItem>
              {(Object.keys(domainLabels) as GrcAssetDomain[]).map(key => (
                <MenuItem key={key} value={key}>{domainLabels[key]}</MenuItem>
              ))}
            </TextField>
          </Tooltip>
          <Tooltip title="Scope to risks classified under this Tier 1 category (optional)" arrow>
            <TextField size="small" select label="Scope: Tier 1" value={newTier1}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewTier1(e.target.value)}>
              <MenuItem value=""><em>Any</em></MenuItem>
              {tier1Nodes.map(node => (
                <MenuItem key={node.id} value={node.label}>{node.label}</MenuItem>
              ))}
            </TextField>
          </Tooltip>
          <Tooltip title="Scope to risks whose linked assets have maximum criticality at or above this level (1-5, optional)" arrow>
            <TextField size="small" type="number" label="Scope: Min Criticality" value={newCritMin}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewCritMin(e.target.value)}
              inputProps={{ min: 1, max: 5 }} />
          </Tooltip>
          <Tooltip title="The appetite threshold score for matching risks — risks at or above this score exceed appetite" arrow>
            <TextField size="small" type="number" label="Threshold Score" value={newThreshold}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewThreshold(e.target.value)}
              inputProps={{ min: 1 }} />
          </Tooltip>
        </Box>
        <Tooltip describeChild title="Create a new scoped appetite rule from the values above." arrow>
          <Button variant="outlined" size="small" startIcon={<Plus size={16} />} onClick={handleAdd}>
            Add Rule
          </Button>
        </Tooltip>

        {rules.length > 0 && (
          <TableContainer sx={{ mt: 2 }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <Tooltip describeChild title="Click a rule name to edit inline." arrow>
                    <TableCell>Name</TableCell>
                  </Tooltip>
                  <Tooltip describeChild title="Optional asset domain scope for rule matching." arrow>
                    <TableCell>Domain</TableCell>
                  </Tooltip>
                  <Tooltip describeChild title="Optional Tier 1 statement scope for rule matching." arrow>
                    <TableCell>Tier 1</TableCell>
                  </Tooltip>
                  <Tooltip describeChild title="Optional minimum linked-asset criticality (1-5)." arrow>
                    <TableCell>Min Criticality</TableCell>
                  </Tooltip>
                  <Tooltip describeChild title="Appetite threshold score applied when this rule matches." arrow>
                    <TableCell>Threshold</TableCell>
                  </Tooltip>
                  <TableCell sx={{ width: 48 }} />
                </TableRow>
              </TableHead>
              <TableBody>
                {rules.map(rule => (
                  <TableRow key={rule.id}>
                    <TableCell
                      onClick={() => { setEditingCell({ id: rule.id, field: 'name' }); setEditValue(rule.name); }}
                      sx={{ cursor: 'pointer', '&:hover': { backgroundColor: 'action.hover' } }}>
                      {editingCell?.id === rule.id && editingCell.field === 'name' ? (
                        <Tooltip describeChild title="Edit the rule name and press Enter or blur to save." arrow>
                          <TextField size="small" value={editValue} autoFocus
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditValue(e.target.value)}
                            onBlur={() => { if (editValue.trim()) updateRule(rule.id, { name: editValue.trim() }); setEditingCell(null); }}
                            onKeyDown={(e: React.KeyboardEvent) => { if (e.key === 'Enter') { if (editValue.trim()) updateRule(rule.id, { name: editValue.trim() }); setEditingCell(null); } }} />
                        </Tooltip>
                      ) : rule.name}
                    </TableCell>
                    <TableCell>
                      <Tooltip describeChild title="Set or clear domain scope for this rule." arrow>
                        <TextField size="small" select value={rule.scopeAssetDomain || ''} variant="standard"
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateRule(rule.id, { scopeAssetDomain: (e.target.value || undefined) as GrcAssetDomain | undefined })}>
                          <MenuItem value=""><em>Any</em></MenuItem>
                          {(Object.keys(domainLabels) as GrcAssetDomain[]).map(key => (
                            <MenuItem key={key} value={key}>{domainLabels[key]}</MenuItem>
                          ))}
                        </TextField>
                      </Tooltip>
                    </TableCell>
                    <TableCell>
                      <Tooltip describeChild title="Set or clear Tier 1 statement scope for this rule." arrow>
                        <TextField size="small" select value={rule.scopeTier1 || ''} variant="standard"
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateRule(rule.id, { scopeTier1: e.target.value || undefined })}>
                          <MenuItem value=""><em>Any</em></MenuItem>
                          {tier1Nodes.map(node => (
                            <MenuItem key={node.id} value={node.label}>{node.label}</MenuItem>
                          ))}
                        </TextField>
                      </Tooltip>
                    </TableCell>
                    <TableCell
                      onClick={() => { setEditingCell({ id: rule.id, field: 'critMin' }); setEditValue(String(rule.scopeAssetCriticalityMin ?? '')); }}
                      sx={{ cursor: 'pointer', '&:hover': { backgroundColor: 'action.hover' } }}>
                      {editingCell?.id === rule.id && editingCell.field === 'critMin' ? (
                        <Tooltip describeChild title="Set minimum criticality scope (1-5), or leave blank for any." arrow>
                          <TextField size="small" type="number" value={editValue} autoFocus
                            inputProps={{ min: 1, max: 5 }}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditValue(e.target.value)}
                            onBlur={() => {
                              const num = Number(editValue);
                              updateRule(rule.id, { scopeAssetCriticalityMin: (Number.isFinite(num) && num >= 1 && num <= 5) ? num : undefined });
                              setEditingCell(null);
                            }}
                            onKeyDown={(e: React.KeyboardEvent) => {
                              if (e.key === 'Enter') {
                                const num = Number(editValue);
                                updateRule(rule.id, { scopeAssetCriticalityMin: (Number.isFinite(num) && num >= 1 && num <= 5) ? num : undefined });
                                setEditingCell(null);
                              }
                            }} />
                        </Tooltip>
                      ) : (rule.scopeAssetCriticalityMin ?? '-')}
                    </TableCell>
                    <TableCell
                      onClick={() => { setEditingCell({ id: rule.id, field: 'threshold' }); setEditValue(String(rule.thresholdScore)); }}
                      sx={{ cursor: 'pointer', fontWeight: 600, '&:hover': { backgroundColor: 'action.hover' } }}>
                      {editingCell?.id === rule.id && editingCell.field === 'threshold' ? (
                        <Tooltip describeChild title="Set the threshold score for this rule; higher scores are less tolerant." arrow>
                          <TextField size="small" type="number" value={editValue} autoFocus
                            inputProps={{ min: 1 }}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditValue(e.target.value)}
                            onBlur={() => {
                              const num = Number(editValue);
                              if (Number.isFinite(num) && num > 0) updateRule(rule.id, { thresholdScore: num });
                              setEditingCell(null);
                            }}
                            onKeyDown={(e: React.KeyboardEvent) => {
                              if (e.key === 'Enter') {
                                const num = Number(editValue);
                                if (Number.isFinite(num) && num > 0) updateRule(rule.id, { thresholdScore: num });
                                setEditingCell(null);
                              }
                            }} />
                        </Tooltip>
                      ) : rule.thresholdScore}
                    </TableCell>
                    <TableCell>
                      <Tooltip title="Delete this appetite rule" arrow>
                        <IconButton size="small" onClick={() => setDeleteConfirmId(rule.id)}>
                          <Trash2 size={16} />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      <Dialog open={Boolean(ruleToDelete)} onClose={() => setDeleteConfirmId(null)}>
        <DialogTitle>Delete Appetite Rule</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Delete rule "{ruleToDelete?.name}"? Risks previously scoped by this rule will fall back to the global appetite threshold.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Tooltip describeChild title="Keep this appetite rule and close dialog." arrow>
            <Button onClick={() => setDeleteConfirmId(null)}>Cancel</Button>
          </Tooltip>
          <Tooltip describeChild title="Delete this appetite rule permanently." arrow>
            <Button color="error" onClick={() => deleteConfirmId && handleDelete(deleteConfirmId)}>Delete</Button>
          </Tooltip>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default GrcConfigAppetiteSection;
