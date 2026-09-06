import React from 'react';
import { ShapeProps } from '../../../types/ShapeTypes';
import { generatePath, getStarPoints } from './utils';

function Star({ width, height, ...svgAttributes }: ShapeProps) {
  const cx = width / 2;
  const cy = height / 2;
  const outerRadius = Math.min(width / 2, height / 2);
  const innerRadius = outerRadius * 0.45; // Inner radius is 45% of outer
  
  const points = getStarPoints(cx, cy, outerRadius, innerRadius, 5);
  const starPath = generatePath(points);

  return <path d={starPath} {...svgAttributes} />;
}

export default Star;