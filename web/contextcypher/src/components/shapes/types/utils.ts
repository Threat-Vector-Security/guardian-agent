// Utility functions for shape path generation

// Generate SVG path from array of points
export function generatePath(points: number[][]): string {
  if (points.length === 0) return '';
  
  const path = points.map(([x, y], index) => 
    index === 0 ? `M${x},${y}` : `L${x},${y}`
  ).join(' ');
  
  return `${path} Z`;
}

// Generate smooth path with curves
export function generateSmoothPath(points: number[][], tension = 0.3): string {
  if (points.length < 3) return generatePath(points);
  
  let path = `M${points[0][0]},${points[0][1]}`;
  
  for (let i = 1; i < points.length - 1; i++) {
    const p0 = points[i - 1];
    const p1 = points[i];
    const p2 = points[i + 1];
    
    const cp1x = p1[0] - (p2[0] - p0[0]) * tension;
    const cp1y = p1[1] - (p2[1] - p0[1]) * tension;
    const cp2x = p1[0] + (p2[0] - p0[0]) * tension;
    const cp2y = p1[1] + (p2[1] - p0[1]) * tension;
    
    path += ` C${cp1x},${cp1y} ${cp2x},${cp2y} ${p1[0]},${p1[1]}`;
  }
  
  // Last point
  path += ` L${points[points.length - 1][0]},${points[points.length - 1][1]} Z`;
  
  return path;
}

// Calculate points for regular polygon
export function getPolygonPoints(
  cx: number,
  cy: number,
  radius: number,
  sides: number,
  startAngle: number = -Math.PI / 2
): number[][] {
  const points: number[][] = [];
  const angleStep = (2 * Math.PI) / sides;
  
  for (let i = 0; i < sides; i++) {
    const angle = startAngle + i * angleStep;
    const x = cx + radius * Math.cos(angle);
    const y = cy + radius * Math.sin(angle);
    points.push([x, y]);
  }
  
  return points;
}

// Calculate star points
export function getStarPoints(
  cx: number,
  cy: number,
  outerRadius: number,
  innerRadius: number,
  points: number = 5,
  startAngle: number = -Math.PI / 2
): number[][] {
  const result: number[][] = [];
  const angleStep = Math.PI / points;
  
  for (let i = 0; i < points * 2; i++) {
    const angle = startAngle + i * angleStep;
    const radius = i % 2 === 0 ? outerRadius : innerRadius;
    const x = cx + radius * Math.cos(angle);
    const y = cy + radius * Math.sin(angle);
    result.push([x, y]);
  }
  
  return result;
}

// Clamp value between min and max
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}