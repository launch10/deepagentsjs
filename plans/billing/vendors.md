# Unified Vendor Cost Tracking

## Context

Cohere Rerank and OpenAI Embeddings are called during graph execution (FAQ search, icon search) but are completely invisible to billing. They bypass the `UsageTrackingCallbackHandler` because they're not LangChain `BaseChatModel` calls. This means we're eating vendor costs without attributing them to users.

The goal: extend the billing pipeline with a parallel `vendor_usage` table that captures non-LLM vendor costs, while keeping `credit_transactions` as the single source of truth. The architecture should be extensible to future vendor types (data APIs like Ahrefs, etc.) without forcing everything into the token-based `llm_usage` schema.

## Approach

Add a `vendor_usage` table alongside `llm_usage`. Both feed into the same `CreditTransaction` per run. On the Langgraph side, extend `UsageContext` with a `vendorRecords[]` array and provide a simple `trackVendorUsage()` function that services call after their API calls. Everything flows through the existing `onComplete` → `persistVendorUsage` → `notifyRails` → `ChargeRunWorker` pipeline.

## Changes

### 1. Rails Migration: `vendor_usage` table

**File**: `rails_app/db/migrate/XXXXXX_create_vendor_usage.rb`

```ruby
create_table :vendor_usage do |t|
  t.bigint   :chat_id,       null: false
  t.string   :thread_id,     null: false
  t.string   :run_id,        null: false
  t.string   :vendor,        null: false  # "cohere", "openai"
  t.string   :service,       null: false  # "rerank", "embedding"
  t.string   :model                       # "rerank-v3.5", "text-embedding-3-small"
  t.string   :graph_name
  t.integer  :units,         null: false, default: 1
  t.string   :unit_type,     null: false  # "search", "token", "api_call"
  t.bigint   :cost_millicredits
  t.jsonb    :metadata,      default: {}
  t.datetime :processed_at
  t.timestamps
end

add_index :vendor_usage, :run_id
add_index :vendor_usage, [:chat_id, :run_id]
add_index :vendor_usage, [:processed_at, :created_at]
```

### 2. Rails Migration: `vendor_configs` table

**File**: `rails_app/db/migrate/XXXXXX_create_vendor_configs.rb`

```ruby
create_table :vendor_configs do |t|
  t.string  :vendor,        null: false
  t.string  :service,       null: false
  t.string  :unit_type,     null: false
  t.decimal :cost_per_unit, precision: 12, scale: 8, null: false  # dollars per unit
  t.boolean :enabled,       default: true, null: false
  t.timestamps
end

add_index :vendor_configs, [:vendor, :service], unique: true
```

Seed data:
- `cohere/rerank`: cost_per_unit = 0.002 ($0.002 per search unit)
- `openai/embedding`: cost_per_unit = 0.00000002 ($0.02 per million tokens)

### 3. Rails Models

**`rails_app/app/models/vendor_usage.rb`** (new)
- `belongs_to :chat`
- Scopes: `unprocessed`, `for_run(run_id)` — same pattern as `LLMUsage`

**`rails_app/app/models/vendor_config.rb`** (new)
- Lookup by `vendor` + `service`

### 4. Rails: `Credits::VendorCostCalculator`

**`rails_app/app/services/credits/vendor_cost_calculator.rb`** (new)

Takes a `VendorUsage` record, looks up `VendorConfig`, calculates:
```
cost_dollars = units * cost_per_unit
cost_millicredits = (cost_dollars * 100_000).round
```

### 5. Rails: Extend `Credits::ChargeRunWorker`

**`rails_app/app/workers/credits/charge_run_worker.rb`** (modify)

- Also fetch `VendorUsage.unprocessed.for_run(run_id)`
- Calculate costs via `VendorCostCalculator` for each vendor record
- Sum into same `total_cost`, create single `CreditTransaction`
- Add `vendor_record_count` to metadata

### 6. Rails: Extend `Credits::FindUnprocessedRunsWorker`

**`rails_app/app/workers/credits/find_unprocessed_runs_worker.rb`** (modify)

- Also scan `VendorUsage.unprocessed` for stale run_ids

### 7. Langgraph: Add `VendorRecord` type

**`langgraph_app/app/core/billing/types.ts`** (modify)

```typescript
export interface VendorRecord {
  runId: string;
  vendor: string;       // "cohere", "openai"
  service: string;      // "rerank", "embedding"
  model?: string;       // "rerank-v3.5", "text-embedding-3-small"
  units: number;        // 1 search unit, ~N tokens, etc.
  unitType: string;     // "search", "token", "api_call"
  timestamp: Date;
  metadata?: Record<string, unknown>;
}
```

Add `vendorRecords: VendorRecord[]` to `UsageContext`.

### 8. Langgraph: Update `createUsageContext`

**`langgraph_app/app/core/billing/storage.ts`** (modify)

Initialize `vendorRecords: []` in the factory.

### 9. Langgraph: `trackVendorUsage()` helper

**`langgraph_app/app/core/billing/vendorTracker.ts`** (new)

Simple function: gets `UsageContext` from AsyncLocalStorage, pushes a `VendorRecord`. No-ops with a warning if no context (same pattern as `usageTracker` warning).

### 10. Langgraph: `persistVendorUsage()`

**`langgraph_app/app/core/billing/persist.ts`** (modify)

Add `persistVendorUsage()` following the exact same pattern as `persistUsage()` (retry with exponential backoff). Uses `vendorUsage` Drizzle table from schema.

### 11. Langgraph: Update `onComplete` middleware

**`langgraph_app/app/api/middleware/usageTracking.ts`** (modify)

Add `persistVendorUsage(vendorRecords, context)` to the `Promise.all` alongside `persistUsage` and `persistTrace`. The existing `notifyRails(runId)` already sends the run_id — Rails `ChargeRunWorker` will process both tables.

### 12. Langgraph: Instrument services

**`langgraph_app/app/services/core/cohereRerankService.ts`** (modify)
- After `this.client.v2.rerank()` succeeds, call `trackVendorUsage({ vendor: "cohere", service: "rerank", model, units: 1, unitType: "search" })`

**`langgraph_app/app/services/faq/faqSearchService.ts`** (modify)
- After `this.embeddingModel.embedQuery(query)`, call `trackVendorUsage({ vendor: "openai", service: "embedding", model: "text-embedding-3-small", units: estimatedTokens, unitType: "token" })`
- Token estimate: `Math.ceil(query.length / 4)` — at $0.02/M tokens, even 10x error is sub-millicredit

**`langgraph_app/app/services/core/postgresEmbeddingsService.ts`** (modify)
- Same embedding tracking in `search()` after `embedQuery()`
- In `storeEmbeddings()`, track total estimated tokens for all documents

### 13. Langgraph: Update exports and reflect DB

- **`langgraph_app/app/core/billing/index.ts`** — export `VendorRecord`, `trackVendorUsage`, `persistVendorUsage`
- Run `pnpm db:reflect` after Rails migration to pick up `vendor_usage` table

## Implementation Order

1. Rails migrations (vendor_usage + vendor_configs)
2. Rails models (VendorUsage, VendorConfig)
3. Rails seed vendor_configs
4. Langgraph `pnpm db:reflect`
5. Langgraph types (`VendorRecord`, extend `UsageContext`)
6. Langgraph storage (init `vendorRecords: []`)
7. Langgraph `vendorTracker.ts`
8. Langgraph `persistVendorUsage` in persist.ts
9. Langgraph middleware `onComplete` update
10. Langgraph service instrumentation (Cohere, FAQ, Postgres embeddings)
11. Langgraph exports update
12. Rails `VendorCostCalculator`
13. Rails `ChargeRunWorker` extension
14. Rails `FindUnprocessedRunsWorker` extension

## Verification

1. **Unit tests**: Test `trackVendorUsage` pushes to context, `persistVendorUsage` writes correct rows, `VendorCostCalculator` computes correctly
2. **Integration**: Run a FAQ search tool call in dev, verify `vendor_usage` rows appear with correct vendor/service/units
3. **End-to-end**: Verify `ChargeRunWorker` processes both `llm_usage` and `vendor_usage` records into a single `CreditTransaction`
4. **Existing tests**: Run full `pnpm test` suite — existing billing tests should pass unchanged since `vendorRecords: []` is additive
