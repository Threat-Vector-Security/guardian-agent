import React, { memo, useCallback, useMemo, useState } from 'react';
import { EdgeProps, useReactFlow, useStore } from '@xyflow/react';
import { SecurityEdgeData, SecurityZone } from '../../types/SecurityTypes';
import { colors, componentStyles, effects } from '../../styles/Theme';
import { controlPointEvents } from '../../utils/controlPointEvents';
import { getEdgeParams, getNodeIntersectionWithControlPoints } from './floatingEdgeUtils';
import { useSettings } from '../../settings/SettingsContext';

const getZoneColor = (zone?: SecurityZone) => {
  if (!zone || !(zone in colors.zoneColors)) {
    return colors.textSecondary;
  }
  return colors.zoneColors[zone as keyof typeof colors.zoneColors];
};

const getLabelDimensions = (label?: string, code?: string) => {
  const primaryFontSize = (parseInt(componentStyles.securityEdge.label.fontSize as string) || 12) * 0.65;
  const secondaryFontSize = 8;
  
  const longest = Math.max(label?.length || 0, code?.length || 0);
  const labelWidth = longest * 5 + 16;

  const gap = 2;
  const textHeight = primaryFontSize + secondaryFontSize + gap;
  const verticalPadding = 12;
  const labelHeight = textHeight + verticalPadding;
  
  return { labelWidth, labelHeight };
};


// Control point component
const ControlPoint: React.FC<{
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
  controlX: number;
  controlY: number;
  onUpdate: (x: number, y: number) => void;
  color: string;
  onReset?: () => void;
}> = ({ sourceX, sourceY, targetX, targetY, controlX, controlY, onUpdate, color, onReset }) => {
  const { screenToFlowPosition } = useReactFlow();
  const [dragging, setDragging] = useState(false);
  const [hover, setHover] = useState(false);
  const domNode = useStore((state) => state.domNode);

  React.useEffect(() => {
    if (!dragging || !domNode) return;

    const handlePointerMove = (e: PointerEvent) => {
      const position = screenToFlowPosition({ x: e.clientX, y: e.clientY });
      onUpdate(position.x, position.y);
    };

    const handlePointerUp = () => {
      setDragging(false);
      controlPointEvents.emitDragEnd();
    };

    domNode.addEventListener('pointermove', handlePointerMove);
    domNode.addEventListener('pointerup', handlePointerUp, { once: true });

    return () => {
      domNode.removeEventListener('pointermove', handlePointerMove);
      domNode.removeEventListener('pointerup', handlePointerUp);
    };
  }, [dragging, domNode, onUpdate, screenToFlowPosition, sourceX, sourceY, targetX, targetY]);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (onReset) {
      onReset();
    }
  }, [onReset]);

  return (
    <g 
      transform={`translate(${controlX}, ${controlY})`} 
      style={{ zIndex: 1000, pointerEvents: 'all' }}
      onMouseEnter={(e) => e.stopPropagation()}
      onMouseLeave={(e) => e.stopPropagation()}
      onMouseMove={(e) => e.stopPropagation()}
      onPointerEnter={(e) => e.stopPropagation()}
      onPointerLeave={(e) => e.stopPropagation()}
      onPointerMove={(e) => e.stopPropagation()}
    >
      {/* Connection line to show quadratic curve relationship */}
      {hover && (
        <>
          <line
            x1={sourceX - controlX}
            y1={sourceY - controlY}
            x2={0}
            y2={0}
            stroke={color}
            strokeWidth={1}
            strokeOpacity={0.2}
            strokeDasharray="2 2"
            style={{ pointerEvents: 'none' }}
          />
          <line
            x1={0}
            y1={0}
            x2={targetX - controlX}
            y2={targetY - controlY}
            stroke={color}
            strokeWidth={1}
            strokeOpacity={0.2}
            strokeDasharray="2 2"
            style={{ pointerEvents: 'none' }}
          />
        </>
      )}
      
      {/* Large hit area - 25px radius = 50px diameter total clickable area */}
      <circle
        r={25}
        fill="transparent"
        style={{ 
          cursor: dragging ? 'grabbing' : 'grab',
          pointerEvents: 'all'
        }}
        onPointerDown={(e) => {
          e.stopPropagation();
          setDragging(true);
          controlPointEvents.emitDragStart();
          controlPointEvents.emitClick();
        }}
        onPointerEnter={(e) => {
          e.stopPropagation();
          setHover(true);
        }}
        onPointerLeave={(e) => {
          e.stopPropagation();
          setHover(false);
        }}
        onPointerMove={(e) => {
          e.stopPropagation();
        }}
        onClick={(e) => {
          e.stopPropagation();
        }}
        onMouseDown={(e) => {
          e.stopPropagation();
        }}
        onMouseEnter={(e) => {
          e.stopPropagation();
        }}
        onMouseLeave={(e) => {
          e.stopPropagation();
        }}
        onMouseMove={(e) => {
          e.stopPropagation();
        }}
        onContextMenu={handleContextMenu}
      />
      
      {/* Visual feedback - shows the full interactive area */}
      {(hover || dragging) && (
        <>
          {/* Outer ring showing full hit area */}
          <circle
            r={25}
            fill={`${color}08`}
            stroke={color}
            strokeWidth={1}
            strokeOpacity={0.2}
            strokeDasharray="2 2"
            style={{ pointerEvents: 'none' }}
          />
          {/* Inner highlight */}
          <circle
            r={10}
            fill={`${color}20`}
            stroke={color}
            strokeWidth={1}
            strokeOpacity={0.5}
            style={{ pointerEvents: 'none' }}
          />
        </>
      )}
      
      {/* Control point with double circle for better visibility */}
      <circle
        r={6}
        fill="white"
        stroke={color}
        strokeWidth={2}
        style={{ 
          pointerEvents: 'none',
          filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.1))'
        }}
      />
      <circle
        r={3}
        fill={color}
        style={{ pointerEvents: 'none' }}
      />
      
      {/* Tooltip on hover */}
      {hover && !dragging && (
        <text
          x={15}
          y={-15}
          fill={color}
          fontSize={10}
          fontFamily="inherit"
          style={{ pointerEvents: 'none', userSelect: 'none' }}
        >
          Drag to curve • Right-click to reset
        </text>
      )}
      
      {/* Debug: Show exclusion zone (uncomment to visualize) */}
      {/* <circle
        r={25}
        fill="red"
        fillOpacity={0.1}
        stroke="red"
        strokeWidth={1}
        strokeOpacity={0.3}
        style={{ pointerEvents: 'none' }}
      /> */}
    </g>
  );
};

export const QuadraticEdge = memo(({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  selected,
  style = {},
  source,
  target,
  sourceHandleId,
  targetHandleId,
}: EdgeProps) => {
  const { setEdges, getNode } = useReactFlow();
  const { settings } = useSettings();
  const [isHovered, setIsHovered] = useState(false);
  const edgeData = data as SecurityEdgeData;
  
  // Check if should show control point - only when edge is directly selected and not during multi-select
  const shouldShowControlPoint = useStore((store) => {
    if (!selected) return false;
    
    // Count selected nodes
    let selectedNodeCount = 0;
    store.nodeLookup.forEach((node) => {
      if (node.selected) selectedNodeCount++;
    });
    
    // Hide control points if multiple nodes are selected
    return selectedNodeCount <= 1;
  });

  // Get all edges from React Flow store to calculate offset
  const edges = useStore((store) => store.edges);
  
  // Configuration for edge spreading
  const EDGE_SPACING = 25; // pixels between parallel edges
  const MAX_OFFSET = 50; // maximum offset from center
  
  // Calculate edge offset for parallel edges
  const edgeOffset = useMemo(() => {
    // Find all edges between the same nodes (regardless of direction)
    const parallelEdges = edges.filter(edge => 
      (edge.source === source && edge.target === target && 
       edge.sourceHandle === sourceHandleId && edge.targetHandle === targetHandleId) ||
      (edge.source === target && edge.target === source && 
       edge.sourceHandle === targetHandleId && edge.targetHandle === sourceHandleId)
    );
    
    // If single edge, no offset needed
    if (parallelEdges.length <= 1) return 0;
    
    // Sort edges by ID for consistent ordering
    const sortedEdges = [...parallelEdges].sort((a, b) => a.id.localeCompare(b.id));
    const edgeIndex = sortedEdges.findIndex(e => e.id === id);
    
    // Calculate offset to center edges around 0
    const totalCount = sortedEdges.length;
    const centerIndex = (totalCount - 1) / 2;
    const spacing = Math.min(EDGE_SPACING, MAX_OFFSET / Math.max(totalCount - 1, 1));
    
    return (edgeIndex - centerIndex) * spacing;
  }, [id, edges, source, target, sourceHandleId, targetHandleId]);

  // Get nodes for floating edge calculations
  const sourceNode = getNode(source);
  const targetNode = getNode(target);

  // Calculate floating edge positions with offset
  const { offsetSourceX, offsetSourceY, offsetTargetX, offsetTargetY } = useMemo(() => {
    // Check if we're in fixed mode or if nodes aren't available
    if (settings.edgeMode === 'fixed' || !sourceNode || !targetNode) {
      // Fallback to provided positions with offset
      if (edgeOffset === 0) {
        return { offsetSourceX: sourceX, offsetSourceY: sourceY, offsetTargetX: targetX, offsetTargetY: targetY };
      }
      
      const dx = targetX - sourceX;
      const dy = targetY - sourceY;
      const length = Math.sqrt(dx * dx + dy * dy) || 1;
      const perpX = -dy / length;
      const perpY = dx / length;
      
      return {
        offsetSourceX: sourceX + perpX * edgeOffset,
        offsetSourceY: sourceY + perpY * edgeOffset,
        offsetTargetX: targetX + perpX * edgeOffset,
        offsetTargetY: targetY + perpY * edgeOffset
      };
    }
    
    // Calculate control point positions for intersection calculation
    const controlPointPositions = edgeData?.controlPoints?.map(cp => ({ x: cp.x, y: cp.y })) || [];
    
    // Get intersection points with control points considered
    const sourceIntersection = getNodeIntersectionWithControlPoints(
      sourceNode,
      targetNode,
      controlPointPositions
    );
    
    const targetIntersection = getNodeIntersectionWithControlPoints(
      targetNode,
      sourceNode,
      controlPointPositions.slice().reverse() // Reverse for target perspective
    );
    
    // Apply offset to intersection points
    if (edgeOffset === 0) {
      return {
        offsetSourceX: sourceIntersection.x,
        offsetSourceY: sourceIntersection.y,
        offsetTargetX: targetIntersection.x,
        offsetTargetY: targetIntersection.y
      };
    }
    
    const dx = targetIntersection.x - sourceIntersection.x;
    const dy = targetIntersection.y - sourceIntersection.y;
    const length = Math.sqrt(dx * dx + dy * dy) || 1;
    const perpX = -dy / length;
    const perpY = dx / length;
    
    return {
      offsetSourceX: sourceIntersection.x + perpX * edgeOffset,
      offsetSourceY: sourceIntersection.y + perpY * edgeOffset,
      offsetTargetX: targetIntersection.x + perpX * edgeOffset,
      offsetTargetY: targetIntersection.y + perpY * edgeOffset
    };
  }, [sourceNode, targetNode, sourceX, sourceY, targetX, targetY, edgeOffset, edgeData?.controlPoints, source, target, settings.edgeMode]);

  // Control points state - two points, one on each side of the label
  const controlPoints = useMemo(() => {
    if (edgeData?.controlPoints && edgeData.controlPoints.length >= 2) {
      return edgeData.controlPoints;
    }
    
    // Calculate positions between source/label and label/target with offset
    const labelX = (offsetSourceX + offsetTargetX) / 2;
    const labelY = (offsetSourceY + offsetTargetY) / 2;
    
    // Calculate perpendicular offset for a slight curve
    const dx = offsetTargetX - offsetSourceX;
    const dy = offsetTargetY - offsetSourceY;
    const length = Math.sqrt(dx * dx + dy * dy);
    
    // Perpendicular vector (rotate 90 degrees)
    const perpX = -dy / length;
    const perpY = dx / length;
    
    // Add curve based on edge offset - more offset = more curve
    const baseCurve = 20;
    const curveOffset = baseCurve + Math.abs(edgeOffset) * 0.5;
    const curveDirection = edgeOffset >= 0 ? 1 : -1;
    
    // Point 1: Between source and label with curve
    const cp1X = (offsetSourceX + labelX) / 2 + (perpX * curveOffset * curveDirection);
    const cp1Y = (offsetSourceY + labelY) / 2 + (perpY * curveOffset * curveDirection);
    
    // Point 2: Between label and target with curve
    const cp2X = (labelX + offsetTargetX) / 2 + (perpX * curveOffset * curveDirection);
    const cp2Y = (labelY + offsetTargetY) / 2 + (perpY * curveOffset * curveDirection);
    
    return [
      { x: cp1X, y: cp1Y, id: 'cp1', active: false },
      { x: cp2X, y: cp2Y, id: 'cp2', active: false }
    ];
  }, [edgeData?.controlPoints, offsetSourceX, offsetSourceY, offsetTargetX, offsetTargetY, edgeOffset]);

  // Update control point by index
  const updateControlPoint = useCallback((index: number, x: number, y: number) => {
    setEdges((edges) =>
      edges.map((edge) => {
        if (edge.id !== id) return edge;
        
        const currentData = edge.data as SecurityEdgeData;
        const currentPoints = currentData?.controlPoints || controlPoints;
        const updatedPoints = [...currentPoints];
        
        if (updatedPoints[index]) {
          updatedPoints[index] = {
            ...updatedPoints[index],
            x,
            y,
            active: true
          };
        }
        
        return {
          ...edge,
          data: {
            ...currentData,
            controlPoints: updatedPoints
          }
        };
      })
    );
  }, [id, setEdges, controlPoints]);

  // Reset control point
  const resetControlPoint = useCallback(() => {
    setEdges((edges) =>
      edges.map((edge) => {
        if (edge.id !== id) return edge;
        
        const currentData = edge.data as SecurityEdgeData;
        const { controlPoints, ...rest } = currentData;
        return {
          ...edge,
          data: rest
        };
      })
    );
  }, [id, setEdges]);

  // Calculate cubic bezier path with two control points
  const { edgePath, labelX, labelY } = useMemo(() => {
    const [cp1, cp2] = controlPoints;
    const path = `M ${offsetSourceX},${offsetSourceY} C ${cp1.x},${cp1.y} ${cp2.x},${cp2.y} ${offsetTargetX},${offsetTargetY}`;
    
    // Calculate label position at t=0.5 on the cubic bezier curve
    const t = 0.5;
    const mt = 1 - t;
    const mt2 = mt * mt;
    const mt3 = mt2 * mt;
    const t2 = t * t;
    const t3 = t2 * t;
    
    // Cubic bezier formula
    const labelX = mt3 * offsetSourceX + 3 * mt2 * t * cp1.x + 3 * mt * t2 * cp2.x + t3 * offsetTargetX;
    const labelY = mt3 * offsetSourceY + 3 * mt2 * t * cp1.y + 3 * mt * t2 * cp2.y + t3 * offsetTargetY;
    
    return { edgePath: path, labelX, labelY };
  }, [offsetSourceX, offsetSourceY, offsetTargetX, offsetTargetY, controlPoints]);

  // Label dimensions and styling
  const edgeCode = edgeData?.indexCode || id;
  const { labelWidth, labelHeight } = useMemo(
    () => getLabelDimensions(edgeData?.label, edgeCode),
    [edgeData?.label, edgeCode]
  );

  const inAttackPath = !!(edgeData as any)?.inAttackPath;
  const isPathBuildingMode = !!(edgeData as any)?.isPathBuildingMode;

  // In path building mode, only animate edges actually in the attack path (ignore selected/hovered)
  const isConnectedToSelectedNode = edgeData?.sourceNodeSelected || edgeData?.targetNodeSelected;
  const animationClass = isPathBuildingMode
    ? (inAttackPath ? 'security-edge-animated' : '')
    : (selected || isHovered || isConnectedToSelectedNode || inAttackPath) ? 'security-edge-animated' : '';

  // Edge styling
  const pathStyle = useMemo(() => {
    const baseStrokeWidth = componentStyles.securityEdge.strokeWidth;
    const selectedStrokeWidth = componentStyles.securityEdge.selectedStrokeWidth;

    return {
      ...style,
      stroke: inAttackPath ? '#dc2626' : getZoneColor(edgeData?.zone),
      strokeWidth: selected || inAttackPath ? selectedStrokeWidth : baseStrokeWidth,
      strokeLinecap: 'round' as const,
      cursor: 'pointer',
      pointerEvents: 'all' as const,
      filter: selected ? effects.hover : undefined,
    };
  }, [style, edgeData?.zone, selected, inAttackPath]);

  // Marker IDs
  const markerEndId = `arrow-end-${id}`;
  const markerStartId = `arrow-start-${id}`;

  return (
    <>
      <defs>
        <marker 
          id={markerEndId} 
          viewBox="0 0 10 10" 
          refX="7" 
          refY="5" 
          markerWidth="6" 
          markerHeight="6" 
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill={getZoneColor(edgeData?.zone)} />
        </marker>
        <marker 
          id={markerStartId} 
          viewBox="0 0 10 10" 
          refX="1" 
          refY="5" 
          markerWidth="6" 
          markerHeight="6" 
          orient="auto"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill={getZoneColor(edgeData?.zone)} />
        </marker>
      </defs>

      {/* Invisible wider path for easier selection - follows the curved path */}
      <path
        d={edgePath}
        fill="none"
        strokeWidth={30}
        stroke="transparent"
        style={{ cursor: 'pointer', pointerEvents: 'stroke' }}
        onPointerEnter={() => setIsHovered(true)}
        onPointerLeave={() => setIsHovered(false)}
      />

      {/* Visible edge */}
      <path
        id={id}
        className={`react-flow__edge-path ${animationClass}`}
        d={edgePath}
        style={pathStyle}
        markerEnd={`url(#${markerEndId})`}
        markerStart={`url(#${markerStartId})`}
        fill="none"
        onPointerEnter={() => setIsHovered(true)}
        onPointerLeave={() => setIsHovered(false)}
      />

      {/* Control points - one on each side of label */}
      {shouldShowControlPoint && (
        <g style={{ pointerEvents: 'all' }}>
          {controlPoints.map((cp, index) => (
            <ControlPoint
              key={cp.id}
              sourceX={offsetSourceX}
              sourceY={offsetSourceY}
              targetX={offsetTargetX}
              targetY={offsetTargetY}
              controlX={cp.x}
              controlY={cp.y}
              onUpdate={(x, y) => updateControlPoint(index, x, y)}
              onReset={cp.active ? resetControlPoint : undefined}
              color={getZoneColor(edgeData?.zone)}
            />
          ))}
        </g>
      )}

      {/* Edge label */}
      {edgeData?.label && (
        <g 
          transform={`translate(${labelX}, ${labelY})`}
          style={{ pointerEvents: 'all', cursor: 'pointer' }}
        >
          <rect
            x={-labelWidth / 2}
            y={-labelHeight / 2}
            width={labelWidth}
            height={labelHeight}
            fill={colors.surface}
            stroke={getZoneColor(edgeData?.zone)}
            strokeWidth={selected ? 2 : 1}
            rx={4}
          />
          <text
            dominantBaseline="middle"
            textAnchor="middle"
            style={{
              fill: getZoneColor(edgeData?.zone),
              fontSize: `${(parseInt(componentStyles.securityEdge.label.fontSize as string) || 12) * 0.65}px`,
              fontWeight: 500,
              fontFamily: 'inherit',
            }}
          >
            <tspan x="0" y="-7">{edgeData.label}</tspan>
            <tspan x="0" y="6" style={{ fontSize: '10px', opacity: 0.8 }}>{edgeCode}</tspan>
          </text>
        </g>
      )}
    </>
  );
});

QuadraticEdge.displayName = 'QuadraticEdge';

export default QuadraticEdge;