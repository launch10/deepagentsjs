import { useState, useEffect, useRef } from "react";

/**
 * Hook that ensures a boolean state stays true for at least a minimum duration.
 * Useful for loading states where you want to avoid flickering.
 *
 * @param isActive - The actual state (e.g., isFetching)
 * @param minDurationMs - Minimum duration to show the active state (default: 3000ms)
 * @returns boolean - Whether to show the active state (respects minimum duration)
 *
 * @example
 * const { isFetching } = useQuery(...);
 * const isShowingLoader = useMinimumDuration(isFetching, 2000);
 * // isShowingLoader stays true for at least 2 seconds after isFetching becomes true
 */
export function useMinimumDuration(isActive: boolean, minDurationMs = 3000): boolean {
  const [isShowing, setIsShowing] = useState(false);
  const startTimeRef = useRef<number | null>(null);

  useEffect(() => {
    if (isActive && !isShowing) {
      // Start showing
      setIsShowing(true);
      startTimeRef.current = Date.now();
    } else if (!isActive && isShowing && startTimeRef.current) {
      // Active state ended - ensure minimum duration
      const elapsed = Date.now() - startTimeRef.current;
      const remaining = Math.max(0, minDurationMs - elapsed);

      const timer = setTimeout(() => {
        setIsShowing(false);
        startTimeRef.current = null;
      }, remaining);

      return () => clearTimeout(timer);
    }
  }, [isActive, isShowing, minDurationMs]);

  return isShowing;
}
