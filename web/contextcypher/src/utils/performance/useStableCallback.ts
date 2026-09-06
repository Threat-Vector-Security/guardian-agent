import { useCallback, useRef, useEffect, useMemo } from 'react';
import { debounce, throttle } from 'lodash';

/**
 * Creates a stable callback that maintains the same reference across renders
 * while always calling the latest version of the function
 */
export const useStableCallback = <T extends (...args: any[]) => any>(callback: T): T => {
  const callbackRef = useRef(callback);
  
  // Update the ref on each render
  useEffect(() => {
    callbackRef.current = callback;
  });
  
  // Return a stable callback that calls the current version
  return useCallback(((...args) => callbackRef.current(...args)) as T, []);
};

/**
 * Creates a debounced function that maintains a stable reference
 */
export const useStableDebounce = <T extends (...args: any[]) => any>(
  callback: T,
  delay: number,
  options?: Parameters<typeof debounce>[2]
): T & { cancel: () => void; flush: () => void } => {
  const stableCallback = useStableCallback(callback);
  
  // Create debounced function with stable reference
  return useMemo(
    () => debounce(stableCallback, delay, options) as unknown as T & { cancel: () => void; flush: () => void },
    [stableCallback, delay] // Only recreate if delay changes
  );
};

/**
 * Creates a throttled function that maintains a stable reference
 */
export const useStableThrottle = <T extends (...args: any[]) => any>(
  callback: T,
  delay: number,
  options?: Parameters<typeof throttle>[2]
): T & { cancel: () => void; flush: () => void } => {
  const stableCallback = useStableCallback(callback);
  
  // Create throttled function with stable reference
  return useMemo(
    () => throttle(stableCallback, delay, options) as unknown as T & { cancel: () => void; flush: () => void },
    [stableCallback, delay] // Only recreate if delay changes
  );
};