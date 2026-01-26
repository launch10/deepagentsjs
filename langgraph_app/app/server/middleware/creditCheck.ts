/**
 * Credit Check Middleware
 *
 * Hono middleware that performs pre-flight credit checks before graph execution.
 * Should be chained after authMiddleware since it requires auth context.
 *
 * Usage:
 *   app.post("/stream", authMiddleware, creditCheckMiddleware, async (c) => {
 *     const creditState = c.get("creditState");
 *     // ... use creditState in graph state
 *   });
 */
import type { Context, Next } from "hono";
import type { AuthContext } from "./auth";
import { checkCredits, CreditCheckError, type CreditCheckResult } from "@core/billing";

/**
 * Credit state set by the middleware, available via c.get("creditState").
 */
export interface CreditState {
  /** Account ID for billing */
  accountId: number;
  /** Pre-run credit balance in millicredits */
  preRunCreditsRemaining: number;
}

/**
 * Hono middleware that checks credits before allowing the request to proceed.
 *
 * - Requires authMiddleware to run first (uses c.get("auth"))
 * - Sets c.set("creditState", ...) on success
 * - Returns 402 Payment Required if credits exhausted
 * - Fails open on errors (logs warning, allows request to proceed)
 */
export const creditCheckMiddleware = async (c: Context, next: Next) => {
  const auth = c.get("auth") as AuthContext | undefined;

  if (!auth) {
    console.error("[creditCheckMiddleware] No auth context - must run after authMiddleware");
    return c.json({ error: "Internal server error" }, 500);
  }

  try {
    const result = await checkCredits(auth.accountId);

    if (!result.ok) {
      return c.json(
        {
          error: "Insufficient credits",
          code: "CREDITS_EXHAUSTED",
          balance: result.balanceMillicredits,
          planCredits: result.planMillicredits,
          packCredits: result.packMillicredits,
        },
        402 // Payment Required
      );
    }

    // Set credit state for route handler to use
    c.set("creditState", {
      accountId: auth.accountId,
      preRunCreditsRemaining: result.balanceMillicredits,
    } satisfies CreditState);

    await next();
  } catch (error) {
    // Fail open - allow request to proceed if credit check fails
    if (error instanceof CreditCheckError) {
      console.warn("[creditCheckMiddleware] Credit check failed, proceeding anyway:", error.message);
    } else {
      console.warn("[creditCheckMiddleware] Unexpected error, proceeding anyway:", error);
    }

    // Set minimal credit state (no balance info available)
    c.set("creditState", {
      accountId: auth.accountId,
      preRunCreditsRemaining: undefined,
    });

    await next();
  }
};

/**
 * Helper to get credit state from context in route handlers.
 * Returns undefined if middleware didn't run or failed.
 */
export function getCreditState(c: Context): CreditState | undefined {
  return c.get("creditState") as CreditState | undefined;
}
