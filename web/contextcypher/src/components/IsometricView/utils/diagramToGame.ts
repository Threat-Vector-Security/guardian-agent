import * as THREE from 'three';
import { Node, Edge, XYPosition } from '@xyflow/react';
import { BUILDING_CONFIGS, CONNECTION_CONFIGS, WORLD_CONFIG, ZONE_COLORS, EDGE_BASE_HEIGHT } from './gameConstants';
import { getNodeIntersectionWithControlPoints } from '../../edges/floatingEdgeUtils';
import { getPathPoints } from '../../edges/edgePathUtils';
import type { ControlPointData } from '../../../types/SecurityTypes';

export interface GameEntity {
  id: string;
  type: 'building' | 'zone' | 'path' | 'actor';
  position: THREE.Vector3;
  rotation: THREE.Euler;
  scale: THREE.Vector3;
  metadata: {
    originalNode?: Node;
    originalEdge?: Edge;
    zone?: string;
    sourceZone?: string;
    targetZone?: string;
    sourcePos?: THREE.Vector3;
    targetPos?: THREE.Vector3;
    edgeOffset?: number;
    edgeIndex?: number;
    totalParallelEdges?: number;
    sourceFlowPos?: XYPosition;
    targetFlowPos?: XYPosition;
    pathPoints2D?: XYPosition[];
    sourceCenterFlowPos?: XYPosition;
    targetCenterFlowPos?: XYPosition;
    sourceBuildingScale?: THREE.Vector3;
    targetBuildingScale?: THREE.Vector3;
    sourceBuildingPosition?: THREE.Vector3;
    targetBuildingPosition?: THREE.Vector3;
    securityLevel: number;
    threats: string[];
    nodeType?: string;
    edgeType?: string;
    indexCode?: string;
    sourceNode?: {
      id: string;
      label: string;
      type?: string;
      indexCode?: string;
      shape?: string;
    } | null;
    targetNode?: {
      id: string;
      label: string;
      type?: string;
      indexCode?: string;
      shape?: string;
    } | null;
  };
}

export interface GameZone {
  id: string;
  type: string;
  bounds: {
    min: THREE.Vector3;
    max: THREE.Vector3;
  };
  color: string;
  opacity: number;
}

// Convert React Flow position to 3D world position
export const FLOW_TO_WORLD_SCALE = 0.1;
export const FLOW_TO_WORLD_OFFSET = 50;

export function flowToWorldPosition(flowPosition: { x: number; y: number }, height: number = 0): THREE.Vector3 {
  // Scale down from React Flow coordinates to world units
  return new THREE.Vector3(
    flowPosition.x * FLOW_TO_WORLD_SCALE - FLOW_TO_WORLD_OFFSET,
    height,
    flowPosition.y * FLOW_TO_WORLD_SCALE - FLOW_TO_WORLD_OFFSET
  );
}

// Convert node to building entity
const hashToAngle = (value: string): number => {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = ((hash << 5) - hash + value.charCodeAt(i)) | 0;
  }
  const normalized = Math.abs(hash) % 360;
  return (normalized * Math.PI) / 180;
};

export function convertNodeToBuilding(node: Node): GameEntity {
  const nodeType = node.type || 'generic';
  const config = BUILDING_CONFIGS[nodeType] || BUILDING_CONFIGS.generic;

  // Calculate center position (ReactFlow position is top-left)
  const nodeWidth = node.width || 150;
  const nodeHeight = node.height || 50;
  const centerPos = {
    x: node.position.x + nodeWidth / 2,
    y: node.position.y + nodeHeight / 2
  };

  // Calculate scale based on node data first so we can derive placement from actual size
  const scaleFactor = (node.data as any)?.scaleFactor || 1;
  const scale = config.baseSize.clone().multiplyScalar(scaleFactor as number);

  // Calculate position aligned with the floor regardless of scaling
  const basePosition = flowToWorldPosition(centerPos);
  const groundOffset = 0.05; // slight lift to avoid z-fighting with floor plane
  const height = scale.y / 2 + groundOffset;
  const position = new THREE.Vector3(basePosition.x, height, basePosition.z);

  return {
    id: node.id,
    type: 'building',
    position,
    rotation: new THREE.Euler(0, hashToAngle(node.id), 0), // Stable rotation to avoid jitter
    scale,
    metadata: {
      originalNode: node,
      zone: (node.data as any)?.zone as string,
      securityLevel: (node.data as any)?.securityLevel || 0,
      threats: (node.data as any)?.identifiedThreats || [],
      nodeType: nodeType,
      indexCode: (node.data as any)?.indexCode,
    },
  };
}

// Convert edge to path entity
export function convertEdgeToPath(
  edge: Edge,
  nodes: Node[],
  sourceBuilding?: GameEntity,
  targetBuilding?: GameEntity
): GameEntity | null {
  const sourceNode = nodes.find(n => n.id === edge.source);
  const targetNode = nodes.find(n => n.id === edge.target);

  if (!sourceNode || !targetNode) return null;

  const edgeData = edge.data as { controlPoints?: ControlPointData[] } | undefined;
  const controlPoints: ControlPointData[] = edgeData?.controlPoints || [];
  const controlPointPositions: XYPosition[] = controlPoints.map(cp => ({ x: cp.x, y: cp.y }));

  // Determine source/target intersections that React Flow uses for floating edges
  const sourceIntersection = getNodeIntersectionWithControlPoints(
    sourceNode,
    targetNode,
    controlPointPositions
  );

  const reversedControlPoints = controlPointPositions.length > 0
    ? [...controlPointPositions].reverse()
    : controlPointPositions;

  const targetIntersection = getNodeIntersectionWithControlPoints(
    targetNode,
    sourceNode,
    reversedControlPoints
  );

  const sourceFlowPos: XYPosition = {
    x: sourceIntersection.x,
    y: sourceIntersection.y,
  };

  const targetFlowPos: XYPosition = {
    x: targetIntersection.x,
    y: targetIntersection.y,
  };

  const sourceCenterFlow = {
    x: sourceNode.position.x + (sourceNode.width || 150) / 2,
    y: sourceNode.position.y + (sourceNode.height || 50) / 2,
  };

  const targetCenterFlow = {
    x: targetNode.position.x + (targetNode.width || 150) / 2,
    y: targetNode.position.y + (targetNode.height || 50) / 2,
  };

  // Convert intersection positions to 3D world coordinates
  const sourcePos = flowToWorldPosition(sourceFlowPos, EDGE_BASE_HEIGHT);
  const targetPos = flowToWorldPosition(targetFlowPos, EDGE_BASE_HEIGHT);

  // Calculate midpoint for path position
  const position = new THREE.Vector3().lerpVectors(sourcePos, targetPos, 0.5);
  position.y = EDGE_BASE_HEIGHT;

  // Calculate rotation to align path
  const direction = new THREE.Vector3().subVectors(targetPos, sourcePos);
  const angle = Math.atan2(direction.z, direction.x);

  // Calculate length for scale
  const length = direction.length();
  const edgeType = (edge.data as any)?.protocol || edge.type || 'default';
  const config = CONNECTION_CONFIGS[edgeType.toLowerCase() as keyof typeof CONNECTION_CONFIGS] || CONNECTION_CONFIGS.default;

  // Get zones from source and target nodes
  const sourceZone = (sourceNode.data as any)?.zone as string;
  const targetZone = (targetNode.data as any)?.zone as string;

  // Determine edge zone - prefer source zone, fallback to target zone
  const edgeZone = sourceZone || targetZone || undefined;

  // Cache the resolved 2D path used for the 3D rendering
  const pathPoints2D = getPathPoints(sourceFlowPos, targetFlowPos, controlPoints);

  // Note: Control points are handled directly in ConnectionPath component
  // They're accessed via originalEdge.data.controlPoints in the rendering
  return {
    id: edge.id,
    type: 'path',
    position,
    rotation: new THREE.Euler(0, -angle, 0),
    scale: new THREE.Vector3(length, config.width, config.width),
    metadata: {
      originalEdge: edge,
      zone: edgeZone,
      sourceZone,
      targetZone,
      sourcePos,
      targetPos,
      sourceFlowPos,
      targetFlowPos,
      pathPoints2D,
      sourceCenterFlowPos: sourceCenterFlow,
      targetCenterFlowPos: targetCenterFlow,
      sourceBuildingScale: sourceBuilding?.scale?.clone(),
      targetBuildingScale: targetBuilding?.scale?.clone(),
      sourceBuildingPosition: sourceBuilding?.position?.clone(),
      targetBuildingPosition: targetBuilding?.position?.clone(),
      securityLevel: config.secure ? 1 : 0,
      threats: (edge.data as any)?.threats || [],
      edgeType: edgeType,
      sourceNode: sourceNode ? {
        id: sourceNode.id,
        label: (sourceNode.data as any)?.label,
        type: sourceNode.type,
        indexCode: (sourceNode.data as any)?.indexCode,
        shape: (sourceNode.data as any)?.shape
      } : null,
      targetNode: targetNode ? {
        id: targetNode.id,
        label: (targetNode.data as any)?.label,
        type: targetNode.type,
        indexCode: (targetNode.data as any)?.indexCode,
        shape: (targetNode.data as any)?.shape
      } : null,
    },
  };
}

// Extract zones from nodes
export function extractZones(nodes: Node[]): GameZone[] {
  const zoneNodes = nodes.filter(node => node.type === 'zone' || node.type === 'securityZone');

  return zoneNodes.map(zoneNode => {
    // Get zone type from zoneType field (SecurityZoneNodeData structure)
    const zoneData = zoneNode.data as any;
    const zoneType = (zoneData.zoneType || zoneData.zone || 'Internal').toLowerCase();
    const zoneConfig = ZONE_COLORS[zoneType as keyof typeof ZONE_COLORS] || ZONE_COLORS.internal;

    // Use actual node dimensions from ReactFlow
    const flowPos = zoneNode.position;
    // ReactFlow stores node dimensions in the node object
    // Check multiple possible sources for dimensions
    let nodeWidth = 300; // default
    let nodeHeight = 200; // default

    // Priority order for getting dimensions:
    // 1. Explicit width/height on node
    if (zoneNode.width !== undefined && zoneNode.width !== null) {
      nodeWidth = zoneNode.width;
    }
    if (zoneNode.height !== undefined && zoneNode.height !== null) {
      nodeHeight = zoneNode.height;
    }

    // 2. Style dimensions (can be string like "400px" or number)
    if (zoneNode.style?.width) {
      const styleWidth = typeof zoneNode.style.width === 'string'
        ? parseInt(zoneNode.style.width)
        : zoneNode.style.width;
      if (!isNaN(styleWidth)) nodeWidth = styleWidth;
    }
    if (zoneNode.style?.height) {
      const styleHeight = typeof zoneNode.style.height === 'string'
        ? parseInt(zoneNode.style.height)
        : zoneNode.style.height;
      if (!isNaN(styleHeight)) nodeHeight = styleHeight;
    }

    // 3. Computed dimensions (ReactFlow v11+)
    if ((zoneNode as any).computed?.width) {
      nodeWidth = (zoneNode as any).computed.width;
    }
    if ((zoneNode as any).computed?.height) {
      nodeHeight = (zoneNode as any).computed.height;
    }

    // 4. Data dimensions (sometimes stored here)
    if ((zoneNode.data as any)?.width) {
      nodeWidth = (zoneNode.data as any).width;
    }
    if ((zoneNode.data as any)?.height) {
      nodeHeight = (zoneNode.data as any).height;
    }

    // Convert position to 3D world coordinates
    const topLeft = flowToWorldPosition(flowPos);

    // Convert dimensions to 3D world units (scale 0.1)
    const scale = 0.1;
    const width = nodeWidth * scale;
    const depth = nodeHeight * scale; // In 3D, height becomes depth (z-axis)
    const height = 10; // Fixed vertical height for all zones


    // Calculate center position in 3D world
    const center = new THREE.Vector3(
      topLeft.x + width / 2,
      height / 2,
      topLeft.z + depth / 2
    );

    return {
      id: zoneNode.id,
      type: zoneData.zoneType || 'Internal', // Keep original case for label
      bounds: {
        min: new THREE.Vector3(center.x - width / 2, 0, center.z - depth / 2),
        max: new THREE.Vector3(center.x + width / 2, height, center.z + depth / 2),
      },
      color: zoneConfig.color,
      opacity: zoneConfig.opacity,
    };
  });
}

// Main conversion function
export function convertDiagramToGame(nodes: Node[], edges: Edge[]) {
  const buildingEntities = nodes
    .filter(node => node.type !== 'zone' && node.type !== 'securityZone')
    .map(node => convertNodeToBuilding(node));

  const buildingMap = new Map<string, GameEntity>();
  buildingEntities.forEach(building => {
    if (building.metadata.originalNode) {
      buildingMap.set(building.metadata.originalNode.id, building);
    }
  });

  // Group edges by source/target pairs to handle parallel edges
  const edgeGroups: Record<string, Edge[]> = {};
  edges.forEach(edge => {
    // Create a key that's the same regardless of direction
    const key = [edge.source, edge.target].sort().join('-');
    if (!edgeGroups[key]) {
      edgeGroups[key] = [];
    }
    edgeGroups[key].push(edge);
  });

  // Convert edges with offset for parallel edges
  const paths: GameEntity[] = [];
  Object.values(edgeGroups).forEach(groupedEdges => {
    const sortedEdges = [...groupedEdges].sort((a, b) => a.id.localeCompare(b.id));
    const totalCount = sortedEdges.length;

    sortedEdges.forEach((edge, index) => {
      const path = convertEdgeToPath(edge, nodes, buildingMap.get(edge.source), buildingMap.get(edge.target));
      if (path) {
        // Add offset information for curved paths
        const centerIndex = (totalCount - 1) / 2;
        const offset = (index - centerIndex) * 30; // 30 units spacing between parallel edges

        // Update metadata with offset
        path.metadata = {
          ...path.metadata,
          edgeOffset: offset,
          edgeIndex: index,
          totalParallelEdges: totalCount
        };

        paths.push(path);
      }
    });
  });

  const zones = extractZones(nodes);

  return {
    entities: [...buildingEntities, ...paths],
    zones,
  };
}

// Helper to calculate node positions within zones
export function positionNodesInZone(nodes: Node[], zoneId: string): Node[] {
  const zoneNodes = nodes.filter(n => n.data?.zone === zoneId);
  if (zoneNodes.length === 0) return nodes;

  // Simple grid layout within zone
  const cols = Math.ceil(Math.sqrt(zoneNodes.length));
  const spacing = 150;
  const startX = 50;
  const startY = 50;

  zoneNodes.forEach((node, index) => {
    const col = index % cols;
    const row = Math.floor(index / cols);
    node.position = {
      x: startX + col * spacing,
      y: startY + row * spacing,
    };
  });

  return nodes;
}

// Get building configuration for a node type
export function getBuildingConfig(nodeType: string) {
  return BUILDING_CONFIGS[nodeType as keyof typeof BUILDING_CONFIGS] || BUILDING_CONFIGS.generic;
}

// Get connection configuration for an edge type
export function getConnectionConfig(edgeType: string) {
  const type = edgeType?.toLowerCase() || 'default';
  return CONNECTION_CONFIGS[type as keyof typeof CONNECTION_CONFIGS] || CONNECTION_CONFIGS.default;
}

// Calculate threat level color
export function getThreatLevelColor(threatLevel: number): string {
  if (threatLevel >= 0.8) return '#ef4444'; // High - Red
  if (threatLevel >= 0.6) return '#f97316'; // Medium-High - Orange
  if (threatLevel >= 0.4) return '#fbbf24'; // Medium - Yellow
  if (threatLevel >= 0.2) return '#22c55e'; // Low - Green
  return '#10b981'; // Very Low - Emerald
}
