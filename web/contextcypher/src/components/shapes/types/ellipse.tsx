import React from 'react';
import { ShapeProps } from '../../../types/ShapeTypes';

function Ellipse({ width, height, ...svgAttributes }: ShapeProps) {
  const cx = width / 2;
  const cy = height / 2;
  const rx = width / 2;
  const ry = height / 2;
  
  return (
    <ellipse
      cx={cx}
      cy={cy}
      rx={rx}
      ry={ry}
      {...svgAttributes}
    />
  );
}

export default Ellipse;