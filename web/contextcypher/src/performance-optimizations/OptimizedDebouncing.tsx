// OptimizedDebouncing.tsx - Performance optimized debouncing utilities
import { useCallback, useRef } from 'react';

// Stable debounce hook that doesn't recreate functions
export const useStableDebounce = <T extends (...args: any[]) => void>(
  callback: T,
  delay: number
): T => {
  const callbackRef = useRef(callback);
  const timeoutRef = useRef<NodeJS.Timeout>();

  // Update callback ref when callback changes
  callbackRef.current = callback;

  // Create stable debounced function that never changes identity
  const debouncedFn = useRef<T>();
  
  if (!debouncedFn.current) {
    debouncedFn.current = ((...args: Parameters<T>) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(() => {
        callbackRef.current(...args);
      }, delay);
    }) as T;
  }

  return debouncedFn.current;
};

// Throttle hook for high-frequency events
export const useStableThrottle = <T extends (...args: any[]) => void>(
  callback: T,
  delay: number
): T => {
  const callbackRef = useRef(callback);
  const lastCallRef = useRef(0);
  const timeoutRef = useRef<NodeJS.Timeout>();

  callbackRef.current = callback;

  const throttledFn = useRef<T>();
  
  if (!throttledFn.current) {
    throttledFn.current = ((...args: Parameters<T>) => {
      const now = Date.now();
      const timeSinceLastCall = now - lastCallRef.current;

      if (timeSinceLastCall >= delay) {
        lastCallRef.current = now;
        callbackRef.current(...args);
      } else {
        // Schedule for later if not already scheduled
        if (!timeoutRef.current) {
          timeoutRef.current = setTimeout(() => {
            lastCallRef.current = Date.now();
            callbackRef.current(...args);
            timeoutRef.current = undefined;
          }, delay - timeSinceLastCall);
        }
      }
    }) as T;
  }

  return throttledFn.current;
};

// RAF-based debouncing for smooth animations
export const useRAFDebounce = <T extends (...args: any[]) => void>(
  callback: T
): T => {
  const callbackRef = useRef(callback);
  const frameRef = useRef<number>();

  callbackRef.current = callback;

  const rafDebouncedFn = useRef<T>();
  
  if (!rafDebouncedFn.current) {
    rafDebouncedFn.current = ((...args: Parameters<T>) => {
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
      }
      frameRef.current = requestAnimationFrame(() => {
        callbackRef.current(...args);
        frameRef.current = undefined;
      });
    }) as T;
  }

  return rafDebouncedFn.current;
};

// Optimized change tracking for ReactFlow
export const useOptimizedChangeTracking = (
  trackChanges: (data: { nodes: any[]; edges: any[] }) => void
) => {
  const trackChangesRef = useRef(trackChanges);
  const pendingDataRef = useRef<{ nodes: any[]; edges: any[] } | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout>();

  trackChangesRef.current = trackChanges;

  const debouncedTrackChanges = useCallback((data: { nodes: any[]; edges: any[] }) => {
    // Store the latest data
    pendingDataRef.current = data;

    // Clear existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Schedule tracking with the latest data
    timeoutRef.current = setTimeout(() => {
      if (pendingDataRef.current) {
        trackChangesRef.current(pendingDataRef.current);
        pendingDataRef.current = null;
      }
    }, 150); // Reduced from 250ms for better responsiveness
  }, []);

  return debouncedTrackChanges;
};