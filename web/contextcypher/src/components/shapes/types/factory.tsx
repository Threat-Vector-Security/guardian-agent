import React from 'react';
import { ShapeProps } from '../../../types/ShapeTypes';
import { generatePath } from './utils';

function Factory({ width, height, ...svgAttributes }: ShapeProps) {
  const roofCount = 3; // Number of roof sections
  const roofHeight = height * 0.3; // Roof section height
  const roofWidth = width / roofCount;
  
  // Build sawtooth roof pattern
  const points: number[][] = [];
  points.push([0, height]); // Bottom left
  
  // Add sawtooth roof points
  for (let i = 0; i < roofCount; i++) {
    const x = i * roofWidth;
    points.push([x, roofHeight]);
    points.push([x + roofWidth * 0.6, 0]);
    points.push([x + roofWidth * 0.6, roofHeight]);
  }
  
  points.push([width, roofHeight]); // Top right
  points.push([width, height]); // Bottom right
  
  const factoryPath = generatePath(points);

  return <path d={factoryPath} {...svgAttributes} />;
}

export default Factory;