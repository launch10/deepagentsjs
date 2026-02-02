import { useRef, useCallback } from "react";

/**
 * Tracks whether a selection has changed from its last persisted state.
 * Useful for avoiding unnecessary saves when a value hasn't actually changed.
 *
 * @param selection - The current selection value
 * @param isEqual - Optional equality function (defaults to comparing domain + path)
 * @returns isDirty - Whether the selection differs from last persisted
 * @returns markPersisted - Call after successfully saving to update the baseline
 */
export function useDirtySelection<T>(
  selection: T | null,
  isEqual: (a: T, b: T) => boolean
) {
  const lastPersisted = useRef<T | null>(null);

  const isDirty =
    selection !== null &&
    (lastPersisted.current === null || !isEqual(selection, lastPersisted.current));

  const markPersisted = useCallback((value: T) => {
    lastPersisted.current = value;
  }, []);

  return { isDirty, markPersisted };
}
