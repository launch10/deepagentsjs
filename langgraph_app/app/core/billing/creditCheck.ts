/**
 * Credit Check
 *
 * Pre-run balance check to determine if the account has sufficient credits.
 * Called before graph execution to decide if the run should proceed.
 */

import { createRailsApiClient, type CheckCreditsResponse } from "@rails_api";

/**
 * Result of a credit check — derived from the generated API path type.
 */
export type CreditCheckResult = CheckCreditsResponse;

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
 * @param jwt - JWT token for authentication (identifies the account)
 * @param baseUrl - Optional base URL for Rails API (defaults to env)
 * @returns Credit check result with balance information
 * @throws CreditCheckError if the check fails
 */
export async function checkCredits(jwt: string, baseUrl?: string): Promise<CreditCheckResult> {
  if (!jwt) {
    throw new CreditCheckError("JWT token is required", 401);
  }

  try {
    const client = await createRailsApiClient({ jwt, baseUrl });
    const response = await client.GET("/api/v1/credits/check", {
      params: {
        header: {
          Authorization: `Bearer ${jwt}`,
        },
      },
    });

    if (response.error || !response.data) {
      throw new CreditCheckError("Credit check failed", response.response?.status);
    }

    return response.data;
  } catch (error) {
    if (error instanceof CreditCheckError) {
      throw error;
    }

    // Network or other errors
    throw new CreditCheckError(
      `Credit check failed: ${error instanceof Error ? error.message : "Unknown error"}`
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
