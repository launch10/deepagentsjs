import { describe, it, expect, beforeEach, vi } from "vitest";
import { useCreditStore, formatCredits } from "../creditStore";

describe("creditStore", () => {
  beforeEach(() => {
    // Reset the store before each test
    useCreditStore.getState().reset();
    // Reset mock timers
    vi.restoreAllMocks();
  });

  describe("initial state", () => {
    it("starts with null balance and not exhausted", () => {
      const state = useCreditStore.getState();

      expect(state.balanceMillicredits).toBeNull();
      expect(state.planMillicredits).toBeNull();
      expect(state.packMillicredits).toBeNull();
      expect(state.isExhausted).toBe(false);
      expect(state.showExhaustionModal).toBe(false);
      expect(state.modalDismissedAt).toBeNull();
    });
  });

  describe("updateFromCreditStatus", () => {
    it("updates balance and sets isExhausted when estimatedCreditsRemaining is 0", () => {
      useCreditStore.getState().updateFromCreditStatus({
        estimatedCreditsRemaining: 0,
        justExhausted: false,
      });

      const state = useCreditStore.getState();
      expect(state.balanceMillicredits).toBe(0);
      expect(state.isExhausted).toBe(true);
    });

    it("updates balance and keeps isExhausted false when credits remain", () => {
      useCreditStore.getState().updateFromCreditStatus({
        estimatedCreditsRemaining: 5000,
        justExhausted: false,
      });

      const state = useCreditStore.getState();
      expect(state.balanceMillicredits).toBe(5000);
      expect(state.isExhausted).toBe(false);
    });

    it("shows modal when justExhausted is true", () => {
      useCreditStore.getState().updateFromCreditStatus({
        estimatedCreditsRemaining: 0,
        justExhausted: true,
      });

      const state = useCreditStore.getState();
      expect(state.showExhaustionModal).toBe(true);
    });

    it("does not show modal when justExhausted is false", () => {
      useCreditStore.getState().updateFromCreditStatus({
        estimatedCreditsRemaining: 0,
        justExhausted: false,
      });

      const state = useCreditStore.getState();
      expect(state.showExhaustionModal).toBe(false);
    });

    it("respects dismiss timeout when showing modal", () => {
      // First, dismiss the modal
      useCreditStore.getState().dismissModal();

      // Try to show modal - should not show because it was just dismissed
      useCreditStore.getState().updateFromCreditStatus({
        estimatedCreditsRemaining: 0,
        justExhausted: true,
      });

      const state = useCreditStore.getState();
      expect(state.showExhaustionModal).toBe(false);
    });

    it("shows modal after dismiss timeout expires", () => {
      // Dismiss the modal
      useCreditStore.getState().dismissModal();

      // Manually set modalDismissedAt to 2 hours ago
      useCreditStore.setState({
        modalDismissedAt: Date.now() - 2 * 60 * 60 * 1000,
      });

      // Now justExhausted should show the modal
      useCreditStore.getState().updateFromCreditStatus({
        estimatedCreditsRemaining: 0,
        justExhausted: true,
      });

      const state = useCreditStore.getState();
      expect(state.showExhaustionModal).toBe(true);
    });
  });

  describe("updateFromBalanceCheck", () => {
    it("updates all balance fields", () => {
      useCreditStore.getState().updateFromBalanceCheck({
        balanceMillicredits: 5000,
        planMillicredits: 4000,
        packMillicredits: 1000,
        isExhausted: false,
      });

      const state = useCreditStore.getState();
      expect(state.balanceMillicredits).toBe(5000);
      expect(state.planMillicredits).toBe(4000);
      expect(state.packMillicredits).toBe(1000);
      expect(state.isExhausted).toBe(false);
    });

    it("sets isExhausted correctly", () => {
      useCreditStore.getState().updateFromBalanceCheck({
        balanceMillicredits: 0,
        planMillicredits: 0,
        packMillicredits: 0,
        isExhausted: true,
      });

      const state = useCreditStore.getState();
      expect(state.isExhausted).toBe(true);
    });
  });

  describe("dismissModal", () => {
    it("hides the modal and records dismiss time", () => {
      // First show the modal
      useCreditStore.setState({ showExhaustionModal: true });

      // Dismiss it
      const beforeDismiss = Date.now();
      useCreditStore.getState().dismissModal();
      const afterDismiss = Date.now();

      const state = useCreditStore.getState();
      expect(state.showExhaustionModal).toBe(false);
      expect(state.modalDismissedAt).toBeGreaterThanOrEqual(beforeDismiss);
      expect(state.modalDismissedAt).toBeLessThanOrEqual(afterDismiss);
    });
  });

  describe("showModal", () => {
    it("shows the modal when not recently dismissed", () => {
      useCreditStore.getState().showModal();

      const state = useCreditStore.getState();
      expect(state.showExhaustionModal).toBe(true);
    });

    it("does not show modal when recently dismissed", () => {
      // Dismiss the modal first
      useCreditStore.getState().dismissModal();

      // Try to show again
      useCreditStore.getState().showModal();

      const state = useCreditStore.getState();
      expect(state.showExhaustionModal).toBe(false);
    });

    it("shows modal after dismiss timeout expires", () => {
      // Dismiss and set time to 2 hours ago
      useCreditStore.getState().dismissModal();
      useCreditStore.setState({
        modalDismissedAt: Date.now() - 2 * 60 * 60 * 1000,
      });

      useCreditStore.getState().showModal();

      const state = useCreditStore.getState();
      expect(state.showExhaustionModal).toBe(true);
    });
  });

  describe("reset", () => {
    it("resets all state to initial values", () => {
      // Set some state
      useCreditStore.setState({
        balanceMillicredits: 5000,
        planMillicredits: 4000,
        packMillicredits: 1000,
        isExhausted: true,
        showExhaustionModal: true,
        modalDismissedAt: Date.now(),
      });

      // Reset
      useCreditStore.getState().reset();

      const state = useCreditStore.getState();
      expect(state.balanceMillicredits).toBeNull();
      expect(state.planMillicredits).toBeNull();
      expect(state.packMillicredits).toBeNull();
      expect(state.isExhausted).toBe(false);
      expect(state.showExhaustionModal).toBe(false);
      expect(state.modalDismissedAt).toBeNull();
    });
  });
});

describe("formatCredits", () => {
  it("returns dash for null", () => {
    expect(formatCredits(null)).toBe("—");
  });

  it("formats whole credits", () => {
    expect(formatCredits(1000)).toBe("1");
    expect(formatCredits(5000)).toBe("5");
  });

  it("formats fractional credits with one decimal", () => {
    expect(formatCredits(500)).toBe("0.5");
    expect(formatCredits(1500)).toBe("1.5");
  });

  it("formats large credits with k suffix", () => {
    expect(formatCredits(1000000)).toBe("1.0k");
    expect(formatCredits(5500000)).toBe("5.5k");
  });

  it("handles zero", () => {
    expect(formatCredits(0)).toBe("0");
  });

  it("handles negative values", () => {
    expect(formatCredits(-1000)).toBe("-1");
  });
});
