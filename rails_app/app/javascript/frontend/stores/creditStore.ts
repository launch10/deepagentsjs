/**
 * Credit Store
 *
 * Global state for credit balance and out-of-credits status.
 * Updated from Langgraph stream responses via CreditStatus events.
 *
 * Key behaviors:
 * - `justRanOut` triggers the modal to show
 * - Modal is dismissable but won't re-show for 1 hour
 * - `isOutOfCredits` determines if chat inputs should be locked
 */
import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";

export interface CreditState {
  // Balance tracking (in millicredits)
  balanceMillicredits: number | null;
  planMillicredits: number | null;
  packMillicredits: number | null;

  // Out of credits state
  isOutOfCredits: boolean;

  // Modal control
  showOutOfCreditsModal: boolean;
  modalDismissedAt: number | null;
}

export interface CreditActions {
  /**
   * Update credit balance from stream response.
   * If justRanOut is true, triggers the modal to show (respecting dismiss timeout).
   */
  updateFromCreditStatus: (status: {
    estimatedCreditsRemaining: number;
    justExhausted: boolean; // Keep param name for compatibility with Langgraph
  }) => void;

  /**
   * Update balance from a direct API check (e.g., 402 error).
   */
  updateFromBalanceCheck: (balance: {
    balanceMillicredits: number;
    planMillicredits: number;
    packMillicredits: number;
    isExhausted: boolean; // Keep param name for compatibility
  }) => void;

  /**
   * Dismiss the out-of-credits modal.
   * Records the dismiss time to prevent re-showing for 1 hour.
   */
  dismissModal: () => void;

  /**
   * Show the modal manually (e.g., when user tries to submit with no credits).
   */
  showModal: () => void;

  /**
   * Reset the store (e.g., on logout).
   */
  reset: () => void;
}

export type CreditStore = CreditState & CreditActions;

const MODAL_SUPPRESS_DURATION_MS = 60 * 60 * 1000; // 1 hour

const initialState: CreditState = {
  balanceMillicredits: null,
  planMillicredits: null,
  packMillicredits: null,
  isOutOfCredits: false,
  showOutOfCreditsModal: false,
  modalDismissedAt: null,
};

export const useCreditStore = create<CreditStore>()(
  subscribeWithSelector((set, get) => ({
    ...initialState,

    updateFromCreditStatus: (status) => {
      const { estimatedCreditsRemaining, justExhausted: justRanOut } = status;
      const { modalDismissedAt } = get();

      // Determine if we should show the modal
      let shouldShowModal = false;
      if (justRanOut) {
        // Only show if not recently dismissed
        const now = Date.now();
        const canShow = !modalDismissedAt || now - modalDismissedAt > MODAL_SUPPRESS_DURATION_MS;
        shouldShowModal = canShow;
      }

      set({
        balanceMillicredits: estimatedCreditsRemaining,
        isOutOfCredits: estimatedCreditsRemaining <= 0,
        showOutOfCreditsModal: shouldShowModal,
      });
    },

    updateFromBalanceCheck: (balance) => {
      set({
        balanceMillicredits: balance.balanceMillicredits,
        planMillicredits: balance.planMillicredits,
        packMillicredits: balance.packMillicredits,
        isOutOfCredits: balance.isExhausted,
      });
    },

    dismissModal: () => {
      set({
        showOutOfCreditsModal: false,
        modalDismissedAt: Date.now(),
      });
    },

    showModal: () => {
      const { modalDismissedAt } = get();
      const now = Date.now();
      const canShow = !modalDismissedAt || now - modalDismissedAt > MODAL_SUPPRESS_DURATION_MS;

      if (canShow) {
        set({ showOutOfCreditsModal: true });
      }
    },

    reset: () => set(initialState),
  }))
);

// ============================================================================
// Selectors
// ============================================================================

export const selectBalanceMillicredits = (s: CreditStore) => s.balanceMillicredits;
export const selectIsOutOfCredits = (s: CreditStore) => s.isOutOfCredits;
export const selectShowOutOfCreditsModal = (s: CreditStore) => s.showOutOfCreditsModal;

// ============================================================================
// Convenience hooks
// ============================================================================

export function useIsOutOfCredits() {
  return useCreditStore(selectIsOutOfCredits);
}

export function useShowOutOfCreditsModal() {
  return useCreditStore(selectShowOutOfCreditsModal);
}

export function useCreditBalance() {
  return useCreditStore((s) => ({
    balance: s.balanceMillicredits,
    plan: s.planMillicredits,
    pack: s.packMillicredits,
  }));
}

/**
 * Format millicredits as a human-readable string.
 * 1000 millicredits = 1 credit
 */
export function formatCredits(millicredits: number | null): string {
  if (millicredits === null) return "—";
  const credits = millicredits / 1000;
  if (credits >= 1000) {
    return `${(credits / 1000).toFixed(1)}k`;
  }
  // For values >= 10, show no decimals
  if (Math.abs(credits) >= 10) {
    return credits.toFixed(0);
  }
  // For values < 10, show 1 decimal only if needed
  const rounded = Math.round(credits * 10) / 10;
  return rounded % 1 === 0 ? rounded.toFixed(0) : rounded.toFixed(1);
}
