import getStroke from 'perfect-freehand';
import type { Points } from '../types/DrawingTypes';

export const pathOptions = {
  size: 7,
  thinning: 0.5,
  smoothing: 0.5,
  streamline: 0.5,
  easing: (t: number) => t,
  start: {
    taper: 0,
    easing: (t: number) => t,
    cap: true,
  },
  end: {
    taper: 0.1,
    easing: (t: number) => t,
    cap: true,
  },
};

export function getSvgPathFromStroke(stroke: number[][]) {
  if (!stroke.length) return '';

  const d = stroke.reduce(
    (acc, [x0, y0], i, arr) => {
      const [x1, y1] = arr[(i + 1) % arr.length];
      acc.push(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2);
      return acc;
    },
    ['M', ...stroke[0], 'Q']
  );

  d.push('Z');
  return d.join(' ');
}

export function pointsToPath(points: Points, zoom = 1) {
  const stroke = getStroke(points, {
    ...pathOptions,
    size: pathOptions.size * zoom,
  });
  return getSvgPathFromStroke(stroke);
}

// Simple path for stroked lines (not filled)
export function pointsToSimplePath(points: Points): string {
  if (points.length < 2) return '';
  
  // Create a simple path that connects all points with curves
  let path = `M ${points[0][0]} ${points[0][1]}`;
  
  if (points.length === 2) {
    // Just a line between two points
    path += ` L ${points[1][0]} ${points[1][1]}`;
  } else {
    // Use quadratic curves for smooth line
    for (let i = 1; i < points.length - 1; i++) {
      const xc = (points[i][0] + points[i + 1][0]) / 2;
      const yc = (points[i][1] + points[i + 1][1]) / 2;
      path += ` Q ${points[i][0]},${points[i][1]} ${xc},${yc}`;
    }
    // Last point
    path += ` T ${points[points.length - 1][0]},${points[points.length - 1][1]}`;
  }
  
  return path;
}

export function getDrawingBounds(points: Points): { x: number; y: number; width: number; height: number } {
  if (points.length === 0) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const [x, y] of points) {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }

  // Add padding for stroke width
  const padding = pathOptions.size;
  return {
    x: minX - padding,
    y: minY - padding,
    width: maxX - minX + padding * 2,
    height: maxY - minY + padding * 2,
  };
}