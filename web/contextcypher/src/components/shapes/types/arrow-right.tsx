import React from 'react';
import { ShapeProps } from '../../../types/ShapeTypes';
import { generatePath } from './utils';

function ArrowRight({ width, height, ...svgAttributes }: ShapeProps) {
  const arrowWidth = width * 0.25; // Arrow point takes 25% of width
  
  const arrowRectPath = generatePath([
    [0, 0],                              // Top left
    [width - arrowWidth, 0],             // Top right before arrow
    [width, height / 2],                 // Arrow point
    [width - arrowWidth, height],        // Bottom right before arrow
    [0, height]                          // Bottom left
  ]);

  return <path d={arrowRectPath} {...svgAttributes} />;
}

export default ArrowRight;