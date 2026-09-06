// src/utils/diagramComparison.ts

import { DiagramData, DiagramChanges, CustomContext, Drawing } from '../types/AnalysisTypes';
import { SecurityNode, SecurityEdge, SecurityZone, SecurityNodeData, SecurityZoneNodeData, SecurityEdgeData } from '../types/SecurityTypes';

/**
 * Enhanced comparison that tracks all security properties and context changes
 */
export interface EnhancedDiagramChanges extends DiagramChanges {
  customContext?: {
    previous: CustomContext | null;
    current: CustomContext | null;
    changed: boolean;
  };
  drawings?: {
    added: Drawing[];
    modified: Drawing[];
    removed: Drawing[];
  };
}

/**
 * Compare two diagram states and return the differences
 */
export function compareDiagrams(
  previousDiagram: DiagramData | null,
  currentDiagram: DiagramData,
  previousContext?: CustomContext | null,
  currentContext?: CustomContext | null,
  previousDrawings?: Drawing[],
  currentDrawings?: Drawing[]
): EnhancedDiagramChanges {
  if (!previousDiagram) {
    // First diagram state - everything is new
    return {
      nodes: {
        added: currentDiagram.nodes,
        modified: [],
        removed: []
      },
      edges: {
        added: currentDiagram.edges,
        modified: [],
        removed: []
      },
      zones: {
        added: extractZones(currentDiagram.nodes),
        modified: [],
        removed: []
      },
      metadata: {
        timestamp: new Date(),
        changeType: 'node',
        batchId: generateBatchId()
      },
      threatIntel: {
        data: null,
        lastUpdated: null,
        isLoading: false,
        error: null,
        nodeAnalysis: {},
        connectionAnalysis: {}
      },
      customContext: {
        previous: null,
        current: currentContext || null,
        changed: !!currentContext
      },
      drawings: {
        added: currentDrawings || [],
        modified: [],
        removed: []
      }
    };
  }

  // Create maps for efficient lookup
  const prevNodeMap = new Map(previousDiagram.nodes.map(n => [n.id, n]));
  const currNodeMap = new Map(currentDiagram.nodes.map(n => [n.id, n]));
  const prevEdgeMap = new Map(previousDiagram.edges.map(e => [e.id, e]));
  const currEdgeMap = new Map(currentDiagram.edges.map(e => [e.id, e]));

  // Find node changes
  const addedNodes: SecurityNode[] = [];
  const modifiedNodes: SecurityNode[] = [];
  const removedNodes: SecurityNode[] = [];

  // Check for added and modified nodes
  currentDiagram.nodes.forEach(node => {
    const prevNode = prevNodeMap.get(node.id);
    if (!prevNode) {
      addedNodes.push(node);
    } else if (hasNodeChanged(prevNode, node)) {
      modifiedNodes.push(node);
    }
  });

  // Check for removed nodes
  previousDiagram.nodes.forEach(node => {
    if (!currNodeMap.has(node.id)) {
      removedNodes.push(node);
    }
  });

  // Find edge changes
  const addedEdges: SecurityEdge[] = [];
  const modifiedEdges: SecurityEdge[] = [];
  const removedEdges: SecurityEdge[] = [];

  // Check for added and modified edges
  currentDiagram.edges.forEach(edge => {
    const prevEdge = prevEdgeMap.get(edge.id);
    if (!prevEdge) {
      addedEdges.push(edge);
    } else if (hasEdgeChanged(prevEdge, edge)) {
      modifiedEdges.push(edge);
    }
  });

  // Check for removed edges
  previousDiagram.edges.forEach(edge => {
    if (!currEdgeMap.has(edge.id)) {
      removedEdges.push(edge);
    }
  });

  // Extract zone changes
  const prevZones = extractZones(previousDiagram.nodes);
  const currZones = extractZones(currentDiagram.nodes);
  const zoneChanges = compareZones(prevZones, currZones);

  // Compare custom context
  const contextChanges = compareCustomContext(previousContext, currentContext);

  // Compare drawings
  const drawingChanges = compareDrawings(previousDrawings || [], currentDrawings || []);

  // Determine primary change type
  let changeType: 'node' | 'edge' | 'zone' = 'node';
  if (addedEdges.length + modifiedEdges.length + removedEdges.length > 
      addedNodes.length + modifiedNodes.length + removedNodes.length) {
    changeType = 'edge';
  } else if (zoneChanges.added.length + zoneChanges.modified.length + zoneChanges.removed.length > 0) {
    changeType = 'zone';
  }

  return {
    nodes: { added: addedNodes, modified: modifiedNodes, removed: removedNodes },
    edges: { added: addedEdges, modified: modifiedEdges, removed: removedEdges },
    zones: zoneChanges,
    metadata: {
      timestamp: new Date(),
      changeType,
      batchId: generateBatchId()
    },
    threatIntel: {
      data: null,
      lastUpdated: null,
      isLoading: false,
      error: null,
      nodeAnalysis: {},
      connectionAnalysis: {}
    },
    customContext: contextChanges,
    drawings: drawingChanges
  };
}

/**
 * Check if a node has changed - includes all SecurityNode properties
 */
function hasNodeChanged(prevNode: SecurityNode, currNode: SecurityNode): boolean {
  // Check basic properties
  if (prevNode.type !== currNode.type ||
      prevNode.position.x !== currNode.position.x ||
      prevNode.position.y !== currNode.position.y) {
    return true;
  }

  // Check if it's a security zone node
  if (prevNode.type === 'securityZone' && currNode.type === 'securityZone') {
    return hasZoneNodeChanged(
      prevNode.data as SecurityZoneNodeData,
      currNode.data as SecurityZoneNodeData
    );
  }

  // Check regular security node data properties
  return hasSecurityNodeDataChanged(
    prevNode.data as SecurityNodeData,
    currNode.data as SecurityNodeData
  );
}

/**
 * Check if security node data has changed - includes ALL properties
 */
function hasSecurityNodeDataChanged(prevData: SecurityNodeData, currData: SecurityNodeData): boolean {
  // Core properties
  if (prevData.label !== currData.label ||
      prevData.zone !== currData.zone ||
      // prevData.securityLevel !== currData.securityLevel || - removed from the data model
      prevData.dataClassification !== currData.dataClassification) {
    return true;
  }

  // Additional security properties
  if (prevData.vendor !== currData.vendor ||
      prevData.product !== currData.product ||
      prevData.version !== currData.version ||
      prevData.description !== currData.description) {
    return true;
  }

  // Icon property
  if (prevData.icon !== currData.icon) {
    return true;
  }

  // Custom properties (if any) - SecurityNodeData doesn't have customProperties by default
  // This is for future extensibility
  const prevCustom = (prevData as any).customProperties;
  const currCustom = (currData as any).customProperties;
  if (prevCustom || currCustom) {
    if (JSON.stringify(prevCustom) !== JSON.stringify(currCustom)) {
      return true;
    }
  }

  return false;
}

/**
 * Check if zone node data has changed
 */
function hasZoneNodeChanged(prevData: SecurityZoneNodeData, currData: SecurityZoneNodeData): boolean {
  return prevData.label !== currData.label ||
         prevData.description !== currData.description ||
         prevData.zoneType !== currData.zoneType ||
         // prevData.securityLevel !== currData.securityLevel || - removed from the data model
         prevData.dataClassification !== currData.dataClassification;
}

/**
 * Check if an edge has changed - includes ALL SecurityEdgeData properties
 */
function hasEdgeChanged(prevEdge: SecurityEdge, currEdge: SecurityEdge): boolean {
  // Check connection points
  if (prevEdge.source !== currEdge.source ||
      prevEdge.target !== currEdge.target ||
      prevEdge.sourceHandle !== currEdge.sourceHandle ||
      prevEdge.targetHandle !== currEdge.targetHandle) {
    return true;
  }

  // Check all edge data properties
  const prevData = prevEdge.data;
  const currData = currEdge.data;

  if (prevData?.label !== currData?.label ||
      prevData?.protocol !== currData?.protocol ||
      prevData?.encryption !== currData?.encryption ||
      // prevData?.securityLevel !== currData?.securityLevel || - removed from the data model
      prevData?.dataClassification !== currData?.dataClassification ||
      prevData?.zone !== currData?.zone) {
    return true;
  }

  // Check style changes
  if (JSON.stringify(prevEdge.style) !== JSON.stringify(currEdge.style)) {
    return true;
  }

  return false;
}

/**
 * Compare custom context changes
 */
function compareCustomContext(
  previous: CustomContext | null | undefined,
  current: CustomContext | null | undefined
): {
  previous: CustomContext | null;
  current: CustomContext | null;
  changed: boolean;
} {
  const changed = (previous?.content || '') !== (current?.content || '') ||
                  (previous?.sanitizedContent || '') !== (current?.sanitizedContent || '');

  return {
    previous: previous || null,
    current: current || null,
    changed
  };
}

/**
 * Compare drawing changes
 */
function compareDrawings(
  previousDrawings: Drawing[],
  currentDrawings: Drawing[]
): {
  added: Drawing[];
  modified: Drawing[];
  removed: Drawing[];
} {
  const prevMap = new Map(previousDrawings.map(d => [d.id, d]));
  const currMap = new Map(currentDrawings.map(d => [d.id, d]));

  const added: Drawing[] = [];
  const modified: Drawing[] = [];
  const removed: Drawing[] = [];

  // Check for added and modified drawings
  currentDrawings.forEach(drawing => {
    const prevDrawing = prevMap.get(drawing.id);
    if (!prevDrawing) {
      added.push(drawing);
    } else if (hasDrawingChanged(prevDrawing, drawing)) {
      modified.push(drawing);
    }
  });

  // Check for removed drawings
  previousDrawings.forEach(drawing => {
    if (!currMap.has(drawing.id)) {
      removed.push(drawing);
    }
  });

  return { added, modified, removed };
}

/**
 * Check if a drawing has changed
 */
function hasDrawingChanged(prevDrawing: Drawing, currDrawing: Drawing): boolean {
  return prevDrawing.type !== currDrawing.type ||
         prevDrawing.path !== currDrawing.path ||
         prevDrawing.text !== currDrawing.text ||
         JSON.stringify(prevDrawing.position) !== JSON.stringify(currDrawing.position) ||
         JSON.stringify(prevDrawing.style) !== JSON.stringify(currDrawing.style) ||
         prevDrawing.associatedNodeId !== currDrawing.associatedNodeId;
}

/**
 * Extract security zones from nodes
 */
function extractZones(nodes: SecurityNode[]): SecurityZone[] {
  // const zones: SecurityZone[] = []; // Not currently used
  const zoneSet = new Set<SecurityZone>();

  nodes.forEach(node => {
    if (node.type === 'securityZone') {
      const zoneData = node.data as SecurityZoneNodeData;
      if (zoneData.zoneType) {
        zoneSet.add(zoneData.zoneType as SecurityZone);
      }
    } else {
      const nodeData = node.data as SecurityNodeData;
      if (nodeData.zone) {
        zoneSet.add(nodeData.zone);
      }
    }
  });

  return Array.from(zoneSet);
}

/**
 * Compare security zones
 */
function compareZones(
  prevZones: SecurityZone[],
  currZones: SecurityZone[]
): {
  added: SecurityZone[];
  modified: SecurityZone[];
  removed: SecurityZone[];
} {
  const prevSet = new Set(prevZones);
  const currSet = new Set(currZones);

  const added = currZones.filter(z => !prevSet.has(z));
  const removed = prevZones.filter(z => !currSet.has(z));

  // Zones can't really be "modified" in our model
  return { added, modified: [], removed };
}

/**
 * Generate a unique batch ID for changes
 */
function generateBatchId(): string {
  return `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Format diagram changes as human-readable strings
 */
export function formatDiagramChanges(changes: EnhancedDiagramChanges): string[] {
  const formatted: string[] = [];

  // Node changes
  if (changes.nodes.added.length > 0) {
    const nodeLabels = changes.nodes.added.map(n => n.data.label || n.id).join(', ');
    formatted.push(`Added ${changes.nodes.added.length} component(s): ${nodeLabels}`);
  }

  if (changes.nodes.modified.length > 0) {
    const nodeLabels = changes.nodes.modified.map(n => n.data.label || n.id).join(', ');
    formatted.push(`Modified ${changes.nodes.modified.length} component(s): ${nodeLabels}`);
  }

  if (changes.nodes.removed.length > 0) {
    const nodeLabels = changes.nodes.removed.map(n => n.data.label || n.id).join(', ');
    formatted.push(`Removed ${changes.nodes.removed.length} component(s): ${nodeLabels}`);
  }

  // Edge changes
  const edgeChangeCount = changes.edges.added.length + changes.edges.removed.length;
  if (edgeChangeCount > 0) {
    const netChange = changes.edges.added.length - changes.edges.removed.length;
    if (netChange > 0) {
      formatted.push(`Added ${netChange} connection(s)`);
    } else if (netChange < 0) {
      formatted.push(`Removed ${Math.abs(netChange)} connection(s)`);
    } else {
      formatted.push(`Modified ${changes.edges.added.length} connection(s)`);
    }
  }

  // Zone changes
  if (changes.zones.added.length > 0) {
    formatted.push(`Added security zones: ${changes.zones.added.join(', ')}`);
  }

  if (changes.zones.removed.length > 0) {
    formatted.push(`Removed security zones: ${changes.zones.removed.join(', ')}`);
  }

  // Custom context changes
  if (changes.customContext?.changed) {
    formatted.push('Updated custom context');
  }

  // Drawing changes
  if (changes.drawings) {
    const drawingChangeCount = changes.drawings.added.length + 
                              changes.drawings.modified.length + 
                              changes.drawings.removed.length;
    if (drawingChangeCount > 0) {
      const parts: string[] = [];
      if (changes.drawings.added.length > 0) {
        parts.push(`${changes.drawings.added.length} added`);
      }
      if (changes.drawings.modified.length > 0) {
        parts.push(`${changes.drawings.modified.length} modified`);
      }
      if (changes.drawings.removed.length > 0) {
        parts.push(`${changes.drawings.removed.length} removed`);
      }
      formatted.push(`Drawing changes: ${parts.join(', ')}`);
    }
  }

  return formatted;
}

/**
 * Check if there are any significant changes
 */
export function hasSignificantChanges(changes: EnhancedDiagramChanges): boolean {
  return changes.nodes.added.length > 0 ||
         changes.nodes.modified.length > 0 ||
         changes.nodes.removed.length > 0 ||
         changes.edges.added.length > 0 ||
         changes.edges.modified.length > 0 ||
         changes.edges.removed.length > 0 ||
         changes.zones.added.length > 0 ||
         changes.zones.removed.length > 0 ||
         (changes.customContext?.changed || false) ||
         (changes.drawings ? 
           changes.drawings.added.length > 0 ||
           changes.drawings.modified.length > 0 ||
           changes.drawings.removed.length > 0 : false);
}

/**
 * Get a detailed summary of node changes for AI context
 */
export function getNodeChangeSummary(changes: EnhancedDiagramChanges): string {
  const summaries: string[] = [];

  // Added nodes with details
  if (changes.nodes.added.length > 0) {
    const details = changes.nodes.added.map(node => {
      const data = node.data as SecurityNodeData;
      return `${data.label} (${node.type}, Zone: ${data.zone})`;
    });
    summaries.push(`New components: ${details.join('; ')}`);
  }

  // Modified nodes with what changed
  if (changes.nodes.modified.length > 0) {
    const details = changes.nodes.modified.map(node => {
      const data = node.data as SecurityNodeData;
      return `${data.label} (${node.type})`;
    });
    summaries.push(`Modified components: ${details.join('; ')}`);
  }

  // Edge details
  if (changes.edges.added.length > 0) {
    const details = changes.edges.added.map(edge => {
      const data = edge.data as SecurityEdgeData;
      return `${edge.source} → ${edge.target} (${data?.protocol || 'unknown'})`;
    });
    summaries.push(`New connections: ${details.join('; ')}`);
  }

  return summaries.join('\n');
}