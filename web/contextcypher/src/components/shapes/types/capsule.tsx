import React from 'react';
import { ShapeProps } from '../../../types/ShapeTypes';

function Capsule({ width, height, ...svgAttributes }: ShapeProps) {
  const radius = height / 2; // Full semicircle on each end
  const rectWidth = width - height; // Rectangle portion width
  
  // If width is less than height, make it a circle
  if (rectWidth <= 0) {
    const minDimension = Math.min(width, height);
    return (
      <circle
        cx={width / 2}
        cy={height / 2}
        r={minDimension / 2}
        {...svgAttributes}
      />
    );
  }
  
  const capsulePath = `
    M ${radius} 0
    L ${radius + rectWidth} 0
    A ${radius} ${radius} 0 0 1 ${radius + rectWidth} ${height}
    L ${radius} ${height}
    A ${radius} ${radius} 0 0 1 ${radius} 0
    Z
  `;

  return <path d={capsulePath} {...svgAttributes} />;
}

export default Capsule;