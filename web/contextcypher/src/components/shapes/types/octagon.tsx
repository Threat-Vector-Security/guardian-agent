import React from 'react';
import { ShapeProps } from '../../../types/ShapeTypes';
import { generatePath, getPolygonPoints } from './utils';

function Octagon({ width, height, ...svgAttributes }: ShapeProps) {
  const cx = width / 2;
  const cy = height / 2;
  const radius = Math.min(width / 2, height / 2);
  
  // Generate octagon points (8 sides, rotated for flat top)
  const points = getPolygonPoints(cx, cy, radius, 8, Math.PI / 8);
  const octagonPath = generatePath(points);

  return <path d={octagonPath} {...svgAttributes} />;
}

export default Octagon;