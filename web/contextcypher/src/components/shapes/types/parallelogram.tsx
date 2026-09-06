import React from 'react';
import { ShapeProps } from '../../../types/ShapeTypes';
import { generatePath } from './utils';

function Parallelogram({ width, height, ...svgAttributes }: ShapeProps) {
  const skew = width * 0.2; // 20% skew
  
  const parallelogramPath = generatePath([
    [skew, 0],            // Top left
    [width, 0],           // Top right
    [width - skew, height], // Bottom right
    [0, height]           // Bottom left
  ]);

  return <path d={parallelogramPath} {...svgAttributes} />;
}

export default Parallelogram;