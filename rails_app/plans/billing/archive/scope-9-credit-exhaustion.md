# Scope 9: Credit Exhaustion Detection & Frontend Lock

## Overview

**Purpose**: Block AI runs when credits exhausted AND immediately notify users with lock state across all frontends.

**Why It Matters**: Without this, users can consume AI resources indefinitely. Users need immediate feedback when they run out.

---

## Architecture: Predictive Calculation in Langgraph

**Key Insight**: Rather than making a synchronous call to Rails (which would require account locking in a web request), Langgraph can predict the post-run balance locally using cached model pricing. The fire-and-forget pattern to Rails continues unchanged.

### Why not synchronous Rails charge?

- Account locking in synchronous web request is risky under load
- Adds latency to every request
- Defeats the purpose of fire-and-forget

### Predictive Approach

1. **Pre-run**: Fetch balance via `GET /credits/check` → store in `UsageContext`
2. **Run graph**: Execute LLM calls, track tokens in `UsageContext.records`
3. **Post-run**: Calculate `estimatedCost` using model_configs pricing (already available in Langgraph)
4. **Derive**: `justExhausted = preRunBalance > 0 && (preRunBalance - estimatedCost) <= 0`
5. **Return in response**: Include `CreditStatus` in graph output/stream
6. **Fire-and-forget**: Continue sending to Rails for authoritative accounting

### Sequence Diagram

```
Frontend         Langgraph                    Rails (async)
   │                  │                           │
   │─sendMessage()───►│                           │
   │                  │                           │
   │                  │──GET /credits/check──────►│
   │                  │◄─{balance: 5000}──────────│
   │                  │                           │
   │                  │ [store in UsageContext]   │
   │                  │                           │
   │◄───stream────────│ [run graph, track usage]  │
   │                  │                           │
   │                  │ [calculate estimatedCost] │ ← Local calculation!
   │                  │ [derive justExhausted]    │
   │                  │                           │
   │◄──credit-state───│ {                         │
   │                  │   estimatedRemaining: 50, │
   │                  │   justExhausted: true     │
   │                  │ }                         │
   │                  │                           │
   │                  │──POST /llm_usage/notify───►│ ← Fire-and-forget
   │                  │   (run_id)                │   (unchanged)
   │                  │                           │
   │─Show Modal!      │                           │─[ChargeRunWorker]
   │─Lock All Inputs  │                           │
```

### Drift Tolerance

If Langgraph estimates 0 but Rails calculates 2 credits remaining, user gets warned slightly early - this is acceptable. The drift should be minimal since both use the same `model_configs` pricing data.

---

## Deliverables

### Rails Side

#### 1. `GET /api/v1/credits/check` - Pre-run check (internal service only)

**File**: `app/controllers/api/v1/credits_controller.rb`

```ruby
class Api::V1::CreditsController < Api::BaseController
  include InternalAPIVerification

  skip_before_action :require_api_authentication, only: [:check]
  before_action :verify_internal_service_call, only: [:check]

  def check
    account = Account.find(params[:account_id])

    render json: {
      ok: account.total_millicredits > 0,
      balance_millicredits: account.total_millicredits,
      plan_millicredits: account.plan_millicredits,
      pack_millicredits: account.pack_millicredits
    }
  end
end
```

**Returns**: `{ ok: boolean, balance_millicredits, plan_millicredits, pack_millicredits }`

- `ok` = `total_millicredits > 0`
- Called by Langgraph before graph execution

#### 2. Routes

**File**: `config/routes/api.rb`

```ruby
namespace :v1 do
  resources :credits, only: [] do
    collection do
      get :check  # Pre-run balance check
    end
  end
end
```

---

### Langgraph Side

#### 3. Extend `UsageContext` with credit tracking

**File**: `langgraph_app/app/core/billing/types.ts`

```typescript
export interface UsageContext {
  // ... existing fields
  preRunCreditsRemaining?: number; // Set before graph.invoke()
}
```

#### 4. `costCalculator.ts` - Calculate cost locally

**File**: `langgraph_app/app/core/billing/costCalculator.ts`

Uses cached `ModelConfig` pricing (already accessible via shared Postgres).

```typescript
import { ModelConfigCache } from "./modelConfigCache";
import type { UsageRecord } from "./types";

export function calculateCostMillicredits(records: UsageRecord[]): number {
  const cache = ModelConfigCache.getInstance();
  let totalCost = 0;

  for (const record of records) {
    const config = cache.getConfig(record.model);
    if (!config) {
      console.warn(`[costCalculator] Unknown model: ${record.model}`);
      continue;
    }

    // Formula: tokens × price_per_million / 10 = millicredits
    let cost = 0;
    cost += tokenCost(record.inputTokens, config.costIn);
    cost += tokenCost(record.outputTokens, config.costOut);
    cost += tokenCost(record.reasoningTokens, config.costReasoning ?? config.costOut);
    cost += tokenCost(record.cacheCreationTokens, config.cacheWrites);
    cost += tokenCost(record.cacheReadTokens, config.cacheReads);

    totalCost += cost;
  }

  return Math.round(totalCost);
}

function tokenCost(tokens: number, rate: number | null | undefined): number {
  if (!tokens || !rate) return 0;
  return (tokens * rate) / 10;
}
```

#### 5. Pre-run balance fetch in `executeWithTracking()`

**File**: `langgraph_app/app/lib/server/langgraph/executeWithTracking.ts`

Before `graph.invoke()`:

- Call `GET /credits/check`
- Store `balance_millicredits` in `UsageContext.preRunCreditsRemaining`
- If `ok === false`: reject run with appropriate error

```typescript
// Before graph.invoke()
const creditCheck = await checkCredits(accountId);
if (!creditCheck.ok) {
  throw new CreditExhaustedError("No credits remaining");
}

setUsageContext({
  ...context,
  preRunCreditsRemaining: creditCheck.balance_millicredits,
});
```

#### 6. Post-run credit status calculation

After graph completes:

- Calculate `estimatedCost` from `UsageContext.records`
- Derive: `estimatedRemaining = preRunCreditsRemaining - estimatedCost`
- Derive: `justExhausted = preRunCreditsRemaining > 0 && estimatedRemaining <= 0`
- Optional buffer: treat `estimatedRemaining <= 5` as exhausted for safety

```typescript
const estimatedCost = calculateCostMillicredits(context.records);
const estimatedRemaining = context.preRunCreditsRemaining - estimatedCost;
const justExhausted = context.preRunCreditsRemaining > 0 && estimatedRemaining <= 0;
```

#### 7. `CreditStatus` in graph response/stream

```typescript
interface CreditStatus {
  justExhausted: boolean; // true = show the modal!
  estimatedCreditsRemaining: number;
  preRunCreditsRemaining: number; // for debugging
}
```

- Emit as `credit-state` stream part right before stream closes
- OR include in final response envelope (depends on bridge architecture)

#### 8. Fire-and-forget to Rails unchanged

- `POST /llm_usage/notify` continues as before
- Rails `ChargeRunWorker` handles authoritative accounting
- No changes to existing charging pipeline

---

### Frontend Side

#### 9. `creditStore.ts` - Zustand store

**File**: `app/javascript/frontend/stores/creditStore.ts`

```typescript
import { create } from "zustand";

interface CreditState {
  balanceMillicredits: number;
  isExhausted: boolean;
  justExhausted: boolean;
  showExhaustionModal: boolean;
  modalDismissedAt: number | null;
}

interface CreditActions {
  updateBalance: (balance: number, justExhausted?: boolean) => void;
  dismissModal: () => void;
  hydrateFromProps: (props: { total_millicredits?: number }) => void;
}

export const useCreditStore = create<CreditState & CreditActions>((set, get) => ({
  balanceMillicredits: 0,
  isExhausted: false,
  justExhausted: false,
  showExhaustionModal: false,
  modalDismissedAt: null,

  updateBalance: (balance, justExhausted = false) => {
    const isExhausted = balance <= 0;
    const state = get();

    // Only show modal if:
    // 1. justExhausted is true (we just ran out)
    // 2. Modal hasn't been dismissed in the last hour
    const shouldShowModal =
      justExhausted && (!state.modalDismissedAt || Date.now() - state.modalDismissedAt > 3600000);

    set({
      balanceMillicredits: balance,
      isExhausted,
      justExhausted,
      showExhaustionModal: shouldShowModal,
    });
  },

  dismissModal: () => {
    set({
      showExhaustionModal: false,
      modalDismissedAt: Date.now(),
      justExhausted: false,
    });
  },

  hydrateFromProps: (props) => {
    const total = props.total_millicredits ?? 0;
    set({
      balanceMillicredits: total,
      isExhausted: total <= 0,
    });
  },
}));
```

#### 10. `ExhaustionModal.tsx`

**File**: `app/javascript/frontend/components/credits/ExhaustionModal.tsx`

- Options: "Upgrade Plan" / "Purchase Credit Pack"
- Dismissable, won't re-show for 1 hour

#### 11. `SubmitButton.tsx` modification

**File**: `app/javascript/frontend/components/shared/chat/input/SubmitButton.tsx`

- Check `isExhausted` before allowing submit
- If exhausted: show modal instead of submitting
- Visual disabled state when exhausted

#### 12. Layout integration

**File**: `app/javascript/frontend/layouts/site-layout.tsx`

- `ExhaustionModal` in `SiteLayout` (global, all pages)
- Hydrate `creditStore` from page props on load

#### 13. Stream handler

- Update `creditStore` when `credit-state` stream part received

---

## Files to Create/Modify

### Rails

| File                                           | Action                  |
| ---------------------------------------------- | ----------------------- |
| `app/controllers/api/v1/credits_controller.rb` | Create (check endpoint) |
| `config/routes/api.rb`                         | Add credits routes      |
| `spec/requests/api/v1/credits_spec.rb`         | Create                  |

### Langgraph

| File                                                            | Action                                  |
| --------------------------------------------------------------- | --------------------------------------- |
| `langgraph_app/app/core/billing/costCalculator.ts`              | Create                                  |
| `langgraph_app/app/core/billing/creditCheck.ts`                 | Create (pre-run balance fetch)          |
| `langgraph_app/app/core/billing/creditStatus.ts`                | Create (post-run derivation)            |
| `langgraph_app/app/core/billing/types.ts`                       | Extend UsageContext                     |
| `langgraph_app/app/lib/server/langgraph/executeWithTracking.ts` | Modify (pre-run check, post-run status) |
| `langgraph_app/app/core/billing/*.test.ts`                      | Create tests                            |

### Frontend

| File                                                                    | Action             |
| ----------------------------------------------------------------------- | ------------------ |
| `app/javascript/frontend/stores/creditStore.ts`                         | Create             |
| `app/javascript/frontend/components/credits/ExhaustionModal.tsx`        | Create             |
| `app/javascript/frontend/components/shared/chat/input/SubmitButton.tsx` | Modify (guard)     |
| `app/javascript/frontend/layouts/site-layout.tsx`                       | Modify (add modal) |

---

## Tests

### Rails

```
spec/requests/api/v1/credits_spec.rb
  - GET /credits/check returns correct status for positive balance
  - GET /credits/check returns ok=false for zero balance
  - GET /credits/check blocks without internal auth
  - GET /credits/check handles account with debt (negative balance)
```

### Langgraph

```
core/billing/costCalculator.test.ts
  - calculates cost correctly for various token combinations
  - handles input, output, reasoning, cache tokens
  - handles unknown models gracefully (returns 0, logs warning)
  - rounds correctly to millicredits

core/billing/creditCheck.test.ts
  - fetches balance from Rails endpoint
  - returns ok=false when balance is 0
  - blocks run when ok=false

core/billing/creditStatus.test.ts
  - calculates justExhausted correctly (positive → zero)
  - does not trigger justExhausted when already at zero
  - calculates estimatedRemaining correctly
  - handles buffer threshold (≤5 treated as exhausted)
```

### Frontend

```
components/credits/ExhaustionModal.test.tsx
  - shows when justExhausted is true
  - navigates to billing on upgrade click
  - navigates to credit packs on purchase click
  - respects dismiss timeout (1 hour)

stores/creditStore.test.ts
  - updateBalance triggers modal correctly
  - hydration from props works
  - isExhausted computed correctly
```

### Integration

```
spec/integration/credits/exhaustion_flow_spec.rb
  - user with 0 credits → run blocked pre-flight
  - user runs out mid-run → justExhausted returned
  - user purchases pack → pre-flight check passes
```

---

## Verification Strategy

### Unit Tests

1. Rails `/credits/check` returns correct balance status
2. Langgraph `costCalculator` calculates millicredits correctly from token counts
3. Langgraph `creditCheck` fetches balance and blocks when `ok=false`
4. Langgraph `creditStatus` derives `justExhausted` correctly
5. Frontend `creditStore` state transitions work correctly

### Integration Tests

1. Full flow: user starts with credits → runs exhaust them → `justExhausted: true` returned
2. User with 0 plan credits but pack credits > 0 → run allowed (pre-run check passes)
3. User with 0 credits → run blocked at pre-flight check
4. Predictive balance matches Rails actual balance (within acceptable drift)

### E2E Test

1. User sends message that exhausts credits → modal appears → chat input locked
2. User dismisses modal → can navigate but still can't submit
3. User purchases pack → chat input unlocked, can submit again

---

## Implementation Phases

| Phase     | Task                                                                                  | Duration      |
| --------- | ------------------------------------------------------------------------------------- | ------------- |
| 1         | Rails `/credits/check` endpoint                                                       | 0.5 day       |
| 2         | Langgraph `costCalculator.ts` using model_configs                                     | 0.5 day       |
| 3         | Langgraph `creditCheck.ts` (pre-run balance fetch)                                    | 0.5 day       |
| 4         | Langgraph `creditStatus.ts` (post-run derivation) + `executeWithTracking` integration | 1 day         |
| 5         | Credit-state in stream/response                                                       | 0.5 day       |
| 6         | Frontend `creditStore` and `ExhaustionModal`                                          | 1 day         |
| 7         | `SubmitButton` guard and layout integration                                           | 0.5 day       |
| 8         | Unit + integration tests                                                              | 1 day         |
| **Total** |                                                                                       | **~5.5 days** |
