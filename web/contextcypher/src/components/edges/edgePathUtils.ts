import type { Position, XYPosition } from '@xyflow/react';
import type { ControlPointData } from '../../types/SecurityTypes';

// Calculate a linear path through control points (straight line segments)
export function getLinearPath(
  points: XYPosition[],
  sourcePosition?: Position,
  targetPosition?: Position
): string {
  if (points.length < 2) return '';
  
  // Start the path at the first point
  let path = `M ${points[0].x} ${points[0].y}`;
  
  // Draw straight lines to each subsequent point
  for (let i = 1; i < points.length; i++) {
    path += ` L ${points[i].x} ${points[i].y}`;
  }
  
  return path;
}

// Bezier path calculation for curved edges
export function getBezierPath(
  points: XYPosition[],
  sourcePosition?: Position,
  targetPosition?: Position
): string {
  if (points.length < 2) return '';
  
  // For simple straight line (no control points)
  if (points.length === 2) {
    return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;
  }

  // Start the path
  let path = `M ${points[0].x} ${points[0].y}`;
  
  // For 3 points (source, 1 control point, target), use quadratic Bezier
  if (points.length === 3) {
    path += ` Q ${points[1].x} ${points[1].y}, ${points[2].x} ${points[2].y}`;
    return path;
  }
  
  // For 4 points (source, 2 control points, target), use cubic Bezier
  if (points.length === 4) {
    path += ` C ${points[1].x} ${points[1].y}, ${points[2].x} ${points[2].y}, ${points[3].x} ${points[3].y}`;
    return path;
  }
  
  // For more points, chain quadratic Bezier curves
  for (let i = 1; i < points.length - 1; i++) {
    const p0 = points[i - 1];
    const p1 = points[i];
    const p2 = points[i + 1];
    
    // Calculate control point for smooth curve
    const cpx = p1.x;
    const cpy = p1.y;
    
    // End point is midway to next point for smooth transition
    const epx = (p1.x + p2.x) / 2;
    const epy = (p1.y + p2.y) / 2;
    
    if (i === points.length - 2) {
      // Last segment goes to final point
      path += ` Q ${cpx} ${cpy}, ${p2.x} ${p2.y}`;
    } else {
      path += ` Q ${cpx} ${cpy}, ${epx} ${epy}`;
    }
  }
  
  return path;
}

// Keep the old smooth path function for backward compatibility
export function getSmoothPath(
  points: XYPosition[],
  sourcePosition?: Position,
  targetPosition?: Position
): string {
  // Now just delegates to linear path by default
  return getLinearPath(points, sourcePosition, targetPosition);
}

// Calculate initial control points for an edge
export function calculateInitialControlPoints(
  source: XYPosition,
  target: XYPosition,
  existingPoints?: ControlPointData[],
  edgeStyle: 'smoothstep' | 'linear' | 'bezier' = 'smoothstep'
): ControlPointData[] {
  // If we have existing points, use them
  if (existingPoints && existingPoints.length > 0) {
    return existingPoints;
  }
  
  // For smoothstep/linear edges, start with no control points for a direct/auto path
  if (edgeStyle === 'linear' || edgeStyle === 'smoothstep') {
    return [];
  }
  
  // For bezier edges, create a single control point at the midpoint
  const midX = (source.x + target.x) / 2;
  const midY = (source.y + target.y) / 2;
  
  return [
    {
      id: `cp-${Date.now()}`,
      x: midX,
      y: midY,
      active: false
    }
  ];
}

// Generate control points for creating waypoints in linear edges
export function getLinearControlPoints(
  points: (ControlPointData | XYPosition)[]
): ControlPointData[] {
  const controlPoints: ControlPointData[] = [];

  // Place control points at the midpoint of each segment
  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i];
    const p2 = points[i + 1];

    // Add existing control points
    if ('id' in p1 && p1.id) {
      controlPoints.push(p1 as ControlPointData);
    }

    // Add midpoint control point for new segments
    if (i < points.length - 1) {
      controlPoints.push({
        id: `cp-${Date.now()}-${i}`,
        x: (p1.x + p2.x) / 2,
        y: (p1.y + p2.y) / 2,
        active: false
      });
    }
  }

  return controlPoints;
}

// Get point at parameter t (0-1) along the edge
export function getPointOnEdge(
  source: XYPosition,
  target: XYPosition,
  t: number
): XYPosition {
  return {
    x: source.x + (target.x - source.x) * t,
    y: source.y + (target.y - source.y) * t
  };
}

// Get perpendicular vector at parameter t
export function getPerpendicularVector(
  source: XYPosition,
  target: XYPosition,
  t: number
): { x: number; y: number } {
  const dx = target.x - source.x;
  const dy = target.y - source.y;
  const length = Math.sqrt(dx * dx + dy * dy) || 1;
  
  // Perpendicular vector (rotated 90 degrees)
  return {
    x: -dy / length,
    y: dx / length
  };
}

// Calculate total path length
function calculateTotalPathLength(points: XYPosition[]): number {
  let totalLength = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const dx = points[i + 1].x - points[i].x;
    const dy = points[i + 1].y - points[i].y;
    totalLength += Math.sqrt(dx * dx + dy * dy);
  }
  return totalLength;
}

// Get label position along the path at 50% of total length
export function getLabelPosition(points: XYPosition[]): XYPosition & { rotation: number } {
  if (points.length < 2) {
    return { x: 0, y: 0, rotation: 0 };
  }
  
  // Calculate total path length
  const totalLength = calculateTotalPathLength(points);
  const targetLength = totalLength / 2;
  
  // Find the segment that contains the 50% point
  let accumulatedLength = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const dx = points[i + 1].x - points[i].x;
    const dy = points[i + 1].y - points[i].y;
    const segmentLength = Math.sqrt(dx * dx + dy * dy);
    
    if (accumulatedLength + segmentLength >= targetLength) {
      // The 50% point is in this segment
      const remainingLength = targetLength - accumulatedLength;
      const t = segmentLength > 0 ? remainingLength / segmentLength : 0;
      
      // Interpolate position
      const x = points[i].x + dx * t;
      const y = points[i].y + dy * t;
      
      // Calculate rotation based on segment direction
      const rotation = Math.atan2(dy, dx) * (180 / Math.PI);
      
      return { x, y, rotation };
    }
    
    accumulatedLength += segmentLength;
  }
  
  // Fallback to midpoint of last segment (should not reach here)
  const lastIdx = points.length - 1;
  const midX = (points[lastIdx - 1].x + points[lastIdx].x) / 2;
  const midY = (points[lastIdx - 1].y + points[lastIdx].y) / 2;
  const dx = points[lastIdx].x - points[lastIdx - 1].x;
  const dy = points[lastIdx].y - points[lastIdx - 1].y;
  const rotation = Math.atan2(dy, dx) * (180 / Math.PI);
  
  return { x: midX, y: midY, rotation };
}

// Convert control points to path points including source and target
export function getPathPoints(
  source: XYPosition,
  target: XYPosition,
  controlPoints: ControlPointData[]
): XYPosition[] {
  const points: XYPosition[] = [source];
  
  // Add control points
  controlPoints.forEach(cp => {
    points.push({ x: cp.x, y: cp.y });
  });
  
  points.push(target);
  return points;
}
