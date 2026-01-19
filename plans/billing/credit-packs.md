# Credit Packs with Rollover - Implementation Plan

## Overview

Implement AI credit tracking with:
- **Subscription credits**: Reset monthly per plan allocation
- **Purchased credits**: Roll over indefinitely until used
- **Consumption order**: Subscription first, then purchased

## Architecture

### Rails API Approach

Langgraph calls Rails API to check/consume credits. Rails manages all credit logic and persistence.

```
┌─────────────────┐                  ┌─────────────────┐
│   Langgraph     │   Rails API      │     Rails       │
│                 │                  │                 │
│ withUsageTracking│──── POST ──────▶│ CreditsController│
│   middleware    │  /credits/consume│                 │
│                 │                  │ AccountConcerns │
│                 │◀─── JSON ───────│ ::Credits       │
│                 │   { balance }    │                 │
└─────────────────┘                  └────────┬────────┘
                                              │
                                     ┌────────▼────────┐
                                     │   PostgreSQL    │
                                     │                 │
                                     │ - accounts      │
                                     │ - credit_ledger │
                                     └─────────────────┘
```

---

## Data Model

### Option: Columns on Account + Append-Only Ledger

```ruby
# accounts table (running balances for quick lookup)
add_column :accounts, :subscription_credits, :integer, default: 0
add_column :accounts, :purchased_credits, :integer, default: 0

# credit_ledger table (append-only audit trail)
create_table :credit_ledger_entries do |t|
  t.references :account, null: false
  t.string :entry_type, null: false  # subscription_reset, purchase, consumption
  t.integer :amount, null: false     # positive = add, negative = consume
  t.string :credit_source            # subscription or purchased
  t.jsonb :metadata, default: {}     # thread_id, model, tokens, pack_id, etc.
  t.timestamps
end
```

### PlanLimit Extension

Add new limit type for AI credits:
```ruby
# Existing limit_types: requests_per_month, platform_subdomains
# New: ai_credits_per_month

PlanLimit.create!(plan: starter, limit_type: 'ai_credits_per_month', limit: TBD)
```

---

## Key Files to Modify/Create

### Rails Side

| File | Action |
|------|--------|
| `db/migrate/xxx_add_credits_to_accounts.rb` | Add subscription_credits, purchased_credits |
| `db/migrate/xxx_create_credit_ledger_entries.rb` | Append-only ledger |
| `app/models/credit_ledger_entry.rb` | New model |
| `app/models/concerns/account_concerns/credits.rb` | Credit logic concern |
| `app/models/credit_pack.rb` | Credit pack definitions |
| `app/controllers/credit_packs_controller.rb` | Purchase flow |
| `config/initializers/pay.rb` | Webhook handler for purchases |

### Langgraph Side

| File | Action |
|------|--------|
| `app/core/node/middleware/withUsageTracking.ts` | New middleware |
| `app/clients/rails.ts` | Add credit API methods |
| `app/core/errors/InsufficientCreditsError.ts` | New error class |

---

## Implementation Details

### 1. Credit Consumption (Rails)

```ruby
# app/models/concerns/account_concerns/credits.rb
module AccountConcerns::Credits
  extend ActiveSupport::Concern

  def available_credits
    subscription_credits + purchased_credits
  end

  def can_consume_credits?
    # Allow if not already negative (grace for going negative once)
    available_credits >= 0
  end

  def consume_credits!(amount, metadata = {})
    # Block if already negative - must purchase more
    return { success: false, error: :insufficient_credits } unless can_consume_credits?

    remaining = amount

    transaction do
      # Consume subscription credits first
      if subscription_credits > 0
        from_subscription = [subscription_credits, remaining].min
        self.subscription_credits -= from_subscription
        remaining -= from_subscription
        log_consumption(from_subscription, 'subscription', metadata) if from_subscription > 0
      end

      # Then purchased credits (may go negative)
      if remaining > 0
        self.purchased_credits -= remaining
        log_consumption(remaining, 'purchased', metadata)
      end

      save!
    end

    { success: true, new_balance: available_credits }
  end

  private

  def log_consumption(amount, source, metadata)
    credit_ledger_entries.create!(
      entry_type: 'consumption',
      amount: -amount,
      credit_source: source,
      metadata: metadata
    )
  end
end
```

### 1b. Credits API Endpoint (Rails)

```ruby
# app/controllers/api/v1/credits_controller.rb
module Api::V1
  class CreditsController < BaseController
    # POST /api/v1/credits/consume
    def consume
      result = current_account.consume_credits!(
        params[:amount].to_i,
        metadata: params[:metadata]&.permit!&.to_h || {}
      )

      if result[:success]
        render json: { success: true, balance: result[:new_balance] }
      else
        render json: { success: false, error: result[:error] }, status: :payment_required
      end
    end

    # GET /api/v1/credits/balance
    def balance
      render json: {
        available: current_account.available_credits,
        subscription: current_account.subscription_credits,
        purchased: current_account.purchased_credits,
        can_consume: current_account.can_consume_credits?
      }
    end
  end
end
```

### 2. Usage Tracking Middleware (Langgraph)

```typescript
// app/core/node/middleware/withUsageTracking.ts
import { getNodeContext } from './withContext';
import { RailsClient } from '@/clients/rails';

// Cost per 1K tokens (from app/core/llm/types.ts)
const MODEL_COSTS = {
  'claude-sonnet': { input: 3.00, output: 15.00 },
  'claude-haiku': { input: 1.00, output: 5.00 },
  'gpt-5': { input: 1.25, output: 10.00 },
  'gpt-5-mini': { input: 0.25, output: 2.00 },
  // ... etc
};

function calculateCredits(usage: TokenUsage): number {
  const costs = MODEL_COSTS[usage.model] || MODEL_COSTS['claude-sonnet'];

  // Calculate actual cost in dollars
  const inputCost = (usage.input_tokens / 1000) * costs.input;
  const outputCost = (usage.output_tokens / 1000) * costs.output;
  const totalCost = inputCost + outputCost;

  // 100 credits = $1 user cost = $0.50 actual cost
  // So: credits = actualCost * 2 * 100 = actualCost * 200
  return Math.ceil(totalCost * 200);
}

export const withUsageTracking = middlewareFactory<UsageTrackingConfig>({
  name: 'withUsageTracking',
  wrapper: (config, node) => async (state, nodeConfig) => {
    // Check credits BEFORE making LLM call
    if (state.accountId) {
      const canConsume = await RailsClient.canConsumeCredits(state.accountId);
      if (!canConsume) {
        throw new InsufficientCreditsError('Account has insufficient credits');
      }
    }

    const result = await node(state, nodeConfig);

    // Extract usage from last AI message
    const lastMessage = state.messages[state.messages.length - 1];
    const usage = lastMessage?.response_metadata?.usage;

    if (usage && state.accountId) {
      const credits = calculateCredits(usage);

      // Call Rails API to consume credits
      await RailsClient.consumeCredits(state.accountId, credits, {
        threadId: state.threadId,
        nodeContext: getNodeContext(),
        inputTokens: usage.input_tokens,
        outputTokens: usage.output_tokens,
        model: usage.model,
      });
    }

    return result;
  }
});
```

```typescript
// app/clients/rails.ts (add to existing client)
export class RailsClient {
  static async canConsumeCredits(accountId: string): Promise<boolean> {
    const response = await this.get(`/api/v1/accounts/${accountId}/credits/balance`);
    return response.can_consume;
  }

  static async consumeCredits(
    accountId: string,
    amount: number,
    metadata: Record<string, any>
  ): Promise<{ success: boolean; balance?: number; error?: string }> {
    return this.post(`/api/v1/accounts/${accountId}/credits/consume`, {
      amount,
      metadata
    });
  }
}
```

### 3. Credit Pack Purchase Flow

```ruby
# app/controllers/credit_packs_controller.rb
class CreditPacksController < ApplicationController
  def index
    @credit_packs = CreditPack.all
  end

  def checkout
    @pack = CreditPack.find(params[:id])
    payment_processor = current_account.set_payment_processor(:stripe)

    @checkout_session = payment_processor.checkout(
      mode: :payment,
      line_items: @pack.stripe_price_id,
      return_url: checkout_return_url(return_to: credit_packs_path),
      metadata: { credit_pack_id: @pack.id, account_id: current_account.id }
    )
  end
end

# config/initializers/pay.rb (add to existing)
Pay::Charge.include CreditPackPurchaseHandler

module CreditPackPurchaseHandler
  extend ActiveSupport::Concern

  included do
    after_create :handle_credit_pack_purchase
  end

  def handle_credit_pack_purchase
    return unless metadata['credit_pack_id'].present?

    pack = CreditPack.find(metadata['credit_pack_id'])
    account = Account.find(metadata['account_id'])

    account.add_purchased_credits!(pack.credits, charge: self)
  end
end
```

### 4. Monthly Reset

```ruby
# Via Zhong job or Stripe subscription webhook
class CreditResetJob
  def perform(account_id)
    account = Account.find(account_id)
    monthly_allocation = account.plan&.ai_credits_per_month || 0

    account.reset_subscription_credits!(monthly_allocation)
  end
end

# In Account concern:
def reset_subscription_credits!(amount)
  credit_ledger_entries.create!(
    entry_type: 'subscription_reset',
    amount: amount,
    credit_source: 'subscription',
    metadata: { previous_balance: subscription_credits }
  )
  update!(subscription_credits: amount)
end
```

---

## Implementation Phases

### Phase 1: Data Model & API (Rails)
1. Migration: Add `subscription_credits`, `purchased_credits` to accounts
2. Migration: Create `credit_ledger_entries` table
3. Create `CreditLedgerEntry` model
4. Create `AccountConcerns::Credits` concern
5. Create `Api::V1::CreditsController` with `balance` and `consume` endpoints
6. Add routes for credits API

### Phase 2: Usage Tracking (Langgraph)
7. Add `RailsClient.canConsumeCredits` and `consumeCredits` methods
8. Create `withUsageTracking` middleware with cost calculation
9. Create `InsufficientCreditsError` class
10. Apply middleware to LLM-calling nodes (brainstorm, ads, website agents)

### Phase 3: Credit Pack Purchases (Rails)
11. Create `CreditPack` model with pack definitions (400/$25, 1000/$50, 2500/$100)
12. Create Stripe products/prices for packs
13. Create `CreditPacksController` with checkout flow
14. Add webhook handler in Pay initializer for `checkout.session.completed`

### Phase 4: Monthly Reset (TBD - after plan allocations defined)
15. Add Zhong job or Stripe webhook handler for reset
16. Test reset doesn't affect purchased credits

### Phase 5: UI (Later)
17. Credits display in header/settings
18. Purchase UI in Settings > Billing
19. Low-credit warning modal

---

## Verification

### Unit Tests
- `Account#consume_credits!` with various scenarios
- `Account#available_credits` calculation
- Ledger entry creation

### Integration Tests
- Credit pack purchase flow end-to-end
- Langgraph middleware writes to ledger

### Manual Testing
- Purchase credits via Stripe test mode
- Trigger LLM calls, verify credits deducted
- Verify monthly reset preserves purchased credits

---

## Design Decisions

1. **Token → Credit conversion**: Cost-based
   - 100 credits = $1 user cost = $0.50 actual LLM cost
   - Track actual usage cost, multiply by 2 for user credits
   - Use existing cost data per model (Sonnet, Haiku, etc.)

2. **Zero credits behavior**: Allow negative ONCE
   - If `available_credits >= 0`: allow request (may go negative)
   - If `available_credits < 0`: block request, require purchase
   - Prevents abuse while giving grace for mid-session depletion

3. **Balance updates**: Rails API call
   - Langgraph calls Rails API endpoint to consume credits
   - Better separation of concerns
   - Rails handles subscription vs purchased logic
