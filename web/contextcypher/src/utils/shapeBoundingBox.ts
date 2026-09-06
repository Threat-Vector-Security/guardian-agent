/**
 * Calculate the bounding box dimensions for different shapes
 * This ensures the node's clickable area matches the visible shape
 */

import { NodeShape } from '../types/ShapeTypes';

interface BoundingBox {
  width: number;
  height: number;
  // Offsets from the standard box for handle positioning
  topOffset: number;
  rightOffset: number;
  bottomOffset: number;
  leftOffset: number;
}

/**
 * Calculate the bounding box that tightly fits around each shape
 * @param shape The shape type
 * @param baseWidth The base width for the shape
 * @param baseHeight The base height for the shape
 * @returns The adjusted bounding box dimensions and offsets
 */
export function getShapeBoundingBox(
  shape: NodeShape,
  baseWidth: number,
  baseHeight: number
): BoundingBox {
  // Most shapes use the full bounding box
  const defaultBox: BoundingBox = {
    width: baseWidth,
    height: baseHeight,
    topOffset: 0,
    rightOffset: 0,
    bottomOffset: 0,
    leftOffset: 0
  };

  switch (shape) {
    case 'circle': {
      // Circle needs a square bounding box
      const diameter = Math.min(baseWidth, baseHeight);
      return {
        width: diameter,
        height: diameter,
        topOffset: 0,
        rightOffset: 0,
        bottomOffset: 0,
        leftOffset: 0
      };
    }

    case 'ellipse': {
      // Ellipse uses full dimensions but handles are on the curve
      return defaultBox;
    }

    case 'diamond': {
      // Diamond fits in the box, handles at vertices
      return defaultBox;
    }

    case 'triangle': {
      // Triangle needs full height but could have narrower width
      // Keep full dimensions for stability
      return defaultBox;
    }

    case 'hexagon': {
      // Hexagon has flat sides on left/right
      // The actual shape is narrower than the bounding box
      return {
        ...defaultBox,
        leftOffset: baseWidth * 0.15,
        rightOffset: baseWidth * 0.15
      };
    }

    case 'octagon': {
      // Octagon has cut corners creating gaps on sides
      // Reduce width to fit the shape better
      return {
        width: baseWidth * 0.85,
        height: baseHeight,
        topOffset: 0,
        rightOffset: 0,
        bottomOffset: 0,
        leftOffset: 0
      };
    }

    case 'star': {
      // Star has 5 points - we need to reduce both dimensions equally to maintain aspect ratio
      // The star shape has gaps between points on all sides
      const reductionFactor = 0.85; // Uniform reduction to maintain aspect ratio
      return {
        width: baseWidth * reductionFactor,
        height: baseHeight * reductionFactor,
        topOffset: 0,
        rightOffset: 0,
        bottomOffset: 0,
        leftOffset: 0
      };
    }

    case 'shield': {
      // Shield shape is generally contained within bounds
      return defaultBox;
    }

    case 'cloud': {
      // Cloud has irregular edges
      return defaultBox;
    }

    case 'cylinder': {
      // Cylinder has straight sides
      return defaultBox;
    }

    case 'house': {
      // House has peaked roof
      return defaultBox;
    }

    case 'pentagon': {
      // Pentagon has angled sides that create gaps on left/right
      // Reduce width to fit the actual shape better
      return {
        width: baseWidth * 0.85,
        height: baseHeight,
        topOffset: 0,
        rightOffset: 0,
        bottomOffset: 0,
        leftOffset: 0
      };
    }

    case 'plus':
    case 'cross': {
      // Cross shapes need square bounds
      const size = Math.min(baseWidth, baseHeight);
      return {
        width: size,
        height: size,
        topOffset: 0,
        rightOffset: 0,
        bottomOffset: 0,
        leftOffset: 0
      };
    }

    // All other shapes use default box
    default:
      return defaultBox;
  }
}

/**
 * Get the visual bounds of a shape (where the actual shape pixels are)
 * This is different from the bounding box and represents the actual drawn area
 */
export function getShapeVisualBounds(
  shape: NodeShape,
  width: number,
  height: number
): { x: number; y: number; width: number; height: number } {
  switch (shape) {
    case 'circle': {
      const diameter = Math.min(width, height);
      const x = (width - diameter) / 2;
      const y = (height - diameter) / 2;
      return { x, y, width: diameter, height: diameter };
    }

    case 'hexagon': {
      // Hexagon is narrower due to angled sides
      const visualWidth = width * 0.7;
      const x = (width - visualWidth) / 2;
      return { x, y: 0, width: visualWidth, height };
    }

    case 'triangle': {
      // Triangle has a point at top, base at bottom
      return { x: 0, y: 0, width, height };
    }

    default:
      return { x: 0, y: 0, width, height };
  }
}