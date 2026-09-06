import type { Node, XYPosition } from '@xyflow/react';
import { Position } from '@xyflow/react';
import { getShapeBoundingBox } from '../../utils/shapeBoundingBox';
import { NodeShape } from '../../types/ShapeTypes';

type PositionedNode = Node & { internals?: { positionAbsolute: XYPosition } };

// ReactFlow resolves parent transforms and node origins in its internal coordinates.
export function edgeNodePosition(node: PositionedNode): XYPosition {
  return node.internals?.positionAbsolute ?? node.position;
}

// Returns the position (top, right, bottom, or left) where the edge connects to the node
export function getEdgePosition(node: PositionedNode, intersectionPoint: XYPosition): Position {
  const position = edgeNodePosition(node);
  const nx = Math.round(position.x);
  const ny = Math.round(position.y);
  const px = Math.round(intersectionPoint.x);
  const py = Math.round(intersectionPoint.y);
  
  const width = node.measured?.width ?? node.width ?? 100;
  const height = node.measured?.height ?? node.height ?? 100;

  if (px <= nx + 1) {
    return Position.Left;
  }
  if (px >= nx + width - 1) {
    return Position.Right;
  }
  if (py <= ny + 1) {
    return Position.Top;
  }
  if (py >= ny + height - 1) {
    return Position.Bottom;
  }

  // Fallback: choose side based on the direction from node center to intersection
  const centerX = nx + width / 2;
  const centerY = ny + height / 2;
  const dx = px - centerX;
  const dy = py - centerY;
  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx >= 0 ? Position.Right : Position.Left;
  }
  return dy >= 0 ? Position.Bottom : Position.Top;
}

// Returns the parameters (sx, sy, tx, ty, sourcePos, targetPos) for the edge path calculation
export function getEdgeParams(source: PositionedNode, target: PositionedNode) {
  const sourceIntersectionPoint = getNodeIntersection(source, target);
  const targetIntersectionPoint = getNodeIntersection(target, source);

  const sourcePos = getEdgePosition(source, sourceIntersectionPoint);
  const targetPos = getEdgePosition(target, targetIntersectionPoint);

  return {
    sx: sourceIntersectionPoint.x,
    sy: sourceIntersectionPoint.y,
    tx: targetIntersectionPoint.x,
    ty: targetIntersectionPoint.y,
    sourcePos,
    targetPos,
  };
}

// Returns the intersection point between the node and the line from the node center to the target
export function getNodeIntersection(intersectionNode: PositionedNode, targetNode: PositionedNode): XYPosition {
  // Get node dimensions from measured or fallback
  const sourceWidth = intersectionNode.measured?.width ?? intersectionNode.width ?? 100;
  const sourceHeight = intersectionNode.measured?.height ?? intersectionNode.height ?? 100;
  const targetWidth = targetNode.measured?.width ?? targetNode.width ?? 100;
  const targetHeight = targetNode.measured?.height ?? targetNode.height ?? 100;
  
  // Get the shape type from node data
  const nodeShape = (intersectionNode.data?.shape as NodeShape) || 'rounded-rectangle';
  
  // Get the shape bounding box
  const boundingBox = getShapeBoundingBox(nodeShape, sourceWidth, sourceHeight);
  const sourcePosition = edgeNodePosition(intersectionNode);
  const targetPosition = edgeNodePosition(targetNode);
  
  // Calculate the center points of both nodes
  const sourceCenter = {
    x: sourcePosition.x + sourceWidth / 2,
    y: sourcePosition.y + sourceHeight / 2,
  };
  
  const targetCenter = {
    x: targetPosition.x + targetWidth / 2,
    y: targetPosition.y + targetHeight / 2,
  };

  // Calculate the angle from source to target
  const dx = targetCenter.x - sourceCenter.x;
  const dy = targetCenter.y - sourceCenter.y;

  // If nodes are at the same position, default to right side
  if (dx === 0 && dy === 0) {
    return { x: sourceCenter.x + sourceWidth / 2 - boundingBox.rightOffset, y: sourceCenter.y };
  }

  // Calculate the intersection point using parametric line equation
  const angle = Math.atan2(dy, dx);
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const abs_cos = Math.abs(cos);
  const abs_sin = Math.abs(sin);

  // Calculate effective dimensions considering shape offsets
  const effectiveHalfWidth = (sourceWidth - boundingBox.leftOffset - boundingBox.rightOffset) / 2;
  const effectiveHalfHeight = (sourceHeight - boundingBox.topOffset - boundingBox.bottomOffset) / 2;

  let intersection: XYPosition;

  // Special handling for specific shapes
  if (nodeShape === 'circle' || nodeShape === 'ellipse') {
    // For circular/elliptical shapes, calculate intersection with ellipse equation
    const a = effectiveHalfWidth;
    const b = effectiveHalfHeight;
    
    // Parametric form: x = a*cos(t), y = b*sin(t)
    // Find t where the line from center intersects the ellipse
    const t = Math.atan2(a * sin, b * cos);
    
    intersection = {
      x: sourceCenter.x + a * Math.cos(t),
      y: sourceCenter.y + b * Math.sin(t),
    };
  } else if (nodeShape === 'diamond') {
    // For diamond shape, calculate intersection with diamond edges
    const halfWidth = sourceWidth / 2;
    const halfHeight = sourceHeight / 2;
    
    // Diamond has vertices at center of each edge
    if (abs_cos * halfHeight <= abs_sin * halfWidth) {
      // Intersects with top/bottom edge
      const y = sin > 0 ? halfHeight : -halfHeight;
      const x = y * dx / dy;
      intersection = {
        x: sourceCenter.x + x,
        y: sourceCenter.y + y,
      };
    } else {
      // Intersects with left/right edge
      const x = cos > 0 ? halfWidth : -halfWidth;
      const y = x * dy / dx;
      intersection = {
        x: sourceCenter.x + x,
        y: sourceCenter.y + y,
      };
    }
  } else {
    // For other shapes, use the bounding box adjusted rectangle
    const halfWidth = effectiveHalfWidth;
    const halfHeight = effectiveHalfHeight;
    
    // Determine which edge of the rectangle the line intersects with
    if (halfWidth * abs_sin <= halfHeight * abs_cos) {
      // Intersects with left or right edge
      const x = cos > 0 ? halfWidth : -halfWidth;
      // Apply offset based on direction
      const xOffset = cos > 0 ? boundingBox.rightOffset : -boundingBox.leftOffset;
      intersection = {
        x: sourceCenter.x + x + xOffset,
        y: sourceCenter.y + x * Math.tan(angle),
      };
    } else {
      // Intersects with top or bottom edge
      const y = sin > 0 ? halfHeight : -halfHeight;
      // Apply offset based on direction
      const yOffset = sin > 0 ? boundingBox.bottomOffset : -boundingBox.topOffset;
      intersection = {
        x: sourceCenter.x + y / Math.tan(angle),
        y: sourceCenter.y + y + yOffset,
      };
    }
  }

  const isIconOnlyNode = sourceWidth <= 60 && sourceHeight <= 60;
  if (isIconOnlyNode) {
    const padding = 6;
    const vecX = intersection.x - sourceCenter.x;
    const vecY = intersection.y - sourceCenter.y;
    const len = Math.hypot(vecX, vecY) || 1;
    intersection = {
      x: intersection.x + (vecX / len) * padding,
      y: intersection.y + (vecY / len) * padding
    };
  }

  return intersection;
}

// Get the intersection considering control points for curved edges
export function getNodeIntersectionWithControlPoints(
  node: PositionedNode,
  targetNode: PositionedNode,
  controlPoints: XYPosition[] = []
): XYPosition {
  // If there are control points, use the first control point to determine direction
  // Otherwise use the target node directly
  if (controlPoints.length > 0) {
    // Use first control point for direction
    const directionPoint = controlPoints[0];
    
    // Create a dummy node for the direction point
    const dummyNode: Node = {
      id: 'dummy',
      type: 'default',
      position: { x: directionPoint.x - 0.5, y: directionPoint.y - 0.5 },
      data: {},
      width: 1,
      height: 1,
      measured: { width: 1, height: 1 }
    };
    
    return getNodeIntersection(node, dummyNode);
  }
  
  // No control points, use direct line to target node
  return getNodeIntersection(node, targetNode);
}
