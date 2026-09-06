import React from 'react';
import { ShapeProps } from '../../../types/ShapeTypes';

function RoundedRectangle({ width, height, ...svgAttributes }: ShapeProps) {
  // Calculate corner radius based on the smaller dimension
  const cornerRadius = Math.min(width, height) * 0.15; // 15% of smaller dimension
  
  return (
    <rect
      x={0}
      y={0}
      width={width}
      height={height}
      rx={cornerRadius}
      ry={cornerRadius}
      {...svgAttributes}
    />
  );
}

export default RoundedRectangle;