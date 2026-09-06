import React from 'react';
import { ShapeProps } from '../../../types/ShapeTypes';
import { generatePath, getPolygonPoints } from './utils';

function Hexagon({ width, height, ...svgAttributes }: ShapeProps) {
  const cx = width / 2;
  const cy = height / 2;
  // Calculate radius to fit within bounds
  const radius = Math.min(width / 2, height / 2);
  
  // Generate hexagon points (6 sides, rotated to have flat top/bottom)
  const points = getPolygonPoints(cx, cy, radius, 6, 0);
  const hexagonPath = generatePath(points);

  return <path d={hexagonPath} {...svgAttributes} />;
}

export default Hexagon;