import { useEffect, useRef, useState } from "react";

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
  const previousValueRef = useRef<string>(JSON.stringify(value));

  useEffect(() => {
    const serialized = JSON.stringify(value);

    // Skip if value hasn't actually changed (handles arrays/objects)
    if (serialized === previousValueRef.current) {
      return;
    }
    previousValueRef.current = serialized;

    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}
