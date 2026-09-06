/**
 * Diagram Merge Utilities
 * Handles ID collision resolution and diagram merging
 */

import { SecurityNode, SecurityEdge } from '../types/SecurityTypes';
import { ExampleSystem } from '../types/ExampleSystemTypes';

/**
 * Generate unique ID prefix based on import source
 */
export function generateImportPrefix(source: string): string {
  const timestamp = Date.now().toString(36);
  const sourcePrefix = source.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 5);
  return `${sourcePrefix}_${timestamp}_`;
}

/**
 * Check if an ID exists in the current diagram
 */
export function hasIdCollision(
  id: string,
  existingNodes: SecurityNode[],
  existingEdges: SecurityEdge[]
): boolean {
  return (
    existingNodes.some(node => node.id === id) ||
    existingEdges.some(edge => edge.id === id)
  );
}

/**
 * Prefix all node and edge IDs to prevent collisions
 */
export function prefixDiagramIds(
  diagram: ExampleSystem,
  prefix: string
): ExampleSystem {
  const idMap = new Map<string, string>();

  // Create ID mapping for all nodes
  diagram.nodes.forEach(node => {
    idMap.set(node.id, `${prefix}${node.id}`);
  });

  // Prefix node IDs
  const prefixedNodes = diagram.nodes.map(node => ({
    ...node,
    id: `${prefix}${node.id}`,
    parentId: node.parentId ? `${prefix}${node.parentId}` : undefined
  }));

  // Prefix edge IDs and update source/target references
  const prefixedEdges = diagram.edges.map(edge => ({
    ...edge,
    id: `${prefix}${edge.id}`,
    source: idMap.get(edge.source) || `${prefix}${edge.source}`,
    target: idMap.get(edge.target) || `${prefix}${edge.target}`
  }));

  return {
    ...diagram,
    nodes: prefixedNodes,
    edges: prefixedEdges
  };
}

/**
 * Merge imported diagram with existing diagram
 */
export function mergeDiagrams(
  existingDiagram: ExampleSystem,
  importedDiagram: ExampleSystem,
  importSource: string
): ExampleSystem {
  const prefix = generateImportPrefix(importSource);
  const prefixedImport = prefixDiagramIds(importedDiagram, prefix);

  // Calculate layout offset for imported nodes
  const existingNodePositions = existingDiagram.nodes.map(n => n.position);
  const maxX = existingNodePositions.length > 0
    ? Math.max(...existingNodePositions.map(p => p.x))
    : 0;
  const offsetX = maxX + 300;

  // Offset imported nodes to the right of existing nodes
  const offsetNodes = prefixedImport.nodes.map(node => ({
    ...node,
    position: {
      x: node.position.x + offsetX,
      y: node.position.y
    }
  }));

  // Merge custom context
  const mergedContext = [
    existingDiagram.customContext || '',
    `\n\n## Imported from ${importSource}`,
    importedDiagram.customContext || ''
  ].filter(Boolean).join('\n');

  return {
    ...existingDiagram,
    name: existingDiagram.name,
    description: `${existingDiagram.description} (merged with ${importSource})`,
    customContext: mergedContext,
    nodes: [...existingDiagram.nodes, ...offsetNodes],
    edges: [...existingDiagram.edges, ...prefixedImport.edges]
  };
}

/**
 * Validate merged diagram
 */
export function validateMergedDiagram(diagram: ExampleSystem): string[] {
  const warnings: string[] = [];
  const nodeIds = new Set<string>();
  const edgeIds = new Set<string>();

  // Check for duplicate node IDs
  diagram.nodes.forEach(node => {
    if (nodeIds.has(node.id)) {
      warnings.push(`Duplicate node ID detected: ${node.id}`);
    }
    nodeIds.add(node.id);
  });

  // Check for duplicate edge IDs
  diagram.edges.forEach(edge => {
    if (edgeIds.has(edge.id)) {
      warnings.push(`Duplicate edge ID detected: ${edge.id}`);
    }
    edgeIds.add(edge.id);
  });

  // Check for orphaned edges
  diagram.edges.forEach(edge => {
    if (!nodeIds.has(edge.source)) {
      warnings.push(`Edge ${edge.id} references missing source node: ${edge.source}`);
    }
    if (!nodeIds.has(edge.target)) {
      warnings.push(`Edge ${edge.id} references missing target node: ${edge.target}`);
    }
  });

  return warnings;
}
