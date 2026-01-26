import { useEffect, useRef } from "react";
import { useCreditStore } from "~/stores/creditStore";
import type { CreditStatus } from "@shared";

/**
 * Watches langgraph state for creditStatus changes and updates the credit store.
 *
 * This hook enables the "mid-run exhaustion" detection flow:
 * 1. Middleware captures pre-run balance
 * 2. Graph runs and accumulates LLM usage
 * 3. calculateCreditStatusNode computes creditStatus at end of run
 * 4. creditStatus flows through the stream to this hook
 * 5. This hook updates the credit store, triggering ExhaustionModal if justExhausted
 *
 * Usage:
 * ```tsx
 * function MyPage() {
 *   const creditStatus = useMyGraphSelector((s) => s.state.creditStatus);
 *   useCreditStatusWatcher(creditStatus);
 *
 *   return <Chat.Root chat={chat}>...</Chat.Root>
 * }
 * ```
 *
 * @param creditStatus - The creditStatus from langgraph state (undefined until run completes)
 */
export function useCreditStatusWatcher(creditStatus: CreditStatus | undefined | null) {
  const updateFromCreditStatus = useCreditStore((s) => s.updateFromCreditStatus);

  // Track the last processed credit status to avoid re-processing the same status
  const lastProcessedRef = useRef<string | null>(null);

  useEffect(() => {
    // Skip if no credit status
    if (!creditStatus) return;

    // Create a fingerprint for this credit status to detect changes
    const fingerprint = `${creditStatus.preRunMillicredits}-${creditStatus.estimatedCostMillicredits}`;

    // Skip if we've already processed this exact status
    if (lastProcessedRef.current === fingerprint) return;

    // Mark as processed
    lastProcessedRef.current = fingerprint;

    // Update the credit store
    updateFromCreditStatus({
      estimatedCreditsRemaining: creditStatus.estimatedRemainingMillicredits,
      justExhausted: creditStatus.justExhausted,
    });
  }, [creditStatus, updateFromCreditStatus]);
}
