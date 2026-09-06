// MemoizedSecurityNode.tsx - Optimized security node with proper memoization
import React, { memo, useMemo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { useTheme } from '@mui/material/styles';
import { SecurityNodeData, SecurityNodeType } from '../types/SecurityTypes';
import { useSettings } from '../settings/SettingsContext';

interface SecurityNodeProps {
  id: string;
  data: SecurityNodeData;
  selected: boolean;
  type: SecurityNodeType;
  color: string;
}

// Memoized icon component to prevent re-renders
const MemoizedIcon = memo(({ 
  IconComponent, 
  style 
}: { 
  IconComponent: React.ElementType; 
  style: React.CSSProperties;
}) => (
  <IconComponent style={style} />
));

// Memoized node style calculator
const useNodeStyles = (
  color: string, 
  selected: boolean, 
  backgroundColor: string, 
  textColor: string
) => {
  return useMemo(() => ({
    node: {
      background: selected 
        ? `linear-gradient(135deg, ${color}15, ${backgroundColor})`
        : backgroundColor,
      border: selected 
        ? `2px solid ${color}`
        : `1px solid ${color}40`,
      borderRadius: '8px',
      padding: '8px',
      minWidth: '80px',
      minHeight: '60px',
      display: 'flex',
      flexDirection: 'column' as const,
      alignItems: 'center',
      justifyContent: 'center',
      boxShadow: selected
        ? `0 0 20px ${color}30`
        : '0 2px 8px rgba(0,0,0,0.1)',
      transition: 'none', // Remove transitions for better performance
    },
    icon: {
      fontSize: 24,
      color: color,
      marginBottom: 4,
    },
    label: {
      fontSize: '11px',
      color: textColor,
      textAlign: 'center' as const,
      fontWeight: 500,
      wordBreak: 'break-word' as const,
    },
    code: {
      fontSize: '9px',
      color: `${textColor}80`,
      marginTop: 2,
      fontFamily: 'monospace',
    }
  }), [color, selected, backgroundColor, textColor]);
};

// Memoized handle style
const useHandleStyles = (zoneColor: string, selected: boolean) => {
  return useMemo(() => ({
    width: '8px',
    height: '8px',
    background: selected ? zoneColor : `${zoneColor}80`,
    border: `1px solid ${zoneColor}`,
    borderRadius: '50%',
    transition: 'none', // Remove transitions
  }), [zoneColor, selected]);
};

// Main optimized security node component
const OptimizedSecurityNode: React.FC<SecurityNodeProps> = memo(({
  id: nodeId,
  data,
  selected,
  type,
  color
}) => {
  const theme = useTheme();
  const { settings } = useSettings();

  // Memoize expensive calculations
  const computedData = useMemo(() => {
    const nodeColor = settings.themeAwareNodeColors ? theme.palette.primary.main : color;
    const backgroundColor = theme.palette.background.paper;
    const textColor = theme.palette.text.primary;
    const zoneColor = data.zone ? `#${data.zone}` : nodeColor;
    
    // Generate node code (expensive operation)
    let nodeIndex = 1;
    const nodeIdMatch = nodeId.match(/\d+$/);
    if (nodeIdMatch) {
      nodeIndex = parseInt(nodeIdMatch[0], 10);
    }
    const code = `${type.toUpperCase().substring(0, 3)}-${String(nodeIndex).padStart(2, '0')}${data.zone ? `-${data.zone.toUpperCase()}` : ''}`;

    return {
      nodeColor,
      backgroundColor,
      textColor,
      zoneColor,
      code,
      IconComponent: data.icon || null
    };
  }, [nodeId, type, data.zone, data.icon, color, selected, theme, settings]);

  const nodeStyles = useNodeStyles(
    computedData.nodeColor,
    selected,
    computedData.backgroundColor,
    computedData.textColor
  );

  const handleStyles = useHandleStyles(computedData.zoneColor, selected);

  // Memoize the entire render to prevent unnecessary re-renders
  return useMemo(() => (
    <div style={nodeStyles.node}>
      <Handle
        type="target"
        position={Position.Top}
        style={{ ...handleStyles, top: -4 }}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        style={{ ...handleStyles, bottom: -4 }}
      />
      <Handle
        type="target"
        position={Position.Left}
        style={{ ...handleStyles, left: -4 }}
      />
      <Handle
        type="source"
        position={Position.Right}
        style={{ ...handleStyles, right: -4 }}
      />

      {computedData.IconComponent && (
        <MemoizedIcon 
          IconComponent={computedData.IconComponent}
          style={nodeStyles.icon}
        />
      )}
      
      <div style={nodeStyles.label}>
        {data.label || type}
      </div>
      
      <div style={nodeStyles.code}>
        {computedData.code}
      </div>
    </div>
  ), [nodeStyles, handleStyles, computedData, data.label, type]);
}, (prevProps, nextProps) => {
  // Custom comparison function to prevent unnecessary re-renders
  return (
    prevProps.id === nextProps.id &&
    prevProps.selected === nextProps.selected &&
    prevProps.color === nextProps.color &&
    prevProps.type === nextProps.type &&
    prevProps.data.label === nextProps.data.label &&
    prevProps.data.zone === nextProps.data.zone &&
    prevProps.data.icon === nextProps.data.icon
  );
});

OptimizedSecurityNode.displayName = 'OptimizedSecurityNode';

export default OptimizedSecurityNode;