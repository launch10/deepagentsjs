# Subscription Cancellation

## Overview

When a user cancels their subscription, they retain access to remaining credits until the billing period ends. No credits are immediately expired. Cancellation is enforced by preventing new credit grants rather than by revoking existing ones.

## How It Works

### Policy

- **During grace period**: User retains full access to plan credits until billing period ends
- **After subscription ends**: Plan credits remain but no new credits are ever granted
- **No monthly resets**: Yearly subscribers with pending cancellation do not receive monthly credit resets
- **No renewal allocations**: Canceled subscriptions are skipped by the renewal handler

### Pack Credits

Pack credits are **never affected** by subscription status:

- No expiration on cancellation
- Remain usable even without an active subscription
- Users with only pack credits can still use AI features

### Enforcement Mechanisms

There is no single "expire credits" action. Instead, cancellation is enforced by **three mechanisms that prevent new grants**:

1. **`CancellationHandler`** — Registered for `stripe.customer.subscription.deleted`. Intentionally a no-op for credits. The user keeps their remaining balance since they already paid for the current period.

2. **`RenewalHandler`** — Checks `subscription.active?` before allocating. Canceled subscriptions are skipped, so no new monthly credits are granted after cancellation.

3. **`AnnualSubscriberMonthlyAllocationWorker`** — Filters `where(ends_at: nil)` to exclude subscriptions pending cancellation. This prevents yearly subscribers from receiving monthly credit resets after they cancel.

### Edge Cases

**Reactivation after cancellation**:

- Within same billing period: No change (credits still available)
- After period ends: Fresh allocation on new subscription creation

**Immediate cancellation (cancel_now)**:

- Same policy — credits remain in account, no new grants

**Pause vs Cancel**:

- Pause is not currently supported by the Stripe integration
- Only full cancellation is available

## Key Files

| File                                                           | Purpose                                  |
| -------------------------------------------------------------- | ---------------------------------------- |
| `rails_app/app/webhooks/credits/cancellation_handler.rb`       | No-op handler for `subscription.deleted` |
| `rails_app/app/webhooks/credits/renewal_handler.rb`            | Skips inactive subscriptions             |
| `rails_app/app/workers/credits/daily_reconciliation_worker.rb` | Excludes `ends_at` set subscriptions     |

## Related Docs

- [02-subscription-credits.md](./02-subscription-credits.md) - Renewal and allocation logic
- [09-stripe-webhooks.md](./09-stripe-webhooks.md) - Webhook handler details
- [03-credit-packs.md](./03-credit-packs.md) - Pack credits survive cancellation
