import React, { createContext, useContext, useState, useCallback, useRef } from 'react';

export interface WindowState {
  id: string;
  type: 'node' | 'edge' | 'inspector' | 'manualFindings';
  title: string;
  content: any; // Node, Edge, or other data
  position: { x: number; y: number };
  size: { width: number; height: number };
  zIndex: number;
  isMinimized: boolean;
  isMaximized: boolean;
  timestamp: number;
}

interface WindowManagerContextType {
  windows: WindowState[];
  activeWindowId: string | null;
  openWindow: (window: Omit<WindowState, 'zIndex' | 'timestamp' | 'isMinimized' | 'isMaximized'>) => void;
  closeWindow: (id: string) => void;
  updateWindow: (id: string, updates: Partial<WindowState>) => void;
  focusWindow: (id: string) => void;
  minimizeWindow: (id: string) => void;
  maximizeWindow: (id: string) => void;
  getNextPosition: () => { x: number; y: number };
  isWindowOpen: (type: string, contentId: string) => boolean;
}

const WindowManagerContext = createContext<WindowManagerContextType | undefined>(undefined);

export const useWindowManager = () => {
  const context = useContext(WindowManagerContext);
  if (!context) {
    throw new Error('useWindowManager must be used within a WindowManagerProvider');
  }
  return context;
};

interface WindowManagerProviderProps {
  children: React.ReactNode;
}

export const WindowManagerProvider: React.FC<WindowManagerProviderProps> = ({ children }) => {
  const [windows, setWindows] = useState<WindowState[]>([]);
  const [activeWindowId, setActiveWindowId] = useState<string | null>(null);
  const nextZIndex = useRef(1000);
  const cascadeOffset = useRef({ x: 0, y: 0 });

  // Get next cascade position for new windows
  const getNextPosition = useCallback(() => {
    // Position first window at top-left of canvas, next to NodeToolbox
    const baseX = 320; // NodeToolbox width
    const baseY = 64; // AppBar height
    const offset = 40; // Increased offset to prevent overlap
    const threshold = 20; // Distance threshold to consider positions as "same"
    
    // Check if the initial position is already occupied by an existing window
    const isInitialPositionOccupied = windows.some(w => 
      Math.abs(w.position.x - baseX) < threshold && 
      Math.abs(w.position.y - baseY) < threshold &&
      !w.isMinimized // Don't count minimized windows
    );
    
    // If initial position is free, use it (reset cascade)
    if (!isInitialPositionOccupied) {
      cascadeOffset.current = { x: 0, y: 0 };
    }
    
    const position = {
      x: baseX + cascadeOffset.current.x,
      y: baseY + cascadeOffset.current.y
    };
    
    // Update cascade offset for next window
    cascadeOffset.current.x += offset;
    cascadeOffset.current.y += offset;
    
    // Reset cascade if it goes too far
    if (cascadeOffset.current.x > 400 || cascadeOffset.current.y > 300) {
      cascadeOffset.current = { x: 0, y: 0 };
    }
    
    return position;
  }, [windows]);

  // Focus a window (bring to front) - defined early to avoid initialization errors
  const focusWindow = useCallback((id: string) => {
    setWindows(prevWindows => {
      const window = prevWindows.find(w => w.id === id);
      if (window && !window.isMinimized) {
        setActiveWindowId(id);
        return prevWindows.map(w => 
          w.id === id ? { ...w, zIndex: nextZIndex.current++ } : w
        );
      } else if (window && window.isMinimized) {
        // Restore minimized window
        setActiveWindowId(id);
        return prevWindows.map(w => 
          w.id === id ? { 
            ...w, 
            isMinimized: false,
            zIndex: nextZIndex.current++ 
          } : w
        );
      }
      return prevWindows;
    });
  }, []);

  // Open a new window or focus existing one
  const openWindow = useCallback((newWindow: Omit<WindowState, 'zIndex' | 'timestamp' | 'isMinimized' | 'isMaximized'>) => {
    // Check if window with same content already exists
    const existingWindow = windows.find(w => 
      w.type === newWindow.type && 
      w.content?.id === newWindow.content?.id
    );

    if (existingWindow) {
      // Focus existing window instead of opening new one
      focusWindow(existingWindow.id);
      return;
    }

    const window: WindowState = {
      ...newWindow,
      position: newWindow.position || getNextPosition(),
      zIndex: nextZIndex.current++,
      timestamp: Date.now(),
      isMinimized: false,
      isMaximized: false
    };

    setWindows(prev => [...prev, window]);
    focusWindow(window.id);
  }, [focusWindow, getNextPosition, windows]);

  // Close a window
  const closeWindow = useCallback((id: string) => {
    setWindows(prev => prev.filter(w => w.id !== id));
    if (activeWindowId === id) {
      const remainingWindows = windows.filter(w => w.id !== id);
      setActiveWindowId(remainingWindows.length > 0 ? remainingWindows[remainingWindows.length - 1].id : null);
    }
  }, [activeWindowId, windows]);

  // Update window state
  const updateWindow = useCallback((id: string, updates: Partial<WindowState>) => {
    setWindows(prev => prev.map(w => 
      w.id === id ? { ...w, ...updates } : w
    ));
  }, []);


  // Minimize a window
  const minimizeWindow = useCallback((id: string) => {
    setWindows(prevWindows => {
      // Find next window to focus
      const nonMinimizedWindows = prevWindows.filter(w => w.id !== id && !w.isMinimized);
      if (nonMinimizedWindows.length > 0) {
        const nextWindow = nonMinimizedWindows.reduce((prev, curr) => 
          curr.zIndex > prev.zIndex ? curr : prev
        );
        setActiveWindowId(nextWindow.id);
      } else {
        setActiveWindowId(null);
      }
      
      return prevWindows.map(w => 
        w.id === id ? { ...w, isMinimized: true } : w
      );
    });
  }, []);

  // Maximize/restore a window
  const maximizeWindow = useCallback((id: string) => {
    setWindows(prevWindows => {
      const window = prevWindows.find(w => w.id === id);
      if (window) {
        return prevWindows.map(w => 
          w.id === id ? { ...w, isMaximized: !window.isMaximized } : w
        );
      }
      return prevWindows;
    });
  }, []);

  // Check if a window is already open for specific content
  const isWindowOpen = useCallback((type: string, contentId: string) => {
    return windows.some(w => w.type === type && w.content?.id === contentId);
  }, [windows]);

  const value = {
    windows,
    activeWindowId,
    openWindow,
    closeWindow,
    updateWindow,
    focusWindow,
    minimizeWindow,
    maximizeWindow,
    getNextPosition,
    isWindowOpen
  };

  return (
    <WindowManagerContext.Provider value={value}>
      {children}
    </WindowManagerContext.Provider>
  );
};

export default WindowManagerContext;
