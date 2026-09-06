import React, { useMemo } from 'react';
import { NodeProps, NodeResizer, Handle, Position } from '@xyflow/react';
import { useTheme } from '@mui/material';
import type { Points } from '../../types/DrawingTypes';
import { pointsToSimplePath } from '../../utils/drawingPath';

export type FreehandNodeData = {
  points: Points;
  initialSize: { width: number; height: number };
  style?: {
    stroke?: string;
    strokeWidth?: number;
    opacity?: number;
    strokeDasharray?: string;
  };
  drawingAnalysis?: string;
};

export type FreehandNodeType = {
  id: string;
  type: 'freehand';
  position: { x: number; y: number };
  data: FreehandNodeData;
  width?: number;
  height?: number;
};

export function FreehandNode({
  data,
  width = 100,
  height = 100,
  selected,
  dragging,
  id,
}: NodeProps<FreehandNodeType>) {
  const theme = useTheme();
  const scaleX = width / data.initialSize.width;
  const scaleY = height / data.initialSize.height;

  const points = useMemo(
    () =>
      data.points.map((point) => [
        point[0] * scaleX,
        point[1] * scaleY,
        point[2],
      ]) as Points,
    [data.points, scaleX, scaleY]
  );

  const style = data.style || {};
  const strokeColor = style.stroke || theme.palette.text.primary;
  const strokeWidth = style.strokeWidth || 1;
  const opacity = style.opacity || 0.8;
  
  // Scale dash pattern based on stroke width
  const scaleDashPattern = (pattern: string | undefined): string | undefined => {
    if (!pattern || pattern === 'none') return undefined;
    const baseWidth = 2;
    const scale = strokeWidth / baseWidth;
    return pattern.split(',').map(val => 
      Math.round(parseFloat(val.trim()) * scale).toString()
    ).join(',');
  };


  return (
    <div style={{ width: '100%', height: '100%' }}>
      <NodeResizer 
        isVisible={!!selected && !dragging} 
        minWidth={50}
        minHeight={50}
      />
      <svg
        width={width}
        height={height}
        style={{
          cursor: 'pointer',
          position: 'relative',
          zIndex: 1 // Above zones (-1) but below security nodes (10)
        }}
      >
        {/* Invisible wider area for easier clicking */}
        <path
          d={pointsToSimplePath(points)}
          fill="transparent"
          stroke="transparent"
          strokeWidth={Math.max(20, strokeWidth + 10)}
          style={{
            pointerEvents: 'all',
            cursor: 'pointer'
          }}
        />
        {/* Visible stroked path */}
        <path
          d={pointsToSimplePath(points)}
          fill="none"
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          strokeDasharray={scaleDashPattern(style.strokeDasharray)}
          opacity={opacity}
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            pointerEvents: 'none'
          }}
        />
      </svg>
    </div>
  );
}