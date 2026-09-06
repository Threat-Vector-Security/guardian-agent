import React from 'react';
import { ShapeProps } from '../../../types/ShapeTypes';
import { generatePath, getPolygonPoints } from './utils';

function Pentagon({ width, height, ...svgAttributes }: ShapeProps) {
  const cx = width / 2;
  const cy = height / 2;
  const radius = Math.min(width / 2, height / 2);
  
  // Generate pentagon points (5 sides, point at top)
  const points = getPolygonPoints(cx, cy, radius, 5);
  const pentagonPath = generatePath(points);

  return <path d={pentagonPath} {...svgAttributes} />;
}

export default Pentagon;