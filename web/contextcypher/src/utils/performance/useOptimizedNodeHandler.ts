import { useCallback, useRef } from 'react';
import { NodeChange, applyNodeChanges } from '@xyflow/react';
import { SecurityNode } from '../../types/SecurityTypes';

interface OptimizedNodeHandlerOptions {
  onNodesChange: (changes: NodeChange[]) => void;
  onBeforeRemove?: (nodeIds: string[]) => void;
}

export const useOptimizedNodeHandler = ({ 
  onNodesChange, 
  onBeforeRemove 
}: OptimizedNodeHandlerOptions) => {
  const positionBufferRef = useRef<Map<string, { x: number; y: number }>>(new Map());
  const positionUpdateFrameRef = useRef<number | null>(null);
  const immediateChangesRef = useRef<NodeChange[]>([]);
  
  const flushPositionBuffer = useCallback(() => {
    if (positionBufferRef.current.size === 0) return;
    
    const bufferedChanges: NodeChange[] = Array.from(positionBufferRef.current.entries()).map(([id, position]) => ({
      id,
      type: 'position' as const,
      position
    }));
    
    // Clear buffer
    positionBufferRef.current.clear();
    
    // Apply all position changes in one batch
    onNodesChange(bufferedChanges);
  }, [onNodesChange]);
  
  const handleNodesChange = useCallback((changes: NodeChange[]) => {
    // Separate changes by type
    const positionChanges: NodeChange[] = [];
    const immediateChanges: NodeChange[] = [];
    const removeChanges: NodeChange[] = [];
    
    changes.forEach(change => {
      if (change.type === 'position') {
        positionChanges.push(change);
      } else if (change.type === 'remove') {
        removeChanges.push(change);
      } else {
        immediateChanges.push(change);
      }
    });
    
    // Handle removals first
    if (removeChanges.length > 0 && onBeforeRemove) {
      const nodeIds = removeChanges
        .filter((change): change is NodeChange & { id: string } => 'id' in change)
        .map(change => change.id);
      onBeforeRemove(nodeIds);
    }
    
    // Apply immediate changes right away
    if (immediateChanges.length > 0 || removeChanges.length > 0) {
      onNodesChange([...immediateChanges, ...removeChanges]);
    }
    
    // Buffer position changes
    if (positionChanges.length > 0) {
      positionChanges.forEach(change => {
        if (change.type === 'position' && change.position) {
          positionBufferRef.current.set(change.id, change.position);
        }
      });
      
      // Cancel any pending frame
      if (positionUpdateFrameRef.current !== null) {
        cancelAnimationFrame(positionUpdateFrameRef.current);
      }
      
      // Schedule update on next animation frame
      positionUpdateFrameRef.current = requestAnimationFrame(() => {
        flushPositionBuffer();
        positionUpdateFrameRef.current = null;
      });
    }
  }, [onNodesChange, onBeforeRemove, flushPositionBuffer]);
  
  return handleNodesChange;
};