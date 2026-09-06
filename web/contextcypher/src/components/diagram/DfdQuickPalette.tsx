/**
 * DfdQuickPalette - compact floating palette for fast manual DFD authoring.
 *
 * Exactly five tools: External Entity (E), Process (P), Data Store (D),
 * Trust Boundary (B) and a Data Flow hint (flows are drawn between node
 * handles). Click places a node on the canvas; drag places it at the cursor.
 * The full component toolbox stays available in the Components tab.
 */

import React, { useEffect, useCallback, useState } from 'react';
import { Box, IconButton, Tooltip, Typography, Paper } from '@mui/material';
import {
  RadioButtonUnchecked as ProcessIcon,
  CropSquare as ActorIcon,
  TableRows as DataStoreIcon,
  BorderStyle as BoundaryIcon,
  TrendingFlat as FlowIcon,
  Close as CloseIcon
} from '@mui/icons-material';
import { SecurityNodeType, SecurityZone } from '../../types/SecurityTypes';
import type { Theme } from '../../styles/Theme';

interface PaletteTool {
  type: SecurityNodeType;
  label: string;
  shortcut: string;
  icon: React.ReactNode;
}

const TOOLS: PaletteTool[] = [
  { type: 'dfdActor' as SecurityNodeType, label: 'External Entity', shortcut: 'E', icon: <ActorIcon fontSize="small" /> },
  { type: 'dfdProcess' as SecurityNodeType, label: 'Process', shortcut: 'P', icon: <ProcessIcon fontSize="small" /> },
  { type: 'dfdDataStore' as SecurityNodeType, label: 'Data Store', shortcut: 'D', icon: <DataStoreIcon fontSize="small" /> },
  { type: 'dfdTrustBoundary' as SecurityNodeType, label: 'Trust Boundary', shortcut: 'B', icon: <BoundaryIcon fontSize="small" /> }
];

interface DfdQuickPaletteProps {
  theme: Theme;
  onNodeCreate: (nodeType: SecurityNodeType, zoneType?: SecurityZone) => void;
  onDragStart: (event: React.DragEvent, nodeType: SecurityNodeType, zoneType?: SecurityZone) => void;
  onClose: () => void;
}

const isTypingTarget = (target: EventTarget | null): boolean => {
  const el = target as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName?.toLowerCase();
  return tag === 'input' || tag === 'textarea' || tag === 'select' || el.isContentEditable;
};

export const DfdQuickPalette: React.FC<DfdQuickPaletteProps> = ({
  theme,
  onNodeCreate,
  onDragStart,
  onClose
}) => {
  const colors = theme.colors as any;
  const [flashType, setFlashType] = useState<string | null>(null);

  const placeNode = useCallback((tool: PaletteTool) => {
    onNodeCreate(tool.type);
    setFlashType(tool.type);
    window.setTimeout(() => setFlashType(null), 250);
  }, [onNodeCreate]);

  // Keyboard shortcuts: E / P / D / B place elements when not typing
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
      if (isTypingTarget(event.target)) return;
      const key = event.key.toUpperCase();
      const tool = TOOLS.find(t => t.shortcut === key);
      if (tool) {
        event.preventDefault();
        placeNode(tool);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [placeNode]);

  return (
    <Paper
      elevation={3}
      sx={{
        position: 'absolute',
        top: 72,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 1200,
        display: 'flex',
        alignItems: 'center',
        gap: 0.5,
        px: 1,
        py: 0.5,
        borderRadius: 2,
        border: `1px solid ${colors.border}`,
        backgroundColor: colors.surface
      }}
    >
      <Typography variant="caption" sx={{ fontWeight: 700, color: colors.textSecondary, mr: 0.5, letterSpacing: '0.4px' }}>
        DFD
      </Typography>
      {TOOLS.map(tool => (
        <Tooltip key={tool.type} title={`${tool.label} — click to add, drag to place (${tool.shortcut})`} arrow>
          <IconButton
            size="small"
            draggable
            onDragStart={(e) => onDragStart(e, tool.type)}
            onClick={() => placeNode(tool)}
            sx={{
              color: flashType === tool.type ? colors.primary : colors.textPrimary,
              border: `1px solid ${flashType === tool.type ? colors.primary : 'transparent'}`,
              borderRadius: 1.5,
              flexDirection: 'column',
              px: 1,
              '&:hover': { backgroundColor: colors.surfaceHover, color: colors.primary }
            }}
            aria-label={`Add ${tool.label}`}
          >
            {tool.icon}
            <Typography variant="caption" sx={{ fontSize: 9, lineHeight: 1 }}>{tool.shortcut}</Typography>
          </IconButton>
        </Tooltip>
      ))}
      <Tooltip title="Data flows: drag between the small handles on any two elements" arrow>
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', px: 1, color: colors.textSecondary, cursor: 'help' }}>
          <FlowIcon fontSize="small" />
          <Typography variant="caption" sx={{ fontSize: 9, lineHeight: 1 }}>Flow</Typography>
        </Box>
      </Tooltip>
      <IconButton size="small" onClick={onClose} sx={{ ml: 0.5, color: colors.textSecondary }} aria-label="Hide DFD palette">
        <CloseIcon sx={{ fontSize: 14 }} />
      </IconButton>
    </Paper>
  );
};

export default DfdQuickPalette;
