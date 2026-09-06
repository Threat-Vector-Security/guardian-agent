import React, { useEffect, useCallback, useRef, useMemo } from 'react';
import { NodeResizer, NodeProps, Handle, Position, useReactFlow } from '@xyflow/react';
import { Box, Typography, IconButton, Tooltip } from '@mui/material';
import { Check, Edit } from 'lucide-react';
import { SecurityZoneNodeData } from '../types/SecurityTypes';
import { colors, getTheme } from '../styles/Theme';
import { useSettings } from '../settings/SettingsContext';
import { useManualAnalysis } from '../contexts/ManualAnalysisContext';
import { useDiagramLens } from '../contexts/DiagramLensContext';

// const ZONE_BACKGROUND_OPACITY = 0.001; // Keep your very low opacity value

const getHandleStyle = (color: string, selected: boolean, nodeBgColor: string) => ({
  width: 8,
  height: 8,
  background: nodeBgColor,
  border: `2px solid ${color}`,
  filter: selected ? 'brightness(110%)' : undefined,
  transform: 'translate(-50%, -50%)',
  zIndex: 1,
  opacity: 0,
  transition: 'opacity 0.2s ease'
});

// Convert hex to HSLA for better transparency handling
// const getHSLAColor = (hexColor: string, opacity: number) => {
//   // Convert hex to RGB
//   const r = parseInt(hexColor.slice(1, 3), 16) / 255;
//   const g = parseInt(hexColor.slice(3, 5), 16) / 255;
//   const b = parseInt(hexColor.slice(5, 7), 16) / 255;
//   
//   const max = Math.max(r, g, b);
//   const min = Math.min(r, g, b);
//   let h, s, l = (max + min) / 2;
// 
//   if (max === min) {
//     h = s = 0;
//   } else {
//     const d = max - min;
//     s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
//     switch (max) {
//       case r: h = (g - b) / d + (g < b ? 6 : 0); break;
//       case g: h = (b - r) / d + 2; break;
//       case b: h = (r - g) / d + 4; break;
//       default: h = 0;
//     }
//     h /= 6;
//   }
// 
//   return `hsla(${Math.round(h * 360)}, ${Math.round(s * 100)}%, ${Math.round(l * 100)}%, ${opacity})`;
// };

// Update NodeStyle interface
// interface NodeStyle extends Omit<CSSProperties, 'background'> {
//   width?: number | string;
//   height?: number | string;
//   background?: string;
//   opacity?: number;
//   zIndex?: number;
// }

// Update CustomNode interface
// interface CustomNode extends Omit<Node, 'style'> {
//   style?: NodeStyle;
// }

export type ZoneContainment = 'controlled' | 'uncontrolled' | 'neutral';

/**
 * Document-style presentation classification for a zone: controlled
 * environments tint blue, uncontrolled tint red, everything else renders as a
 * neutral gray band (matching practitioner DFD document conventions).
 */
export const classifyZoneContainment = (zoneType: string | undefined): ZoneContainment => {
  switch (zoneType) {
    case 'Internet':
    case 'External':
    case 'Guest':
    case 'ThirdParty':
    case 'Partner':
    case 'Quarantine':
    case 'RedTeam':
      return 'uncontrolled';
    case 'Internal':
    case 'Trusted':
    case 'Restricted':
    case 'Critical':
    case 'Management':
    case 'Production':
    case 'Database':
    case 'ControlPlane':
    case 'DataPlane':
    case 'ServiceMesh':
    case 'BackOffice':
    case 'Compliance':
    case 'Recovery':
    case 'BlueTeam':
      return 'controlled';
    default:
      return 'neutral';
  }
};

const DOCUMENT_ZONE_STROKES: Record<ZoneContainment, string> = {
  controlled: '#5B8DD9',
  uncontrolled: '#D96B6B',
  neutral: '#8A9099'
};

const SecurityZoneNode: React.FC<NodeProps> = ({
  data,
  selected,
  id
}) => {
  const nodeData = data as SecurityZoneNodeData;
  const { setNodes } = useReactFlow();
  const nodeRef = useRef<HTMLDivElement>(null);
  const { settings } = useSettings();
  const { hasFindingsForZone } = useManualAnalysis();
  const currentTheme = getTheme(settings.theme, settings.customTheme);
  const hasManualFinding = hasFindingsForZone(id);

  const getZoneColor = useCallback((zoneType: string | undefined) => {
    if (!zoneType || !(zoneType in colors.zoneColors)) {
      return colors.zoneColors.Trusted;
    }
    return colors.zoneColors[zoneType as keyof typeof colors.zoneColors];
  }, []);

  const getZoneBackground = useCallback((zoneType: string | undefined) => {
    if (!zoneType || !(zoneType in colors.zoneBackgrounds)) {
      return colors.zoneBackgrounds.Trusted;
    }
    return colors.zoneBackgrounds[zoneType as keyof typeof colors.zoneBackgrounds];
  }, []);

  const documentStyle = !!currentTheme.documentStyle;
  const { pathActive } = useDiagramLens();
  const containment: ZoneContainment =
    (nodeData as any).containment || classifyZoneContainment(nodeData.zoneType);

  const zoneColor = useMemo(() => {
    if (documentStyle) return DOCUMENT_ZONE_STROKES[containment];
    return getZoneColor(nodeData.zoneType);
  }, [documentStyle, containment, nodeData.zoneType, getZoneColor]);

  const zoneBackground = useMemo(() => {
    if (documentStyle) {
      const c = currentTheme.colors as any;
      if (containment === 'controlled') return c.envControlled;
      if (containment === 'uncontrolled') return c.envUncontrolled;
      return c.envNeutral;
    }
    return getZoneBackground(nodeData.zoneType);
  }, [documentStyle, containment, currentTheme.colors, nodeData.zoneType, getZoneBackground]);
  
  // Memoize styles to prevent recalculation during drag
  const wrapperStyle = useMemo(() => ({
    position: 'relative' as const,
    width: '100%',
    height: '100%',
    minWidth: '300px',
    minHeight: '200px',
    backgroundColor: zoneBackground,
    zIndex: selected ? 5 : -1,
    opacity: pathActive ? 0.4 : 1,
    contain: 'strict' as const,
    outline: selected ? `2px solid ${zoneColor}` : 'none',
    outlineOffset: '2px',
    pointerEvents: (selected ? 'auto' : 'none') as React.CSSProperties['pointerEvents'],
    cursor: selected ? 'move' : 'default',
    willChange: selected ? 'transform' : 'auto' as const,
    transform: 'translate3d(0, 0, 0)',
    backfaceVisibility: 'hidden' as const,
    perspective: 1000,
    boxSizing: 'border-box' as const
  }), [selected, zoneBackground, zoneColor, pathActive]);

  // Handle click on the select button
  const handleSelectClick = useCallback((event: React.MouseEvent) => {
    // Ensure the event doesn't propagate
    event.stopPropagation();
    event.preventDefault();
    
    // Toggle selection state of this zone node
    setNodes(nodes => 
      nodes.map(node => {
        if (node.id === id) {
          // Toggle the selected state
          const newSelected = !selected;
          // Preserve all existing node properties
          return {
            ...node,
            selected: newSelected,
            selectable: newSelected,
            draggable: newSelected,
            // Only update the zIndex in the style, preserve all other style properties
            style: {
              ...(node.style || {}),
              zIndex: newSelected ? 5 : -1
            }
          };
        }
        return node;
      })
    );
  }, [id, selected, setNodes]);


  const onResize = useCallback(() => {
    // Let ReactFlow handle the resize internally for smooth performance
    // Just use RAF to ensure smooth rendering without interfering
    requestAnimationFrame(() => {
      // Empty callback - let NodeResizer handle the sizing
    });
  }, []);

  useEffect(() => {
    // Find the ReactFlow node element
    const currentNode = nodeRef.current;
    const reactFlowNode = currentNode?.closest('.react-flow__node');
    
    if (reactFlowNode) {
      // Access the ReactFlow internal node data
      const nodeId = reactFlowNode.getAttribute('data-id');
      
      if (nodeId) {
        // If not selected, make the node non-interactive except for the select button
        if (!selected) {
          // Add a class that we can target with CSS
          reactFlowNode.classList.add('non-selectable-zone');
          
          // Make sure the select button is always interactive
          const selectButton = currentNode?.querySelector('.zone-select-button');
          if (selectButton) {
            (selectButton as HTMLElement).style.pointerEvents = 'auto';
            (selectButton as HTMLElement).style.zIndex = '1000';
            (selectButton as HTMLElement).style.cursor = 'pointer';
          }
        } else {
          // Restore interactivity when selected
          reactFlowNode.classList.remove('non-selectable-zone');
        }
      }
    }
    
    // Cleanup function
    return () => {
      const node = currentNode?.closest('.react-flow__node');
      if (node) {
        node.classList.remove('non-selectable-zone');
      }
    };
  }, [selected]);

  return (
    <div
      ref={nodeRef}
      style={wrapperStyle}
      className={`security-zone-wrapper noselect zone-container ${selected ? 'zone-selected' : 'zone-inactive'} ${hasManualFinding ? 'manual-analysis-zone-flag' : ''}`}
      onContextMenu={(e) => {
        e.stopPropagation();
      }}
    >
      <NodeResizer 
        minWidth={300}
        minHeight={200}
        isVisible={selected}
        lineStyle={{ 
          borderColor: zoneColor,
          borderWidth: 2,
        }}
        handleStyle={{ 
          borderColor: zoneColor,
          backgroundColor: zoneColor,
          width: 12,
          height: 12,
          borderRadius: '2px',
          border: `2px solid ${zoneColor}`,
        }}
        keepAspectRatio={false}
        handleClassName="nodrag zone-resize-handle"
        onResize={onResize}
        shouldResize={() => true}
      />

      <Box
        className="security-zone-content"
        sx={{
          contain: 'strict',
          border: documentStyle ? `1.5px dashed ${zoneColor}` : `2px solid ${zoneColor}`,
          borderRadius: '8px',
          padding: '20px',
          color: zoneColor,
          width: '100%',
          height: '100%',
          boxSizing: 'border-box',
          position: 'relative',
          '&:hover': {
            boxShadow: selected ? 'none' : `0 0 0 1px ${zoneColor}`,
          },
          pointerEvents: 'none',
          transition: selected ? 'none' : 'box-shadow 0.2s ease-in-out',
          userSelect: 'none',
          transform: 'translateZ(0)',
          backfaceVisibility: 'hidden'
        }}
      >
        <div className="zone-header" style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          padding: '2px 10px 0 2px',
          gap: '12px'
        }}>
          <div className="zone-info" style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
            marginLeft: '2px',
            flex: 1,
            minWidth: 0
          }}>
            <Typography variant="subtitle1" component="div" sx={{
              fontWeight: 'bold',
              color: zoneColor,
              fontSize: documentStyle ? '13px' : '18px',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              lineHeight: 1.3,
              wordBreak: 'break-word'
            }}>
              {nodeData.label || `${nodeData.zoneType} Zone`}
            </Typography>

            {nodeData.description && (
              <Typography
                sx={{
                  color: zoneColor,
                  fontSize: '13px',
                  opacity: 0.85,
                  pointerEvents: 'none',
                  lineHeight: 1.4,
                  wordBreak: 'break-word',
                  whiteSpace: 'pre-wrap'
                }}
              >
                {nodeData.description}
              </Typography>
            )}
          </div>
          
          <Tooltip title="Edit Security Zone" placement="top" arrow>
            <IconButton
              className="zone-select-button"
              onClick={handleSelectClick}
              size="medium"                       /* bigger clickable area */
              sx={{
                pointerEvents: 'auto',
                cursor: 'crosshair',               /* target-style cursor */
                p: 1.5,                            /* 12px padding */
                minWidth: 44,
                minHeight: 44,
                bgcolor: selected ? zoneColor : colors.background,
                color: selected ? colors.background : zoneColor,
                '&:hover': {
                  bgcolor: selected ? `${zoneColor}33` : colors.surface,
                  transform: 'scale(1.05)',
                },
              }}
            >
              {selected ? <Check size={18}/> : <Edit size={18}/>}
            </IconButton>
          </Tooltip>
        </div>

      </Box>

      <Handle 
        type="target" 
        position={Position.Top}
        id="top"
        className="zone-handle"
        isConnectable={false}
        style={{ 
          ...getHandleStyle(zoneColor, selected, currentTheme.colors.nodeBg),
          left: '50%',
          top: '8px',
        }}
      />
      <Handle 
        type="source" 
        position={Position.Right}
        id="right"
        className="zone-handle"
        isConnectable={false}
        style={{ 
          ...getHandleStyle(zoneColor, selected, currentTheme.colors.nodeBg),
          top: '50%',
          right: '-2px',
        }}
      />
      <Handle 
        type="target" 
        position={Position.Bottom}
        id="bottom"
        className="zone-handle"
        isConnectable={false}
        style={{ 
          ...getHandleStyle(zoneColor, selected, currentTheme.colors.nodeBg),
          left: '50%',
          bottom: '2px',
        }}
      />
      <Handle 
        type="source" 
        position={Position.Left}
        id="left"
        className="zone-handle"
        isConnectable={false}
        style={{ 
          ...getHandleStyle(zoneColor, selected, currentTheme.colors.nodeBg),
          top: '50%',
          left: '6px',
        }}
      />
    </div>
  );
};

// Custom comparison function for React.memo
// Only re-render if zone data, position, or size changes
const areEqual = (prevProps: NodeProps, nextProps: NodeProps) => {
  const prev = prevProps;
  const next = nextProps;
  const prevData = prev.data as SecurityZoneNodeData;
  const nextData = next.data as SecurityZoneNodeData;
  
  return (
    prev.id === next.id &&
    prev.selected === next.selected &&
    prevData.zoneType === nextData.zoneType &&
    prevData.label === nextData.label &&
    prevData.description === nextData.description
  );
};

export default React.memo(SecurityZoneNode, areEqual);
