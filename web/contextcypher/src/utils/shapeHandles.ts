import { Position } from '@xyflow/react';
import { NodeShape } from '../types/ShapeTypes';

export interface HandlePosition {
  id: string;
  position: Position;
  x: string | number;
  y: string | number;
  angle?: number; // For circular shapes
}

// Handle size for offset calculations (matches CSS)
const HANDLE_SIZE = 14; // 14px as defined in getHandleStyle
const HANDLE_OFFSET = HANDLE_SIZE / 2; // 7px offset to center handle on border

// Get handle positions for a specific shape
export function getShapeHandlePositions(shape: NodeShape, handleCount: number = 8): HandlePosition[] {
  switch (shape) {
    case 'circle':
      return getCircleHandles(handleCount);
    case 'hexagon':
      return getPolygonHandles(6);
    case 'pentagon':
      return getPolygonHandles(5);
    case 'octagon':
      return getPolygonHandles(8);
    case 'triangle':
      return getTriangleHandles();
    case 'diamond':
      return getDiamondHandles();
    case 'ellipse':
      return getEllipseHandles(handleCount);
    case 'star':
      return getStarHandles();
    case 'shield':
      return getShieldHandles();
    case 'cloud':
      return getCloudHandles();
    case 'cylinder':
      return getCylinderHandles();
    case 'trapezoid':
      return getTrapezoidHandles();
    case 'parallelogram':
      return getParallelogramHandles();
    case 'capsule':
      return getCapsuleHandles();
    case 'arrow-horizontal':
    case 'arrow-vertical':
    case 'arrow-left':
    case 'arrow-right':
    case 'arrow-up':
    case 'arrow-down':
      return getArrowHandles(shape);
    case 'house':
      return getHouseHandles();
    case 'factory':
      return getFactoryHandles();
    case 'plus':
    case 'cross':
      return getCrossHandles();
    case 'rectangle':
    case 'rounded-rectangle':
    case 'document':
    default:
      return getRectangleHandles();
  }
}

// Helper to determine React Flow Position based on angle
function getPositionFromAngle(angle: number): Position {
  // Normalize angle to 0-360
  const normalizedAngle = ((angle % 360) + 360) % 360;
  
  // Determine position based on quadrant
  if (normalizedAngle >= 315 || normalizedAngle < 45) return Position.Right;
  if (normalizedAngle >= 45 && normalizedAngle < 135) return Position.Bottom;
  if (normalizedAngle >= 135 && normalizedAngle < 225) return Position.Left;
  return Position.Top;
}

// Rectangle handles - traditional 4 sides with multiple points per side
function getRectangleHandles(): HandlePosition[] {
  const handles: HandlePosition[] = [];
  const pointsPerSide = 3;
  
  // Top side
  for (let i = 0; i < pointsPerSide; i++) {
    const x = 20 + (60 / (pointsPerSide - 1)) * i;
    handles.push({
      id: `top-${i}`,
      position: Position.Top,
      x: `${x}%`,
      y: -HANDLE_OFFSET
    });
  }
  
  // Right side
  for (let i = 0; i < pointsPerSide; i++) {
    const y = 20 + (60 / (pointsPerSide - 1)) * i;
    handles.push({
      id: `right-${i}`,
      position: Position.Right,
      x: `calc(100% + ${HANDLE_OFFSET}px)`,
      y: `${y}%`
    });
  }
  
  // Bottom side
  for (let i = 0; i < pointsPerSide; i++) {
    const x = 20 + (60 / (pointsPerSide - 1)) * i;
    handles.push({
      id: `bottom-${i}`,
      position: Position.Bottom,
      x: `${x}%`,
      y: `calc(100% + ${HANDLE_OFFSET}px)`
    });
  }
  
  // Left side
  for (let i = 0; i < pointsPerSide; i++) {
    const y = 20 + (60 / (pointsPerSide - 1)) * i;
    handles.push({
      id: `left-${i}`,
      position: Position.Left,
      x: -HANDLE_OFFSET,
      y: `${y}%`
    });
  }
  
  return handles;
}

// Circle handles - evenly distributed around circumference
function getCircleHandles(count: number = 8): HandlePosition[] {
  const handles: HandlePosition[] = [];
  const angleStep = 360 / count;
  
  for (let i = 0; i < count; i++) {
    const angle = i * angleStep;
    const radians = (angle * Math.PI) / 180;
    
    // Calculate position on circle edge (radius = 50%)
    const x = 50 + 50 * Math.cos(radians);
    const y = 50 + 50 * Math.sin(radians);
    
    // Calculate pixel offset to place handle center on border
    const offsetX = HANDLE_OFFSET * Math.cos(radians);
    const offsetY = HANDLE_OFFSET * Math.sin(radians);
    
    handles.push({
      id: `circle-${angle}`,
      position: getPositionFromAngle(angle),
      x: `calc(${x}% + ${offsetX}px)`,
      y: `calc(${y}% + ${offsetY}px)`,
      angle
    });
  }
  
  return handles;
}

// Polygon handles - at vertices and optionally midpoints
function getPolygonHandles(sides: number, includeMidpoints: boolean = true): HandlePosition[] {
  const handles: HandlePosition[] = [];
  const angleOffset = sides === 6 ? 0 : -90; // Hexagon starts flat, others point up
  const angleStep = 360 / sides;
  
  for (let i = 0; i < sides; i++) {
    const angle = angleOffset + i * angleStep;
    const radians = (angle * Math.PI) / 180;
    
    // Vertex position
    const vx = 50 + 50 * Math.cos(radians);
    const vy = 50 + 50 * Math.sin(radians);
    
    // Calculate pixel offset to place handle center on border
    const vOffsetX = HANDLE_OFFSET * Math.cos(radians);
    const vOffsetY = HANDLE_OFFSET * Math.sin(radians);
    
    handles.push({
      id: `vertex-${i}`,
      position: getPositionFromAngle(angle),
      x: `calc(${vx}% + ${vOffsetX}px)`,
      y: `calc(${vy}% + ${vOffsetY}px)`,
      angle
    });
    
    // Midpoint between this vertex and next
    if (includeMidpoints) {
      const midAngle = angle + angleStep / 2;
      const midRadians = (midAngle * Math.PI) / 180;
      const mx = 50 + 50 * Math.cos(midRadians);
      const my = 50 + 50 * Math.sin(midRadians);
      
      // Calculate pixel offset for midpoint
      const mOffsetX = HANDLE_OFFSET * Math.cos(midRadians);
      const mOffsetY = HANDLE_OFFSET * Math.sin(midRadians);
      
      handles.push({
        id: `mid-${i}`,
        position: getPositionFromAngle(midAngle),
        x: `calc(${mx}% + ${mOffsetX}px)`,
        y: `calc(${my}% + ${mOffsetY}px)`,
        angle: midAngle
      });
    }
  }
  
  return handles;
}

// Triangle handles - 3 vertices + 3 midpoints
function getTriangleHandles(): HandlePosition[] {
  const handles: HandlePosition[] = [];
  
  // Top vertex with offset
  handles.push({
    id: 'top',
    position: Position.Top,
    x: '50%',
    y: `calc(0% - ${HANDLE_OFFSET}px)`
  });
  
  // Bottom left vertex - need to calculate angle for proper offset
  const bottomLeftAngle = 225; // degrees
  const blRadians = (bottomLeftAngle * Math.PI) / 180;
  handles.push({
    id: 'bottom-left',
    position: Position.Left,
    x: `calc(0% + ${HANDLE_OFFSET * Math.cos(blRadians)}px)`,
    y: `calc(100% + ${HANDLE_OFFSET * Math.sin(blRadians)}px)`
  });
  
  // Bottom right vertex
  const bottomRightAngle = -45; // degrees
  const brRadians = (bottomRightAngle * Math.PI) / 180;
  handles.push({
    id: 'bottom-right',
    position: Position.Right,
    x: `calc(100% + ${HANDLE_OFFSET * Math.cos(brRadians)}px)`,
    y: `calc(100% + ${HANDLE_OFFSET * Math.sin(brRadians)}px)`
  });
  
  // Left midpoint - on the slanted edge
  const leftMidAngle = 247.5; // perpendicular to left edge
  const lmRadians = (leftMidAngle * Math.PI) / 180;
  handles.push({
    id: 'left-mid',
    position: Position.Left,
    x: `calc(25% + ${HANDLE_OFFSET * Math.cos(lmRadians)}px)`,
    y: `calc(50% + ${HANDLE_OFFSET * Math.sin(lmRadians)}px)`
  });
  
  // Right midpoint - on the slanted edge
  const rightMidAngle = -67.5; // perpendicular to right edge
  const rmRadians = (rightMidAngle * Math.PI) / 180;
  handles.push({
    id: 'right-mid',
    position: Position.Right,
    x: `calc(75% + ${HANDLE_OFFSET * Math.cos(rmRadians)}px)`,
    y: `calc(50% + ${HANDLE_OFFSET * Math.sin(rmRadians)}px)`
  });
  
  handles.push({
    id: 'bottom-mid',
    position: Position.Bottom,
    x: '50%',
    y: `calc(100% + ${HANDLE_OFFSET}px)`
  });
  
  return handles;
}

// Diamond handles - 4 vertices + optional midpoints
function getDiamondHandles(): HandlePosition[] {
  const handles: HandlePosition[] = [];
  
  // Vertices with proper offsets
  handles.push({ id: 'top', position: Position.Top, x: '50%', y: `calc(0% - ${HANDLE_OFFSET}px)` });
  handles.push({ id: 'right', position: Position.Right, x: `calc(100% + ${HANDLE_OFFSET}px)`, y: '50%' });
  handles.push({ id: 'bottom', position: Position.Bottom, x: '50%', y: `calc(100% + ${HANDLE_OFFSET}px)` });
  handles.push({ id: 'left', position: Position.Left, x: `calc(0% - ${HANDLE_OFFSET}px)`, y: '50%' });
  
  // Midpoints on the diamond edges with angled offsets
  const sqrt2 = Math.sqrt(2) / 2;
  const offset45 = HANDLE_OFFSET * sqrt2;
  
  handles.push({ id: 'top-right', position: Position.Right, x: `calc(75% + ${offset45}px)`, y: `calc(25% - ${offset45}px)` });
  handles.push({ id: 'bottom-right', position: Position.Right, x: `calc(75% + ${offset45}px)`, y: `calc(75% + ${offset45}px)` });
  handles.push({ id: 'bottom-left', position: Position.Left, x: `calc(25% - ${offset45}px)`, y: `calc(75% + ${offset45}px)` });
  handles.push({ id: 'top-left', position: Position.Left, x: `calc(25% - ${offset45}px)`, y: `calc(25% - ${offset45}px)` });
  
  return handles;
}

// Ellipse handles - similar to circle but adjusted for elliptical shape
function getEllipseHandles(count: number = 8): HandlePosition[] {
  return getCircleHandles(count); // For now, same as circle
}

// Star handles - at points and inner vertices
function getStarHandles(): HandlePosition[] {
  const handles: HandlePosition[] = [];
  const points = 5;
  const angleStep = 360 / (points * 2);
  
  for (let i = 0; i < points * 2; i++) {
    const angle = -90 + i * angleStep; // Start at top
    const radians = (angle * Math.PI) / 180;
    const radius = i % 2 === 0 ? 50 : 25; // Alternate between outer and inner
    
    const x = 50 + radius * Math.cos(radians);
    const y = 50 + radius * Math.sin(radians);
    
    // Calculate pixel offset to place handle center on border
    const offsetX = HANDLE_OFFSET * Math.cos(radians);
    const offsetY = HANDLE_OFFSET * Math.sin(radians);
    
    handles.push({
      id: `star-${i}`,
      position: getPositionFromAngle(angle),
      x: `calc(${x}% + ${offsetX}px)`,
      y: `calc(${y}% + ${offsetY}px)`,
      angle
    });
  }
  
  return handles;
}

// Shield handles
function getShieldHandles(): HandlePosition[] {
  return [
    { id: 'top-left', position: Position.Top, x: '20%', y: '0%' },
    { id: 'top-center', position: Position.Top, x: '50%', y: '0%' },
    { id: 'top-right', position: Position.Top, x: '80%', y: '0%' },
    { id: 'right-top', position: Position.Right, x: '100%', y: '25%' },
    { id: 'right-bottom', position: Position.Right, x: '100%', y: '60%' },
    { id: 'bottom', position: Position.Bottom, x: '50%', y: '100%' },
    { id: 'left-bottom', position: Position.Left, x: '0%', y: '60%' },
    { id: 'left-top', position: Position.Left, x: '0%', y: '25%' }
  ];
}

// Cloud handles - distributed around the bumpy perimeter
function getCloudHandles(): HandlePosition[] {
  return [
    { id: 'top-left', position: Position.Top, x: '25%', y: '10%' },
    { id: 'top-center', position: Position.Top, x: '50%', y: '0%' },
    { id: 'top-right', position: Position.Top, x: '75%', y: '10%' },
    { id: 'right', position: Position.Right, x: '90%', y: '50%' },
    { id: 'bottom-right', position: Position.Bottom, x: '75%', y: '90%' },
    { id: 'bottom-center', position: Position.Bottom, x: '50%', y: '100%' },
    { id: 'bottom-left', position: Position.Bottom, x: '25%', y: '90%' },
    { id: 'left', position: Position.Left, x: '10%', y: '50%' }
  ];
}

// Cylinder handles
function getCylinderHandles(): HandlePosition[] {
  return [
    { id: 'top-left', position: Position.Top, x: '20%', y: '15%' },
    { id: 'top-center', position: Position.Top, x: '50%', y: '10%' },
    { id: 'top-right', position: Position.Top, x: '80%', y: '15%' },
    { id: 'right', position: Position.Right, x: '100%', y: '50%' },
    { id: 'bottom-right', position: Position.Bottom, x: '80%', y: '85%' },
    { id: 'bottom-center', position: Position.Bottom, x: '50%', y: '90%' },
    { id: 'bottom-left', position: Position.Bottom, x: '20%', y: '85%' },
    { id: 'left', position: Position.Left, x: '0%', y: '50%' }
  ];
}

// Trapezoid handles
function getTrapezoidHandles(): HandlePosition[] {
  return [
    { id: 'top-left', position: Position.Top, x: '30%', y: '0%' },
    { id: 'top-right', position: Position.Top, x: '70%', y: '0%' },
    { id: 'right-top', position: Position.Right, x: '85%', y: '25%' },
    { id: 'right-bottom', position: Position.Right, x: '100%', y: '75%' },
    { id: 'bottom-right', position: Position.Bottom, x: '85%', y: '100%' },
    { id: 'bottom-left', position: Position.Bottom, x: '15%', y: '100%' },
    { id: 'left-bottom', position: Position.Left, x: '0%', y: '75%' },
    { id: 'left-top', position: Position.Left, x: '15%', y: '25%' }
  ];
}

// Parallelogram handles
function getParallelogramHandles(): HandlePosition[] {
  return [
    { id: 'top-left', position: Position.Top, x: '20%', y: '0%' },
    { id: 'top-right', position: Position.Top, x: '80%', y: '0%' },
    { id: 'right-top', position: Position.Right, x: '100%', y: '20%' },
    { id: 'right-bottom', position: Position.Right, x: '100%', y: '80%' },
    { id: 'bottom-right', position: Position.Bottom, x: '80%', y: '100%' },
    { id: 'bottom-left', position: Position.Bottom, x: '20%', y: '100%' },
    { id: 'left-bottom', position: Position.Left, x: '0%', y: '80%' },
    { id: 'left-top', position: Position.Left, x: '0%', y: '20%' }
  ];
}

// Capsule handles
function getCapsuleHandles(): HandlePosition[] {
  const handles: HandlePosition[] = [];
  
  // Rounded ends
  for (let i = 0; i < 3; i++) {
    const angle = -90 + i * 60; // Top arc
    const radians = (angle * Math.PI) / 180;
    const y = 25 + 25 * Math.sin(radians);
    const x = i === 1 ? 50 : (i === 0 ? 15 : 85);
    
    handles.push({
      id: `top-${i}`,
      position: Position.Top,
      x: `${x}%`,
      y: `${y}%`
    });
  }
  
  // Sides
  handles.push(
    { id: 'right', position: Position.Right, x: '100%', y: '50%' },
    { id: 'left', position: Position.Left, x: '0%', y: '50%' }
  );
  
  // Bottom arc
  for (let i = 0; i < 3; i++) {
    const angle = 90 + i * 60; // Bottom arc
    const radians = (angle * Math.PI) / 180;
    const y = 75 + 25 * Math.sin(radians);
    const x = i === 1 ? 50 : (i === 0 ? 15 : 85);
    
    handles.push({
      id: `bottom-${i}`,
      position: Position.Bottom,
      x: `${x}%`,
      y: `${y}%`
    });
  }
  
  return handles;
}

// Arrow handles
function getArrowHandles(shape: NodeShape): HandlePosition[] {
  const baseHandles = getRectangleHandles();
  
  // Adjust based on arrow direction
  if (shape === 'arrow-horizontal') {
    // Add handles at arrow points
    baseHandles.push(
      { id: 'arrow-left', position: Position.Left, x: '0%', y: '50%' },
      { id: 'arrow-right', position: Position.Right, x: '100%', y: '50%' }
    );
  } else if (shape === 'arrow-vertical') {
    baseHandles.push(
      { id: 'arrow-top', position: Position.Top, x: '50%', y: '0%' },
      { id: 'arrow-bottom', position: Position.Bottom, x: '50%', y: '100%' }
    );
  }
  
  return baseHandles;
}

// House handles
function getHouseHandles(): HandlePosition[] {
  return [
    // Roof peak
    { id: 'roof-top', position: Position.Top, x: '50%', y: '0%' },
    // Roof edges
    { id: 'roof-left', position: Position.Left, x: '15%', y: '30%' },
    { id: 'roof-right', position: Position.Right, x: '85%', y: '30%' },
    // Wall corners
    { id: 'wall-right', position: Position.Right, x: '100%', y: '65%' },
    { id: 'wall-bottom-right', position: Position.Bottom, x: '85%', y: '100%' },
    { id: 'wall-bottom-left', position: Position.Bottom, x: '15%', y: '100%' },
    { id: 'wall-left', position: Position.Left, x: '0%', y: '65%' }
  ];
}

// Factory handles
function getFactoryHandles(): HandlePosition[] {
  return [
    // Chimneys
    { id: 'chimney-1', position: Position.Top, x: '20%', y: '0%' },
    { id: 'chimney-2', position: Position.Top, x: '50%', y: '5%' },
    { id: 'chimney-3', position: Position.Top, x: '80%', y: '0%' },
    // Building sides
    { id: 'right', position: Position.Right, x: '100%', y: '60%' },
    { id: 'bottom-right', position: Position.Bottom, x: '85%', y: '100%' },
    { id: 'bottom-left', position: Position.Bottom, x: '15%', y: '100%' },
    { id: 'left', position: Position.Left, x: '0%', y: '60%' }
  ];
}

// Cross/Plus handles
function getCrossHandles(): HandlePosition[] {
  return [
    // Arms of the cross
    { id: 'top', position: Position.Top, x: '50%', y: '0%' },
    { id: 'right', position: Position.Right, x: '100%', y: '50%' },
    { id: 'bottom', position: Position.Bottom, x: '50%', y: '100%' },
    { id: 'left', position: Position.Left, x: '0%', y: '50%' },
    // Inner corners
    { id: 'inner-tr', position: Position.Top, x: '67%', y: '33%' },
    { id: 'inner-br', position: Position.Right, x: '67%', y: '67%' },
    { id: 'inner-bl', position: Position.Bottom, x: '33%', y: '67%' },
    { id: 'inner-tl', position: Position.Left, x: '33%', y: '33%' }
  ];
}