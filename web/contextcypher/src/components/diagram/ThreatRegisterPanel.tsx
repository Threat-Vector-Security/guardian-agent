/**
 * ThreatRegisterPanel - the unified threat register (v2 plan Phase 4).
 *
 * One sortable, filterable list of every structured finding on the diagram
 * (source of truth: node.data.securityContext.threats). Status edits write
 * straight back to the node, so the canvas badges (threats/controls lenses),
 * this register and any GRC views stay one dataset. Row click focuses the
 * element on canvas.
 */

import React, { useMemo, useState, useCallback } from 'react';
import {
  Box,
  Typography,
  Select,
  MenuItem,
  TextField,
  InputAdornment,
  Chip,
  IconButton,
  Tooltip
} from '@mui/material';
import { Search as SearchIcon, GpsFixed as FocusIcon } from '@mui/icons-material';
import { SecurityNode } from '../../types/SecurityTypes';
import { useSettings } from '../../settings/SettingsContext';
import { getTheme } from '../../styles/Theme';
import { severityColor } from '../../contexts/DiagramLensContext';

type ThreatStatus = 'identified' | 'mitigated' | 'accepted' | 'transferred';

const STATUS_OPTIONS: Array<{ value: ThreatStatus; label: string }> = [
  { value: 'identified', label: 'Open' },
  { value: 'mitigated', label: 'Mitigated' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'transferred', label: 'Transferred' }
];

const SEVERITY_ORDER: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };

interface RegisterRow {
  nodeId: string;
  nodeLabel: string;
  refCode: string;
  threatIndex: number;
  threat: any;
}

interface ThreatRegisterPanelProps {
  nodes: SecurityNode[];
  onNodesUpdate: (nodes: SecurityNode[]) => void;
  onFocusNode?: (nodeId: string) => void;
}

export const ThreatRegisterPanel: React.FC<ThreatRegisterPanelProps> = ({
  nodes,
  onNodesUpdate,
  onFocusNode
}) => {
  const { settings } = useSettings();
  const theme = getTheme(settings.theme, settings.customTheme);
  const colors = theme.colors as any;
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | ThreatStatus>('all');

  const rows = useMemo<RegisterRow[]>(() => {
    const result: RegisterRow[] = [];
    nodes.forEach(node => {
      const threats = (node.data as any)?.securityContext?.threats;
      if (!Array.isArray(threats)) return;
      threats.forEach((threat: any, threatIndex: number) => {
        result.push({
          nodeId: node.id,
          nodeLabel: (node.data as any)?.label || String((node as any).type || (node as any).id),
          refCode: (node.data as any)?.indexCode || '',
          threatIndex,
          threat
        });
      });
    });
    // Most severe first, open before treated
    return result.sort((a, b) => {
      const aOpen = !a.threat?.status || a.threat.status === 'identified' ? 1 : 0;
      const bOpen = !b.threat?.status || b.threat.status === 'identified' ? 1 : 0;
      if (aOpen !== bOpen) return bOpen - aOpen;
      const aSev = SEVERITY_ORDER[String(a.threat?.severity || '').toLowerCase()] || 0;
      const bSev = SEVERITY_ORDER[String(b.threat?.severity || '').toLowerCase()] || 0;
      return bSev - aSev;
    });
  }, [nodes]);

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter(row => {
      const status: ThreatStatus = row.threat?.status || 'identified';
      if (statusFilter !== 'all' && status !== statusFilter) return false;
      if (!q) return true;
      const haystack = `${row.threat?.title || ''} ${row.threat?.description || ''} ${row.nodeLabel} ${row.refCode} ${row.threat?.category || ''}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [rows, query, statusFilter]);

  const handleStatusChange = useCallback((row: RegisterRow, status: ThreatStatus) => {
    onNodesUpdate(nodes.map(node => {
      if (node.id !== row.nodeId) return node;
      const data: any = node.data || {};
      const threats: any[] = Array.isArray(data.securityContext?.threats)
        ? [...data.securityContext.threats]
        : [];
      if (!threats[row.threatIndex]) return node;
      threats[row.threatIndex] = { ...threats[row.threatIndex], status, updatedAt: new Date() };
      return {
        ...node,
        data: {
          ...data,
          securityContext: { ...data.securityContext, threats }
        }
      } as SecurityNode;
    }));
  }, [nodes, onNodesUpdate]);

  const openCount = rows.filter(r => !r.threat?.status || r.threat.status === 'identified').length;

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', backgroundColor: colors.surface }}>
      <Box sx={{ p: 1.5, borderBottom: `1px solid ${colors.border}` }}>
        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mb: 1 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>Threat Register</Typography>
          <Typography variant="caption" color="text.secondary">
            {rows.length} finding{rows.length === 1 ? '' : 's'} · {openCount} open
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <TextField
            size="small"
            placeholder="Search findings…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            fullWidth
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ fontSize: 16 }} />
                </InputAdornment>
              )
            }}
          />
          <Select
            size="small"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            sx={{ minWidth: 110 }}
          >
            <MenuItem value="all">All</MenuItem>
            {STATUS_OPTIONS.map(o => (
              <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
            ))}
          </Select>
        </Box>
      </Box>

      <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
        {filteredRows.length === 0 && (
          <Box sx={{ p: 2 }}>
            <Typography variant="body2" color="text.secondary">
              {rows.length === 0
                ? 'No findings yet. Run an analysis (Analyze stage) or add findings manually — everything lands here and as badges on the diagram.'
                : 'No findings match the current filter.'}
            </Typography>
          </Box>
        )}
        {filteredRows.map(row => {
          const severity = String(row.threat?.severity || '').toLowerCase();
          const status: ThreatStatus = row.threat?.status || 'identified';
          return (
            <Box
              key={`${row.nodeId}-${row.threatIndex}`}
              sx={{
                px: 1.5,
                py: 1,
                borderBottom: `1px solid ${colors.border}`,
                '&:hover': { backgroundColor: colors.surfaceHover }
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.5 }}>
                <Chip
                  label={severity ? severity.toUpperCase() : 'N/A'}
                  size="small"
                  sx={{
                    height: 18,
                    fontSize: 10,
                    fontWeight: 700,
                    color: '#fff',
                    backgroundColor: severityColor(severity as any, colors)
                  }}
                />
                <Typography variant="body2" sx={{ fontWeight: 600, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {row.threat?.title || 'Untitled finding'}
                </Typography>
                {row.threat?.category && (
                  <Chip label={row.threat.category} size="small" variant="outlined" sx={{ height: 18, fontSize: 10 }} />
                )}
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Tooltip title={`Focus ${row.nodeLabel} on canvas`} arrow>
                  <Box
                    onClick={() => onFocusNode?.(row.nodeId)}
                    sx={{ display: 'flex', alignItems: 'center', gap: 0.5, cursor: 'pointer', color: colors.primary, minWidth: 0 }}
                  >
                    <FocusIcon sx={{ fontSize: 13 }} />
                    <Typography variant="caption" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {row.refCode ? `${row.refCode} · ` : ''}{row.nodeLabel}
                    </Typography>
                  </Box>
                </Tooltip>
                <Box sx={{ flex: 1 }} />
                <Select
                  size="small"
                  value={status}
                  onChange={(e) => handleStatusChange(row, e.target.value as ThreatStatus)}
                  sx={{ fontSize: 11, height: 24, '& .MuiSelect-select': { py: 0.25 } }}
                >
                  {STATUS_OPTIONS.map(o => (
                    <MenuItem key={o.value} value={o.value} sx={{ fontSize: 12 }}>{o.label}</MenuItem>
                  ))}
                </Select>
              </Box>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
};

export default ThreatRegisterPanel;
