import React from 'react';
import { ShapeProps } from '../../../types/ShapeTypes';

function Shield({ width, height, ...svgAttributes }: ShapeProps) {
  // Shield shape with curved bottom
  const shieldPath = `
    M ${width * 0.5} ${0}
    L ${width} ${height * 0.3}
    L ${width} ${height * 0.6}
    Q ${width * 0.5} ${height} ${0} ${height * 0.6}
    L ${0} ${height * 0.3}
    Z
  `;

  return <path d={shieldPath} {...svgAttributes} />;
}

export default Shield;