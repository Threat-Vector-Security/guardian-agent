import React from 'react';
import { ShapeProps } from '../../../types/ShapeTypes';
import { generatePath } from './utils';

function Triangle({ width, height, ...svgAttributes }: ShapeProps) {
  const trianglePath = generatePath([
    [width / 2, 0],        // Top center
    [width, height],       // Bottom right
    [0, height]           // Bottom left
  ]);

  return <path d={trianglePath} {...svgAttributes} />;
}

export default Triangle;