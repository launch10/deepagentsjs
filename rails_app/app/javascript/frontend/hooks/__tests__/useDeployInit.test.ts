import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

// ── Mocks ──────────────────────────────────────────────────────────────

const mockUpdateState = vi.fn();
const mockStartDeploy = vi.fn();
const mockTouch = vi.fn().mockResolvedValue(undefined);
const mockSet = vi.fn();

// Track what the deploy prop is for each test
let mockDeployProp: { id?: number; status?: string } | undefined = {
  id: 1,
  status: "running",
};

vi.mock("@inertiajs/react", () => ({
  usePage: () => ({
    props: {
      deploy: mockDeployProp,
      website: { id: 1 },
      campaign: { id: 1 },
      project: { id: 1 },
    },
  }),
}));

vi.mock("@hooks/useDeployChat", () => ({
  useDeployChat: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({
      actions: { updateState: mockUpdateState },
      state: { status: "running", deployId: 1 },
      status: "idle",
      historyFailed: false,
    }),
  useDeployContext: () => ({ projectId: 1, websiteId: 1, instructions: { website: true } }),
  useDeployStartDeploy: () => mockStartDeploy,
}));

vi.mock("@api/deploys.hooks", () => ({
  useDeployService: () => ({ touch: mockTouch }),
}));

vi.mock("~/stores/projectStore", () => ({
  useProjectStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({ set: mockSet }),
}));

vi.mock("@hooks/useDeployInstructions", () => ({
  useDeployInstructions: () => ({ website: true }),
}));

vi.mock("@lib/logger", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe("useDeployInit — polling failures", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockUpdateState.mockReset();
    mockDeployProp = { id: 1, status: "running" };
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("sets pollingFailed after 5 consecutive updateState errors", async () => {
    mockUpdateState.mockRejectedValue(new Error("network error"));

    const { useDeployInit } = await import("../useDeployInit");
    const { result } = renderHook(() => useDeployInit());

    // Advance through 5 poll intervals (5 × 3000ms)
    for (let i = 0; i < 5; i++) {
      await act(async () => {
        vi.advanceTimersByTime(3000);
      });
    }

    expect(result.current).toBe(true);
    expect(mockUpdateState).toHaveBeenCalledTimes(
      // 1 initial call from resume + 5 from polling
      6
    );
  });

  it("does not set pollingFailed for fewer than 5 failures", async () => {
    let callCount = 0;
    mockUpdateState.mockImplementation(() => {
      callCount++;
      // Fail for first 4 polling calls (callCount > 1 because first is the resume call)
      if (callCount > 1 && callCount <= 5) {
        return Promise.reject(new Error("network error"));
      }
      return Promise.resolve();
    });

    const { useDeployInit } = await import("../useDeployInit");
    const { result } = renderHook(() => useDeployInit());

    // Advance through 4 poll intervals
    for (let i = 0; i < 4; i++) {
      await act(async () => {
        vi.advanceTimersByTime(3000);
      });
    }

    // Then succeed
    await act(async () => {
      vi.advanceTimersByTime(3000);
    });

    expect(result.current).toBe(false);
  });

  it("resets pollingFailed when updateState succeeds after failures", async () => {
    let callCount = 0;
    mockUpdateState.mockImplementation(() => {
      callCount++;
      // Fail for first 5 polling calls, then succeed
      if (callCount > 1 && callCount <= 6) {
        return Promise.reject(new Error("network error"));
      }
      return Promise.resolve();
    });

    const { useDeployInit } = await import("../useDeployInit");
    const { result } = renderHook(() => useDeployInit());

    // Advance through 5 poll intervals to trigger pollingFailed
    for (let i = 0; i < 5; i++) {
      await act(async () => {
        vi.advanceTimersByTime(3000);
      });
    }

    expect(result.current).toBe(true);

    // One more interval where updateState succeeds
    await act(async () => {
      vi.advanceTimersByTime(3000);
    });

    expect(result.current).toBe(false);
  });

  it("does not set pollingFailed for a single transient failure", async () => {
    let callCount = 0;
    mockUpdateState.mockImplementation(() => {
      callCount++;
      // Fail once on the first polling call, then succeed
      if (callCount === 2) {
        return Promise.reject(new Error("transient error"));
      }
      return Promise.resolve();
    });

    const { useDeployInit } = await import("../useDeployInit");
    const { result } = renderHook(() => useDeployInit());

    // First poll fails
    await act(async () => {
      vi.advanceTimersByTime(3000);
    });

    // Second poll succeeds
    await act(async () => {
      vi.advanceTimersByTime(3000);
    });

    expect(result.current).toBe(false);
  });
});
