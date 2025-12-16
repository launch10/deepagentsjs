import { useEffect, useState } from "react";

/**
 * Debounces a value, returning the debounced value after the specified delay.
 * Useful for autosave functionality where you want to wait for the user to stop typing.
 *
 * @param value - The value to debounce
 * @param delay - Delay in milliseconds (default: 750ms)
 * @returns The debounced value
 */
export function useDebounce<T>(value: T, delay: number = 750): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}
