/**
 * Credit Store
 *
 * Global state for credit balance and out-of-credits status.
 * All values are in CREDITS (not millicredits). Conversion happens at boundaries:
 * - Langgraph sends millicredits → converted in updateFromCreditStatus
 * - Rails sends credits via inertia_share → used directly in hydrateFromPageProps
 *
 * Key behaviors:
 * - `justRanOut` triggers the modal to show
 * - Modal is dismissable but won't re-show for 1 hour
 * - `isOutOfCredits` determines if chat inputs should be locked
 */
import { create } from "zustand";
import { subscribeWithSelector, persist } from "zustand/middleware";

export interface CreditState {
  // Balance tracking (in credits, decimals allowed)
  balance: number | null;
  planCredits: number | null;
  packCredits: number | null;
  planCreditsAllocated: number | null; // Total credits allocated per period

  // Out of credits state
  isOutOfCredits: boolean;

  // Modal control
  showOutOfCreditsModal: boolean;
  modalDismissedAt: number | null;

  // Low credit warning (80% threshold)
  lowCreditWarningDismissedAt: number | null;
}

export interface CreditActions {
  /**
   * Update credit balance from Langgraph stream response.
   * Langgraph sends millicredits, so we convert here.
   * If justExhausted is true, triggers the modal to show (respecting dismiss timeout).
   */
  updateFromCreditStatus: (status: {
    estimatedRemainingMillicredits: number; // Langgraph uses millicredits
    justExhausted: boolean;
  }) => void;

  /**
   * Update balance from a 402 error response.
   * The error includes millicredits, so we convert here.
   */
  updateFromBalanceCheck: (balance: {
    balanceMillicredits: number;
    planMillicredits: number;
    packMillicredits: number;
    isExhausted: boolean;
  }) => void;

  /**
   * Hydrate from Inertia page props.
   * Called in SiteLayout on every navigation to ensure credit state persists.
   * Rails sends credits (already converted), so no conversion needed.
   */
  hydrateFromPageProps: (
    props: {
      plan_credits?: number | null;
      pack_credits?: number | null;
      total_credits?: number | null;
      plan_credits_allocated?: number | null;
    } | null
  ) => void;

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
   * Dismiss the low credit warning banner.
   * Records the dismiss time to prevent re-showing for 24 hours.
   */
  dismissLowCreditWarning: () => void;

  /**
   * Reset the store (e.g., on logout).
   */
  reset: () => void;
}

export type CreditStore = CreditState & CreditActions;

const MODAL_SUPPRESS_DURATION_MS = 60 * 60 * 1000; // 1 hour
const LOW_CREDIT_WARNING_SUPPRESS_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours
const LOW_CREDIT_WARNING_THRESHOLD_PERCENT = 80; // Show warning at 80% usage

const initialState: CreditState = {
  balance: null,
  planCredits: null,
  packCredits: null,
  planCreditsAllocated: null,
  isOutOfCredits: false,
  showOutOfCreditsModal: false,
  modalDismissedAt: null,
  lowCreditWarningDismissedAt: null,
};

/**
 * Convert millicredits to credits.
 * 1000 millicredits = 1 credit
 */
function millicreditsToCredits(millicredits: number): number {
  return Math.round((millicredits / 1000) * 100) / 100; // Round to 2 decimals
}

export const useCreditStore = create<CreditStore>()(
  persist(
    subscribeWithSelector(
      (set, get) => ({
        ...initialState,

        updateFromCreditStatus: (status) => {
          const { estimatedRemainingMillicredits, justExhausted } = status;
          const { modalDismissedAt } = get();

          const credits = millicreditsToCredits(estimatedRemainingMillicredits);

          // Determine if we should show the modal
          let shouldShowModal = false;
          if (justExhausted) {
            // Only show if not recently dismissed
            const now = Date.now();
            const canShow =
              !modalDismissedAt || now - modalDismissedAt > MODAL_SUPPRESS_DURATION_MS;
            shouldShowModal = canShow;
          }

          set({
            balance: credits,
            isOutOfCredits: credits <= 0,
            showOutOfCreditsModal: shouldShowModal,
          });
        },

        updateFromBalanceCheck: (balance) => {
          set({
            balance: millicreditsToCredits(balance.balanceMillicredits),
            planCredits: millicreditsToCredits(balance.planMillicredits),
            packCredits: millicreditsToCredits(balance.packMillicredits),
            isOutOfCredits: balance.isExhausted,
          });
        },

        hydrateFromPageProps: (props) => {
          if (!props) return;

          const { plan_credits, pack_credits, total_credits, plan_credits_allocated } = props;

          // Only update if we have actual data
          const updates: Partial<CreditState> = {};

          if (total_credits !== undefined && total_credits !== null) {
            updates.balance = total_credits;
            updates.isOutOfCredits = total_credits <= 0;
          }
          if (plan_credits !== undefined && plan_credits !== null) {
            updates.planCredits = plan_credits;
          }
          if (pack_credits !== undefined && pack_credits !== null) {
            updates.packCredits = pack_credits;
          }
          if (plan_credits_allocated !== undefined && plan_credits_allocated !== null) {
            updates.planCreditsAllocated = plan_credits_allocated;
          }

          if (Object.keys(updates).length > 0) {
            set(updates);
          }
        },

        dismissModal: () => {
          const ts = Date.now();
          console.log("[creditStore] dismissModal called, setting modalDismissedAt:", ts);
          set({
            showOutOfCreditsModal: false,
            modalDismissedAt: ts,
          });
          console.log(
            "[creditStore] localStorage after dismissModal:",
            localStorage.getItem("credit-store")
          );
        },

        showModal: () => {
          const { modalDismissedAt } = get();
          const now = Date.now();
          const canShow =
            !modalDismissedAt || now - modalDismissedAt > MODAL_SUPPRESS_DURATION_MS;

          if (canShow) {
            set({ showOutOfCreditsModal: true });
          }
        },

        dismissLowCreditWarning: () => {
          const ts = Date.now();
          console.log(
            "[creditStore] dismissLowCreditWarning called, setting lowCreditWarningDismissedAt:",
            ts
          );
          set({ lowCreditWarningDismissedAt: ts });
          console.log(
            "[creditStore] localStorage after dismissLowCreditWarning:",
            localStorage.getItem("credit-store")
          );
        },

        reset: () => set(initialState),
      })
    ),
    {
      name: "credit-store",
      partialize: (state) => ({
        modalDismissedAt: state.modalDismissedAt,
        lowCreditWarningDismissedAt: state.lowCreditWarningDismissedAt,
      }),
      onRehydrateStorage: () => {
        console.log("[creditStore] origin:", window.location.origin);
        console.log(
          "[creditStore] rehydrating from localStorage:",
          localStorage.getItem("credit-store")
        );
        console.log(
          "[creditStore] all localStorage keys:",
          Object.keys(localStorage)
        );
        return (state) => {
          console.log("[creditStore] rehydrated state:", {
            modalDismissedAt: state?.modalDismissedAt,
            lowCreditWarningDismissedAt: state?.lowCreditWarningDismissedAt,
          });
        };
      },
    }
  )
);

// ============================================================================
// Selectors
// ============================================================================

export const selectBalance = (s: CreditStore) => s.balance;
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
    balance: s.balance,
    plan: s.planCredits,
    pack: s.packCredits,
    allocated: s.planCreditsAllocated,
  }));
}

/**
 * Calculate usage percentage (0-100).
 * Returns null if data not available.
 */
export function useUsagePercent(): number | null {
  return useCreditStore((s) => {
    if (s.planCreditsAllocated === null || s.planCreditsAllocated === 0) return null;
    if (s.planCredits === null) return null;

    const used = s.planCreditsAllocated - s.planCredits;
    return Math.round((used / s.planCreditsAllocated) * 100);
  });
}

/**
 * Calculate usage percentage (selector version for internal use).
 */
function selectUsagePercent(s: CreditStore): number | null {
  if (s.planCreditsAllocated === null || s.planCreditsAllocated === 0) return null;
  if (s.planCredits === null) return null;
  const used = s.planCreditsAllocated - s.planCredits;
  return Math.round((used / s.planCreditsAllocated) * 100);
}

/**
 * Returns true if the low credit warning should be shown.
 * Conditions:
 * - Usage >= 80%
 * - Not already out of credits (has its own modal)
 * - Not dismissed within the last 24 hours
 */
export function useShowLowCreditWarning(): boolean {
  return useCreditStore((s) => {
    // Don't show if already out of credits (separate modal handles that)
    if (s.isOutOfCredits) return false;

    const usagePercent = selectUsagePercent(s);
    if (usagePercent === null) return false;

    // Only show if usage >= 80%
    if (usagePercent < LOW_CREDIT_WARNING_THRESHOLD_PERCENT) return false;

    // Check if recently dismissed
    const now = Date.now();
    console.log(`s.lowCreditWarningDismissedAt, ${s.lowCreditWarningDismissedAt}`);
    console.log(`now, ${now}`);
    console.log(`LOW_CREDIT_WARNING_SUPPRESS_DURATION_MS, ${LOW_CREDIT_WARNING_SUPPRESS_DURATION_MS}`);
    if (
      s.lowCreditWarningDismissedAt &&
      now - s.lowCreditWarningDismissedAt < LOW_CREDIT_WARNING_SUPPRESS_DURATION_MS
    ) {
      return false;
    }

    return true;
  });
}

/**
 * Format credits as a human-readable string.
 * Input is credits (not millicredits).
 */
export function formatCredits(credits: number | null): string {
  if (credits === null) return "—";
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
