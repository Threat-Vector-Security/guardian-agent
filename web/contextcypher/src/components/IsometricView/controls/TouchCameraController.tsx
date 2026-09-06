import React, { useEffect, useRef } from 'react';
import { OrbitControls } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useViewState } from '../../../contexts/ViewStateContext';

interface TouchCameraControllerProps {
  minDistance?: number;
  maxDistance?: number;
}

export const TouchCameraController: React.FC<TouchCameraControllerProps> = ({
  minDistance = 12,
  maxDistance = 420
}) => {
  const controlsRef = useRef<any>(null);
  const saveTimerRef = useRef<NodeJS.Timeout>();
  const { camera } = useThree();
  const { view3D, setView3DState } = useViewState();

  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls) return;

    if (view3D.cameraPosition && view3D.cameraRotation) {
      camera.position.copy(view3D.cameraPosition);
      camera.rotation.copy(view3D.cameraRotation);
    } else {
      camera.position.set(50, 35, 50);
      camera.lookAt(0, 0, 0);
    }

    if (view3D.cameraTarget) {
      controls.target.copy(view3D.cameraTarget);
    } else {
      controls.target.set(0, 0, 0);
    }

    controls.update();
  }, [camera, view3D.cameraPosition, view3D.cameraRotation, view3D.cameraTarget]);

  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls) return;

    const persistState = () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }

      saveTimerRef.current = setTimeout(() => {
        setView3DState(
          camera.position.clone(),
          controls.target.clone(),
          camera.rotation.clone()
        );
      }, 120);
    };

    controls.addEventListener('end', persistState);

    return () => {
      controls.removeEventListener('end', persistState);
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
    };
  }, [camera, setView3DState]);

  return (
    <OrbitControls
      ref={controlsRef}
      enableRotate={true}
      enablePan={true}
      enableZoom={true}
      enableDamping={true}
      dampingFactor={0.08}
      rotateSpeed={0.65}
      zoomSpeed={0.9}
      panSpeed={0.9}
      minDistance={minDistance}
      maxDistance={maxDistance}
      minPolarAngle={0.05}
      maxPolarAngle={Math.PI - 0.08}
      screenSpacePanning={true}
      touches={{
        ONE: THREE.TOUCH.ROTATE,
        TWO: THREE.TOUCH.DOLLY_PAN
      }}
      mouseButtons={{
        LEFT: THREE.MOUSE.ROTATE,
        MIDDLE: THREE.MOUSE.DOLLY,
        RIGHT: THREE.MOUSE.PAN
      }}
    />
  );
};

export default TouchCameraController;
