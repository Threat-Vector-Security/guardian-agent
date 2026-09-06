import React from 'react';
import { ShapeComponents } from './types';
import { ShapeComponentProps } from '../../types/ShapeTypes';

function Shape({ type, width, height, ...svgAttributes }: ShapeComponentProps) {
  const ShapeComponent = ShapeComponents[type];
  
  if (!ShapeComponent || !width || !height) {
    return null;
  }

  const strokeWidth = svgAttributes.strokeWidth ? +svgAttributes.strokeWidth : 0;
  
  // We subtract the strokeWidth to make sure the shape is not cut off
  const innerWidth = width - 2 * strokeWidth;
  const innerHeight = height - 2 * strokeWidth;
  
  return (
    <svg 
      width={width} 
      height={height} 
      className="shape-svg"
      style={{ 
        position: 'absolute',
        top: 0,
        left: 0,
        pointerEvents: 'none'
      }}
    >
      {/* This offsets the shape by the strokeWidth */}
      <g transform={`translate(${strokeWidth}, ${strokeWidth})`}>
        <ShapeComponent
          width={innerWidth}
          height={innerHeight}
          {...svgAttributes}
        />
      </g>
    </svg>
  );
}

export default Shape;