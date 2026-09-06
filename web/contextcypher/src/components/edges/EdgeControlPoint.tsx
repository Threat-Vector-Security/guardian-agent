import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useReactFlow, useStore } from '@xyflow/react';

export interface EdgeControlPointProps {
  id: string;
  edgeId: string;
  position: number; // 0 to 1 parameter along the edge
  offset: number; // perpendicular offset from the edge
  onUpdate: (position: number, offset: number) => void;
  onDelete?: () => void;
  color?: string;
}

export const EdgeControlPoint: React.FC<EdgeControlPointProps> = ({
  id,
  edgeId,
  position,
  offset,
  onUpdate,
  onDelete,
  color = '#1976d2'
}) => {
  const { screenToFlowPosition } = useReactFlow();
  const [dragging, setDragging] = useState(false);
  const [hover, setHover] = useState(false);
  const domNode = useStore((state) => state.domNode);
  const startDragRef = useRef<{ x: number; y: number; position: number; offset: number } | null>(null);

  // Get the actual x,y coordinates from the parent edge
  const [x, setX] = useState(0);
  const [y, setY] = useState(0);

  // Handle dragging with constrained movement
  useEffect(() => {
    if (!dragging || !domNode || !startDragRef.current) return;

    const handlePointerMove = (e: PointerEvent) => {
      const currentPos = screenToFlowPosition({ x: e.clientX, y: e.clientY });
      const startDrag = startDragRef.current;
      
      if (!startDrag) return;
      
      // Calculate movement delta
      const dx = currentPos.x - startDrag.x;
      const dy = currentPos.y - startDrag.y;
      
      // Update position along edge (simplified for now)
      // In a full implementation, this would project the movement onto the edge tangent
      const positionDelta = dx * 0.001; // Scale down for parameter space
      const newPosition = Math.max(0.1, Math.min(0.9, startDrag.position + positionDelta));
      
      // Update perpendicular offset
      const offsetDelta = dy * 0.5; // Scale for offset
      const newOffset = Math.max(-100, Math.min(100, startDrag.offset + offsetDelta));
      
      onUpdate(newPosition, newOffset);
    };

    const handlePointerUp = () => {
      setDragging(false);
      startDragRef.current = null;
    };

    domNode.addEventListener('pointermove', handlePointerMove);
    domNode.addEventListener('pointerup', handlePointerUp, { once: true });
    domNode.addEventListener('pointerleave', handlePointerUp, { once: true });

    return () => {
      domNode.removeEventListener('pointermove', handlePointerMove);
      domNode.removeEventListener('pointerup', handlePointerUp);
      domNode.removeEventListener('pointerleave', handlePointerUp);
    };
  }, [dragging, domNode, onUpdate, screenToFlowPosition]);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    e.stopPropagation();
    const pos = screenToFlowPosition({ x: e.clientX, y: e.clientY });
    startDragRef.current = { x: pos.x, y: pos.y, position, offset };
    setDragging(true);
  }, [position, offset, screenToFlowPosition]);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (onDelete) {
      onDelete();
    }
  }, [onDelete]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (e.key === 'Delete' || e.key === 'Backspace') {
      if (onDelete) {
        onDelete();
      }
    } else if (e.key === 'ArrowLeft') {
      const newPosition = Math.max(0.1, position - 0.05);
      onUpdate(newPosition, offset);
    } else if (e.key === 'ArrowRight') {
      const newPosition = Math.min(0.9, position + 0.05);
      onUpdate(newPosition, offset);
    } else if (e.key === 'ArrowUp') {
      const newOffset = Math.max(-100, offset - 5);
      onUpdate(position, newOffset);
    } else if (e.key === 'ArrowDown') {
      const newOffset = Math.min(100, offset + 5);
      onUpdate(position, newOffset);
    }
  }, [position, offset, onUpdate, onDelete]);

  return (
    <g transform={`translate(${x}, ${y})`}>
      {/* Large invisible hit area */}
      <circle
        r={25}
        fill="transparent"
        style={{ cursor: dragging ? 'grabbing' : 'grab' }}
        onPointerDown={handlePointerDown}
        onPointerEnter={() => setHover(true)}
        onPointerLeave={() => setHover(false)}
        onContextMenu={handleContextMenu}
      />
      
      {/* Visual feedback ring when hovering or dragging */}
      {(hover || dragging) && (
        <circle
          r={12}
          fill="none"
          stroke={color}
          strokeWidth={1}
          strokeOpacity={0.3}
          style={{ pointerEvents: 'none' }}
        />
      )}
      
      {/* Main control point */}
      <circle
        tabIndex={0}
        r={dragging || hover ? 6 : 5}
        fill="#fff"
        stroke={color}
        strokeWidth={dragging ? 3 : 2}
        style={{ 
          pointerEvents: 'none',
          transition: dragging ? 'none' : 'all 0.15s ease',
          filter: dragging ? 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))' : undefined
        }}
        onKeyDown={handleKeyDown}
      />
      
      {/* Center dot for better visibility */}
      <circle
        r={2}
        fill={color}
        style={{ pointerEvents: 'none' }}
      />
    </g>
  );
};

// Helper to calculate position on a cubic bezier curve
export function getPointOnCubicBezier(
  p0: { x: number; y: number },
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  p3: { x: number; y: number },
  t: number
): { x: number; y: number } {
  const t2 = t * t;
  const t3 = t2 * t;
  const mt = 1 - t;
  const mt2 = mt * mt;
  const mt3 = mt2 * mt;

  const x = mt3 * p0.x + 3 * mt2 * t * p1.x + 3 * mt * t2 * p2.x + t3 * p3.x;
  const y = mt3 * p0.y + 3 * mt2 * t * p1.y + 3 * mt * t2 * p2.y + t3 * p3.y;

  return { x, y };
}