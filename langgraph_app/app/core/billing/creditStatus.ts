/**
 * Credit Status
 *
 * Post-run derivation of credit exhaustion status.
 * Calculates whether the user just exhausted their credits based on
 * pre-run balance and estimated cost from the run.
 *
 * Formula:
 *   estimatedRemaining = preRunBalance - estimatedCost
 *   justExhausted = preRunBalance > 0 && estimatedRemaining <= BUFFER_THRESHOLD
 *
 * The buffer threshold (5 millicredits) provides a safety margin to account
 * for minor drift between predictive calculation and authoritative Rails calculation.
 */

/** Buffer threshold in millicredits - treat as exhausted if remaining is <= this */
const BUFFER_THRESHOLD = 5;

/**
 * Input for deriving credit status.
 */
export interface CreditStatusInput {
  /** Balance before the run in millicredits */
  preRunMillicredits: number;
  /** Estimated cost of the run in millicredits */
  estimatedCostMillicredits: number;
}

/**
 * Credit status result for frontend consumption.
 */
export interface CreditStatus {
  /** true if user just went from positive to zero/negative credits */
  justExhausted: boolean;
  /** Estimated remaining credits after this run */
  estimatedRemainingMillicredits: number;
  /** Balance before the run (for debugging) */
  preRunMillicredits: number;
  /** Estimated cost of the run (for debugging) */
  estimatedCostMillicredits: number;
}

/**
 * Derive credit status from pre-run balance and estimated cost.
 *
 * @param input - Pre-run balance and estimated cost
 * @returns Credit status with justExhausted flag
 */
export function deriveCreditStatus(input: CreditStatusInput): CreditStatus {
  const { preRunMillicredits, estimatedCostMillicredits } = input;

  // Calculate estimated remaining balance
  const estimatedRemainingMillicredits =
    preRunMillicredits - estimatedCostMillicredits;

  // Determine if user just exhausted their credits
  // - Must have had positive balance before the run
  // - Must now be at or below the buffer threshold
  const justExhausted =
    preRunMillicredits > 0 && estimatedRemainingMillicredits <= BUFFER_THRESHOLD;

  return {
    justExhausted,
    estimatedRemainingMillicredits,
    preRunMillicredits,
    estimatedCostMillicredits,
  };
}
