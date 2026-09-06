import React from 'react';
import { ShapeProps } from '../../../types/ShapeTypes';
import { generatePath } from './utils';

function House({ width, height, ...svgAttributes }: ShapeProps) {
  const roofHeight = height * 0.35; // Roof is 35% of total height
  const wallHeight = height - roofHeight;
  
  const housePath = generatePath([
    // Roof
    [width / 2, 0],              // Peak
    [width, roofHeight],         // Right roof edge
    [width, height],             // Bottom right
    [0, height],                 // Bottom left
    [0, roofHeight],             // Left roof edge
  ]);

  return <path d={housePath} {...svgAttributes} />;
}

export default House;