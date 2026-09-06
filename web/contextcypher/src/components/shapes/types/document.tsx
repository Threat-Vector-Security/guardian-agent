import React from 'react';
import { ShapeProps } from '../../../types/ShapeTypes';

function Document({ width, height, ...svgAttributes }: ShapeProps) {
  const foldSize = Math.min(width * 0.2, height * 0.2); // Corner fold size
  
  const documentPath = `
    M 0 0
    L ${width - foldSize} 0
    L ${width} ${foldSize}
    L ${width} ${height}
    L 0 ${height}
    Z
    M ${width - foldSize} 0
    L ${width - foldSize} ${foldSize}
    L ${width} ${foldSize}
  `;

  return <path d={documentPath} {...svgAttributes} />;
}

export default Document;