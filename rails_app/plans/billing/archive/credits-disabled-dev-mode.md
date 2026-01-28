# CREDITS_DISABLED: Development Kill Switch

## Problem

The credit system has 8+ integration points across Langgraph middleware, Rails workers, and the React frontend. During local development and testing, developers burn through credits on every graph execution. We need a single kill switch to disable all credit enforcement without touching every integration point.

## Solution

A single environment variable — `CREDITS_DISABLED=true` — checked at **two strategic chokepoints** that cascade to disable the entire credit system.

### Chokepoint 1: Langgraph Credit Check Middleware

**File:** `langgraph_app/app/server/middleware/creditCheck.ts`

When `CREDITS_DISABLED=true`, the middleware:

- Skips the Rails API call entirely
- Sets `preRunCreditsRemaining` to `Number.MAX_SAFE_INTEGER`
- Allows the request to proceed unconditionally

**Cascade effect** (no additional code needed):

- `calculateCreditStatus` node sees a massive `preRunCreditsRemaining`, so `deriveCreditStatus()` never sets `justExhausted = true`
- Frontend `creditStore` never receives a `justExhausted` signal
- `CreditWarningModal` never fires
- `SubmitButton` stays enabled

### Chokepoint 2: Rails ChargeRunWorker

**File:** `rails_app/app/workers/credits/charge_run_worker.rb`

When `CREDITS_DISABLED=true`, the worker:

- Returns early without processing usage records
- Usage records still get **created** (by Langgraph's usage tracking middleware), preserving observability
- No `CreditTransaction` records are created
- Account balances are never decremented

## Setup

Add to your local `.env` files:

```bash
# langgraph_app/.env
CREDITS_DISABLED=true

# rails_app/.env
CREDITS_DISABLED=true
```

**Production safety:** Both sides hard-reject this flag in production:

- **Langgraph:** `env.ts` production schema forces `CREDITS_DISABLED` to `false` regardless of env var value
- **Rails:** `ChargeRunWorker#credits_disabled?` returns `false` when `Rails.env.production?`

Even if someone accidentally sets `CREDITS_DISABLED=true` in a production env, credits will still be enforced.

## Why not Flipper?

| Concern                    | Flipper                     | Env var at 2 chokepoints   |
| -------------------------- | --------------------------- | -------------------------- |
| Langgraph access           | Needs HTTP bridge to Rails  | Native `process.env` check |
| Integration points to wire | 8                           | 2                          |
| Runtime overhead           | Redis/DB lookup per request | Zero-cost string check     |
| Dev setup                  | Flipper gem + UI or console | One line in `.env`         |
| Risk of missing a spot     | High (8 places)             | Low (2 chokepoints)        |

## What still works when disabled

- LLM calls execute normally
- Usage records are still created in the database (token counts, model info)
- Graphs run to completion
- The frontend renders normally (no modals, no disabled buttons)

## What's skipped

- Pre-flight credit balance check (Langgraph -> Rails API call)
- Credit consumption (no `CreditTransaction` records created)
- Account balance decrement (balances stay frozen)
