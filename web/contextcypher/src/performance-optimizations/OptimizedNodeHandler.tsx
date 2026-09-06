// OptimizedNodeHandler.tsx - Performance optimized onNodesChange handler
import { useCallback, useRef, useMemo } from 'react';
import { NodeChange } from '@xyflow/react';

interface OptimizedNodeHandlerProps {
  setNodes: React.Dispatch<React.SetStateAction<any[]>>;
  setEdges: React.Dispatch<React.SetStateAction<any[]>>;
  trackChanges: (data: any) => void;
  snapToGrid: boolean;
  GRID_SIZE: number;
  windowManager: any;
}

export const useOptimizedNodeHandler = ({
  setNodes,
  setEdges,
  trackChanges,
  snapToGrid,
  GRID_SIZE,
  windowManager
}: OptimizedNodeHandlerProps) => {
  
  // Batch position updates using a single RAF
  const positionUpdateQueue = useRef<Map<string, { x: number; y: number }>>(new Map());
  const positionFrameRef = useRef<number | null>(null);
  const changeTrackingRef = useRef<NodeJS.Timeout | null>(null);

  // Memoized grid snapping function
  const snapToGridFn = useMemo(() => {
    if (!snapToGrid) return null;
    return (value: number) => Math.round(value / GRID_SIZE) * GRID_SIZE;
  }, [snapToGrid, GRID_SIZE]);

  // Optimized position update batching
  const flushPositionUpdates = useCallback(() => {
    if (positionUpdateQueue.current.size === 0) return;

    const updates = Array.from(positionUpdateQueue.current.entries()).map(([id, position]) => ({
      id,
      type: 'position' as const,
      position: snapToGridFn ? {
        x: snapToGridFn(position.x),
        y: snapToGridFn(position.y)
      } : position
    }));

    positionUpdateQueue.current.clear();
    positionFrameRef.current = null;

    // Single state update for all position changes
    setNodes(currentNodes => {
      let hasChanges = false;
      const updatedNodes = currentNodes.map(node => {
        const update = updates.find(u => u.id === node.id);
        if (update && update.position) {
          hasChanges = true;
          return { ...node, position: update.position };
        }
        return node;
      });

      // Debounced change tracking (only once per batch)
      if (hasChanges) {
        if (changeTrackingRef.current) {
          clearTimeout(changeTrackingRef.current);
        }
        changeTrackingRef.current = setTimeout(() => {
          setEdges(currentEdges => {
            trackChanges({ nodes: updatedNodes, edges: currentEdges });
            return currentEdges;
          });
        }, 100); // Reduced from 250ms for better responsiveness
      }

      return updatedNodes;
    });
  }, [setNodes, setEdges, trackChanges, snapToGridFn]);

  // Optimized onNodesChange handler
  const onNodesChange = useCallback((changes: NodeChange[]) => {
    // Separate change types for optimal processing
    const positionChanges: NodeChange[] = [];
    const immediateChanges: NodeChange[] = [];

    changes.forEach(change => {
      if (change.type === 'position' && change.dragging && change.position) {
        // Queue position changes for batching
        positionUpdateQueue.current.set(change.id, change.position);
        positionChanges.push(change);
      } else {
        // Process other changes immediately
        immediateChanges.push(change);
      }
    });

    // Handle position changes with batching
    if (positionChanges.length > 0) {
      if (!positionFrameRef.current) {
        positionFrameRef.current = requestAnimationFrame(flushPositionUpdates);
      }
    }

    // Handle immediate changes (remove, select, etc.)
    if (immediateChanges.length > 0) {
      const hasRemovalChanges = immediateChanges.some(change => change.type === 'remove');
      
      if (hasRemovalChanges) {
        // Handle removals immediately for undo/redo
        setNodes(currentNodes => {
          const updatedNodes = currentNodes.filter(node => 
            !immediateChanges.some(change => 
              change.type === 'remove' && change.id === node.id
            )
          );
          
          // Update window manager
          immediateChanges.forEach(change => {
            if (change.type === 'remove') {
              windowManager.closeWindow('node', change.id);
            }
          });

          // Immediate change tracking for removals
          trackChanges({ nodes: updatedNodes, edges: [] }); // Will get current edges in trackChanges
          return updatedNodes;
        });
      } else {
        // Handle other immediate changes
        setNodes(currentNodes => {
          let hasChanges = false;
          const updatedNodes = currentNodes.map(node => {
            const change = immediateChanges.find(c => 'id' in c && c.id === node.id);
            if (change) {
              hasChanges = true;
              switch (change.type) {
                case 'select':
                  return { ...node, selected: change.selected };
                case 'dimensions':
                  return { ...node, width: change.dimensions?.width, height: change.dimensions?.height };
                default:
                  return node;
              }
            }
            return node;
          });

          return hasChanges ? updatedNodes : currentNodes;
        });
      }
    }
  }, [setNodes, setEdges, trackChanges, windowManager, flushPositionUpdates]);

  return { onNodesChange };
};