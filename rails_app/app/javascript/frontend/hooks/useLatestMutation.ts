import { useCallback, useEffect, useRef } from "react";
import {
  useMutation,
  useQueryClient,
  type UseMutationOptions,
  type QueryClient,
} from "@tanstack/react-query";

// =============================================================================
// Types
// =============================================================================

type MutationKey = readonly unknown[];

interface LatestMutationOptions<TData, TVariables> {
  /**
   * Required key that scopes the latest behavior.
   * Mutations with the same key will cancel each other.
   *
   * @example ['saveDocument', documentId]
   * @example ['updateUser', userId]
   */
  mutationKey: MutationKey;

  /**
   * The mutation function. Receives an AbortSignal that will be triggered
   * if a newer mutation supersedes this one.
   */
  mutationFn: (variables: TVariables, signal: AbortSignal) => Promise<TData>;

  /**
   * Optional debounce delay in ms. When set, rapid calls are coalesced
   * and only the final call executes after the delay.
   *
   * @default 0 (no debounce)
   */
  debounceMs?: number;

  /**
   * Query keys to invalidate on success.
   */
  invalidateKeys?: MutationKey[];

  /**
   * Callbacks
   */
  onSuccess?: (data: TData, variables: TVariables) => void;
  onError?: (error: Error, variables: TVariables) => void;
  onSettled?: (data: TData | undefined, error: Error | null, variables: TVariables) => void;

  /**
   * Optional query client override
   */
  queryClient?: QueryClient;
}

interface LatestMutationResult<TData, TVariables> {
  /**
   * Trigger the mutation with debouncing (if configured).
   * Supersedes any pending or in-flight mutation with the same key.
   */
  mutate: (variables: TVariables) => void;

  /**
   * Trigger the mutation immediately, bypassing any debounce.
   * Still supersedes any in-flight mutation with the same key.
   */
  mutateNow: (variables: TVariables) => void;

  /**
   * Returns a promise. Useful for chaining or awaiting.
   * Supersedes any pending or in-flight mutation with the same key.
   */
  mutateAsync: (variables: TVariables) => Promise<TData>;

  /**
   * Cancel any pending debounce timer AND abort any in-flight request.
   */
  cancel: () => void;

  /**
   * If there's a pending debounced call, execute it immediately.
   */
  flush: () => void;

  /**
   * Reset mutation state (clears data, error, etc.)
   */
  reset: () => void;

  // State
  isPending: boolean;
  isSuccess: boolean;
  isError: boolean;
  isIdle: boolean;
  data: TData | undefined;
  error: Error | null;

  /**
   * The variables from the most recent mutation call
   */
  variables: TVariables | undefined;
}

// =============================================================================
// Global Registry
// =============================================================================

interface MutationEntry {
  abortController: AbortController;
  requestId: number;
  debounceTimer: ReturnType<typeof setTimeout> | null;
  pendingVariables: unknown | null;
}

/**
 * Global registry tracking in-flight mutations by key.
 * This enables cross-component latest.
 */
const mutationRegistry = new Map<string, MutationEntry>();

function getKeyString(key: MutationKey): string {
  return JSON.stringify(key);
}

function getOrCreateEntry(keyString: string): MutationEntry {
  let entry = mutationRegistry.get(keyString);
  if (!entry) {
    entry = {
      abortController: new AbortController(),
      requestId: 0,
      debounceTimer: null,
      pendingVariables: null,
    };
    mutationRegistry.set(keyString, entry);
  }
  return entry;
}

function clearDebounceTimer(entry: MutationEntry): void {
  if (entry.debounceTimer !== null) {
    clearTimeout(entry.debounceTimer);
    entry.debounceTimer = null;
    entry.pendingVariables = null;
  }
}

function abortInflight(entry: MutationEntry): void {
  entry.abortController.abort();
  entry.abortController = new AbortController();
}

// =============================================================================
// Error Helpers
// =============================================================================

class SupersededError extends Error {
  constructor() {
    super("Request was superseded by a newer mutation");
    this.name = "SupersededError";
  }
}

function isAbortOrSuperseded(error: unknown): boolean {
  if (error instanceof SupersededError) return true;
  if (error instanceof Error && error.name === "AbortError") return true;
  if (error instanceof DOMException && error.name === "AbortError") return true;
  return false;
}

// =============================================================================
// Hook
// =============================================================================

export function useLatestMutation<TData, TVariables>({
  mutationKey,
  mutationFn,
  debounceMs = 0,
  invalidateKeys,
  onSuccess,
  onError,
  onSettled,
  queryClient: queryClientProp,
}: LatestMutationOptions<TData, TVariables>): LatestMutationResult<TData, TVariables> {
  const queryClient = useQueryClient(queryClientProp);
  const keyString = getKeyString(mutationKey);

  // Keep stable references to callbacks
  const callbacksRef = useRef({ onSuccess, onError, onSettled });
  callbacksRef.current = { onSuccess, onError, onSettled };

  // Keep stable reference to mutationFn
  const mutationFnRef = useRef(mutationFn);
  mutationFnRef.current = mutationFn;

  // Track if component is mounted
  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // The core mutation
  const mutation = useMutation<TData, Error, TVariables>({
    mutationKey,
    mutationFn: async (variables: TVariables) => {
      const entry = getOrCreateEntry(keyString);

      // Abort any in-flight request with same key
      abortInflight(entry);

      const thisRequestId = ++entry.requestId;
      const signal = entry.abortController.signal;

      try {
        const result = await mutationFnRef.current(variables, signal);

        // Check if we were superseded while awaiting
        const currentEntry = mutationRegistry.get(keyString);
        if (!currentEntry || currentEntry.requestId !== thisRequestId) {
          throw new SupersededError();
        }

        return result;
      } catch (error) {
        // Re-check superseded status for abort errors
        const currentEntry = mutationRegistry.get(keyString);
        if (currentEntry && currentEntry.requestId !== thisRequestId) {
          throw new SupersededError();
        }
        throw error;
      }
    },
    onSuccess: (data, variables) => {
      // Invalidate queries
      if (invalidateKeys?.length) {
        invalidateKeys.forEach((key) => {
          queryClient.invalidateQueries({ queryKey: key as unknown[] });
        });
      }
      callbacksRef.current.onSuccess?.(data, variables);
    },
    onError: (error, variables) => {
      // Don't surface abort/superseded as real errors
      if (isAbortOrSuperseded(error)) return;
      callbacksRef.current.onError?.(error, variables);
    },
    onSettled: (data, error, variables) => {
      // Don't call onSettled for superseded requests
      if (error && isAbortOrSuperseded(error)) return;
      callbacksRef.current.onSettled?.(data, error, variables);
    },
  });

  // Store mutation ref for use in callbacks
  const mutationRef = useRef(mutation);
  mutationRef.current = mutation;

  /**
   * Execute the mutation immediately (no debounce)
   */
  const executeNow = useCallback(
    (variables: TVariables) => {
      const entry = getOrCreateEntry(keyString);
      clearDebounceTimer(entry);
      mutationRef.current.mutate(variables);
    },
    [keyString]
  );

  /**
   * Execute the mutation immediately and return a promise
   */
  const executeNowAsync = useCallback(
    async (variables: TVariables): Promise<TData> => {
      const entry = getOrCreateEntry(keyString);
      clearDebounceTimer(entry);
      return mutationRef.current.mutateAsync(variables);
    },
    [keyString]
  );

  /**
   * Execute with debouncing (if configured)
   */
  const executeDebounced = useCallback(
    (variables: TVariables) => {
      const entry = getOrCreateEntry(keyString);

      // Clear any existing debounce timer
      clearDebounceTimer(entry);

      if (debounceMs <= 0) {
        // No debounce, execute immediately
        mutationRef.current.mutate(variables);
        return;
      }

      // Store pending variables and set timer
      entry.pendingVariables = variables;
      entry.debounceTimer = setTimeout(() => {
        entry.debounceTimer = null;
        entry.pendingVariables = null;
        if (isMountedRef.current) {
          mutationRef.current.mutate(variables);
        }
      }, debounceMs);
    },
    [keyString, debounceMs]
  );

  /**
   * Cancel everything - debounce timer AND in-flight request
   */
  const cancel = useCallback(() => {
    const entry = mutationRegistry.get(keyString);
    if (entry) {
      clearDebounceTimer(entry);
      abortInflight(entry);
    }
  }, [keyString]);

  /**
   * Flush: if there's a pending debounced call, execute it now
   */
  const flush = useCallback(() => {
    const entry = mutationRegistry.get(keyString);
    if (entry?.debounceTimer !== null && entry.pendingVariables !== null) {
      const variables = entry.pendingVariables as TVariables;
      clearDebounceTimer(entry);
      mutationRef.current.mutate(variables);
    }
  }, [keyString]);

  /**
   * Reset mutation state
   */
  const reset = useCallback(() => {
    mutation.reset();
  }, [mutation]);

  // Cleanup on unmount: cancel debounce timer but NOT in-flight requests
  // (other components might be waiting on them)
  useEffect(() => {
    return () => {
      const entry = mutationRegistry.get(keyString);
      if (entry) {
        clearDebounceTimer(entry);
      }
    };
  }, [keyString]);

  // Filter out superseded errors from exposed state
  const isRealError = mutation.isError && !isAbortOrSuperseded(mutation.error);

  return {
    mutate: executeDebounced,
    mutateNow: executeNow,
    mutateAsync: executeNowAsync,
    cancel,
    flush,
    reset,
    isPending: mutation.isPending,
    isSuccess: mutation.isSuccess,
    isError: isRealError,
    isIdle: mutation.isIdle,
    data: mutation.data,
    error: isRealError ? mutation.error : null,
    variables: mutation.variables,
  };
}

// =============================================================================
// Utility: Cancel all mutations for a key (useful for cleanup)
// =============================================================================

export function cancelLatestMutation(mutationKey: MutationKey): void {
  const keyString = getKeyString(mutationKey);
  const entry = mutationRegistry.get(keyString);
  if (entry) {
    clearDebounceTimer(entry);
    abortInflight(entry);
    mutationRegistry.delete(keyString);
  }
}

// =============================================================================
// Utility: Check if a mutation is in-flight for a key
// =============================================================================

export function isMutationInflight(mutationKey: MutationKey): boolean {
  const keyString = getKeyString(mutationKey);
  const entry = mutationRegistry.get(keyString);
  return entry !== undefined && entry.requestId > 0;
}
