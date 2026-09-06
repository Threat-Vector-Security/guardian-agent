import React from 'react';
import { ShapeProps } from '../../../types/ShapeTypes';

function Cloud({ width, height, ...svgAttributes }: ShapeProps) {
  // Symmetrical cloud shape with outward curving sides
  const cx = width * 0.5; // Center X
  const cy = height * 0.5; // Center Y
  
  const cloudPath = `
    M ${width * 0.15} ${cy}
    C ${width * 0.15} ${height * 0.3}, ${width * 0.1} ${height * 0.25}, ${width * 0.25} ${height * 0.2}
    C ${width * 0.3} ${height * 0.1}, ${width * 0.45} ${height * 0.1}, ${cx} ${height * 0.2}
    C ${width * 0.55} ${height * 0.1}, ${width * 0.7} ${height * 0.1}, ${width * 0.75} ${height * 0.2}
    C ${width * 0.9} ${height * 0.25}, ${width * 0.85} ${height * 0.3}, ${width * 0.85} ${cy}
    C ${width * 0.85} ${height * 0.7}, ${width * 0.9} ${height * 0.75}, ${width * 0.75} ${height * 0.8}
    C ${width * 0.7} ${height * 0.9}, ${width * 0.55} ${height * 0.9}, ${cx} ${height * 0.8}
    C ${width * 0.45} ${height * 0.9}, ${width * 0.3} ${height * 0.9}, ${width * 0.25} ${height * 0.8}
    C ${width * 0.1} ${height * 0.75}, ${width * 0.15} ${height * 0.7}, ${width * 0.15} ${cy}
    Z
  `;

  return <path d={cloudPath} {...svgAttributes} />;
}

export default Cloud;