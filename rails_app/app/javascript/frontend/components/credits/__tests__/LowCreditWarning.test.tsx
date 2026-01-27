import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { LowCreditWarning } from "../LowCreditWarning";
import { useCreditStore } from "~/stores/creditStore";

// Mock Inertia's Link component
vi.mock("@inertiajs/react", () => ({
  Link: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

describe("LowCreditWarning", () => {
  beforeEach(() => {
    // Reset the store to initial state
    useCreditStore.getState().reset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("visibility", () => {
    it("does not render when usage is below 80%", () => {
      useCreditStore.setState({
        planCredits: 50, // 50% remaining = 50% used
        planCreditsAllocated: 100,
        isOutOfCredits: false,
        lowCreditWarningDismissedAt: null,
      });

      render(<LowCreditWarning />);

      expect(screen.queryByText(/Running low on credits/)).not.toBeInTheDocument();
    });

    it("renders when usage is at 80%", () => {
      useCreditStore.setState({
        balance: 20,
        planCredits: 20, // 80% used
        planCreditsAllocated: 100,
        isOutOfCredits: false,
        lowCreditWarningDismissedAt: null,
      });

      render(<LowCreditWarning />);

      expect(screen.getByText(/Running low on credits/)).toBeInTheDocument();
    });

    it("renders when usage is above 80%", () => {
      useCreditStore.setState({
        balance: 10,
        planCredits: 10, // 90% used
        planCreditsAllocated: 100,
        isOutOfCredits: false,
        lowCreditWarningDismissedAt: null,
      });

      render(<LowCreditWarning />);

      expect(screen.getByText(/Running low on credits/)).toBeInTheDocument();
    });

    it("does not render when user is out of credits (modal takes precedence)", () => {
      useCreditStore.setState({
        balance: 0,
        planCredits: 0,
        planCreditsAllocated: 100,
        isOutOfCredits: true,
        lowCreditWarningDismissedAt: null,
      });

      render(<LowCreditWarning />);

      expect(screen.queryByText(/Running low on credits/)).not.toBeInTheDocument();
    });

    it("does not render when recently dismissed", () => {
      const twelveHoursAgo = Date.now() - 12 * 60 * 60 * 1000;
      useCreditStore.setState({
        balance: 10,
        planCredits: 10, // 90% used
        planCreditsAllocated: 100,
        isOutOfCredits: false,
        lowCreditWarningDismissedAt: twelveHoursAgo,
      });

      render(<LowCreditWarning />);

      expect(screen.queryByText(/Running low on credits/)).not.toBeInTheDocument();
    });

    it("renders after dismiss timeout expires", () => {
      const twentyFiveHoursAgo = Date.now() - 25 * 60 * 60 * 1000;
      useCreditStore.setState({
        balance: 10,
        planCredits: 10, // 90% used
        planCreditsAllocated: 100,
        isOutOfCredits: false,
        lowCreditWarningDismissedAt: twentyFiveHoursAgo,
      });

      render(<LowCreditWarning />);

      expect(screen.getByText(/Running low on credits/)).toBeInTheDocument();
    });
  });

  describe("content", () => {
    beforeEach(() => {
      useCreditStore.setState({
        balance: 15,
        planCredits: 15, // 85% used
        planCreditsAllocated: 100,
        isOutOfCredits: false,
        lowCreditWarningDismissedAt: null,
      });
    });

    it("displays usage percentage", () => {
      render(<LowCreditWarning />);

      expect(screen.getByText(/85%/)).toBeInTheDocument();
    });

    it("displays remaining credits", () => {
      render(<LowCreditWarning />);

      expect(screen.getByText(/15 credits/)).toBeInTheDocument();
    });

    it("links to purchase credits page", () => {
      render(<LowCreditWarning />);

      const link = screen.getByRole("link", { name: /Purchase Credits/i });
      expect(link).toHaveAttribute("href", "/subscriptions");
    });
  });

  describe("interactions", () => {
    beforeEach(() => {
      useCreditStore.setState({
        balance: 10,
        planCredits: 10,
        planCreditsAllocated: 100,
        isOutOfCredits: false,
        lowCreditWarningDismissedAt: null,
      });
    });

    it("dismisses warning on close button click", () => {
      render(<LowCreditWarning />);

      const closeButton = screen.getByRole("button", { name: /dismiss warning/i });
      fireEvent.click(closeButton);

      // The warning should no longer be visible
      expect(screen.queryByText(/Running low on credits/)).not.toBeInTheDocument();
    });

    it("records dismiss timestamp", () => {
      const beforeDismiss = Date.now();
      render(<LowCreditWarning />);

      const closeButton = screen.getByRole("button", { name: /dismiss warning/i });
      fireEvent.click(closeButton);

      const state = useCreditStore.getState();
      expect(state.lowCreditWarningDismissedAt).toBeGreaterThanOrEqual(beforeDismiss);
      expect(state.lowCreditWarningDismissedAt).toBeLessThanOrEqual(Date.now());
    });
  });
});
