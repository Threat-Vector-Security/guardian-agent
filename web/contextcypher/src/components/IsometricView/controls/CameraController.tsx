import React, { useRef, useEffect } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { CAMERA_CONFIG } from '../utils/gameConstants';

interface CameraControllerProps {
  target?: THREE.Vector3;
  enableRotation?: boolean;
}

export const CameraController: React.FC<CameraControllerProps> = ({
  target = new THREE.Vector3(0, 0, 0),
  enableRotation = true,
}) => {
  const controlsRef = useRef<any>(null);
  const { camera } = useThree();

  // Set up isometric camera angle
  useEffect(() => {
    // Calculate isometric position
    const distance = 100;
    const angle = Math.PI / 4; // 45 degrees horizontal
    const elevation = CAMERA_CONFIG.isometricAngle;

    const x = distance * Math.cos(angle) * Math.cos(elevation);
    const y = distance * Math.sin(elevation);
    const z = distance * Math.sin(angle) * Math.cos(elevation);

    camera.position.set(x, y, z);
    camera.lookAt(target);
    camera.updateProjectionMatrix();
  }, [camera, target]);

  // Smooth camera movement to target
  useFrame((state, delta) => {
    if (controlsRef.current) {
      // Optionally add smooth transitions here
      controlsRef.current.update();
    }
  });

  return (
    <OrbitControls
      ref={controlsRef}
      enableRotate={enableRotation}
      enablePan={true}
      enableZoom={true}
      target={target}
      minDistance={20}
      maxDistance={200}
      minPolarAngle={Math.PI / 6} // 30 degrees
      maxPolarAngle={Math.PI / 3} // 60 degrees
      minAzimuthAngle={-Math.PI / 4} // -45 degrees
      maxAzimuthAngle={Math.PI / 4} // 45 degrees
      zoomSpeed={0.8}
      panSpeed={0.8}
      rotateSpeed={0.5}
      // Enable damping for smooth movement
      enableDamping={true}
      dampingFactor={0.05}
      // Prevent camera from going below ground
      // @ts-ignore - Custom property for extended OrbitControls
      maxTargetY={50}
      // Mouse buttons configuration
      mouseButtons={{
        LEFT: THREE.MOUSE.ROTATE,
        MIDDLE: THREE.MOUSE.DOLLY,
        RIGHT: THREE.MOUSE.PAN,
      }}
      // Touch configuration
      touches={{
        ONE: THREE.TOUCH.ROTATE,
        TWO: THREE.TOUCH.DOLLY_PAN,
      }}
    />
  );
};

// Hook for programmatic camera control
export const useCameraControls = () => {
  const { camera } = useThree();

  const focusOnPosition = (position: THREE.Vector3, duration: number = 1000) => {
    // Implementation for smooth camera transitions
    // This would animate the camera to focus on a specific position
    const startPosition = camera.position.clone();
    const startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Smooth easing
      const easedProgress = 1 - Math.pow(1 - progress, 3);

      camera.position.lerpVectors(startPosition, position, easedProgress);
      camera.lookAt(0, 0, 0);

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    animate();
  };

  const resetCamera = () => {
    focusOnPosition(CAMERA_CONFIG.position);
  };

  const setIsometricView = (angle: number = Math.PI / 4) => {
    const distance = 100;
    const elevation = CAMERA_CONFIG.isometricAngle;

    const x = distance * Math.cos(angle) * Math.cos(elevation);
    const y = distance * Math.sin(elevation);
    const z = distance * Math.sin(angle) * Math.cos(elevation);

    focusOnPosition(new THREE.Vector3(x, y, z));
  };

  return {
    focusOnPosition,
    resetCamera,
    setIsometricView,
  };
};