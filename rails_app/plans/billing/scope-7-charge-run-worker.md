# Scope 7: Credit Charging Pipeline

## Overview

This scope implements the pipeline that converts LLM usage records into credit deductions. Langgraph writes usage records directly to PostgreSQL, then notifies Rails to process charges.

**Key insight from research:** Langgraph correctly tracks multiple models per run - each LLM call creates a separate `llm_usage` record with its own `model_raw` field. The `cost_microcents` column is NULL and must be calculated by Rails using `ModelConfig` pricing data.

## What Already Exists

- `LLMUsage` model with `unprocessed`, `for_run(run_id)` scopes
- `ModelConfig` with pricing: `cost_in`, `cost_out`, `cost_reasoning`, `cache_reads`, `cache_writes` ($/1M tokens)
- `CreditTransaction` with `consume` type and `after_create :update_account_balances`
- `Credits::AllocationService` pattern: lock account, idempotency check, create transaction
- **Internal service auth**: `createRailsApiClient({ internalServiceCall: true })` in `shared/lib/api/client.ts`
  - Adds `X-Signature` (HMAC-SHA256 of timestamp) and `X-Timestamp` headers
  - Rails `InternalAPIVerification` concern verifies with `verify_internal_service_call`
- **Existing notify stub**: `langgraph_app/app/core/billing/notifyRails.ts` (needs auth update)

## Deliverables

### 1. Model Normalizer Service

**File:** `app/services/credits/model_normalizer.rb`

Maps `model_raw` (e.g., "claude-haiku-4-5-20251001") to `ModelConfig` using longest-prefix matching on `model_card`.

```ruby
module Credits
  class ModelNormalizer
    def self.call(model_raw)
      return nil if model_raw.blank?

      # Try exact model_card match first
      config = ModelConfig.find_by(model_card: model_raw)
      return config if config

      # Longest-prefix matching: find all model_cards that are prefixes of model_raw
      # Return the one with the longest match
      #
      # Example: model_raw = "claude-haiku-4-5-20251001"
      #   model_cards = ["claude-haiku-4-5", "claude-haiku", "gpt-5-mini"]
      #   → "claude-haiku-4-5" wins (longest prefix)
      #
      ModelConfig.all.select { |c| model_raw.start_with?(c.model_card) }
                     .max_by { |c| c.model_card.length }
    end
  end
end
```

### 2. Cost Calculator Service

**File:** `app/services/credits/cost_calculator.rb`

Calculates `cost_microcents` for an `LLMUsage` record.

**Pricing formula:** ModelConfig prices are $/1M tokens

- `cost_microcents = tokens * (price_per_million / 1_000_000) * 100 * 1000`
- Simplified: `cost_microcents = tokens * price_per_million / 10`

```ruby
module Credits
  class CostCalculator
    class UnknownModelError < StandardError; end

    def initialize(llm_usage)
      @usage = llm_usage
    end

    def call
      config = ModelNormalizer.call(@usage.model_raw)
      raise UnknownModelError, "Unknown model: #{@usage.model_raw}" unless config

      cost = 0
      cost += token_cost(@usage.input_tokens, config.cost_in)
      cost += token_cost(@usage.output_tokens, config.cost_out)
      cost += token_cost(@usage.reasoning_tokens, config.cost_reasoning || config.cost_out)
      cost += token_cost(@usage.cache_creation_tokens, config.cache_writes)
      cost += token_cost(@usage.cache_read_tokens, config.cache_reads)
      cost.round
    end

    private

    def token_cost(tokens, rate)
      return 0 if tokens.to_i.zero? || rate.to_f.zero?
      (tokens.to_f * rate.to_f / 10.0)
    end
  end
end
```

### 3. Consumption Service

**File:** `app/services/credits/consumption_service.rb`

Deducts credits from account using the existing pattern.

**Credit conversion:** 1 credit = 5 cents = 5,000 microcents (from CreditPack: 500 credits = $25)

```ruby
module Credits
  class ConsumptionService
    MICROCENTS_PER_CREDIT = 5_000

    def initialize(account)
      @account = account
    end

    def consume!(cost_microcents:, idempotency_key:, reference_id:, metadata: {})
      credits = (cost_microcents.to_f / MICROCENTS_PER_CREDIT).ceil
      return nil if credits.zero?

      Account.transaction do
        @account.lock!

        return if CreditTransaction.exists?(idempotency_key: idempotency_key)

        total, plan_bal, pack_bal = current_balances

        # Consume from plan first (can go negative), then pack
        if plan_bal >= credits
          create_transaction!(credit_type: "plan", amount: -credits, ...)
        elsif plan_bal > 0
          # Split between plan and pack
          plan_consumed = plan_bal
          pack_consumed = credits - plan_bal
          # Create transaction with pack consumed...
        else
          # All from pack (plan is 0 or negative)
          create_transaction!(credit_type: "pack", amount: -credits, ...)
        end
      end
    end
  end
end
```

### 4. ChargeRunWorker

**File:** `app/workers/credits/charge_run_worker.rb`

The core worker that processes a run.

```ruby
module Credits
  class ChargeRunWorker
    include Sidekiq::Worker
    sidekiq_options queue: :billing, retry: 3

    def perform(run_id)
      records = LLMUsage.unprocessed.for_run(run_id)
      return if records.empty?

      chat = records.first.chat
      return unless chat&.account

      account = chat.account
      total_cost = 0

      LLMUsage.transaction do
        records.each do |record|
          begin
            cost = CostCalculator.new(record).call
            record.update!(cost_microcents: cost, processed_at: Time.current)
            total_cost += cost
          rescue CostCalculator::UnknownModelError => e
            Rails.logger.warn "[ChargeRunWorker] #{e.message}"
            record.update!(cost_microcents: 0, processed_at: Time.current)
          end
        end

        if total_cost > 0
          ConsumptionService.new(account).consume!(
            cost_microcents: total_cost,
            idempotency_key: "llm_run:#{run_id}",
            reference_id: run_id,
            metadata: { chat_id: chat.id, record_count: records.count }
          )
        end
      end
    end
  end
end
```

### 5. FindUnprocessedRunsWorker (backup polling)

**File:** `app/workers/credits/find_unprocessed_runs_worker.rb`

Uses the same pattern as `DailyReconciliationWorker`: testable query method + `find_each` for batching + delegation to individual workers for proper retries.

```ruby
module Credits
  # Backup polling job that catches any runs that weren't processed via webhook.
  #
  # Runs every minute via Zhong. Finds LLMUsage records that are:
  # - Unprocessed (processed_at IS NULL)
  # - Older than staleness threshold (not still being written)
  # - Younger than max age (avoid scanning ancient records)
  #
  # Delegates each run_id to ChargeRunWorker for individual processing/retries.
  #
  class FindUnprocessedRunsWorker < ApplicationWorker
    sidekiq_options queue: :billing

    STALENESS_THRESHOLD = 2.minutes
    MAX_AGE = 1.week

    def perform
      stale_run_ids_query.find_each do |record|
        Credits::ChargeRunWorker.perform_async(record.run_id)
      end
    end

    private

    # Returns distinct run_ids with unprocessed usage in the processable window.
    #
    # Window: between MAX_AGE.ago and STALENESS_THRESHOLD.ago
    # - Lower bound (MAX_AGE): Prevents scanning ancient records that likely
    #   indicate a deeper issue (missing chat, deleted account, bad data)
    # - Upper bound (STALENESS_THRESHOLD): Avoids racing with active writes
    #
    # Query is extracted for testability - specs can verify the bounds.
    #
    def stale_run_ids_query
      LLMUsage
        .unprocessed
        .where(created_at: MAX_AGE.ago..STALENESS_THRESHOLD.ago)
        .select(:run_id)
        .distinct
    end
  end
end
```

**Why this pattern:**

1. **Testable query:** The `stale_run_ids_query` method is public enough to test independently, verifying the query logic without triggering worker enqueues

2. **Memory efficient:** `find_each` batches records (1000 at a time by default) instead of loading all run_ids into memory via `pluck`

3. **Individual retries:** Each `ChargeRunWorker` gets its own Sidekiq job with independent retry logic. If one run fails, others continue processing

4. **Idempotent:** `ChargeRunWorker` uses idempotency keys, so re-enqueueing the same run_id is safe

### 6. Update notifyRails.ts (Langgraph)

**File:** `langgraph_app/app/core/billing/notifyRails.ts`

Update to use the shared API client with proper auth:

```typescript
import { createRailsApiClient } from "@rails_api";

export async function notifyRails(runId: string): Promise<void> {
  try {
    const client = await createRailsApiClient({ internalServiceCall: true });
    const response = await client.POST("/api/v1/llm_usage/notify" as any, {
      body: { run_id: runId },
    });

    if (response.error) {
      console.warn(`[notifyRails] Error for runId ${runId}:`, response.error);
    }
  } catch (error) {
    console.warn(`[notifyRails] Failed for runId ${runId}:`, error);
  }
}
```

### 7. API Controller (Rails)

**File:** `app/controllers/api/v1/llm_usage_controller.rb`

```ruby
module Api
  module V1
    class LlmUsageController < Api::BaseController
      include InternalAPIVerification

      skip_before_action :require_api_authentication, only: [:notify]
      before_action :verify_internal_service_call, only: [:notify]

      def notify
        run_id = params.require(:run_id)
        Credits::ChargeRunWorker.perform_async(run_id)
        head :accepted
      end
    end
  end
end
```

### 8. Route

**File:** `config/routes.rb` (inside api v1 namespace)

```ruby
post 'llm_usage/notify', to: 'llm_usage#notify'
```

### 9. Zhong Schedule

**File:** `schedule.rb`

```ruby
every(1.minute, "credits: find unprocessed llm usage") do
  Credits::FindUnprocessedRunsWorker.perform_async
end
```

## Critical Files to Modify

### Rails

| File                                                  | Change           |
| ----------------------------------------------------- | ---------------- |
| `app/services/credits/model_normalizer.rb`            | New file         |
| `app/services/credits/cost_calculator.rb`             | New file         |
| `app/services/credits/consumption_service.rb`         | New file         |
| `app/workers/credits/charge_run_worker.rb`            | New file         |
| `app/workers/credits/find_unprocessed_runs_worker.rb` | New file         |
| `app/controllers/api/v1/llm_usage_controller.rb`      | New file         |
| `config/routes.rb`                                    | Add notify route |
| `schedule.rb`                                         | Add polling job  |

### Langgraph

| File                              | Change                                         |
| --------------------------------- | ---------------------------------------------- |
| `app/core/billing/notifyRails.ts` | Update to use `createRailsApiClient` with auth |

## Key Design Decisions

1. **Per-record cost calculation:** Each `llm_usage` record gets its `cost_microcents` calculated individually (supporting multiple models per run)

2. **Single transaction:** All records + credit consumption in one DB transaction

3. **Unknown models:** Log warning, set cost to 0, mark processed (don't block on pricing gaps)

4. **Credit conversion:** 1 credit = 5,000 microcents, round up to avoid free usage

5. **Idempotency:** Via `idempotency_key` on `CreditTransaction` (pattern from `AllocationService`)

6. **FIFO consumption:** Plan credits first (can go negative), then pack credits

## Verification

1. **Unit tests:**
   - `ModelNormalizer` with various model_raw formats
   - `CostCalculator` with known token counts
   - `ConsumptionService` with plan/pack split scenarios
   - `ChargeRunWorker` with multi-model runs

2. **Integration test:**
   - Create LLMUsage records with different models
   - Call `ChargeRunWorker.perform(run_id)`
   - Verify cost_microcents populated on each record
   - Verify CreditTransaction created with correct amount
   - Verify Account balances updated

3. **E2E test:**
   - Run Langgraph graph that uses multiple models
   - Verify usage records written
   - Verify credits deducted
