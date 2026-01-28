# Scope 4: Credit Pack Purchase - Implementation Plan

## Overview

Implement one-time credit pack purchases using Stripe Checkout with **webhook-based fulfillment**. Users select from exactly 3 fixed-size packs (Small, Medium, Large), complete payment via Stripe, and credits are added to their account when the `checkout.session.completed` webhook fires.

**Dependencies:** Scope 2 (Rails Core Services) must be complete.

## Architecture: Why Webhooks Instead of Callbacks

### The Problem with ActiveRecord Callbacks

A naive implementation might use `after_commit` on `Pay::Charge`:

```ruby
# DON'T DO THIS
module ChargeExtensions
  included do
    after_commit :fulfill_credit_pack_purchase, on: :create
  end
end
```

This approach **infers intent from side effects**:
- A `Pay::Charge` being created doesn't mean it's a credit pack purchase
- We'd have to check metadata to determine if it's a pack purchase
- The charge could be created for many reasons (subscription payment, manual charge, etc.)

### What Stripe Actually Tells Us

Stripe sends explicit signals about what happened via `checkout.session.completed`:

```json
{
  "type": "checkout.session.completed",
  "data": {
    "object": {
      "id": "cs_123",
      "mode": "payment",           // One-time payment, not subscription
      "payment_status": "paid",    // Payment succeeded
      "metadata": {
        "credit_pack_id": "1",     // Our pack ID
        "account_id": "42"         // Our account ID
      }
    }
  }
}
```

With webhook handlers, we listen to **what Stripe explicitly tells us** instead of reverse-engineering it from database changes.

### The Flow

```
User clicks "Buy Small Pack"
  → Rails creates Checkout Session with metadata
    → User pays on Stripe
      → Stripe sends checkout.session.completed webhook
        → Pay receives webhook, fires delegator event
          → Our Credits::PackPurchaseHandler processes it
            → Creates CreditPackPurchase record
            → Creates CreditTransaction record
            → Updates account credit balances
```

---

## Pack Configuration (FIXED - No Customization)

| Pack | Credits | Price | Stripe Price ID Key |
|------|---------|-------|---------------------|
| Small | 500 | $25 | `stripe.credit_packs.small` |
| Medium | 1,250 | $50 | `stripe.credit_packs.medium` |
| Large | 3,000 | $100 | `stripe.credit_packs.large` |

---

## Implementation

### Files to Create

```
app/webhooks/credits/pack_purchase_handler.rb
app/controllers/credit_packs_controller.rb
db/seeds/credit_packs.rb
spec/webhooks/credits/pack_purchase_handler_spec.rb
spec/requests/credit_packs_spec.rb
spec/support/stripe/webhook_fixtures.rb  (add pack purchase fixtures)
```

### Files to Modify

```
config/initializers/pay.rb  (register webhook handler)
config/routes.rb            (add credit_packs routes)
```

---

## 1. Webhook Handler Registration (config/initializers/pay.rb)

Add to the existing `ActiveSupport.on_load(:pay)` block:

```ruby
ActiveSupport.on_load(:pay) do
  # Existing subscription handlers
  Pay::Webhooks.delegator.subscribe "stripe.invoice.paid", Credits::RenewalHandler.new
  Pay::Webhooks.delegator.subscribe "stripe.customer.subscription.updated", Credits::PlanChangeHandler.new

  # NEW: Credit pack purchase handler
  Pay::Webhooks.delegator.subscribe "stripe.checkout.session.completed", Credits::PackPurchaseHandler.new
end
```

---

## 2. Credits::PackPurchaseHandler

```ruby
# app/webhooks/credits/pack_purchase_handler.rb
module Credits
  # Handles checkout.session.completed webhooks for credit pack purchases.
  #
  # Only processes sessions where:
  # - mode == "payment" (one-time, not subscription)
  # - payment_status == "paid"
  # - metadata.credit_pack_id is present
  #
  # Usage:
  #   Pay::Webhooks.delegator.subscribe "stripe.checkout.session.completed", Credits::PackPurchaseHandler.new
  #
  class PackPurchaseHandler
    def call(event)
      session = event.data.object

      # Only process one-time payments (not subscription checkouts)
      return unless session.mode == "payment"
      return unless session.payment_status == "paid"

      # Only process credit pack purchases (has our metadata)
      credit_pack_id = session.metadata&.[]("credit_pack_id")
      account_id = session.metadata&.[]("account_id")
      return unless credit_pack_id.present? && account_id.present?

      # Idempotency: Skip if already fulfilled for this checkout session
      return if CreditPackPurchase.exists?(stripe_checkout_session_id: session.id)

      credit_pack = CreditPack.find_by(id: credit_pack_id)
      account = Account.find_by(id: account_id)

      return unless credit_pack && account

      fulfill_purchase!(
        account: account,
        credit_pack: credit_pack,
        checkout_session_id: session.id,
        stripe_event_id: event.id,
        amount_total: session.amount_total
      )
    end

    private

    def fulfill_purchase!(account:, credit_pack:, checkout_session_id:, stripe_event_id:, amount_total:)
      Account.transaction do
        account.lock!

        # Double-check idempotency inside transaction
        return if CreditPackPurchase.exists?(stripe_checkout_session_id: checkout_session_id)

        # Get current balances
        current_total = account.total_credits
        current_plan = account.plan_credits
        current_pack = account.pack_credits

        # Calculate new balances
        new_pack = current_pack + credit_pack.credits
        new_total = current_total + credit_pack.credits

        # 1. Create purchase record
        purchase = CreditPackPurchase.create!(
          account: account,
          credit_pack: credit_pack,
          stripe_checkout_session_id: checkout_session_id,
          credits_purchased: credit_pack.credits,
          credits_remaining: credit_pack.credits,
          price_cents: amount_total,
          status: "completed"
        )

        # 2. Create credit transaction
        CreditTransaction.create!(
          account: account,
          transaction_type: "purchase",
          credit_type: "pack",
          reason: "pack_purchase",
          amount: credit_pack.credits,
          balance_after: new_total,
          plan_balance_after: current_plan,
          pack_balance_after: new_pack,
          reference_type: "CreditPackPurchase",
          reference_id: purchase.id.to_s,
          idempotency_key: "pack_purchase:#{stripe_event_id}",
          metadata: {
            pack_name: credit_pack.name,
            pack_credits: credit_pack.credits,
            price_cents: amount_total,
            checkout_session_id: checkout_session_id
          }
        )

        # 3. Update cached account columns
        account.update_columns(
          pack_credits: new_pack,
          total_credits: new_total
        )
      end
    end
  end
end
```

---

## 3. CreditPacksController

```ruby
# app/controllers/credit_packs_controller.rb
class CreditPacksController < ApplicationController
  before_action :authenticate_user!
  before_action :require_account
  before_action :require_active_subscription, only: [:checkout]

  def index
    @credit_packs = CreditPack.visible.by_credits
  end

  def checkout
    @pack = CreditPack.visible.find(params[:id])

    payment_processor = current_account.set_payment_processor(:stripe)

    session = payment_processor.checkout(
      mode: :payment,
      line_items: @pack.stripe_price_id,
      metadata: {
        credit_pack_id: @pack.id.to_s,
        account_id: current_account.id.to_s
      },
      success_url: credit_packs_url(purchased: @pack.name.downcase),
      cancel_url: credit_packs_url
    )

    redirect_to session.url, allow_other_host: true
  end
end
```

### Routes

```ruby
# config/routes.rb
resources :credit_packs, only: [:index] do
  member do
    post :checkout
  end
end
```

---

## 4. CreditPackPurchase Model Update

Add the `stripe_checkout_session_id` column if not already present:

```ruby
# Migration (if needed)
add_column :credit_pack_purchases, :stripe_checkout_session_id, :string
add_index :credit_pack_purchases, :stripe_checkout_session_id, unique: true
```

Update model:

```ruby
# app/models/credit_pack_purchase.rb
class CreditPackPurchase < ApplicationRecord
  belongs_to :account
  belongs_to :credit_pack

  validates :stripe_checkout_session_id, uniqueness: true, allow_nil: true
  validates :credits_purchased, presence: true, numericality: { greater_than: 0 }
end
```

---

## 5. Webhook Test Fixtures

Add to `spec/support/stripe/webhook_fixtures.rb`:

```ruby
# ===========================================================================
# CREDIT PACK PURCHASE EVENTS
# ===========================================================================

# Successful credit pack purchase via Checkout
def checkout_session_pack_purchase_event(
  session_id: "cs_#{SecureRandom.hex(8)}",
  customer_id:,
  credit_pack_id:,
  account_id:,
  amount_total: 2500,
  price_id: "price_pack_small"
)
  build_stripe_event(
    type: "stripe.checkout.session.completed",
    data: {
      object: {
        id: session_id,
        object: "checkout.session",
        amount_total: amount_total,
        currency: "usd",
        customer: customer_id,
        mode: "payment",
        payment_intent: "pi_#{SecureRandom.hex(8)}",
        payment_status: "paid",
        status: "complete",
        subscription: nil,
        metadata: {
          credit_pack_id: credit_pack_id.to_s,
          account_id: account_id.to_s
        },
        line_items: {
          object: "list",
          data: [{
            id: "li_#{SecureRandom.hex(8)}",
            price: { id: price_id },
            quantity: 1
          }]
        }
      }
    }
  )
end

# Checkout session for subscription (should be ignored by pack handler)
def checkout_session_subscription_event(
  session_id: "cs_#{SecureRandom.hex(8)}",
  customer_id:,
  subscription_id:,
  amount_total: 2900
)
  build_stripe_event(
    type: "stripe.checkout.session.completed",
    data: {
      object: {
        id: session_id,
        object: "checkout.session",
        amount_total: amount_total,
        currency: "usd",
        customer: customer_id,
        mode: "subscription",
        payment_intent: nil,
        payment_status: "paid",
        status: "complete",
        subscription: subscription_id,
        metadata: {}
      }
    }
  )
end

# Checkout session with pending payment (async payment methods)
def checkout_session_payment_pending_event(
  session_id: "cs_#{SecureRandom.hex(8)}",
  customer_id:,
  credit_pack_id:,
  account_id:,
  amount_total: 2500
)
  build_stripe_event(
    type: "stripe.checkout.session.completed",
    data: {
      object: {
        id: session_id,
        object: "checkout.session",
        amount_total: amount_total,
        currency: "usd",
        customer: customer_id,
        mode: "payment",
        payment_intent: "pi_#{SecureRandom.hex(8)}",
        payment_status: "unpaid",  # Payment pending (e.g., bank transfer)
        status: "complete",
        subscription: nil,
        metadata: {
          credit_pack_id: credit_pack_id.to_s,
          account_id: account_id.to_s
        }
      }
    }
  )
end
```

---

## 6. Testing Strategy

### Test File: `spec/webhooks/credits/pack_purchase_handler_spec.rb`

```ruby
require "rails_helper"

RSpec.describe Credits::PackPurchaseHandler, type: :integration do
  include StripeWebhookFixtures

  let(:account) { create(:account, plan_credits: 3000, pack_credits: 0, total_credits: 3000) }
  let(:customer) { account.set_payment_processor(:stripe) }
  let(:small_pack) { CreditPack.find_by!(name: "Small") }

  def process_webhook(event)
    Pay::Webhooks.instrument(event: event, type: event.type)
  end

  describe "successful pack purchase" do
    it "allocates pack credits on checkout.session.completed" do
      event = checkout_session_pack_purchase_event(
        customer_id: customer.processor_id,
        credit_pack_id: small_pack.id,
        account_id: account.id,
        amount_total: 2500
      )

      expect { process_webhook(event) }
        .to change { account.reload.pack_credits }.from(0).to(500)
        .and change { account.total_credits }.from(3000).to(3500)
        .and change { CreditPackPurchase.count }.by(1)
        .and change { CreditTransaction.count }.by(1)
    end

    it "does not change plan credits" do
      event = checkout_session_pack_purchase_event(
        customer_id: customer.processor_id,
        credit_pack_id: small_pack.id,
        account_id: account.id
      )

      expect { process_webhook(event) }
        .not_to change { account.reload.plan_credits }
    end

    it "creates purchase record with correct attributes" do
      event = checkout_session_pack_purchase_event(
        session_id: "cs_test_123",
        customer_id: customer.processor_id,
        credit_pack_id: small_pack.id,
        account_id: account.id,
        amount_total: 2500
      )

      process_webhook(event)

      purchase = CreditPackPurchase.last
      expect(purchase.account).to eq(account)
      expect(purchase.credit_pack).to eq(small_pack)
      expect(purchase.stripe_checkout_session_id).to eq("cs_test_123")
      expect(purchase.credits_purchased).to eq(500)
      expect(purchase.price_cents).to eq(2500)
    end

    it "creates credit transaction with correct attributes" do
      event = checkout_session_pack_purchase_event(
        customer_id: customer.processor_id,
        credit_pack_id: small_pack.id,
        account_id: account.id
      )

      process_webhook(event)

      transaction = CreditTransaction.last
      expect(transaction.transaction_type).to eq("purchase")
      expect(transaction.credit_type).to eq("pack")
      expect(transaction.reason).to eq("pack_purchase")
      expect(transaction.amount).to eq(500)
      expect(transaction.balance_after).to eq(3500)
      expect(transaction.plan_balance_after).to eq(3000)
      expect(transaction.pack_balance_after).to eq(500)
    end
  end

  describe "idempotency" do
    it "handles duplicate webhooks (same checkout session)" do
      event = checkout_session_pack_purchase_event(
        session_id: "cs_duplicate_test",
        customer_id: customer.processor_id,
        credit_pack_id: small_pack.id,
        account_id: account.id
      )

      # Process twice
      process_webhook(event)
      process_webhook(event)

      # Credits allocated only once
      expect(account.reload.pack_credits).to eq(500)
      expect(CreditPackPurchase.where(stripe_checkout_session_id: "cs_duplicate_test").count).to eq(1)
    end

    it "handles concurrent webhook deliveries" do
      event = checkout_session_pack_purchase_event(
        customer_id: customer.processor_id,
        credit_pack_id: small_pack.id,
        account_id: account.id
      )

      # Simulate concurrent processing
      threads = 3.times.map do
        Thread.new { process_webhook(event) }
      end
      threads.each(&:join)

      expect(account.reload.pack_credits).to eq(500)
      expect(CreditPackPurchase.count).to eq(1)
    end
  end

  describe "events that should NOT allocate credits" do
    it "ignores subscription checkout sessions" do
      event = checkout_session_subscription_event(
        customer_id: customer.processor_id,
        subscription_id: "sub_123"
      )

      expect { process_webhook(event) }
        .not_to change { account.reload.pack_credits }
    end

    it "ignores checkout sessions without credit_pack_id metadata" do
      event = checkout_session_completed_event(
        customer_id: customer.processor_id,
        mode: "payment",
        metadata: { some_other_key: "value" }
      )

      expect { process_webhook(event) }
        .not_to change { CreditPackPurchase.count }
    end

    it "ignores checkout sessions with unpaid payment status" do
      event = checkout_session_payment_pending_event(
        customer_id: customer.processor_id,
        credit_pack_id: small_pack.id,
        account_id: account.id
      )

      expect { process_webhook(event) }
        .not_to change { account.reload.pack_credits }
    end

    it "ignores checkout sessions with invalid credit_pack_id" do
      event = checkout_session_pack_purchase_event(
        customer_id: customer.processor_id,
        credit_pack_id: 99999,
        account_id: account.id
      )

      expect { process_webhook(event) }
        .not_to change { CreditPackPurchase.count }
    end

    it "ignores checkout sessions with invalid account_id" do
      event = checkout_session_pack_purchase_event(
        customer_id: customer.processor_id,
        credit_pack_id: small_pack.id,
        account_id: 99999
      )

      expect { process_webhook(event) }
        .not_to change { CreditPackPurchase.count }
    end
  end

  describe "pack purchase with existing credits" do
    it "adds to existing pack credits" do
      account.update!(pack_credits: 200, total_credits: 3200)

      event = checkout_session_pack_purchase_event(
        customer_id: customer.processor_id,
        credit_pack_id: small_pack.id,
        account_id: account.id
      )

      process_webhook(event)

      expect(account.reload.pack_credits).to eq(700)  # 200 + 500
      expect(account.total_credits).to eq(3700)       # 3200 + 500
    end

    it "does not absorb negative plan balance" do
      # User has debt (negative plan credits)
      account.update!(plan_credits: -500, pack_credits: 0, total_credits: -500)

      event = checkout_session_pack_purchase_event(
        customer_id: customer.processor_id,
        credit_pack_id: small_pack.id,
        account_id: account.id
      )

      process_webhook(event)

      # Pack credits are added separately, debt unchanged
      expect(account.reload.plan_credits).to eq(-500)
      expect(account.pack_credits).to eq(500)
      expect(account.total_credits).to eq(0)  # -500 + 500
    end
  end

  describe "multiple pack sizes" do
    let(:medium_pack) { CreditPack.find_by!(name: "Medium") }
    let(:large_pack) { CreditPack.find_by!(name: "Large") }

    it "allocates correct credits for medium pack" do
      event = checkout_session_pack_purchase_event(
        customer_id: customer.processor_id,
        credit_pack_id: medium_pack.id,
        account_id: account.id,
        amount_total: 5000
      )

      process_webhook(event)

      expect(account.reload.pack_credits).to eq(1250)
    end

    it "allocates correct credits for large pack" do
      event = checkout_session_pack_purchase_event(
        customer_id: customer.processor_id,
        credit_pack_id: large_pack.id,
        account_id: account.id,
        amount_total: 10000
      )

      process_webhook(event)

      expect(account.reload.pack_credits).to eq(3000)
    end
  end
end
```

### Test File: `spec/requests/credit_packs_spec.rb`

| # | Scenario | Expected Outcome |
|---|----------|------------------|
| 1 | Index shows 3 visible packs | Returns Small, Medium, Large in order |
| 2 | Checkout redirects to Stripe | 302 redirect to checkout.stripe.com |
| 3 | Hidden pack not purchasable | 404 when checkout with invisible pack |
| 4 | Unauthenticated user cannot purchase | Redirect to login |
| 5 | User without active subscription | Redirect with "subscription required" message |

---

## 7. Seeds

```ruby
# db/seeds/credit_packs.rb
CreditPack.find_or_create_by!(name: "Small") do |pack|
  pack.credits = 500
  pack.price_cents = 2500
  pack.stripe_price_id = Rails.application.credentials.dig(:stripe, :credit_packs, :small)
  pack.visible = true
end

CreditPack.find_or_create_by!(name: "Medium") do |pack|
  pack.credits = 1250
  pack.price_cents = 5000
  pack.stripe_price_id = Rails.application.credentials.dig(:stripe, :credit_packs, :medium)
  pack.visible = true
end

CreditPack.find_or_create_by!(name: "Large") do |pack|
  pack.credits = 3000
  pack.price_cents = 10000
  pack.stripe_price_id = Rails.application.credentials.dig(:stripe, :credit_packs, :large)
  pack.visible = true
end
```

---

## 8. Local Testing with Stripe CLI

### Forward webhooks to local server:

```bash
stripe listen --forward-to localhost:3000/webhooks/stripe
```

### Trigger test events:

```bash
# Generic checkout completed (won't have our metadata)
stripe trigger checkout.session.completed

# For real testing, actually complete a checkout flow in the browser
# with test card 4242424242424242
```

### Manual verification:

1. Seed credit packs: `rails db:seed:credit_packs`
2. Visit `/credit_packs` → see 3 packs
3. Click "Buy" → redirects to Stripe Checkout
4. Complete with test card `4242424242424242`
5. Webhook fires → check `account.pack_credits` increased
6. Verify `CreditTransaction` and `CreditPackPurchase` records exist

---

## 9. Why NOT Use after_commit on Pay::Charge

The original plan used this approach:

```ruby
module ChargeExtensions
  included do
    after_commit :fulfill_credit_pack_purchase, on: :create
  end
end
```

**Problems with this approach:**

| Issue | Description |
|-------|-------------|
| Ambiguous intent | Any charge creation triggers the callback - subscriptions, manual charges, refund reversals |
| Missing context | `Pay::Charge` doesn't have our metadata until we dig into Stripe API |
| Race conditions | Charge might be created before checkout session metadata is synced |
| No explicit signal | We're inferring "this is a pack purchase" instead of being told |

**Benefits of webhook-based approach:**

| Benefit | Description |
|---------|-------------|
| Explicit intent | `checkout.session.completed` with `mode: "payment"` + our metadata = definitely a pack purchase |
| Authoritative data | Metadata comes directly from the checkout session we created |
| Event-native idempotency | `session.id` is unique across all checkout sessions |
| Testable | Mock events with explicit data, not database side effects |
| Consistent | Same pattern as subscription renewals and plan changes |

---

## 10. Comparison: Pack Purchase vs Subscription Events

| Aspect | Subscription Renewal | Pack Purchase |
|--------|---------------------|---------------|
| Webhook | `invoice.paid` | `checkout.session.completed` |
| Key discriminator | `billing_reason == "subscription_cycle"` | `mode == "payment"` + our metadata |
| Idempotency key | `event.id` | `session.id` |
| Credit type | `plan` | `pack` |
| Handler | `Credits::RenewalHandler` | `Credits::PackPurchaseHandler` |

Both use the same pattern: explicit webhook signals → dedicated handler → create transaction → update balances.

---

## Implementation Order

1. **Add webhook fixtures** - Enable testing first
2. **Create PackPurchaseHandler** - Core business logic
3. **Register handler in pay.rb** - Wire up webhook
4. **Write handler specs** - Verify all scenarios
5. **Add migration** (if needed) - `stripe_checkout_session_id` column
6. **Seed data** - Create CreditPack records
7. **Create controller** - Thin layer to initiate checkout
8. **Write request specs** - Integration tests for routes

---

## Stripe Setup (Manual)

Create in Stripe Dashboard (test mode):
1. Product: "Small Credit Pack" → Price: $25 (one-time)
2. Product: "Medium Credit Pack" → Price: $50 (one-time)
3. Product: "Large Credit Pack" → Price: $100 (one-time)

Add price IDs to credentials:
```yaml
stripe:
  credit_packs:
    small: price_xxx
    medium: price_yyy
    large: price_zzz
```

---

## Verification

### Unit Tests
```bash
bundle exec rspec spec/webhooks/credits/pack_purchase_handler_spec.rb
bundle exec rspec spec/requests/credit_packs_spec.rb
```

### Idempotency Test
```ruby
# In console after purchase:
session_id = CreditPackPurchase.last.stripe_checkout_session_id
# Try to manually process again - should be no-op
Credits::PackPurchaseHandler.new.call(mock_event_with_session_id(session_id))
# Verify no duplicate records
```

---

## Decision: Subscription Required

**Users MUST have an active subscription to purchase credit packs.**

Implementation: `before_action :require_active_subscription, only: [:checkout]` in controller.

---

## Decision: No Refund Handling (Yet)

Refunds will be handled manually for now. Future scope could add:
- `charge.refunded` webhook handler
- Deduct credits (or mark purchase as refunded)
- Handle partial refunds

This is out of scope for initial implementation.
