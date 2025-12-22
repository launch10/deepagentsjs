import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import type { ReactNode } from "react";
import { useCampaignAutosave } from "../useCampaignAutosave";

vi.mock("../useAdsChat", () => ({
  useAdsChatState: vi.fn(() => "campaign-123"),
}));

const mockUpdate = vi.fn();
vi.mock("@api/campaigns.hooks", () => ({
  useCampaignService: () => ({
    update: mockUpdate,
  }),
}));

type TestFormData = {
  name: string;
  budget: number;
};

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

const transformTestForm = (data: TestFormData) => ({
  name: data.name,
  daily_budget_cents: data.budget * 100,
});

describe("useCampaignAutosave", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockUpdate.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("debounced autosave", () => {
    it("debounces rapid changes and saves fresh data when debounce fires", async () => {
      const deferred = createDeferred<{ success: boolean }>();
      mockUpdate.mockReturnValue(deferred.promise);

      const { result } = renderHook(
        () => {
          const methods = useForm<TestFormData>({
            defaultValues: { name: "", budget: 0 },
          });
          const autosave = useCampaignAutosave({
            methods,
            transformFn: transformTestForm,
            debounceMs: 500,
          });
          return { methods, autosave };
        },
        { wrapper: createWrapper() }
      );

      await act(async () => {
        result.current.methods.setValue("name", "First");
      });

      await act(async () => {
        result.current.methods.setValue("name", "Second");
      });

      await act(async () => {
        result.current.methods.setValue("name", "Third");
      });

      await act(async () => {
        result.current.methods.setValue("name", "Fourth");
      });

      expect(mockUpdate).not.toHaveBeenCalled();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(500);
      });

      expect(mockUpdate).toHaveBeenCalledTimes(1);
      expect(mockUpdate).toHaveBeenCalledWith(
        "campaign-123",
        { name: "Fourth", daily_budget_cents: 0 },
        expect.any(AbortSignal)
      );

      await act(async () => {
        deferred.resolve({ success: true });
      });
    });

    it("skips save if values haven't changed (deduplication)", async () => {
      const deferred = createDeferred<{ success: boolean }>();
      mockUpdate.mockReturnValue(deferred.promise);

      const { result } = renderHook(
        () => {
          const methods = useForm<TestFormData>({
            defaultValues: { name: "Initial", budget: 100 },
          });
          const autosave = useCampaignAutosave({
            methods,
            transformFn: transformTestForm,
            debounceMs: 500,
          });
          return { methods, autosave };
        },
        { wrapper: createWrapper() }
      );

      await act(async () => {
        result.current.methods.setValue("name", "First change");
      });

      await act(async () => {
        result.current.methods.setValue("name", "Changed");
      });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(500);
      });

      expect(mockUpdate).toHaveBeenCalledTimes(1);

      await act(async () => {
        deferred.resolve({ success: true });
      });

      await act(async () => {
        result.current.methods.setValue("name", "Trigger watch");
      });

      await act(async () => {
        result.current.methods.setValue("name", "Changed");
      });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(500);
      });

      expect(mockUpdate).toHaveBeenCalledTimes(1);
    });

    it("skips initial mount", async () => {
      mockUpdate.mockResolvedValue({ success: true });

      renderHook(
        () => {
          const methods = useForm<TestFormData>({
            defaultValues: { name: "Initial", budget: 100 },
          });
          return useCampaignAutosave({
            methods,
            transformFn: transformTestForm,
            debounceMs: 500,
          });
        },
        { wrapper: createWrapper() }
      );

      await act(async () => {
        await vi.advanceTimersByTimeAsync(1000);
      });

      expect(mockUpdate).not.toHaveBeenCalled();
    });
  });

  describe("saveNow", () => {
    it("saves immediately, bypassing debounce", async () => {
      const deferred = createDeferred<{ success: boolean }>();
      mockUpdate.mockReturnValue(deferred.promise);

      const { result } = renderHook(
        () => {
          const methods = useForm<TestFormData>({
            defaultValues: { name: "Test", budget: 50 },
          });
          const autosave = useCampaignAutosave({
            methods,
            transformFn: transformTestForm,
            debounceMs: 500,
          });
          return { methods, autosave };
        },
        { wrapper: createWrapper() }
      );

      await act(async () => {
        result.current.methods.setValue("name", "Immediate Save");
      });

      let savePromise: Promise<void>;
      await act(async () => {
        savePromise = result.current.autosave.saveNow();
      });

      expect(mockUpdate).toHaveBeenCalledTimes(1);
      expect(mockUpdate).toHaveBeenCalledWith(
        "campaign-123",
        { name: "Immediate Save", daily_budget_cents: 5000 },
        expect.any(AbortSignal)
      );

      await act(async () => {
        deferred.resolve({ success: true });
        await savePromise!;
      });
    });

    it("cancels pending debounced save when saveNow is called", async () => {
      const deferred = createDeferred<{ success: boolean }>();
      mockUpdate.mockReturnValue(deferred.promise);

      const { result } = renderHook(
        () => {
          const methods = useForm<TestFormData>({
            defaultValues: { name: "", budget: 0 },
          });
          const autosave = useCampaignAutosave({
            methods,
            transformFn: transformTestForm,
            debounceMs: 500,
          });
          return { methods, autosave };
        },
        { wrapper: createWrapper() }
      );

      await act(async () => {
        result.current.methods.setValue("name", "Skip mount");
      });

      await act(async () => {
        result.current.methods.setValue("name", "Debounced");
      });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(200);
      });

      expect(mockUpdate).not.toHaveBeenCalled();

      await act(async () => {
        result.current.methods.setValue("name", "Immediate");
      });

      let savePromise: Promise<void>;
      await act(async () => {
        savePromise = result.current.autosave.saveNow();
      });

      expect(mockUpdate).toHaveBeenCalledTimes(1);
      expect(mockUpdate).toHaveBeenCalledWith(
        "campaign-123",
        { name: "Immediate", daily_budget_cents: 0 },
        expect.any(AbortSignal)
      );

      await act(async () => {
        await vi.advanceTimersByTimeAsync(500);
      });

      expect(mockUpdate).toHaveBeenCalledTimes(1);

      await act(async () => {
        deferred.resolve({ success: true });
        await savePromise!;
      });
    });

    it("skips saveNow if values unchanged from last save", async () => {
      const deferred1 = createDeferred<{ success: boolean }>();
      const deferred2 = createDeferred<{ success: boolean }>();
      mockUpdate.mockReturnValueOnce(deferred1.promise).mockReturnValueOnce(deferred2.promise);

      const { result } = renderHook(
        () => {
          const methods = useForm<TestFormData>({
            defaultValues: { name: "Test", budget: 100 },
          });
          const autosave = useCampaignAutosave({
            methods,
            transformFn: transformTestForm,
            debounceMs: 500,
          });
          return { methods, autosave };
        },
        { wrapper: createWrapper() }
      );

      await act(async () => {
        result.current.methods.setValue("name", "Saved");
      });

      let savePromise: Promise<void>;
      await act(async () => {
        savePromise = result.current.autosave.saveNow();
      });

      await act(async () => {
        deferred1.resolve({ success: true });
        await savePromise!;
      });

      expect(mockUpdate).toHaveBeenCalledTimes(1);

      await act(async () => {
        savePromise = result.current.autosave.saveNow();
        await savePromise;
      });

      expect(mockUpdate).toHaveBeenCalledTimes(1);
    });
  });

  describe("transformFn", () => {
    it("uses transformFn to convert form data to API format", async () => {
      const deferred = createDeferred<{ success: boolean }>();
      mockUpdate.mockReturnValue(deferred.promise);

      const customTransform = (data: TestFormData) => ({
        name: data.name.toUpperCase(),
        daily_budget_cents: data.budget * 100,
      });

      const { result } = renderHook(
        () => {
          const methods = useForm<TestFormData>({
            defaultValues: { name: "test", budget: 42 },
          });
          const autosave = useCampaignAutosave({
            methods,
            transformFn: customTransform,
            debounceMs: 100,
          });
          return { methods, autosave };
        },
        { wrapper: createWrapper() }
      );

      await act(async () => {
        result.current.methods.setValue("name", "skip mount");
      });

      await act(async () => {
        result.current.methods.setValue("name", "hello");
      });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(100);
      });

      expect(mockUpdate).toHaveBeenCalledWith(
        "campaign-123",
        { name: "HELLO", daily_budget_cents: 4200 },
        expect.any(AbortSignal)
      );

      await act(async () => {
        deferred.resolve({ success: true });
      });
    });

    it("skips save if transformFn returns null", async () => {
      mockUpdate.mockResolvedValue({ success: true });

      const nullTransform = (data: TestFormData) => {
        if (!data.name.trim()) return null;
        return { name: data.name };
      };

      const { result } = renderHook(
        () => {
          const methods = useForm<TestFormData>({
            defaultValues: { name: "", budget: 0 },
          });
          const autosave = useCampaignAutosave({
            methods,
            transformFn: nullTransform,
            debounceMs: 100,
          });
          return { methods, autosave };
        },
        { wrapper: createWrapper() }
      );

      await act(async () => {
        result.current.methods.setValue("budget", 50);
      });

      await act(async () => {
        result.current.methods.setValue("budget", 100);
      });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(100);
      });

      expect(mockUpdate).not.toHaveBeenCalled();
    });
  });

  describe("enabled option", () => {
    it("does not save when enabled is false", async () => {
      mockUpdate.mockResolvedValue({ success: true });

      const { result } = renderHook(
        () => {
          const methods = useForm<TestFormData>({
            defaultValues: { name: "Test", budget: 0 },
          });
          const autosave = useCampaignAutosave({
            methods,
            transformFn: transformTestForm,
            debounceMs: 100,
            enabled: false,
          });
          return { methods, autosave };
        },
        { wrapper: createWrapper() }
      );

      await act(async () => {
        result.current.methods.setValue("name", "skip mount");
      });

      await act(async () => {
        result.current.methods.setValue("name", "Changed");
      });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(100);
      });

      expect(mockUpdate).not.toHaveBeenCalled();
    });
  });
});

describe("useCampaignAutosave (real timers)", () => {
  beforeEach(() => {
    mockUpdate.mockReset();
  });

  it("calls onSuccess after successful save", async () => {
    mockUpdate.mockResolvedValue({ ready_for_next_stage: true });
    const onSuccess = vi.fn();

    const { result } = renderHook(
      () => {
        const methods = useForm<TestFormData>({
          defaultValues: { name: "Test", budget: 0 },
        });
        const autosave = useCampaignAutosave({
          methods,
          transformFn: transformTestForm,
          onSuccess,
          debounceMs: 50,
        });
        return { methods, autosave };
      },
      { wrapper: createWrapper() }
    );

    await act(async () => {
      result.current.methods.setValue("name", "skip mount");
    });

    await act(async () => {
      result.current.methods.setValue("name", "Updated");
    });

    await waitFor(
      () => {
        expect(onSuccess).toHaveBeenCalled();
        expect(onSuccess.mock.calls[0][0]).toEqual({ ready_for_next_stage: true });
      },
      { timeout: 1000 }
    );
  });

  it("exposes isAutosaving state", async () => {
    let resolveUpdate: (value: { success: boolean }) => void;
    mockUpdate.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveUpdate = resolve;
        })
    );

    const { result } = renderHook(
      () => {
        const methods = useForm<TestFormData>({
          defaultValues: { name: "Test", budget: 0 },
        });
        const autosave = useCampaignAutosave({
          methods,
          transformFn: transformTestForm,
          debounceMs: 50,
        });
        return { methods, autosave };
      },
      { wrapper: createWrapper() }
    );

    expect(result.current.autosave.isAutosaving).toBe(false);

    await act(async () => {
      result.current.methods.setValue("name", "skip mount");
    });

    await act(async () => {
      result.current.methods.setValue("name", "Saving");
    });

    await waitFor(
      () => {
        expect(result.current.autosave.isAutosaving).toBe(true);
      },
      { timeout: 1000 }
    );

    await act(async () => {
      resolveUpdate!({ success: true });
    });

    await waitFor(() => {
      expect(result.current.autosave.isAutosaving).toBe(false);
    });
  });

  it("exposes autosaveError on failure", async () => {
    const error = new Error("Network error");
    mockUpdate.mockRejectedValue(error);

    const { result } = renderHook(
      () => {
        const methods = useForm<TestFormData>({
          defaultValues: { name: "Test", budget: 0 },
        });
        const autosave = useCampaignAutosave({
          methods,
          transformFn: transformTestForm,
          debounceMs: 50,
        });
        return { methods, autosave };
      },
      { wrapper: createWrapper() }
    );

    await act(async () => {
      result.current.methods.setValue("name", "skip mount");
    });

    await act(async () => {
      result.current.methods.setValue("name", "Will fail");
    });

    await waitFor(
      () => {
        expect(result.current.autosave.autosaveError?.message).toBe("Network error");
      },
      { timeout: 1000 }
    );
  });
});
