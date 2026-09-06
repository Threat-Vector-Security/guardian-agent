import { useEffect } from 'react';
import useCopyPaste from '../hooks/useCopyPaste';
import { SecurityNode, SecurityEdge } from '../types/SecurityTypes';

interface CopyPasteHandlerProps {
  onPaste: () => void;
  showToast: (message: string, type?: 'success' | 'info' | 'warning' | 'error') => void;
  onActionsReady: (actions: {
    copy: () => void;
    cut: () => void;
    paste: () => void;
    canCopy: boolean;
    canPaste: boolean;
  }) => void;
  selectedNodes?: SecurityNode[];
  selectedEdges?: SecurityEdge[];
}

export const CopyPasteHandler: React.FC<CopyPasteHandlerProps> = ({
  onPaste,
  showToast,
  onActionsReady,
  selectedNodes,
  selectedEdges
}) => {
  const copyPasteActions = useCopyPaste();

  // Pass the actions to the parent component
  // Update whenever the actions or their state changes
  // Include selectedNodes and selectedEdges to ensure actions are recreated
  useEffect(() => {
    onActionsReady(copyPasteActions);
  }, [
    copyPasteActions.copy,
    copyPasteActions.cut,
    copyPasteActions.paste,
    copyPasteActions.canCopy,
    copyPasteActions.canPaste,
    onActionsReady,
    selectedNodes,
    selectedEdges
  ]);

  return null; // This component doesn't render anything
};