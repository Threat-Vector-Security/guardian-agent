import React, { useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import DiagramEditorInner, { DiagramEditorInnerHandle, DiagramEditorInnerProps } from './DiagramEditorInner';
import { useCopyPaste } from '../hooks/useCopyPaste';

interface DiagramEditorWithCopyPasteProps extends DiagramEditorInnerProps {
  innerRef?: React.RefObject<DiagramEditorInnerHandle>;
  keyboardShortcutsEnabled?: boolean;
}

// Inner component that uses the copy-paste hook
const DiagramEditorWithCopyPasteInner = forwardRef<DiagramEditorInnerHandle, DiagramEditorWithCopyPasteProps>(
  ({ innerRef, keyboardShortcutsEnabled = true, ...props }, ref) => {
    const { copy, cut, paste, canPaste } = useCopyPaste();
    const diagramEditorRef = useRef<DiagramEditorInnerHandle>(null);
    
    // Forward the ref
    useImperativeHandle(ref || innerRef, () => ({
      undo: () => diagramEditorRef.current?.undo(),
      redo: () => diagramEditorRef.current?.redo(),
      get canUndo() { return diagramEditorRef.current?.canUndo || false; },
      get canRedo() { return diagramEditorRef.current?.canRedo || false; },
      takeSnapshot: () => diagramEditorRef.current?.takeSnapshot(),
      updateAllNodeInternals: () => diagramEditorRef.current?.updateAllNodeInternals(),
    }), []);
    
    // Store functions in refs to avoid re-renders
    const copyRef = useRef(copy);
    const cutRef = useRef(cut);
    const pasteRef = useRef(paste);
    
    useEffect(() => {
      copyRef.current = copy;
      cutRef.current = cut;
      pasteRef.current = paste;
    }, [copy, cut, paste]);
    
    // Override keyboard handlers to use the hook
    useEffect(() => {
      if (!keyboardShortcutsEnabled) {
        return;
      }

      const handleKeyDown = (event: KeyboardEvent) => {
        // Don't interfere when typing in input fields
        const target = event.target as HTMLElement;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.contentEditable === 'true') {
          return;
        }

        if (!(event.ctrlKey || event.metaKey)) {
          return;
        }

        const key = event.key.toLowerCase();
        if (!['c', 'v', 'x'].includes(key)) {
          return;
        }

        // If text is selected anywhere, prefer native clipboard behavior.
        const selection = window.getSelection();
        const hasSelectedText = !!selection && !selection.isCollapsed && selection.toString().trim().length > 0;
        if ((key === 'c' || key === 'x') && hasSelectedText) {
          return;
        }

        // If there's a text selection, check if it's within a UI component
        let selectionInUIComponent = false;
        if (hasSelectedText && selection?.anchorNode) {
          const selectionContainer = selection.anchorNode.nodeType === Node.TEXT_NODE 
            ? selection.anchorNode.parentElement 
            : selection.anchorNode as HTMLElement;
          
          if (selectionContainer) {
            selectionInUIComponent = !!(
              selectionContainer.closest('[data-testid="debug-panel"]') ||
              selectionContainer.closest('.debug-panel-root') ||
              selectionContainer.closest('.MuiDrawer-root') ||
              selectionContainer.closest('.MuiDialog-root') ||
              selectionContainer.closest('.MuiModal-root') ||
              selectionContainer.closest('[role="dialog"]')
            );
          }
        }
        
        // Check if the event is happening inside any UI panel/window/dialog
        const debugPanel = target.closest('[data-testid="debug-panel"]') || target.closest('.debug-panel-root');
        const isInUIComponent = selectionInUIComponent || !!(
          // Debug panel FIRST (most specific)
          debugPanel ||
          
          // MUI components
          target.closest('.MuiDrawer-root') ||
          target.closest('.MuiDialog-root') ||
          target.closest('.MuiModal-root') ||
          target.closest('.MuiPopover-root') ||
          target.closest('.MuiMenu-root') ||
          target.closest('.MuiTooltip-popper') ||
          
          // Custom components
          target.closest('.analysis-panel-content') ||
          target.closest('[data-testid="analysis-panel"]') ||
          target.closest('.threat-analysis-panel') ||
          target.closest('.node-editor') ||
          target.closest('.edge-editor') ||
          target.closest('.settings-drawer') ||
          target.closest('.custom-context-panel') ||
          target.closest('.window-content') ||
          target.closest('.toolbar-menu') ||
          target.closest('.quick-inspector') ||
          
          // Settings and other panels
          target.closest('[role="dialog"]') ||
          target.closest('[role="presentation"]') ||
          
          // Any floating window (but NOT including all MuiPaper-root)
          (target.closest('[style*="position: absolute"]') && target.closest('.MuiPaper-root') && !debugPanel)
        );
        
        // If the event is in any UI component, let that component handle it
        if (isInUIComponent) {
          return;
        }
        
        // Only intercept copy/paste for the canvas area
        switch (key) {
          case 'c':
            event.preventDefault();
            event.stopPropagation();
            copyRef.current();
            break;
          case 'v':
            event.preventDefault();
            event.stopPropagation();
            pasteRef.current();
            break;
          case 'x':
            event.preventDefault();
            event.stopPropagation();
            cutRef.current();
            break;
        }
      };
      
      // Use capture phase to intercept before other handlers
      window.addEventListener('keydown', handleKeyDown, true);
      
      return () => {
        window.removeEventListener('keydown', handleKeyDown, true);
      };
    }, [keyboardShortcutsEnabled]);
    
    // Store canPaste in window for menu access
    useEffect(() => {
      (window as any).__canPaste = canPaste;
    }, [canPaste]);
    
    // Store functions in window for menu access
    useEffect(() => {
      (window as any).__copyPasteFunctions = {
        copy: copyRef.current,
        cut: cutRef.current,
        paste: pasteRef.current,
      };
    }, []);
    
    // Listen for snapshot event
    useEffect(() => {
      const handleSnapshot = () => {
        diagramEditorRef.current?.takeSnapshot();
      };
      
      window.addEventListener('take-diagram-snapshot', handleSnapshot);
      return () => {
        window.removeEventListener('take-diagram-snapshot', handleSnapshot);
      };
    }, []);
    
    return <DiagramEditorInner ref={diagramEditorRef} {...props} />;
  }
);

DiagramEditorWithCopyPasteInner.displayName = 'DiagramEditorWithCopyPasteInner';

// Wrapper component that provides ReactFlowProvider
const DiagramEditorWithCopyPaste = forwardRef<DiagramEditorInnerHandle, DiagramEditorWithCopyPasteProps>(
  (props, ref) => {
    return (
      <ReactFlowProvider>
        <DiagramEditorWithCopyPasteInner ref={ref} {...props} />
      </ReactFlowProvider>
    );
  }
);

DiagramEditorWithCopyPaste.displayName = 'DiagramEditorWithCopyPaste';

export default DiagramEditorWithCopyPaste;
