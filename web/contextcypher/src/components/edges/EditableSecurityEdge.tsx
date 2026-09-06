import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { EdgeProps, getBezierPath as getBezierPathRF, getSmoothStepPath, useReactFlow, useStore } from '@xyflow/react';
import { SecurityEdgeData, ControlPointData } from '../../types/SecurityTypes';
import { colors, componentStyles, effects, getTheme } from '../../styles/Theme';
import { ControlPoint } from './ControlPoint';
import { getLinearPath, getBezierPath, calculateInitialControlPoints, getLabelPosition, getPathPoints } from './edgePathUtils';
import { edgeNodePosition, getEdgeParams, getNodeIntersectionWithControlPoints } from './floatingEdgeUtils';
import { useSettings } from '../../settings/SettingsContext';
import { useDiagramLens } from '../../contexts/DiagramLensContext';
import { edgeZoneColor, nodeSecurityZone } from './edgeZone';


const isReddishColor = (hex: string): boolean => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return r > 180 && r > g * 1.5 && r > b * 1.5;
};

// Compute label dimensions based on approximate text metrics
const getLabelDimensions = (label?: string, code?: string) => {
  const fontSize = (parseInt(componentStyles.securityEdge.label.fontSize as string) || 12) * 0.65;

  const longest = Math.max(label?.length || 0, code?.length || 0);
  const labelWidth = longest * 5.5 + 16;

  const lineHeight = fontSize * 1.2;
  const gap = 4;
  const textHeight = lineHeight * 2 + gap;
  const verticalPadding = 10;
  const labelHeight = textHeight + verticalPadding;

  return { labelWidth, labelHeight };
};


export const EditableSecurityEdge = memo(({
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
  const { setEdges, getInternalNode } = useReactFlow();
  const { settings } = useSettings();
  const [isHovered, setIsHovered] = useState(false);
  const edgeData = data as SecurityEdgeData;
  const { pathActive } = useDiagramLens();
  const sourceZone = useStore(useCallback((store: any) => nodeSecurityZone(store.nodeLookup.get(source), (id: string) => store.nodeLookup.get(id)), [source]));
  const targetZone = useStore(useCallback((store: any) => nodeSecurityZone(store.nodeLookup.get(target), (id: string) => store.nodeLookup.get(id)), [target]));

  // Subscribe to source/target node geometry changes so floating-edge intersections
  // recalculate when ReactFlow finishes measuring nodes after initial load.
  const sourceNodeGeometryKey = useStore(
    useCallback((store: any) => {
      const node = store.nodeLookup?.get?.(source)
        ?? store.nodes?.find((n: any) => n.id === source);
      if (!node) return 'missing';
      const width = node.measured?.width ?? node.width ?? 0;
      const height = node.measured?.height ?? node.height ?? 0;
      const { x: posX, y: posY } = edgeNodePosition(node);
      const shape = node.data?.shape ?? '';
      return `${posX}|${posY}|${width}|${height}|${shape}`;
    }, [source])
  );

  const targetNodeGeometryKey = useStore(
    useCallback((store: any) => {
      const node = store.nodeLookup?.get?.(target)
        ?? store.nodes?.find((n: any) => n.id === target);
      if (!node) return 'missing';
      const width = node.measured?.width ?? node.width ?? 0;
      const height = node.measured?.height ?? node.height ?? 0;
      const { x: posX, y: posY } = edgeNodePosition(node);
      const shape = node.data?.shape ?? '';
      return `${posX}|${posY}|${width}|${height}|${shape}`;
    }, [target])
  );

  useEffect(() => {
    const handleClearHover = () => setIsHovered(false);
    document.addEventListener('diagram:clear-edge-hover', handleClearHover);
    return () => {
      document.removeEventListener('diagram:clear-edge-hover', handleClearHover);
    };
  }, []);
  
  // Initialize control points if they don't exist
  const controlPoints = useMemo(() => {
    if (edgeData?.controlPoints && edgeData.controlPoints.length > 0) {
      return edgeData.controlPoints;
    }
    // Don't create default control points unless edge is selected
    return [];
  }, [edgeData?.controlPoints]);
  
  const shouldShowControlPoints = controlPoints.length > 0;

  // Grid snapping for control points
  const GRID_SIZE = 50;
  const snapToGrid = settings.snapToGrid ?? true;
  
  // Handle control point position updates with grid snapping
  const updateControlPoint = useCallback((index: number, position: { x: number; y: number }) => {
    // Apply grid snapping if enabled
    const snappedPosition = snapToGrid
      ? {
          x: Math.round(position.x / GRID_SIZE) * GRID_SIZE,
          y: Math.round(position.y / GRID_SIZE) * GRID_SIZE
        }
      : position;
    
    setEdges((edges) =>
      edges.map((edge) => {
        if (edge.id !== id) return edge;
        
        const currentData = edge.data as SecurityEdgeData;
        const currentPoints = currentData?.controlPoints || [];
        const updatedPoints = [...currentPoints];
        
        if (index >= 0 && index < updatedPoints.length) {
          updatedPoints[index] = {
            ...updatedPoints[index],
            x: snappedPosition.x,
            y: snappedPosition.y,
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
  }, [id, setEdges, snapToGrid]);

  // Handle control point deletion
  const deleteControlPoint = useCallback((index: number) => {
    setEdges((edges) =>
      edges.map((edge) => {
        if (edge.id !== id) return edge;
        
        const currentData = edge.data as SecurityEdgeData;
        const currentPoints = currentData?.controlPoints || [];
        const updatedPoints = currentPoints.filter((_, i) => i !== index);
        
        return {
          ...edge,
          data: {
            ...currentData,
            controlPoints: updatedPoints.length > 0 ? updatedPoints : undefined
          }
        };
      })
    );
  }, [id, setEdges]);

  // Handle edge click to add control point at click location
  const handleClick = useCallback((event: React.MouseEvent<SVGPathElement>) => {
    // If edge is not selected, just let the click propagate for selection
    if (!selected) {
      return;
    }
    
    // Prevent event propagation to avoid deselecting the edge
    event.stopPropagation();
    
    // Get click position in SVG coordinates
    const svg = event.currentTarget.ownerSVGElement;
    if (!svg) return;
    
    const pt = svg.createSVGPoint();
    pt.x = event.clientX;
    pt.y = event.clientY;
    const svgP = pt.matrixTransform(svg.getScreenCTM()?.inverse());
    
    setEdges((edges) =>
      edges.map((edge) => {
        if (edge.id !== id) return edge;
        
        const currentData = edge.data as SecurityEdgeData;
        const currentPoints = currentData?.controlPoints || [];
        
        // Find the best position to insert the new control point
        const pathPoints = [
          { x: sourceX, y: sourceY },
          ...currentPoints,
          { x: targetX, y: targetY }
        ];
        
        let closestSegmentIndex = 0;
        let minDistance = Infinity;
        
        // Find which segment the click was closest to
        for (let i = 0; i < pathPoints.length - 1; i++) {
          const p1 = pathPoints[i];
          const p2 = pathPoints[i + 1];
          
          // Calculate distance from point to line segment
          const A = svgP.x - p1.x;
          const B = svgP.y - p1.y;
          const C = p2.x - p1.x;
          const D = p2.y - p1.y;
          
          const dot = A * C + B * D;
          const lenSq = C * C + D * D;
          let param = -1;
          
          if (lenSq !== 0) param = dot / lenSq;
          
          let xx, yy;
          
          if (param < 0) {
            xx = p1.x;
            yy = p1.y;
          } else if (param > 1) {
            xx = p2.x;
            yy = p2.y;
          } else {
            xx = p1.x + param * C;
            yy = p1.y + param * D;
          }
          
          const dx = svgP.x - xx;
          const dy = svgP.y - yy;
          const distance = Math.sqrt(dx * dx + dy * dy);
          
          if (distance < minDistance) {
            minDistance = distance;
            closestSegmentIndex = i;
          }
        }
        
        // Insert new control point at click position with grid snapping
        const snappedX = snapToGrid ? Math.round(svgP.x / GRID_SIZE) * GRID_SIZE : svgP.x;
        const snappedY = snapToGrid ? Math.round(svgP.y / GRID_SIZE) * GRID_SIZE : svgP.y;
        
        const newControlPoint: ControlPointData = {
          id: `cp-${Date.now()}`,
          x: snappedX,
          y: snappedY,
          active: true
        };
        
        const newControlPoints = [...currentPoints];
        newControlPoints.splice(closestSegmentIndex, 0, newControlPoint);
        
        return {
          ...edge,
          data: {
            ...currentData,
            controlPoints: newControlPoints
          }
        };
      })
    );
  }, [id, sourceX, sourceY, targetX, targetY, setEdges, selected, snapToGrid]);

  // Calculate path and label position with floating edge support
  const { path, labelPosition, pathKey } = useMemo(() => {
    const sourceNode = getInternalNode(source);
    const targetNode = getInternalNode(target);
    
    // Check if we're in fixed mode or if nodes aren't available
    if (settings.edgeMode === 'fixed' || !sourceNode || !targetNode) {
      if (!controlPoints || controlPoints.length === 0) {
        if (settings.edgeStyle === 'bezier') {
          const [path, labelX, labelY] = getBezierPathRF({
            sourceX,
            sourceY,
            sourcePosition,
            targetX,
            targetY,
            targetPosition,
            curvature: 0.25
          });
          const labelPosition = { x: labelX, y: labelY, rotation: 0 };
          const pathKey = `${id}-${sourceX}-${sourceY}-${targetX}-${targetY}-bezier`;
          return { path, labelPosition, pathKey };
        }
        if (settings.edgeStyle === 'smoothstep') {
          const [path, labelX, labelY] = getSmoothStepPath({
            sourceX,
            sourceY,
            sourcePosition,
            targetX,
            targetY,
            targetPosition
          });
          const labelPosition = { x: labelX, y: labelY, rotation: 0 };
          const pathKey = `${id}-${sourceX}-${sourceY}-${targetX}-${targetY}-smoothstep`;
          return { path, labelPosition, pathKey };
        }

        const path = `M ${sourceX} ${sourceY} L ${targetX} ${targetY}`;
        const labelPosition = {
          x: (sourceX + targetX) / 2,
          y: (sourceY + targetY) / 2,
          rotation: 0
        };
        const pathKey = `${id}-${sourceX}-${sourceY}-${targetX}-${targetY}-linear`;
        return { path, labelPosition, pathKey };
      }

      const pathPoints = getPathPoints(
        { x: sourceX, y: sourceY },
        { x: targetX, y: targetY },
        controlPoints
      );
      const pathFunction = settings.edgeStyle === 'bezier' ? getBezierPath : getLinearPath;
      const path = pathFunction(pathPoints, sourcePosition, targetPosition);
      const labelPosition = getLabelPosition(pathPoints);
      const pathKey = `${id}-${sourceX}-${sourceY}-${targetX}-${targetY}-${controlPoints.map(cp => `${cp.x},${cp.y}`).join('-')}`;
      return { path, labelPosition, pathKey };
    }
    
    // Calculate floating edge positions
    const controlPointPositions = controlPoints.map(cp => ({ x: cp.x, y: cp.y }));
    
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
    
    // Build path points with floating intersections
    // Get edge positions for proper bezier curves
    const { sourcePos, targetPos } = getEdgeParams(sourceNode, targetNode);

    if (!controlPoints || controlPoints.length === 0) {
      if (settings.edgeStyle === 'bezier') {
        const [path, labelX, labelY] = getBezierPathRF({
          sourceX: sourceIntersection.x,
          sourceY: sourceIntersection.y,
          sourcePosition: sourcePos,
          targetX: targetIntersection.x,
          targetY: targetIntersection.y,
          targetPosition: targetPos,
          curvature: 0.25
        });
        const labelPosition = { x: labelX, y: labelY, rotation: 0 };
        const pathKey = `${id}-${sourceIntersection.x}-${sourceIntersection.y}-${targetIntersection.x}-${targetIntersection.y}-bezier`;
        return { path, labelPosition, pathKey };
      }
      if (settings.edgeStyle === 'smoothstep') {
        const [path, labelX, labelY] = getSmoothStepPath({
          sourceX: sourceIntersection.x,
          sourceY: sourceIntersection.y,
          sourcePosition: sourcePos,
          targetX: targetIntersection.x,
          targetY: targetIntersection.y,
          targetPosition: targetPos
        });
        const labelPosition = { x: labelX, y: labelY, rotation: 0 };
        const pathKey = `${id}-${sourceIntersection.x}-${sourceIntersection.y}-${targetIntersection.x}-${targetIntersection.y}-smoothstep`;
        return { path, labelPosition, pathKey };
      }

      const path = `M ${sourceIntersection.x} ${sourceIntersection.y} L ${targetIntersection.x} ${targetIntersection.y}`;
      const labelPosition = {
        x: (sourceIntersection.x + targetIntersection.x) / 2,
        y: (sourceIntersection.y + targetIntersection.y) / 2,
        rotation: 0
      };
      const pathKey = `${id}-${sourceIntersection.x}-${sourceIntersection.y}-${targetIntersection.x}-${targetIntersection.y}-linear`;
      return { path, labelPosition, pathKey };
    }

    const pathPoints = getPathPoints(
      sourceIntersection,
      targetIntersection,
      controlPoints
    );
    const pathFunction = settings.edgeStyle === 'bezier' ? getBezierPath : getLinearPath;
    const path = pathFunction(pathPoints, sourcePos, targetPos);
    const labelPosition = getLabelPosition(pathPoints);
    const pathKey = `${id}-${sourceIntersection.x}-${sourceIntersection.y}-${targetIntersection.x}-${targetIntersection.y}-${controlPoints.map(cp => `${cp.x},${cp.y}`).join('-')}`;
    return { path, labelPosition, pathKey };
  }, [
    source,
    target,
    sourceX,
    sourceY,
    targetX,
    targetY,
    controlPoints,
    sourcePosition,
    targetPosition,
    settings.edgeStyle,
    settings.edgeMode,
    id,
    getInternalNode,
    sourceNodeGeometryKey,
    targetNodeGeometryKey
  ]);

  // Label dimensions and styling
  const edgeCode = edgeData?.indexCode || id;
  const { labelWidth, labelHeight } = useMemo(
    () => getLabelDimensions(edgeData?.label, edgeCode),
    [edgeData?.label, edgeCode]
  );
  const isPathBuildingMode = Boolean((edgeData as any)?.isPathBuildingMode);
  const shouldUseWideEdgeClickToInsertControlPoint = selected && !isPathBuildingMode;
  const shouldEnableWideEdgeHitTarget = shouldUseWideEdgeClickToInsertControlPoint || isPathBuildingMode;

  const inAttackPath = !!(edgeData as any)?.inAttackPath;

  // In path building mode, only animate edges actually in the attack path (ignore selected/hovered)
  const animationClass = useMemo(() => {
    const isConnectedNodeSelected = edgeData?.sourceNodeSelected || edgeData?.targetNodeSelected;
    if (isPathBuildingMode) return inAttackPath ? 'security-edge-animated' : '';
    return (selected || isHovered || isConnectedNodeSelected || inAttackPath) ? 'security-edge-animated' : '';
  }, [selected, isHovered, edgeData?.sourceNodeSelected, edgeData?.targetNodeSelected, inAttackPath, isPathBuildingMode]);

  // Document theme: thin ink flows; flows crossing zone boundaries render red dashed
  const currentTheme = useMemo(
    () => getTheme(settings.theme, settings.customTheme),
    [settings.theme, settings.customTheme]
  );
  const documentStyle = !!currentTheme.documentStyle;
  const themeColors = currentTheme.colors as any;
  const zoneColor = edgeZoneColor(edgeData, sourceZone, { ...colors.zoneColors, ...themeColors.zoneColors }, themeColors.textSecondary || colors.textSecondary);
  const attackPathColor = isReddishColor(zoneColor) ? '#ffffff' : '#dc2626';

  const crossesBoundary = useMemo(() => {
    if (!documentStyle) return false;
    return Boolean(sourceZone && targetZone && sourceZone !== targetZone);
  }, [documentStyle, sourceZone, targetZone]);

  const edgeStrokeColor = documentStyle
    ? (inAttackPath
        ? (themeColors.flowCrossing || '#E81313')
        : crossesBoundary
          ? (themeColors.flowCrossing || '#E81313')
          : (themeColors.ink || '#3A414A'))
    : (inAttackPath ? attackPathColor : zoneColor);

  // Edge styling
  const pathStyle = useMemo(() => {
    const baseStrokeWidth = documentStyle ? 1.25 : componentStyles.securityEdge.strokeWidth;
    const selectedStrokeWidth = documentStyle ? 2 : componentStyles.securityEdge.selectedStrokeWidth;
    const isConnectedNodeSelected = edgeData?.sourceNodeSelected || edgeData?.targetNodeSelected;
    const shouldHighlight = selected || isConnectedNodeSelected;

    return {
      ...style,
      stroke: edgeStrokeColor,
      strokeWidth: shouldHighlight || inAttackPath ? selectedStrokeWidth : baseStrokeWidth,
      ...(documentStyle && crossesBoundary && !inAttackPath ? { strokeDasharray: '6 5' } : {}),
      strokeLinecap: 'round' as const,
      cursor: 'pointer',
      pointerEvents: 'all' as const,
      filter: shouldHighlight && !documentStyle ? effects.hover : undefined,
    };
  }, [style, edgeStrokeColor, documentStyle, crossesBoundary, selected, edgeData?.sourceNodeSelected, edgeData?.targetNodeSelected, inAttackPath]);

  // Unique marker IDs
  const markerEndId = `arrow-end-${id}`;
  const markerStartId = `arrow-start-${id}`;

  return (
    <g style={{ opacity: pathActive && !inAttackPath ? 0.3 : 1, transition: 'opacity 0.2s ease' }}>
      {/* Arrow marker definitions */}
      <defs>
        <marker 
          id={markerEndId} 
          viewBox="0 0 10 10" 
          refX="7" 
          refY="5" 
          markerWidth="6" 
          markerHeight="6" 
          orient="auto-start-reverse" 
          markerUnits="strokeWidth"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill={edgeStrokeColor} />
        </marker>
        <marker
          id={markerStartId}
          viewBox="0 0 10 10"
          refX="1"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto"
          markerUnits="strokeWidth"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill={edgeStrokeColor} />
        </marker>
      </defs>

      {/* Invisible hit area for easier clicking */}
      <path
        key={pathKey}
        d={path}
        fill="none"
        strokeWidth={30}
        stroke="transparent"
        onPointerEnter={() => setIsHovered(true)}
        onPointerLeave={() => setIsHovered(false)}
        onClick={shouldUseWideEdgeClickToInsertControlPoint ? handleClick : undefined}
        style={{
          cursor: 'pointer',
          pointerEvents: shouldEnableWideEdgeHitTarget ? 'stroke' : 'none'
        }}
      />

      {/* Visible edge path */}
      <path
        id={id}
        className={`react-flow__edge-path ${animationClass}`}
        d={path}
        style={{ ...pathStyle, pointerEvents: 'stroke' }}
        markerEnd={`url(#${markerEndId})`}
        markerStart={`url(#${markerStartId})`}
        data-testid={`edge-${id}`}
        onPointerEnter={() => setIsHovered(true)}
        onPointerLeave={() => setIsHovered(false)}
      />

      {/* Document style: encryption glyph at the flow midpoint (closed lock =
          encrypted, open red lock = explicitly unencrypted) */}
      {documentStyle && (() => {
        const enc = (edgeData?.encryption || '').toLowerCase().trim();
        if (!enc) return null;
        const isEncrypted = enc !== 'none' && enc !== 'no' && enc !== 'unencrypted' && enc !== 'cleartext' && enc !== 'plaintext';
        const glyphColor = isEncrypted ? (themeColors.inkSecondary || '#6B7280') : (themeColors.flowCrossing || '#E81313');
        const gx = labelPosition.x + labelWidth / 2 + 4;
        const gy = labelPosition.y - 6;
        return (
          <g transform={`translate(${gx}, ${gy})`} pointerEvents="none">
            <rect x="1" y="5" width="10" height="7" rx="1.5" fill="#ffffff" stroke={glyphColor} strokeWidth="1.2" />
            {isEncrypted ? (
              <path d="M 3 5 V 3.5 A 3 3 0 0 1 9 3.5 V 5" fill="none" stroke={glyphColor} strokeWidth="1.2" />
            ) : (
              <path d="M 3 5 V 3.5 A 3 3 0 0 1 9 3.5" fill="none" stroke={glyphColor} strokeWidth="1.2" />
            )}
          </g>
        );
      })()}

      {/* Edge label - Using foreignObject for proper z-index control */}
      {edgeData?.label && (
        <foreignObject
          x={labelPosition.x - labelWidth / 2}
          y={labelPosition.y - labelHeight / 2}
          width={labelWidth}
          height={labelHeight}
          className="react-flow__edge-label-container"
          style={{ overflow: 'visible' }}
        >
          <div
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: documentStyle ? (themeColors.paper || '#ffffff') : colors.surface,
              border: documentStyle
                ? (selected ? `1.5px solid ${themeColors.primary}` : 'none')
                : `${selected ? componentStyles.securityEdge.selectedStrokeWidth : 1}px solid ${zoneColor}`,
              borderRadius: `${componentStyles.securityEdge.label.borderRadius || 4}px`,
              boxShadow: documentStyle ? '0 0 0 2px rgba(255,255,255,0.75)' : undefined,
              filter: selected && !documentStyle ? effects.hover : undefined,
              cursor: 'pointer',
              userSelect: 'none',
              position: 'relative',
              zIndex: 1002,
            }}
            onMouseEnter={(e) => {
              setIsHovered(true);
              // Trigger edge mouse enter event for QuickInspector
              const event = new CustomEvent('edgeLabelMouseEnter', {
                detail: { edgeId: id, clientX: e.clientX, clientY: e.clientY }
              });
              document.dispatchEvent(event);
            }}
            onMouseLeave={() => {
              setIsHovered(false);
              // Trigger edge mouse leave event
              const event = new CustomEvent('edgeLabelMouseLeave', {
                detail: { edgeId: id }
              });
              document.dispatchEvent(event);
            }}
          >
            <div style={{
              textAlign: 'center',
              color: documentStyle ? (themeColors.ink || '#3A414A') : zoneColor,
              filter: selected && !documentStyle ? effects.hover : undefined,
            }}>
              <div style={{
                fontSize: documentStyle
                  ? '10px'
                  : `${(parseInt(componentStyles.securityEdge.label.fontSize as string) || 12) * 0.65}px`,
                fontWeight: 500,
                fontFamily: documentStyle ? 'Helvetica, Arial, "Segoe UI", Roboto, sans-serif' : 'inherit',
                lineHeight: 1.2,
              }}>
                {edgeData.label}
              </div>
              {/* Document style keeps labels human: system edge codes are hidden */}
              {!documentStyle && (
                <div style={{
                  fontSize: `${(parseInt(componentStyles.securityEdge.label.fontSize as string) || 12) * 0.65}px`,
                  opacity: 0.8,
                  marginTop: '2px',
                }}>
                  {edgeCode}
                </div>
              )}
            </div>
          </div>
        </foreignObject>
      )}

      {/* Control points */}
      {shouldShowControlPoints && controlPoints.map((cp, index) => (
        <ControlPoint
          key={cp.id}
          id={cp.id}
          index={index}
          x={cp.x}
          y={cp.y}
          edgeId={id}
          onPositionChange={updateControlPoint}
          onDelete={deleteControlPoint}
          isActive={cp.active}
          color={zoneColor}
        />
      ))}
    </g>
  );
});

EditableSecurityEdge.displayName = 'EditableSecurityEdge';

export default EditableSecurityEdge;
