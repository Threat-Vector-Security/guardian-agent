import React from 'react';
import { ShapeProps } from '../../../types/ShapeTypes';
import { generatePath } from './utils';

function ArrowHorizontal({ width, height, ...svgAttributes }: ShapeProps) {
  const arrowWidth = width * 0.15; // Smaller arrow heads for more content area
  const bodyHeight = height * 0.5; // Thicker body
  const bodyTop = (height - bodyHeight) / 2;
  const bodyBottom = bodyTop + bodyHeight;
  
  const arrowHorizontalPath = generatePath([
    // Left arrow point
    [0, height / 2],                     // Left arrow tip
    [arrowWidth, 0],                     // Top of left arrow
    [arrowWidth, bodyTop],               // Top of body at left
    [width - arrowWidth, bodyTop],       // Top of body at right
    [width - arrowWidth, 0],             // Top of right arrow
    // Right arrow point
    [width, height / 2],                 // Right arrow tip
    [width - arrowWidth, height],        // Bottom of right arrow
    [width - arrowWidth, bodyBottom],    // Bottom of body at right
    [arrowWidth, bodyBottom],            // Bottom of body at left
    [arrowWidth, height],                // Bottom of left arrow
  ]);

  return <path d={arrowHorizontalPath} {...svgAttributes} />;
}

export default ArrowHorizontal;