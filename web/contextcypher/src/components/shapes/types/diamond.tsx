import React from 'react';
import { ShapeProps } from '../../../types/ShapeTypes';
import { generatePath } from './utils';

function Diamond({ width, height, ...svgAttributes }: ShapeProps) {
  const diamondPath = generatePath([
    [width / 2, 0],          // Top
    [width, height / 2],     // Right
    [width / 2, height],     // Bottom
    [0, height / 2]         // Left
  ]);

  return <path d={diamondPath} {...svgAttributes} />;
}

export default Diamond;