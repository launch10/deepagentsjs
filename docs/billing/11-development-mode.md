# Development Mode (CREDITS_DISABLED)

## Overview

A single environment variable — `CREDITS_DISABLED=true` — disables all credit enforcement for local development without touching every integration point. It works by targeting two strategic chokepoints that cascade to disable the entire system.

## How It Works

### Chokepoint 1: Langgraph Credit Check Middleware

**File**: `langgraph_app/app/server/middleware/creditCheck.ts`

When `CREDITS_DISABLED=true`, the middleware:
- Skips the Rails API call entirely
- Sets `preRunCreditsRemaining` to `Number.MAX_SAFE_INTEGER`
- Allows the request to proceed unconditionally

**Cascade effect** (no additional code needed):
- `calculateCreditStatus` node sees a massive `preRunCreditsRemaining`, so `deriveCreditStatus()` never sets `justExhausted = true`
- Frontend `creditStore` never receives a `justExhausted` signal
- `CreditWarningModal` never fires
- Chat input stays enabled

### Chokepoint 2: Rails ChargeRunWorker

**File**: `rails_app/app/workers/credits/charge_run_worker.rb`

When `CREDITS_DISABLED=true`, the worker:
- Returns early without processing usage records
- Usage records are still **created** (by Langgraph's usage tracking), preserving observability
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

### Production Safety

Both sides hard-reject this flag in production:
- **Langgraph**: `env.ts` production schema forces `CREDITS_DISABLED` to `false` regardless of env var value
- **Rails**: `ChargeRunWorker#credits_disabled?` returns `false` when `Rails.env.production?`

Even if someone accidentally sets `CREDITS_DISABLED=true` in a production environment, credits will still be enforced.

## What Still Works When Disabled

- LLM calls execute normally
- Usage records are created in the database (token counts, model info)
- Graphs run to completion
- The frontend renders normally (no modals, no disabled buttons)

## What's Skipped

- Pre-flight credit balance check (Langgraph → Rails API call)
- Credit consumption (no `CreditTransaction` records created)
- Account balance decrement (balances stay frozen)

## Key Files

| File | Purpose |
|------|---------|
| `langgraph_app/app/server/middleware/creditCheck.ts` | Chokepoint 1 — middleware bypass |
| `rails_app/app/workers/credits/charge_run_worker.rb` | Chokepoint 2 — worker bypass |

## Related Docs

- [07-pre-run-authorization.md](./07-pre-run-authorization.md) - Credit check middleware details
- [06-credit-charging.md](./06-credit-charging.md) - ChargeRunWorker details
- [12-testing-guide.md](./12-testing-guide.md) - Testing with credits enabled/disabled
