import React, { memo, useCallback, useMemo } from 'react';
import { Handle, Position, NodeProps, useStore } from '@xyflow/react';
import { Badge, Tooltip, IconButton } from '@mui/material';
import { styled, alpha } from '@mui/material/styles';
import EditIcon from '@mui/icons-material/Edit';
import { Cable } from '@mui/icons-material';
import { materialIconMappings } from '../../utils/materialIconMappings';
import { deserializeIcon } from '../../utils/iconSerialization';
import { useSettings } from '../../settings/SettingsContext';
import { getTheme, colors } from '../../styles/Theme';
import { SecurityNodeType } from '../../types/SecurityTypes';
import { nodeTypeConfig } from '../SecurityNodes';
import { isVendorIconComponent } from '../../utils/vendorIconMappings';
import { useManualAnalysis } from '../../contexts/ManualAnalysisContext';
import DfdDocumentNode from './DfdDocumentNode';

const IconWrapper = styled('div')<{
  selected?: boolean;
  typecolor: string;
  zonecolor?: string;
  isvendor?: boolean;
  iconcolor?: string;
}>(({ theme, selected, typecolor, zonecolor, isvendor, iconcolor }) => ({
  width: 50,
  height: 50,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'move',
  borderRadius: theme.shape.borderRadius,
  backgroundColor: selected
    ? alpha(zonecolor || typecolor, 0.16)
    : isvendor
      ? theme.palette.background.paper
      : alpha(typecolor, 0.12),
  border: `2px solid ${selected ? (zonecolor || typecolor) : typecolor}`,
  // Set the color that will be inherited by currentColor
  color: iconcolor || (selected ? (zonecolor || typecolor) : typecolor),
  boxShadow: selected ? `0 0 12px ${(zonecolor || typecolor)}40` : theme.shadows[1],
  position: 'relative',
  transition: theme.transitions.create(['border-color', 'box-shadow', 'transform'], {
    duration: theme.transitions.duration.shorter,
  }),
  '&:hover': {
    transform: 'scale(1.05)',
    boxShadow: theme.shadows[3],
  },
  // Force color on all children
  '& *': {
    color: 'inherit !important',
    fill: 'currentColor !important',
  },
}));

const NodeTextContainer = styled('div')({
  position: 'absolute',
  top: 56,
  left: '50%',
  transform: 'translateX(-50%)',
  width: '140px',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '4px',
});

const NodeLabel = styled('div')(({ theme }) => ({
  fontSize: '11px',
  textAlign: 'center',
  color: theme.palette.common.white,
  width: '100%',
  lineHeight: 1.2,
  whiteSpace: 'normal',
  wordBreak: 'break-word',
}));

const NodeCode = styled('div')(({ theme }) => ({
  fontSize: '10px',
  textAlign: 'center',
  color: theme.palette.common.white,
  opacity: 0.7,
  width: '12ch',
  whiteSpace: 'nowrap',
}));

const StyledBadge = styled(Badge)(({ theme }) => ({
  position: 'absolute',
  top: -8,
  right: -8,
  '& .MuiBadge-badge': {
    fontSize: '10px',
    minWidth: '18px',
    height: '18px',
    padding: '0 4px',
  },
}));

const EditButton = styled(IconButton)(({ theme }) => ({
  position: 'absolute',
  top: -4,
  left: -4,
  width: 20,
  height: 20,
  padding: 0,
  backgroundColor: theme.palette.background.paper,
  border: `1px solid ${theme.palette.divider}`,
  '& svg': {
    fontSize: 14,
  },
  '&:hover': {
    backgroundColor: theme.palette.action.hover,
  },
}));

const NodeContainer = styled('div')({
  width: 50,
  height: 50,
  position: 'relative',
  overflow: 'visible',
});


const getHandleStyle = (color: string, selected: boolean) => {
  return {
    width: '14px',
    height: '14px',
    backgroundColor: 'transparent',
    border: 'none',
    borderRadius: '50%',
    cursor: 'crosshair',
    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
    zIndex: 10,
    transform: 'translate(-50%, -50%)',
    pointerEvents: 'auto' as const,
  };
};

function IconOnlyNode({ data, selected, id, type }: NodeProps) {
  const { settings } = useSettings();
  const { hasFindingsForNode } = useManualAnalysis();
  const currentTheme = getTheme(settings.theme, settings.customTheme);
  const hasManualFinding = hasFindingsForNode(id);
  const [isHovering, setIsHovering] = React.useState(false);

  const connectionKey = useStore(
    useCallback((state: any) => {
      let top = false, right = false, bottom = false, left = false;
      for (const edge of state.edges) {
        if (edge.source === id) {
          if (edge.sourceHandle === 'top') top = true;
          else if (edge.sourceHandle === 'right') right = true;
          else if (edge.sourceHandle === 'bottom') bottom = true;
          else if (edge.sourceHandle === 'left') left = true;
        }
        if (edge.target === id) {
          if (edge.targetHandle === 'top') top = true;
          else if (edge.targetHandle === 'right') right = true;
          else if (edge.targetHandle === 'bottom') bottom = true;
          else if (edge.targetHandle === 'left') left = true;
        }
      }
      return (top ? 1 : 0) | (right ? 2 : 0) | (bottom ? 4 : 0) | (left ? 8 : 0);
    }, [id])
  );

  const hasTopConnection = (connectionKey & 1) !== 0;
  const hasRightConnection = (connectionKey & 2) !== 0;
  const hasBottomConnection = (connectionKey & 4) !== 0;
  const hasLeftConnection = (connectionKey & 8) !== 0;

  const handleEditClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    // Edit functionality will be handled by node selection in the main editor
  }, []);

  // Type guard for data
  const nodeData = data as {
    type?: string;
    label?: string;
    name?: string;
    code?: string | number;
    indexCode?: string | number;
    icon?: any;
    zone?: string;
  };

  const nodeType = (type || nodeData.type || 'generic') as SecurityNodeType;

  const nodeConfig = nodeTypeConfig[nodeType] || nodeTypeConfig.generic;

  // Get type color using the same method as SecurityNodes
  const typeColor = nodeConfig?.color ? colors[nodeConfig.color] as string : currentTheme.colors.primary || '#1976D2';

  // Determine which icon to use: custom icon from data, or default from nodeTypeConfig
  let iconToRender = nodeData.icon;

  // If no custom icon, use the default from materialIconMappings
  if (!iconToRender) {
    const iconMapping = materialIconMappings[nodeType] || materialIconMappings.server;
    iconToRender = iconMapping?.icon;
  }

  // If iconToRender is a React component (function or memoized component), use it directly
  let Icon;
  if (typeof iconToRender === 'function' ||
      (typeof iconToRender === 'object' && iconToRender !== null && iconToRender.$$typeof)) {
    Icon = iconToRender;
  } else {
    // If iconToRender is something else (serialized), deserialize it
    Icon = deserializeIcon(iconToRender, nodeType);
  }

  const isVendorIcon = isVendorIconComponent(Icon);

  // Get zone color for handles and selected state
  // Use colors directly like SecurityNodes does
  const zoneColor = nodeData.zone && colors.zoneColors && colors.zoneColors[nodeData.zone as keyof typeof colors.zoneColors]
    ? colors.zoneColors[nodeData.zone as keyof typeof colors.zoneColors]
    : typeColor;

  // Icon color: use zone color when selected, otherwise use type color
  const iconColor = isVendorIcon ? undefined : (selected ? zoneColor : typeColor);

  // Get handle style
  const handleStyle = getHandleStyle(zoneColor, selected || false);

  // Show handles only when hovering or selected
  const showHandles = isHovering || selected;

  // Document theme overrides icon display mode: the printable DFD notation is
  // the point of that theme. (Placed after all hooks for stable hook order.)
  if (currentTheme.documentStyle) {
    return (
      <DfdDocumentNode
        nodeId={id}
        data={data}
        selected={selected}
        type={nodeType}
        theme={currentTheme}
        isDrawingEditMode={(data as any).isDrawingEditMode || false}
      />
    );
  }

  return (
    <NodeContainer
      className={hasManualFinding ? 'manual-analysis-flag' : undefined}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      <Handle
        type="target"
        position={Position.Top}
        id="top"
        className="modern-handle"
        style={{...handleStyle, left: '50%', top: -7}}
      />
      <Handle
        type="source"
        position={Position.Top}
        id="top"
        className="modern-handle"
        style={{...handleStyle, left: '50%', top: -7}}
      >
        {/* Cable icon overlay */}
        <Cable
          sx={{
            fontSize: '10px',
            color: '#ffffff',
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            pointerEvents: 'none'
          }}
        />
      </Handle>

      <Tooltip title={`${nodeData.label || nodeData.name} (${nodeType})`} placement="top">
        <IconWrapper
          selected={selected}
          typecolor={typeColor}
          zonecolor={zoneColor}
          isvendor={isVendorIcon}
          iconcolor={iconColor}
        >
          {Icon && (
            <div style={{
              color: iconColor || typeColor,
              fill: iconColor || typeColor,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              {isVendorIcon
                ? React.createElement(Icon as React.ElementType, {
                    sx: { fontSize: 28 },
                    style: {
                      width: 28,
                      height: 28,
                      display: 'block'
                    }
                  })
                : React.createElement(Icon as React.ElementType, {
                    sx: {
                      fontSize: 28,
                      color: 'currentColor'
                    }
                  })}
            </div>
          )}
        </IconWrapper>
      </Tooltip>

      <NodeTextContainer>
        <NodeLabel>{nodeData.label || nodeData.name || ''}</NodeLabel>
        {nodeData.indexCode && <NodeCode>{nodeData.indexCode}</NodeCode>}
      </NodeTextContainer>

      <Handle
        type="target"
        position={Position.Right}
        id="right"
        className="modern-handle"
        style={{...handleStyle, top: '50%', right: -7}}
      />
      <Handle
        type="source"
        position={Position.Right}
        id="right"
        className="modern-handle"
        style={{...handleStyle, top: '50%', right: -7}}
      >
        {/* Cable icon overlay */}
        <Cable
          sx={{
            fontSize: '10px',
            color: '#ffffff',
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%) rotate(90deg)',
            pointerEvents: 'none'
          }}
        />
      </Handle>

      <Handle
        type="target"
        position={Position.Bottom}
        id="bottom"
        className="modern-handle"
        style={{...handleStyle, left: '50%', bottom: -7}}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="bottom"
        className="modern-handle"
        style={{...handleStyle, left: '50%', bottom: -7}}
      >
        {/* Cable icon overlay */}
        <Cable
          sx={{
            fontSize: '10px',
            color: '#ffffff',
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            pointerEvents: 'none'
          }}
        />
      </Handle>

      <Handle
        type="target"
        position={Position.Left}
        id="left"
        className="modern-handle"
        style={{...handleStyle, top: '50%', left: -7}}
      />
      <Handle
        type="source"
        position={Position.Left}
        id="left"
        className="modern-handle"
        style={{...handleStyle, top: '50%', left: -7}}
      >
        {/* Cable icon overlay */}
        <Cable
          sx={{
            fontSize: '10px',
            color: '#ffffff',
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%) rotate(90deg)',
            pointerEvents: 'none'
          }}
        />
      </Handle>
    </NodeContainer>
  );
}

export default memo(IconOnlyNode);
