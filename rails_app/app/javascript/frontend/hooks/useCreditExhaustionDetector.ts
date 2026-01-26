import { useEffect } from "react";
import { useCreditStore } from "~/stores/creditStore";

/**
 * Detects credit exhaustion errors from chat error state and updates the credit store.
 *
 * The Langgraph API returns a 402 with:
 * {
 *   "error": "Insufficient credits",
 *   "code": "CREDITS_EXHAUSTED",
 *   "balance": 0,
 *   "planCredits": 0,
 *   "packCredits": 0
 * }
 *
 * The SDK turns this into an Error with the response body as the message.
 *
 * @param error - The error from chat state (useChatError() or similar)
 */
export function useCreditExhaustionDetector(error: Error | undefined | null) {
  const updateFromBalanceCheck = useCreditStore((s) => s.updateFromBalanceCheck);
  const showModal = useCreditStore((s) => s.showModal);

  useEffect(() => {
    if (!error) return;

    // Check if this is a credit exhaustion error
    const message = error.message || "";

    // Look for the CREDITS_EXHAUSTED code in the error message
    if (message.includes("CREDITS_EXHAUSTED") || message.includes("Insufficient credits")) {
      // Try to parse the balance info from the error
      try {
        const parsed = JSON.parse(message);
        if (parsed.code === "CREDITS_EXHAUSTED") {
          // Update the store with the balance info
          updateFromBalanceCheck({
            balanceMillicredits: parsed.balance ?? 0,
            planMillicredits: parsed.planCredits ?? 0,
            packMillicredits: parsed.packCredits ?? 0,
            isExhausted: true,
          });

          // Show the modal
          showModal();
        }
      } catch {
        // If we can't parse, just mark as exhausted and show modal
        updateFromBalanceCheck({
          balanceMillicredits: 0,
          planMillicredits: 0,
          packMillicredits: 0,
          isExhausted: true,
        });
        showModal();
      }
    }
  }, [error, updateFromBalanceCheck, showModal]);
}
