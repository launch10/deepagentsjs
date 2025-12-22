import { useCallback, useEffect, useRef } from "react";
import { useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useAsyncDebouncer } from "@tanstack/react-pacer/async-debouncer";

// =============================================================================
// Types
// =============================================================================

type MutationKey = readonly unknown[];

interface LatestMutationOptions<TData, TVariables> {
  /**
   * Required key that scopes the superseding behavior.
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
// Global Latest Registry
// =============================================================================

interface LatestEntry {
  abortController: AbortController;
  requestId: number;
}

/**
 * Global registry tracking in-flight mutations by key.
 * This enables cross-component superseding.
 *
 * Note: Debouncing is handled per-component by Pacer.
 * This registry only handles the superseding/cancellation semantics.
 */
const supersedingRegistry = new Map<string, LatestEntry>();

function getKeyString(key: MutationKey): string {
  return JSON.stringify(key);
}

function getOrCreateEntry(keyString: string): LatestEntry {
  let entry = supersedingRegistry.get(keyString);
  if (!entry) {
    entry = {
      abortController: new AbortController(),
      requestId: 0,
    };
    supersedingRegistry.set(keyString, entry);
  }
  return entry;
}

function supersede(keyString: string): { signal: AbortSignal; requestId: number } {
  const entry = getOrCreateEntry(keyString);

  // Abort any in-flight request
  entry.abortController.abort();
  entry.abortController = new AbortController();

  // Increment request ID
  const requestId = ++entry.requestId;

  return {
    signal: entry.abortController.signal,
    requestId,
  };
}

function isStaleRequest(keyString: string, requestId: number): boolean {
  const entry = supersedingRegistry.get(keyString);
  return !entry || entry.requestId !== requestId;
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

  // The core mutation with superseding logic
  const mutation = useMutation<TData, Error, TVariables>({
    mutationKey,
    mutationFn: async (variables: TVariables) => {
      const { signal, requestId } = supersede(keyString);

      try {
        const result = await mutationFnRef.current(variables, signal);

        // Check if we were superseded while awaiting
        if (isStaleRequest(keyString, requestId)) {
          throw new SupersededError();
        }

        return result;
      } catch (error) {
        // Re-check superseded status for abort errors
        if (isStaleRequest(keyString, requestId)) {
          throw new SupersededError();
        }
        throw error;
      }
    },
    onSuccess: (data, variables) => {
      if (invalidateKeys?.length) {
        invalidateKeys.forEach((key) => {
          queryClient.invalidateQueries({ queryKey: key as unknown[] });
        });
      }
      callbacksRef.current.onSuccess?.(data, variables);
    },
    onError: (error, variables) => {
      if (isAbortOrSuperseded(error)) return;
      callbacksRef.current.onError?.(error, variables);
    },
    onSettled: (data, error, variables) => {
      if (error && isAbortOrSuperseded(error)) return;
      callbacksRef.current.onSettled?.(data, error, variables);
    },
  });

  // Ref for stable access in debouncer
  const mutationRef = useRef(mutation);
  mutationRef.current = mutation;

  // Use Pacer's async debouncer for debounce logic
  const debouncer = useAsyncDebouncer(
    async (variables: TVariables) => {
      return mutationRef.current.mutateAsync(variables);
    },
    {
      wait: debounceMs,
      onError: (error) => {
        // Pacer's error handler - silently ignore superseded
        if (isAbortOrSuperseded(error)) return;
        // Real errors are handled by mutation.onError
      },
    }
  );

  // Store debouncer ref for cleanup
  const debouncerRef = useRef(debouncer);
  debouncerRef.current = debouncer;

  /**
   * Execute with debouncing (if configured)
   */
  const mutate = useCallback(
    (variables: TVariables) => {
      if (debounceMs <= 0) {
        mutationRef.current.mutate(variables);
      } else {
        debouncerRef.current.maybeExecute(variables);
      }
    },
    [debounceMs]
  );

  /**
   * Execute immediately, bypassing debounce
   */
  const mutateNow = useCallback((variables: TVariables) => {
    debouncerRef.current.cancel();
    mutationRef.current.mutate(variables);
  }, []);

  /**
   * Execute immediately and return a promise
   */
  const mutateAsync = useCallback(async (variables: TVariables): Promise<TData> => {
    debouncerRef.current.cancel();
    return mutationRef.current.mutateAsync(variables);
  }, []);

  /**
   * Cancel everything - debounce timer AND in-flight request
   */
  const cancel = useCallback(() => {
    debouncerRef.current.cancel();
    const entry = supersedingRegistry.get(keyString);
    if (entry) {
      entry.abortController.abort();
      entry.abortController = new AbortController();
    }
  }, [keyString]);

  /**
   * Flush: if there's a pending debounced call, execute it now
   */
  const flush = useCallback(() => {
    debouncerRef.current.flush();
  }, []);

  /**
   * Reset mutation state
   */
  const reset = useCallback(() => {
    mutation.reset();
  }, [mutation]);

  // Cleanup debouncer on unmount (Pacer handles this internally too)
  useEffect(() => {
    return () => {
      debouncerRef.current.cancel();
    };
  }, []);

  // Filter out superseded errors from exposed state
  const isRealError = mutation.isError && !isAbortOrSuperseded(mutation.error);

  return {
    mutate,
    mutateNow,
    mutateAsync,
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
  const entry = supersedingRegistry.get(keyString);
  if (entry) {
    entry.abortController.abort();
    supersedingRegistry.delete(keyString);
  }
}

// =============================================================================
// Utility: Check if a mutation is in-flight for a key
// =============================================================================

export function isMutationInflight(mutationKey: MutationKey): boolean {
  const keyString = getKeyString(mutationKey);
  return supersedingRegistry.has(keyString);
}
