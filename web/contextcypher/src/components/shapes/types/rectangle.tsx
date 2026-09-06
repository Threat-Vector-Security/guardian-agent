import React from 'react';
import { ShapeProps } from '../../../types/ShapeTypes';

function Rectangle({ width, height, ...svgAttributes }: ShapeProps) {
  return (
    <rect
      x={0}
      y={0}
      width={width}
      height={height}
      {...svgAttributes}
    />
  );
}

export default Rectangle;