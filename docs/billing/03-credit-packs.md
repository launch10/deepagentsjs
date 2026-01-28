# Credit Packs

## Overview

Credit packs are one-time credit purchases that supplement the monthly plan allocation. Pack credits never expire and are consumed only after plan credits are exhausted.

## How It Works

### Purchase Flow (Backend Only)

Credit pack purchasing is implemented on the backend but does not yet have a frontend purchase UI. The flow is:

1. User initiates a purchase (future: via frontend UI)
2. Stripe processes the charge, creating a `Pay::Charge` with `credit_pack` metadata
3. `AllocatePackCreditsWorker` is triggered
4. Worker calls `AllocationService.allocate_pack!`
5. A `CreditTransaction` with `transaction_type: "purchase"` is created
6. `Account.pack_millicredits` and `Account.total_millicredits` are updated

### Pack Definitions

`CreditPack` records define available packs:

| Field | Description |
|-------|-------------|
| `name` | Display name (e.g., "500 Credits") |
| `credits` | Number of credits included |
| `price_cents` | Price in cents |
| `currency` | Currency code (e.g., "usd") |
| `stripe_price_id` | Stripe Price ID for checkout |
| `visible` | Whether the pack is shown to users |

Helper methods: `price_dollars` and `credits_per_dollar`.

### Purchase Tracking

`CreditPackPurchase` links an account to a purchased pack:

| Field | Description |
|-------|-------------|
| `credits_purchased` | Credits from the pack |
| `credits_used` | How many have been consumed |
| `is_used` | Whether the pack is fully consumed |
| `credits_allocated` | Whether allocation has been processed |

**Validation**: Account must have an active subscription to purchase packs.

Scopes: `unused`, `used`, `oldest_first`, `for_account`.

### Consumption Priority

Pack credits are consumed after plan credits. When a charge exceeds the plan balance:

1. Plan credits absorb what they can (balance can go to 0)
2. Remaining cost is charged to pack credits
3. The transaction is recorded with `credit_type: "split"`

Pack credits never go negative. If both plan and pack are exhausted, the plan balance goes negative (overdraft).

## Key Files

| File | Purpose |
|------|---------|
| `rails_app/app/models/credit_pack.rb` | Pack definitions |
| `rails_app/app/models/credit_pack_purchase.rb` | Purchase tracking |
| `rails_app/app/workers/credits/allocate_pack_credits_worker.rb` | Async allocation after payment |
| `rails_app/app/services/credits/allocation_service.rb` | `allocate_pack!` method |

## Key Concepts

### Implementation Status

- **Backend**: Fully implemented (models, worker, allocation service)
- **Frontend**: Not yet implemented (no purchase UI, modal buttons link to placeholder)

### Pack Credits and Subscription Status

Pack credits are **not affected by subscription cancellation**. Even after a subscription ends, pack credits remain usable. Users with only pack credits can still use AI features without an active subscription.

### AllocationService.allocate_pack!

Accepts:
- `credit_pack:` — the `CreditPack` being purchased
- `pay_charge:` — the `Pay::Charge` record from Stripe
- `idempotency_key:` — prevents duplicate allocation

Creates a `CreditTransaction` with `transaction_type: "purchase"` and `credit_type: "pack"`.

## Related Docs

- [01-credit-model.md](./01-credit-model.md) - Credit types and consumption order
- [06-credit-charging.md](./06-credit-charging.md) - How pack credits are consumed during charging
- [10-subscription-cancellation.md](./10-subscription-cancellation.md) - Pack credits survive cancellation
