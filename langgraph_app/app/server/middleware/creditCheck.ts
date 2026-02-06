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
import { env, getLogger } from "@core";

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
 * - Returns 503 Service Unavailable if credit check fails (fail closed)
 */
export const creditCheckMiddleware = async (c: Context, next: Next) => {
  const auth = c.get("auth") as AuthContext | undefined;

  if (!auth) {
    getLogger({ component: "creditCheck" }).error("No auth context — must run after authMiddleware");
    return c.json({ error: "Internal server error" }, 500);
  }

  // Dev kill switch: skip all credit checks when CREDITS_DISABLED is set
  if (env.CREDITS_DISABLED) {
    c.set("creditState", {
      accountId: auth.accountId,
      preRunCreditsRemaining: Number.MAX_SAFE_INTEGER,
    } satisfies CreditState);
    return next();
  }

  try {
    const result = await checkCredits(auth.jwt);

    if (!result.ok) {
      return c.json(
        {
          error: "Insufficient credits",
          code: "CREDITS_EXHAUSTED",
          balance: result.balance_millicredits,
          planCredits: result.plan_millicredits,
          packCredits: result.pack_millicredits,
        },
        402 // Payment Required
      );
    }

    // Set credit state for route handler to use
    c.set("creditState", {
      accountId: auth.accountId,
      preRunCreditsRemaining: result.balance_millicredits,
    } satisfies CreditState);

    await next();
  } catch (error) {
    // Fail closed - block request if credit check fails
    const message = error instanceof Error ? error.message : "Unknown error";
    getLogger({ component: "creditCheck" }).error({ err: error }, "Credit check failed, blocking request");

    return c.json(
      {
        error: "Unable to verify credits. Please try again.",
        code: "CREDIT_CHECK_FAILED",
      },
      503 // Service Unavailable
    );
  }
};

/**
 * Helper to get credit state from context in route handlers.
 * Returns undefined if middleware didn't run or failed.
 */
export function getCreditState(c: Context): CreditState | undefined {
  return c.get("creditState") as CreditState | undefined;
}
