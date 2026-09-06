import React, { memo, useCallback, useMemo, useState } from 'react';
import { EdgeProps, useReactFlow, useStore, getBezierPath as getBezierPathRF, getSmoothStepPath } from '@xyflow/react';
import { SecurityEdgeData, SecurityZone, ControlPointData } from '../../types/SecurityTypes';
import { colors, componentStyles, effects } from '../../styles/Theme';
import { useSettings } from '../../settings/SettingsContext';

const getZoneColor = (zone?: SecurityZone) => {
  if (!zone || !(zone in colors.zoneColors)) {
    return colors.textSecondary;
  }
  return colors.zoneColors[zone as keyof typeof colors.zoneColors];
};

// Compute label dimensions
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

// Simple control point component
const ControlPoint: React.FC<{
  x: number;
  y: number;
  onPositionChange: (position: { x: number; y: number }) => void;
  color: string;
}> = ({ x, y, onPositionChange, color }) => {
  const { screenToFlowPosition } = useReactFlow();
  const [dragging, setDragging] = useState(false);
  const [hover, setHover] = useState(false);
  const domNode = useStore((state) => state.domNode);

  React.useEffect(() => {
    if (!dragging || !domNode) return;

    const handlePointerMove = (e: PointerEvent) => {
      const position = screenToFlowPosition({ x: e.clientX, y: e.clientY });
      onPositionChange(position);
    };

    const handlePointerUp = () => {
      setDragging(false);
    };

    domNode.addEventListener('pointermove', handlePointerMove);
    domNode.addEventListener('pointerup', handlePointerUp, { once: true });

    return () => {
      domNode.removeEventListener('pointermove', handlePointerMove);
      domNode.removeEventListener('pointerup', handlePointerUp);
    };
  }, [dragging, domNode, onPositionChange, screenToFlowPosition]);

  return (
    <g transform={`translate(${x}, ${y})`}>
      {/* Large hit area */}
      <circle
        r={15}
        fill="transparent"
        style={{ cursor: dragging ? 'grabbing' : 'grab' }}
        onPointerDown={(e) => {
          e.stopPropagation();
          setDragging(true);
        }}
        onPointerEnter={() => setHover(true)}
        onPointerLeave={() => setHover(false)}
      />
      
      {/* Visual feedback */}
      {(hover || dragging) && (
        <circle
          r={10}
          fill={`${color}20`}
          stroke={color}
          strokeWidth={1}
          strokeOpacity={0.5}
          style={{ pointerEvents: 'none' }}
        />
      )}
      
      {/* Control point */}
      <circle
        r={hover || dragging ? 5 : 4}
        fill="white"
        stroke={color}
        strokeWidth={2}
        style={{ 
          pointerEvents: 'none',
          transition: dragging ? 'none' : 'all 0.15s ease'
        }}
      />
    </g>
  );
};

export const SimpleEditableEdge = memo(({
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
}: EdgeProps) => {
  const { setEdges } = useReactFlow();
  const { settings } = useSettings();
  const [isHovered, setIsHovered] = useState(false);
  const edgeData = data as SecurityEdgeData;
  
  // Check if should show control point
  const shouldShowControlPoint = useStore((store) => {
    const sourceNode = store.nodeLookup.get(source);
    const targetNode = store.nodeLookup.get(target);
    return selected || sourceNode?.selected || targetNode?.selected || isHovered;
  });

  // Get or calculate control point
  const controlPoint = useMemo(() => {
    if (edgeData?.controlPoints?.[0]) {
      return edgeData.controlPoints[0];
    }
    // Default to midpoint
    return {
      id: 'default',
      x: (sourceX + targetX) / 2,
      y: (sourceY + targetY) / 2,
      active: false
    };
  }, [edgeData?.controlPoints, sourceX, sourceY, targetX, targetY]);

  // Update control point position
  const updateControlPoint = useCallback((position: { x: number; y: number }) => {
    setEdges((edges) =>
      edges.map((edge) => {
        if (edge.id !== id) return edge;
        
        const currentData = edge.data as SecurityEdgeData;
        const newControlPoint: ControlPointData = {
          id: `cp-${Date.now()}`,
          x: position.x,
          y: position.y,
          active: true
        };
        
        return {
          ...edge,
          data: {
            ...currentData,
            controlPoints: [newControlPoint]
          }
        };
      })
    );
  }, [id, setEdges]);

  // Calculate path
  const [edgePath, labelX, labelY] = useMemo(() => {
    // If we have a control point that's been moved, use smooth step
    if (controlPoint.active) {
      return getSmoothStepPath({
        sourceX,
        sourceY,
        sourcePosition,
        targetX,
        targetY,
        targetPosition,
        centerX: controlPoint.x,
        centerY: controlPoint.y,
      });
    }
    
    if (settings.edgeStyle === 'bezier') {
      return getBezierPathRF({
        sourceX,
        sourceY,
        sourcePosition,
        targetX,
        targetY,
        targetPosition,
        curvature: 0.25
      });
    }
    if (settings.edgeStyle === 'smoothstep') {
      return getSmoothStepPath({
        sourceX,
        sourceY,
        sourcePosition,
        targetX,
        targetY,
        targetPosition
      });
    }

    // Otherwise, simple straight line
    const path = `M ${sourceX},${sourceY} L ${targetX},${targetY}`;
    const labelX = (sourceX + targetX) / 2;
    const labelY = (sourceY + targetY) / 2;

    return [path, labelX, labelY];
  }, [sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, controlPoint, settings.edgeStyle]);

  // Label dimensions and styling
  const edgeCode = edgeData?.indexCode || id;
  const { labelWidth, labelHeight } = useMemo(
    () => getLabelDimensions(edgeData?.label, edgeCode),
    [edgeData?.label, edgeCode]
  );

  const inAttackPath = !!(edgeData as any)?.inAttackPath;
  const isPathBuildingMode = !!(edgeData as any)?.isPathBuildingMode;

  // In path building mode, only animate edges actually in the attack path (ignore selected/hovered)
  const animationClass = useMemo(() => {
    const isConnectedNodeSelected = edgeData?.sourceNodeSelected || edgeData?.targetNodeSelected;
    if (isPathBuildingMode) return inAttackPath ? 'security-edge-animated' : '';
    return (selected || isHovered || isConnectedNodeSelected || inAttackPath) ? 'security-edge-animated' : '';
  }, [selected, isHovered, edgeData?.sourceNodeSelected, edgeData?.targetNodeSelected, inAttackPath, isPathBuildingMode]);

  // Edge styling
  const pathStyle = useMemo(() => {
    const baseStrokeWidth = componentStyles.securityEdge.strokeWidth;
    const selectedStrokeWidth = componentStyles.securityEdge.selectedStrokeWidth;
    const isConnectedNodeSelected = edgeData?.sourceNodeSelected || edgeData?.targetNodeSelected;
    const shouldHighlight = selected || isConnectedNodeSelected;

    return {
      ...style,
      stroke: inAttackPath ? '#dc2626' : getZoneColor(edgeData?.zone),
      strokeWidth: shouldHighlight || inAttackPath ? selectedStrokeWidth : baseStrokeWidth,
      strokeLinecap: 'round' as const,
      cursor: 'pointer',
      filter: shouldHighlight ? effects.hover : undefined,
    };
  }, [style, edgeData?.zone, selected, edgeData?.sourceNodeSelected, edgeData?.targetNodeSelected, inAttackPath]);

  // Marker IDs
  const markerEndId = `arrow-end-${id}`;

  return (
    <>
      <defs>
        <marker 
          id={markerEndId} 
          viewBox="0 0 10 10" 
          refX="5" 
          refY="5" 
          markerWidth="6" 
          markerHeight="6" 
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill={getZoneColor(edgeData?.zone)} />
        </marker>
      </defs>

      {/* Invisible wider path for easier selection */}
      <path
        d={edgePath}
        fill="none"
        strokeWidth={30}
        stroke="transparent"
        onPointerEnter={() => setIsHovered(true)}
        onPointerLeave={() => setIsHovered(false)}
        style={{ cursor: 'pointer' }}
      />

      {/* Visible edge */}
      <path
        id={id}
        className={`react-flow__edge-path ${animationClass}`}
        d={edgePath}
        style={pathStyle}
        markerEnd={`url(#${markerEndId})`}
        data-testid={`edge-${id}`}
      />

      {/* Control point */}
      {shouldShowControlPoint && (
        <ControlPoint
          x={controlPoint.x}
          y={controlPoint.y}
          onPositionChange={updateControlPoint}
          color={getZoneColor(edgeData?.zone)}
        />
      )}

      {/* Edge label */}
      {edgeData?.label && (
        <g 
          transform={`translate(${labelX}, ${labelY})`}
          style={{ 
            zIndex: selected ? 15 : 11,
            pointerEvents: 'none'
          }}
        >
          <rect
            x={-labelWidth / 2}
            y={-labelHeight / 2}
            width={labelWidth}
            height={labelHeight}
            fill={colors.surface}
            fillOpacity={1}
            stroke={getZoneColor(edgeData?.zone)}
            strokeWidth={selected ? componentStyles.securityEdge.selectedStrokeWidth : 1}
            rx={4}
            style={{
              filter: selected ? effects.hover : undefined,
            }}
          />
          <text
            dominantBaseline="middle"
            textAnchor="middle"
            style={{
              fill: getZoneColor(edgeData?.zone),
              fontSize: `${(parseInt(componentStyles.securityEdge.label.fontSize as string) || 12) * 0.65}px`,
              fontWeight: 500,
              fontFamily: 'inherit',
              userSelect: 'none',
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

SimpleEditableEdge.displayName = 'SimpleEditableEdge';

export default SimpleEditableEdge;
