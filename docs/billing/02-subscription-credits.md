# Subscription Credits

## Overview

Each subscription plan includes a monthly credit allocation. Credits are allocated on subscription creation, reset on renewal, and adjusted on plan changes (upgrades/downgrades).

## How It Works

### Initial Allocation

When a user subscribes, the `PaySubscriptionCredits` concern fires an `after_commit on: :create` callback that enqueues `ResetPlanCreditsWorker`. This allocates the plan's full credit amount.

### Monthly Renewal

Renewals are handled via Stripe webhooks (not ActiveRecord callbacks). When `invoice.paid` arrives with `billing_reason: "subscription_cycle"`, the `RenewalHandler` enqueues `ResetPlanCreditsWorker`, which:

1. Expires remaining plan credits (creates an `expire` transaction)
2. Allocates fresh plan credits for the new period (creates an `allocate` transaction)

### Plan Upgrade

When `customer.subscription.updated` arrives with `previous_attributes.items` changed and the new plan has more credits:

1. Expires remaining plan credits
2. Allocates the full new plan amount

### Plan Downgrade

When the new plan has fewer credits, the system pro-rates based on actual consumption this period:

1. Calculates consumption from transaction history
2. New balance = `new_plan_credits - consumption_this_period`, floored at 0
3. Creates an `adjust` transaction with the pro-rated balance

### Yearly Subscriber Monthly Resets

Yearly subscribers pay once but get monthly credit resets. The `AnnualSubscriberMonthlyAllocationWorker` (runs daily via Zhong scheduler) checks if today matches the subscriber's billing anchor day and enqueues a reset if due.

## Key Files

| File                                                           | Purpose                                             |
| -------------------------------------------------------------- | --------------------------------------------------- |
| `rails_app/app/services/credits/allocation_service.rb`         | `reset_plan_credits!` — main allocation entry point |
| `rails_app/app/workers/credits/reset_plan_credits_worker.rb`   | Async worker with idempotency key handling          |
| `rails_app/app/models/concerns/pay_subscription_credits.rb`    | `after_commit` hook for initial allocation          |
| `rails_app/app/workers/credits/daily_reconciliation_worker.rb` | Monthly reset for yearly subscribers                |

## Key Concepts

### AllocationService.reset_plan_credits!

This is the single entry point for all plan credit operations. It accepts:

- `subscription:` — the `Pay::Subscription` record
- `idempotency_key:` — prevents duplicate processing
- `previous_plan:` — if present, triggers upgrade/downgrade logic instead of simple renewal

### ResetPlanCreditsWorker Options

The worker accepts a hash of options that determine behavior:

| Option                | Effect                                                          |
| --------------------- | --------------------------------------------------------------- |
| `stripe_event_id`     | Uses `plan_credits:{event_id}` as idempotency key               |
| `previous_plan_id`    | Passes previous plan to AllocationService for upgrade/downgrade |
| `monthly_reset: true` | Uses `monthly_reset:{sub_id}:{month_start}` as idempotency key  |

### AnnualSubscriberMonthlyAllocationWorker Logic

1. Finds yearly subscribers where `ends_at IS NULL` (excludes pending cancellations)
2. Checks if today's day-of-month matches the subscription's `current_period_start.day`
3. Verifies no allocation transaction exists for the current month
4. Enqueues `ResetPlanCreditsWorker` with `monthly_reset: true`

## Related Docs

- [01-credit-model.md](./01-credit-model.md) - Credit types and transaction model
- [09-stripe-webhooks.md](./09-stripe-webhooks.md) - Webhook handlers that trigger allocation
- [10-subscription-cancellation.md](./10-subscription-cancellation.md) - What happens on cancellation
