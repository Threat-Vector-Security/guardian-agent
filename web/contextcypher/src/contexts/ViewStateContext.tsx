import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { Viewport } from '@xyflow/react';
import * as THREE from 'three';

interface View2DState {
  viewport: Viewport | null;
}

interface View3DState {
  cameraPosition: THREE.Vector3 | null;
  cameraTarget: THREE.Vector3 | null;
  cameraRotation: THREE.Euler | null;
}

interface ViewStateContextType {
  view2D: View2DState;
  view3D: View3DState;
  setView2DState: (viewport: Viewport) => void;
  setView3DState: (position: THREE.Vector3, target: THREE.Vector3, rotation: THREE.Euler) => void;
}

const ViewStateContext = createContext<ViewStateContextType | undefined>(undefined);

export const ViewStateProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [view2D, setView2D] = useState<View2DState>({
    viewport: null,
  });

  const [view3D, setView3D] = useState<View3DState>({
    cameraPosition: null,
    cameraTarget: null,
    cameraRotation: null,
  });

  const setView2DState = useCallback((viewport: Viewport) => {
    setView2D({ viewport });
  }, []);

  const setView3DState = useCallback((
    position: THREE.Vector3,
    target: THREE.Vector3,
    rotation: THREE.Euler
  ) => {
    setView3D({
      cameraPosition: position.clone(),
      cameraTarget: target.clone(),
      cameraRotation: rotation.clone(),
    });
  }, []);

  const value = useMemo(() => ({
    view2D,
    view3D,
    setView2DState,
    setView3DState,
  }), [view2D, view3D, setView2DState, setView3DState]);

  return (
    <ViewStateContext.Provider value={value}>
      {children}
    </ViewStateContext.Provider>
  );
};

export const useViewState = () => {
  const context = useContext(ViewStateContext);
  if (!context) {
    throw new Error('useViewState must be used within a ViewStateProvider');
  }
  return context;
};