// OptimizedSelectionHandler.tsx - Performance optimized selection handling
import { useCallback, useRef, useMemo } from 'react';
import { Node } from '@xyflow/react';

interface OptimizedSelectionHandlerProps {
  setNodes: React.Dispatch<React.SetStateAction<any[]>>;
  setSelectedNodeIds: React.Dispatch<React.SetStateAction<string[]>>;
  nodes: any[];
}

export const useOptimizedSelectionHandler = ({
  setNodes,
  setSelectedNodeIds,
  nodes
}: OptimizedSelectionHandlerProps) => {
  
  const selectionFrameRef = useRef<number | null>(null);
  const lastSelectionRef = useRef<Set<string>>(new Set());

  // Memoized selection comparison
  const selectionComparator = useMemo(() => {
    return (newSelection: string[], oldSelection: Set<string>) => {
      if (newSelection.length !== oldSelection.size) return false;
      return newSelection.every(id => oldSelection.has(id));
    };
  }, []);

  // Optimized batch selection handler
  const onSelectionChange = useCallback(({ nodes: selectedNodes }: { nodes: Node[] }) => {
    const selectedIds = selectedNodes.map(node => node.id);
    
    // Skip if selection hasn't actually changed
    if (selectionComparator(selectedIds, lastSelectionRef.current)) {
      return;
    }

    // Cancel any pending selection update
    if (selectionFrameRef.current) {
      cancelAnimationFrame(selectionFrameRef.current);
    }

    // Update selection reference immediately
    lastSelectionRef.current = new Set(selectedIds);

    // Single RAF for all selection updates
    selectionFrameRef.current = requestAnimationFrame(() => {
      // Batch all selection state updates
      const updates = {
        nodeUpdates: new Map<string, boolean>(),
        selectedIds: selectedIds
      };

      // Calculate which nodes need selection state changes
      nodes.forEach(node => {
        const isSelected = selectedIds.includes(node.id);
        if (node.selected !== isSelected) {
          updates.nodeUpdates.set(node.id, isSelected);
        }
      });

      // Single state update for nodes if needed
      if (updates.nodeUpdates.size > 0) {
        setNodes(prevNodes => 
          prevNodes.map(node => {
            const newSelected = updates.nodeUpdates.get(node.id);
            return newSelected !== undefined 
              ? { ...node, selected: newSelected }
              : node;
          })
        );
      }

      // Update selected node IDs for edge animation
      setSelectedNodeIds(updates.selectedIds);
      
      selectionFrameRef.current = null;
    });
  }, [nodes, setNodes, setSelectedNodeIds, selectionComparator]);

  return { onSelectionChange };
};