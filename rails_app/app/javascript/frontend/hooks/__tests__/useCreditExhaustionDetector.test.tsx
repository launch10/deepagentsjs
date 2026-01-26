import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useCreditExhaustionDetector } from "../useCreditExhaustionDetector";
import { useCreditStore } from "~/stores/creditStore";

describe("useCreditExhaustionDetector", () => {
  beforeEach(() => {
    // Reset the store before each test
    useCreditStore.getState().reset();
    vi.restoreAllMocks();
  });

  it("does nothing when error is undefined", () => {
    renderHook(() => useCreditExhaustionDetector(undefined));

    const state = useCreditStore.getState();
    expect(state.isExhausted).toBe(false);
    expect(state.showExhaustionModal).toBe(false);
  });

  it("does nothing when error is null", () => {
    renderHook(() => useCreditExhaustionDetector(null));

    const state = useCreditStore.getState();
    expect(state.isExhausted).toBe(false);
    expect(state.showExhaustionModal).toBe(false);
  });

  it("does nothing for non-credit errors", () => {
    const error = new Error("Network error");
    renderHook(() => useCreditExhaustionDetector(error));

    const state = useCreditStore.getState();
    expect(state.isExhausted).toBe(false);
    expect(state.showExhaustionModal).toBe(false);
  });

  it("detects credit exhaustion error by CREDITS_EXHAUSTED code", () => {
    const errorBody = JSON.stringify({
      error: "Insufficient credits",
      code: "CREDITS_EXHAUSTED",
      balance: 0,
      planCredits: 0,
      packCredits: 0,
    });
    const error = new Error(errorBody);

    renderHook(() => useCreditExhaustionDetector(error));

    const state = useCreditStore.getState();
    expect(state.isExhausted).toBe(true);
    expect(state.balanceMillicredits).toBe(0);
    expect(state.planMillicredits).toBe(0);
    expect(state.packMillicredits).toBe(0);
  });

  it("shows modal when credit exhaustion detected", () => {
    const errorBody = JSON.stringify({
      error: "Insufficient credits",
      code: "CREDITS_EXHAUSTED",
      balance: 0,
      planCredits: 0,
      packCredits: 0,
    });
    const error = new Error(errorBody);

    renderHook(() => useCreditExhaustionDetector(error));

    const state = useCreditStore.getState();
    expect(state.showExhaustionModal).toBe(true);
  });

  it("extracts balance information from error", () => {
    const errorBody = JSON.stringify({
      error: "Insufficient credits",
      code: "CREDITS_EXHAUSTED",
      balance: -500,
      planCredits: -500,
      packCredits: 0,
    });
    const error = new Error(errorBody);

    renderHook(() => useCreditExhaustionDetector(error));

    const state = useCreditStore.getState();
    expect(state.balanceMillicredits).toBe(-500);
    expect(state.planMillicredits).toBe(-500);
    expect(state.packMillicredits).toBe(0);
  });

  it("handles malformed JSON gracefully", () => {
    const error = new Error("CREDITS_EXHAUSTED - something went wrong");

    renderHook(() => useCreditExhaustionDetector(error));

    const state = useCreditStore.getState();
    // Should still mark as exhausted even without parseable balance
    expect(state.isExhausted).toBe(true);
    expect(state.balanceMillicredits).toBe(0);
    expect(state.showExhaustionModal).toBe(true);
  });

  it("detects credit exhaustion by 'Insufficient credits' message", () => {
    const error = new Error("Insufficient credits");

    renderHook(() => useCreditExhaustionDetector(error));

    const state = useCreditStore.getState();
    expect(state.isExhausted).toBe(true);
    expect(state.showExhaustionModal).toBe(true);
  });

  it("responds to error changes", () => {
    const { rerender } = renderHook(
      ({ error }) => useCreditExhaustionDetector(error),
      { initialProps: { error: undefined as Error | undefined } }
    );

    // Initially no error
    expect(useCreditStore.getState().isExhausted).toBe(false);

    // Simulate credit exhaustion error
    const errorBody = JSON.stringify({
      error: "Insufficient credits",
      code: "CREDITS_EXHAUSTED",
      balance: 0,
      planCredits: 0,
      packCredits: 0,
    });
    rerender({ error: new Error(errorBody) });

    expect(useCreditStore.getState().isExhausted).toBe(true);
    expect(useCreditStore.getState().showExhaustionModal).toBe(true);
  });
});
