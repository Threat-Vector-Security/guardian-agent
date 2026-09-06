// src/utils/drawingMetadata.ts

import { Drawing, Point } from '../types/AnalysisTypes';
import { SecurityNode, SecurityEdge } from '../types/SecurityTypes';

/**
 * Calculate bounds from a path string (SVG path)
 */
export function calculateBoundsFromPath(path: string): Drawing['bounds'] {
  // Parse SVG path to get all points
  const points: Point[] = [];
  const commands = path.match(/[MLCQZmlcqz][^MLCQZmlcqz]*/g) || [];
  
  let currentX = 0;
  let currentY = 0;
  
  commands.forEach(cmd => {
    const type = cmd[0];
    const coords = cmd.slice(1).trim().split(/[\s,]+/).map(Number);
    
    switch (type) {
      case 'M': // Move to absolute
      case 'L': // Line to absolute
        currentX = coords[0];
        currentY = coords[1];
        points.push({ x: currentX, y: currentY });
        break;
      case 'm': // Move to relative
      case 'l': // Line to relative
        currentX += coords[0];
        currentY += coords[1];
        points.push({ x: currentX, y: currentY });
        break;
      // Add more path commands as needed
    }
  });
  
  if (points.length === 0) return undefined;
  
  const xs = points.map(p => p.x);
  const ys = points.map(p => p.y);
  
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  
  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX,
    height: maxY - minY
  };
}

/**
 * Calculate bounds for shape-based drawings
 */
export function calculateBoundsFromShape(
  type: 'rectangle' | 'circle',
  startPoint: Point,
  endPoint: Point
): Drawing['bounds'] {
  const minX = Math.min(startPoint.x, endPoint.x);
  const maxX = Math.max(startPoint.x, endPoint.x);
  const minY = Math.min(startPoint.y, endPoint.y);
  const maxY = Math.max(startPoint.y, endPoint.y);
  
  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX,
    height: maxY - minY
  };
}

/**
 * Calculate distance between two points
 */
function distance(p1: Point, p2: Point): number {
  return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
}

/**
 * Calculate minimum distance from a point to a rectangle (node bounds)
 */
function distanceToRectangle(point: Point, rectX: number, rectY: number, rectWidth: number, rectHeight: number): number {
  // Find the closest point on the rectangle to the given point
  const closestX = Math.max(rectX, Math.min(point.x, rectX + rectWidth));
  const closestY = Math.max(rectY, Math.min(point.y, rectY + rectHeight));
  
  // Calculate distance to that closest point
  return distance(point, { x: closestX, y: closestY });
}

/**
 * Get direction from one point to another
 */
type Direction = 'north' | 'south' | 'east' | 'west' | 'northeast' | 'northwest' | 'southeast' | 'southwest' | 'center';

function getDirection(from: Point, to: Point): Direction {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const angle = Math.atan2(dy, dx) * (180 / Math.PI);
  
  // Normalize angle to 0-360
  const normalizedAngle = (angle + 360) % 360;
  
  // Determine direction based on angle
  if (normalizedAngle >= 337.5 || normalizedAngle < 22.5) return 'east';
  if (normalizedAngle >= 22.5 && normalizedAngle < 67.5) return 'southeast';
  if (normalizedAngle >= 67.5 && normalizedAngle < 112.5) return 'south';
  if (normalizedAngle >= 112.5 && normalizedAngle < 157.5) return 'southwest';
  if (normalizedAngle >= 157.5 && normalizedAngle < 202.5) return 'west';
  if (normalizedAngle >= 202.5 && normalizedAngle < 247.5) return 'northwest';
  if (normalizedAngle >= 247.5 && normalizedAngle < 292.5) return 'north';
  if (normalizedAngle >= 292.5 && normalizedAngle < 337.5) return 'northeast';
  
  return 'center';
}


/**
 * Check if bounds overlap with a node
 */
function boundsOverlapNode(bounds: Drawing['bounds'], node: SecurityNode): boolean {
  if (!bounds) return false;
  
  // Different sizes for different node types
  let nodeWidth = 200; // Default node width
  let nodeHeight = 80; // Default node height
  
  if (node.type === 'securityZone') {
    // Security zones can be resized, so we need to check if width/height are stored
    nodeWidth = node.measured?.width || node.width || 400;
    nodeHeight = node.measured?.height || node.height || 300;
  }
  
  return !(bounds.maxX < node.position.x ||
           bounds.minX > node.position.x + nodeWidth ||
           bounds.maxY < node.position.y ||
           bounds.minY > node.position.y + nodeHeight);
}

/**
 * Calculate distance from a point to a line segment (for edge distance)
 */
function distanceToLineSegment(point: Point, lineStart: Point, lineEnd: Point): number {
  const A = point.x - lineStart.x;
  const B = point.y - lineStart.y;
  const C = lineEnd.x - lineStart.x;
  const D = lineEnd.y - lineStart.y;

  const dot = A * C + B * D;
  const lenSq = C * C + D * D;
  let param = -1;
  
  if (lenSq !== 0) {
    param = dot / lenSq;
  }

  let xx, yy;

  if (param < 0) {
    xx = lineStart.x;
    yy = lineStart.y;
  } else if (param > 1) {
    xx = lineEnd.x;
    yy = lineEnd.y;
  } else {
    xx = lineStart.x + param * C;
    yy = lineStart.y + param * D;
  }

  const dx = point.x - xx;
  const dy = point.y - yy;
  
  return Math.sqrt(dx * dx + dy * dy);
}


/**
 * Check if a node is contained within a circle
 */
function isNodeInCircle(node: SecurityNode, circleCenter: Point, radius: number): boolean {
  const nodeCenter = {
    x: node.position.x + 100, // Assuming default node width/2
    y: node.position.y + 40   // Assuming default node height/2
  };
  const distance = Math.sqrt(
    Math.pow(nodeCenter.x - circleCenter.x, 2) + 
    Math.pow(nodeCenter.y - circleCenter.y, 2)
  );
  return distance <= radius;
}

/**
 * Check if a node is contained within a rectangle
 */
function isNodeInRectangle(node: SecurityNode, rectBounds: { minX: number, minY: number, maxX: number, maxY: number }): boolean {
  const nodeCenter = {
    x: node.position.x + 100, // Assuming default node width/2
    y: node.position.y + 40   // Assuming default node height/2
  };
  return nodeCenter.x >= rectBounds.minX && 
         nodeCenter.x <= rectBounds.maxX && 
         nodeCenter.y >= rectBounds.minY && 
         nodeCenter.y <= rectBounds.maxY;
}

/**
 * Extract arrow endpoints from path
 */
function extractArrowEndpoints(path: string): { start: Point, end: Point } | null {
  // Arrow paths are in format "M startX,startY L endX,endY L ..." (with arrowhead points)
  const moveMatch = path.match(/M\s*([\d.-]+)[,\s]+([\d.-]+)/);
  const lineMatch = path.match(/L\s*([\d.-]+)[,\s]+([\d.-]+)/);
  
  if (moveMatch && lineMatch) {
    return {
      start: { x: parseFloat(moveMatch[1]), y: parseFloat(moveMatch[2]) },
      end: { x: parseFloat(lineMatch[1]), y: parseFloat(lineMatch[2]) }
    };
  }
  
  return null;
}

/**
 * Detect if a line/arrow connects two specific nodes
 * Enhanced to better handle horizontal arrows and node alignment
 */
function detectLineConnections(drawing: Drawing, nodes: SecurityNode[]): { sourceNode?: SecurityNode, targetNode?: SecurityNode } {
  if (drawing.type !== 'arrow' && drawing.type !== 'pencil') {
    return {};
  }

  if (!drawing.path) return {};

  let startPoint: Point | null = null;
  let endPoint: Point | null = null;

  if (drawing.type === 'arrow') {
    // Extract actual arrow endpoints from path
    const endpoints = extractArrowEndpoints(drawing.path);
    if (endpoints) {
      startPoint = endpoints.start;
      endPoint = endpoints.end;
    }
  } else if (drawing.bounds) {
    // For pencil/freehand, use bounds
    startPoint = { x: drawing.bounds.minX, y: drawing.bounds.minY };
    endPoint = { x: drawing.bounds.maxX, y: drawing.bounds.maxY };
  }

  if (!startPoint || !endPoint) return {};
  
  // Standard node dimensions (all nodes same size)
  const nodeWidth = 200;
  const nodeHeight = 80;
  
  // Filter out security zones
  const eligibleNodes = nodes.filter(node => node.type !== 'securityZone');
  
  // Determine if arrow is primarily horizontal
  const dx = Math.abs(endPoint.x - startPoint.x);
  const dy = Math.abs(endPoint.y - startPoint.y);
  const isHorizontal = dx > dy * 2; // Arrow is horizontal if x-distance is more than 2x y-distance
  
  let sourceNode: SecurityNode | undefined;
  let targetNode: SecurityNode | undefined;
  let minSourceDistance = Infinity;
  let minTargetDistance = Infinity;
  
  // For horizontal arrows, we'll apply stricter Y-axis filtering
  eligibleNodes.forEach(node => {
    const nodeCenter = {
      x: node.position.x + nodeWidth / 2,
      y: node.position.y + nodeHeight / 2
    };
    
    // For horizontal arrows, filter out nodes that are too far vertically
    if (isHorizontal && startPoint && endPoint) {
      const startYDiff = Math.abs(startPoint.y - nodeCenter.y);
      const endYDiff = Math.abs(endPoint.y - nodeCenter.y);
      
      // Skip nodes that are more than half node height away from the arrow Y position
      if (startYDiff > nodeHeight && endYDiff > nodeHeight) {
        return;
      }
    }
    
    // Calculate distance from start point to node
    if (startPoint) {
      const startDist = distanceToRectangle(startPoint, node.position.x, node.position.y, nodeWidth, nodeHeight);
      
      // For horizontal arrows, apply bonus for Y-alignment
      let startScore = startDist;
      if (isHorizontal) {
        const yAlignment = Math.abs(startPoint.y - nodeCenter.y);
        startScore = startDist + (yAlignment * 0.5); // Penalize vertical misalignment
      }
      
      if (startScore < minSourceDistance && startDist < 50) { // Within 50px of node edge
        minSourceDistance = startScore;
        sourceNode = node;
      }
    }
    
    // Calculate distance from end point to node
    if (endPoint) {
      const endDist = distanceToRectangle(endPoint, node.position.x, node.position.y, nodeWidth, nodeHeight);
      
      // For horizontal arrows, apply bonus for Y-alignment
      let endScore = endDist;
      if (isHorizontal) {
        const yAlignment = Math.abs(endPoint.y - nodeCenter.y);
        endScore = endDist + (yAlignment * 0.5); // Penalize vertical misalignment
      }
      
      if (endScore < minTargetDistance && endDist < 50) { // Within 50px of node edge
        minTargetDistance = endScore;
        targetNode = node;
      }
    }
  });
  
  // For horizontal arrows, ensure source is on the left, target on the right
  if (sourceNode && targetNode && isHorizontal) {
    const sourceX = sourceNode.position.x + nodeWidth / 2;
    const targetX = targetNode.position.x + nodeWidth / 2;
    
    // Check arrow direction
    const arrowPointsRight = endPoint.x > startPoint.x;
    
    if (arrowPointsRight) {
      // Arrow points right, source should be on the left
      if (sourceX > targetX) {
        [sourceNode, targetNode] = [targetNode, sourceNode];
      }
    } else {
      // Arrow points left, source should be on the right
      if (sourceX < targetX) {
        [sourceNode, targetNode] = [targetNode, sourceNode];
      }
    }
  }

  return { sourceNode, targetNode };
}

/**
 * Calculate metadata for a drawing including geometric relationships
 */
export function calculateDrawingMetadata(
  drawing: Drawing,
  nodes: SecurityNode[],
  edges?: SecurityEdge[],
  maxNearbyNodes: number = 5,
  maxNearbyEdges: number = 3,
  includeZones: boolean = false
): Partial<Drawing> {
  const metadata: Partial<Drawing> = {
    timestamp: new Date(),
    text: drawing.text // Include text content in metadata
  };
  
  // Calculate bounds if not already present
  if (!drawing.bounds) {
    if (drawing.path) {
      metadata.bounds = calculateBoundsFromPath(drawing.path);
    } else if (drawing.position && drawing.type === 'text') {
      // For text, approximate bounds
      const estimatedWidth = (drawing.text?.length || 0) * 8;
      const estimatedHeight = 20;
      metadata.bounds = {
        minX: drawing.position.x,
        minY: drawing.position.y,
        maxX: drawing.position.x + estimatedWidth,
        maxY: drawing.position.y + estimatedHeight,
        width: estimatedWidth,
        height: estimatedHeight
      };
    }
  } else {
    metadata.bounds = drawing.bounds;
  }
  
  // Calculate center point of drawing
  const drawingCenter: Point = metadata.bounds ? {
    x: (metadata.bounds.minX + metadata.bounds.maxX) / 2,
    y: (metadata.bounds.minY + metadata.bounds.maxY) / 2
  } : drawing.position || { x: 0, y: 0 };
  
  // Detect geometric relationships based on drawing type
  let geometricRelationships: any = {};
  
  if (drawing.type === 'arrow' || drawing.type === 'pencil') {
    // Detect line/arrow connections between nodes
    const connections = detectLineConnections(drawing, nodes);
    
    // Always include connection info for arrows
    geometricRelationships.connectsNodes = {
      source: connections.sourceNode ? {
        id: connections.sourceNode.id,
        label: connections.sourceNode.data.label || connections.sourceNode.id,
        type: connections.sourceNode.type
      } : null,
      target: connections.targetNode ? {
        id: connections.targetNode.id,
        label: connections.targetNode.data.label || connections.targetNode.id,
        type: connections.targetNode.type
      } : null
    };
    
    // For arrows, also find closest nodes/edges to endpoints for context
    if (drawing.type === 'arrow' && drawing.path) {
      const endpoints = extractArrowEndpoints(drawing.path);
      if (endpoints) {
        const eligibleNodes = nodes.filter(node => node.type !== 'securityZone');
        
        // Find closest node to start point (regardless of connection threshold)
        let closestStartNode: SecurityNode | undefined;
        let closestStartDistance = Infinity;
        eligibleNodes.forEach(node => {
          const dist = distanceToRectangle(endpoints.start, node.position.x, node.position.y, 200, 80);
          if (dist < closestStartDistance) {
            closestStartDistance = dist;
            closestStartNode = node;
          }
        });
        
        // Find closest node to end point (regardless of connection threshold)
        let closestEndNode: SecurityNode | undefined;
        let closestEndDistance = Infinity;
        eligibleNodes.forEach(node => {
          const dist = distanceToRectangle(endpoints.end, node.position.x, node.position.y, 200, 80);
          if (dist < closestEndDistance) {
            closestEndDistance = dist;
            closestEndNode = node;
          }
        });
        
        // Find closest edges if available
        let closestStartEdge: SecurityEdge | undefined;
        let closestStartEdgeDistance = Infinity;
        let closestEndEdge: SecurityEdge | undefined;
        let closestEndEdgeDistance = Infinity;
        
        if (edges && edges.length > 0) {
          edges.forEach(edge => {
            const sourceNode = nodes.find(n => n.id === edge.source);
            const targetNode = nodes.find(n => n.id === edge.target);
            
            if (sourceNode && targetNode && sourceNode.type !== 'securityZone' && targetNode.type !== 'securityZone') {
              const sourceCenter = { x: sourceNode.position.x + 100, y: sourceNode.position.y + 40 };
              const targetCenter = { x: targetNode.position.x + 100, y: targetNode.position.y + 40 };
              
              // Distance to start point
              const startDist = distanceToLineSegment(endpoints.start, sourceCenter, targetCenter);
              if (startDist < closestStartEdgeDistance) {
                closestStartEdgeDistance = startDist;
                closestStartEdge = edge;
              }
              
              // Distance to end point
              const endDist = distanceToLineSegment(endpoints.end, sourceCenter, targetCenter);
              if (endDist < closestEndEdgeDistance) {
                closestEndEdgeDistance = endDist;
                closestEndEdge = edge;
              }
            }
          });
        }
        
        // Add arrow context with closest elements
        geometricRelationships.arrowContext = {
          startPoint: {
            closestNode: closestStartNode ? {
              id: closestStartNode.id,
              label: closestStartNode.data.label || closestStartNode.id,
              type: closestStartNode.type,
              distance: Math.round(closestStartDistance)
            } : null,
            closestEdge: closestStartEdge ? {
              id: closestStartEdge.id,
              source: nodes.find(n => n.id === closestStartEdge!.source)?.data.label || closestStartEdge!.source,
              target: nodes.find(n => n.id === closestStartEdge!.target)?.data.label || closestStartEdge!.target,
              distance: Math.round(closestStartEdgeDistance)
            } : null
          },
          endPoint: {
            closestNode: closestEndNode ? {
              id: closestEndNode.id,
              label: closestEndNode.data.label || closestEndNode.id,
              type: closestEndNode.type,
              distance: Math.round(closestEndDistance)
            } : null,
            closestEdge: closestEndEdge ? {
              id: closestEndEdge.id,
              source: nodes.find(n => n.id === closestEndEdge!.source)?.data.label || closestEndEdge!.source,
              target: nodes.find(n => n.id === closestEndEdge!.target)?.data.label || closestEndEdge!.target,
              distance: Math.round(closestEndEdgeDistance)
            } : null
          }
        };
      }
    }
  } else if (drawing.type === 'circle' && metadata.bounds) {
    // Detect nodes contained within circle
    const radius = Math.min(metadata.bounds.width, metadata.bounds.height) / 2;
    const circleCenter = drawingCenter;
    const containedNodes = nodes.filter(node => isNodeInCircle(node, circleCenter, radius));
    
    if (containedNodes.length > 0) {
      geometricRelationships.containsNodes = containedNodes.map(node => ({
        id: node.id,
        label: node.data.label || node.id,
        type: node.type
      }));
    }
  } else if (drawing.type === 'rectangle' && metadata.bounds) {
    // Detect nodes contained within rectangle
    const containedNodes = nodes.filter(node => isNodeInRectangle(node, metadata.bounds!));
    
    if (containedNodes.length > 0) {
      geometricRelationships.containsNodes = containedNodes.map(node => ({
        id: node.id,
        label: node.data.label || node.id,
        type: node.type
      }));
    }
  } else if (drawing.type === 'text' && (drawing.position || metadata.bounds)) {
    // For text, find the closest node to the text start position (left side)
    const textStartPoint = drawing.position || 
      (metadata.bounds ? { x: metadata.bounds.minX, y: metadata.bounds.minY } : null);
    
    if (textStartPoint) {
      let closestNode: SecurityNode | undefined;
      let minDistance = Infinity;
      
      nodes.forEach(node => {
        const nodeWidth = 200;
        const nodeHeight = 80;
        const dist = distanceToRectangle(textStartPoint, node.position.x, node.position.y, nodeWidth, nodeHeight);
        
        if (dist < minDistance) {
          minDistance = dist;
          closestNode = node;
        }
      });
      
      // Also find closest edge if provided
      let closestEdge: { edge: SecurityEdge, distance: number } | undefined;
      if (edges && edges.length > 0 && closestNode) {
        let minEdgeDistance = Infinity;
        
        edges.forEach(edge => {
          const sourceNode = nodes.find(n => n.id === edge.source);
          const targetNode = nodes.find(n => n.id === edge.target);
          
          if (sourceNode && targetNode) {
            const sourceCenter = { x: sourceNode.position.x + 100, y: sourceNode.position.y + 40 };
            const targetCenter = { x: targetNode.position.x + 100, y: targetNode.position.y + 40 };
            const edgeDist = distanceToLineSegment(textStartPoint, sourceCenter, targetCenter);
            
            if (edgeDist < minEdgeDistance) {
              minEdgeDistance = edgeDist;
              closestEdge = { edge, distance: edgeDist };
            }
          }
        });
      }
      
      const textAnnotation: any = {
        text: drawing.text || '',
        closestNode: closestNode ? {
          id: closestNode.id,
          label: closestNode.data.label || closestNode.id,
          type: closestNode.type,
          distance: Math.round(minDistance)
        } : null
      };
      
      if (closestEdge) {
        const edge = closestEdge.edge;
        textAnnotation.closestEdge = {
          source: nodes.find(n => n.id === edge.source)?.data.label || edge.source,
          target: nodes.find(n => n.id === edge.target)?.data.label || edge.target,
          distance: Math.round(closestEdge.distance)
        };
      } else {
        textAnnotation.closestEdge = null;
      }
      
      geometricRelationships.textAnnotation = textAnnotation;
    }
  }
  
  // Add geometric relationships to metadata
  if (Object.keys(geometricRelationships).length > 0) {
    metadata.geometricRelationships = geometricRelationships;
  }

  // Filter nodes based on includeZones parameter
  const filteredNodes = includeZones ? nodes : nodes.filter(node => node.type !== 'securityZone');
  
  // Find nearby nodes (only if no specific geometric relationships found)
  const nodeDistances = filteredNodes.map(node => {
    // Calculate node dimensions based on type
    let nodeWidth = 200;  // Default width
    let nodeHeight = 80;   // Default height
    
    if (node.type === 'securityZone') {
      // For zones, use the actual dimensions if available in style
      nodeWidth = node.style?.width ? Number(node.style.width) : 400;
      nodeHeight = node.style?.height ? Number(node.style.height) : 300;
    }
    
    // Override with actual dimensions if available in style
    if (node.style?.width) nodeWidth = Number(node.style.width);
    if (node.style?.height) nodeHeight = Number(node.style.height);
    
    // Calculate distance to the nearest edge of the node, not just the center
    const distanceToNode = distanceToRectangle(
      drawingCenter,
      node.position.x,
      node.position.y,
      nodeWidth,
      nodeHeight
    );
    
    // Calculate node center for direction calculation
    const nodeCenter: Point = {
      x: node.position.x + nodeWidth / 2,
      y: node.position.y + nodeHeight / 2
    };
    
    return {
      node,
      distance: distanceToNode,
      direction: getDirection(drawingCenter, nodeCenter),
      isZone: node.type === 'securityZone'
    };
  }).sort((a, b) => a.distance - b.distance);
  
  // Get nearest nodes
  metadata.nearbyNodes = nodeDistances.slice(0, maxNearbyNodes).map(item => ({
    nodeId: item.node.id,
    nodeLabel: item.node.data.label || item.node.id,
    nodeType: item.node.type,
    distance: Math.round(item.distance),
    direction: item.direction,
    isZone: item.isZone
  }));
  
  // Find overlapping nodes
  if (metadata.bounds) {
    metadata.overlappingNodes = nodes
      .filter(node => boundsOverlapNode(metadata.bounds!, node))
      .map(node => node.id);
  }
  
  // Find nearby edges if provided
  if (edges && edges.length > 0) {
    const edgeDistances = edges.map(edge => {
      // Find source and target nodes (use all nodes, not filtered)
      const sourceNode = nodes.find(n => n.id === edge.source);
      const targetNode = nodes.find(n => n.id === edge.target);
      
      if (!sourceNode || !targetNode) return null;
      
      // Skip edges connected to zones if we're not including zones
      if (!includeZones && (sourceNode.type === 'securityZone' || targetNode.type === 'securityZone')) {
        return null;
      }
      
      // All nodes have the same dimensions
      let sourceWidth = 200, sourceHeight = 80;
      let targetWidth = 200, targetHeight = 80;
      
      // Calculate edge endpoints using actual node centers
      const sourceCenter: Point = {
        x: sourceNode.position.x + sourceWidth / 2,
        y: sourceNode.position.y + sourceHeight / 2
      };
      
      const targetCenter: Point = {
        x: targetNode.position.x + targetWidth / 2,
        y: targetNode.position.y + targetHeight / 2
      };
      
      // Calculate distance to edge line
      const distToEdge = distanceToLineSegment(drawingCenter, sourceCenter, targetCenter);
      
      return {
        edge,
        sourceLabel: sourceNode.data.label || sourceNode.id,
        targetLabel: targetNode.data.label || targetNode.id,
        distance: distToEdge,
        protocol: edge.data?.protocol,
        encryption: edge.data?.encryption,
        // securityLevel removed - no longer part of the data model
      };
    })
    .filter(item => item !== null)
    .sort((a, b) => a!.distance - b!.distance);
    
    // Get nearest edges with enhanced metadata
    metadata.nearbyEdges = edgeDistances
      .slice(0, maxNearbyEdges)
      .map(item => ({
        edgeId: item!.edge.id,
        sourceLabel: item!.sourceLabel,
        targetLabel: item!.targetLabel,
        distance: Math.round(item!.distance),
        protocol: item!.protocol,
        encryption: item!.encryption,
        // securityLevel removed - no longer part of the data model
      }));
  }
  
  return metadata;
}

/**
 * Generate a human-readable description of the drawing's spatial context
 */
export function generateDrawingDescription(drawing: Drawing): string {
  const parts: string[] = [];
  
  // Type description with text content
  switch (drawing.type) {
    case 'rectangle':
      parts.push('Rectangle annotation');
      break;
    case 'circle':
      parts.push('Circle annotation');
      break;
    case 'arrow':
      parts.push('Arrow annotation');
      break;
    case 'text':
      parts.push(`Text annotation: "${drawing.text || 'empty'}"`);
      break;
    case 'pencil':
      parts.push('Freehand drawing');
      break;
  }
  
  // Geometric relationships (priority over spatial proximity)
  if (drawing.geometricRelationships) {
    if (drawing.geometricRelationships.connectsNodes) {
      const conn = drawing.geometricRelationships.connectsNodes;
      if (conn.source && conn.target) {
        // Explicit connection description
        parts.push(`showing a connection from ${conn.source.label} (${conn.source.type}) to ${conn.target.label} (${conn.target.type})`);
      } else if (conn.source) {
        parts.push(`starting from ${conn.source.label} (${conn.source.type})`);
      } else if (conn.target) {
        parts.push(`pointing to ${conn.target.label} (${conn.target.type})`);
      } else if (drawing.geometricRelationships?.arrowContext) {
        // No direct connection but we have context about what's nearby
        const ctx = drawing.geometricRelationships.arrowContext;
        const startDesc = ctx.startPoint.closestNode ? 
          `${ctx.startPoint.closestNode.label} (${ctx.startPoint.closestNode.distance}px away)` : 
          'unknown location';
        const endDesc = ctx.endPoint.closestNode ? 
          `${ctx.endPoint.closestNode.label} (${ctx.endPoint.closestNode.distance}px away)` : 
          'unknown location';
        
        parts.push(`drawn from near ${startDesc} to near ${endDesc}`);
        
        // Add edge context if relevant
        if (ctx.startPoint.closestEdge && ctx.startPoint.closestEdge.distance < 50) {
          parts.push(`(start near connection: ${ctx.startPoint.closestEdge.source} → ${ctx.startPoint.closestEdge.target})`);
        }
        if (ctx.endPoint.closestEdge && ctx.endPoint.closestEdge.distance < 50) {
          parts.push(`(end near connection: ${ctx.endPoint.closestEdge.source} → ${ctx.endPoint.closestEdge.target})`);
        }
      } else {
        // Arrow exists but doesn't connect specific nodes
        parts.push(`(standalone arrow with no clear connection context)`);
      }
    } else if (drawing.geometricRelationships.containsNodes) {
      const contained = drawing.geometricRelationships.containsNodes;
      if (contained.length === 1) {
        parts.push(`containing ${contained[0].label}`);
      } else if (contained.length > 1) {
        parts.push(`containing ${contained.length} components: ${contained.map((n: any) => n.label).join(', ')}`);
      }
    } else if (drawing.geometricRelationships.textAnnotation) {
      const textInfo = drawing.geometricRelationships.textAnnotation;
      if (textInfo.closestNode) {
        parts.push(`annotating ${textInfo.closestNode.label} (${textInfo.closestNode.distance}px away)`);
      }
      if (textInfo.closestEdge && textInfo.closestEdge.distance < 50) {
        parts.push(`near connection ${textInfo.closestEdge.source} → ${textInfo.closestEdge.target}`);
      }
    }
  }
  
  // Always include spatial context for better understanding
  if (drawing.nearbyNodes && drawing.nearbyNodes.length > 0) {
    const nearest = drawing.nearbyNodes[0];
    if (!drawing.geometricRelationships || !drawing.geometricRelationships.connectsNodes) {
      // Only show "near" if we haven't already described connections
      parts.push(`near ${nearest.nodeLabel} (${nearest.nodeType})`);
    }
    
    if (drawing.nearbyNodes.length > 1 && drawing.type !== 'arrow') {
      const others = drawing.nearbyNodes.slice(1, 2).map(n => n.nodeLabel);
      parts.push(`and ${others.join(', ')}`);
    }
  }
  
  // Overlapping context
  if (drawing.overlappingNodes && drawing.overlappingNodes.length > 0) {
    parts.push(`overlapping ${drawing.overlappingNodes.length} component(s)`);
  }
  
  // Custom description
  if (drawing.description) {
    parts.push(`- ${drawing.description}`);
  }
  
  return parts.join(' ');
}