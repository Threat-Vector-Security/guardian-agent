import { useEffect } from 'react';
import { useEnhancedSelection } from '../hooks/useEnhancedSelection';

interface EnhancedSelectionHandlerProps {
  isDrawingEditMode: boolean;
  isInteractiveLocked: boolean;
  disableOnTouchLayout?: boolean;
}

export const EnhancedSelectionHandler: React.FC<EnhancedSelectionHandlerProps> = ({ 
  isDrawingEditMode, 
  isInteractiveLocked,
  disableOnTouchLayout = false
}) => {
  // Enhanced selection for better detection during fast dragging
  useEnhancedSelection({ 
    enabled: !isDrawingEditMode && !isInteractiveLocked && !disableOnTouchLayout,
    sensitivity: 30 // Expand selection box by 30px for better detection during fast drags
  });

  // This component doesn't render anything, it just adds the selection behavior
  return null;
};
