# Testing Guide

## Overview

The credits system spans Rails models, services, workers, webhook handlers, Langgraph middleware, and React components. This guide covers testing strategies for each layer.

## Unit Tests (Rails)

### Models

Test credit transaction validation, balance updates, and scopes:

```bash
bundle exec rspec spec/models/credit_transaction_spec.rb
bundle exec rspec spec/models/credit_pack_spec.rb
bundle exec rspec spec/models/credit_pack_purchase_spec.rb
bundle exec rspec spec/models/credit_gift_spec.rb
```

Key assertions:

- Sequence validation catches balance drift
- `balance_after` equals previous `balance_after` + `amount`
- `plan_balance_after + pack_balance_after == balance_after`
- Idempotency key uniqueness constraint

### Services

```bash
bundle exec rspec spec/services/credits/
```

**AllocationService**: Test renewal, upgrade, downgrade, pack allocation, gift allocation, and admin adjustments.

**ConsumptionService**: Test plan-only consumption, pack-only consumption, split consumption, and plan overdraft.

**CostCalculator**: Test token-to-millicredits conversion for various models, edge cases with zero tokens, and models with cache pricing.

### Workers

```bash
bundle exec rspec spec/workers/credits/
```

**ChargeRunWorker**: Test processing of LLM usage records, idempotent reprocessing, and `CREDITS_DISABLED` bypass.

**ResetPlanCreditsWorker**: Test idempotency key formats, upgrade/downgrade detection, and monthly reset handling.

**AnnualSubscriberMonthlyAllocationWorker**: Test billing anchor day matching, exclusion of canceled subscriptions, and month boundary handling.

**FindUnprocessedRunsWorker**: Test detection of stale records and ChargeRunWorker enqueueing.

## Integration Tests (Rails)

### Subscription Lifecycle

```bash
bundle exec rspec spec/integration/credits/subscription_lifecycle_spec.rb
```

Tests the full create → use → renew → upgrade → cancel flow.

### Webhook Handlers

Webhook test fixtures are in `rails_app/spec/support/stripe/webhook_fixtures.rb`. Include `StripeWebhookFixtures` in your test and use builder methods:

```ruby
RSpec.describe "Credit Allocation", type: :integration do
  include StripeWebhookFixtures

  def process_webhook(event)
    Pay::Webhooks.instrument(event: event, type: event.type)
  end
end
```

Key fixture methods:

| Method                                                          | Tests              |
| --------------------------------------------------------------- | ------------------ |
| `invoice_paid_event(billing_reason: "subscription_cycle")`      | Renewal allocation |
| `invoice_paid_event(billing_reason: "subscription_update")`     | Proration ignored  |
| `subscription_plan_changed_event(old_price_id:, new_price_id:)` | Upgrade/downgrade  |
| `subscription_deleted_event`                                    | Cancellation no-op |

### Idempotency Testing

Process the same webhook event twice and verify:

- Only one `CreditTransaction` is created
- Account balance reflects a single allocation

## Unit Tests (Langgraph)

```bash
cd langgraph_app && pnpm test
```

### Billing Module

- **tracker.ts**: Test that `UsageTrackingCallbackHandler` captures tokens from LLM responses
- **storage.ts**: Test AsyncLocalStorage context creation and propagation
- **persist.ts**: Test database write format and retry logic
- **creditCheck.ts**: Test `checkCredits()` response parsing and error handling
- **creditStatus.ts**: Test `deriveCreditStatus()` exhaustion detection with various balance/cost combinations
- **cost.ts**: Test `calculateCost()` against known token counts and model configs

### Key Test Patterns

Test the `BUFFER_THRESHOLD` (5 millicredits) behavior in `deriveCreditStatus()`:

| Pre-run Balance | Estimated Cost | Expected `justExhausted`          |
| --------------- | -------------- | --------------------------------- |
| 1000            | 500            | `false`                           |
| 1000            | 995            | `false`                           |
| 1000            | 996            | `true` (remaining 4 <= threshold) |
| 0               | any            | `false` (was already exhausted)   |

## Manual Testing with Stripe

### Prerequisites

1. Install Stripe CLI: `brew install stripe/stripe-mock/stripe`
2. Login: `stripe login`
3. Start full dev stack: `cd rails_app && bin/dev --full`

### Test Matrix

| #   | Scenario                  | Stripe Event                        | Handler                                   |
| --- | ------------------------- | ----------------------------------- | ----------------------------------------- |
| 1   | New subscription (via UI) | `subscription.created`              | `PaySubscriptionCredits` callback         |
| 2   | Renewal (test clock)      | `invoice.paid` (subscription_cycle) | `RenewalHandler`                          |
| 3   | Plan upgrade              | `subscription.updated`              | `PlanChangeHandler`                       |
| 4   | Plan downgrade            | `subscription.updated`              | `PlanChangeHandler`                       |
| 5   | Yearly monthly reset      | N/A (cron)                          | `AnnualSubscriberMonthlyAllocationWorker` |
| 6   | Duplicate webhook         | Any                                 | Idempotency check                         |
| 7   | Non-credit events         | `subscription.updated`              | Ignored                                   |

### Using Stripe Test Clocks

Test clocks simulate time progression to trigger real webhook events without waiting:

1. Create a test clock: `stripe test_clocks create --frozen_time=$(date +%s)`
2. Create a customer attached to it: `stripe customers create --test_clock=clock_XXXXX`
3. Attach payment method and create subscription
4. Advance clock: `stripe test_clocks advance clock_XXXXX --frozen_time=$(date -v+1m +%s)`

See the [Stripe Test Clocks documentation](https://docs.stripe.com/billing/testing/test-clocks) for details.

### Verification Script

```bash
bundle exec rails runner "
  account = Account.first.reload
  puts \"Plan credits:  #{account.plan_credits}\"
  puts \"Pack credits:  #{account.pack_credits}\"
  puts \"Total credits: #{account.total_credits}\"
  puts ''
  account.credit_transactions.order(created_at: :desc).limit(5).each do |tx|
    puts \"#{tx.created_at.strftime('%m/%d %H:%M')} | #{tx.transaction_type.ljust(8)} | #{tx.reason.ljust(20)} | #{tx.amount.to_s.rjust(6)} | bal: #{tx.balance_after}\"
  end
"
```

## Key Test Files

| File                                                | Purpose                 |
| --------------------------------------------------- | ----------------------- |
| `rails_app/spec/models/credit_transaction_spec.rb`  | Transaction model tests |
| `rails_app/spec/services/credits/`                  | Service layer tests     |
| `rails_app/spec/workers/credits/`                   | Worker tests            |
| `rails_app/spec/integration/credits/`               | Integration tests       |
| `rails_app/spec/support/stripe/webhook_fixtures.rb` | Stripe event builders   |
| `rails_app/spec/support/stripe/test_examples.rb`    | Example test patterns   |
| `langgraph_app/app/core/billing/__tests__/`         | Langgraph billing tests |

## Related Docs

- [09-stripe-webhooks.md](./09-stripe-webhooks.md) - Webhook handler implementation
- [11-development-mode.md](./11-development-mode.md) - CREDITS_DISABLED for local development
- [06-credit-charging.md](./06-credit-charging.md) - ChargeRunWorker testing
