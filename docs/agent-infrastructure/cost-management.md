# Cost Management

Token usage is tracked per-LLM-call via a callback handler, persisted to the `llm_usage` table, and converted to millicredits for billing. Langgraph does the tracking and persistence; Rails does the charging. A dual-reliability pattern (push + pull) ensures no charges are missed.

## Cost Formula

```
millicredits = tokens × price_per_million / 10

1 credit    = 1 cent    = $0.01
1 millicredit = $0.00001 (1/1000 of a credit)

Example: 1M input tokens at $3/M = 1,000,000 × 3 / 10 = 300,000 millicredits = $3.00
```

## Token Tracking Flow

```
LLM call starts
       │
       ▼
UsageTrackingCallbackHandler.handleChatModelStart()
  → captures input messages, stores model metadata
       │
       ▼
LLM call completes
       │
       ▼
UsageTrackingCallbackHandler.handleLLMEnd()
  → extracts token counts from response_metadata.usage
  → creates UsageRecord { model, input/output/reasoning/cache tokens }
       │
       ▼
AsyncLocalStorage (UsageContext)
  → accumulates all records for this run
       │
       ▼
Stream completion (usageTrackingMiddleware onComplete)
  1. Look up chatId from threadId
  2. Calculate costs using model configs
  3. persistUsage() → llm_usage table (with retry)
  4. notifyRails(runId) → POST /api/v1/llm_usage/notify
       │
       ▼
Rails: ChargeRunWorker
  → CostCalculator → ConsumptionService.consume!
  → CreditTransaction entries (atomic ledger)
```

## Token Types

| Token Type | Description | Cost |
|------------|-------------|------|
| `inputTokens` | Prompt tokens sent to model | Input price |
| `outputTokens` | Response tokens generated | Output price |
| `reasoningTokens` | Chain-of-thought tokens (Claude) | Reasoning price (falls back to output) |
| `cacheCreationTokens` | Tokens written to cache | Cache write price |
| `cacheReadTokens` | Tokens read from cache | Cache read price (typically 10% of input) |

## Credit Status (Real-time)

At stream completion, Langgraph emits a `creditStatus` event to the frontend:

```typescript
{
  estimatedRemainingMillicredits: number,
  justExhausted: boolean  // triggers CreditWarningModal
}
```

The frontend `creditStore` (Zustand) updates balance and shows modals:
- **Low credit warning**: at 80% usage (dismissible for 24h)
- **Exhausted modal**: when `justExhausted = true` (dismissible for 1h)
- **Chat input lock**: `CreditGate` blocks input when `isOutOfCredits`

## Key Files Index

| File | Purpose |
|------|---------|
| `langgraph_app/app/core/billing/tracker.ts` | UsageTrackingCallbackHandler (192 lines) |
| `langgraph_app/app/core/billing/storage.ts` | AsyncLocalStorage for UsageContext |
| `langgraph_app/app/core/billing/persist.ts` | Write usage to llm_usage table (retry logic) |
| `langgraph_app/app/core/billing/creditStatus.ts` | Calculate remaining credits + exhaustion |
| `langgraph_app/app/core/billing/notifyRails.ts` | Fire-and-forget billing notification |
| `langgraph_app/app/core/llm/cost.ts` | Token-to-millicredits conversion (164 lines) |
| `langgraph_app/app/api/middleware/usageTracking.ts` | Stream middleware: persist + notify on completion |
| `rails_app/app/services/credits/cost_calculator.rb` | Rails-side cost calculation (mirrors LG) |
| `rails_app/app/services/credits/consumption_service.rb` | Credit deduction with plan/pack splitting |
| `rails_app/app/workers/credits/charge_run_worker.rb` | Process usage into charges |
| `rails_app/app/workers/credits/find_unprocessed_runs_worker.rb` | Polling fallback (every 2 min) |
| `rails_app/app/javascript/frontend/stores/creditStore.ts` | Frontend credit state (321 lines) |

## Gotchas

- **LangChain doubles cache tokens**: The Anthropic adapter reports cumulative cache tokens in streaming. We read raw `response_metadata.usage` to get accurate counts.
- **Dual reliability**: Push (notifyRails webhook) + pull (FindUnprocessedRunsWorker polls every 2 min). Charges are never missed, even if the webhook fails.
- **UnknownModelCostError**: If a model isn't in the config, cost calculation throws rather than silently skipping. This prevents revenue leakage from new models.
- **Millicredits everywhere**: All internal calculations use millicredits. The frontend converts to credits (÷ 1000) for display.
- **Subagent tracking**: Usage records include the parent run's context. Subagent LLM calls are tracked and billed to the same run.
