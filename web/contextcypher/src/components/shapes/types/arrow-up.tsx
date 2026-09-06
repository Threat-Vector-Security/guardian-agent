import React from 'react';
import { ShapeProps } from '../../../types/ShapeTypes';
import { generatePath } from './utils';

function ArrowUp({ width, height, ...svgAttributes }: ShapeProps) {
  const arrowHeight = height * 0.25; // Arrow point takes 25% of height
  
  const arrowUpPath = generatePath([
    [width / 2, 0],                      // Top point (arrow tip)
    [width, arrowHeight],                // Top right after arrow
    [width, height],                     // Bottom right
    [0, height],                         // Bottom left
    [0, arrowHeight]                     // Top left after arrow
  ]);

  return <path d={arrowUpPath} {...svgAttributes} />;
}

export default ArrowUp;