# Credit Packs & Centralized Credits System

## Overview

Implement a centralized credits system that:

1. Grants **monthly plan credits** on billing cycle (reset each period, don't rollover)
2. Supports **one-off credit pack purchases** (rollover indefinitely until used)
3. Shows users a single unified "credits remaining" number
4. Handles plan upgrades/downgrades appropriately

## Architecture Decisions

| Decision                 | Choice                                                       | Rationale                               |
| ------------------------ | ------------------------------------------------------------ | --------------------------------------- |
| Credit storage           | Two columns on Account (`plan_credits`, `purchased_credits`) | Fast reads, clear distinction           |
| Billing cycle detection  | Stripe `invoice.paid` webhook + daily safety net job         | Most reliable for subscription renewals |
| Credit consumption order | Plan credits first, then purchased                           | Plan credits expire anyway              |
| Upgrade handling         | Grant prorated additional credits immediately                | User paid for them                      |
| Downgrade handling       | Keep current credits until next cycle                        | Better UX, Stripe prorates payment      |

## Data Model

### 1. Add Credits to Account Table

```ruby
# Migration: add_credits_to_accounts
add_column :accounts, :plan_credits, :bigint, default: 0, null: false
add_column :accounts, :purchased_credits, :bigint, default: 0, null: false
add_column :accounts, :plan_credits_reset_at, :datetime
```

### 2. CreditPack Model (Product Catalog)

```ruby
# Table: credit_packs
create_table :credit_packs do |t|
  t.string :name, null: false
  t.integer :credits, null: false
  t.integer :amount, null: false  # cents
  t.string :currency, default: 'usd'
  t.string :stripe_price_id
  t.boolean :visible, default: true
  t.timestamps
end
```

### 3. CreditTransaction Model (Source of Truth + Audit Log)

```ruby
# Table: credit_transactions
create_table :credit_transactions do |t|
  t.references :account, null: false, foreign_key: true
  t.references :credit_pack, foreign_key: true
  t.string :transaction_type, null: false  # grant, consume, expire, refund, adjustment
  t.string :credit_type, null: false       # plan, purchased
  t.string :reason, null: false            # monthly_renewal, purchase, gift, ai_generation, page_generation, expire, admin_adjustment
  t.bigint :amount, null: false            # positive=grant, negative=consume
  t.bigint :balance_after, null: false     # point-in-time snapshot - source of truth
  t.string :description                    # optional admin notes
  t.string :reference_type                 # polymorphic (Pay::Charge, Pay::Subscription)
  t.bigint :reference_id
  t.jsonb :metadata, default: {}
  t.timestamps

  t.index [:account_id, :created_at]
  t.index [:reference_type, :reference_id], unique: true, where: "reference_id IS NOT NULL"
end
```

**Example transaction flow:**

```
date         | reason           | type    | credit_type | amount | balance_after
-------------|------------------|---------|-------------|--------|---------------
2025-10-01   | monthly_renewal  | grant   | plan        | +500   | 500
2025-10-01   | ai_generation    | consume | plan        | -10    | 490
2025-11-01   | expire           | expire  | plan        | -490   | 0
2025-11-01   | monthly_renewal  | grant   | plan        | +500   | 500
2025-11-01   | purchase         | grant   | purchased   | +500   | 1000
2025-11-02   | ai_generation    | consume | plan        | -10    | 990
```

**Design: Hybrid Source of Truth + Cache**

- **Transaction log is authoritative** - `balance_after` is the source of truth
- **Cached balance on Account** - For fast reads during high-frequency checks
- **Atomic updates** - Transaction creation + Account cache update in same DB transaction
- **Reconciliation** - Periodic job verifies cache matches `SELECT balance_after FROM credit_transactions WHERE account_id = ? ORDER BY created_at DESC LIMIT 1`

**Linking to Langgraph Messages:**

Messages are stored as JSONB blobs in Langgraph's `checkpoints` table (not individual rows). The linkage chain:

```
checkpoints.thread_id → Chat.thread_id → Project → Account
```

For credit transactions, use:

- **`reference_type: "Chat"`** - Links to the conversation (Rails model)
- **`metadata` JSONB** - Stores granular details:
  - `run_id`: Langgraph run ID for specific execution
  - `graph`: Which graph (brainstorm, website, ads)
  - `message_count`: Messages in this charge (for batched billing)
  - `checkpoint_id`: Optional, for audit drill-down

Example transaction for AI generation:

```ruby
CreditTransaction.create!(
  account: account,
  transaction_type: "consume",
  credit_type: "plan",
  reason: "ai_generation",
  amount: -10,
  balance_after: 490,
  reference: chat,  # Chat model has thread_id linking to Langgraph
  metadata: { run_id: "abc123", graph: "brainstorm", message_count: 1 }
)
```

### 4. Extend PlanLimit

Add `monthly_credits` as a new `limit_type` value (no schema change needed):

```ruby
PlanLimit.create(plan: starter_plan, limit_type: "monthly_credits", limit: 100)
PlanLimit.create(plan: pro_plan, limit_type: "monthly_credits", limit: 500)
```

## Credit Deduction Architecture

**Deduction happens in Langgraph at execution time** - more accurate billing, only charges for successful generations.

**Existing Pattern**: Langgraph already calls Rails via typed API services (`BrainstormAPIService`, `CampaignAPIService`, etc.) using JWT + HMAC authentication.

**New Flow:**

```
User sends message → Rails → Langgraph
                              ↓
                         AI executes
                              ↓
                    AccountCreditsAPIService.deductCredits()
                              ↓
                         Rails API
                              ↓
                    CreditTransaction created
                              ↓
                    Response to Langgraph
```

**New Files (Langgraph side):**

- `shared/lib/api/services/accountCreditsAPIService.ts` - API client for credits

**New Files (Rails side):**

- `app/controllers/api/v1/account_credits_controller.rb` - Deduction endpoint
- Update OpenAPI schema generation

## Implementation Phases

### Phase 1: Database & Models

**Files to create:**

- `db/migrate/XXXX_add_credits_to_accounts.rb`
- `db/migrate/XXXX_create_credit_packs.rb`
- `db/migrate/XXXX_create_credit_transactions.rb`
- `app/models/credit_pack.rb`
- `app/models/credit_transaction.rb`
- `app/models/concerns/account_concerns/credits.rb`

**Files to modify:**

- `app/models/account.rb` - Include Credits concern
- `spec/snapshot_builders/core/plans.rb` - Add `monthly_credits` to plan limits

### Phase 2: Credit Operations

**Credits Concern** (`app/models/concerns/account_concerns/credits.rb`):

- `total_credits` - Returns `plan_credits + purchased_credits`
- `has_credits?(amount)` - Check if sufficient credits
- `deduct_credits!(amount, description:)` - Atomic deduction (plan first, then purchased)
- `grant_plan_credits!(amount)` - Reset and grant plan credits
- `grant_purchased_credits!(amount, credit_pack:, charge:)` - Add purchased credits

Key: Use `with_lock` for atomic operations (follows `AccountRequestCount` pattern).

### Phase 3: Stripe Integration for Credit Packs

**Files to create:**

- `app/controllers/credit_packs_controller.rb`
- `app/views/credit_packs/index.html.erb`
- `app/views/credit_packs/new.html.erb`
- `app/workers/credits/grant_purchased_credits_worker.rb`

**Files to modify:**

- `config/initializers/pay.rb` - Extend `ChargeExtensions` with `fulfill_credit_pack_purchase`
- `config/routes/billing.rb` - Add credit_packs routes

**Purchase Flow:**

1. User visits `/credit_packs` and selects a pack
2. Controller creates Stripe Checkout Session (mode: "payment") with metadata
3. User completes payment
4. Pay gem creates `Pay::Charge` record
5. `ChargeExtensions#fulfill_credit_pack_purchase` callback fires
6. Worker grants credits with idempotency check

### Phase 4: Billing Cycle Credit Refresh

**Files to create:**

- `app/workers/credits/refresh_plan_credits_worker.rb`
- `app/workers/credits/refresh_safety_net_worker.rb`
- `app/workers/credits/handle_plan_change_worker.rb`

**Files to modify:**

- `config/initializers/pay.rb`:
  - Add `Pay::Webhooks.subscribe "stripe.invoice.paid"` handler
  - Extend `SubscriptionExtensions` with `after_update :detect_plan_change`
- `schedule.rb` - Add daily safety net job

**Billing Cycle Flow:**

1. Stripe charges subscription → sends `invoice.paid` webhook
2. Pay gem processes webhook, updates `Pay::Subscription.current_period_start`
3. Custom handler triggers `RefreshPlanCreditsWorker`
4. Worker: expire old plan credits, grant new credits based on plan
5. Daily safety net catches any missed webhooks

### Phase 5: Plan Change Handling

**Upgrade:**

1. Detect via `saved_change_to_processor_plan?` on `Pay::Subscription`
2. Calculate prorated additional credits: `(new_limit - old_limit) * (days_remaining / total_days)`
3. Add to `plan_credits`

**Downgrade:**

1. Log the downgrade
2. Keep current credits until next billing cycle
3. Next cycle grants the new (lower) amount

### Phase 6: Langgraph Credit Deduction

**Files to create (shared):**

- `shared/lib/api/services/accountCreditsAPIService.ts`

**Files to modify (Langgraph):**

- `langgraph_app/app/nodes/` - Add credit deduction calls to AI execution nodes
- `shared/lib/api/services/index.ts` - Export new service

**Files to modify (Rails):**

- `app/controllers/api/v1/account_credits_controller.rb` - Add `deduct` action
- Regenerate OpenAPI schema

**Deduction Points in Langgraph:**

- Brainstorm graph: After successful AI response
- Website graph: After page generation
- Ads graph: After ad copy generation

**API Endpoint:**

```
POST /api/v1/account_credits/deduct
{
  "amount": 10,
  "reason": "ai_generation",
  "chat_id": "chat_abc123",
  "metadata": { "graph": "brainstorm", "run_id": "xyz" }
}
```

**Response:**

```json
{
  "success": true,
  "balance": { "total": 490, "plan": 490, "purchased": 0 }
}
```

### Phase 7: Frontend Integration

**Files to create:**

- `app/controllers/api/v1/credits_controller.rb` - Read-only balance/history
- React components for credit display and purchase UI

**API Endpoints:**

- `GET /api/v1/credits` - Returns balance breakdown
- `GET /api/v1/credits/transactions` - Returns transaction history

## Critical Files Reference

| File                                                    | Purpose                                  |
| ------------------------------------------------------- | ---------------------------------------- |
| `rails_app/config/initializers/pay.rb`                  | Extend Pay::Charge and Pay::Subscription |
| `rails_app/app/models/account.rb`                       | Add Credits concern                      |
| `rails_app/app/models/account_request_count.rb`         | Pattern for `with_lock` atomic ops       |
| `rails_app/app/controllers/subscriptions_controller.rb` | Pattern for Stripe Checkout              |
| `rails_app/spec/snapshot_builders/core/plans.rb`        | Seed plan limits                         |
| `shared/lib/api/railsApiBase.ts`                        | Base class for API services              |
| `shared/lib/api/services/`                              | Existing API service patterns            |
| `langgraph_app/app/nodes/core/`                         | Node patterns for credit deduction       |

## Verification Plan

### Unit Tests

- `CreditPack` model validations and scopes
- `CreditTransaction` creation and audit trail
- `Account#deduct_credits!` atomic behavior, correct ordering
- `Account#grant_plan_credits!` reset behavior

### Integration Tests

- Credit pack purchase flow end-to-end
- Plan upgrade grants additional credits
- Billing cycle reset clears plan credits and grants new
- Purchased credits persist across billing cycles

### Manual Testing

1. Create test credit packs in Stripe Dashboard
2. Purchase a credit pack, verify credits added
3. Use credits, verify deduction order (plan first)
4. Wait for/simulate billing cycle, verify plan credits reset
5. Upgrade plan mid-cycle, verify prorated credit grant

## Stripe Setup Required

1. Create Stripe Products for credit packs in Dashboard
2. Create Prices for each pack tier
3. Add Price IDs to Rails credentials:

```yaml
stripe:
  credit_packs:
    small: price_xxx
    medium: price_yyy
    large: price_zzz
```

## Confirmed Requirements

- **Credits are for AI generations only** - Page views/traffic continue to use existing `requests_per_month` limits
- **Plan credits consumed first** - Since they expire at billing cycle, use them before purchased credits
- **Two parallel systems**: Credits (AI) + Request Limits (traffic) coexist
- **1 credit = $0.01 (1 cent) of AI spend** - Credits are directly tied to actual AI costs

## Credit Pricing Model

### Conversion Formula

```
credits_to_deduct = ai_cost_in_dollars * 100
```

### Example Costs

| AI Action                       | Typical Cost | Credits                   |
| ------------------------------- | ------------ | ------------------------- |
| Claude Sonnet message           | ~$0.01       | ~1 credit                 |
| Claude Haiku message            | ~$0.001      | ~0.1 credits (round to 1) |
| Page generation (full)          | ~$0.50       | ~50 credits               |
| Brainstorm session (5 messages) | ~$0.05       | ~5 credits                |

### Final Pricing Model

**Yearly Subscriptions (monthly credits, don't rollover):**
| Plan | Credits/mo | Price/yr | $/credit | Our Cost | Margin |
|------|------------|----------|----------|----------|--------|
| Starter | 2,000 | $59 | $0.0295 | $20 | 66% |
| Growth | 5,000 | $119 | $0.0238 | $50 | 58% |
| Pro | 15,000 | $299 | $0.0199 | $150 | 50% |

**Monthly Subscriptions (monthly credits, don't rollover):**
| Plan | Credits/mo | Price/mo | $/credit | Our Cost | Margin |
|------|------------|----------|----------|----------|--------|
| Starter | 2,000 | $79 | $0.0395 | $20 | 75% |
| Growth | 5,000 | $149 | $0.0298 | $50 | 66% |
| Pro | 15,000 | $399 | $0.0266 | $150 | 62% |

**Credit Packs (one-time purchase, rollover indefinitely):**
| Pack | Credits | Price | $/credit | Our Cost | Margin |
|------|---------|-------|----------|----------|--------|
| Small | 500 | $25 | $0.05 | $5 | 80% |
| Mid | 1,250 | $50 | $0.04 | $12.50 | 75% |
| Big | 3,000 | $100 | $0.033 | $30 | 70% |

**What users get (in terms of page generations @ 50 credits each):**

- Starter: ~40 pages/month
- Growth: ~100 pages/month
- Pro: ~300 pages/month
- Small Pack: ~10 pages
- Mid Pack: ~25 pages
- Big Pack: ~60 pages

### Implementation: Cost Tracking in Langgraph

**IMPORTANT**: The final AIMessage does NOT contain cumulative costs. Each AIMessage only contains usage for that specific LLM call. You must sum across ALL AIMessages.

| Question                            | Answer                                                                  |
| ----------------------------------- | ----------------------------------------------------------------------- |
| Does final message have total cost? | **No** - only that LLM call's usage                                     |
| Where is usage stored?              | Each `AIMessage` has its own `usage_metadata`                           |
| Do ToolMessages have usage?         | **No** - only AIMessage has usage                                       |
| How to get total?                   | Sum `usage_metadata` across all AIMessages using `mergeUsageMetadata()` |

**Cost Aggregation Pattern:**

```typescript
import { AIMessage, isAIMessage } from "@langchain/core/messages";
import { mergeUsageMetadata, UsageMetadata } from "@langchain/core/messages";

// Sum usage across all AIMessages in an agent run
function aggregateUsage(messages: BaseMessage[]): UsageMetadata | undefined {
  const aiMessages = messages.filter(isAIMessage);
  if (aiMessages.length === 0) return undefined;

  let total = aiMessages[0].usage_metadata;
  for (let i = 1; i < aiMessages.length; i++) {
    const usage = aiMessages[i].usage_metadata;
    if (usage) {
      total = mergeUsageMetadata(total, usage);
    }
  }
  return total;
}

// Calculate cost from usage
function calculateCost(
  usage: UsageMetadata,
  pricing: { inputPricePerMillion: number; outputPricePerMillion: number }
): number {
  const inputCost = (usage.input_tokens / 1_000_000) * pricing.inputPricePerMillion;
  const outputCost = (usage.output_tokens / 1_000_000) * pricing.outputPricePerMillion;
  return inputCost + outputCost;
}
```

**Wrapper for Agent Runs with Cost Tracking:**

```typescript
export async function withCostTracking<T extends { messages: BaseMessage[] }>(
  modelName: string,
  agentFn: () => Promise<T>
): Promise<T & { _cost: { tokens: UsageMetadata; dollars: number; llmCalls: number } }> {
  // Validate model exists in DB - throws if not configured
  const pricing = await getModelPricing(modelName);

  const result = await agentFn();

  // Sum all AIMessage usage
  const aiMessages = result.messages.filter(isAIMessage);
  const tokens = aiMessages.reduce(
    (acc, msg) => (msg.usage_metadata ? mergeUsageMetadata(acc, msg.usage_metadata) : acc),
    { input_tokens: 0, output_tokens: 0, total_tokens: 0 }
  );

  const dollars =
    (tokens.input_tokens / 1e6) * pricing.inputPricePerMillion +
    (tokens.output_tokens / 1e6) * pricing.outputPricePerMillion;

  return {
    ...result,
    _cost: { tokens, dollars, llmCalls: aiMessages.length },
  };
}

// Usage
const { messages, _cost } = await withCostTracking("claude-sonnet-4-20250514", () =>
  agent.invoke({ messages: [new HumanMessage("Build me a landing page")] })
);

// Deduct credits (1 credit = $0.01)
const credits = Math.ceil(_cost.dollars * 100);
await creditsAPI.deductCredits({
  amount: credits,
  reason: "ai_generation",
  metadata: {
    model: "claude-sonnet-4-20250514",
    input_tokens: _cost.tokens.input_tokens,
    output_tokens: _cost.tokens.output_tokens,
    cost_usd: _cost.dollars,
    llm_calls: _cost.llmCalls,
  },
});
```

### Model Pricing Table (extend existing model_configs)

Existing `model_configs` table needs cache pricing columns:

```ruby
# Migration: add_cache_pricing_to_model_configs
add_column :model_configs, :cost_cache_write, :decimal, precision: 10, scale: 4
add_column :model_configs, :cost_cache_read, :decimal, precision: 10, scale: 4
```

**Full schema:**

```ruby
# Table: model_configs
#  id                :bigint           not null, primary key
#  model_key         :string           not null
#  cost_in           :decimal(10, 4)   # Input tokens per 1M
#  cost_out          :decimal(10, 4)   # Output tokens per 1M
#  cost_cache_write  :decimal(10, 4)   # Cache creation per 1M (NEW)
#  cost_cache_read   :decimal(10, 4)   # Cache read per 1M (NEW)
#  enabled           :boolean          default(TRUE)
#  max_usage_percent :integer          default(100)
#  model_card        :string
```

**Usage metadata from Anthropic:**

```typescript
usage_metadata: {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens?: number;  // Written to cache
  cache_read_input_tokens?: number;       // Read from cache (90% cheaper!)
}
```

**Note on image/multimedia tokens:** Image tokens ARE included in `input_tokens` but are NOT broken out separately by the API. LangChain has `input_token_details.image` in types but it's never populated. For flat-rate pricing this is fine - costs are accurate. Differential image pricing would require manual estimation.

**Updated cost calculation:**

```typescript
function calculateCost(usage: UsageMetadata, pricing: ModelConfig): number {
  const inputCost = (usage.input_tokens / 1e6) * pricing.cost_in;
  const outputCost = (usage.output_tokens / 1e6) * pricing.cost_out;

  // Cache costs (if present)
  const cacheWriteCost = usage.cache_creation_input_tokens
    ? (usage.cache_creation_input_tokens / 1e6) * pricing.cost_cache_write
    : 0;
  const cacheReadCost = usage.cache_read_input_tokens
    ? (usage.cache_read_input_tokens / 1e6) * pricing.cost_cache_read
    : 0;

  return inputCost + outputCost + cacheWriteCost + cacheReadCost;
}
```

**Anthropic pricing data (January 2025):**
| Model | Input $/1M | Output $/1M | Cache Write $/1M | Cache Read $/1M |
|-------|------------|-------------|------------------|-----------------|
| claude-sonnet-4-20250514 | $3.00 | $15.00 | $3.75 | $0.30 |
| claude-haiku-35-20241022 | $0.80 | $4.00 | $1.00 | $0.08 |
| claude-opus-4-5-20251101 | $15.00 | $75.00 | $18.75 | $1.50 |

**Schema is sufficient for Anthropic:** 4 cost columns (in, out, cache_write, cache_read) cover all Anthropic pricing. OpenAI's `reasoning_tokens` can be added later if needed.

## All Requirements Confirmed

- **1 credit = $0.01 (1 cent) of AI spend**
- **Plan credits**: Starter 2,000 | Growth 5,000 | Pro 15,000 per month
- **Credit packs**: Small 500 | Mid 1,250 | Big 3,000 (rollover)
- **Margins**: 50-75% on subscriptions, 70-80% on credit packs
