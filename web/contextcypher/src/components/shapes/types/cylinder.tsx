import React from 'react';
import { ShapeProps } from '../../../types/ShapeTypes';

function Cylinder({ width, height, ...svgAttributes }: ShapeProps) {
  const ellipseHeight = height * 0.15; // Ellipse is 15% of total height
  const rx = width / 2;
  const ry = ellipseHeight / 2;
  
  // Create cylinder with visible top ellipse
  return (
    <g>
      {/* Cylinder body */}
      <path
        d={`
          M 0 ${ry}
          L 0 ${height - ry}
          A ${rx} ${ry} 0 0 0 ${width} ${height - ry}
          L ${width} ${ry}
          A ${rx} ${ry} 0 0 0 0 ${ry}
          Z
        `}
        {...svgAttributes}
      />
      {/* Top ellipse */}
      <ellipse
        cx={rx}
        cy={ry}
        rx={rx}
        ry={ry}
        {...svgAttributes}
      />
    </g>
  );
}

export default Cylinder;