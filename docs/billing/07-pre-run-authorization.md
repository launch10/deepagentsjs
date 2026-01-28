# Pre-Run Authorization

## Overview

Before any graph execution, Langgraph's credit check middleware verifies the account has sufficient credits by calling Rails. If credits are exhausted, the request is rejected with a 402 Payment Required response.

## How It Works

### Middleware Chain

The credit check runs as Hono middleware after authentication:

1. `authMiddleware` — validates JWT, sets `userId` and `accountId`
2. `creditCheckMiddleware` — calls Rails to verify credit balance
3. Graph execution — proceeds only if credits are available

### Credit Check Flow

1. Middleware calls `checkCredits(jwt, railsBaseUrl)` from `core/billing/creditCheck.ts`
2. This sends `GET /api/v1/credits/check` to Rails with the user's JWT
3. Rails `CreditsController#check` returns:
   ```json
   {
     "ok": true,
     "balance_millicredits": 5000000,
     "plan_millicredits": 4000000,
     "pack_millicredits": 1000000
   }
   ```
4. If `ok` is `false` (balance is 0), middleware returns 402 Payment Required
5. If `ok` is `true`, middleware sets `creditState` on the Hono context:
   - `accountId` — for billing
   - `preRunCreditsRemaining` — used later by `calculateCreditStatusNode`

### Fail-Open Policy

If the credit check request fails (network error, Rails downtime), the middleware **fails open**: it logs a warning and allows the request to proceed. This prevents billing infrastructure issues from blocking all AI usage.

### Post-Run Exhaustion Detection

After the graph completes, the `calculateCreditStatusNode` runs as the last node before END. It:

1. Reads `preRunCreditsRemaining` from the graph state
2. Calculates estimated cost from usage records in the `usageContext`
3. Computes `estimatedRemaining = preRunCreditsRemaining - estimatedCost`
4. Sets `justExhausted = true` if `preRunCreditsRemaining > 0 && estimatedRemaining <= BUFFER_THRESHOLD`

The `BUFFER_THRESHOLD` is 5 millicredits — a safety margin to account for minor cost estimation drift between the Langgraph and Rails cost calculators.

## Key Files

| File | Purpose |
|------|---------|
| `langgraph_app/app/server/middleware/creditCheck.ts` | Hono middleware |
| `langgraph_app/app/core/billing/creditCheck.ts` | `checkCredits()`, `canProceedWithRun()` |
| `langgraph_app/app/core/billing/creditStatus.ts` | `deriveCreditStatus()` — post-run exhaustion check |
| `langgraph_app/app/nodes/core/calculateCreditStatus.ts` | Graph node wrapping `deriveCreditStatus()` |
| `rails_app/app/controllers/api/v1/credits_controller.rb` | `GET /api/v1/credits/check` endpoint |

## Key Concepts

### CreditState

Set by the middleware on the Hono context (`c.set("creditState", ...)`):

| Field | Type | Purpose |
|-------|------|---------|
| `accountId` | string | Account being billed |
| `preRunCreditsRemaining` | number | Balance snapshot before graph runs |

### 402 Response

When credits are exhausted, the middleware returns:

```json
{
  "error": "insufficient_credits",
  "balance_millicredits": 0,
  "plan_millicredits": 0,
  "pack_millicredits": 0
}
```

The frontend `creditStore` handles 402 responses via `updateFromBalanceCheck()`.

### CREDITS_DISABLED Bypass

When `CREDITS_DISABLED=true` (non-production only):
- Middleware skips the Rails API call entirely
- Sets `preRunCreditsRemaining` to `Number.MAX_SAFE_INTEGER`
- All downstream credit logic sees unlimited credits

## Related Docs

- [05-llm-usage-tracking.md](./05-llm-usage-tracking.md) - How `preRunCreditsRemaining` is used during tracking
- [08-credit-exhaustion-ui.md](./08-credit-exhaustion-ui.md) - Frontend handling of 402 and `justExhausted`
- [11-development-mode.md](./11-development-mode.md) - CREDITS_DISABLED kill switch
