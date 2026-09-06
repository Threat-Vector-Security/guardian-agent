import React from 'react';
import { useTheme } from '@mui/material/styles';

interface TooltipPayloadEntry {
  name?: string;
  value?: number | string;
  color?: string;
  dataKey?: string;
  payload?: Record<string, unknown>;
}

interface GrcChartTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadEntry[];
  label?: string | number;
}

const GrcChartTooltip: React.FC<GrcChartTooltipProps> = ({ active, payload, label }) => {
  const theme = useTheme();
  if (!active || !payload || payload.length === 0) return null;

  const isDark = theme.palette.mode === 'dark';
  const bg = isDark ? '#1e1e2e' : '#ffffff';
  const border = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)';
  const labelColor = isDark ? '#e0e0e0' : '#1a1a1a';
  const valueColor = isDark ? '#ffffff' : '#111111';
  const secondaryColor = isDark ? '#a0a0b0' : '#555555';

  const isPie = !label && payload.length === 1 && payload[0].payload?.name;
  const displayLabel = isPie ? String(payload[0].payload!.name) : label;

  return (
    <div style={{
      background: bg,
      border: `1px solid ${border}`,
      borderRadius: 8,
      padding: '8px 12px',
      boxShadow: isDark
        ? '0 4px 16px rgba(0,0,0,0.5)'
        : '0 4px 16px rgba(0,0,0,0.12)',
      minWidth: 120,
      maxWidth: 240,
    }}>
      {displayLabel !== undefined && displayLabel !== null && (
        <div style={{
          fontSize: 12,
          fontWeight: 600,
          color: labelColor,
          marginBottom: payload.length > 1 ? 6 : 4,
          borderBottom: payload.length > 1 ? `1px solid ${border}` : 'none',
          paddingBottom: payload.length > 1 ? 6 : 0,
          lineHeight: 1.3,
        }}>
          {displayLabel}
        </div>
      )}
      {payload.map((entry, i) => {
        const name = entry.name || entry.dataKey || '';
        const val = typeof entry.value === 'number' ? entry.value.toLocaleString() : entry.value;
        const showName = payload.length > 1 || (name && name !== 'value');
        return (
          <div key={i} style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '2px 0',
          }}>
            <span style={{
              width: 10,
              height: 10,
              borderRadius: 3,
              backgroundColor: entry.color || '#6366f1',
              flexShrink: 0,
            }} />
            <span style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flex: 1,
              gap: 12,
            }}>
              {showName && (
                <span style={{ fontSize: 12, color: secondaryColor, lineHeight: 1.3 }}>
                  {name}
                </span>
              )}
              <span style={{
                fontSize: 13,
                fontWeight: 600,
                color: valueColor,
                marginLeft: showName ? 'auto' : 0,
                lineHeight: 1.3,
              }}>
                {val}
              </span>
            </span>
          </div>
        );
      })}
    </div>
  );
};

export default GrcChartTooltip;
