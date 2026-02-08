# Async Communication Patterns

Rails and Langgraph communicate asynchronously using two primary patterns: **fire-and-forget** (for non-critical notifications) and **webhook callbacks** (for job coordination). All service-to-service calls are authenticated with HMAC-SHA256 signatures using the shared JWT secret.

## Pattern 1: Fire-and-Forget (Langgraph → Rails)

Used when Langgraph needs to notify Rails of something but doesn't need a response. The primary use case is billing notifications.

```
Langgraph                              Rails
   │                                     │
   │  POST /api/v1/llm_usage/notify     │
   │  { run_id }                        │
   │  X-Signature: HMAC(body, secret)   │
   │────────────────────────────────────→│
   │                                     │ enqueue ChargeRunWorker
   │  (doesn't wait for response)        │ return 202 Accepted
   │                                     │
```

**How it works:**

1. After a graph run completes, `usageTrackingMiddleware` persists usage records to the `llm_usage` table
2. Calls `notifyRails(runId)` — a non-blocking POST to `/api/v1/llm_usage/notify`
3. Rails enqueues `Credits::ChargeRunWorker` and returns 202 immediately
4. Worker calculates exact cost and calls `ConsumptionService.consume!`

**Fallback:** `Credits::FindUnprocessedRunsWorker` polls every 2 minutes for usage records older than 2 minutes that haven't been charged. This catches any missed notifications.

## Pattern 2: Webhook Callback (Rails → Langgraph)

Used when Rails completes a background job that Langgraph is waiting on. The graph suspends at an idempotent task node and resumes when the callback arrives.

```
Browser        Langgraph                    Rails
  │               │                           │
  │──stream──→   │                           │
  │               │  POST /api/v1/job_runs   │
  │               │  { job_class, threadId }  │
  │               │──────────────────────────→│
  │               │  ← { job_id }            │
  │               │                           │
  │               │  (graph suspends at       │  Sidekiq processes job
  │               │   idempotent task node)   │
  │               │                           │
  │               │  POST /webhooks/          │
  │               │  job_run_callback         │
  │               │  X-Signature: HMAC(...)   │
  │               │←──────────────────────────│
  │               │                           │
  │               │  (graph resumes,          │
  │←──stream────│   processes result)        │
  │               │                           │
```

**How it works:**

1. Graph node calls Rails `POST /api/v1/job_runs` to create a `JobRun` record
2. Rails returns `job_id` and enqueues the actual work via Sidekiq
3. Graph suspends at an idempotent task node (polls for completion)
4. When the Sidekiq job finishes, Rails enqueues `LanggraphCallbackWorker`
5. Worker signs the payload with HMAC-SHA256 and POSTs to `/webhooks/job_run_callback`
6. Langgraph verifies the signature (timing-safe comparison), updates graph state
7. The idempotent task node detects the update and resumes graph execution

**Retry strategy:** `LanggraphCallbackWorker` retries at 5s, 30s, 120s intervals on failure.

## Pattern 3: SSE Streaming (Langgraph → Browser)

Used for real-time AI responses. The browser opens a streaming connection to Langgraph and receives graph state updates as Server-Sent Events.

```
Browser                    Langgraph
  │                           │
  │  POST /api/website/stream │
  │  Authorization: Bearer <jwt>
  │──────────────────────────→│
  │                           │ run graph
  │  ← SSE: node updates     │ ← LLM calls
  │  ← SSE: messages         │ ← token tracking
  │  ← SSE: creditStatus     │
  │  ← SSE: [DONE]           │ → notifyRails(runId)
  │                           │
```

**How it works:**

1. Frontend POSTs to a stream endpoint (e.g., `/api/website/stream`) with JWT auth
2. Middleware stack: `authMiddleware` → `creditCheckMiddleware` → handler
3. Graph compiles and streams events back as SSE (node completions, messages, state deltas)
4. `usageTrackingMiddleware` tracks all LLM calls during execution
5. On stream completion: persist usage, calculate costs, emit `creditStatus`, call `notifyRails`

## Pattern 4: Document Extraction (Langgraph → Rails)

A variant of the webhook callback where Langgraph does the heavy lifting (LLM-based document extraction) and notifies Rails when done.

```
Rails                      Langgraph
  │  POST /api/documents/   │
  │  extract-faqs            │
  │─────────────────────────→│
  │  ← 202 (job queued)     │
  │                          │ BullMQ processes extraction
  │                          │ LLM extracts Q&A pairs
  │  POST /webhooks/         │
  │  document_extraction     │
  │←─────────────────────────│
  │  update Document record  │
  │  complete JobRun         │
```

**Retry strategy:** BullMQ queue with 3 attempts, exponential backoff (2s base).

## Signature Verification

All service-to-service calls use HMAC-SHA256 signatures:

```
Sender: X-Signature = HMAC-SHA256(request_body, JWT_SECRET)
Receiver: verify using timing-safe comparison (crypto.timingSafeEqual)
```

No user JWT is needed for internal calls. Rails marks these endpoints with `skip_before_action :require_api_authentication` and uses `verify_internal_service_call` instead.

## Key Files Index

| File | Purpose |
|------|---------|
| `langgraph_app/app/core/billing/notifyRails.ts` | Fire-and-forget billing notification |
| `langgraph_app/app/api/middleware/usageTracking.ts` | Usage tracking + notifyRails trigger |
| `langgraph_app/app/server/routes/webhooks/jobRunCallback.ts` | Webhook receiver with signature verification |
| `langgraph_app/app/services/webhooks/webhookService.ts` | Outbound webhook sender with HMAC signing |
| `langgraph_app/app/queues/documentExtraction.ts` | BullMQ queue for document extraction |
| `langgraph_app/app/workers/documentExtractionWorker.ts` | Extraction worker with LLM processing |
| `rails_app/app/controllers/api/v1/llm_usage_controller.rb` | Billing notification receiver |
| `rails_app/app/workers/langgraph_callback_worker.rb` | Webhook callback sender (retry: 5s, 30s, 120s) |
| `rails_app/app/clients/langgraph_callback_client.rb` | HTTP client with HMAC signing |
| `rails_app/app/workers/credits/find_unprocessed_runs_worker.rb` | Polling fallback for missed notifications |
| `rails_app/app/controllers/webhooks/document_extraction_controller.rb` | Document extraction webhook receiver |
| `shared/lib/api/client.ts` | Shared HTTP client with HMAC signing |

## Gotchas

- **Billing has dual reliability**: Push (notifyRails) + pull (FindUnprocessedRunsWorker polling every 2 min). If the webhook fails, charges are still processed within minutes.
- **Webhook signatures use the JWT secret**: Not a separate webhook secret. This simplifies config but means the JWT secret is used for both token signing and webhook authentication.
- **Idempotent task nodes**: The callback updates graph state, but the task node must be idempotent — multiple callback deliveries must not corrupt state. The graph uses task name as a key to deduplicate.
- **No SmartSubscription**: Despite the name appearing in the plan, there's no SmartSubscription pattern in the codebase. Rails handles subscriptions via the Pay gem independently.
