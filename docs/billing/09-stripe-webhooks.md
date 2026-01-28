# Stripe Webhooks

## Overview

Credit allocation for renewals and plan changes is driven by Stripe webhooks, not ActiveRecord callbacks. This ensures we act on explicit signals from Stripe rather than inferring intent from database changes.

## How It Works

Webhook handlers are registered in `config/initializers/pay.rb` via Pay's delegator pattern:

```ruby
Pay::Webhooks.delegator.subscribe "stripe.invoice.paid", Credits::RenewalHandler.new
Pay::Webhooks.delegator.subscribe "stripe.customer.subscription.updated", Credits::PlanChangeHandler.new
Pay::Webhooks.delegator.subscribe "stripe.customer.subscription.deleted", Credits::CancellationHandler.new
```

### Why Webhooks Over Callbacks

A `Pay::Subscription` can be updated for many reasons (payment method change, metadata update, quantity change, etc.). Only some should trigger credit allocation. Stripe webhooks provide explicit signals:

- `invoice.paid` includes `billing_reason` — distinguishes `subscription_cycle` (renewal) from `subscription_create` (first payment) and `subscription_update` (proration)
- `customer.subscription.updated` includes `previous_attributes` — shows exactly what changed

### RenewalHandler

Listens to `stripe.invoice.paid`. Only processes events where:

1. `invoice.subscription` is present (invoice is for a subscription)
2. `invoice.billing_reason == "subscription_cycle"` (this is an actual renewal, not proration)
3. The `Pay::Subscription` exists and is active

On match, enqueues `ResetPlanCreditsWorker` with `stripe_event_id` for idempotency.

### PlanChangeHandler

Listens to `stripe.customer.subscription.updated`. Only processes events where:

1. `previous_attributes.items` is present (the plan actually changed)
2. The `Pay::Subscription` exists and is active
3. The old price ID maps to a known `Plan` record

On match, enqueues `ResetPlanCreditsWorker` with both `previous_plan_id` and `stripe_event_id`.

### CancellationHandler

Listens to `stripe.customer.subscription.deleted`. This is intentionally a **no-op** for credits. The user keeps their remaining balance since they already paid for the current period. Credit grants are prevented by other mechanisms (see [10-subscription-cancellation.md](./10-subscription-cancellation.md)).

## Key Files

| File | Purpose |
|------|---------|
| `rails_app/app/webhooks/credits/renewal_handler.rb` | Handles `invoice.paid` for renewals |
| `rails_app/app/webhooks/credits/plan_change_handler.rb` | Handles `subscription.updated` for plan changes |
| `rails_app/app/webhooks/credits/cancellation_handler.rb` | No-op handler for `subscription.deleted` |
| `rails_app/config/initializers/pay.rb` | Webhook handler registration |

## Key Concepts

### Idempotency via Stripe Event IDs

Every webhook uses the Stripe event ID (`evt_...`) as the idempotency key. This is globally unique and handles:

- Stripe retries (same event ID resent)
- Webhook replay from Stripe dashboard
- Out-of-order delivery

### Events That Do NOT Trigger Credit Changes

| Event | Why Ignored |
|-------|-------------|
| `subscription.updated` without `previous_attributes.items` | Quantity, metadata, or payment method change |
| `invoice.paid` with `billing_reason: "subscription_update"` | Proration from plan change (credits already handled by PlanChangeHandler) |
| `invoice.paid` with `billing_reason: "subscription_create"` | First payment (initial allocation already handled by `PaySubscriptionCredits` callback) |

### Test Fixtures

Comprehensive webhook fixtures are available in `rails_app/spec/support/stripe/webhook_fixtures.rb`. The module provides builder methods for every Stripe event type needed for testing.

## Related Docs

- [02-subscription-credits.md](./02-subscription-credits.md) - How allocation works
- [10-subscription-cancellation.md](./10-subscription-cancellation.md) - Cancellation credit policy
- [12-testing-guide.md](./12-testing-guide.md) - Webhook testing patterns
