# Stripe Webhook Testing Strategy

## Overview

This document outlines our migration from ActiveRecord callbacks to Stripe webhook handlers for credit allocation, and the comprehensive testing strategy that supports this architecture.

## Why We're Migrating

### The Problem with ActiveRecord Callbacks

Our original implementation used `after_commit` callbacks on `Pay::Subscription`:

```ruby
module PaySubscriptionCredits
  included do
    after_commit :handle_subscription_created, on: :create
    after_commit :handle_subscription_updated, on: :update  # <- The problem
  end

  def handle_subscription_updated
    return unless renewal_or_plan_change?
    Credits::ResetPlanCreditsWorker.perform_async(id, previous_plan_id: previous_plan_id_for_change)
  end

  def renewal_or_plan_change?
    saved_change_to_current_period_start? || saved_change_to_processor_plan?
  end
end
```

This approach **infers intent from side effects**:

| What We Check | What We're Trying to Detect | The Gap |
|---------------|----------------------------|---------|
| `current_period_start` changed | Renewal payment succeeded | Can't distinguish: renewal vs admin manually adjusting dates vs billing anchor change |
| `processor_plan` changed | Plan upgrade/downgrade | Works, but misses `previous_attributes` context from Stripe |

A subscription can be updated for many reasons, but only some should trigger credit allocation:

| Event | Updates Subscription? | Should Allocate Credits? |
|-------|----------------------|-------------------------|
| Plan change | ✓ | Yes (upgrade/downgrade logic) |
| Renewal payment | ✓ | Yes (fresh allocation) |
| Quantity change | ✓ | No |
| Payment method change | ✓ | No |
| Metadata update | ✓ | No |
| Trial ending | ✓ | No |
| Pause/unpause | ✓ | No |
| Cancellation scheduled | ✓ | No |

### What Stripe Actually Tells Us

Stripe sends explicit signals about what happened:

**`invoice.paid` webhook includes `billing_reason`:**
```json
{
  "billing_reason": "subscription_cycle",  // ← Actual renewal
  // vs "subscription_create" (first invoice)
  // vs "subscription_update" (proration from plan change)
  // vs "manual" (admin created)
}
```

**`customer.subscription.updated` webhook includes `previous_attributes`:**
```json
{
  "previous_attributes": {
    "items": {
      "data": [{ "price": { "id": "price_old123" } }]
    }
  }
}
```

With webhook handlers, we listen to **what Stripe explicitly tells us** instead of reverse-engineering it from database changes.

### The Migration

**Before (Callback-based):**
```
Any database update to Pay::Subscription
  → after_commit fires
    → We check: did current_period_start or processor_plan change?
      → If yes, allocate credits (but WHY did it change? We don't know)
```

**After (Webhook-based):**
```
Stripe sends invoice.paid webhook
  → Pay processes it, syncs subscription
    → Our handler checks: billing_reason == "subscription_cycle"?
      → If yes, this is definitely a renewal → allocate credits

Stripe sends subscription.updated webhook
  → Pay processes it, syncs subscription
    → Our handler checks: did previous_attributes.items change?
      → If yes, this is definitely a plan change → handle upgrade/downgrade
```

## Webhook Handler Architecture

### Registration (config/initializers/pay.rb)

```ruby
ActiveSupport.on_load(:pay) do
  Pay::Webhooks.delegator.subscribe "stripe.invoice.paid", Credits::RenewalHandler.new
  Pay::Webhooks.delegator.subscribe "stripe.customer.subscription.updated", Credits::PlanChangeHandler.new
end
```

### Renewal Handler

```ruby
# app/webhooks/credits/renewal_handler.rb
module Credits
  class RenewalHandler
    def call(event)
      invoice = event.data.object

      # Only process subscription renewals
      return unless invoice.subscription
      return unless invoice.billing_reason == "subscription_cycle"

      subscription = Pay::Subscription.find_by(
        processor: :stripe,
        processor_id: invoice.subscription
      )
      return unless subscription&.active?

      # Use Stripe event ID for idempotency (globally unique)
      Credits::ResetPlanCreditsWorker.perform_async(
        subscription.id,
        { stripe_event_id: event.id }
      )
    end
  end
end
```

### Plan Change Handler

```ruby
# app/webhooks/credits/plan_change_handler.rb
module Credits
  class PlanChangeHandler
    def call(event)
      # Only if plan actually changed
      previous_items = event.data.previous_attributes&.dig("items")
      return unless previous_items

      subscription = Pay::Subscription.find_by(
        processor: :stripe,
        processor_id: event.data.object.id
      )
      return unless subscription&.active?

      old_price_id = previous_items.dig("data", 0, "price", "id")
      old_plan = Plan.find_by(stripe_id: old_price_id)
      return unless old_plan

      Credits::ResetPlanCreditsWorker.perform_async(
        subscription.id,
        { previous_plan_id: old_plan.id, stripe_event_id: event.id }
      )
    end
  end
end
```

## Testing Strategy

### Test Fixtures

We have comprehensive test fixtures in `spec/support/stripe/`:

| File | Purpose |
|------|---------|
| `webhook_fixtures.rb` | Ruby module with helper methods to build any Stripe webhook event |
| `test_examples.rb` | Example test patterns demonstrating proper usage |
| `webhook_events_comprehensive.json` | Raw JSON payloads for reference |

### Using the Fixtures

Include the module in your test:

```ruby
RSpec.describe "Credit Allocation", type: :integration do
  include StripeWebhookFixtures

  # Helper to process webhook through Pay's system
  def process_webhook(event)
    Pay::Webhooks.instrument(event: event, type: event.type)
  end
end
```

### Key Testing Patterns

#### 1. Renewal Detection via `billing_reason`

```ruby
# Renewal - allocates fresh credits
invoice_paid_event(
  subscription_id: subscription.processor_id,
  customer_id: customer.processor_id,
  billing_reason: "subscription_cycle"  # ← This is a renewal
)

# First payment - initial allocation (idempotent with subscription.created)
invoice_paid_event(
  subscription_id: subscription.processor_id,
  customer_id: customer.processor_id,
  billing_reason: "subscription_create"  # ← First payment
)

# Proration - NO credit reset
invoice_paid_event(
  subscription_id: subscription.processor_id,
  customer_id: customer.processor_id,
  billing_reason: "subscription_update"  # ← Proration from plan change
)
```

#### 2. Plan Change Detection via `previous_attributes`

```ruby
subscription_plan_changed_event(
  subscription_id: subscription.processor_id,
  customer_id: customer.processor_id,
  old_price_id: "price_starter_monthly",
  new_price_id: "price_growth_monthly",
  old_unit_amount: 1900,
  new_unit_amount: 2900,
  old_metadata: {"credits" => "2000", "tier" => "starter"},
  new_metadata: {"credits" => "5000", "tier" => "growth"}
)
```

#### 3. Ignoring Non-Credit Events

```ruby
# Quantity change - NO credit reallocation
subscription_quantity_changed_event(
  subscription_id: subscription.processor_id,
  customer_id: customer.processor_id,
  price_id: "price_growth_monthly",
  old_quantity: 1,
  new_quantity: 5
)

# Metadata change - NO credit reallocation
subscription_metadata_changed_event(
  subscription_id: subscription.processor_id,
  customer_id: customer.processor_id,
  old_metadata: {"account_id" => "123"},
  new_metadata: {"account_id" => "123", "internal_note" => "VIP"}
)

# Payment method change - NO credit reallocation
subscription_payment_method_changed_event(
  subscription_id: subscription.processor_id,
  customer_id: customer.processor_id,
  old_payment_method_id: "pm_old_card",
  new_payment_method_id: "pm_new_card"
)
```

## Test Scenarios

### New Subscription

```ruby
describe "new subscription" do
  it "allocates initial credits on subscription.created" do
    event = subscription_created_event(
      subscription_id: "sub_new_123",
      customer_id: customer.processor_id,
      price_id: plan.stripe_id,
      status: "active"
    )

    process_webhook(event)

    expect(account.reload.plan_credits).to eq(plan.plan_tier.credits)
  end

  it "does not allocate credits during trial" do
    event = subscription_created_event(
      subscription_id: "sub_trial_123",
      customer_id: customer.processor_id,
      status: "trialing",
      trial_end: 14.days.from_now
    )

    process_webhook(event)

    expect(account.reload.plan_credits).to eq(0)
  end
end
```

### Renewals

```ruby
describe "subscription renewal" do
  it "allocates fresh credits on invoice.paid with subscription_cycle" do
    subscription = create_subscription(plan: growth_plan)
    consume_credits(1000)  # Use some credits

    event = invoice_paid_event(
      subscription_id: subscription.processor_id,
      customer_id: customer.processor_id,
      billing_reason: "subscription_cycle"
    )

    process_webhook(event)

    expect(account.reload.plan_credits).to eq(growth_plan.plan_tier.credits)
  end

  it "does NOT allocate credits on proration invoice" do
    subscription = create_subscription(plan: growth_plan)
    initial_credits = account.plan_credits

    event = invoice_paid_event(
      subscription_id: subscription.processor_id,
      customer_id: customer.processor_id,
      billing_reason: "subscription_update"  # Proration
    )

    process_webhook(event)

    expect(account.reload.plan_credits).to eq(initial_credits)
  end
end
```

### Plan Changes

```ruby
describe "plan upgrade" do
  it "allocates full new plan credits on upgrade" do
    subscription = create_subscription(plan: starter_plan)
    consume_credits(500)

    event = subscription_plan_changed_event(
      subscription_id: subscription.processor_id,
      customer_id: customer.processor_id,
      old_price_id: starter_plan.stripe_id,
      new_price_id: growth_plan.stripe_id,
      old_unit_amount: starter_plan.amount,
      new_unit_amount: growth_plan.amount
    )

    process_webhook(event)

    expect(account.reload.plan_credits).to eq(growth_plan.plan_tier.credits)
  end
end

describe "plan downgrade" do
  it "pro-rates credits based on usage" do
    subscription = create_subscription(plan: pro_plan)  # 15000 credits
    consume_credits(5000)  # Used 5000

    event = subscription_plan_changed_event(
      subscription_id: subscription.processor_id,
      customer_id: customer.processor_id,
      old_price_id: pro_plan.stripe_id,
      new_price_id: growth_plan.stripe_id,  # 5000 credits
      old_unit_amount: pro_plan.amount,
      new_unit_amount: growth_plan.amount
    )

    process_webhook(event)

    # Pro-rated: new_plan_credits - usage = 5000 - 5000 = 0
    expect(account.reload.plan_credits).to eq(0)
  end
end
```

### Failed Payment Recovery

```ruby
describe "failed payment recovery" do
  it "does not allocate credits on failed payment" do
    subscription = create_subscription(status: "active")
    initial_credits = account.plan_credits

    event = invoice_payment_failed_event(
      subscription_id: subscription.processor_id,
      customer_id: customer.processor_id,
      amount: 2900,
      attempt_count: 1
    )

    process_webhook(event)

    expect(account.reload.plan_credits).to eq(initial_credits)
  end

  it "allocates credits when retry succeeds" do
    subscription = create_subscription(status: "past_due")

    event = invoice_paid_event(
      subscription_id: subscription.processor_id,
      customer_id: customer.processor_id,
      billing_reason: "subscription_cycle"
    )

    process_webhook(event)

    expect(account.reload.plan_credits).to eq(subscription.plan.plan_tier.credits)
  end
end
```

### Idempotency

```ruby
describe "idempotency" do
  it "handles duplicate invoice.paid events" do
    subscription = create_subscription

    event = invoice_paid_event(
      invoice_id: "in_same_invoice",
      subscription_id: subscription.processor_id,
      customer_id: customer.processor_id,
      billing_reason: "subscription_cycle"
    )

    # Process same event twice
    process_webhook(event)
    process_webhook(event)

    # Credits allocated only once
    expect(account.credit_transactions.where(reason: "plan_renewal").count).to eq(1)
  end

  it "handles out-of-order webhook delivery" do
    subscription = create_subscription

    # subscription.updated arrives before invoice.paid
    period_event = subscription_renewed_event(
      subscription_id: subscription.processor_id,
      customer_id: customer.processor_id,
      old_period_start: 1.month.ago,
      old_period_end: Time.current,
      new_period_start: Time.current,
      new_period_end: 1.month.from_now
    )

    invoice_event = invoice_paid_event(
      subscription_id: subscription.processor_id,
      customer_id: customer.processor_id,
      billing_reason: "subscription_cycle"
    )

    # Process in "wrong" order
    process_webhook(period_event)
    process_webhook(invoice_event)

    # Should still result in correct credit allocation
    expect(account.reload.plan_credits).to eq(subscription.plan.plan_tier.credits)
  end
end
```

### Full Lifecycle Test

```ruby
describe "complete subscription lifecycle" do
  it "handles create -> use -> renew -> upgrade -> cancel" do
    # 1. Create subscription
    create_event = subscription_created_event(
      subscription_id: "sub_lifecycle",
      customer_id: customer.processor_id,
      price_id: starter_plan.stripe_id,
      status: "active"
    )
    process_webhook(create_event)
    expect(account.reload.plan_credits).to eq(2000)

    # 2. First payment (idempotent)
    first_payment = invoice_paid_event(
      subscription_id: "sub_lifecycle",
      customer_id: customer.processor_id,
      billing_reason: "subscription_create"
    )
    process_webhook(first_payment)
    expect(account.reload.plan_credits).to eq(2000)  # Unchanged

    # 3. User consumes credits
    consume_credits(1500)
    expect(account.reload.plan_credits).to eq(500)

    # 4. Month passes, renewal
    renewal_payment = invoice_paid_event(
      subscription_id: "sub_lifecycle",
      customer_id: customer.processor_id,
      billing_reason: "subscription_cycle"
    )
    process_webhook(renewal_payment)
    expect(account.reload.plan_credits).to eq(2000)  # Fresh allocation

    # 5. User upgrades mid-cycle
    upgrade_event = subscription_plan_changed_event(
      subscription_id: "sub_lifecycle",
      customer_id: customer.processor_id,
      old_price_id: starter_plan.stripe_id,
      new_price_id: growth_plan.stripe_id,
      old_unit_amount: 1900,
      new_unit_amount: 2900
    )
    process_webhook(upgrade_event)
    expect(account.reload.plan_credits).to eq(5000)  # Full upgrade

    # 6. Proration invoice (no credit change)
    proration_payment = invoice_paid_event(
      subscription_id: "sub_lifecycle",
      customer_id: customer.processor_id,
      billing_reason: "subscription_update"
    )
    process_webhook(proration_payment)
    expect(account.reload.plan_credits).to eq(5000)  # Unchanged

    # 7. User schedules cancellation
    cancel_event = subscription_cancel_scheduled_event(
      subscription_id: "sub_lifecycle",
      customer_id: customer.processor_id,
      cancel_at: 1.month.from_now
    )
    process_webhook(cancel_event)
    expect(account.reload.plan_credits).to eq(5000)  # Keeps credits until end

    # 8. Subscription deleted
    delete_event = subscription_deleted_event(
      subscription_id: "sub_lifecycle",
      customer_id: customer.processor_id,
      ended_at: 1.month.from_now
    )
    process_webhook(delete_event)
    # Policy decision: expire or zero plan credits
  end
end
```

## Available Fixture Methods

### Subscription Events

| Method | Use Case |
|--------|----------|
| `subscription_created_event` | New subscription created |
| `subscription_renewed_event` | Period advanced after payment |
| `subscription_plan_changed_event` | Upgrade or downgrade |
| `subscription_status_changed_event` | Status transitions |
| `subscription_quantity_changed_event` | Seat count changes |
| `subscription_metadata_changed_event` | Metadata updates |
| `subscription_payment_method_changed_event` | Card changes |
| `subscription_paused_event` | Subscription paused |
| `subscription_resumed_event` | Subscription resumed |
| `subscription_cancel_scheduled_event` | Cancel at period end |
| `subscription_cancel_reversed_event` | Cancellation undone |
| `subscription_discount_applied_event` | Coupon applied |
| `subscription_deleted_event` | Subscription terminated |
| `subscription_trial_will_end_event` | Trial ending soon |
| `subscription_trial_ended_event` | Trial converted to paid |

### Invoice Events

| Method | Use Case |
|--------|----------|
| `invoice_paid_event` | Payment succeeded (with `billing_reason`) |
| `invoice_payment_failed_event` | Payment failed |
| `invoice_upcoming_event` | Advance notice before billing |
| `invoice_created_event` | Invoice created |
| `invoice_finalized_event` | Invoice ready for payment |
| `invoice_payment_action_required_event` | SCA/3DS required |

### Charge Events

| Method | Use Case |
|--------|----------|
| `charge_succeeded_event` | Payment captured |
| `charge_failed_event` | Payment declined |
| `charge_refunded_event` | Full or partial refund |

### Other Events

| Method | Use Case |
|--------|----------|
| `payment_method_attached_event` | Card added |
| `payment_method_detached_event` | Card removed |
| `customer_updated_event` | Customer details changed |
| `customer_deleted_event` | Customer deleted |
| `checkout_session_completed_event` | Checkout completed |

## Idempotency Strategy

### Event-Based Keys (Preferred)

Use Stripe event IDs for idempotency - they're globally unique and never collide:

```ruby
idempotency_key = "plan_credits:#{event.id}"  # evt_1234567890
```

### Period-Based Keys (Fallback)

When event ID isn't available (e.g., initial subscription via callback), use period start:

```ruby
idempotency_key = "plan_credits:#{subscription.id}:#{subscription.current_period_start.to_date.iso8601}"
```

**Why not `Date.current`?** Job at 11:59 PM fails, retries at 12:01 AM = different key = double allocation.

## Benefits of This Approach

1. **Explicit Intent**: `billing_reason == "subscription_cycle"` is unambiguous
2. **Authoritative Data**: `previous_attributes` from Stripe, not inferred
3. **Event-Native Idempotency**: Stripe event IDs are globally unique
4. **Testable**: Mock events with explicit data, not database side effects
5. **Aligned with Pay**: Uses Pay's intended extension point (`Pay::Webhooks.delegator`)

## Related Documents

- [credit_transactions.md](./credit_transactions.md) - Credit transaction data model and services
- [spec/support/stripe/webhook_fixtures.rb](../../spec/support/stripe/webhook_fixtures.rb) - Test fixture implementation
- [spec/support/stripe/test_examples.rb](../../spec/support/stripe/test_examples.rb) - Example test patterns
