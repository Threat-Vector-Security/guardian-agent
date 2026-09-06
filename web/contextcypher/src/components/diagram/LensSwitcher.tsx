/**
 * LensSwitcher - segmented control for the canvas annotation lenses.
 * One lens active at a time keeps the diagram clean (v2 plan Phase 3).
 * Keyboard: 1 Model · 2 Threats · 3 Attack Path · 4 Controls.
 */

import React from 'react';
import { Box, Tooltip, Typography } from '@mui/material';
import type { DiagramLens } from '../../contexts/DiagramLensContext';
import type { Theme } from '../../styles/Theme';

const LENSES: Array<{ id: DiagramLens; label: string; hint: string; key: string }> = [
  { id: 'model', label: 'Model', hint: 'Plain diagram — no annotations', key: '1' },
  { id: 'threats', label: 'Threats', hint: 'Finding badges on affected elements', key: '2' },
  { id: 'attackPath', label: 'Path', hint: 'Walk the selected attack path; everything else dims', key: '3' },
  { id: 'controls', label: 'Controls', hint: 'Treatment status per element', key: '4' }
];

interface LensSwitcherProps {
  theme: Theme;
  activeLens: DiagramLens;
  onLensChange: (lens: DiagramLens) => void;
}

export const LensSwitcher: React.FC<LensSwitcherProps> = ({ theme, activeLens, onLensChange }) => {
  const colors = theme.colors as any;
  return (
    <Box
      role="tablist"
      aria-label="Diagram lens"
      sx={{
        display: 'flex',
        alignItems: 'center',
        border: `1px solid ${colors.border}`,
        borderRadius: 1.5,
        overflow: 'hidden'
      }}
    >
      {LENSES.map(lens => {
        const active = lens.id === activeLens;
        return (
          <Tooltip key={lens.id} title={`${lens.hint} (${lens.key})`} arrow>
            <Box
              role="tab"
              aria-selected={active}
              tabIndex={0}
              onClick={() => onLensChange(lens.id)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onLensChange(lens.id); }}
              sx={{
                px: 1,
                py: 0.4,
                cursor: 'pointer',
                backgroundColor: active ? colors.primary : 'transparent',
                '&:hover': { backgroundColor: active ? colors.primary : colors.surfaceHover }
              }}
            >
              <Typography variant="caption" sx={{
                fontSize: 11,
                fontWeight: active ? 700 : 500,
                color: active ? '#ffffff' : colors.textSecondary
              }}>
                {lens.label}
              </Typography>
            </Box>
          </Tooltip>
        );
      })}
    </Box>
  );
};

/**
 * LensBanner - on-canvas pill shown while a non-Model lens filters the view,
 * so it is always obvious WHY elements are highlighted or faded, with a
 * one-click way back to the plain diagram.
 */
interface LensBannerProps {
  theme: Theme;
  activeLens: DiagramLens;
  detail?: string;
  onExit: () => void;
}

const LENS_BANNER_TEXT: Record<Exclude<DiagramLens, 'model'>, string> = {
  threats: 'Threats view — finding badges shown on affected elements',
  attackPath: 'Attack Path view — other elements are faded',
  controls: 'Controls view — treatment status shown on elements'
};

export const LensBanner: React.FC<LensBannerProps> = ({ theme, activeLens, detail, onExit }) => {
  if (activeLens === 'model') return null;
  const colors = theme.colors as any;
  return (
    <Box
      sx={{
        position: 'absolute',
        top: 16,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 1190,
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        px: 1.5,
        py: 0.5,
        borderRadius: 99,
        backgroundColor: colors.primary,
        color: '#ffffff',
        boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
        maxWidth: '70%'
      }}
    >
      <Typography variant="caption" sx={{ fontWeight: 600, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {LENS_BANNER_TEXT[activeLens]}
        {detail ? ` · ${detail}` : ''}
      </Typography>
      <Box
        role="button"
        tabIndex={0}
        onClick={onExit}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onExit(); }}
        sx={{
          cursor: 'pointer',
          fontSize: 11,
          fontWeight: 700,
          px: 1,
          py: 0.1,
          borderRadius: 99,
          backgroundColor: 'rgba(255,255,255,0.25)',
          whiteSpace: 'nowrap',
          '&:hover': { backgroundColor: 'rgba(255,255,255,0.4)' }
        }}
      >
        Exit (Esc)
      </Box>
    </Box>
  );
};

export default LensSwitcher;
