/**
 * Calculate Credit Status Node
 *
 * A shared node that calculates credit status at the end of a graph run.
 * This enables the frontend to detect when a user just exhausted their credits
 * and show the ExhaustionModal.
 *
 * How it works:
 * 1. Middleware sets `preRunCreditsRemaining` from the preflight check
 * 2. Graph executes and accumulates usage records in AsyncLocalStorage
 * 3. This node calculates estimated cost and determines if credits were exhausted
 * 4. Returns `creditStatus` which flows through the stream to the frontend
 *
 * Usage:
 * Add this node as the last node before END in any graph that makes LLM calls.
 */
import type { CoreGraphState } from "@types";
import { getUsageContext, deriveCreditStatus } from "@core/billing";
import { LLMManager, calculateRunCost } from "@core";
import { env } from "@core";

/**
 * Calculate credit status based on pre-run balance and usage during the run.
 * Returns empty object if no credit tracking was set up (middleware failed open).
 */
export async function calculateCreditStatusNode(
  state: CoreGraphState
): Promise<Partial<CoreGraphState>> {
  const { preRunCreditsRemaining } = state;

  // No credit tracking for this run (middleware failed open or test)
  if (preRunCreditsRemaining === undefined) {
    return {};
  }

  // Get usage from current run via usageStorage
  const usageContext = getUsageContext();
  if (!usageContext || usageContext.records.length === 0) {
    // No LLM calls made, return current balance with no change
    return {
      creditStatus: {
        justExhausted: false,
        estimatedRemainingMillicredits: preRunCreditsRemaining,
        preRunMillicredits: preRunCreditsRemaining,
        estimatedCostMillicredits: 0,
      },
    };
  }

  try {
    // Get model configs for cost calculation
    const modelConfigs = await LLMManager.getModelConfigs();

    // Calculate estimated cost of this run
    const estimatedCostMillicredits = calculateRunCost(
      usageContext.records,
      modelConfigs
    );

    // Derive credit status (includes justExhausted calculation)
    const creditStatus = deriveCreditStatus({
      preRunMillicredits: preRunCreditsRemaining,
      estimatedCostMillicredits,
    });

    return { creditStatus };
  } catch (error) {
    // Log error with details about which models were used
    console.warn(
      "[calculateCreditStatusNode] Failed to calculate credit status:",
      error
    );

    // Log the usage records to help debug which LLM is causing issues
    console.warn(
      "[calculateCreditStatusNode] Usage records that caused the error:",
      usageContext.records.map((r) => ({
        model: r.model,
        langchainRunId: r.langchainRunId,
        tags: r.tags,
        inputTokens: r.inputTokens,
        outputTokens: r.outputTokens,
      }))
    );
    return {};
  }
}
