/**
 * Credit Store
 *
 * Global state for credit balance and exhaustion status.
 * Updated from Langgraph stream responses via CreditStatus events.
 *
 * Key behaviors:
 * - `justExhausted` triggers the modal to show
 * - Modal is dismissable but won't re-show for 1 hour
 * - `isExhausted` determines if chat inputs should be locked
 */
import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";

export interface CreditState {
  // Balance tracking (in millicredits)
  balanceMillicredits: number | null;
  planMillicredits: number | null;
  packMillicredits: number | null;

  // Exhaustion state
  isExhausted: boolean;

  // Modal control
  showExhaustionModal: boolean;
  modalDismissedAt: number | null;
}

export interface CreditActions {
  /**
   * Update credit balance from API or stream response.
   * If justExhausted is true, triggers the modal to show (respecting dismiss timeout).
   */
  updateFromCreditStatus: (status: {
    estimatedCreditsRemaining: number;
    justExhausted: boolean;
  }) => void;

  /**
   * Update balance from a direct API check (e.g., page load).
   */
  updateFromBalanceCheck: (balance: {
    balanceMillicredits: number;
    planMillicredits: number;
    packMillicredits: number;
    isExhausted: boolean;
  }) => void;

  /**
   * Dismiss the exhaustion modal.
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
  isExhausted: false,
  showExhaustionModal: false,
  modalDismissedAt: null,
};

export const useCreditStore = create<CreditStore>()(
  subscribeWithSelector((set, get) => ({
    ...initialState,

    updateFromCreditStatus: (status) => {
      const { estimatedCreditsRemaining, justExhausted } = status;
      const { modalDismissedAt } = get();

      // Determine if we should show the modal
      let showModal = false;
      if (justExhausted) {
        // Only show if not recently dismissed
        const now = Date.now();
        const canShow =
          !modalDismissedAt || now - modalDismissedAt > MODAL_SUPPRESS_DURATION_MS;
        showModal = canShow;
      }

      set({
        balanceMillicredits: estimatedCreditsRemaining,
        isExhausted: estimatedCreditsRemaining <= 0,
        showExhaustionModal: showModal,
      });
    },

    updateFromBalanceCheck: (balance) => {
      set({
        balanceMillicredits: balance.balanceMillicredits,
        planMillicredits: balance.planMillicredits,
        packMillicredits: balance.packMillicredits,
        isExhausted: balance.isExhausted,
      });
    },

    dismissModal: () => {
      set({
        showExhaustionModal: false,
        modalDismissedAt: Date.now(),
      });
    },

    showModal: () => {
      const { modalDismissedAt } = get();
      const now = Date.now();
      const canShow =
        !modalDismissedAt || now - modalDismissedAt > MODAL_SUPPRESS_DURATION_MS;

      if (canShow) {
        set({ showExhaustionModal: true });
      }
    },

    reset: () => set(initialState),
  }))
);

// ============================================================================
// Selectors
// ============================================================================

export const selectBalanceMillicredits = (s: CreditStore) => s.balanceMillicredits;
export const selectIsExhausted = (s: CreditStore) => s.isExhausted;
export const selectShowExhaustionModal = (s: CreditStore) => s.showExhaustionModal;

// ============================================================================
// Convenience hooks
// ============================================================================

export function useCreditsExhausted() {
  return useCreditStore(selectIsExhausted);
}

export function useShowExhaustionModal() {
  return useCreditStore(selectShowExhaustionModal);
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
