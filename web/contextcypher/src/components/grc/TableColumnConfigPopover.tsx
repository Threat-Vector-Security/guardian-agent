import React, { useState } from 'react';
import {
  Box, Button, Checkbox, FormControlLabel, IconButton, Popover, Tooltip, Typography
} from '@mui/material';
import { ChevronDown, ChevronUp, Settings, Undo } from 'lucide-react';
import type { ColumnDef } from './useTableColumnConfig';

interface Props {
  allColumns: ColumnDef[];
  visibleIds: string[];
  onToggle: (columnId: string) => void;
  onMove: (columnId: string, direction: 'left' | 'right') => void;
  onReset: () => void;
}

const TableColumnConfigPopover: React.FC<Props> = ({ allColumns, visibleIds, onToggle, onMove, onReset }) => {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const visibleSet = new Set(visibleIds);

  return (
    <>
      <Tooltip title="Configure table columns" arrow>
        <IconButton size="small" onClick={(e) => setAnchorEl(e.currentTarget)}>
          <Settings size={18} />
        </IconButton>
      </Tooltip>
      <Popover
        open={Boolean(anchorEl)}
        anchorEl={anchorEl}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <Box sx={{ p: 2, minWidth: 260, maxHeight: 420, overflowY: 'auto' }}>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>Table Columns</Typography>
          {allColumns.map(col => {
            const isVisible = visibleSet.has(col.id);
            const visibleIdx = visibleIds.indexOf(col.id);
            return (
              <Box key={col.id} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <FormControlLabel
                  sx={{ flex: 1, mr: 0 }}
                  control={
                    <Checkbox
                      size="small"
                      checked={isVisible}
                      disabled={!col.removable}
                      onChange={() => onToggle(col.id)}
                    />
                  }
                  label={<Typography variant="body2">{col.label}</Typography>}
                />
                {isVisible && col.removable && (
                  <>
                    <IconButton size="small" disabled={visibleIdx <= 0} onClick={() => onMove(col.id, 'left')}>
                      <ChevronUp size={14} />
                    </IconButton>
                    <IconButton size="small" disabled={visibleIdx >= visibleIds.length - 1} onClick={() => onMove(col.id, 'right')}>
                      <ChevronDown size={14} />
                    </IconButton>
                  </>
                )}
              </Box>
            );
          })}
          <Button
            size="small"
            startIcon={<Undo size={14} />}
            onClick={onReset}
            sx={{ mt: 1, textTransform: 'none' }}
          >
            Reset to Defaults
          </Button>
        </Box>
      </Popover>
    </>
  );
};

export default TableColumnConfigPopover;
