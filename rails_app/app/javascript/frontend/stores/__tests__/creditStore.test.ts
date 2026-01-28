import { describe, it, expect, beforeEach, vi } from "vitest";
import { useCreditStore, formatCredits } from "../creditStore";

describe("creditStore", () => {
  beforeEach(() => {
    // Reset the store before each test
    useCreditStore.getState().reset();
    // Clear persisted data so tests don't leak
    localStorage.removeItem("credit-store");
    // Reset mock timers
    vi.restoreAllMocks();
  });

  describe("initial state", () => {
    it("starts with null balance and out of credits (disabled until hydration)", () => {
      const state = useCreditStore.getState();

      expect(state.balance).toBeNull();
      expect(state.planCredits).toBeNull();
      expect(state.packCredits).toBeNull();
      expect(state.planCreditsAllocated).toBeNull();
      expect(state.isOutOfCredits).toBe(true);
      expect(state.showOutOfCreditsModal).toBe(false);
      expect(state.showLowCreditModal).toBe(false);
      expect(state.modalDismissedAt).toBeNull();
    });
  });

  describe("updateFromCreditStatus", () => {
    it("converts millicredits to credits and sets isOutOfCredits when 0", () => {
      useCreditStore.getState().updateFromCreditStatus({
        estimatedRemainingMillicredits: 0,
        justExhausted: false,
      });

      const state = useCreditStore.getState();
      expect(state.balance).toBe(0);
      expect(state.isOutOfCredits).toBe(true);
    });

    it("converts millicredits to credits correctly", () => {
      useCreditStore.getState().updateFromCreditStatus({
        estimatedRemainingMillicredits: 5000, // 5 credits
        justExhausted: false,
      });

      const state = useCreditStore.getState();
      expect(state.balance).toBe(5);
      expect(state.isOutOfCredits).toBe(false);
    });

    it("rounds to 2 decimal places", () => {
      useCreditStore.getState().updateFromCreditStatus({
        estimatedRemainingMillicredits: 4567, // 4.567 → 4.57
        justExhausted: false,
      });

      const state = useCreditStore.getState();
      expect(state.balance).toBe(4.57);
    });

    it("shows modal when justExhausted is true", () => {
      useCreditStore.getState().updateFromCreditStatus({
        estimatedRemainingMillicredits: 0,
        justExhausted: true,
      });

      const state = useCreditStore.getState();
      expect(state.showOutOfCreditsModal).toBe(true);
    });

    it("does not show modal when justExhausted is false", () => {
      useCreditStore.getState().updateFromCreditStatus({
        estimatedRemainingMillicredits: 0,
        justExhausted: false,
      });

      const state = useCreditStore.getState();
      expect(state.showOutOfCreditsModal).toBe(false);
    });

    it("force-shows modal when justExhausted even if recently dismissed", () => {
      // First, dismiss the modal
      useCreditStore.getState().dismissModal();

      // justExhausted should override the dismiss
      useCreditStore.getState().updateFromCreditStatus({
        estimatedRemainingMillicredits: 0,
        justExhausted: true,
      });

      const state = useCreditStore.getState();
      expect(state.showOutOfCreditsModal).toBe(true);
    });

    it("closes low credit modal when justExhausted fires", () => {
      // Low credit modal is showing
      useCreditStore.setState({ showLowCreditModal: true });

      useCreditStore.getState().updateFromCreditStatus({
        estimatedRemainingMillicredits: 0,
        justExhausted: true,
      });

      const state = useCreditStore.getState();
      expect(state.showOutOfCreditsModal).toBe(true);
      expect(state.showLowCreditModal).toBe(false);
    });
  });

  describe("updateFromBalanceCheck", () => {
    it("converts millicredits to credits", () => {
      useCreditStore.getState().updateFromBalanceCheck({
        balanceMillicredits: 5000,
        planMillicredits: 4000,
        packMillicredits: 1000,
        isExhausted: false,
      });

      const state = useCreditStore.getState();
      expect(state.balance).toBe(5);
      expect(state.planCredits).toBe(4);
      expect(state.packCredits).toBe(1);
      expect(state.isOutOfCredits).toBe(false);
    });

    it("sets isOutOfCredits correctly", () => {
      useCreditStore.getState().updateFromBalanceCheck({
        balanceMillicredits: 0,
        planMillicredits: 0,
        packMillicredits: 0,
        isExhausted: true,
      });

      const state = useCreditStore.getState();
      expect(state.isOutOfCredits).toBe(true);
    });
  });

  describe("hydrateFromPageProps", () => {
    it("uses credits directly (no conversion)", () => {
      useCreditStore.getState().hydrateFromPageProps({
        plan_credits: 4,
        pack_credits: 1,
        total_credits: 5,
        plan_credits_allocated: 10,
      });

      const state = useCreditStore.getState();
      expect(state.balance).toBe(5);
      expect(state.planCredits).toBe(4);
      expect(state.packCredits).toBe(1);
      expect(state.planCreditsAllocated).toBe(10);
      expect(state.isOutOfCredits).toBe(false);
    });

    it("sets isOutOfCredits when total is 0", () => {
      useCreditStore.getState().hydrateFromPageProps({
        plan_credits: 0,
        pack_credits: 0,
        total_credits: 0,
        plan_credits_allocated: 10,
      });

      const state = useCreditStore.getState();
      expect(state.isOutOfCredits).toBe(true);
    });

    it("sets isOutOfCredits when total is negative", () => {
      useCreditStore.getState().hydrateFromPageProps({
        plan_credits: -0.5,
        pack_credits: 0,
        total_credits: -0.5,
        plan_credits_allocated: 10,
      });

      const state = useCreditStore.getState();
      expect(state.isOutOfCredits).toBe(true);
    });

    it("does not update when props is null", () => {
      // Set initial state
      useCreditStore.setState({
        balance: 5,
        planCredits: 4,
      });

      useCreditStore.getState().hydrateFromPageProps(null);

      const state = useCreditStore.getState();
      expect(state.balance).toBe(5);
      expect(state.planCredits).toBe(4);
    });

    it("preserves existing state when fields are undefined", () => {
      // Set initial state
      useCreditStore.setState({
        balance: 5,
        planCredits: 4,
        packCredits: 1,
      });

      // Hydrate with partial data
      useCreditStore.getState().hydrateFromPageProps({
        total_credits: 6,
      });

      const state = useCreditStore.getState();
      // total_credits updates balance
      expect(state.balance).toBe(6);
      // But other fields from initial state should be preserved
      expect(state.planCredits).toBe(4);
      expect(state.packCredits).toBe(1);
    });

    it("preserves modal state when hydrating", () => {
      // Set modal state
      useCreditStore.setState({
        showOutOfCreditsModal: true,
        modalDismissedAt: Date.now() - 1000,
      });

      // Hydrate
      useCreditStore.getState().hydrateFromPageProps({
        total_credits: 5,
        plan_credits: 4,
        pack_credits: 1,
        plan_credits_allocated: 10,
      });

      const state = useCreditStore.getState();
      // Modal state should be preserved
      expect(state.showOutOfCreditsModal).toBe(true);
      expect(state.modalDismissedAt).not.toBeNull();
    });
  });

  describe("dismissModal", () => {
    it("hides the modal and records dismiss time", () => {
      // First show the modal
      useCreditStore.setState({ showOutOfCreditsModal: true });

      // Dismiss it
      const beforeDismiss = Date.now();
      useCreditStore.getState().dismissModal();
      const afterDismiss = Date.now();

      const state = useCreditStore.getState();
      expect(state.showOutOfCreditsModal).toBe(false);
      expect(state.modalDismissedAt).toBeGreaterThanOrEqual(beforeDismiss);
      expect(state.modalDismissedAt).toBeLessThanOrEqual(afterDismiss);
    });
  });

  describe("showModal", () => {
    it("shows the modal when not recently dismissed", () => {
      useCreditStore.getState().showModal();

      const state = useCreditStore.getState();
      expect(state.showOutOfCreditsModal).toBe(true);
    });

    it("does not show modal when recently dismissed", () => {
      // Dismiss the modal first
      useCreditStore.getState().dismissModal();

      // Try to show again
      useCreditStore.getState().showModal();

      const state = useCreditStore.getState();
      expect(state.showOutOfCreditsModal).toBe(false);
    });

    it("shows modal after dismiss timeout expires", () => {
      // Dismiss and set time to 2 hours ago
      useCreditStore.getState().dismissModal();
      useCreditStore.setState({
        modalDismissedAt: Date.now() - 2 * 60 * 60 * 1000,
      });

      useCreditStore.getState().showModal();

      const state = useCreditStore.getState();
      expect(state.showOutOfCreditsModal).toBe(true);
    });
  });

  describe("reset", () => {
    it("resets all state to initial values", () => {
      // Set some state
      useCreditStore.setState({
        balance: 5,
        planCredits: 4,
        packCredits: 1,
        planCreditsAllocated: 10,
        isOutOfCredits: true,
        showOutOfCreditsModal: true,
        modalDismissedAt: Date.now(),
        lowCreditWarningDismissedAt: Date.now(),
      });

      // Reset
      useCreditStore.getState().reset();

      const state = useCreditStore.getState();
      expect(state.balance).toBeNull();
      expect(state.planCredits).toBeNull();
      expect(state.packCredits).toBeNull();
      expect(state.planCreditsAllocated).toBeNull();
      expect(state.isOutOfCredits).toBe(true);
      expect(state.showOutOfCreditsModal).toBe(false);
      expect(state.showLowCreditModal).toBe(false);
      expect(state.modalDismissedAt).toBeNull();
      expect(state.lowCreditWarningDismissedAt).toBeNull();
    });
  });

  describe("dismissLowCreditWarning", () => {
    it("hides modal and records dismiss time", () => {
      useCreditStore.setState({ showLowCreditModal: true });

      const beforeDismiss = Date.now();
      useCreditStore.getState().dismissLowCreditWarning();
      const afterDismiss = Date.now();

      const state = useCreditStore.getState();
      expect(state.showLowCreditModal).toBe(false);
      expect(state.lowCreditWarningDismissedAt).toBeGreaterThanOrEqual(beforeDismiss);
      expect(state.lowCreditWarningDismissedAt).toBeLessThanOrEqual(afterDismiss);
    });
  });

  describe("showLowCreditModal via hydrateFromPageProps", () => {
    it("triggers when usage >= 80% and not dismissed", () => {
      useCreditStore.getState().hydrateFromPageProps({
        plan_credits: 15,
        pack_credits: 0,
        total_credits: 15,
        plan_credits_allocated: 100,
      });

      expect(useCreditStore.getState().showLowCreditModal).toBe(true);
    });

    it("does not trigger when usage < 80%", () => {
      useCreditStore.getState().hydrateFromPageProps({
        plan_credits: 50,
        pack_credits: 0,
        total_credits: 50,
        plan_credits_allocated: 100,
      });

      expect(useCreditStore.getState().showLowCreditModal).toBe(false);
    });

    it("triggers at exactly 80% usage", () => {
      useCreditStore.getState().hydrateFromPageProps({
        plan_credits: 20,
        pack_credits: 0,
        total_credits: 20,
        plan_credits_allocated: 100,
      });

      expect(useCreditStore.getState().showLowCreditModal).toBe(true);
    });

    it("does not trigger when out of credits", () => {
      useCreditStore.getState().hydrateFromPageProps({
        plan_credits: 0,
        pack_credits: 0,
        total_credits: 0,
        plan_credits_allocated: 100,
      });

      expect(useCreditStore.getState().showLowCreditModal).toBe(false);
    });

    it("does not trigger when recently dismissed (within 24 hours)", () => {
      const twelveHoursAgo = Date.now() - 12 * 60 * 60 * 1000;
      useCreditStore.setState({ lowCreditWarningDismissedAt: twelveHoursAgo });

      useCreditStore.getState().hydrateFromPageProps({
        plan_credits: 10,
        pack_credits: 0,
        total_credits: 10,
        plan_credits_allocated: 100,
      });

      expect(useCreditStore.getState().showLowCreditModal).toBe(false);
    });

    it("triggers after dismiss timeout expires (25 hours)", () => {
      const twentyFiveHoursAgo = Date.now() - 25 * 60 * 60 * 1000;
      useCreditStore.setState({ lowCreditWarningDismissedAt: twentyFiveHoursAgo });

      useCreditStore.getState().hydrateFromPageProps({
        plan_credits: 10,
        pack_credits: 0,
        total_credits: 10,
        plan_credits_allocated: 100,
      });

      expect(useCreditStore.getState().showLowCreditModal).toBe(true);
    });

    it("does not re-trigger when already showing", () => {
      useCreditStore.setState({ showLowCreditModal: true });

      useCreditStore.getState().hydrateFromPageProps({
        plan_credits: 10,
        pack_credits: 0,
        total_credits: 10,
        plan_credits_allocated: 100,
      });

      // Still true, not toggled
      expect(useCreditStore.getState().showLowCreditModal).toBe(true);
    });
  });

  describe("persist middleware", () => {
    it("persists dismiss timestamps to localStorage", () => {
      useCreditStore.getState().dismissModal();
      useCreditStore.getState().dismissLowCreditWarning();

      const raw = localStorage.getItem("credit-store");
      expect(raw).not.toBeNull();

      const parsed = JSON.parse(raw!);
      expect(parsed.state.modalDismissedAt).toEqual(useCreditStore.getState().modalDismissedAt);
      expect(parsed.state.lowCreditWarningDismissedAt).toEqual(
        useCreditStore.getState().lowCreditWarningDismissedAt
      );
    });

    it("does not persist balance or credit data to localStorage", () => {
      useCreditStore.setState({
        balance: 5,
        planCredits: 4,
        packCredits: 1,
        planCreditsAllocated: 10,
        isOutOfCredits: false,
        showOutOfCreditsModal: true,
        modalDismissedAt: 1234567890,
        lowCreditWarningDismissedAt: 9876543210,
      });

      const raw = localStorage.getItem("credit-store");
      const parsed = JSON.parse(raw!);

      expect(parsed.state).toEqual({
        modalDismissedAt: 1234567890,
        lowCreditWarningDismissedAt: 9876543210,
      });
      expect(parsed.state).not.toHaveProperty("balance");
      expect(parsed.state).not.toHaveProperty("planCredits");
      expect(parsed.state).not.toHaveProperty("isOutOfCredits");
    });

    it("restores dismiss timestamps after rehydration (simulated page reload)", async () => {
      // Dismiss both modal and warning
      useCreditStore.getState().dismissModal();
      useCreditStore.getState().dismissLowCreditWarning();

      const savedModalDismissedAt = useCreditStore.getState().modalDismissedAt;
      const savedWarningDismissedAt = useCreditStore.getState().lowCreditWarningDismissedAt;

      // Capture what persist wrote to localStorage
      const persisted = localStorage.getItem("credit-store");

      // Simulate page reload: reset wipes in-memory state (and writes nulls to storage)
      useCreditStore.getState().reset();

      // Restore the pre-reset localStorage (this is what the browser keeps across reloads)
      localStorage.setItem("credit-store", persisted!);

      // Rehydrate from localStorage, just like zustand does on page load
      await useCreditStore.persist.rehydrate();

      const state = useCreditStore.getState();
      expect(state.modalDismissedAt).toBe(savedModalDismissedAt);
      expect(state.lowCreditWarningDismissedAt).toBe(savedWarningDismissedAt);
      // Balance should NOT be restored from localStorage
      expect(state.balance).toBeNull();
    });
  });
});

describe("formatCredits", () => {
  it("returns dash for null", () => {
    expect(formatCredits(null)).toBe("—");
  });

  it("formats whole credits", () => {
    expect(formatCredits(1)).toBe("1");
    expect(formatCredits(5)).toBe("5");
  });

  it("formats fractional credits with one decimal", () => {
    expect(formatCredits(0.5)).toBe("0.5");
    expect(formatCredits(1.5)).toBe("1.5");
  });

  it("formats large credits with k suffix", () => {
    expect(formatCredits(1000)).toBe("1.0k");
    expect(formatCredits(5500)).toBe("5.5k");
  });

  it("handles zero", () => {
    expect(formatCredits(0)).toBe("0");
  });

  it("handles negative values", () => {
    expect(formatCredits(-1)).toBe("-1");
  });

  it("shows no decimals for values >= 10", () => {
    expect(formatCredits(10.5)).toBe("11"); // rounds
    expect(formatCredits(99.9)).toBe("100");
  });
});
