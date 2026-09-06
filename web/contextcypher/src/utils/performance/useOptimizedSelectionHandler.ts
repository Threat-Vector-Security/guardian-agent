import { useCallback, useRef } from 'react';
import { OnSelectionChangeFunc, Node, Edge } from '@xyflow/react';

interface OptimizedSelectionHandlerOptions {
  onSelectionChange?: (params: { nodes: Node[]; edges: Edge[] }) => void;
}

export const useOptimizedSelectionHandler = ({ 
  onSelectionChange 
}: OptimizedSelectionHandlerOptions): OnSelectionChangeFunc => {
  const lastSelectionRef = useRef<{ nodeIds: Set<string>; edgeIds: Set<string> }>({
    nodeIds: new Set(),
    edgeIds: new Set()
  });
  
  const selectionFrameRef = useRef<number | null>(null);
  
  const handleSelectionChange = useCallback<OnSelectionChangeFunc>((params) => {
    if (!onSelectionChange) return;
    
    const { nodes, edges } = params;
    
    // Create sets of current selection
    const currentNodeIds = new Set(nodes.map(n => n.id));
    const currentEdgeIds = new Set(edges.map(e => e.id));
    
    // Check if selection actually changed
    const nodesChanged = currentNodeIds.size !== lastSelectionRef.current.nodeIds.size ||
      Array.from(currentNodeIds).some(id => !lastSelectionRef.current.nodeIds.has(id));
    
    const edgesChanged = currentEdgeIds.size !== lastSelectionRef.current.edgeIds.size ||
      Array.from(currentEdgeIds).some(id => !lastSelectionRef.current.edgeIds.has(id));
    
    if (!nodesChanged && !edgesChanged) {
      return; // No actual change, skip update
    }
    
    // Update last selection
    lastSelectionRef.current = {
      nodeIds: currentNodeIds,
      edgeIds: currentEdgeIds
    };
    
    // Cancel any pending update
    if (selectionFrameRef.current !== null) {
      cancelAnimationFrame(selectionFrameRef.current);
    }
    
    // Schedule update on next frame to batch rapid selection changes
    selectionFrameRef.current = requestAnimationFrame(() => {
      onSelectionChange(params);
      selectionFrameRef.current = null;
    });
  }, [onSelectionChange]);
  
  return handleSelectionChange;
};