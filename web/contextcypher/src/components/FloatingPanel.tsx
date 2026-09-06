import React, { useState, useRef, useEffect } from 'react';
import { 
  Paper, 
  IconButton, 
  Box, 
  Typography,
  useTheme,
  styled,
  Collapse,
  Tooltip
} from '@mui/material';
import {
  Close as CloseIcon,
  Minimize as MinimizeIcon,
  CropSquare as RestoreIcon,
  DragIndicator as DragIcon,
  PushPin as DockIcon,
  PushPinOutlined as UndockIcon
} from '@mui/icons-material';
import Draggable, { DraggableData, DraggableEvent } from 'react-draggable';
import { getResponsivePanelWidths } from '../styles/layout';
import useViewportLayout from '../hooks/useViewportLayout';
import { fitPanel } from '../utils/panelBounds';
// Removed react-resizable import - using CSS resize instead

interface FloatingPanelProps {
  id: string;
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  initialPosition?: { x: number; y: number };
  initialSize?: { width: number; height: number };
  minWidth?: number;
  minHeight?: number;
  maxWidth?: number;
  maxHeight?: number;
  zIndex?: number;
  onFocus?: () => void;
  isActive?: boolean;
  isSelected?: boolean; // highlight when associated canvas element is selected
  accentColor?: string; // zone-based accent color for selected highlight
  accentShadowColor?: string; // rgba shadow color for pulsing glow
  bounds?: string | { left: number; top: number; right: number; bottom: number };
  disableDrag?: boolean;
  titleColor?: string;
}

const StyledPaper = styled(Paper)<{ isActive?: boolean; isMinimized?: boolean; isMaximized?: boolean; isDragging?: boolean; isSelected?: boolean; accentColor?: string; accentShadowColor?: string; animationName?: string }>(
  ({ theme, isActive, isMinimized, isMaximized, isDragging, isSelected, accentColor, accentShadowColor, animationName }) => ({
  position: 'absolute',
  backgroundColor: theme.colors.surface,
  border: `1px solid ${ isSelected ? (accentColor || theme.colors.primary) : (isActive && !isMinimized ? theme.colors.primary : theme.colors.border)}`,
  borderRadius: '8px',
  boxShadow: isSelected
    ? `0 8px 24px ${accentShadowColor || 'rgba(0,0,0,0.25)'}, 0 0 0 2px ${accentColor || theme.colors.primary}`
    : (isActive ? `0 6px 18px rgba(0,0,0,0.25), 0 0 0 1px ${theme.colors.primary}` : '0 4px 16px rgba(0, 0, 0, 0.2)'),
  transition: isDragging ? 'none' : 'box-shadow 0.2s ease, border-color 0.2s ease',
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column',
  willChange: isDragging ? 'transform' : 'auto',
  transform: 'translateZ(0)', // Force GPU acceleration
  backfaceVisibility: 'hidden', // Prevent flicker
  isolation: 'isolate', // Create new stacking context to prevent overlap issues
  animation: isSelected && animationName ? `${animationName} 1.6s ease-in-out infinite` : 'none',
  ...(animationName ? {
    ["@keyframes " + animationName]: {
      '0%': { boxShadow: `0 0 0 0 ${accentShadowColor || 'rgba(0,0,0,0.25)'}, 0 0 0 2px ${accentColor || theme.colors.primary}` },
      '50%': { boxShadow: `0 0 18px 4px ${accentShadowColor || 'rgba(0,0,0,0.25)'}, 0 0 0 2px ${accentColor || theme.colors.primary}` },
      '100%': { boxShadow: `0 0 0 0 ${accentShadowColor || 'rgba(0,0,0,0.25)'}, 0 0 0 2px ${accentColor || theme.colors.primary}` }
    }
  } : {}),
  ...(isMinimized && {
    height: 'auto !important',
    minWidth: 0,
    resize: 'none'
  }),
  ...(!isMinimized && !isMaximized && {
    resize: 'both',
    width: 'auto',
    minHeight: '200px',
    maxHeight: 'calc(100dvh - 100px)',
    height: 'auto' // Auto height based on content
  })
}));

const PanelHeader = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexShrink: 0,
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '8px 12px',
  backgroundColor: theme.colors.surfaceHover,
  borderBottom: `1px solid ${theme.colors.border}`,
  cursor: 'move',
  userSelect: 'none',
  '&:hover': {
    backgroundColor: theme.colors.surfaceHover
  }
}));

const PanelContent = styled(Box)({
  display: 'flex',
  flexDirection: 'column',
  flex: 1,
  minHeight: 0, // Important for flexbox
  overflow: 'auto'
});

const WindowControls = styled(Box)({
  display: 'flex',
  gap: '4px',
  alignItems: 'center'
});

const DEFAULT_FLOATING_SIZE = {
  width: getResponsivePanelWidths(typeof window !== 'undefined' ? window.innerWidth : 1440).floatingEditor,
  height: 600
};


const FloatingPanel: React.FC<FloatingPanelProps> = ({
  id,
  title,
  children,
  onClose,
  initialPosition = { x: 100, y: 100 },
  initialSize = DEFAULT_FLOATING_SIZE,
  minWidth = 300,
  minHeight = 200,
  maxWidth = 800,
  maxHeight = 900,
  zIndex = 1000,
  onFocus,
  isActive = false,
  isSelected = false,
  accentColor,
  accentShadowColor,
  bounds = 'parent',
  disableDrag = false,
  titleColor,
}) => {
  const theme = useTheme();
  const { viewport } = useViewportLayout();
  const nodeRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState(initialPosition);
  const [size, setSize] = useState(initialSize);
  const [isMaximized, setIsMaximized] = useState(false); // Maximize feature disabled
  const [isMinimized, setIsMinimized] = useState(false);
  const [isDocked, setIsDocked] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [previousState, setPreviousState] = useState({
    position: initialPosition,
    size: initialSize
  });
  const panelBounds = typeof bounds === 'object' ? bounds : { left: 0, top: 0, right: viewport.width, bottom: viewport.height };
  const fitted = fitPanel(position, { width: Math.min(maxWidth, Math.max(minWidth, size.width)), height: isMinimized ? 48 : Math.min(maxHeight, Math.max(minHeight, size.height)) }, panelBounds);
  useEffect(() => {
    setPosition(previous => previous.x === fitted.x && previous.y === fitted.y ? previous : { x: fitted.x, y: fitted.y });
  }, [fitted.x, fitted.y]);
  useEffect(() => {
    if (!nodeRef.current || isMinimized) return;
    const observer = new ResizeObserver(() => {
      const element = nodeRef.current;
      if (!element) return;
      const next = { width: element.offsetWidth, height: element.offsetHeight };
      setSize(previous => previous.width === next.width && previous.height === next.height ? previous : next);
    });
    observer.observe(nodeRef.current);
    return () => observer.disconnect();
  }, [isMinimized]);

  // Handle drag
  const handleDragStart = () => {
    setIsDragging(true);
  };

  const handleDrag = (e: DraggableEvent, data: DraggableData) => {
    // Use RAF to throttle position updates for smooth performance
    requestAnimationFrame(() => {
      setPosition({ x: data.x, y: data.y });
    });
  };

  const handleDragStop = () => {
    setIsDragging(false);
  };

  // Note: We're using CSS resize instead of programmatic resize
  // The size is tracked automatically by the browser

  // Maximize feature removed

  // Toggle minimize
  const toggleMinimize = () => {
    setIsMinimized(!isMinimized);
    if (isMaximized) {
      setIsMaximized(false);
      setPosition(previousState.position);
      setSize(previousState.size);
    }
  };

  // Toggle dock
  const handleDock = () => {
    if (isDocked) {
      // Undock - restore previous position
      setPosition(previousState.position);
      setSize(previousState.size);
      setIsDocked(false);
      setIsMinimized(false); // Restore full view when undocking
    } else {
      // Dock
      setPreviousState({ position, size });

      const headerH = 48; // Approx header height
      const gap = 8;
      const dockWidth = Math.min(maxWidth, Math.max(minWidth, size.width));
      const columnGap = 10;

      const topOffset = (typeof bounds === 'object' && bounds !== null) ? bounds.top + 10 : 74; // 10px below top bar
      const rightEdge = panelBounds.right;
      const availableHeight = panelBounds.bottom - topOffset;
      const perColumn = Math.max(1, Math.floor(availableHeight / (headerH + gap)));

      // Build occupied slots set from existing docked panels
      const occupied = new Set<string>();
      const nodes = nodeRef.current?.parentElement?.querySelectorAll('.floating-panel-docked') || [];
      const parentRect = nodeRef.current?.parentElement?.getBoundingClientRect();
      nodes.forEach((el) => {
        const rect = el.getBoundingClientRect();
        const y = Math.max(0, rect.top - (parentRect?.top || 0) - topOffset);
        const row = Math.round(y / (headerH + gap));

        const expectedX0 = rightEdge - dockWidth - columnGap; // column 0 x
        const deltaX = expectedX0 - (rect.left - (parentRect?.left || 0));
        const col = Math.max(0, Math.round(deltaX / (dockWidth + columnGap)));
        occupied.add(`${col}:${row}`);
      });

      // Find first free slot scanning columns left-to-right and rows top-to-bottom
      let chosenCol = 0;
      let chosenRow = 0;
      const maxColumns = 10; // safety cap
      outer: for (let c = 0; c < maxColumns; c++) {
        for (let r = 0; r < perColumn; r++) {
          if (!occupied.has(`${c}:${r}`)) {
            chosenCol = c;
            chosenRow = r;
            break outer;
          }
        }
      }

      let dockedX = rightEdge - dockWidth - columnGap - chosenCol * (dockWidth + columnGap);
      let dockedY = topOffset + chosenRow * (headerH + gap);

      setPosition({ x: dockedX, y: dockedY });
      setIsDocked(true);
      setIsMinimized(true); // Auto-minimise when docked
    }
    setIsMaximized(false);
  };

  // Handle focus
  const handleMouseDown = () => {
    if (onFocus) {
      onFocus();
    }
  };

  const content = (
    <StyledPaper
      className={isDocked ? 'floating-panel-docked' : ''}
      ref={nodeRef}
      elevation={3}
      isActive={isActive}
      isSelected={isSelected}
      accentColor={accentColor}
      accentShadowColor={accentShadowColor}
      animationName={`panelPulse-${id}`}
      isMinimized={isMinimized}
      isMaximized={isMaximized}
      isDragging={isDragging}
      style={{ 
        zIndex: (isDocked && isMinimized) ? 100 : zIndex + (isActive ? 1000 : 0),
        boxSizing: 'border-box',
        width: fitted.width,
        height: isMinimized ? 'auto' : fitted.height,
        minWidth: Math.min(minWidth, panelBounds.right - fitted.x),
        maxWidth: Math.min(maxWidth, panelBounds.right - fitted.x),
        minHeight: isMinimized ? 'auto' : Math.min(minHeight, panelBounds.bottom - fitted.y),
        maxHeight: panelBounds.bottom - fitted.y
      }}
      onMouseDown={handleMouseDown}
    >
      <PanelHeader className="floating-panel-header">
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1, minWidth: 0 }}>
          <DragIcon sx={{ fontSize: 20, color: theme.colors.textSecondary }} />
          
          {/* Dock button on the left side */}
          <Tooltip title={isDocked ? "Undock window" : "Dock window"}>
            <IconButton
              size="small"
              onClick={handleDock}
              sx={{ 
                color: isDocked ? theme.colors.primary : theme.colors.textSecondary,
                '&:hover': { color: theme.colors.primary }
              }}
            >
              {isDocked ? <DockIcon fontSize="small" /> : <UndockIcon fontSize="small" />}
            </IconButton>
          </Tooltip>
          
          <Typography variant="subtitle2" sx={{ fontWeight: 500, color: titleColor || 'inherit', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {title}
          </Typography>
        </Box>
        
        <WindowControls sx={{ flexShrink: 0 }}>
          <Tooltip title={isMinimized ? "Maximize" : "Minimize"}>
            <IconButton
              size="small"
              onClick={toggleMinimize}
              sx={{ 
                color: theme.colors.textSecondary,
                '&:hover': { color: theme.colors.primary }
              }}
            >
              {isMinimized ? <RestoreIcon fontSize="small" /> : <MinimizeIcon fontSize="small" />}
            </IconButton>
          </Tooltip>
          
          {/* Maximize button removed */}
          
          <Tooltip title="Close">
            <IconButton
              size="small"
              onClick={onClose}
              sx={{ 
                color: theme.colors.textSecondary,
                '&:hover': { color: theme.colors.error }
              }}
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </WindowControls>
      </PanelHeader>
      
      <Collapse in={!isMinimized} timeout={200} sx={{ minHeight: 0, overflow: 'auto', '& .MuiCollapse-wrapperInner': { minWidth: 0 } }}>
        <PanelContent>
          {children}
        </PanelContent>
      </Collapse>
    </StyledPaper>
  );

  if (isMaximized) {
    // When maximized, render without Draggable wrapper
    return content;
  }

  return (
    <Draggable
      nodeRef={nodeRef}
      handle=".floating-panel-header"
      position={{ x: fitted.x, y: fitted.y }}
      onStart={handleDragStart}
      onDrag={handleDrag}
      onStop={handleDragStop}
      bounds={{ left: panelBounds.left, top: panelBounds.top, right: panelBounds.right - fitted.width, bottom: panelBounds.bottom - fitted.height }}
      disabled={isMaximized || isDocked || disableDrag}
      enableUserSelectHack={false}
      grid={[1, 1]}
      defaultClassName=""
      defaultClassNameDragging=""
      defaultClassNameDragged=""
    >
      {content}
    </Draggable>
  );
};

export default FloatingPanel;
