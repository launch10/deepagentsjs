# Credit Charging

## Overview

After a graph execution completes and usage records are persisted, the `ChargeRunWorker` calculates exact costs and creates a single consumption transaction that debits the account's credit balance.

## How It Works

### Notification Flow

1. Graph execution completes, `persistUsage()` writes to `llm_usage` table
2. `notifyRails(runId)` sends a fire-and-forget POST to `POST /api/v1/llm_usage/notify`
3. Rails enqueues `ChargeRunWorker` for the given `runId`
4. If notification fails (network error, etc.), `FindUnprocessedRunsWorker` picks up stale records as a backup

### ChargeRunWorker Processing

1. Finds all unprocessed `LLMUsage` records for the `runId`
2. For each record, calculates cost using `CostCalculator`
3. Updates each record with `cost_millicredits` and `processed_at`
4. Sums total cost across all records
5. Calls `ConsumptionService.consume!` with the total cost
6. Creates a single `CreditTransaction` with `transaction_type: "consume"`

### Cost Calculation

The core logic is: 1 credit = 1 cent of cost to Launch10. More expensive models cost more credits.

Both Rails (`CostCalculator`) and Langgraph (`core/llm/cost.ts`) use the same formula:

```
millicredits = (input_tokens × cost_in / 1_000_000 +
                output_tokens × cost_out / 1_000_000 +
                reasoning_tokens × cost_reasoning / 1_000_000 +
                cache_creation_tokens × cache_writes / 1_000_000 +
                cache_read_tokens × cache_reads / 1_000_000) / 10
```

The `/10` converts from dollars to cents (1 credit = 1 cent), then to millicredits.

Model pricing is defined in `ModelConfig` which maps model names to per-million-token costs.

### Consumption Splitting

`ConsumptionService.consume!` intelligently splits charges between credit types:

| Scenario                  | Plan Debit                | Pack Debit          |
| ------------------------- | ------------------------- | ------------------- |
| Plan balance >= cost      | Full cost                 | 0                   |
| Plan > 0 but insufficient | Remaining plan balance    | Cost - plan balance |
| Plan = 0, pack available  | 0                         | Full cost           |
| Both exhausted            | Full cost (goes negative) | 0                   |

The split is recorded as `credit_type: "split"` when both plan and pack are debited.

### Backup Polling

`FindUnprocessedRunsWorker` runs every 2 minutes via Zhong scheduler. It:

1. Queries `llm_usage` for records where `processed_at IS NULL` and `created_at < 2.minutes.ago`
2. Groups by `run_id`
3. Enqueues `ChargeRunWorker` for each stale `run_id`

This handles cases where `notifyRails()` fails (network issues, Rails downtime).

## Key Files

| File                                                            | Purpose                                        |
| --------------------------------------------------------------- | ---------------------------------------------- |
| `rails_app/app/workers/credits/charge_run_worker.rb`            | Main charging worker                           |
| `rails_app/app/services/credits/cost_calculator.rb`             | Token-to-millicredits conversion               |
| `rails_app/app/services/credits/consumption_service.rb`         | Balance debit with plan/pack splitting         |
| `rails_app/app/workers/credits/find_unprocessed_runs_worker.rb` | Backup polling for missed notifications        |
| `langgraph_app/app/core/llm/cost.ts`                            | Langgraph-side cost calculator (mirrors Rails) |
| `langgraph_app/app/core/billing/notifyRails.ts`                 | Fire-and-forget notification to Rails          |

## Key Concepts

### Idempotency

`ChargeRunWorker` uses the `run_id` as an idempotency boundary. Each `LLMUsage` record is marked with `processed_at` after cost calculation, preventing double-charging. The consumption transaction uses an idempotency key derived from the run.

### Dual Cost Calculators

The Langgraph cost calculator (`cost.ts`) is used for **estimation** during the graph run (to detect credit exhaustion in real-time). The Rails cost calculator is the **source of truth** for actual charges. Both use the same formula and model configs to minimize drift.

Key functions in `cost.ts`:

- `calculateCost(record, configs)` — single record cost
- `calculateRunCost(records, configs)` — total for multiple records
- `hasValidCostConfig(model)` — validates model has pricing data
- `findModelConfig(model)` — exact match, then model_card match, then prefix match

### CREDITS_DISABLED Bypass

When `ENV["CREDITS_DISABLED"] = "true"` (non-production only), `ChargeRunWorker` returns early without processing. Usage records are still created for observability, but no `CreditTransaction` is generated and balances are not debited.

## Related Docs

- [05-llm-usage-tracking.md](./05-llm-usage-tracking.md) - How usage records are captured
- [01-credit-model.md](./01-credit-model.md) - Transaction types and balance columns
- [07-pre-run-authorization.md](./07-pre-run-authorization.md) - Pre-run credit check
- [11-development-mode.md](./11-development-mode.md) - CREDITS_DISABLED kill switch
