import React, { useMemo } from 'react';
import { Autocomplete, TextField, Typography } from '@mui/material';
import { SecurityNode, SecurityEdge } from '../types/SecurityTypes';

interface NodeFinderProps {
  nodes: SecurityNode[];
  edges: SecurityEdge[];
}

interface SearchOption {
  id: string;
  type: 'node' | 'edge';
  primary: string; // main label or id
  secondary?: string; // index code
}

const NodeFinder: React.FC<NodeFinderProps> = ({ nodes, edges }) => {
  // Build search options combining nodes and edges
  const options: SearchOption[] = useMemo(() => {
    const nodeOptions: SearchOption[] = nodes.map((n) => {
      const primary = (n.data as any)?.label || n.id;
      const secondary = (n.data as any)?.indexCode as string | undefined;
      return { id: n.id, type: 'node', primary, secondary };
    });

    const edgeOptions: SearchOption[] = edges.map((e) => {
      const primary = (e.data as any)?.label || e.id;
      const secondary = (e.data as any)?.indexCode as string | undefined;
      return { id: e.id, type: 'edge', primary, secondary };
    });

    return [...nodeOptions, ...edgeOptions];
  }, [nodes, edges]);

  const handleSelect = (_: any, value: SearchOption | null) => {
    if (!value) return;
    // Dispatch a custom event so DiagramEditor can respond
    const event = new CustomEvent('center-on-element', {
      detail: {
        elementType: value.type,
        id: value.id,
      },
    });
    window.dispatchEvent(event);
  };

  const getOptionLabel = (opt: SearchOption) => {
    return opt.secondary ? `${opt.primary} (${opt.secondary})` : opt.primary;
  };

  return (
    <Autocomplete
      size="small"
      options={options}
      getOptionLabel={getOptionLabel}
      onChange={handleSelect}
      renderOption={(props, option) => (
        <li {...props} key={`${option.type}-${option.id}`} style={{ display: 'flex', flexDirection: 'column' }}>
          <Typography variant="body2">{option.primary}</Typography>
          {option.secondary && (
            <Typography variant="caption" color="text.secondary">
              {option.secondary}
            </Typography>
          )}
        </li>
      )}
      renderInput={(params) => <TextField {...params} placeholder="Search by name or code" />}
      filterOptions={(opts, state) => {
        const input = state.inputValue.toLowerCase();
        return opts.filter(
          (o) =>
            o.primary.toLowerCase().includes(input) ||
            (o.secondary && o.secondary.toLowerCase().includes(input))
        );
      }}
      isOptionEqualToValue={(opt, val) => opt.id === val.id && opt.type === val.type}
    />
  );
};

export default NodeFinder; 