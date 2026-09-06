import React from 'react';
import { ShapeProps } from '../../../types/ShapeTypes';

function Circle({ width, height, ...svgAttributes }: ShapeProps) {
  // For circles, use the smaller dimension to ensure it fits
  const diameter = Math.min(width, height);
  const radius = diameter / 2;
  const cx = width / 2;
  const cy = height / 2;
  
  return (
    <circle
      cx={cx}
      cy={cy}
      r={radius}
      {...svgAttributes}
    />
  );
}

export default Circle;