# Credit Allocation Manual Testing Runbook

This runbook provides step-by-step instructions for manually testing the credit allocation system against Stripe's sandbox environment.

---

## Prerequisites

### 1. Install Stripe CLI (one-time setup)

```bash
brew install stripe/stripe-mock/stripe

# Verify installation
stripe --version

# Login to Stripe (follow browser prompt)
stripe login
```

### 2. Verify Plans in Stripe Dashboard

Ensure your Stripe test mode has prices matching your Rails plans:
- `price_starter_monthly` → Starter Monthly (2000 credits)
- `price_growth_monthly` → Growth Monthly (5000 credits)
- `price_pro_monthly` → Pro Monthly (15000 credits)
- `price_growth_annual` → Growth Annual (5000 credits/month)

---

## Part 1: New Subscription (Initial Allocation)

This tests the `PaySubscriptionCredits` callback that fires on subscription creation.

### Step 1: Start full development stack

```bash
cd rails_app
bin/dev --full
```

This starts all services via `Procfile.full`:
- `web` — Rails server (port 3000)
- `vite` — Frontend dev server
- `langgraph` — AI backend (port 4000)
- `worker` — Sidekiq for async job processing
- `zhong` — Scheduler for daily reconciliation
- `stripe` — Webhook forwarding via `bin/stripe-listen`

### Step 2: Clear Sidekiq and restore clean snapshot

```bash
# Clear any pending Sidekiq jobs
bundle exec rails runner "
  Sidekiq::Queue.all.each(&:clear)
  Sidekiq::RetrySet.new.clear
  Sidekiq::DeadSet.new.clear
  puts 'Sidekiq cleared'
"

# Restore core_data snapshot (clean slate with plans, no subscriptions)
bundle exec rake db:snapshot:restore[core_data]
```

### Step 3: Verify baseline state

```bash
bundle exec rails runner "
  account = Account.first
  if account
    puts \"Account: #{account.name}\"
    puts \"Payment processor: #{account.payment_processor&.processor_id || 'None'}\"
    puts \"Plan credits: #{account.plan_credits}\"
    puts \"Credit transactions: #{account.credit_transactions.count}\"
  else
    puts 'No accounts found - will create via UI'
  end
"
```

**Expected**: 0 plan credits, 0 transactions (or no account yet).

### Step 4: Subscribe via UI

1. Open http://localhost:3000
2. Log in or create a new account
3. Navigate to **Settings → Billing**
4. Select a plan (e.g., **Growth Monthly** - 5000 credits)
5. Complete Stripe Checkout with test card:
   - Card: `4242 4242 4242 4242`
   - Expiry: Any future date (e.g., `12/34`)
   - CVC: Any 3 digits (e.g., `123`)

### Step 5: Watch terminal output

In the terminal running `bin/dev --full`, look for:
```
[stripe] Received event: customer.subscription.created
[worker] Credits::ResetPlanCreditsWorker performing...
```

### Step 6: Verify allocation

```bash
bundle exec rails runner "
  account = Account.first
  puts '=== Post-Subscription State ==='
  puts \"Plan credits:  #{account.plan_credits}\"
  puts \"Pack credits:  #{account.pack_credits}\"
  puts \"Total credits: #{account.total_credits}\"
  puts ''
  puts 'Transactions:'
  account.credit_transactions.order(:created_at).each do |tx|
    puts \"  #{tx.transaction_type.ljust(10)} | #{tx.reason.ljust(20)} | #{tx.amount.to_s.rjust(6)} | bal: #{tx.balance_after}\"
  end
  puts ''
  puts \"Subscription: #{account.payment_processor&.subscription&.processor_plan}\"
"
```

**Expected**:
- Plan credits: 5000 (for Growth plan)
- Single `allocate` transaction with reason `plan_renewal`

### Step 7: Test idempotency (duplicate webhook)

1. Go to https://dashboard.stripe.com/test/webhooks
2. Click on your local endpoint
3. Find the `customer.subscription.created` event
4. Click "Resend"

Verify no duplicate transactions:
```bash
bundle exec rails runner "puts \"Transaction count: #{Account.first.credit_transactions.count}\""
```

**Expected**: Still 1 transaction.

---

## Part 2: Subscription Renewal (Using Test Clocks)

[Test Clocks](https://docs.stripe.com/billing/testing/test-clocks) are a native Stripe sandbox feature that simulates time progression, triggering real webhook events without waiting.

### What Are Test Clocks?

- Create a "frozen time" environment in Stripe sandbox
- Attach customers to a test clock
- Advance the clock to trigger renewals, trial endings, etc.
- Stripe sends real webhooks (`invoice.paid` with `billing_reason: subscription_cycle`)

**Limitation**: Can only advance up to 2 billing intervals at a time (e.g., 2 months for monthly).

### Step 1: Create a test clock

```bash
stripe test_clocks create \
  --frozen_time=$(date +%s) \
  --name="Renewal Test $(date +%Y%m%d)"
```

Save the returned `id` (e.g., `clock_1MsKZG2eZvKYlo2C0SAMPLE`).

### Step 2: Create a customer attached to the test clock

```bash
stripe customers create \
  --test_clock=clock_XXXXX \
  --email="renewal-test-$(date +%s)@example.com" \
  --name="Renewal Test User"
```

Save the returned `id` (e.g., `cus_SAMPLE123`).

### Step 3: Attach payment method and create subscription

```bash
# Attach test card
stripe payment_methods attach pm_card_visa \
  --customer=cus_XXXXX

# Set as default payment method
stripe customers update cus_XXXXX \
  --invoice_settings[default_payment_method]=pm_card_visa

# Create subscription (use your actual price ID from Stripe Dashboard)
stripe subscriptions create \
  --customer=cus_XXXXX \
  --items[0][price]=price_growth_monthly
```

### Step 4: Link Stripe customer to Rails account

```bash
bundle exec rails runner "
  account = Account.first
  account.set_payment_processor(:stripe, allow_fake: false)
  account.payment_processor.update!(processor_id: 'cus_XXXXX')
  puts \"Linked account #{account.id} to Stripe customer cus_XXXXX\"
"
```

Watch terminal for webhook and verify initial allocation occurred.

### Step 5: Simulate credit usage

```bash
bundle exec rails runner "
  account = Account.first
  account.credit_transactions.create!(
    transaction_type: 'consume',
    credit_type: 'plan',
    reason: 'ai_generation',
    amount: -1000,
    balance_after: account.total_credits - 1000,
    plan_balance_after: account.plan_credits - 1000,
    pack_balance_after: account.pack_credits,
    reference_type: 'manual_test',
    reference_id: \"test_#{Time.now.to_i}\"
  )
  puts \"Credits after usage: #{account.reload.plan_credits}\"
"
```

**Expected**: 4000 credits remaining.

### Step 6: Advance test clock to trigger renewal

```bash
# Advance by 1 month (macOS date syntax)
stripe test_clocks advance clock_XXXXX \
  --frozen_time=$(date -v+1m +%s)

# Linux alternative:
# --frozen_time=$(date -d '+1 month' +%s)
```

Watch terminal for:
```
[stripe] Received event: invoice.paid
[worker] Credits::ResetPlanCreditsWorker performing...
```

### Step 7: Verify renewal allocation

```bash
bundle exec rails runner "
  account = Account.first.reload
  puts \"Plan credits: #{account.plan_credits}\"
  puts ''
  puts 'Recent transactions:'
  account.credit_transactions.order(created_at: :desc).limit(4).each do |tx|
    puts \"  #{tx.transaction_type.ljust(10)} | #{tx.reason.ljust(20)} | #{tx.amount.to_s.rjust(6)}\"
  end
"
```

**Expected**:
- Plan credits: 5000 (fresh allocation)
- Transactions: `allocate` (5000), `expire` (-4000), `consume` (-1000), `allocate` (5000)

---

## Part 3: Plan Upgrade

### Step 1: Ensure account has active subscription

Use account from Part 1 or Part 2, or create new subscription on Starter plan.

### Step 2: Consume some credits

```bash
bundle exec rails runner "
  account = Account.first
  if account.plan_credits > 500
    account.credit_transactions.create!(
      transaction_type: 'consume',
      credit_type: 'plan',
      reason: 'ai_generation',
      amount: -500,
      balance_after: account.total_credits - 500,
      plan_balance_after: account.plan_credits - 500,
      pack_balance_after: account.pack_credits,
      reference_type: 'manual_test',
      reference_id: \"test_#{Time.now.to_i}\"
    )
  end
  puts \"Credits: #{account.reload.plan_credits}\"
"
```

### Step 3: Upgrade via Stripe CLI

```bash
# Get subscription and item IDs
stripe subscriptions list --customer=cus_XXXXX --limit=1

# Update to higher plan
stripe subscriptions update sub_XXXXX \
  --items[0][id]=si_ITEM_ID \
  --items[0][price]=price_growth_monthly \
  --proration_behavior=create_prorations
```

### Step 4: Verify upgrade

Watch terminal for `customer.subscription.updated` webhook.

```bash
bundle exec rails runner "
  account = Account.first.reload
  puts \"Plan credits: #{account.plan_credits}\"
  tx = account.credit_transactions.where(reason: 'plan_upgrade').last
  puts \"Upgrade transaction: #{tx&.amount}\"
"
```

**Expected**: Full new plan credits (e.g., 5000 for Growth).

---

## Part 4: Plan Downgrade

### Step 1: Start with higher plan (Pro - 15000 credits)

Create subscription on Pro plan or upgrade existing subscription.

### Step 2: Consume significant credits

```bash
bundle exec rails runner "
  account = Account.first
  account.credit_transactions.create!(
    transaction_type: 'consume',
    credit_type: 'plan',
    reason: 'ai_generation',
    amount: -5000,
    balance_after: account.total_credits - 5000,
    plan_balance_after: account.plan_credits - 5000,
    pack_balance_after: account.pack_credits,
    reference_type: 'manual_test',
    reference_id: \"test_#{Time.now.to_i}\"
  )
  puts \"Credits after usage: #{account.reload.plan_credits}\"
"
```

### Step 3: Downgrade via Stripe CLI

```bash
stripe subscriptions update sub_XXXXX \
  --items[0][id]=si_ITEM_ID \
  --items[0][price]=price_growth_monthly \
  --proration_behavior=create_prorations
```

### Step 4: Verify downgrade

```bash
bundle exec rails runner "
  account = Account.first.reload
  puts \"Plan credits: #{account.plan_credits}\"
  tx = account.credit_transactions.where(reason: 'plan_downgrade').last
  if tx
    puts \"Downgrade metadata: #{tx.metadata}\"
  end
"
```

**Expected**: Pro-rated balance = new_plan_credits - usage_this_period, floored at 0.

---

## Part 5: Yearly Subscriber Monthly Reset

This tests `DailyReconciliationWorker` which resets yearly subscribers monthly.

### Step 1: Create yearly subscription

```bash
stripe subscriptions create \
  --customer=cus_XXXXX \
  --items[0][price]=price_growth_annual
```

### Step 2: Verify billing anchor day

```bash
bundle exec rails runner "
  sub = Account.first.payment_processor.subscription
  puts \"Billing anchor day: #{sub.current_period_start.day}\"
  puts \"Today: #{Date.current.day}\"
"
```

### Step 3: Run daily reconciliation

```bash
bundle exec rails runner "Credits::DailyReconciliationWorker.new.perform"
```

**Expected**:
- If today IS the anchor day: credits reset to full plan amount
- If today is NOT the anchor day: no change

---

## Cleanup

### Delete test clocks

```bash
stripe test_clocks list
stripe test_clocks delete clock_XXXXX
```

### Reset local database

```bash
bundle exec rake db:snapshot:restore[core_data]
```

---

## Quick Verification Script

Save this for easy verification during testing:

```bash
bundle exec rails runner "
  def verify(account)
    account.reload
    puts '=' * 60
    puts \"Account: #{account.id} (#{account.name})\"
    puts '=' * 60
    puts \"Plan credits:  #{account.plan_credits}\"
    puts \"Pack credits:  #{account.pack_credits}\"
    puts \"Total credits: #{account.total_credits}\"
    puts ''
    sub = account.payment_processor&.subscription
    if sub
      puts \"Subscription: #{sub.processor_plan} (#{sub.status})\"
      puts \"Period: #{sub.current_period_start&.to_date} to #{sub.current_period_end&.to_date}\"
    end
    puts ''
    puts 'Recent transactions:'
    puts '-' * 60
    account.credit_transactions.order(created_at: :desc).limit(5).each do |tx|
      puts \"#{tx.created_at.strftime('%m/%d %H:%M')} | #{tx.transaction_type.ljust(8)} | #{tx.reason.ljust(20)} | #{tx.amount.to_s.rjust(6)} | bal: #{tx.balance_after}\"
    end
    puts '=' * 60
  end
  verify(Account.first)
"
```

---

## Test Matrix Checklist

| # | Scenario | Stripe Event | Handler | Status |
|---|----------|--------------|---------|--------|
| 1 | New subscription (via UI) | `subscription.created` | `PaySubscriptionCredits` callback | [ ] |
| 2 | Renewal (test clock) | `invoice.paid` (subscription_cycle) | `RenewalHandler` | [ ] |
| 3 | Plan upgrade | `subscription.updated` | `PlanChangeHandler` | [ ] |
| 4 | Plan downgrade | `subscription.updated` | `PlanChangeHandler` | [ ] |
| 5 | Yearly monthly reset | N/A (cron) | `DailyReconciliationWorker` | [ ] |
| 6 | Duplicate webhook | Any | Idempotency check | [ ] |
| 7 | Non-credit events | `subscription.updated` | Ignored | [ ] |

---

## Troubleshooting

### Webhooks not arriving

Check that `stripe` process is running in Procfile.full output. Look for:
```
stripe  | Ready! Your webhook signing secret is whsec_...
```

If not connected:
```bash
stripe login
# Then restart bin/dev --full
```

### Customer not linked to account

```bash
bundle exec rails runner "
  account = Account.first
  puts \"Processor: #{account.payment_processor&.processor_id}\"
  # Link manually:
  # account.set_payment_processor(:stripe, allow_fake: false)
  # account.payment_processor.update!(processor_id: 'cus_XXXXX')
"
```

### Plan not found during webhook

Ensure `stripe_id` matches:
```bash
bundle exec rails runner "
  puts Plan.pluck(:name, :stripe_id).map { |n, s| \"#{n}: #{s}\" }
"
```

### Test clock stuck in "Advancing"

```bash
stripe test_clocks retrieve clock_XXXXX
# Wait for status: "ready"
```

---

## References

- [Stripe Test Clocks](https://docs.stripe.com/billing/testing/test-clocks)
- [Test Clocks API](https://docs.stripe.com/api/test_clocks)
- [Stripe CLI](https://docs.stripe.com/cli)
- [Webhook Events](https://docs.stripe.com/api/events/types)
