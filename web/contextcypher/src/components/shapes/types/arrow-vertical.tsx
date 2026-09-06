import React from 'react';
import { ShapeProps } from '../../../types/ShapeTypes';
import { generatePath } from './utils';

function ArrowVertical({ width, height, ...svgAttributes }: ShapeProps) {
  const arrowHeight = height * 0.15; // Smaller arrow heads for more content area
  const bodyWidth = width * 0.5; // Thicker body
  const bodyLeft = (width - bodyWidth) / 2;
  const bodyRight = bodyLeft + bodyWidth;
  
  const arrowVerticalPath = generatePath([
    // Top arrow point
    [width / 2, 0],                      // Top arrow tip
    [width, arrowHeight],                // Right of top arrow
    [bodyRight, arrowHeight],            // Right of body at top
    [bodyRight, height - arrowHeight],   // Right of body at bottom
    [width, height - arrowHeight],       // Right of bottom arrow
    // Bottom arrow point
    [width / 2, height],                 // Bottom arrow tip
    [0, height - arrowHeight],           // Left of bottom arrow
    [bodyLeft, height - arrowHeight],    // Left of body at bottom
    [bodyLeft, arrowHeight],             // Left of body at top
    [0, arrowHeight]                     // Left of top arrow
  ]);

  return <path d={arrowVerticalPath} {...svgAttributes} />;
}

export default ArrowVertical;