/**
 * Client-side edge indexing utilities that mirror server-side DiagramIndexer logic
 */

import { SecurityNode, SecurityEdge } from '../types/SecurityTypes';

/**
 * Practitioner-style reference code prefixes for DFD element types,
 * matching traditional threat model document notation (A01, P03, DS01, TB01).
 */
export const DFD_REF_PREFIXES: Record<string, string> = {
  dfdActor: 'A',
  dfdProcess: 'P',
  dfdDataStore: 'DS',
  dfdTrustBoundary: 'TB'
};

/** Returns the DFD reference prefix for a node type, or null for non-DFD types. */
export function getDfdRefPrefix(nodeType: string): string | null {
  return DFD_REF_PREFIXES[nodeType] ?? null;
}

/** Formats a DFD reference code, e.g. ('A', 1) -> 'A01'. */
export function formatDfdRefCode(prefix: string, index: number): string {
  return `${prefix}${String(index).padStart(2, '0')}`;
}

/**
 * Generate node code matching server-side DiagramIndexer format.
 * DFD element types use practitioner document notation (A01, P03, DS01, TB01);
 * all other types keep the TYPE-ZONE-INDEX format (e.g. WEB-DMZ-001).
 */
export function generateNodeCode(node: SecurityNode, nodeIndex: number): string {
  const type = node.type;

  const dfdPrefix = getDfdRefPrefix(type);
  if (dfdPrefix) {
    return formatDfdRefCode(dfdPrefix, nodeIndex);
  }

  const zone = (node.data as any)?.zone || 'none';

  // Format: TYPE-ZONE-INDEX (e.g., WEB-DMZ-001)
  const typeCode = type.substring(0, 3).toUpperCase();
  const zoneCode = String(zone).substring(0, 3).toUpperCase();
  const indexCode = String(nodeIndex).padStart(3, '0');

  return `${typeCode}-${zoneCode}-${indexCode}`;
}

/**
 * Get simple handle name (top, bottom, left, right)
 */
function getSimpleHandle(handle?: string | null): string {
  if (!handle) return 'center';
  
  const handleLower = handle.toLowerCase();
  
  if (handleLower.includes('top')) return 'top';
  if (handleLower.includes('bottom')) return 'bottom';
  if (handleLower.includes('left')) return 'left';
  if (handleLower.includes('right')) return 'right';
  
  return 'center';
}

/**
 * Generate edge code matching server-side DiagramIndexer format
 */
export function generateEdgeCode(
  edge: SecurityEdge, 
  nodes: SecurityNode[]
): string {
  const sourceNode = nodes.find(n => n.id === edge.source);
  const targetNode = nodes.find(n => n.id === edge.target);
  
  if (!sourceNode || !targetNode) {
    return `edge-unknown`;
  }
  
  // Use the existing index codes from nodes - frontend is the single source of truth
  const sourceCode = sourceNode.data?.indexCode;
  const targetCode = targetNode.data?.indexCode;
  
  if (!sourceCode || !targetCode) {
    console.warn(`Missing index codes - source: ${sourceCode}, target: ${targetCode}`);
    return `edge-unknown`;
  }
  
  // Get connection handles
  const sourceHandle = getSimpleHandle(edge.sourceHandle);
  const targetHandle = getSimpleHandle(edge.targetHandle);
  
  // Format: sourceCode-sourceHandle-to-targetCode-targetHandle
  // Example: WEB-DMZ-001-right-to-APP-INT-002-left
  return `${sourceCode}-${sourceHandle}-to-${targetCode}-${targetHandle}`;
}

/**
 * Update edge with generated index code
 */
export function updateEdgeWithIndexCode(
  edge: SecurityEdge,
  nodes: SecurityNode[]
): SecurityEdge {
  const indexCode = generateEdgeCode(edge, nodes);
  
  return {
    ...(edge as any),
    data: {
      ...edge.data,
      indexCode
    }
  } as SecurityEdge;
}

/**
 * Update all edges with generated index codes
 */
export function updateEdgesWithIndexCodes(
  edges: SecurityEdge[],
  nodes: SecurityNode[]
): SecurityEdge[] {
  return edges.map(edge => updateEdgeWithIndexCode(edge, nodes));
}

/**
 * Update node with generated index code
 */
export function updateNodeWithIndexCode(
  node: SecurityNode,
  nodeIndex: number
): SecurityNode {
  const indexCode = generateNodeCode(node, nodeIndex);
  
  return {
    ...node,
    data: {
      ...node.data,
      indexCode
    }
  } as SecurityNode;
}

/**
 * Get the next available index number for a specific TYPE-ZONE combination
 */
export function getNextAvailableIndex(
  nodes: SecurityNode[],
  nodeType: string,
  zone: string
): number {
  const dfdPrefix = getDfdRefPrefix(nodeType);

  // DFD codes (A01, P03, ...) are sequenced per element type across the whole
  // diagram, independent of zone.
  const existingIndices = (dfdPrefix
    ? nodes
        .filter(n => n.type === nodeType)
        .map(n => {
          const match = n.data?.indexCode?.match(new RegExp(`^${dfdPrefix}(\\d+)$`));
          return match ? parseInt(match[1], 10) : 0;
        })
    : (() => {
        const typeCode = nodeType.substring(0, 3).toUpperCase();
        const zoneCode = zone.substring(0, 3).toUpperCase();
        const prefix = `${typeCode}-${zoneCode}-`;

        // Find existing indices for this TYPE-ZONE combination only
        return nodes
          .filter(n => n.type !== 'securityZone' && n.data?.indexCode?.startsWith(prefix))
          .map(n => {
            const match = n.data?.indexCode?.match(/(\d{3})$/);
            return match ? parseInt(match[1], 10) : 0;
          });
      })())
    .filter(idx => idx > 0);
  
  if (existingIndices.length === 0) {
    return 1;
  }
  
  // Sort indices and find the first gap or use max + 1
  existingIndices.sort((a, b) => a - b);
  
  // Check for gaps in the sequence
  for (let i = 0; i < existingIndices.length; i++) {
    if (existingIndices[i] !== i + 1) {
      return i + 1; // Found a gap
    }
  }
  
  // No gaps, use next number
  return existingIndices[existingIndices.length - 1] + 1;
}

/**
 * Update all nodes with generated index codes
 */
export function updateNodesWithIndexCodes(
  nodes: SecurityNode[]
): SecurityNode[] {
  // First, separate nodes that already have codes from those that don't
  const nodesWithCodes = nodes.filter(n => n.type !== 'securityZone' && n.data?.indexCode);
  const nodesWithoutCodes = nodes.filter(n => n.type !== 'securityZone' && !n.data?.indexCode);
  const zoneNodes = nodes.filter(n => n.type === 'securityZone');
  
  // Sort nodes without codes by ID for deterministic ordering (matching server behavior)
  const sortedNodesWithoutCodes = [...nodesWithoutCodes].sort((a, b) => a.id.localeCompare(b.id));
  
  // Track counters per TYPE-ZONE combination
  const typeZoneCounters = new Map<string, number>();
  
  // Counter key: DFD types use their ref prefix (zone-independent, e.g. 'A');
  // other types use TYPE-ZONE (e.g. 'WEB-DMZ').
  const counterKeyFor = (node: SecurityNode): string => {
    const dfdPrefix = getDfdRefPrefix(node.type);
    if (dfdPrefix) return `dfd:${dfdPrefix}`;
    const zone = (node.data as any)?.zone || 'none';
    return `${node.type.substring(0, 3).toUpperCase()}-${String(zone).substring(0, 3).toUpperCase()}`;
  };

  // Initialize counters based on existing nodes
  nodesWithCodes.forEach(node => {
    const key = counterKeyFor(node);
    const match = node.data?.indexCode?.match(/(\d+)$/);
    if (match) {
      const index = parseInt(match[1], 10);
      const currentMax = typeZoneCounters.get(key) || 0;
      typeZoneCounters.set(key, Math.max(currentMax, index));
    }
  });

  // Assign index codes using per-key counters
  const updatedNodesWithoutCodes = sortedNodesWithoutCodes.map(node => {
    const key = counterKeyFor(node);

    // Get next index for this key
    const currentMax = typeZoneCounters.get(key) || 0;
    const nextIndex = currentMax + 1;
    typeZoneCounters.set(key, nextIndex);

    const updatedNode = updateNodeWithIndexCode(node, nextIndex);
    return updatedNode;
  });
  
  // Combine all nodes back together
  return [...zoneNodes, ...nodesWithCodes, ...updatedNodesWithoutCodes];
}

/**
 * Regenerate index code for a node when its zone changes
 */
export function regenerateNodeIndexCode(
  node: SecurityNode,
  newZone: string,
  allNodes: SecurityNode[]
): string {
  // DFD reference codes are zone-independent and stable once assigned.
  const dfdPrefix = getDfdRefPrefix(node.type);
  if (dfdPrefix) {
    if (node.data?.indexCode) return node.data.indexCode;
    return formatDfdRefCode(dfdPrefix, getNextAvailableIndex(allNodes, node.type, newZone));
  }

  const nextIndex = getNextAvailableIndex(allNodes, node.type, newZone);
  const typeCode = node.type.substring(0, 3).toUpperCase();
  const zoneCode = newZone.substring(0, 3).toUpperCase();
  const indexCode = String(nextIndex).padStart(3, '0');

  return `${typeCode}-${zoneCode}-${indexCode}`;
}

/**
 * Update all edges connected to a node when its index code changes
 */
export function updateConnectedEdgesIndexCodes(
  nodeId: string,
  edges: SecurityEdge[],
  nodes: SecurityNode[]
): SecurityEdge[] {
  return edges.map(edge => {
    // Update if this edge is connected to the changed node
    if (edge.source === nodeId || edge.target === nodeId) {
      return updateEdgeWithIndexCode(edge, nodes);
    }
    return edge;
  });
}

/**
 * Migrate edges by updating their index codes
 * This should be called after migrateHandleIds
 */
export function migrateEdgeIndexCodes(
  edges: SecurityEdge[],
  nodes: SecurityNode[]
): SecurityEdge[] {
  return edges.map(edge => {
    // Only update if indexCode is missing
    if (!edge.data?.indexCode) {
      return updateEdgeWithIndexCode(edge, nodes);
    }
    return edge;
  });
}