import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ExhaustionModal } from "../ExhaustionModal";
import { useCreditStore, formatCredits } from "~/stores/creditStore";

// Mock Inertia's Link component
vi.mock("@inertiajs/react", () => ({
  Link: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

describe("ExhaustionModal", () => {
  const mockDismissModal = vi.fn();

  beforeEach(() => {
    // Reset the store to initial state
    useCreditStore.setState({
      balanceMillicredits: 0,
      planMillicredits: null,
      packMillicredits: null,
      isExhausted: true,
      showExhaustionModal: true,
      modalDismissedAt: null,
    });
    mockDismissModal.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("rendering", () => {
    it("renders when showExhaustionModal is true", () => {
      render(<ExhaustionModal />);

      expect(screen.getByText("You've run out of credits")).toBeInTheDocument();
    });

    it("does not render when showExhaustionModal is false", () => {
      useCreditStore.setState({ showExhaustionModal: false });

      render(<ExhaustionModal />);

      expect(screen.queryByText("You've run out of credits")).not.toBeInTheDocument();
    });

    it("displays formatted balance", () => {
      useCreditStore.setState({ balanceMillicredits: 500 });

      render(<ExhaustionModal />);

      // formatCredits(500) = 0.5 credits
      expect(screen.getByText(/0.5 credits/)).toBeInTheDocument();
    });

    it("displays zero balance correctly", () => {
      useCreditStore.setState({ balanceMillicredits: 0 });

      render(<ExhaustionModal />);

      expect(screen.getByText(/0 credits/)).toBeInTheDocument();
    });
  });

  describe("interactions", () => {
    it("dismisses modal on dismiss button click", () => {
      render(<ExhaustionModal />);

      const dismissButton = screen.getByText("Dismiss for now");
      fireEvent.click(dismissButton);

      // The modal should be dismissed (showExhaustionModal becomes false)
      const state = useCreditStore.getState();
      expect(state.showExhaustionModal).toBe(false);
    });

    it("records dismiss timestamp", () => {
      const beforeTime = Date.now();
      render(<ExhaustionModal />);

      const dismissButton = screen.getByText("Dismiss for now");
      fireEvent.click(dismissButton);

      const state = useCreditStore.getState();
      expect(state.modalDismissedAt).toBeGreaterThanOrEqual(beforeTime);
      expect(state.modalDismissedAt).toBeLessThanOrEqual(Date.now());
    });
  });

  describe("navigation", () => {
    it("links to /subscriptions for upgrade", () => {
      render(<ExhaustionModal />);

      const upgradeLink = screen.getByRole("link", { name: /upgrade plan/i });
      expect(upgradeLink).toHaveAttribute("href", "/subscriptions");
    });

    it("links to /subscriptions for credit packs", () => {
      render(<ExhaustionModal />);

      const packLink = screen.getByRole("link", { name: /purchase credit pack/i });
      expect(packLink).toHaveAttribute("href", "/subscriptions");
    });
  });

  describe("timeout behavior", () => {
    it("respects 1-hour dismiss timeout", () => {
      const oneHourAgo = Date.now() - 30 * 60 * 1000; // 30 minutes ago (within 1 hour)
      useCreditStore.setState({
        modalDismissedAt: oneHourAgo,
        showExhaustionModal: false,
      });

      // Try to show the modal again
      useCreditStore.getState().showModal();

      // Should not show because we're within the 1-hour timeout
      expect(useCreditStore.getState().showExhaustionModal).toBe(false);
    });

    it("shows again after timeout expires", () => {
      const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000; // 2 hours ago
      useCreditStore.setState({
        modalDismissedAt: twoHoursAgo,
        showExhaustionModal: false,
      });

      // Try to show the modal again
      useCreditStore.getState().showModal();

      // Should show because we're past the 1-hour timeout
      expect(useCreditStore.getState().showExhaustionModal).toBe(true);
    });
  });
});

describe("formatCredits", () => {
  it("formats null as dash", () => {
    expect(formatCredits(null)).toBe("—");
  });

  it("formats 0 millicredits as 0", () => {
    expect(formatCredits(0)).toBe("0");
  });

  it("formats small values with decimal", () => {
    expect(formatCredits(500)).toBe("0.5");
    expect(formatCredits(5500)).toBe("5.5");
  });

  it("formats values >= 10 without decimals", () => {
    expect(formatCredits(10_000)).toBe("10");
    expect(formatCredits(50_000)).toBe("50");
  });

  it("formats large values with k suffix", () => {
    expect(formatCredits(1_000_000)).toBe("1k");
    expect(formatCredits(5_500_000)).toBe("5.5k");
  });

  it("handles negative values", () => {
    expect(formatCredits(-1000)).toBe("-1");
    expect(formatCredits(-500)).toBe("-0.5");
  });
});
