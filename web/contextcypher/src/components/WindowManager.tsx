import React, { useState } from 'react';
import { Box } from '@mui/material';
import FloatingPanel from './FloatingPanel';
import NodeEditor from './NodeEditor';
import EdgeEditor from './EdgeEditor';
import ManualFindingsWindow from './ManualFindingsWindow';
import { useWindowManager } from '../contexts/WindowManagerContext';
import { colors as themeColors } from '../styles/Theme';
import { getResponsivePanelWidths } from '../styles/layout';
import useViewportLayout from '../hooks/useViewportLayout';
import type { ManualFinding } from '../types/ManualAnalysisTypes';
import type { DiagramAttackPath } from '../types/GrcTypes';

const DEFAULT_PANEL_WIDTHS = getResponsivePanelWidths(typeof window !== 'undefined' ? window.innerWidth : 1440);
const DEFAULT_FLOATING_EDITOR_WIDTH = DEFAULT_PANEL_WIDTHS.floatingEditor;

interface WindowManagerProps {
  nodes: any[];
  edges: any[];
  onNodesUpdate: (nodes: any[]) => void;
  onEdgesUpdate: (edges: any[]) => void;
  manualFindings?: ManualFinding[];
  onAnalyzeNode?: (nodeId: string) => Promise<void>;
  onAnalyzeEdge?: (edgeId: string) => Promise<void>;
  isAnalysisPanelOpen?: boolean;
  isNodeToolboxOpen?: boolean;
  leftPanelWidth?: number;
  rightPanelWidth?: number;
  canvasBounds?: { left: number; top: number; right: number; bottom: number };
  onCenterOnNode?: (nodeId: string) => void;
  onCenterOnEdge?: (edgeId: string) => void;
  onOpenAssessmentForZone?: (zone: string, options?: { openRiskPlan?: boolean }) => void;
  onCreateAttackPath?: (path: DiagramAttackPath) => void;
}

const WindowManager: React.FC<WindowManagerProps> = ({
  nodes,
  edges,
  onNodesUpdate,
  onEdgesUpdate,
  manualFindings = [],
  onAnalyzeNode,
  onAnalyzeEdge,
  isAnalysisPanelOpen = false,
  isNodeToolboxOpen = true,
  leftPanelWidth = DEFAULT_PANEL_WIDTHS.toolbox,
  rightPanelWidth = DEFAULT_PANEL_WIDTHS.analysis,
  canvasBounds,
  onCenterOnNode,
  onCenterOnEdge,
  onOpenAssessmentForZone,
  onCreateAttackPath
}) => {
  const { viewport } = useViewportLayout();
  const { 
    windows, 
    activeWindowId, 
    closeWindow, 
    updateWindow, 
    focusWindow 
  } = useWindowManager();

  // Track which windows have dropdowns open
  const [dropdownStates, setDropdownStates] = useState<Record<string, boolean>>({});

  // Handle dropdown state for a specific window
  const handleDropdownStateChange = (windowId: string, isOpen: boolean) => {
    setDropdownStates(prev => ({
      ...prev,
      [windowId]: isOpen
    }));
  };

  // Handle node update
  const handleNodeUpdate = (windowId: string, updatedNode: any) => {
    const updatedNodes = nodes.map(n => 
      n.id === updatedNode.id ? updatedNode : n
    );
    onNodesUpdate(updatedNodes);
    
    // Update window content with new node data
    updateWindow(windowId, { 
      content: updatedNode,
      title: `Edit ${updatedNode.type}: ${updatedNode.data?.label || updatedNode.id}`
    });
  };

  // Handle edge update
  const handleEdgeUpdate = (windowId: string, updatedEdge: any) => {
    console.log('WindowManager: handleEdgeUpdate called with:', {
      windowId,
      edgeId: updatedEdge.id,
      data: updatedEdge.data,
      portRange: updatedEdge.data?.portRange
    });
    
    const updatedEdges = edges.map(e => 
      e.id === updatedEdge.id ? updatedEdge : e
    );
    onEdgesUpdate(updatedEdges);
    
    // Update window content with new edge data
    updateWindow(windowId, { 
      content: updatedEdge,
      title: `Edit Connection: ${updatedEdge.data?.label || updatedEdge.id}`
    });
  };

  // Calculate bounds for floating panels
  const calculateBounds = () => {
    // Default bounds: full viewport
    let bounds = {
      left: 0,
      top: 64, // Below app bar
      right: viewport.width,
      bottom: viewport.height
    };

    // Adjust for node toolbox on the left when open
    if (isNodeToolboxOpen) {
      bounds.left = Math.round(leftPanelWidth);
    }
    
    // Adjust for analysis panel on the right if open
    if (isAnalysisPanelOpen) {
      bounds.right = viewport.width - Math.round(rightPanelWidth);
    }
    
    const minCanvasWidth = 240;
    if (bounds.right - bounds.left < minCanvasWidth) {
      bounds.left = Math.max(0, bounds.right - minCanvasWidth);
    }

    bounds.right -= 10;
    bounds.top += 10;
    bounds.bottom -= 10;
    
    return bounds;
  };

  const panelBounds = canvasBounds || calculateBounds();

  return (
    <Box
      sx={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        '& > *': {
          pointerEvents: 'auto'
        }
      }}
    >
      {windows.map((window) => {
        // Get current data from nodes/edges arrays
        let currentContent = window.content;
        
        if (window.type === 'node') {
          currentContent = nodes.find(n => n.id === window.content.id) || window.content;
        } else if (window.type === 'edge') {
          currentContent = edges.find(e => e.id === window.content.id) || window.content;
        }

        const isDropdownOpen = dropdownStates[window.id] || false;

        let titleColor: string | undefined;
        let accentColor: string | undefined;
        let accentShadowColor: string | undefined;
        if (window.type === 'node') {
          const nodeType = (currentContent as any).type as string;
          const colorKey = `${nodeType}Color` as keyof typeof themeColors;
          titleColor = (themeColors as any)[colorKey] || undefined;
          // Accent should match the node label text color (node color), not zone
          accentColor = titleColor;
          // Build a soft shadow rgba from accentColor if hex
          if (typeof accentColor === 'string' && accentColor.startsWith('#')) {
            const hex = accentColor.replace('#', '');
            const r = parseInt(hex.substring(0, 2), 16);
            const g = parseInt(hex.substring(2, 4), 16);
            const b = parseInt(hex.substring(4, 6), 16);
            accentShadowColor = `rgba(${r}, ${g}, ${b}, 0.35)`;
          } else {
            accentShadowColor = 'rgba(0,0,0,0.25)';
          }
        }
         if (window.type === 'edge') {
           const zone = (currentContent as any)?.data?.zone as string | undefined;
           if (zone && (themeColors.zoneColors as any)[zone]) {
             titleColor = (themeColors.zoneColors as any)[zone];
             accentColor = titleColor;
             if (typeof titleColor === 'string' && titleColor.startsWith('#')) {
               const hex = titleColor.replace('#', '');
               const r = parseInt(hex.substring(0, 2), 16);
               const g = parseInt(hex.substring(2, 4), 16);
               const b = parseInt(hex.substring(4, 6), 16);
               accentShadowColor = `rgba(${r}, ${g}, ${b}, 0.35)`;
             } else {
               accentShadowColor = 'rgba(0,0,0,0.25)';
             }
           }
         }

        // Determine selection highlight based on current canvas selection
        let isSelected = false;
        if (window.type === 'node') {
          const n = nodes.find(n => n.id === window.content.id);
          isSelected = !!n?.selected;
        } else if (window.type === 'edge') {
          const e = edges.find(e => e.id === window.content.id);
          isSelected = !!e?.selected;
        }

        return (
          <FloatingPanel
            key={window.id}
            id={window.id}
            title={window.title}
            titleColor={titleColor}
            onClose={() => closeWindow(window.id)}
            initialPosition={window.position}
            initialSize={window.size}
            zIndex={window.zIndex}
            onFocus={() => focusWindow(window.id)}
            isActive={window.id === activeWindowId}
            isSelected={isSelected}
            accentColor={accentColor}
            accentShadowColor={accentShadowColor}
            minWidth={
              window.type === 'node'
                ? DEFAULT_FLOATING_EDITOR_WIDTH
                : window.type === 'manualFindings'
                  ? Math.max(DEFAULT_FLOATING_EDITOR_WIDTH, 520)
                  : Math.max(340, Math.round(DEFAULT_FLOATING_EDITOR_WIDTH * 0.9))
            }
            minHeight={window.type === 'node' ? 600 : window.type === 'manualFindings' ? 500 : 500}
            maxWidth={800}
            maxHeight={900}
            bounds={panelBounds}
            disableDrag={isDropdownOpen}
          >
            {window.type === 'node' && (
              <NodeEditor
                node={currentContent}
                onUpdate={(node) => handleNodeUpdate(window.id, node)}
                onClose={() => closeWindow(window.id)}
                edges={edges}
                allNodes={nodes}
                onEdgesUpdate={onEdgesUpdate}
                isAnalysisPanelOpen={isAnalysisPanelOpen}
                onAnalyzeNode={onAnalyzeNode}
                isFloating={true}
                onDropdownStateChange={(isOpen) => handleDropdownStateChange(window.id, isOpen)}
                onCenterOnNode={onCenterOnNode ? () => onCenterOnNode(currentContent.id) : undefined}
                onOpenAssessmentForZone={onOpenAssessmentForZone}
                onCreateAttackPath={onCreateAttackPath}
              />
            )}
            
            {window.type === 'edge' && (
              <EdgeEditor
                edge={currentContent}
                onSave={(edge) => handleEdgeUpdate(window.id, edge)}
                onClose={() => closeWindow(window.id)}
                isAnalysisPanelOpen={isAnalysisPanelOpen}
                allNodes={nodes}
                allEdges={edges}
                onAnalyzeEdge={onAnalyzeEdge}
                isFloating={true}
                onDropdownStateChange={(isOpen) => handleDropdownStateChange(window.id, isOpen)}
                onCenterOnEdge={onCenterOnEdge ? () => onCenterOnEdge(currentContent.id) : undefined}
              />
            )}

            {window.type === 'manualFindings' && (
              <ManualFindingsWindow
                findings={manualFindings}
                nodes={nodes}
                edges={edges}
                onFocusNode={onCenterOnNode}
                onFocusEdge={onCenterOnEdge}
                onFocusZone={onCenterOnNode}
              />
            )}
          </FloatingPanel>
        );
      })}
    </Box>
  );
};

export default WindowManager;
