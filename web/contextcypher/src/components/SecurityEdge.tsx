import React, { memo, useCallback, useMemo, useState } from 'react';
import { EdgeProps, Node, Edge, getBezierPath, getSmoothStepPath } from '@xyflow/react';
import { SecurityEdgeData, SecurityZone } from '../types/SecurityTypes';
import { colors, componentStyles, effects } from '../styles/Theme';
import { useSettings } from '../settings/SettingsContext';

const getZoneColor = (zone?: SecurityZone) => {
  if (!zone || !(zone in colors.zoneColors)) {
    return colors.textSecondary;
  }
  return colors.zoneColors[zone as keyof typeof colors.zoneColors];
};

// Compute label dimensions based on approximate text metrics so the rect always wraps
const getLabelDimensions = (label?: string, code?: string) => {
  const primaryFontSize = (parseInt(componentStyles.securityEdge.label.fontSize as string) || 12) * 0.65; // smaller
  const secondaryFontSize = 8;
  
  const longest = Math.max(label?.length || 0, code?.length || 0);
  const labelWidth = longest * 5 + 16; // tighter width calc

  // Calculate height based on text block and symmetrical padding
  const gap = 2; // smaller gap
  const textHeight = primaryFontSize + secondaryFontSize + gap;
  const verticalPadding = 12; // tighter padding
  const labelHeight = textHeight + verticalPadding;
  
  return { labelWidth, labelHeight };
};


// Configuration for multiple edge separation
const MULTIPLE_EDGE_CONFIG = {
  maxOffset: 50,        // Maximum offset in pixels (increase for more separation)
  minSpacing: 15,       // Minimum spacing between edges
  curveVariation: 0.3,  // How much to vary the curve (0-1)
  strokeVariation: 0.5, // Additional stroke width for multiple edges
  dashThreshold: 30     // Offset threshold to add dashed lines
};

const SecurityEdgeComponent = memo(({
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
  targetHandleId
}: EdgeProps) => {
  const { settings } = useSettings();

  // We need to determine if source or target nodes are selected
  // In production builds, we can't use useStore directly, but we can infer from the edge state
  // When a node is selected, its connected edges often get visual updates through React Flow

  // Since we can't access allEdges from store, use a simplified offset
  // This will still provide some variation for multiple edges
  const edgeOffset = useMemo(() => {
    // Use edge ID to generate a consistent offset
    const hash = id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const offsetIndex = hash % 3 - 1; // -1, 0, or 1
    return offsetIndex * 20; // -20, 0, or 20 pixels offset
  }, [id]);

  // Use a simplified offset multiplier based on edge ID
  const { offsetMultiplier } = useMemo(() => {
    // Generate a consistent multiplier from the edge ID
    const hash = id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return { offsetMultiplier: (hash % 3 - 1) * 0.5 }; // -0.5, 0, or 0.5
  }, [id]);

  // Use provided handle positions since we can't access node data from store
  const { actualSourceX, actualSourceY, actualTargetX, actualTargetY } = useMemo(() => {
    // In production builds, we can't access allNodes from store, so use the provided positions
    return {
      actualSourceX: sourceX,
      actualSourceY: sourceY, 
      actualTargetX: targetX,
      actualTargetY: targetY
    };
  }, [sourceX, sourceY, targetX, targetY]);

  // Memoize extended points calculation with offset for multiple edges using actual node centers
  const { extendedSourceX, extendedSourceY, extendedTargetX, extendedTargetY } = useMemo(() => {
    const dx = actualTargetX - actualSourceX;
    const dy = actualTargetY - actualSourceY;
    const distance = Math.sqrt(dx * dx + dy * dy) || 1;

    // Unit vector along the edge direction
    const ux = dx / distance;
    const uy = dy / distance;

    // Determine side of handles for axis-aligned spreading so endpoints stay on border
    const isSourceHorizontal = sourceHandleId?.includes('top') || sourceHandleId?.includes('bottom');
    const isTargetHorizontal = targetHandleId?.includes('top') || targetHandleId?.includes('bottom');

    // Perpendicular offsets applied only along allowed axis
    const offsetSrcX = isSourceHorizontal ? edgeOffset : 0;
    const offsetSrcY = isSourceHorizontal ? 0 : edgeOffset;
    const offsetTgtX = isTargetHorizontal ? edgeOffset : 0;
    const offsetTgtY = isTargetHorizontal ? 0 : edgeOffset;

    // Gaps for arrow positioning
    const sourceGap = 12; // push away from source
    const targetGap = -8; // pull slightly into target

    return {
      extendedSourceX: actualSourceX + (ux * sourceGap) + offsetSrcX,
      extendedSourceY: actualSourceY + (uy * sourceGap) + offsetSrcY,
      extendedTargetX: actualTargetX + (ux * targetGap) + offsetTgtX,
      extendedTargetY: actualTargetY + (uy * targetGap) + offsetTgtY,
    };
  }, [actualSourceX, actualSourceY, actualTargetX, actualTargetY, edgeOffset, sourceHandleId, targetHandleId]);

  const edgeData = data as SecurityEdgeData & { 
    sourceNodeSelected?: boolean; 
    targetNodeSelected?: boolean; 
  };
  const edgeCode = edgeData?.indexCode || id; // Use indexCode from data if available, fallback to id
  const { labelWidth, labelHeight } = useMemo(() => getLabelDimensions(edgeData?.label, edgeCode), [edgeData?.label, edgeCode]);
  
  // The complex `labelPositionData` useMemo has been removed.

  // Use smoothstep, linear, or bezier path based on user settings
  const [edgePath, labelX, labelY] = useMemo(() => {
    if (settings.edgeStyle === 'bezier') {
      // Use ReactFlow's bezier path for curved edges
      return getBezierPath({
        sourceX: extendedSourceX,
        sourceY: extendedSourceY,
        sourcePosition,
        targetX: extendedTargetX,
        targetY: extendedTargetY,
        targetPosition,
        curvature: 0.25,
      });
    } else if (settings.edgeStyle === 'smoothstep') {
      // Use smoothstep for auto-turning edges
      return getSmoothStepPath({
        sourceX: extendedSourceX,
        sourceY: extendedSourceY,
        sourcePosition,
        targetX: extendedTargetX,
        targetY: extendedTargetY,
        targetPosition
      });
    } else {
      // Create a straight line path for linear edges
      const path = `M ${extendedSourceX} ${extendedSourceY} L ${extendedTargetX} ${extendedTargetY}`;
      
      // Calculate label position at midpoint
      const midX = (extendedSourceX + extendedTargetX) / 2;
      const midY = (extendedSourceY + extendedTargetY) / 2;
      
      return [path, midX, midY];
    }
  }, [
    extendedSourceX, 
    extendedSourceY, 
    sourcePosition,
    extendedTargetX, 
    extendedTargetY,
    targetPosition,
    settings.edgeStyle
  ]);

  // Compute perpendicular vector for label offset
  const dxMid = extendedTargetX - extendedSourceX;
  const dyMid = extendedTargetY - extendedSourceY;
  const distMid = Math.sqrt(dxMid * dxMid + dyMid * dyMid) || 1;
  const perpX = -(dyMid / distMid);
  const perpY = dxMid / distMid;

  const LABEL_SPREAD = 2; // multiplier for label offset relative to edge spread
  const ALONG_SPREAD = 30; // px shift along edge per offset unit
  const dirX = dxMid / distMid;
  const dirY = dyMid / distMid;
  // Invert sign so labels move away from centre of parallel group
  const alongOffsetX = dirX * (-offsetMultiplier) * ALONG_SPREAD;
  const alongOffsetY = dirY * (-offsetMultiplier) * ALONG_SPREAD;
  const finalLabelX = labelX + perpX * edgeOffset * LABEL_SPREAD + alongOffsetX;
  const finalLabelY = labelY + perpY * edgeOffset * LABEL_SPREAD + alongOffsetY;

  // Determine orientation of parallel offset for label placement

  // Determine if edge should be animated based on connected nodes' selection or edge selection
  
  // State to track hover for animation
  const [isHovered, setIsHovered] = useState(false);
  
  // Get animation class based on selection, hover state, and connected node selection
  const animationClass = useMemo(() => {
    // Check if either connected node is selected
    const sourceSelected = edgeData?.sourceNodeSelected || false;
    const targetSelected = edgeData?.targetNodeSelected || false;
    const isConnectedToSelected = sourceSelected || targetSelected;
    
    // Animate if edge is selected, hovered, or connected to selected nodes
    if (selected || isHovered || isConnectedToSelected) {
      // Always animate in the true direction of the edge (source to target)
      // This shows the actual data flow direction
      return 'security-edge-animated';
    }
    
    return '';
  }, [selected, isHovered, edgeData?.sourceNodeSelected, edgeData?.targetNodeSelected]);

  // Memoized edge styling for performance
  const pathStyle = useMemo(() => {
    const baseStrokeWidth = componentStyles.securityEdge.strokeWidth;
    const selectedStrokeWidth = componentStyles.securityEdge.selectedStrokeWidth;
    
    return {
      ...style,
      stroke: getZoneColor(edgeData?.zone),
      strokeWidth: selected ? selectedStrokeWidth : baseStrokeWidth,
      strokeLinecap: 'round' as const,
      cursor: 'pointer',
      pointerEvents: 'all' as const,
      filter: selected ? effects.hover : undefined,
      // Remove transition for better performance during dragging
      // transition: transitions.default,
    };
  }, [style, data?.zone, selected]);

  // Unique marker ID per edge to avoid conflicts
  const markerEndId = `arrow-end-${id}`;
  const markerStartId = `arrow-start-${id}`;

  return (
    <>
      {/* Arrow marker definition */}
      <defs>
        {/* Arrow for the end (target) */}
        <marker id={markerEndId} viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse" markerUnits="strokeWidth">
          <path d="M 0 0 L 10 5 L 0 10 z" fill={getZoneColor(edgeData?.zone)} />
        </marker>
        {/* Arrow for the start (source) */}
        <marker id={markerStartId} viewBox="0 0 10 10" refX="0" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse" markerUnits="strokeWidth">
          <path d="M 10 0 L 0 5 L 10 10 z" fill={getZoneColor(edgeData?.zone)} />
        </marker>
      </defs>
      <path
        id={id}
        className={`react-flow__edge-path ${animationClass}`}
        d={edgePath}
        style={pathStyle}
        markerEnd={`url(#${markerEndId})`}
        markerStart={`url(#${markerStartId})`}
        data-testid={`edge-${id}`}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      />
      {edgeData?.label && (
        <g 
          transform={`translate(${finalLabelX}, ${finalLabelY})`}
          style={{ 
            zIndex: selected ? 15 : 11, // Bring selected edge labels to front
            pointerEvents: 'all' as const
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
            rx={componentStyles.securityEdge.label.borderRadius || 4}
            ry={componentStyles.securityEdge.label.borderRadius || 4}
            style={{
              filter: selected ? effects.hover : undefined,
              // Remove transition for better performance
              // transition: transitions.default
            }}
          />
          <text
            dominantBaseline="middle"
            textAnchor="middle"
            style={{
              fill: getZoneColor(edgeData?.zone),
              filter: selected ? effects.hover : undefined,
              fontSize: `${(parseInt(componentStyles.securityEdge.label.fontSize as string) || 12) * 0.65}px`,
              fontWeight: 500,
              fontFamily: 'inherit',
              userSelect: 'none',
              // Remove transition for better performance
              // transition: transitions.default
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

export default SecurityEdgeComponent;
