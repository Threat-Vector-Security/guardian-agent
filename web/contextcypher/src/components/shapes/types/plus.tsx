import React from 'react';
import { ShapeProps } from '../../../types/ShapeTypes';

function Plus({ width, height, ...svgAttributes }: ShapeProps) {
  const thickness = 0.35; // Thickness ratio
  const size = Math.min(width, height);
  const armThickness = size * thickness;
  
  // Simple plus shape - just two rectangles
  return (
    <g>
      {/* Vertical bar */}
      <rect
        x={(width - armThickness) / 2}
        y={0}
        width={armThickness}
        height={height}
        {...svgAttributes}
      />
      {/* Horizontal bar */}
      <rect
        x={0}
        y={(height - armThickness) / 2}
        width={width}
        height={armThickness}
        {...svgAttributes}
      />
    </g>
  );
}

export default Plus;