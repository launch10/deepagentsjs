import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CreditWarningModal } from "../CreditWarningModal";
import { useCreditStore } from "~/stores/creditStore";

vi.mock("@inertiajs/react", () => ({
  Link: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

describe("CreditWarningModal", () => {
  beforeEach(() => {
    useCreditStore.getState().reset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("exhausted variant", () => {
    beforeEach(() => {
      useCreditStore.setState({
        balance: 0,
        planCredits: 0,
        packCredits: 0,
        planCreditsAllocated: 500,
        isOutOfCredits: true,
        showOutOfCreditsModal: true,
        modalDismissedAt: null,
      });
    });

    it("renders exhausted title when out of credits", () => {
      render(<CreditWarningModal />);
      expect(screen.getByTestId("credit-modal-title")).toHaveTextContent(
        "You\u2019ve reached your credit limit"
      );
    });

    it("renders exhausted description", () => {
      render(<CreditWarningModal />);
      expect(
        screen.getByText(/used all your credits for this billing period/i)
      ).toBeInTheDocument();
    });

    it("shows 0/500 balance", () => {
      render(<CreditWarningModal />);
      expect(screen.getByTestId("credit-modal-balance")).toHaveTextContent("0/500");
    });

    it("dismisses via close button and records timestamp", () => {
      const before = Date.now();
      render(<CreditWarningModal />);

      fireEvent.click(screen.getByTestId("credit-modal-close"));

      const state = useCreditStore.getState();
      expect(state.showOutOfCreditsModal).toBe(false);
      expect(state.modalDismissedAt).toBeGreaterThanOrEqual(before);
    });

    it("does not render when showOutOfCreditsModal is false", () => {
      useCreditStore.setState({ showOutOfCreditsModal: false });
      render(<CreditWarningModal />);
      expect(screen.queryByTestId("credit-modal")).not.toBeInTheDocument();
    });
  });

  describe("low credits variant", () => {
    beforeEach(() => {
      useCreditStore.setState({
        balance: 25,
        planCredits: 25,
        packCredits: 0,
        planCreditsAllocated: 500,
        isOutOfCredits: false,
        showOutOfCreditsModal: false,
        showLowCreditModal: true,
        lowCreditWarningDismissedAt: null,
      });
    });

    it("renders low credits title when showLowCreditModal is true", () => {
      render(<CreditWarningModal />);
      expect(screen.getByTestId("credit-modal-title")).toHaveTextContent(
        "You\u2019re running low on credits"
      );
    });

    it("renders low credits description with usage percentage", () => {
      render(<CreditWarningModal />);
      expect(screen.getByText(/95% of your monthly credits/)).toBeInTheDocument();
    });

    it("shows 25/500 balance", () => {
      render(<CreditWarningModal />);
      expect(screen.getByTestId("credit-modal-balance")).toHaveTextContent("25/500");
    });

    it("dismisses via close button and records warning timestamp", () => {
      const before = Date.now();
      render(<CreditWarningModal />);

      fireEvent.click(screen.getByTestId("credit-modal-close"));

      const state = useCreditStore.getState();
      expect(state.showLowCreditModal).toBe(false);
      expect(state.lowCreditWarningDismissedAt).toBeGreaterThanOrEqual(before);
    });

    it("does not render when showLowCreditModal is false", () => {
      useCreditStore.setState({ showLowCreditModal: false });
      render(<CreditWarningModal />);
      expect(screen.queryByTestId("credit-modal")).not.toBeInTheDocument();
    });
  });

  describe("hydrateFromPageProps triggers low credit modal", () => {
    it("triggers low credit modal when usage >= 80% and not dismissed", () => {
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

    it("does not trigger when recently dismissed", () => {
      useCreditStore.setState({
        lowCreditWarningDismissedAt: Date.now() - 12 * 60 * 60 * 1000, // 12h ago
      });
      useCreditStore.getState().hydrateFromPageProps({
        plan_credits: 15,
        pack_credits: 0,
        total_credits: 15,
        plan_credits_allocated: 100,
      });
      expect(useCreditStore.getState().showLowCreditModal).toBe(false);
    });

    it("triggers after dismiss timeout expires (24h)", () => {
      useCreditStore.setState({
        lowCreditWarningDismissedAt: Date.now() - 25 * 60 * 60 * 1000, // 25h ago
      });
      useCreditStore.getState().hydrateFromPageProps({
        plan_credits: 15,
        pack_credits: 0,
        total_credits: 15,
        plan_credits_allocated: 100,
      });
      expect(useCreditStore.getState().showLowCreditModal).toBe(true);
    });
  });

  describe("navigation links", () => {
    beforeEach(() => {
      useCreditStore.setState({
        balance: 0,
        planCredits: 0,
        planCreditsAllocated: 500,
        isOutOfCredits: true,
        showOutOfCreditsModal: true,
      });
    });

    it("links to /subscriptions for upgrade", () => {
      render(<CreditWarningModal />);
      const link = screen.getByRole("link", { name: /upgrade plan/i });
      expect(link).toHaveAttribute("href", "/subscriptions");
    });

    it("links to /subscriptions for purchase", () => {
      render(<CreditWarningModal />);
      const link = screen.getByRole("link", { name: /purchase credits/i });
      expect(link).toHaveAttribute("href", "/subscriptions");
    });
  });

  describe("exhausted variant takes priority", () => {
    it("shows exhausted when both conditions could apply", () => {
      useCreditStore.setState({
        balance: 0,
        planCredits: 0,
        planCreditsAllocated: 500,
        isOutOfCredits: true,
        showOutOfCreditsModal: true,
        lowCreditWarningDismissedAt: null,
      });
      render(<CreditWarningModal />);
      expect(screen.getByTestId("credit-modal-title")).toHaveTextContent(
        "You\u2019ve reached your credit limit"
      );
    });
  });

  describe("timeout behavior", () => {
    it("respects 1-hour dismiss timeout for exhausted modal", () => {
      const thirtyMinutesAgo = Date.now() - 30 * 60 * 1000;
      useCreditStore.setState({
        balance: 0,
        isOutOfCredits: true,
        modalDismissedAt: thirtyMinutesAgo,
        showOutOfCreditsModal: false,
      });

      useCreditStore.getState().showModal();
      expect(useCreditStore.getState().showOutOfCreditsModal).toBe(false);
    });

    it("shows exhausted modal after timeout expires", () => {
      const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000;
      useCreditStore.setState({
        balance: 0,
        isOutOfCredits: true,
        modalDismissedAt: twoHoursAgo,
        showOutOfCreditsModal: false,
      });

      useCreditStore.getState().showModal();
      expect(useCreditStore.getState().showOutOfCreditsModal).toBe(true);
    });
  });
});
