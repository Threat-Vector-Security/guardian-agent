import { useState, useCallback, useEffect, useRef } from 'react';
import {
  useReactFlow,
  getConnectedEdges,
  XYPosition,
  useStore,
} from '@xyflow/react';
import { SecurityNode, SecurityEdge } from '../types/SecurityTypes';
import { useToast } from '../contexts/ToastContext';
import { generateUniqueNodeLabel } from '../utils/labelUtils';
import { updateNodesWithIndexCodes } from '../utils/edgeIndexing';

export function useCopyPaste() {
  const mousePosRef = useRef<XYPosition>({ x: 0, y: 0 });
  const rfDomNode = useStore((state) => state.domNode);
  const { showToast } = useToast();

  const { getNodes, setNodes, getEdges, setEdges, screenToFlowPosition } =
    useReactFlow<SecurityNode, SecurityEdge>();

  // Set up the paste buffers to store the copied nodes and edges.
  const [bufferedNodes, setBufferedNodes] = useState<SecurityNode[]>([]);
  const [bufferedEdges, setBufferedEdges] = useState<SecurityEdge[]>([]);

  // Track mouse position for paste location
  useEffect(() => {
    if (rfDomNode) {
      const onMouseMove = (event: MouseEvent) => {
        mousePosRef.current = {
          x: event.clientX,
          y: event.clientY,
        };
      };

      rfDomNode.addEventListener('mousemove', onMouseMove);

      return () => {
        rfDomNode.removeEventListener('mousemove', onMouseMove);
      };
    }
  }, [rfDomNode]);

  const copy = useCallback(() => {
    // Get all nodes and filter selected ones
    const allNodes = getNodes();
    const selectedNodes = allNodes.filter((node) => node.selected);
    
    if (selectedNodes.length === 0) {
      showToast('No nodes selected to copy', 'info');
      return;
    }

    // Get all edges and filter only those that connect selected nodes
    const allEdges = getEdges();
    const selectedEdges = getConnectedEdges(selectedNodes, allEdges).filter(
      (edge) => {
        const isExternalSource = selectedNodes.every(
          (n) => n.id !== edge.source,
        );
        const isExternalTarget = selectedNodes.every(
          (n) => n.id !== edge.target,
        );

        return !(isExternalSource || isExternalTarget);
      },
    );

    setBufferedNodes(selectedNodes);
    setBufferedEdges(selectedEdges);
    
    // Also sync with global clipboard for keyboard shortcuts
    window.__clipboardNodes = JSON.parse(JSON.stringify(selectedNodes));
    window.__clipboardEdges = JSON.parse(JSON.stringify(selectedEdges));
    // Mark as from copy operation (not cut)
    window.__clipboardFromCut = false;
    
    showToast(`Copied ${selectedNodes.length} nodes and ${selectedEdges.length} edges`, 'success');
  }, [getNodes, getEdges, showToast]);

  const cut = useCallback(() => {
    // Get all nodes and filter selected ones
    const allNodes = getNodes();
    const selectedNodes = allNodes.filter((node) => node.selected);
    
    if (selectedNodes.length === 0) {
      showToast('No nodes selected to cut', 'info');
      return;
    }

    // Get all edges and filter only those that connect selected nodes
    const allEdges = getEdges();
    const selectedEdges = getConnectedEdges(selectedNodes, allEdges).filter(
      (edge) => {
        const isExternalSource = selectedNodes.every(
          (n) => n.id !== edge.source,
        );
        const isExternalTarget = selectedNodes.every(
          (n) => n.id !== edge.target,
        );

        return !(isExternalSource || isExternalTarget);
      },
    );

    setBufferedNodes(selectedNodes);
    setBufferedEdges(selectedEdges);
    
    // Also sync with global clipboard for keyboard shortcuts
    window.__clipboardNodes = JSON.parse(JSON.stringify(selectedNodes));
    window.__clipboardEdges = JSON.parse(JSON.stringify(selectedEdges));
    // Mark as from cut operation
    window.__clipboardFromCut = true;

    // Remove the cut nodes and edges from the graph
    const selectedNodeIds = selectedNodes.map(n => n.id);
    setNodes((nodes) => {
      const remainingNodes = nodes.filter((node) => !selectedNodeIds.includes(node.id));
      // Update index codes for remaining nodes
      return updateNodesWithIndexCodes(remainingNodes);
    });
    setEdges((edges) => edges.filter((edge) => !selectedEdges.includes(edge)));
    
    showToast(`Cut ${selectedNodes.length} nodes and ${selectedEdges.length} edges`, 'success');
    
    // Trigger snapshot after cut
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('take-diagram-snapshot'));
    }, 50);
  }, [getNodes, setNodes, getEdges, setEdges, showToast]);

  const paste = useCallback(
    (position?: XYPosition) => {
      // Check both local buffer and global clipboard
      const nodesToPaste = bufferedNodes.length > 0 ? bufferedNodes : (window.__clipboardNodes || []);
      const edgesToPaste = bufferedEdges.length > 0 ? bufferedEdges : (window.__clipboardEdges || []);
      
      if (nodesToPaste.length === 0) {
        showToast('Nothing to paste', 'info');
        return;
      }

      // Use provided position or convert mouse position to flow coordinates
      const pastePos = position || screenToFlowPosition({
        x: mousePosRef.current.x,
        y: mousePosRef.current.y,
      });

      // Find the center of the selected nodes
      const minX = Math.min(...nodesToPaste.map((s) => s.position.x));
      const minY = Math.min(...nodesToPaste.map((s) => s.position.y));
      const maxX = Math.max(...nodesToPaste.map((s) => s.position.x));
      const maxY = Math.max(...nodesToPaste.map((s) => s.position.y));
      const centerX = (minX + maxX) / 2;
      const centerY = (minY + maxY) / 2;

      const now = Date.now();
      const nodeIdMap: Record<string, string> = {};

      // Get current nodes for unique label generation
      const currentNodes = getNodes();
      
      // Create new nodes with unique IDs and adjusted positions
      const newNodes: SecurityNode[] = nodesToPaste.map((node) => {
        const id = `${node.id}-${now}`;
        nodeIdMap[node.id] = id;
        
        // Generate unique label for the pasted node
        const uniqueLabel = generateUniqueNodeLabel(
          node.type, 
          [...currentNodes, ...nodesToPaste], // Include both existing and nodes being pasted
          node.data?.label
        );
        
        // Reset node properties for proper dragging
        const baseNode = {
          ...node,
          id,
          data: {
            ...node.data,
            label: uniqueLabel
          },
          position: {
            x: pastePos.x + (node.position.x - centerX),
            y: pastePos.y + (node.position.y - centerY)
          },
          selected: true,
          selectable: true,
          draggable: true
        };
        
        // Special handling for security zones
        if (node.type === 'securityZone') {
          return {
            ...baseNode,
            draggable: false,
            style: {
              ...node.style,
              zIndex: -1
            }
          } as SecurityNode;
        }
        
        return baseNode as SecurityNode;
      });

      // Create new edges with updated source/target IDs
      const newEdges: SecurityEdge[] = edgesToPaste.map((edge) => {
        const id = `${edge.id}-${now}`;
        const source = nodeIdMap[edge.source] || edge.source;
        const target = nodeIdMap[edge.target] || edge.target;

        return { ...edge, id, source, target, selected: true };
      });

      // Deselect existing nodes and add new ones
      setNodes((nodes) => {
        const allNodes = [
          ...nodes.map((node) => ({ ...node, selected: false })),
          ...newNodes,
        ];
        // Update all nodes with proper index codes
        return updateNodesWithIndexCodes(allNodes);
      });
      setEdges((edges) => [
        ...edges.map((edge) => ({ ...edge, selected: false })),
        ...newEdges,
      ]);
      
      showToast(`Pasted ${newNodes.length} nodes and ${newEdges.length} edges`, 'success');
      
      // Trigger snapshot after paste
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('take-diagram-snapshot'));
      }, 50);
    },
    [bufferedNodes, bufferedEdges, screenToFlowPosition, setNodes, setEdges, showToast, getNodes],
  );

  // Get fresh selected state from ReactFlow
  const hasSelectedNodes = useCallback(() => {
    const allNodes = getNodes();
    return allNodes.some(node => node.selected);
  }, [getNodes]);

  return { 
    cut, 
    copy, 
    paste, 
    canCopy: hasSelectedNodes(),
    canPaste: bufferedNodes.length > 0 || (window.__clipboardNodes && window.__clipboardNodes.length > 0) || false,
    bufferedNodes, 
    bufferedEdges,
  };
}

export default useCopyPaste;