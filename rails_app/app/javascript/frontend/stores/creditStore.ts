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
  periodEndsAt: string | null; // ISO 8601 date when credits reset

  // Out of credits state
  isOutOfCredits: boolean;

  // Modal control
  showOutOfCreditsModal: boolean;
  modalDismissedAt: number | null;

  // Low credit warning modal (80% threshold)
  showLowCreditModal: boolean;
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
      period_ends_at?: string | null;
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
   * Dismiss the low credit warning modal.
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
  periodEndsAt: null,
  isOutOfCredits: false,
  showOutOfCreditsModal: false,
  modalDismissedAt: null,
  showLowCreditModal: false,
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

          const credits = millicreditsToCredits(estimatedRemainingMillicredits);

          if (justExhausted) {
            // Force-show exhausted modal (overrides any previous dismiss)
            // and close the low credit modal since exhausted takes priority
            set({
              balance: credits,
              isOutOfCredits: true,
              showOutOfCreditsModal: true,
              showLowCreditModal: false,
            });
          } else {
            set({
              balance: credits,
              isOutOfCredits: credits <= 0,
            });
          }
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

          const { plan_credits, pack_credits, total_credits, plan_credits_allocated, period_ends_at } = props;

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
          if (period_ends_at !== undefined) {
            updates.periodEndsAt = period_ends_at ?? null;
          }

          if (Object.keys(updates).length > 0) {
            set(updates);
          }

          // Check if low credit modal should be triggered.
          // This runs after setting updates so we use fresh + existing state.
          const state = get();
          const effectiveAllocated = updates.planCreditsAllocated ?? state.planCreditsAllocated;
          const effectivePlanCredits = updates.planCredits ?? state.planCredits;
          const effectiveOutOfCredits = updates.isOutOfCredits ?? state.isOutOfCredits;

          if (
            !effectiveOutOfCredits &&
            !state.showLowCreditModal &&
            effectiveAllocated !== null && effectiveAllocated > 0 &&
            effectivePlanCredits !== null
          ) {
            const used = effectiveAllocated - effectivePlanCredits;
            const usagePercent = Math.round((used / effectiveAllocated) * 100);

            if (usagePercent >= LOW_CREDIT_WARNING_THRESHOLD_PERCENT) {
              const now = Date.now();
              const canShow =
                !state.lowCreditWarningDismissedAt ||
                now - state.lowCreditWarningDismissedAt > LOW_CREDIT_WARNING_SUPPRESS_DURATION_MS;

              if (canShow) {
                set({ showLowCreditModal: true });
              }
            }
          }
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
          const canShow =
            !modalDismissedAt || now - modalDismissedAt > MODAL_SUPPRESS_DURATION_MS;

          if (canShow) {
            set({ showOutOfCreditsModal: true });
          }
        },

        dismissLowCreditWarning: () => {
          set({
            showLowCreditModal: false,
            lowCreditWarningDismissedAt: Date.now(),
          });
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
