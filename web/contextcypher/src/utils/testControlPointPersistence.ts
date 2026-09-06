/**
 * Test utility to verify control point persistence in save/load operations
 */

import { SecurityEdge } from '../types/SecurityTypes';

// Test edge with control points
export const testEdgeWithControlPoints: SecurityEdge = {
  id: 'test-edge-1',
  source: 'node-1',
  target: 'node-2',
  type: 'securityEdge',
  sourceHandle: 'right',
  targetHandle: 'left',
  data: {
    label: 'Test Connection',
    zone: 'DMZ',
    bidirectional: false,
    indexCode: 'WEB-DMZ-001-right-to-APP-INT-002-left',
    controlPoints: [
      {
        id: 'cp-1',
        x: 300,
        y: 200,
        active: true
      },
      {
        id: 'cp-2',
        x: 400,
        y: 250,
        active: true
      }
    ]
  }
};

// Function to verify control points are preserved
export function verifyControlPoints(originalEdge: SecurityEdge, loadedEdge: SecurityEdge): boolean {
  const originalCPs = originalEdge.data?.controlPoints || [];
  const loadedCPs = loadedEdge.data?.controlPoints || [];
  
  // Check if same number of control points
  if (originalCPs.length !== loadedCPs.length) {
    console.error('Control point count mismatch:', {
      original: originalCPs.length,
      loaded: loadedCPs.length
    });
    return false;
  }
  
  // Check each control point
  for (let i = 0; i < originalCPs.length; i++) {
    const original = originalCPs[i];
    const loaded = loadedCPs[i];
    
    if (!loaded) {
      console.error(`Missing control point at index ${i}`);
      return false;
    }
    
    if (original.x !== loaded.x || original.y !== loaded.y) {
      console.error(`Control point position mismatch at index ${i}:`, {
        original: { x: original.x, y: original.y },
        loaded: { x: loaded.x, y: loaded.y }
      });
      return false;
    }
    
    if (original.active !== loaded.active) {
      console.error(`Control point active state mismatch at index ${i}:`, {
        original: original.active,
        loaded: loaded.active
      });
      return false;
    }
  }
  
  console.log('✅ Control points preserved correctly');
  return true;
}

// Log edge data structure for debugging
export function logEdgeData(edge: SecurityEdge, label: string) {
  console.log(`\n=== ${label} ===`);
  console.log('Edge ID:', edge.id);
  console.log('Edge Data:', JSON.stringify(edge.data, null, 2));
  if (edge.data?.controlPoints) {
    console.log(`Control Points Count: ${edge.data.controlPoints.length}`);
    edge.data.controlPoints.forEach((cp, index) => {
      console.log(`  CP[${index}]: id=${cp.id}, x=${cp.x}, y=${cp.y}, active=${cp.active}`);
    });
  } else {
    console.log('No control points found');
  }
  console.log('================\n');
}