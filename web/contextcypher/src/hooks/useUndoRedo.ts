import { useState, useCallback, useEffect } from 'react';
import { useReactFlow } from '@xyflow/react';
import { SecurityNode, SecurityEdge } from '../types/SecurityTypes';

type UseUndoRedoOptions = {
  maxHistorySize?: number;
  enableShortcuts?: boolean;
};

type UseUndoRedo = (options?: UseUndoRedoOptions) => {
  undo: () => void;
  redo: () => void;
  takeSnapshot: () => void;
  canUndo: boolean;
  canRedo: boolean;
  clearHistory: () => void;
};

type HistoryItem = {
  nodes: SecurityNode[];
  edges: SecurityEdge[];
};

const defaultOptions: UseUndoRedoOptions = {
  maxHistorySize: 100,
  enableShortcuts: true,
};

// Based on React Flow Pro example pattern
// https://pro.reactflow.dev/examples/undo-redo
export const useUndoRedo: UseUndoRedo = ({
  maxHistorySize = defaultOptions.maxHistorySize,
  enableShortcuts = defaultOptions.enableShortcuts,
} = defaultOptions) => {
  // the past and future arrays store the states that we can jump to
  const [past, setPast] = useState<HistoryItem[]>([]);
  const [future, setFuture] = useState<HistoryItem[]>([]);

  const { setNodes, setEdges, getNodes, getEdges } = useReactFlow();

  const takeSnapshot = useCallback(() => {
    // Get current state
    const currentNodes = getNodes() as SecurityNode[];
    const currentEdges = getEdges() as SecurityEdge[];

    // push the current graph to the past state
    setPast((past) => [
      ...past.slice(Math.max(0, past.length - maxHistorySize! + 1)),
      { nodes: currentNodes, edges: currentEdges },
    ]);

    // whenever we take a new snapshot, the redo operations need to be cleared to avoid state mismatches
    setFuture([]);
  }, [getNodes, getEdges, maxHistorySize]);

  const undo = useCallback(() => {
    // get the last state that we want to go back to
    const pastState = past[past.length - 1];

    if (pastState) {
      // Get current state before undoing
      const currentNodes = getNodes() as SecurityNode[];
      const currentEdges = getEdges() as SecurityEdge[];
      
      // first we remove the state from the history
      setPast((past) => past.slice(0, past.length - 1));
      
      // we store the current graph for the redo operation
      setFuture((future) => [
        ...future,
        { nodes: currentNodes, edges: currentEdges },
      ]);
      
      // now we can set the graph to the past state
      setNodes(pastState.nodes);
      setEdges(pastState.edges);
    }
  }, [setNodes, setEdges, getNodes, getEdges, past]);

  const redo = useCallback(() => {
    const futureState = future[future.length - 1];

    if (futureState) {
      // Get current state before redoing
      const currentNodes = getNodes() as SecurityNode[];
      const currentEdges = getEdges() as SecurityEdge[];
      
      setFuture((future) => future.slice(0, future.length - 1));
      setPast((past) => [...past, { nodes: currentNodes, edges: currentEdges }]);
      setNodes(futureState.nodes);
      setEdges(futureState.edges);
    }
  }, [setNodes, setEdges, getNodes, getEdges, future]);

  const clearHistory = useCallback(() => {
    setPast([]);
    setFuture([]);
  }, []);

  useEffect(() => {
    // this effect is used to attach the global event handlers
    if (!enableShortcuts) {
      return;
    }

    const keyDownHandler = (event: KeyboardEvent) => {
      // Prevent shortcuts when typing in inputs
      const target = event.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.contentEditable === 'true') {
        return;
      }
      
      // Don't interfere with analysis panel
      if (target.closest('.analysis-panel-content') || target.closest('[data-testid="analysis-panel"]')) {
        return;
      }

      if (
        event.key?.toLowerCase() === 'z' &&
        (event.ctrlKey || event.metaKey) &&
        event.shiftKey
      ) {
        event.preventDefault();
        redo();
      } else if (
        event.key?.toLowerCase() === 'y' &&
        (event.ctrlKey || event.metaKey)
      ) {
        // Support Ctrl+Y for redo as well
        event.preventDefault();
        redo();
      } else if (
        event.key?.toLowerCase() === 'z' &&
        (event.ctrlKey || event.metaKey)
      ) {
        event.preventDefault();
        undo();
      }
    };

    // Use capture phase to intercept before other handlers
    document.addEventListener('keydown', keyDownHandler, true);

    return () => {
      document.removeEventListener('keydown', keyDownHandler, true);
    };
  }, [undo, redo, enableShortcuts]);

  return {
    undo,
    redo,
    takeSnapshot,
    canUndo: past.length > 0,
    canRedo: future.length > 0,
    clearHistory
  };
};

export default useUndoRedo;