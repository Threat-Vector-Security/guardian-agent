import React, { useRef, useEffect } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useViewState } from '../../../contexts/ViewStateContext';

interface UnrealCameraControllerProps {
  moveSpeed?: number;
  lookSpeed?: number;
}

export const UnrealCameraController: React.FC<UnrealCameraControllerProps> = ({
  moveSpeed = 20,
  lookSpeed = 0.002,
}) => {
  const { camera, gl } = useThree();
  const isPointerLocked = useRef(false);
  const { view3D, setView3DState } = useViewState();

  // Movement state
  const keys = useRef({
    w: false,
    a: false,
    s: false,
    d: false,
    q: false,
    e: false,
    shift: false,
  });

  // Mouse state
  const mouseState = useRef({
    mouseX: 0,
    mouseY: 0,
    isRightMouseDown: false,
  });

  // Camera rotation
  const euler = useRef(new THREE.Euler(0, 0, 0, 'YXZ'));
  const moveVector = useRef(new THREE.Vector3());
  const PI_2 = Math.PI / 2;

  // Persist ref for setView3DState so the effect closure stays stable
  const setView3DStateRef = useRef(setView3DState);
  setView3DStateRef.current = setView3DState;

  const saveCameraState = useRef(() => {
    const target = new THREE.Vector3(0, 0, 0);
    setView3DStateRef.current(camera.position, target, camera.rotation);
  });

  useEffect(() => {
    const canvas = gl.domElement;

    // Keyboard handlers
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeElement = document.activeElement;
      const isInputActive = activeElement && (
        activeElement.tagName === 'INPUT' ||
        activeElement.tagName === 'TEXTAREA' ||
        activeElement.getAttribute('contenteditable') === 'true' ||
        activeElement.closest('[contenteditable="true"]')
      );

      if (isInputActive) return;

      const key = e.key.toLowerCase();
      if (key in keys.current) {
        keys.current[key as keyof typeof keys.current] = true;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const activeElement = document.activeElement;
      const isInputActive = activeElement && (
        activeElement.tagName === 'INPUT' ||
        activeElement.tagName === 'TEXTAREA' ||
        activeElement.getAttribute('contenteditable') === 'true' ||
        activeElement.closest('[contenteditable="true"]')
      );

      if (isInputActive) return;

      const key = e.key.toLowerCase();
      if (key in keys.current) {
        keys.current[key as keyof typeof keys.current] = false;
      }
    };

    // Mouse handlers
    const handleMouseDown = (e: MouseEvent) => {
      if (e.button === 2) {
        mouseState.current.isRightMouseDown = true;
        canvas.requestPointerLock();
      }
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (e.button === 2) {
        mouseState.current.isRightMouseDown = false;
        if (document.pointerLockElement === canvas) {
          document.exitPointerLock();
        }
        saveCameraState.current();
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (document.pointerLockElement === canvas) {
        mouseState.current.mouseX = e.movementX;
        mouseState.current.mouseY = e.movementY;
      }
    };

    const handlePointerLockChange = () => {
      isPointerLocked.current = document.pointerLockElement === canvas;
    };

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    const handleFocusIn = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      const isInputElement = target && (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.getAttribute('contenteditable') === 'true' ||
        target.closest('[contenteditable="true"]')
      );

      if (isInputElement) {
        Object.keys(keys.current).forEach(key => {
          keys.current[key as keyof typeof keys.current] = false;
        });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('focusin', handleFocusIn);
    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mouseup', handleMouseUp);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('pointerlockchange', handlePointerLockChange);

    if (view3D.cameraPosition && view3D.cameraRotation) {
      camera.position.copy(view3D.cameraPosition);
      camera.rotation.copy(view3D.cameraRotation);
    } else {
      camera.position.set(50, 30, 50);
      camera.lookAt(0, 0, 0);
    }

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('focusin', handleFocusIn);
      canvas.removeEventListener('mousedown', handleMouseDown);
      canvas.removeEventListener('mouseup', handleMouseUp);
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('pointerlockchange', handlePointerLockChange);
    };
  }, [gl, camera]);

  useFrame((_, delta) => {
    if (isPointerLocked.current) {
      euler.current.setFromQuaternion(camera.quaternion);
      euler.current.y -= mouseState.current.mouseX * lookSpeed;
      euler.current.x -= mouseState.current.mouseY * lookSpeed;
      euler.current.x = Math.max(-PI_2, Math.min(PI_2, euler.current.x));
      camera.quaternion.setFromEuler(euler.current);

      mouseState.current.mouseX = 0;
      mouseState.current.mouseY = 0;
    }

    const actualMoveSpeed = keys.current.shift ? moveSpeed * 3 : moveSpeed;
    const moveDistance = actualMoveSpeed * delta;

    const mv = moveVector.current;
    mv.set(0, 0, 0);

    if (keys.current.w) mv.z -= 1;
    if (keys.current.s) mv.z += 1;
    if (keys.current.a) mv.x -= 1;
    if (keys.current.d) mv.x += 1;
    if (keys.current.e) mv.y += 1;
    if (keys.current.q) mv.y -= 1;

    if (mv.lengthSq() > 0) {
      mv.normalize();
      mv.multiplyScalar(moveDistance);
      mv.applyQuaternion(camera.quaternion);
      camera.position.add(mv);
    }
  });

  return null;
};