import { useCallback, useEffect, useRef } from "react";
import { useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";

// =============================================================================
// Types
// =============================================================================

type MutationKey = readonly unknown[];

interface LatestMutationOptions<TData, TVariables> {
  mutationKey: MutationKey;
  mutationFn: (variables: TVariables, signal: AbortSignal) => Promise<TData>;
  debounceMs?: number;
  invalidateKeys?: MutationKey[];
  onSuccess?: (data: TData, variables: TVariables) => void;
  onError?: (error: Error, variables: TVariables) => void;
  onSettled?: (data: TData | undefined, error: Error | null, variables: TVariables) => void;
  queryClient?: QueryClient;
}

interface LatestMutationResult<TData, TVariables> {
  mutateDebounced: (variables: TVariables) => void;
  mutateDebouncedAsync: (variables: TVariables) => Promise<TData>;
  mutateNow: (variables: TVariables) => void;
  mutateNowAsync: (variables: TVariables) => Promise<TData>;
  cancel: () => void;
  flush: () => void;
  reset: () => void;
  isPending: boolean;
  isSuccess: boolean;
  isError: boolean;
  isIdle: boolean;
  data: TData | undefined;
  error: Error | null;
  variables: TVariables | undefined;
}

// =============================================================================
// Simple Async Debouncer (replaces @tanstack/react-pacer)
// =============================================================================

interface AsyncDebouncerState<TVariables, TResult> {
  timeoutId: ReturnType<typeof setTimeout> | null;
  pendingVariables: TVariables | null;
  pendingResolve: ((value: TResult) => void) | null;
  pendingReject: ((error: unknown) => void) | null;
}

function useAsyncDebouncer<TVariables, TResult>(
  fn: (variables: TVariables) => Promise<TResult>,
  wait: number,
  onError?: (error: unknown) => void
) {
  const fnRef = useRef(fn);
  fnRef.current = fn;

  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  const state = useRef<AsyncDebouncerState<TVariables, TResult>>({
    timeoutId: null,
    pendingVariables: null,
    pendingResolve: null,
    pendingReject: null,
  });

  const cancel = useCallback(() => {
    if (state.current.timeoutId !== null) {
      clearTimeout(state.current.timeoutId);
      state.current.timeoutId = null;
    }
    state.current.pendingVariables = null;
    state.current.pendingResolve = null;
    state.current.pendingReject = null;
  }, []);

  const flush = useCallback(() => {
    if (state.current.timeoutId !== null && state.current.pendingVariables !== null) {
      clearTimeout(state.current.timeoutId);
      state.current.timeoutId = null;
      const variables = state.current.pendingVariables;
      const resolve = state.current.pendingResolve;
      const reject = state.current.pendingReject;
      state.current.pendingVariables = null;
      state.current.pendingResolve = null;
      state.current.pendingReject = null;
      fnRef
        .current(variables)
        .then((result) => resolve?.(result))
        .catch((error) => {
          reject?.(error);
          onErrorRef.current?.(error);
        });
    }
  }, []);

  const maybeExecute = useCallback(
    (variables: TVariables) => {
      cancel();
      state.current.pendingVariables = variables;
      state.current.timeoutId = setTimeout(() => {
        state.current.timeoutId = null;
        const vars = state.current.pendingVariables;
        const resolve = state.current.pendingResolve;
        const reject = state.current.pendingReject;
        state.current.pendingVariables = null;
        state.current.pendingResolve = null;
        state.current.pendingReject = null;
        if (vars !== null) {
          fnRef
            .current(vars)
            .then((result) => resolve?.(result))
            .catch((error) => {
              reject?.(error);
              onErrorRef.current?.(error);
            });
        }
      }, wait);
    },
    [wait, cancel]
  );

  const maybeExecuteAsync = useCallback(
    (variables: TVariables): Promise<TResult> => {
      return new Promise((resolve, reject) => {
        cancel();
        state.current.pendingVariables = variables;
        state.current.pendingResolve = resolve;
        state.current.pendingReject = reject;
        state.current.timeoutId = setTimeout(() => {
          state.current.timeoutId = null;
          const vars = state.current.pendingVariables;
          const res = state.current.pendingResolve;
          const rej = state.current.pendingReject;
          state.current.pendingVariables = null;
          state.current.pendingResolve = null;
          state.current.pendingReject = null;
          if (vars !== null) {
            fnRef
              .current(vars)
              .then((result) => res?.(result))
              .catch((error) => {
                rej?.(error);
                onErrorRef.current?.(error);
              });
          }
        }, wait);
      });
    },
    [wait, cancel]
  );

  useEffect(() => {
    return () => {
      cancel();
    };
  }, [cancel]);

  return { maybeExecute, maybeExecuteAsync, cancel, flush };
}

// =============================================================================
// Global Latest Registry
// =============================================================================

interface LatestEntry {
  abortController: AbortController;
  requestId: number;
}

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
  entry.abortController.abort();
  entry.abortController = new AbortController();
  const requestId = ++entry.requestId;
  return { signal: entry.abortController.signal, requestId };
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

  const callbacksRef = useRef({ onSuccess, onError, onSettled });
  callbacksRef.current = { onSuccess, onError, onSettled };

  const mutationFnRef = useRef(mutationFn);
  mutationFnRef.current = mutationFn;

  const mutation = useMutation<TData, Error, TVariables>({
    mutationKey,
    mutationFn: async (variables: TVariables) => {
      const { signal, requestId } = supersede(keyString);

      try {
        const result = await mutationFnRef.current(variables, signal);
        if (isStaleRequest(keyString, requestId)) {
          throw new SupersededError();
        }
        return result;
      } catch (error) {
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

  const mutationRef = useRef(mutation);
  mutationRef.current = mutation;

  const debouncer = useAsyncDebouncer(
    async (variables: TVariables) => {
      return mutationRef.current.mutateAsync(variables);
    },
    debounceMs,
    (error) => {
      if (isAbortOrSuperseded(error)) return;
    }
  );

  const debouncerRef = useRef(debouncer);
  debouncerRef.current = debouncer;

  const mutateDebounced = useCallback(
    (variables: TVariables) => {
      if (debounceMs <= 0) {
        mutationRef.current.mutate(variables);
      } else {
        debouncerRef.current.maybeExecute(variables);
      }
    },
    [debounceMs]
  );

  const mutateDebouncedAsync = useCallback(
    (variables: TVariables): Promise<TData> => {
      if (debounceMs <= 0) {
        return mutationRef.current.mutateAsync(variables);
      }
      return debouncerRef.current.maybeExecuteAsync(variables);
    },
    [debounceMs]
  );

  const mutateNow = useCallback((variables: TVariables) => {
    debouncerRef.current.cancel();
    mutationRef.current.mutate(variables);
  }, []);

  const mutateNowAsync = useCallback(async (variables: TVariables): Promise<TData> => {
    debouncerRef.current.cancel();
    return mutationRef.current.mutateAsync(variables);
  }, []);

  const cancel = useCallback(() => {
    debouncerRef.current.cancel();
    const entry = supersedingRegistry.get(keyString);
    if (entry) {
      entry.abortController.abort();
      entry.abortController = new AbortController();
    }
  }, [keyString]);

  const flush = useCallback(() => {
    debouncerRef.current.flush();
  }, []);

  const reset = useCallback(() => {
    mutation.reset();
  }, [mutation]);

  useEffect(() => {
    return () => {
      debouncerRef.current.cancel();
    };
  }, []);

  const isRealError = mutation.isError && !isAbortOrSuperseded(mutation.error);

  return {
    mutateDebounced,
    mutateDebouncedAsync,
    mutateNow,
    mutateNowAsync,
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
// Utilities
// =============================================================================

export function cancelLatestMutation(mutationKey: MutationKey): void {
  const keyString = getKeyString(mutationKey);
  const entry = supersedingRegistry.get(keyString);
  if (entry) {
    entry.abortController.abort();
    supersedingRegistry.delete(keyString);
  }
}

export function isMutationInflight(mutationKey: MutationKey): boolean {
  const keyString = getKeyString(mutationKey);
  return supersedingRegistry.has(keyString);
}
