import React from 'react';
import { ShapeProps } from '../../../types/ShapeTypes';
import { generatePath } from './utils';

function Trapezoid({ width, height, ...svgAttributes }: ShapeProps) {
  const inset = width * 0.15; // 15% inset on each side
  
  const trapezoidPath = generatePath([
    [inset, 0],              // Top left
    [width - inset, 0],      // Top right
    [width, height],         // Bottom right
    [0, height]              // Bottom left
  ]);

  return <path d={trapezoidPath} {...svgAttributes} />;
}

export default Trapezoid;