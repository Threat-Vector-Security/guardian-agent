import { useCallback, useRef, useEffect } from 'react';
import { useReactFlow, Node, useStore, ReactFlowState } from '@xyflow/react';

interface SelectionBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface UseEnhancedSelectionOptions {
  enabled?: boolean;
  sensitivity?: number; // How much to expand the selection box (in pixels)
}

export const useEnhancedSelection = ({ 
  enabled = true, 
  sensitivity = 10 
}: UseEnhancedSelectionOptions = {}) => {
  const { getNodes, setNodes, screenToFlowPosition } = useReactFlow();
  const isSelecting = useStore((state: ReactFlowState) => state.userSelectionActive);
  const selectionBoxRef = useRef<SelectionBox | null>(null);
  const lastCheckedNodesRef = useRef<Set<string>>(new Set());
  const animationFrameRef = useRef<number | null>(null);
  const selectedNodesRef = useRef<Set<string>>(new Set());
  const checkCountRef = useRef(0);

  // Function to check if a node intersects with the selection box
  const nodeIntersectsSelection = useCallback((node: Node, selectionBox: SelectionBox): boolean => {
    if (!node.position) {
      return false;
    }

    // Use default dimensions if not available
    const nodeWidth = node.width ?? node.measured?.width ?? 150;
    const nodeHeight = node.height ?? node.measured?.height ?? 50;

    // Expand selection box by sensitivity amount for better detection
    const expandedBox = {
      x: selectionBox.x - sensitivity,
      y: selectionBox.y - sensitivity,
      width: selectionBox.width + sensitivity * 2,
      height: selectionBox.height + sensitivity * 2
    };

    const nodeBox = {
      x: node.position.x,
      y: node.position.y,
      width: nodeWidth,
      height: nodeHeight
    };

    // Check for intersection (even partial overlap counts)
    const intersects = !(
      nodeBox.x + nodeBox.width < expandedBox.x ||
      expandedBox.x + expandedBox.width < nodeBox.x ||
      nodeBox.y + nodeBox.height < expandedBox.y ||
      expandedBox.y + expandedBox.height < nodeBox.y
    );
    
    return intersects;
  }, [sensitivity]);

  // Enhanced selection check that runs more frequently
  const checkSelection = useCallback(() => {
    if (!enabled || !isSelecting) return;

    checkCountRef.current++;

    const selectionBox = document.querySelector('.react-flow__selectionpane');
    if (!selectionBox) return;

    const rect = selectionBox.getBoundingClientRect();
    const reactFlowBounds = document.querySelector('.react-flow__renderer')?.getBoundingClientRect() || 
                           document.querySelector('.react-flow')?.getBoundingClientRect();
    
    if (!reactFlowBounds) return;

    // Convert screen coordinates to flow coordinates
    const topLeft = screenToFlowPosition({
      x: rect.left,
      y: rect.top
    });
    
    const bottomRight = screenToFlowPosition({
      x: rect.right,
      y: rect.bottom
    });

    // Calculate selection box in flow coordinates
    const currentBox: SelectionBox = {
      x: Math.min(topLeft.x, bottomRight.x),
      y: Math.min(topLeft.y, bottomRight.y),
      width: Math.abs(bottomRight.x - topLeft.x),
      height: Math.abs(bottomRight.y - topLeft.y)
    };

    // Store current box
    selectionBoxRef.current = currentBox;

    // Get all nodes and check which ones should be selected
    const nodes = getNodes();
    
    nodes.forEach(node => {
      // Skip non-selectable nodes
      if (node.selectable === false) return;
      
      // Check if node intersects with selection box
      if (nodeIntersectsSelection(node, currentBox)) {
        // Add to cumulative selection (never remove during drag)
        selectedNodesRef.current.add(node.id);
      }
    });

    // Update all nodes with cumulative selection
    setNodes(nodes => 
      nodes.map(node => ({
        ...node,
        selected: selectedNodesRef.current.has(node.id)
      }))
    );
  }, [enabled, isSelecting, getNodes, setNodes, nodeIntersectsSelection, screenToFlowPosition]);

  // Run selection check on animation frame for smooth updates
  useEffect(() => {
    if (!enabled || !isSelecting) {
      // Reset when not selecting
      selectionBoxRef.current = null;
      lastCheckedNodesRef.current.clear();
      selectedNodesRef.current.clear();
      checkCountRef.current = 0;
      return;
    }

    const runCheck = () => {
      checkSelection();
      animationFrameRef.current = requestAnimationFrame(runCheck);
    };

    animationFrameRef.current = requestAnimationFrame(runCheck);

    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [enabled, isSelecting, checkSelection]);

  // Also listen for mouse move events during selection for extra sensitivity
  useEffect(() => {
    if (!enabled || !isSelecting) return;

    let lastMouseX = 0;
    let lastMouseY = 0;
    
    const handleMouseMove = (e: MouseEvent) => {
      // Only check if mouse has moved significantly (more than 5 pixels)
      const dx = Math.abs(e.clientX - lastMouseX);
      const dy = Math.abs(e.clientY - lastMouseY);
      
      if (dx > 5 || dy > 5) {
        lastMouseX = e.clientX;
        lastMouseY = e.clientY;
        // Trigger multiple checks for better coverage
        checkSelection();
        setTimeout(checkSelection, 10);
        setTimeout(checkSelection, 20);
      }
    };

    const handlePointerMove = (e: PointerEvent) => {
      if (e.pointerType !== 'touch') {
        return;
      }

      const dx = Math.abs(e.clientX - lastMouseX);
      const dy = Math.abs(e.clientY - lastMouseY);

      if (dx > 5 || dy > 5) {
        lastMouseX = e.clientX;
        lastMouseY = e.clientY;
        checkSelection();
        setTimeout(checkSelection, 10);
        setTimeout(checkSelection, 20);
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 0) return;
      const touch = e.touches[0];
      const dx = Math.abs(touch.clientX - lastMouseX);
      const dy = Math.abs(touch.clientY - lastMouseY);

      if (dx > 5 || dy > 5) {
        lastMouseX = touch.clientX;
        lastMouseY = touch.clientY;
        checkSelection();
        setTimeout(checkSelection, 10);
        setTimeout(checkSelection, 20);
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('pointermove', handlePointerMove, { passive: true });
    document.addEventListener('touchmove', handleTouchMove, { passive: true });
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('pointermove', handlePointerMove);
      document.removeEventListener('touchmove', handleTouchMove);
    };
  }, [enabled, isSelecting, checkSelection]);

  return {
    isSelecting,
    checkSelection
  };
};
