import React, { useCallback, useImperativeHandle, forwardRef, ReactNode, useRef, useState, useEffect } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  ControlButton,
  MiniMap,
  SelectionMode,
  OnNodeDrag,
  SelectionDragHandler,
  OnNodesDelete,
  OnEdgesDelete,
  ConnectionMode,
  ReactFlowInstance,
  NodeMouseHandler,
  EdgeMouseHandler,
  OnSelectionChangeFunc,
  IsValidConnection,
  OnConnectStart,
  OnConnectEnd,
  PanOnScrollMode,
  useUpdateNodeInternals,
  useStore,
  useReactFlow,
} from '@xyflow/react';
import {
  Lock as LockIcon,
  LockOpen as LockOpenIcon,
  Maximize2 as Maximize2Icon,
  Grid as GridIcon,
  Undo,
  Redo
} from 'lucide-react';
import { Box, Tooltip } from '@mui/material';
import { UndoRedoController, UndoRedoControllerHandle } from './UndoRedoController';
import { getTheme } from '../styles/Theme';
import { useSettings } from '../settings/SettingsContext';
import { ZoomIn, ZoomOut } from 'lucide-react';
import { EnhancedSelectionHandler } from './EnhancedSelectionHandler';
import { useViewState } from '../contexts/ViewStateContext';
import useViewportLayout from '../hooks/useViewportLayout';

export interface DiagramEditorInnerHandle {
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  takeSnapshot: () => void;
  updateAllNodeInternals: () => void;
}

export interface DiagramEditorInnerProps {
  nodes: any[];
  edges: any[];
  onNodesChange: any;
  onEdgesChange: any;
  onNodeDoubleClick: any;
  onEdgeDoubleClick: any;
  onNodeClick?: NodeMouseHandler;
  onEdgeClick?: EdgeMouseHandler;
  onNodeMouseEnter?: NodeMouseHandler;
  onNodeMouseLeave?: NodeMouseHandler;
  onEdgeMouseEnter?: EdgeMouseHandler;
  onEdgeMouseLeave?: EdgeMouseHandler;
  onSelectionChange?: OnSelectionChangeFunc;
  onConnect: any;
  onInit: (instance: ReactFlowInstance) => void;
  onDrop: any;
  onDragOver: any;
  onNodeContextMenu?: any;
  onPaneClick: any;
  onMouseDown: any;
  onKeyDown: any;
  onKeyUp: any;
  isInteractiveLocked: boolean;
  snapToGrid: boolean;
  showGrid: boolean;
  showMinimap: boolean;
  onToggleInteractiveLock?: () => void;
  onCenterCanvas?: () => void;
  onToggleSnapToGrid?: () => void;
  nodeTypes: any;
  edgeTypes: any;
  defaultEdgeOptions: any;
  isValidConnection?: IsValidConnection;
  onConnectStart?: OnConnectStart;
  onConnectEnd?: OnConnectEnd;
  onEdgeUpdate?: any;
  proOptions?: any;
  reactFlowInstance: ReactFlowInstance | null;
  children?: ReactNode;
  currentDrawingTool?: string;
  isDrawingEditMode?: boolean;
  touchMultiSelectMode?: boolean;
}

export const DiagramEditorInner = forwardRef<DiagramEditorInnerHandle, DiagramEditorInnerProps>(({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  onNodeDoubleClick,
  onEdgeDoubleClick,
  onNodeClick,
  onEdgeClick,
  onNodeMouseEnter,
  onNodeMouseLeave,
  onEdgeMouseEnter,
  onEdgeMouseLeave,
  onSelectionChange,
  onConnect,
  onInit,
  onDrop,
  onDragOver,
  onNodeContextMenu,
  onPaneClick,
  onMouseDown,
  onKeyDown,
  onKeyUp,
  isInteractiveLocked,
  snapToGrid,
  showGrid,
  showMinimap,
  onToggleInteractiveLock,
  onCenterCanvas,
  onToggleSnapToGrid,
  nodeTypes,
  edgeTypes,
  defaultEdgeOptions,
  isValidConnection,
  onConnectStart,
  onConnectEnd,
  onEdgeUpdate,
  proOptions,
  reactFlowInstance,
  children,
  currentDrawingTool,
  isDrawingEditMode,
  touchMultiSelectMode = false
}, ref) => {
  const { settings } = useSettings();
  const currentTheme = getTheme(settings.theme, settings.customTheme);
  const { view2D, setView2DState } = useViewState();
  const { viewportTier } = useViewportLayout();
  const isSmallTouchLayout = viewportTier === 'xs' || viewportTier === 'sm';
  const canUseDragSelectionTool = isDrawingEditMode || !currentDrawingTool || currentDrawingTool === 'select';
  const allowDragSelection = canUseDragSelectionTool && (!isSmallTouchLayout || touchMultiSelectMode);
  const updateNodeInternals = useUpdateNodeInternals();

  // Auto-stabilize edge connections when ReactFlow finishes measuring nodes.
  // This fixes the issue where edges render at wrong positions on initial load
  // because node dimensions aren't available yet when edges first calculate their paths.
  const nodesInitialized = useStore(
    useCallback((s: any) => {
      const lookup = s.nodeLookup;
      if (!lookup || lookup.size === 0) return false;
      let total = 0;
      let unmeasured = 0;
      lookup.forEach((n: any) => {
        if (n.type !== 'securityZone') {
          total++;
          if (!n.measured?.width || !n.measured?.height) unmeasured++;
        }
      });
      return total > 0 && unmeasured === 0;
    }, [])
  );

  const prevNodesInitializedRef = useRef(false);
  const stabilizationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (nodesInitialized && !prevNodesInitializedRef.current && nodes.length > 0) {
      const liveNodes = reactFlowInstance?.getNodes();
      const nodeIds = (liveNodes && liveNodes.length > 0 ? liveNodes : nodes).map((n: any) => n.id);
      if (nodeIds.length > 0) {
        updateNodeInternals(nodeIds);

        if (stabilizationTimerRef.current) clearTimeout(stabilizationTimerRef.current);
        stabilizationTimerRef.current = setTimeout(() => {
          const freshIds = (reactFlowInstance?.getNodes() || nodes).map((n: any) => n.id);
          if (freshIds.length > 0) updateNodeInternals(freshIds);
        }, 100);
      }
    }
    prevNodesInitializedRef.current = nodesInitialized;
  }, [nodesInitialized, nodes, reactFlowInstance, updateNodeInternals]);

  useEffect(() => {
    return () => { if (stabilizationTimerRef.current) clearTimeout(stabilizationTimerRef.current); };
  }, []);

  // Create ref for UndoRedoController
  const undoRedoRef = useRef<UndoRedoControllerHandle>(null);

  // Track undo/redo state
  const [undoRedoState, setUndoRedoState] = useState({ canUndo: false, canRedo: false });

  // Delay mounting UndoRedoController to ensure ReactFlow is ready
  const [isReactFlowReady, setIsReactFlowReady] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsReactFlowReady(true);
    }, 100); // Small delay to ensure ReactFlow is initialized
    
    return () => clearTimeout(timer);
  }, []);


  // Handle undo/redo state changes from the controller
  const handleUndoRedoStateChange = useCallback((canUndo: boolean, canRedo: boolean) => {
    setUndoRedoState({ canUndo, canRedo });
  }, []);

  // Expose undo/redo methods through ref
  useImperativeHandle(ref, () => ({
    undo: () => undoRedoRef.current?.undo(),
    redo: () => undoRedoRef.current?.redo(),
    canUndo: undoRedoState.canUndo,
    canRedo: undoRedoState.canRedo,
    takeSnapshot: () => undoRedoRef.current?.takeSnapshot(),
    updateAllNodeInternals: () => {
      // Prefer live ReactFlow store nodes to avoid stale closures during batched updates.
      const liveNodes = reactFlowInstance?.getNodes();
      const nodeIds = (liveNodes && liveNodes.length > 0 ? liveNodes : nodes).map((n: any) => n.id);
      if (nodeIds.length > 0) {
        updateNodeInternals(nodeIds);
      }
    }
  }), [undoRedoState.canUndo, undoRedoState.canRedo, nodes, reactFlowInstance, updateNodeInternals]);

  // Control point drag tracking: any control point spatially within the
  // bounding box of the dragged nodes moves with the selection.
  const { setEdges: rfSetEdges, getEdges: rfGetEdges } = useReactFlow();
  const dragStartPositionsRef = useRef<Map<string, { x: number; y: number }>>(new Map());
  const dragCapturedCPsRef = useRef<Array<{ edgeId: string; cpIndex: number; x: number; y: number }>>([]);

  const captureControlPointsForDrag = useCallback((draggedNodes: any[]) => {
    dragStartPositionsRef.current.clear();
    dragCapturedCPsRef.current = [];
    if (draggedNodes.length < 2) return;

    for (const n of draggedNodes) {
      dragStartPositionsRef.current.set(n.id, { x: n.position.x, y: n.position.y });
    }

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const n of draggedNodes) {
      const w = n.measured?.width || n.width || 150;
      const h = n.measured?.height || n.height || 50;
      minX = Math.min(minX, n.position.x);
      minY = Math.min(minY, n.position.y);
      maxX = Math.max(maxX, n.position.x + w);
      maxY = Math.max(maxY, n.position.y + h);
    }

    const currentEdges = rfGetEdges();
    const captured: typeof dragCapturedCPsRef.current = [];
    for (const edge of currentEdges) {
      const cps = (edge.data as any)?.controlPoints;
      if (!cps || cps.length === 0) continue;
      for (let i = 0; i < cps.length; i++) {
        const cp = cps[i];
        if (cp.x >= minX && cp.x <= maxX && cp.y >= minY && cp.y <= maxY) {
          captured.push({ edgeId: edge.id, cpIndex: i, x: cp.x, y: cp.y });
        }
      }
    }
    dragCapturedCPsRef.current = captured;
  }, [rfGetEdges]);

  const updateControlPointsDuringDrag = useCallback((draggedNodes: any[]) => {
    const captured = dragCapturedCPsRef.current;
    if (captured.length === 0) return;
    const refNode = draggedNodes[0];
    if (!refNode) return;
    const startPos = dragStartPositionsRef.current.get(refNode.id);
    if (!startPos) return;
    const dx = refNode.position.x - startPos.x;
    const dy = refNode.position.y - startPos.y;
    if (dx === 0 && dy === 0) return;

    const updates = new Map<string, Map<number, { x: number; y: number }>>();
    for (const cp of captured) {
      if (!updates.has(cp.edgeId)) updates.set(cp.edgeId, new Map());
      updates.get(cp.edgeId)!.set(cp.cpIndex, { x: cp.x + dx, y: cp.y + dy });
    }

    rfSetEdges(currentEdges => currentEdges.map(edge => {
      const cpUpdates = updates.get(edge.id);
      if (!cpUpdates) return edge;
      const currentCPs = (edge.data as any)?.controlPoints;
      if (!currentCPs) return edge;
      return {
        ...edge,
        data: {
          ...(edge.data || {}),
          controlPoints: currentCPs.map((cp: any, i: number) => {
            const update = cpUpdates.get(i);
            return update ? { ...cp, x: update.x, y: update.y } : cp;
          }),
        },
      };
    }));
  }, [rfSetEdges]);

  const clearDragState = useCallback(() => {
    dragStartPositionsRef.current.clear();
    dragCapturedCPsRef.current = [];
  }, []);

  // Event handlers that need takeSnapshot
  const handleNodeDragStart: OnNodeDrag = useCallback((_event, _node, draggedNodes) => {
    undoRedoRef.current?.takeSnapshot();
    captureControlPointsForDrag(draggedNodes);
  }, [captureControlPointsForDrag]);

  const handleNodeDrag: OnNodeDrag = useCallback((_event, _node, draggedNodes) => {
    updateControlPointsDuringDrag(draggedNodes);
  }, [updateControlPointsDuringDrag]);

  const handleNodeDragStop: OnNodeDrag = useCallback(() => {
    clearDragState();
  }, [clearDragState]);

  const handleSelectionDragStart: SelectionDragHandler = useCallback((_event, selectedNodes) => {
    undoRedoRef.current?.takeSnapshot();
    captureControlPointsForDrag(selectedNodes);
  }, [captureControlPointsForDrag]);

  const handleSelectionDrag: SelectionDragHandler = useCallback((_event, selectedNodes) => {
    updateControlPointsDuringDrag(selectedNodes);
  }, [updateControlPointsDuringDrag]);

  const handleSelectionDragStop: SelectionDragHandler = useCallback(() => {
    clearDragState();
  }, [clearDragState]);

  const handleNodesDelete: OnNodesDelete = useCallback(() => {
    undoRedoRef.current?.takeSnapshot();
  }, []);

  const handleEdgesDelete: OnEdgesDelete = useCallback(() => {
    undoRedoRef.current?.takeSnapshot();
  }, []);

  // Save viewport state when panning/zooming ends (not during — avoids re-renders while dragging)
  const handleMoveEnd = useCallback((_event: any, viewport: any) => {
    setView2DState(viewport);
  }, [setView2DState]);

  // Handle init to restore viewport
  const handleInit = useCallback((instance: ReactFlowInstance) => {
    // Call original onInit
    onInit(instance);

    // Restore viewport if available
    if (view2D.viewport) {
      instance.setViewport(view2D.viewport);
    }
  }, [onInit, view2D.viewport]);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onNodeDoubleClick={onNodeDoubleClick}
      onContextMenu={(e) => {
        // Prevent browser context menu to enable right-click panning
        e.preventDefault();
      }}
      onNodeContextMenu={(e) => {
        // Prevent browser menu so right-click drag can pan
        e.preventDefault();
        e.stopPropagation();
      }}
      onEdgeContextMenu={(e) => {
        // Prevent browser menu so right-click drag can pan
        e.preventDefault();
        e.stopPropagation();
      }}
      onEdgeDoubleClick={onEdgeDoubleClick}
      onNodeClick={onNodeClick}
      onEdgeClick={onEdgeClick}
      onNodeMouseEnter={onNodeMouseEnter}
      onNodeMouseLeave={onNodeMouseLeave}
      onEdgeMouseEnter={onEdgeMouseEnter}
      onEdgeMouseLeave={onEdgeMouseLeave}
      onSelectionChange={onSelectionChange}
      onConnect={onConnect}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      onInit={handleInit}
      onMoveEnd={handleMoveEnd}
      proOptions={proOptions}
      defaultEdgeOptions={defaultEdgeOptions}
      onDrop={onDrop}
      onDragOver={onDragOver}
      onPaneContextMenu={(event) => {
        // Prevent context menu on right-click to allow panning
        event.preventDefault();
      }}
      onPaneClick={onPaneClick}
      onMouseDown={onMouseDown}
      onKeyDown={onKeyDown}
      onKeyUp={onKeyUp}
      onNodeDragStart={handleNodeDragStart}
      onNodeDrag={handleNodeDrag}
      onNodeDragStop={handleNodeDragStop}
      onSelectionDragStart={handleSelectionDragStart}
      onSelectionDrag={handleSelectionDrag}
      onSelectionDragStop={handleSelectionDragStop}
      onNodesDelete={handleNodesDelete}
      onEdgesDelete={handleEdgesDelete}
      deleteKeyCode={['Backspace', 'Delete']}
      selectionMode={SelectionMode.Partial}
      selectionOnDrag={allowDragSelection}
      selectNodesOnDrag={allowDragSelection}
      // Enable panning with middle (1) and right (2) mouse buttons
      panOnDrag={isInteractiveLocked ? false : (isSmallTouchLayout ? !touchMultiSelectMode : [1, 2])}
      multiSelectionKeyCode={['Meta', 'Control']}
      selectionKeyCode={null}
      snapToGrid={snapToGrid}
      snapGrid={[50, 50]}
      connectOnClick={true}
      panOnScroll={false}
      panOnScrollMode={PanOnScrollMode.Free}
      panActivationKeyCode={null}
      isValidConnection={isValidConnection}
      onConnectStart={onConnectStart}
      onConnectEnd={onConnectEnd}
      connectionMode={ConnectionMode.Loose}
      elevateEdgesOnSelect={true}
      fitView
      style={{ 
        background: currentTheme.colors.background,
        touchAction: isSmallTouchLayout ? 'none' : undefined
      }}
      edgesFocusable={true}
      onReconnect={onEdgeUpdate}
      minZoom={0.1}
      maxZoom={4}
      zoomOnScroll={!isInteractiveLocked}
      zoomOnPinch={!isInteractiveLocked}
      zoomOnDoubleClick={false}
      preventScrolling={true}
      disableKeyboardA11y={true}
      noDragClassName="nodrag"
      noPanClassName="nopan"
      nodesDraggable={!isInteractiveLocked}
      nodesConnectable={!isInteractiveLocked}
      elementsSelectable={!isInteractiveLocked}
      autoPanOnNodeDrag={true}
      autoPanOnConnect={true}
      attributionPosition="bottom-right"
    >
      {/* UndoRedoController must be inside ReactFlow to access its context */}
      {isReactFlowReady && (
        <UndoRedoController 
          ref={undoRedoRef} 
          maxHistorySize={100} 
          enableShortcuts={true} 
          onStateChange={handleUndoRedoStateChange}
        />
      )}
      
      {/* Enhanced selection handler for better fast-drag selection */}
      <EnhancedSelectionHandler 
        isDrawingEditMode={isDrawingEditMode || false}
        isInteractiveLocked={isInteractiveLocked}
        disableOnTouchLayout={isSmallTouchLayout}
      />
      
      {showGrid && (
        <Background 
          color={currentTheme.name === 'dark' ? 'rgba(68,68,68,0.3)' : 'rgba(221,221,221,0.3)'}
          gap={50}
          size={1}
        />
      )}
      {/* Pass children through - this includes Controls, etc. */}
      {children}
      {showMinimap && (
        <MiniMap 
          nodeColor={(node) => {
            if (node.type === 'securityZone') {
              // ReactFlow nodes can have custom style properties
              const nodeStyle = node.style as any;
              return (nodeStyle?.backgroundColor || nodeStyle?.background || currentTheme.colors.surface) as string;
            }
            return currentTheme.colors.primary as string;
          }}
          maskColor={currentTheme.name === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.07)'}
          maskStrokeColor={currentTheme.colors.primary}
          maskStrokeWidth={2}
          nodeStrokeWidth={3}
          nodeClassName={(node) => {
            // Hide drawing nodes on minimap
            if (node.type === 'freehand' || node.type === 'shape' || node.type === 'textAnnotation') {
              return 'minimap-hidden';
            }
            return '';
          }}
          pannable
          zoomable
          style={{
            backgroundColor: currentTheme.colors.surface,
            border: `1px solid ${currentTheme.colors.border}`,
            position: 'absolute',
            left: isSmallTouchLayout ? -10 : 30,
            bottom: isSmallTouchLayout ? 68 : 5,
            width: isSmallTouchLayout ? 170 : 200,
            height: isSmallTouchLayout ? 128 : 150
          }}
          zoomStep={5}
        />
      )}
    </ReactFlow>
  );
});

DiagramEditorInner.displayName = 'DiagramEditorInner';

export default DiagramEditorInner;
