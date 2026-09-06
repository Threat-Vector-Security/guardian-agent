import React from 'react';
import { ShapeProps } from '../../../types/ShapeTypes';
import { generatePath } from './utils';

function ArrowDown({ width, height, ...svgAttributes }: ShapeProps) {
  const arrowHeight = height * 0.25; // Arrow point takes 25% of height
  
  const arrowDownPath = generatePath([
    [0, 0],                              // Top left
    [width, 0],                          // Top right
    [width, height - arrowHeight],       // Bottom right before arrow
    [width / 2, height],                 // Bottom point (arrow tip)
    [0, height - arrowHeight]            // Bottom left before arrow
  ]);

  return <path d={arrowDownPath} {...svgAttributes} />;
}

export default ArrowDown;