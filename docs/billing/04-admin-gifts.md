# Admin Gifts

## Overview

Administrators can issue gift credits to accounts for customer support, promotions, compensation, or other reasons. Gift credits are added to the pack balance and never expire.

## How It Works

1. Admin creates a `CreditGift` record (via admin controller or console)
2. `CreditGift` `after_create` callback enqueues `AllocateGiftCreditsWorker`
3. Worker calls `AllocationService.allocate_gift!`
4. A `CreditTransaction` with `transaction_type: "gift"` and `credit_type: "pack"` is created
5. `Account.pack_millicredits` and `Account.total_millicredits` are updated

### Gift Reasons

| Reason | Use Case |
|--------|----------|
| `customer_support` | Resolving support tickets |
| `promotional` | Marketing campaigns |
| `compensation` | Service issues or outages |
| `beta_testing` | Rewarding beta testers |
| `referral_bonus` | Referral program |
| `other` | Catch-all |

## Key Files

| File | Purpose |
|------|---------|
| `rails_app/app/models/credit_gift.rb` | Gift model with reason enum |
| `rails_app/app/workers/credits/allocate_gift_credits_worker.rb` | Async allocation worker |
| `rails_app/app/services/credits/allocation_service.rb` | `allocate_gift!` method |
| `rails_app/app/controllers/admin/credit_gifts_controller.rb` | Admin interface |

## Key Concepts

### Gift Credits vs Pack Credits

Gift credits are stored as pack credits (`credit_type: "pack"`). They follow the same consumption rules — consumed after plan credits, never expire, survive subscription cancellation. The `transaction_type: "gift"` distinguishes them in the audit log.

### AllocationService.allocate_gift!

Accepts:
- `gift:` — the `CreditGift` record
- `idempotency_key:` — prevents duplicate allocation

The idempotency key is typically derived from the gift record's ID.

## Related Docs

- [01-credit-model.md](./01-credit-model.md) - Transaction types and credit model
- [03-credit-packs.md](./03-credit-packs.md) - Pack credit behavior
