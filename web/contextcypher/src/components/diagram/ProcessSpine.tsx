/**
 * ProcessSpine - the visible threat modeling workflow indicator.
 *
 * Renders the five stages of the threat modeling loop
 * (Scope → Model → Analyze → Treat → Report), derives each stage's state from
 * the actual model, and always suggests the next step. Clicking a stage
 * navigates to the relevant surface. Collapsible for experts.
 */

import React, { useMemo, useState } from 'react';
import {
  Box,
  Typography,
  Tooltip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField
} from '@mui/material';
import {
  CheckCircle as DoneIcon,
  RadioButtonUnchecked as PendingIcon,
  ChevronRight as ArrowIcon,
  UnfoldLess as CollapseIcon,
  UnfoldMore as ExpandIcon
} from '@mui/icons-material';
import type { Theme } from '../../styles/Theme';

export type SpineStage = 'scope' | 'model' | 'analyze' | 'treat' | 'report';

export interface SpineState {
  scope: boolean;
  model: boolean;
  analyze: boolean;
  treat: boolean;
  report: boolean;
}

const STAGES: Array<{ id: SpineStage; label: string; hint: string }> = [
  { id: 'scope', label: 'Scope', hint: 'Describe the system, assumptions and what is in/out of scope' },
  { id: 'model', label: 'Model', hint: 'Draw or generate the system diagram' },
  { id: 'analyze', label: 'Analyze', hint: 'Run threat analysis to find what can go wrong' },
  { id: 'treat', label: 'Treat', hint: 'Decide what to do about each finding' },
  { id: 'report', label: 'Report', hint: 'Export the threat model document' }
];

interface ProcessSpineProps {
  theme: Theme;
  state: SpineState;
  onStageClick: (stage: SpineStage) => void;
}

export const ProcessSpine: React.FC<ProcessSpineProps> = ({ theme, state, onStageClick }) => {
  const colors = theme.colors as any;
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try { return window.localStorage.getItem('processSpine.collapsed') === 'true'; } catch { return false; }
  });

  const toggleCollapsed = () => {
    setCollapsed(prev => {
      try { window.localStorage.setItem('processSpine.collapsed', String(!prev)); } catch { /* ignore */ }
      return !prev;
    });
  };

  // The suggested next stage is the first incomplete one
  const nextStage = useMemo<SpineStage | null>(() => {
    const found = STAGES.find(s => !state[s.id]);
    return found ? found.id : null;
  }, [state]);

  if (collapsed) {
    return (
      <Tooltip title="Show threat modeling progress" arrow>
        <IconButton size="small" onClick={toggleCollapsed} sx={{ color: colors.textSecondary }} aria-label="Show workflow progress">
          <ExpandIcon sx={{ fontSize: 16 }} />
        </IconButton>
      </Tooltip>
    );
  }

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
      {STAGES.map((stage, i) => {
        const done = state[stage.id];
        const isNext = nextStage === stage.id;
        return (
          <React.Fragment key={stage.id}>
            {i > 0 && <ArrowIcon sx={{ fontSize: 13, color: colors.textSecondary, opacity: 0.6 }} />}
            <Tooltip title={`${stage.hint}${isNext ? ' (suggested next step)' : ''}`} arrow>
              <Box
                onClick={() => onStageClick(stage.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onStageClick(stage.id); }}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.5,
                  px: 0.75,
                  py: 0.25,
                  borderRadius: 1,
                  cursor: 'pointer',
                  border: isNext ? `1.5px solid ${colors.primary}` : '1.5px solid transparent',
                  backgroundColor: isNext ? `${colors.primary}14` : 'transparent',
                  '&:hover': { backgroundColor: colors.surfaceHover }
                }}
              >
                {done
                  ? <DoneIcon sx={{ fontSize: 13, color: colors.success }} />
                  : <PendingIcon sx={{ fontSize: 13, color: isNext ? colors.primary : colors.textSecondary }} />}
                <Typography variant="caption" sx={{
                  fontWeight: isNext ? 700 : 500,
                  color: done ? colors.textPrimary : (isNext ? colors.primary : colors.textSecondary),
                  fontSize: 11
                }}>
                  {stage.label}
                </Typography>
              </Box>
            </Tooltip>
          </React.Fragment>
        );
      })}
      <Tooltip title="Hide workflow progress" arrow>
        <IconButton size="small" onClick={toggleCollapsed} sx={{ color: colors.textSecondary, ml: 0.25 }} aria-label="Hide workflow progress">
          <CollapseIcon sx={{ fontSize: 14 }} />
        </IconButton>
      </Tooltip>
    </Box>
  );
};

/* ------------------------------------------------------------------ */
/* Scope dialog: the "what are we building?" form. Its content feeds  */
/* the AI analysis context (customContext).                           */
/* ------------------------------------------------------------------ */

export interface ScopeInfo {
  description: string;
  assumptions: string;
  outOfScope: string;
}

export const formatScopeAsContext = (scope: ScopeInfo): string => {
  const parts: string[] = [];
  if (scope.description.trim()) parts.push(`SYSTEM DESCRIPTION:\n${scope.description.trim()}`);
  if (scope.assumptions.trim()) parts.push(`ASSUMPTIONS:\n${scope.assumptions.trim()}`);
  if (scope.outOfScope.trim()) parts.push(`OUT OF SCOPE:\n${scope.outOfScope.trim()}`);
  return parts.join('\n\n');
};

/** Best-effort parse of a customContext string previously produced by formatScopeAsContext. */
export const parseScopeFromContext = (content: string | undefined | null): ScopeInfo => {
  const empty: ScopeInfo = { description: '', assumptions: '', outOfScope: '' };
  if (!content) return empty;
  const grab = (header: string): string => {
    const match = content.match(new RegExp(`${header}:\\n([\\s\\S]*?)(?=\\n\\n[A-Z ]+:|$)`));
    return match ? match[1].trim() : '';
  };
  const description = grab('SYSTEM DESCRIPTION');
  // If the content wasn't produced by us, surface it all as the description
  if (!description && !content.includes('ASSUMPTIONS:') && !content.includes('OUT OF SCOPE:')) {
    return { description: content.trim(), assumptions: '', outOfScope: '' };
  }
  return {
    description,
    assumptions: grab('ASSUMPTIONS'),
    outOfScope: grab('OUT OF SCOPE')
  };
};

interface ScopeDialogProps {
  open: boolean;
  initial: ScopeInfo;
  onClose: () => void;
  onSave: (scope: ScopeInfo) => void;
}

export const ScopeDialog: React.FC<ScopeDialogProps> = ({ open, initial, onClose, onSave }) => {
  const [scope, setScope] = useState<ScopeInfo>(initial);

  // Refresh local state when reopened with new initial values
  React.useEffect(() => {
    if (open) setScope(initial);
  }, [open, initial]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Scope &amp; Assumptions</DialogTitle>
      <DialogContent dividers>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          What are we building? This description travels with the threat model and is
          given to the AI as context for analysis.
        </Typography>
        <TextField
          label="System description"
          multiline
          minRows={4}
          fullWidth
          value={scope.description}
          onChange={(e) => setScope(s => ({ ...s, description: e.target.value }))}
          sx={{ mb: 2 }}
        />
        <TextField
          label="Assumptions"
          placeholder="e.g. TLS everywhere internally; admins are trusted; cloud provider controls are out of our hands"
          multiline
          minRows={2}
          fullWidth
          value={scope.assumptions}
          onChange={(e) => setScope(s => ({ ...s, assumptions: e.target.value }))}
          sx={{ mb: 2 }}
        />
        <TextField
          label="Out of scope"
          placeholder="e.g. physical security; the legacy billing system"
          multiline
          minRows={2}
          fullWidth
          value={scope.outOfScope}
          onChange={(e) => setScope(s => ({ ...s, outOfScope: e.target.value }))}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={() => { onSave(scope); onClose(); }}>
          Save Scope
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ProcessSpine;
