import { useEffect, useImperativeHandle, forwardRef, useRef } from 'react';
import { useUndoRedo } from '../hooks/useUndoRedo';

export interface UndoRedoControllerHandle {
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  takeSnapshot: () => void;
}

interface UndoRedoControllerProps {
  maxHistorySize?: number;
  enableShortcuts?: boolean;
  onStateChange?: (canUndo: boolean, canRedo: boolean) => void;
}

// This component must be rendered inside ReactFlow to access the useReactFlow hook
export const UndoRedoController = forwardRef<UndoRedoControllerHandle, UndoRedoControllerProps>(
  ({ maxHistorySize = 100, enableShortcuts = false, onStateChange }, ref) => {
    const { canUndo, canRedo, undo, redo, takeSnapshot } = useUndoRedo({
      maxHistorySize,
      enableShortcuts
    });

    // Track previous state to detect changes
    const prevStateRef = useRef({ canUndo, canRedo });

    // Notify parent when undo/redo state changes
    useEffect(() => {
      const prevState = prevStateRef.current;
      if (prevState.canUndo !== canUndo || prevState.canRedo !== canRedo) {
        onStateChange?.(canUndo, canRedo);
        prevStateRef.current = { canUndo, canRedo };
      }
    }, [canUndo, canRedo, onStateChange]);

    // Expose methods through ref
    useImperativeHandle(ref, () => ({
      undo,
      redo,
      canUndo,
      canRedo,
      takeSnapshot
    }), [undo, redo, canUndo, canRedo, takeSnapshot]);

    // This component doesn't render anything
    return null;
  }
);

UndoRedoController.displayName = 'UndoRedoController';