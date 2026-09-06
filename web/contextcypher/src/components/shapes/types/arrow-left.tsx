import React from 'react';
import { ShapeProps } from '../../../types/ShapeTypes';
import { generatePath } from './utils';

function ArrowLeft({ width, height, ...svgAttributes }: ShapeProps) {
  const arrowWidth = width * 0.25; // Arrow point takes 25% of width
  
  const arrowLeftPath = generatePath([
    [arrowWidth, 0],                     // Top left after arrow
    [width, 0],                          // Top right
    [width, height],                     // Bottom right
    [arrowWidth, height],                // Bottom left after arrow
    [0, height / 2]                      // Arrow point (left)
  ]);

  return <path d={arrowLeftPath} {...svgAttributes} />;
}

export default ArrowLeft;