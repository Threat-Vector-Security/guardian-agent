import React, { useCallback, useMemo, useState } from 'react';
import {
  Box, Button, MenuItem, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, TextField, Tooltip, Typography
} from '@mui/material';
import { Plus } from 'lucide-react';
import { GrcWorkspace } from '../../types/GrcTypes';
import { GrcTabProps, createId } from './grcShared';

const GrcConfigTierSection: React.FC<GrcTabProps> = ({ workspace, applyWorkspace, setStatusMessage }) => {
  const [newTierLevel, setNewTierLevel] = useState<1 | 2 | 3 | 4>(3);
  const [newTierParentId, setNewTierParentId] = useState<string>('');
  const [newTierLabel, setNewTierLabel] = useState('');
  const [newTierDescription, setNewTierDescription] = useState('');

  const tierParentOptions = useMemo(
    () => workspace.tierCatalogue.filter(entry => {
      if (newTierLevel === 1) return false;
      return entry.tier === (newTierLevel - 1);
    }),
    [newTierLevel, workspace.tierCatalogue]
  );

  const handleAddTierEntry = useCallback(() => {
    const label = newTierLabel.trim();
    if (!label) {
      setStatusMessage({ severity: 'warning', text: 'Risk statement label is required.' });
      return;
    }
    if (newTierLevel > 1 && !newTierParentId) {
      setStatusMessage({ severity: 'warning', text: 'Select a parent statement for this tier.' });
      return;
    }

    const nextTierEntry = {
      id: `tier${newTierLevel}-${createId('node')}`,
      tier: newTierLevel,
      parentId: newTierLevel > 1 ? newTierParentId : undefined,
      label,
      description: newTierDescription.trim() || undefined
    } as GrcWorkspace['tierCatalogue'][number];

    applyWorkspace({ ...workspace, tierCatalogue: [...workspace.tierCatalogue, nextTierEntry] });
    setNewTierLabel('');
    setNewTierDescription('');
    setStatusMessage({ severity: 'success', text: `Added Tier ${newTierLevel} statement "${label}".` });
  }, [applyWorkspace, newTierDescription, newTierLabel, newTierLevel, newTierParentId, workspace, setStatusMessage]);

  return (
    <Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.25 }}>
        Maintain a statement-based taxonomy: Tier 2 (board-level risk categories), Tier 3 (named risk scenarios). Findings serve as operational evidence at the Tier 4 level.
      </Typography>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, mb: 1.5 }}>
        <Tooltip describeChild title="Select which statement tier level to add." arrow>
          <TextField size="small" select label="Tier" value={newTierLevel}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewTierLevel(Number(e.target.value) as 1 | 2 | 3 | 4)} sx={{ width: 120 }}>
            <MenuItem value={1}>Tier 1</MenuItem>
            <MenuItem value={2}>Tier 2</MenuItem>
            <MenuItem value={3}>Tier 3</MenuItem>
            <MenuItem value={4}>Tier 4</MenuItem>
          </TextField>
        </Tooltip>
        <Tooltip describeChild title="Choose the parent statement for this tier item (required for Tier 2-4)." arrow>
          <TextField size="small" select label="Parent Statement" value={newTierParentId}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewTierParentId(e.target.value)} sx={{ minWidth: 240 }} disabled={newTierLevel === 1}>
            <MenuItem value="">None</MenuItem>
            {tierParentOptions.map(opt => (
              <MenuItem key={opt.id} value={opt.id}>{opt.label}</MenuItem>
            ))}
          </TextField>
        </Tooltip>
        <Tooltip describeChild title="Human-readable risk statement label used in tier cascades." arrow>
          <TextField size="small" label="Risk Statement Label" value={newTierLabel}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewTierLabel(e.target.value)} sx={{ minWidth: 260 }} />
        </Tooltip>
        <Tooltip describeChild title="Optional context or narrative for the statement node." arrow>
          <TextField size="small" label="Details / Context" value={newTierDescription}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewTierDescription(e.target.value)} sx={{ minWidth: 320 }} />
        </Tooltip>
        <Tooltip describeChild title="Add a statement entry at the selected tier level." arrow>
          <Button variant="outlined" startIcon={<Plus size={16} />} onClick={handleAddTierEntry}>
            Add Statement Node
          </Button>
        </Tooltip>
      </Box>

      <TableContainer component={Box} sx={{ maxHeight: 'calc(100vh - 380px)', minHeight: 300, overflow: 'auto' }}>
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell>Tier</TableCell>
              <TableCell>Risk Statement Label</TableCell>
              <TableCell>Parent</TableCell>
              <TableCell>Details / Context</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {workspace.tierCatalogue.map(entry => (
              <TableRow key={entry.id}>
                <TableCell>{entry.tier}</TableCell>
                <TableCell>{entry.label}</TableCell>
                <TableCell>{entry.parentId || '-'}</TableCell>
                <TableCell>{entry.description || '-'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};

export default GrcConfigTierSection;
