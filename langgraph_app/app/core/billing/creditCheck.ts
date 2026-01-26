/**
 * Credit Check
 *
 * Pre-run balance check to determine if the account has sufficient credits.
 * Called before graph execution to decide if the run should proceed.
 */

import { createRailsApiClient } from "@rails_api";

/**
 * Result of a credit check.
 */
export interface CreditCheckResult {
  /** Whether the account can proceed with the run (has positive balance) */
  ok: boolean;
  /** Total balance in millicredits */
  balanceMillicredits: number;
  /** Plan credits in millicredits (expire at renewal) */
  planMillicredits: number;
  /** Pack credits in millicredits (persist until used) */
  packMillicredits: number;
}

/**
 * Error thrown when credit check fails.
 */
export class CreditCheckError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly accountId?: number
  ) {
    super(message);
    this.name = "CreditCheckError";
  }
}

/**
 * Check the account's credit balance before a graph run.
 *
 * @param accountId - The account ID to check
 * @param baseUrl - Optional base URL for Rails API (defaults to env)
 * @returns Credit check result with balance information
 * @throws CreditCheckError if the check fails
 */
export async function checkCredits(
  accountId: number,
  baseUrl?: string
): Promise<CreditCheckResult> {
  if (!accountId) {
    throw new CreditCheckError("account_id is required", 400);
  }

  try {
    const client = await createRailsApiClient({
      internalServiceCall: true,
      baseUrl,
    });

    // Call the credits check endpoint
    // TODO: Add rswag specs to Rails controller so this endpoint is in generated types
    const response = await client.GET("/api/v1/credits/check" as any, {
      params: {
        query: { account_id: accountId },
      },
    });

    if (response.error) {
      const error = response.error as { error?: string };
      throw new CreditCheckError(
        error?.error || "Credit check failed",
        response.response?.status,
        accountId
      );
    }

    const data = response.data as {
      ok: boolean;
      balance_millicredits: number;
      plan_millicredits: number;
      pack_millicredits: number;
    };

    return {
      ok: data.ok,
      balanceMillicredits: data.balance_millicredits,
      planMillicredits: data.plan_millicredits,
      packMillicredits: data.pack_millicredits,
    };
  } catch (error) {
    if (error instanceof CreditCheckError) {
      throw error;
    }

    // Network or other errors
    throw new CreditCheckError(
      `Credit check failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      undefined,
      accountId
    );
  }
}

/**
 * Convenience method to check if a run can proceed based on credit check result.
 *
 * @param result - The credit check result
 * @returns true if the run can proceed
 */
export function canProceedWithRun(result: CreditCheckResult): boolean {
  return result.ok;
}
