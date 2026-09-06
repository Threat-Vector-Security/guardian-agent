import React from 'react';
import { ShapeProps } from '../../../types/ShapeTypes';

function Cross({ width, height, ...svgAttributes }: ShapeProps) {
  const thickness = 0.35; // Match plus thickness
  const size = Math.min(width, height);
  const armThickness = size * thickness;
  
  // Calculate the diagonal length but scale it down to fit within bounds
  const diagonal = Math.sqrt(width * width + height * height) * 0.9; // 90% of full diagonal
  const barWidth = armThickness;
  const barHeight = diagonal;
  
  // Center points
  const cx = width / 2;
  const cy = height / 2;
  
  // Angle for the diagonals
  const angle1 = Math.atan2(height, width) * (180 / Math.PI);
  const angle2 = -angle1;
  
  // Create X with two equal diagonal bars
  return (
    <g>
      {/* Top-left to bottom-right diagonal */}
      <rect
        x={cx - barWidth / 2}
        y={cy - barHeight / 2}
        width={barWidth}
        height={barHeight}
        transform={`rotate(${angle1} ${cx} ${cy})`}
        {...svgAttributes}
      />
      {/* Top-right to bottom-left diagonal */}
      <rect
        x={cx - barWidth / 2}
        y={cy - barHeight / 2}
        width={barWidth}
        height={barHeight}
        transform={`rotate(${angle2} ${cx} ${cy})`}
        {...svgAttributes}
      />
    </g>
  );
}

export default Cross;