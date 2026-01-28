# Credit Model

## Overview

Credits are the unit of currency for AI usage in Launch10. All credit math uses millicredits (1 credit = 1000 millicredits = 1 cent) to avoid floating-point precision issues.

## How It Works

Every credit movement is recorded as a `CreditTransaction` — an append-only audit log. Account balances are cached on the `Account` model and updated atomically when transactions are created.

### Credit Types

| Type | Source | Behavior |
|------|--------|----------|
| `plan` | Monthly subscription allocation | Expires on renewal; consumed first |
| `pack` | One-time credit pack purchase | Never expires; consumed after plan credits |

### Transaction Types

| Type | Direction | Use Case |
|------|-----------|----------|
| `allocate` | Credit (+) | Plan renewal, pack purchase, gift |
| `consume` | Debit (-) | LLM usage charge |
| `expire` | Debit (-) | Unused plan credits at renewal |
| `adjust` | Either | Admin manual correction |
| `purchase` | Credit (+) | Credit pack purchase |
| `refund` | Credit (+) | Refund of charges |
| `gift` | Credit (+) | Admin-issued gift credits |

### Consumption Order

When credits are consumed, the system follows this priority:

1. **Plan credits first** — these expire at renewal anyway
2. **Pack credits second** — these persist indefinitely
3. **Plan overdraft** — plan balance can go negative if both are exhausted; the debt is absorbed at next renewal

Pack credits never go negative.

## Key Files

| File | Purpose |
|------|---------|
| `rails_app/app/models/credit_transaction.rb` | Transaction audit log model |
| `rails_app/app/models/concerns/millicredits.rb` | Conversion utilities |
| `rails_app/app/models/account.rb` | Cached balance columns |

## Key Concepts

### Millicredits

The `Millicredits` module provides conversion between human-readable credits and internal millicredits:

- `Millicredits.from_credits(5)` → `5000`
- `Millicredits.to_credits(5000)` → `5`
- 1 credit = 1000 millicredits = 1 cent

All database columns, services, and calculations use millicredits internally. Conversion to credits happens at display boundaries (API responses, frontend).

### Account Balance Columns

The `Account` model maintains three cached balance columns:

- `plan_millicredits` — current plan credit balance
- `pack_millicredits` — current pack credit balance
- `total_millicredits` — sum of plan + pack (denormalized for quick checks)

These are updated via an `after_create` callback on `CreditTransaction`. Display methods `plan_credits`, `pack_credits`, and `total_credits` convert to credits.

### Transaction Validation

Each `CreditTransaction` enforces:

- **Sequence validation**: `balance_after` must equal previous transaction's `balance_after` + current `amount`
- **Sum validation**: `plan_balance_after + pack_balance_after` must equal `balance_after`
- **Idempotency**: `idempotency_key` column has a unique database constraint to prevent duplicate processing

### Idempotency Key Formats

| Source | Format | Example |
|--------|--------|---------|
| Stripe events | `plan_credits:{event_id}` | `plan_credits:evt_1234567890` |
| Plan changes | `plan_change:{sub_id}:{old_plan}:{new_plan}` | `plan_change:123:1:2` |
| Renewals | `plan_credits:{sub_id}:{period_start_date}` | `plan_credits:123:2025-01-01` |
| Monthly resets | `monthly_reset:{sub_id}:{month_start}` | `monthly_reset:123:2025-02-01` |

## Related Docs

- [02-subscription-credits.md](./02-subscription-credits.md) - Plan credit allocation
- [03-credit-packs.md](./03-credit-packs.md) - Pack credit purchases
- [06-credit-charging.md](./06-credit-charging.md) - How consumption works
