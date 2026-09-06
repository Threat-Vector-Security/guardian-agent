import React, { useCallback, useMemo, useState } from 'react';
import {
  Box, Button, Chip, IconButton, MenuItem, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, TextField, Tooltip, Typography
} from '@mui/material';
import DeleteOutlined from '@mui/icons-material/DeleteOutlined';
import AddOutlined from '@mui/icons-material/AddOutlined';
import { GrcWorkspace, GrcFrameworkMapping, GrcFrameworkMappingRelationship } from '../../types/GrcTypes';
import { createId, LBL, downloadText } from './grcShared';
import { exportFrameworkMappingsCsv } from '../../services/GrcWorkspaceService';
import { Download } from 'lucide-react';

interface Props {
  workspace: GrcWorkspace;
  applyWorkspace: (next: GrcWorkspace) => void;
}

const RELATIONSHIP_OPTIONS: GrcFrameworkMappingRelationship[] = ['equivalent', 'partial', 'related'];

const RELATIONSHIP_COLORS: Record<GrcFrameworkMappingRelationship, string> = {
  equivalent: '#16a34a',
  partial: '#ca8a04',
  related: '#3b82f6'
};

const GrcCrossFrameworkMappingsSection: React.FC<Props> = ({ workspace, applyWorkspace }) => {
  const controlSets = useMemo(() => workspace.controlSets || [], [workspace.controlSets]);
  const mappings = useMemo(() => workspace.frameworkMappings || [], [workspace.frameworkMappings]);

  const [srcSetId, setSrcSetId] = useState('');
  const [srcCtrlId, setSrcCtrlId] = useState('');
  const [tgtSetId, setTgtSetId] = useState('');
  const [tgtCtrlId, setTgtCtrlId] = useState('');
  const [relationship, setRelationship] = useState<GrcFrameworkMappingRelationship>('equivalent');
  const [notes, setNotes] = useState('');

  const srcControls = useMemo(
    () => controlSets.find(cs => cs.id === srcSetId)?.controls || [],
    [controlSets, srcSetId]
  );
  const tgtControls = useMemo(
    () => controlSets.find(cs => cs.id === tgtSetId)?.controls || [],
    [controlSets, tgtSetId]
  );

  const csName = useCallback(
    (csId: string) => controlSets.find(cs => cs.id === csId)?.name || csId,
    [controlSets]
  );

  const handleAdd = useCallback(() => {
    if (!srcSetId || !srcCtrlId || !tgtSetId || !tgtCtrlId) return;
    const now = new Date().toISOString();
    const mapping: GrcFrameworkMapping = {
      id: createId('fwm'),
      sourceControlSetId: srcSetId,
      sourceControlId: srcCtrlId,
      targetControlSetId: tgtSetId,
      targetControlId: tgtCtrlId,
      relationship,
      notes: notes.trim(),
      createdAt: now
    };
    applyWorkspace({
      ...workspace,
      frameworkMappings: [...mappings, mapping],
      updatedAt: now
    });
    setSrcCtrlId('');
    setTgtCtrlId('');
    setNotes('');
  }, [applyWorkspace, workspace, mappings, srcSetId, srcCtrlId, tgtSetId, tgtCtrlId, relationship, notes]);

  const handleDelete = useCallback((id: string) => {
    applyWorkspace({
      ...workspace,
      frameworkMappings: mappings.filter(m => m.id !== id),
      updatedAt: new Date().toISOString()
    });
  }, [applyWorkspace, workspace, mappings]);

  const handleExport = useCallback(() => {
    const csv = exportFrameworkMappingsCsv(workspace);
    const filename = workspace.config?.exportFilenames?.frameworkMappingsCsv || 'grc-framework-mappings.csv';
    downloadText(filename, csv, 'text/csv;charset=utf-8');
  }, [workspace]);

  if (controlSets.length < 2 && mappings.length === 0) return null;

  return (
    <Box sx={{ mt: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
        <Box>
          <Typography variant="subtitle1">Cross-Framework Mappings</Typography>
          <Typography variant="body2" color="text.secondary">
            Map controls across different frameworks to show equivalence or overlap.
          </Typography>
        </Box>
        {mappings.length > 0 && (
          <Tooltip title="Export framework mappings to CSV" arrow>
            <Button size="small" variant="outlined" startIcon={<Download size={14} />} onClick={handleExport}>
              Export CSV
            </Button>
          </Tooltip>
        )}
      </Box>

      <Box sx={{ p: 1.5, bgcolor: 'action.hover', borderRadius: 1, mb: 1.5, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 1, alignItems: 'end' }}>
        <TextField size="small" select label="Source Set" value={srcSetId}
          onChange={e => { setSrcSetId(e.target.value); setSrcCtrlId(''); }}>
          {controlSets.map(cs => <MenuItem key={cs.id} value={cs.id}>{cs.name}</MenuItem>)}
        </TextField>
        {srcSetId ? (
          <TextField size="small" select label="Source Control" value={srcCtrlId}
            onChange={e => setSrcCtrlId(e.target.value)}>
            {srcControls.map(c => <MenuItem key={c.controlId} value={c.controlId}>{c.controlId}</MenuItem>)}
          </TextField>
        ) : (
          <TextField size="small" label="Source Control" value={srcCtrlId}
            onChange={e => setSrcCtrlId(e.target.value)} placeholder="Control ID" />
        )}
        <TextField size="small" select label="Target Set" value={tgtSetId}
          onChange={e => { setTgtSetId(e.target.value); setTgtCtrlId(''); }}>
          {controlSets.map(cs => <MenuItem key={cs.id} value={cs.id}>{cs.name}</MenuItem>)}
        </TextField>
        {tgtSetId ? (
          <TextField size="small" select label="Target Control" value={tgtCtrlId}
            onChange={e => setTgtCtrlId(e.target.value)}>
            {tgtControls.map(c => <MenuItem key={c.controlId} value={c.controlId}>{c.controlId}</MenuItem>)}
          </TextField>
        ) : (
          <TextField size="small" label="Target Control" value={tgtCtrlId}
            onChange={e => setTgtCtrlId(e.target.value)} placeholder="Control ID" />
        )}
        <TextField size="small" select label="Relationship" value={relationship}
          onChange={e => setRelationship(e.target.value as GrcFrameworkMappingRelationship)}>
          {RELATIONSHIP_OPTIONS.map(r => <MenuItem key={r} value={r}>{LBL[r] || r}</MenuItem>)}
        </TextField>
        <TextField size="small" label="Notes" value={notes}
          onChange={e => setNotes(e.target.value)} />
        <Button size="small" variant="contained" startIcon={<AddOutlined />} onClick={handleAdd}
          disabled={!srcSetId || !srcCtrlId || !tgtSetId || !tgtCtrlId}>
          Add
        </Button>
      </Box>

      {mappings.length > 0 && (
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Source Set</TableCell>
                <TableCell>Source Control</TableCell>
                <TableCell>Target Set</TableCell>
                <TableCell>Target Control</TableCell>
                <TableCell>Relationship</TableCell>
                <TableCell>Notes</TableCell>
                <TableCell sx={{ width: 40 }} />
              </TableRow>
            </TableHead>
            <TableBody>
              {mappings.map(m => {
                const relColor = RELATIONSHIP_COLORS[m.relationship];
                return (
                  <TableRow key={m.id} hover>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontSize: '0.85rem' }}>{csName(m.sourceControlSetId)}</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontSize: '0.85rem' }}>{m.sourceControlId}</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontSize: '0.85rem' }}>{csName(m.targetControlSetId)}</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontSize: '0.85rem' }}>{m.targetControlId}</Typography>
                    </TableCell>
                    <TableCell>
                      <Box component="span" sx={{
                        px: 1, py: 0.25, borderRadius: 1, fontSize: '0.75rem', fontWeight: 600,
                        bgcolor: relColor + '22', color: relColor, border: `1px solid ${relColor}44`
                      }}>
                        {LBL[m.relationship] || m.relationship}
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption" color="text.secondary">{m.notes || '\u2014'}</Typography>
                    </TableCell>
                    <TableCell>
                      <IconButton size="small" onClick={() => handleDelete(m.id)}>
                        <DeleteOutlined sx={{ fontSize: 16 }} />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {mappings.length === 0 && (
        <Typography variant="body2" color="text.secondary" sx={{ py: 1 }}>
          No framework mappings defined yet. Add a mapping above to show control equivalence across frameworks.
        </Typography>
      )}
    </Box>
  );
};

export default GrcCrossFrameworkMappingsSection;
