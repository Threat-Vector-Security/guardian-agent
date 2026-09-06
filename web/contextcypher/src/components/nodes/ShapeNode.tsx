import React from 'react';
import { NodeProps, NodeResizer, Handle, Position } from '@xyflow/react';
import { useTheme } from '@mui/material';

export type ShapeType = 'rectangle' | 'circle' | 'arrow';

export type ShapeNodeData = {
  shapeType: ShapeType;
  style?: {
    stroke?: string;
    strokeWidth?: number;
    opacity?: number;
    strokeDasharray?: string;
    fill?: string;
    fillOpacity?: number;
  };
  drawingAnalysis?: string;
};

export type ShapeNodeType = {
  id: string;
  type: 'shape';
  position: { x: number; y: number };
  data: ShapeNodeData;
  width?: number;
  height?: number;
};

export function ShapeNode({
  data,
  width = 100,
  height = 100,
  selected,
  dragging,
  id,
}: NodeProps<ShapeNodeType>) {
  const theme = useTheme();
  const style = data.style || {};
  const strokeColor = style.stroke || theme.palette.primary.main;
  const strokeWidth = style.strokeWidth || 2;
  const opacity = style.opacity || 0.7;
  const fillColor = style.fill || 'none';
  const fillOpacity = style.fillOpacity || 0;
  
  // Scale dash pattern based on stroke width
  const scaleDashPattern = (pattern: string | undefined): string | undefined => {
    if (!pattern || pattern === 'none') return undefined;
    const baseWidth = 2;
    const scale = strokeWidth / baseWidth;
    return pattern.split(',').map(val => 
      Math.round(parseFloat(val.trim()) * scale).toString()
    ).join(',');
  };


  const renderShape = () => {
    switch (data.shapeType) {
      case 'rectangle':
        return (
          <rect
            x={strokeWidth / 2}
            y={strokeWidth / 2}
            width={width - strokeWidth}
            height={height - strokeWidth}
            fill={fillColor}
            fillOpacity={fillOpacity}
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            opacity={opacity}
            strokeDasharray={scaleDashPattern(style.strokeDasharray)}
          />
        );
      
      case 'circle':
        const radius = Math.min(width, height) / 2 - strokeWidth / 2;
        return (
          <circle
            cx={width / 2}
            cy={height / 2}
            r={radius}
            fill={fillColor}
            fillOpacity={fillOpacity}
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            opacity={opacity}
            strokeDasharray={scaleDashPattern(style.strokeDasharray)}
          />
        );
      
      case 'arrow':
        const arrowPath = `
          M ${strokeWidth} ${height / 2}
          L ${width - height / 4} ${height / 2}
          M ${width - height / 3} ${height / 3}
          L ${width - strokeWidth} ${height / 2}
          L ${width - height / 3} ${height * 2 / 3}
        `;
        return (
          <path
            d={arrowPath}
            fill="none"
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            opacity={opacity}
            strokeDasharray={scaleDashPattern(style.strokeDasharray)}
          />
        );
      
      default:
        return null;
    }
  };

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <NodeResizer 
        isVisible={!!selected && !dragging}
        minWidth={30}
        minHeight={30}
        keepAspectRatio={data.shapeType === 'circle'}
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
        {renderShape()}
      </svg>
    </div>
  );
}