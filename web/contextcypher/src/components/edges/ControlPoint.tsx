import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useReactFlow, useStore } from '@xyflow/react';
import type { ControlPointData } from '../../types/SecurityTypes';
import { controlPointEvents } from '../../utils/controlPointEvents';
import { colors } from '../../styles/Theme';
import { useSettings } from '../../settings/SettingsContext';

export interface ControlPointProps {
  id: string;
  index: number;
  x: number;
  y: number;
  edgeId: string;
  onPositionChange: (index: number, position: { x: number; y: number }) => void;
  onDelete?: (index: number) => void;
  isActive?: boolean;
  color?: string;
}

export const ControlPoint: React.FC<ControlPointProps> = ({
  id,
  index,
  x,
  y,
  edgeId,
  onPositionChange,
  onDelete,
  isActive = false,
  color = colors.primary || '#1976d2'
}) => {
  const { screenToFlowPosition } = useReactFlow();
  const [dragging, setDragging] = useState(false);
  const [hover, setHover] = useState(false);
  const pointRef = useRef<SVGCircleElement>(null);
  const domNode = useStore((state) => state.domNode);
  const { settings } = useSettings();
  const snapToGrid = settings.snapToGrid ?? true;
  const GRID_SIZE = 50;

  // Handle dragging
  useEffect(() => {
    if (!dragging || !domNode) return;

    const handlePointerMove = (e: PointerEvent) => {
      const position = screenToFlowPosition({ x: e.clientX, y: e.clientY });
      onPositionChange(index, position);
    };

    const handlePointerUp = () => {
      setDragging(false);
      controlPointEvents.emitDragEnd();
    };

    domNode.addEventListener('pointermove', handlePointerMove);
    domNode.addEventListener('pointerup', handlePointerUp, { once: true });

    return () => {
      domNode.removeEventListener('pointermove', handlePointerMove);
      domNode.removeEventListener('pointerup', handlePointerUp);
    };
  }, [dragging, domNode, index, onPositionChange, screenToFlowPosition]);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    e.stopPropagation();
    setDragging(true);
    controlPointEvents.emitDragStart();
    controlPointEvents.emitClick();
  }, []);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (onDelete) {
      onDelete(index);
    }
  }, [index, onDelete]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      e.stopPropagation();
      if (onDelete) {
        onDelete(index);
      }
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      const moveAmount = snapToGrid ? GRID_SIZE : 5;
      onPositionChange(index, { x: x - moveAmount, y });
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      const moveAmount = snapToGrid ? GRID_SIZE : 5;
      onPositionChange(index, { x: x + moveAmount, y });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const moveAmount = snapToGrid ? GRID_SIZE : 5;
      onPositionChange(index, { x, y: y - moveAmount });
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const moveAmount = snapToGrid ? GRID_SIZE : 5;
      onPositionChange(index, { x, y: y + moveAmount });
    }
  }, [index, x, y, onPositionChange, onDelete, snapToGrid]);

  return (
    <g 
      transform={`translate(${x}, ${y})`} 
      style={{ zIndex: 1000, pointerEvents: 'all', opacity: hover || dragging ? 1 : 0.7 }}
      onMouseEnter={(e) => e.stopPropagation()}
      onMouseLeave={(e) => e.stopPropagation()}
      onMouseMove={(e) => e.stopPropagation()}
      onPointerEnter={(e) => e.stopPropagation()}
      onPointerLeave={(e) => e.stopPropagation()}
      onPointerMove={(e) => e.stopPropagation()}
    >
      {/* Large hit area - 25px radius = 50px diameter total clickable area */}
      <circle
        r={25}
        fill="transparent"
        style={{ 
          cursor: dragging ? 'grabbing' : 'grab',
          pointerEvents: 'all'
        }}
        onPointerDown={handlePointerDown}
        onPointerEnter={(e) => {
          e.stopPropagation();
          setHover(true);
        }}
        onPointerLeave={(e) => {
          e.stopPropagation();
          setHover(false);
        }}
        onPointerMove={(e) => {
          e.stopPropagation();
        }}
        onClick={(e) => {
          e.stopPropagation();
        }}
        onMouseDown={(e) => {
          e.stopPropagation();
        }}
        onMouseEnter={(e) => {
          e.stopPropagation();
        }}
        onMouseLeave={(e) => {
          e.stopPropagation();
        }}
        onMouseMove={(e) => {
          e.stopPropagation();
        }}
        onContextMenu={handleContextMenu}
        onKeyDown={handleKeyDown}
        tabIndex={0}
      />
      
      {/* Visual feedback - shows the full interactive area */}
      {(hover || dragging) && (
        <>
          {/* Outer ring showing full hit area */}
          <circle
            r={25}
            fill={`${color}08`}
            stroke={color}
            strokeWidth={1}
            strokeOpacity={0.2}
            strokeDasharray="2 2"
            style={{ pointerEvents: 'none' }}
          />
          {/* Inner highlight */}
          <circle
            r={10}
            fill={`${color}20`}
            stroke={color}
            strokeWidth={1}
            strokeOpacity={0.5}
            style={{ pointerEvents: 'none' }}
          />
        </>
      )}
      
      {/* Control point with double circle for better visibility */}
      <circle
        ref={pointRef}
        r={6}
        fill="white"
        stroke={color}
        strokeWidth={2}
        style={{ 
          pointerEvents: 'none',
          filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.1))'
        }}
      />
      <circle
        r={3}
        fill={color}
        style={{ pointerEvents: 'none' }}
      />
      
      {/* Tooltip on hover */}
      {hover && !dragging && (
        <text
          y={-15}
          textAnchor="middle"
          style={{
            fontSize: '10px',
            fill: color,
            pointerEvents: 'none',
            fontFamily: 'inherit',
            filter: 'drop-shadow(0 1px 2px rgba(255,255,255,0.8))'
          }}
        >
          Drag to move • Right-click to delete
        </text>
      )}
    </g>
  );
};