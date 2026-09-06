import { SecurityNode, SecurityEdge } from '../types/SecurityTypes';

/**
 * Generate a unique label for a node based on its type and existing nodes
 */
export function generateUniqueNodeLabel(
  nodeType: string,
  existingNodes: SecurityNode[],
  baseLabel?: string
): string {
  const base = baseLabel || formatNodeTypeToLabel(nodeType);
  
  // Get all existing labels that start with the base label
  const existingLabels = new Set(
    existingNodes
      .map(n => n.data?.label || '')
      .filter(label => label.startsWith(base))
  );
  
  // If base label doesn't exist, use it
  if (!existingLabels.has(base)) {
    return base;
  }
  
  // Find the next available number
  let counter = 1;
  while (existingLabels.has(`${base} ${counter}`)) {
    counter++;
  }
  
  return `${base} ${counter}`;
}

/**
 * Generate a unique label for an edge based on its source and target
 */
export function generateUniqueEdgeLabel(
  sourceNode: SecurityNode | undefined,
  targetNode: SecurityNode | undefined,
  existingEdges: SecurityEdge[],
  baseLabel?: string
): string {
  const base = baseLabel || 
    `${sourceNode?.data?.label || 'Unknown'} to ${targetNode?.data?.label || 'Unknown'}`;
  
  // Get all existing edge labels
  const existingLabels = new Set(
    existingEdges
      .map(e => e.data?.label || '')
      .filter(label => label.startsWith(base))
  );
  
  // If base label doesn't exist, use it
  if (!existingLabels.has(base)) {
    return base;
  }
  
  // Find the next available number
  let counter = 1;
  while (existingLabels.has(`${base} ${counter}`)) {
    counter++;
  }
  
  return `${base} ${counter}`;
}

/**
 * Check if a node label already exists (case-insensitive)
 */
export function isNodeLabelDuplicate(
  label: string,
  existingNodes: SecurityNode[],
  excludeNodeId?: string
): boolean {
  const lowerLabel = label.toLowerCase().trim();
  return existingNodes.some(node => {
    if (excludeNodeId && node.id === excludeNodeId) return false;
    return node.data?.label?.toLowerCase().trim() === lowerLabel;
  });
}

/**
 * Check if an edge label already exists (case-insensitive)
 */
export function isEdgeLabelDuplicate(
  label: string,
  existingEdges: SecurityEdge[],
  excludeEdgeId?: string
): boolean {
  const lowerLabel = label.toLowerCase().trim();
  return existingEdges.some(edge => {
    if (excludeEdgeId && edge.id === excludeEdgeId) return false;
    return edge.data?.label?.toLowerCase().trim() === lowerLabel;
  });
}

/**
 * Get a suggested unique label based on the current label
 */
export function getSuggestedUniqueLabel(
  currentLabel: string,
  isDuplicate: (label: string) => boolean
): string {
  let baseLabel = currentLabel.replace(/\s+\d+$/, '').trim(); // Remove trailing number
  let counter = 1;
  
  // Extract existing number if any
  const match = currentLabel.match(/\s+(\d+)$/);
  if (match) {
    counter = parseInt(match[1], 10) + 1;
  }
  
  let suggestedLabel = currentLabel;
  while (isDuplicate(suggestedLabel)) {
    suggestedLabel = `${baseLabel} ${counter}`;
    counter++;
  }
  
  return suggestedLabel;
}

/**
 * Format node type to human-readable label
 */
export function formatNodeTypeToLabel(nodeType: string): string {
  // Handle camelCase to Title Case
  const formatted = nodeType
    .replace(/([A-Z])/g, ' $1')
    .trim()
    .replace(/^./, str => str.toUpperCase());
  
  // Special cases
  const specialCases: Record<string, string> = {
    'Iot Device': 'IoT Device',
    'Api Gateway': 'API Gateway',
    'Ai Service': 'AI Service',
    'Ml Model': 'ML Model',
    'Vpn Server': 'VPN Server',
    'Ids Sensor': 'IDS Sensor',
    'Ips System': 'IPS System',
    'Siem Server': 'SIEM Server',
    'Plc Device': 'PLC Device',
    'Hmi Terminal': 'HMI Terminal',
    'Scada Server': 'SCADA Server',
    'Rtu Device': 'RTU Device',
    'Ied Device': 'IED Device'
  };
  
  return specialCases[formatted] || formatted;
} 