import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useLatestMutation, cancelLatestMutation } from "../useLatestMutation";
import type { ReactNode } from "react";

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

function createDeferred<T>() {
  let resolve: (value: T) => void;
  let reject: (error: Error) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve: resolve!, reject: reject! };
}

async function flushPromises() {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe("useLatestMutation", () => {
  describe("basic mutation", () => {
    it("executes mutation and returns data", async () => {
      const deferred = createDeferred<{ success: boolean }>();
      const mutationFn = vi.fn().mockReturnValue(deferred.promise);

      const { result } = renderHook(
        () =>
          useLatestMutation({
            mutationKey: ["test"],
            mutationFn,
          }),
        { wrapper: createWrapper() }
      );

      expect(result.current.isIdle).toBe(true);

      await act(async () => {
        result.current.mutate({ id: 1 });
        await flushPromises();
      });

      expect(result.current.isPending).toBe(true);

      await act(async () => {
        deferred.resolve({ success: true });
        await flushPromises();
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual({ success: true });
      expect(mutationFn).toHaveBeenCalledTimes(1);
      expect(mutationFn).toHaveBeenCalledWith({ id: 1 }, expect.any(AbortSignal));
    });

    it("exposes isPending while mutation is in flight", async () => {
      const deferred = createDeferred<{ success: boolean }>();
      const mutationFn = vi.fn().mockReturnValue(deferred.promise);

      const { result } = renderHook(
        () =>
          useLatestMutation({
            mutationKey: ["test"],
            mutationFn,
          }),
        { wrapper: createWrapper() }
      );

      await act(async () => {
        result.current.mutate({ id: 1 });
        await flushPromises();
      });

      expect(result.current.isPending).toBe(true);

      await act(async () => {
        deferred.resolve({ success: true });
        await flushPromises();
      });

      await waitFor(() => {
        expect(result.current.isPending).toBe(false);
      });
    });
  });

  describe("debouncing", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("coalesces rapid calls when debounceMs is set", async () => {
      const deferred = createDeferred<{ value: string }>();
      const mutationFn = vi.fn().mockReturnValue(deferred.promise);

      const { result } = renderHook(
        () =>
          useLatestMutation({
            mutationKey: ["test"],
            mutationFn,
            debounceMs: 100,
          }),
        { wrapper: createWrapper() }
      );

      await act(async () => {
        result.current.mutate({ value: "first" });
        result.current.mutate({ value: "second" });
        result.current.mutate({ value: "third" });
      });

      expect(mutationFn).not.toHaveBeenCalled();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(100);
      });

      expect(mutationFn).toHaveBeenCalledTimes(1);
      expect(mutationFn).toHaveBeenCalledWith({ value: "third" }, expect.any(AbortSignal));

      await act(async () => {
        deferred.resolve({ value: "final" });
      });
    });

    it("mutateNow bypasses debounce", async () => {
      const deferred = createDeferred<{ success: boolean }>();
      const mutationFn = vi.fn().mockReturnValue(deferred.promise);

      const { result } = renderHook(
        () =>
          useLatestMutation({
            mutationKey: ["test"],
            mutationFn,
            debounceMs: 100,
          }),
        { wrapper: createWrapper() }
      );

      await act(async () => {
        result.current.mutate({ value: "debounced" });
      });

      expect(mutationFn).not.toHaveBeenCalled();

      await act(async () => {
        result.current.mutateNow({ value: "immediate" });
        await vi.advanceTimersByTimeAsync(0);
      });

      expect(mutationFn).toHaveBeenCalledTimes(1);
      expect(mutationFn).toHaveBeenCalledWith({ value: "immediate" }, expect.any(AbortSignal));

      await act(async () => {
        deferred.resolve({ success: true });
      });
    });

    it("flush executes pending debounced call immediately", async () => {
      const deferred = createDeferred<{ success: boolean }>();
      const mutationFn = vi.fn().mockReturnValue(deferred.promise);

      const { result } = renderHook(
        () =>
          useLatestMutation({
            mutationKey: ["test"],
            mutationFn,
            debounceMs: 100,
          }),
        { wrapper: createWrapper() }
      );

      await act(async () => {
        result.current.mutate({ value: "pending" });
      });

      expect(mutationFn).not.toHaveBeenCalled();

      await act(async () => {
        result.current.flush();
        await vi.advanceTimersByTimeAsync(0);
      });

      expect(mutationFn).toHaveBeenCalledTimes(1);
      expect(mutationFn).toHaveBeenCalledWith({ value: "pending" }, expect.any(AbortSignal));

      await act(async () => {
        deferred.resolve({ success: true });
      });
    });
  });

  describe("superseding", () => {
    it("aborts previous in-flight request when new call is made", async () => {
      const signals: AbortSignal[] = [];
      const deferreds = [
        createDeferred<{ success: boolean }>(),
        createDeferred<{ success: boolean }>(),
      ];
      let callCount = 0;

      const mutationFn = vi.fn().mockImplementation((_vars, signal: AbortSignal) => {
        signals.push(signal);
        return deferreds[callCount++].promise;
      });

      const { result } = renderHook(
        () =>
          useLatestMutation({
            mutationKey: ["test-supersede"],
            mutationFn,
          }),
        { wrapper: createWrapper() }
      );

      await act(async () => {
        result.current.mutate({ id: 1 });
        await flushPromises();
      });

      expect(signals).toHaveLength(1);
      expect(signals[0].aborted).toBe(false);

      await act(async () => {
        result.current.mutate({ id: 2 });
        await flushPromises();
      });

      expect(signals[0].aborted).toBe(true);
      expect(signals).toHaveLength(2);
      expect(signals[1].aborted).toBe(false);

      await act(async () => {
        deferreds[1].resolve({ success: true });
        await flushPromises();
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });
      expect(result.current.data).toEqual({ success: true });
    });

    it("ignores stale response even if abort fails", async () => {
      const deferreds = [createDeferred<{ id: number }>(), createDeferred<{ id: number }>()];
      let callCount = 0;

      const mutationFn = vi.fn().mockImplementation((_vars: { id: number }) => {
        return deferreds[callCount++].promise;
      });

      const { result } = renderHook(
        () =>
          useLatestMutation({
            mutationKey: ["test-stale"],
            mutationFn,
          }),
        { wrapper: createWrapper() }
      );

      await act(async () => {
        result.current.mutate({ id: 1 });
        await flushPromises();
      });

      await act(async () => {
        result.current.mutate({ id: 2 });
        await flushPromises();
      });

      await act(async () => {
        deferreds[0].resolve({ id: 1 });
        await flushPromises();
      });

      expect(result.current.isSuccess).toBe(false);
      expect(result.current.data).toBeUndefined();

      await act(async () => {
        deferreds[1].resolve({ id: 2 });
        await flushPromises();
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });
      expect(result.current.data).toEqual({ id: 2 });
    });
  });

  describe("cancel", () => {
    it("aborts in-flight request", async () => {
      let signal: AbortSignal | undefined;
      const deferred = createDeferred<{ success: boolean }>();
      const mutationFn = vi.fn().mockImplementation((_vars, sig: AbortSignal) => {
        signal = sig;
        return deferred.promise;
      });

      const { result } = renderHook(
        () =>
          useLatestMutation({
            mutationKey: ["test-cancel"],
            mutationFn,
          }),
        { wrapper: createWrapper() }
      );

      await act(async () => {
        result.current.mutate({ id: 1 });
        await flushPromises();
      });

      expect(result.current.isPending).toBe(true);
      expect(signal).toBeDefined();
      expect(signal!.aborted).toBe(false);

      act(() => {
        result.current.cancel();
      });

      expect(signal!.aborted).toBe(true);
    });
  });

  describe("error handling", () => {
    it("surfaces real errors", async () => {
      const error = new Error("Network error");
      const deferred = createDeferred<never>();
      const mutationFn = vi.fn().mockReturnValue(deferred.promise);
      const onError = vi.fn();

      const { result } = renderHook(
        () =>
          useLatestMutation({
            mutationKey: ["test-error"],
            mutationFn,
            onError,
          }),
        { wrapper: createWrapper() }
      );

      await act(async () => {
        result.current.mutate({ id: 1 });
        await flushPromises();
      });

      await act(async () => {
        deferred.reject(error);
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error?.message).toBe("Network error");
      expect(onError).toHaveBeenCalledWith(error, { id: 1 });
    });

    it("swallows abort errors from superseded requests", async () => {
      const deferreds = [
        createDeferred<{ success: boolean }>(),
        createDeferred<{ success: boolean }>(),
      ];
      let callCount = 0;

      const mutationFn = vi.fn().mockImplementation((_vars, signal: AbortSignal) => {
        const deferred = deferreds[callCount++];
        signal.addEventListener("abort", () => {
          deferred.reject(new DOMException("Aborted", "AbortError"));
        });
        return deferred.promise;
      });

      const onError = vi.fn();

      const { result } = renderHook(
        () =>
          useLatestMutation({
            mutationKey: ["test-abort"],
            mutationFn,
            onError,
          }),
        { wrapper: createWrapper() }
      );

      await act(async () => {
        result.current.mutate({ id: 1 });
        await flushPromises();
      });

      await act(async () => {
        result.current.mutate({ id: 2 });
        await flushPromises();
      });

      await act(async () => {
        deferreds[1].resolve({ success: true });
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(onError).not.toHaveBeenCalled();
      expect(result.current.isError).toBe(false);
    });
  });

  describe("callbacks", () => {
    it("calls onSuccess with data and variables", async () => {
      const deferred = createDeferred<{ success: boolean }>();
      const mutationFn = vi.fn().mockReturnValue(deferred.promise);
      const onSuccess = vi.fn();

      const { result } = renderHook(
        () =>
          useLatestMutation({
            mutationKey: ["test"],
            mutationFn,
            onSuccess,
          }),
        { wrapper: createWrapper() }
      );

      act(() => {
        result.current.mutate({ id: 1 });
      });

      await act(async () => {
        deferred.resolve({ success: true });
      });

      expect(onSuccess).toHaveBeenCalledWith({ success: true }, { id: 1 });
    });

    it("calls onSettled after success", async () => {
      const deferred = createDeferred<{ success: boolean }>();
      const mutationFn = vi.fn().mockReturnValue(deferred.promise);
      const onSettled = vi.fn();

      const { result } = renderHook(
        () =>
          useLatestMutation({
            mutationKey: ["test"],
            mutationFn,
            onSettled,
          }),
        { wrapper: createWrapper() }
      );

      act(() => {
        result.current.mutate({ id: 1 });
      });

      await act(async () => {
        deferred.resolve({ success: true });
      });

      expect(onSettled).toHaveBeenCalledWith({ success: true }, null, { id: 1 });
    });

    it("calls onSettled after error", async () => {
      const error = new Error("Failed");
      const deferred = createDeferred<never>();
      const mutationFn = vi.fn().mockReturnValue(deferred.promise);
      const onSettled = vi.fn();

      const { result } = renderHook(
        () =>
          useLatestMutation({
            mutationKey: ["test"],
            mutationFn,
            onSettled,
          }),
        { wrapper: createWrapper() }
      );

      act(() => {
        result.current.mutate({ id: 1 });
      });

      await act(async () => {
        deferred.reject(error);
      });

      expect(onSettled).toHaveBeenCalledWith(undefined, error, { id: 1 });
    });
  });

  describe("invalidateKeys", () => {
    it("invalidates queries on success", async () => {
      const queryClient = new QueryClient();
      const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
      const deferred = createDeferred<{ success: boolean }>();
      const mutationFn = vi.fn().mockReturnValue(deferred.promise);

      const wrapper = ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      );

      const { result } = renderHook(
        () =>
          useLatestMutation({
            mutationKey: ["test"],
            mutationFn,
            invalidateKeys: [["users"], ["posts"]],
          }),
        { wrapper }
      );

      act(() => {
        result.current.mutate({ id: 1 });
      });

      await act(async () => {
        deferred.resolve({ success: true });
      });

      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["users"] });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["posts"] });
    });
  });

  describe("cancelLatestMutation utility", () => {
    it("cancels mutation by key from outside the hook", async () => {
      let signal: AbortSignal | undefined;
      const deferred = createDeferred<{ success: boolean }>();
      const mutationFn = vi.fn().mockImplementation((_vars, sig: AbortSignal) => {
        signal = sig;
        return deferred.promise;
      });

      const { result } = renderHook(
        () =>
          useLatestMutation({
            mutationKey: ["cancelable", "test"],
            mutationFn,
          }),
        { wrapper: createWrapper() }
      );

      await act(async () => {
        result.current.mutate({ id: 1 });
        await flushPromises();
      });

      expect(result.current.isPending).toBe(true);
      expect(signal!.aborted).toBe(false);

      act(() => {
        cancelLatestMutation(["cancelable", "test"]);
      });

      expect(signal!.aborted).toBe(true);
    });
  });

  describe("mutateAsync", () => {
    it("returns a promise that resolves with data", async () => {
      const deferred = createDeferred<{ success: boolean }>();
      const mutationFn = vi.fn().mockReturnValue(deferred.promise);

      const { result } = renderHook(
        () =>
          useLatestMutation({
            mutationKey: ["test"],
            mutationFn,
          }),
        { wrapper: createWrapper() }
      );

      let resolvedData: unknown;
      let promiseSettled = false;

      act(() => {
        result.current.mutateAsync({ id: 1 }).then((data) => {
          resolvedData = data;
          promiseSettled = true;
        });
      });

      await act(async () => {
        deferred.resolve({ success: true });
      });

      expect(promiseSettled).toBe(true);
      expect(resolvedData).toEqual({ success: true });
    });

    it("returns a promise that rejects on error", async () => {
      const error = new Error("Failed");
      const deferred = createDeferred<never>();
      const mutationFn = vi.fn().mockReturnValue(deferred.promise);

      const { result } = renderHook(
        () =>
          useLatestMutation({
            mutationKey: ["test"],
            mutationFn,
          }),
        { wrapper: createWrapper() }
      );

      let rejectedError: unknown;
      let promiseSettled = false;

      act(() => {
        result.current.mutateAsync({ id: 1 }).catch((err) => {
          rejectedError = err;
          promiseSettled = true;
        });
      });

      await act(async () => {
        deferred.reject(error);
      });

      expect(promiseSettled).toBe(true);
      expect(rejectedError).toBe(error);
    });
  });
});
