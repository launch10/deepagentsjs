# Scope 4 & 5: Credit Pack Purchase & Admin Gift Credits

## Overview

Implement credit pack purchasing (Scope 4) and admin gift credits (Scope 5) following red/green/refactor with integration tests focused on user outcomes.

## Current State

**Already exists:**
- `CreditPack` model (name, credits, price_cents, stripe_price_id, visible)
- `CreditPackPurchase` model (account_id, credit_pack_id, pay_charge_id, credits_purchased, credits_used, is_used)
- `CreditTransaction` model with `purchase` and `gift` transaction types
- `ChargeExtensions` pattern in `config/initializers/pay.rb`
- Factories for credit_pack and credit_pack_purchase
- Webhook fixtures in `spec/support/stripe/webhook_fixtures.rb`

**Missing:**
- `Account.has_many :credit_pack_purchases` association
- Service to allocate pack credits on purchase
- Webhook/callback handling to trigger allocation
- `CreditGift` model and service
- Integration tests

---

## Architecture Decisions

### 1. Separate PackAllocationService (not extend AllocationService)
- AllocationService handles complex plan logic (renewal, upgrade, downgrade, debt)
- Pack allocation is simpler: just add credits
- Cleaner separation of concerns

### 2. CreditGift as a separate model
- Explicit audit trail of admin actions
- Rich attributes (admin, reason, notes)
- Consistent pattern: CreditGift → CreditTransaction (like CreditPackPurchase → CreditTransaction)

### 3. Trigger pack allocation from ChargeExtensions
- `after_create` callback on Pay::Charge
- Check for `credit_pack_id` in charge metadata
- Enqueue async worker for allocation

---

## Test Patterns (from existing codebase)

### Setting up accounts with payment processor
```ruby
account = create(:account)
processor = account.set_payment_processor(:stripe, allow_fake: true)
processor.update!(processor_id: "cus_#{SecureRandom.hex(8)}")
```

### Creating Pay::Charge directly (fake_processor)
```ruby
charge = processor.charges.create!(
  processor_id: "ch_#{SecureRandom.hex(8)}",
  amount: credit_pack.price_cents,
  metadata: { "credit_pack_id" => credit_pack.id.to_s }
)
```

### Webhook fixtures available
- `charge_succeeded_event(charge_id:, customer_id:, amount:)`
- `checkout_session_completed_event(...)`

---

## Implementation Order

### Phase 1: Model & Association Setup

**1.1 Add Account associations**
```ruby
# app/models/account.rb
has_many :credit_pack_purchases, dependent: :destroy
has_many :credit_gifts, dependent: :destroy
```

**1.2 Create CreditGift model**

Migration:
```ruby
create_table :credit_gifts do |t|
  t.references :account, null: false, foreign_key: true
  t.references :admin, null: false, foreign_key: { to_table: :users }
  t.integer :amount, null: false
  t.string :reason, null: false
  t.text :notes
  t.timestamps
end
add_index :credit_gifts, [:account_id, :created_at]
```

Model:
```ruby
class CreditGift < ApplicationRecord
  REASONS = %w[customer_support promotional compensation beta_testing referral_bonus other].freeze

  belongs_to :account
  belongs_to :admin, class_name: "User"

  validates :amount, presence: true, numericality: { greater_than: 0 }
  validates :reason, presence: true, inclusion: { in: REASONS }
end
```

---

### Phase 2: Services (TDD)

**2.1 Credits::PackAllocationService**

Test first (`spec/services/credits/pack_allocation_service_spec.rb`):
```ruby
RSpec.describe Credits::PackAllocationService do
  let(:account) { create(:account) }
  let(:credit_pack) { create(:credit_pack, credits: 1000, price_cents: 4999) }

  before do
    processor = account.set_payment_processor(:stripe, allow_fake: true)
    processor.update!(processor_id: "cus_#{SecureRandom.hex(8)}")
  end

  describe "#allocate_pack!" do
    let(:charge) do
      account.payment_processor.charges.create!(
        processor_id: "ch_#{SecureRandom.hex(8)}",
        amount: credit_pack.price_cents
      )
    end

    it "creates CreditPackPurchase linked to Pay::Charge" do
      service.allocate_pack!(
        credit_pack: credit_pack,
        pay_charge: charge,
        idempotency_key: "pack_purchase:#{charge.id}"
      )

      purchase = account.credit_pack_purchases.last
      expect(purchase.pay_charge_id).to eq(charge.id)
      expect(purchase.credits_purchased).to eq(1000)
    end

    it "creates CreditTransaction with type: purchase, credit_type: pack" do
      # ...
    end

    it "increases account.pack_credits by pack amount" do
      expect { service.allocate_pack!(...) }
        .to change { account.reload.pack_credits }.by(1000)
    end

    it "is idempotent - duplicate calls do not double-allocate" do
      2.times { service.allocate_pack!(...) }
      expect(account.credit_pack_purchases.count).to eq(1)
    end

    it "preserves existing plan_credits balance" do
      # Setup account with plan credits first
      # ...
    end
  end
end
```

Service (`app/services/credits/pack_allocation_service.rb`):
```ruby
module Credits
  class PackAllocationService
    def initialize(account)
      @account = account
    end

    def allocate_pack!(credit_pack:, pay_charge:, idempotency_key:)
      Account.transaction do
        @account.lock!
        return if CreditTransaction.exists?(idempotency_key: idempotency_key)

        purchase = create_purchase_record!(credit_pack, pay_charge)
        create_pack_transaction!(credit_pack, purchase, idempotency_key)
      end
    end

    private

    def create_purchase_record!(credit_pack, pay_charge)
      @account.credit_pack_purchases.create!(
        credit_pack: credit_pack,
        pay_charge: pay_charge,
        credits_purchased: credit_pack.credits,
        price_cents: credit_pack.price_cents
      )
    end

    def create_pack_transaction!(credit_pack, purchase, idempotency_key)
      current = current_balances
      new_pack = current[:pack] + credit_pack.credits
      new_total = current[:total] + credit_pack.credits

      @account.credit_transactions.create!(
        transaction_type: "purchase",
        credit_type: "pack",
        reason: "pack_purchase",
        amount: credit_pack.credits,
        balance_after: new_total,
        plan_balance_after: current[:plan],
        pack_balance_after: new_pack,
        reference_type: "CreditPackPurchase",
        reference_id: purchase.id.to_s,
        idempotency_key: idempotency_key,
        metadata: {
          credit_pack_name: credit_pack.name,
          price_cents: credit_pack.price_cents,
          pay_charge_id: purchase.pay_charge_id
        }
      )
    end

    def current_balances
      {
        total: @account.total_credits,
        plan: @account.plan_credits,
        pack: @account.pack_credits
      }
    end
  end
end
```

**2.2 Credits::GiftService**

Test first (`spec/services/credits/gift_service_spec.rb`):
```ruby
RSpec.describe Credits::GiftService do
  let(:admin) { create(:user, admin: true) }
  let(:account) { create(:account) }
  let(:service) { described_class.new(account) }

  describe "#gift!" do
    it "creates CreditGift record with admin, amount, reason" do
      result = service.gift!(admin: admin, amount: 500, reason: "customer_support")

      expect(result).to be_a(CreditGift)
      expect(result.admin).to eq(admin)
      expect(result.amount).to eq(500)
      expect(result.reason).to eq("customer_support")
    end

    it "creates CreditTransaction with type: gift, credit_type: pack" do
      service.gift!(admin: admin, amount: 500, reason: "promotional")

      tx = account.credit_transactions.last
      expect(tx.transaction_type).to eq("gift")
      expect(tx.credit_type).to eq("pack")
    end

    it "increases account.pack_credits by gift amount" do
      expect { service.gift!(admin: admin, amount: 500, reason: "promotional") }
        .to change { account.reload.pack_credits }.by(500)
    end

    it "records admin_id and admin_email in transaction metadata" do
      service.gift!(admin: admin, amount: 500, reason: "promotional")

      tx = account.credit_transactions.last
      expect(tx.metadata["admin_id"]).to eq(admin.id)
      expect(tx.metadata["admin_email"]).to eq(admin.email)
    end
  end
end
```

Service (`app/services/credits/gift_service.rb`):
```ruby
module Credits
  class GiftService
    def initialize(account)
      @account = account
    end

    def gift!(admin:, amount:, reason:, notes: nil)
      Account.transaction do
        @account.lock!
        gift = create_gift_record!(admin, amount, reason, notes)
        create_gift_transaction!(gift, amount)
        gift
      end
    end

    private

    def create_gift_record!(admin, amount, reason, notes)
      CreditGift.create!(
        account: @account,
        admin: admin,
        amount: amount,
        reason: reason,
        notes: notes
      )
    end

    def create_gift_transaction!(gift, amount)
      current = current_balances
      new_pack = current[:pack] + amount
      new_total = current[:total] + amount

      @account.credit_transactions.create!(
        transaction_type: "gift",
        credit_type: "pack",
        reason: "gift",
        amount: amount,
        balance_after: new_total,
        plan_balance_after: current[:plan],
        pack_balance_after: new_pack,
        reference_type: "CreditGift",
        reference_id: gift.id.to_s,
        idempotency_key: "gift:#{gift.id}",
        metadata: {
          admin_id: gift.admin_id,
          admin_email: gift.admin.email,
          reason: gift.reason,
          notes: gift.notes
        }
      )
    end

    def current_balances
      {
        total: @account.total_credits,
        plan: @account.plan_credits,
        pack: @account.pack_credits
      }
    end
  end
end
```

---

### Phase 3: Worker & Webhook Integration

**3.1 AllocatePackCreditsWorker**

```ruby
# app/workers/credits/allocate_pack_credits_worker.rb
module Credits
  class AllocatePackCreditsWorker < ApplicationWorker
    sidekiq_options queue: :billing

    def perform(charge_id, credit_pack_id)
      charge = Pay::Charge.find(charge_id)
      credit_pack = CreditPack.find(credit_pack_id)
      account = charge.customer.owner
      return unless account.is_a?(Account)

      PackAllocationService.new(account).allocate_pack!(
        credit_pack: credit_pack,
        pay_charge: charge,
        idempotency_key: "pack_purchase:#{charge.id}"
      )
    end
  end
end
```

**3.2 Extend ChargeExtensions**

```ruby
# config/initializers/pay.rb - add to ChargeExtensions
module ChargeExtensions
  extend ActiveSupport::Concern

  included do
    has_prefix_id :ch
    after_create :complete_referral, if: -> { defined?(Refer) }
    after_create :handle_credit_pack_purchase  # NEW
  end

  def complete_referral
    customer.owner.owner.referral&.complete!
  end

  def handle_credit_pack_purchase
    credit_pack_id = metadata&.dig("credit_pack_id")
    return unless credit_pack_id.present?

    Credits::AllocatePackCreditsWorker.perform_async(id, credit_pack_id)
  end
end
```

---

### Phase 4: Integration Tests

**4.1 Pack Purchase E2E** (`spec/integration/credits/pack_purchase_spec.rb`)

```ruby
RSpec.describe "Credit Pack Purchase", type: :integration do
  include StripeWebhookFixtures

  let(:account) { create(:account) }
  let(:credit_pack) { create(:credit_pack, credits: 1000, price_cents: 4999) }

  before do
    processor = account.set_payment_processor(:stripe, allow_fake: true)
    processor.update!(processor_id: "cus_#{SecureRandom.hex(8)}")
  end

  around do |example|
    Sidekiq::Testing.inline! { example.run }
  end

  it "allocates pack credits when charge is created with credit_pack_id metadata" do
    account.payment_processor.charges.create!(
      processor_id: "ch_#{SecureRandom.hex(8)}",
      amount: credit_pack.price_cents,
      metadata: { "credit_pack_id" => credit_pack.id.to_s }
    )

    account.reload
    expect(account.pack_credits).to eq(1000)
    expect(account.total_credits).to eq(1000)
    expect(account.credit_pack_purchases.count).to eq(1)

    purchase = account.credit_pack_purchases.last
    expect(purchase.credits_purchased).to eq(1000)
  end

  it "is idempotent - duplicate worker calls do not double-allocate" do
    charge = account.payment_processor.charges.create!(
      processor_id: "ch_#{SecureRandom.hex(8)}",
      amount: credit_pack.price_cents,
      metadata: { "credit_pack_id" => credit_pack.id.to_s }
    )

    initial_credits = account.reload.pack_credits

    # Attempt duplicate allocation
    Credits::AllocatePackCreditsWorker.new.perform(charge.id, credit_pack.id)

    expect(account.reload.pack_credits).to eq(initial_credits)
    expect(account.credit_pack_purchases.count).to eq(1)
  end

  it "preserves pack credits across subscription renewal" do
    # Purchase pack first
    account.payment_processor.charges.create!(
      processor_id: "ch_#{SecureRandom.hex(8)}",
      amount: credit_pack.price_cents,
      metadata: { "credit_pack_id" => credit_pack.id.to_s }
    )
    expect(account.reload.pack_credits).to eq(1000)

    # Subscribe to plan
    plan = create(:plan, :growth_monthly)
    subscription = account.payment_processor.subscriptions.create!(
      processor_id: "sub_#{SecureRandom.hex(8)}",
      name: "default",
      processor_plan: plan.stripe_id,
      status: "active",
      current_period_start: Time.current,
      current_period_end: 1.month.from_now
    )

    # Simulate renewal
    travel 1.month do
      subscription.update!(
        current_period_start: Time.current,
        current_period_end: 1.month.from_now
      )

      event = invoice_paid_event(
        subscription_id: subscription.processor_id,
        customer_id: account.payment_processor.processor_id,
        billing_reason: "subscription_cycle"
      )
      Credits::RenewalHandler.new.call(event)

      account.reload
      expect(account.pack_credits).to eq(1000) # Preserved!
    end
  end
end
```

**4.2 Admin Gift E2E** (`spec/integration/credits/admin_gift_spec.rb`)

```ruby
RSpec.describe "Admin Gift Credits", type: :integration do
  let(:admin) { create(:user, admin: true) }
  let(:account) { create(:account) }

  it "admin can gift credits to account" do
    result = Credits::GiftService.new(account).gift!(
      admin: admin,
      amount: 500,
      reason: "customer_support",
      notes: "Compensation for service disruption"
    )

    expect(result).to be_a(CreditGift)
    expect(result.amount).to eq(500)
    expect(result.admin).to eq(admin)

    account.reload
    expect(account.pack_credits).to eq(500)
    expect(account.total_credits).to eq(500)

    transaction = account.credit_transactions.last
    expect(transaction.transaction_type).to eq("gift")
    expect(transaction.credit_type).to eq("pack")
    expect(transaction.reference_type).to eq("CreditGift")
    expect(transaction.metadata["admin_email"]).to eq(admin.email)
  end

  it "gifted credits are preserved across plan operations" do
    # Gift credits first
    Credits::GiftService.new(account).gift!(
      admin: admin,
      amount: 500,
      reason: "promotional"
    )
    expect(account.reload.pack_credits).to eq(500)

    # Subscribe to a plan
    processor = account.set_payment_processor(:stripe, allow_fake: true)
    processor.update!(processor_id: "cus_#{SecureRandom.hex(8)}")

    plan = create(:plan, :growth_monthly)
    processor.subscriptions.create!(
      processor_id: "sub_#{SecureRandom.hex(8)}",
      name: "default",
      processor_plan: plan.stripe_id,
      status: "active",
      current_period_start: Time.current,
      current_period_end: 1.month.from_now
    )

    account.reload
    expect(account.plan_credits).to be > 0
    expect(account.pack_credits).to eq(500) # Still preserved
  end
end
```

---

## Files to Create/Modify

### Create:
1. `db/migrate/xxx_create_credit_gifts.rb`
2. `app/models/credit_gift.rb`
3. `app/services/credits/pack_allocation_service.rb`
4. `app/services/credits/gift_service.rb`
5. `app/workers/credits/allocate_pack_credits_worker.rb`
6. `spec/models/credit_gift_spec.rb`
7. `spec/factories/credit_gifts.rb`
8. `spec/services/credits/pack_allocation_service_spec.rb`
9. `spec/services/credits/gift_service_spec.rb`
10. `spec/workers/credits/allocate_pack_credits_worker_spec.rb`
11. `spec/integration/credits/pack_purchase_spec.rb`
12. `spec/integration/credits/admin_gift_spec.rb`

### Modify:
1. `app/models/account.rb` - add associations
2. `config/initializers/pay.rb` - extend ChargeExtensions

---

## Verification

```bash
# Run all credit-related tests
bundle exec rspec spec/models/credit_gift_spec.rb
bundle exec rspec spec/services/credits/pack_allocation_service_spec.rb
bundle exec rspec spec/services/credits/gift_service_spec.rb
bundle exec rspec spec/workers/credits/allocate_pack_credits_worker_spec.rb
bundle exec rspec spec/integration/credits/pack_purchase_spec.rb
bundle exec rspec spec/integration/credits/admin_gift_spec.rb

# Run full credit suite
bundle exec rspec spec/integration/credits/
```
