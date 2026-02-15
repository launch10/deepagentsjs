# Deploy Pipeline Recovery

This document describes the resilience layers in the deploy pipeline that handle timeouts, stuck jobs, error classification, and automatic support ticket creation.

## Architecture Overview

The deploy pipeline runs as a Langgraph graph that orchestrates tasks. Each task may fire a Rails background job (Sidekiq). Langgraph waits for webhooks to learn when jobs complete, with multiple fallback layers when things go wrong.

```
Langgraph (taskExecutor)
  ├── Fires Rails job via JobRunAPIService
  ├── Sets blockingStartedAt, waits for webhook
  ├── On timeout (3 min): checks Rails for job status (fallback)
  │   ├── Job completed → recover result
  │   ├── Job still running → extend timeout (capped at 2 extensions = 3 total checks)
  │   ├── Job failed → propagate error
  │   └── Check failed → timeout failure
  ├── At warningTimeout (e.g. 2 min for website deploy): sets warning on task
  └── On failure: classifies error → retry-only or retry+support ticket
```

### Who creates support tickets?

| Failure origin | Who detects | Who creates ticket |
|---|---|---|
| Build/deploy crash in Rails | Rails job failure | **Langgraph → Rails** via `needs_support` |
| Job stuck >10 min | Stuck detector worker | **Rails directly** (Langgraph may be down) |
| AI generation failed | Langgraph | **Langgraph → Rails** via `needs_support` |
| Timeout (extensions exhausted) | Langgraph | **Langgraph → Rails** via `needs_support` |

Idempotency guard (`return if deploy.support_request.present?`) prevents duplicate tickets.

## Layer 6: Capped Timeout Extensions

### Problem

When a blocking task's timeout expires, Langgraph checks Rails for the job's status. If Rails says "still running", Langgraph resets `blockingStartedAt` to grant another interval. Without a cap, this loops indefinitely.

### Solution

A `timeoutExtensionCount` field on each task tracks how many times the timeout has been extended. Extensions are capped at `MAX_TIMEOUT_EXTENSIONS = 2`, meaning 3 total health checks.

For website deploys: `blockingTimeout = 3 min`, 3 checks × 3 min = **9 minutes max**.

### Flow

1. Task starts blocking → `blockingStartedAt = Date.now()`
2. 3 min passes → timeout fires → Langgraph checks Rails
3. Rails says "still running" → `timeoutExtensionCount: 0 → 1`, `blockingStartedAt` reset
4. Repeat up to 2 extensions (3 total checks)
5. On 3rd check (extensions exhausted) → task fails as timeout

### Why extensions, not a flat 9-minute timeout?

Extensions serve as **inline health checks**. A flat 9-minute timeout means a job that crashes at minute 1 isn't detected until minute 9. With 3-minute check intervals, crashes are detected within 3 minutes. The stuck job detector is the background backstop, but extensions provide faster inline detection.

### Files

- `shared/types/task.ts` — `timeoutExtensionCount` field on TaskSchema
- `langgraph_app/app/nodes/deploy/taskExecutor.ts` — Extension cap logic
- `langgraph_app/app/nodes/deploy/taskRunner.ts` — `blockingTimeout` per runner
- `langgraph_app/app/nodes/deploy/deployWebsiteNode.ts` — `blockingTimeout: 180_000`
- `langgraph_app/tests/tests/deploy/taskExecutor.timeout.test.ts` — Tests

## Layer 7: Langgraph-Driven Stuck Warnings

### Problem

The frontend used a 3-minute timer comparing task state snapshots to guess if a deploy was "stuck". This is disconnected from Langgraph's actual per-task timeout knowledge. A task with a 9-minute timeout would show "stuck" at 3 minutes — incorrect.

### Solution

Each task runner declares a concrete `warningTimeout` in ms. Langgraph sets a `warning` field on the task when blocking time exceeds that threshold. The frontend reads this from graph state instead of running its own timer.

For website deploys: `warningTimeout = 2 min` — "Deploying website is taking longer than expected" appears after 2 minutes.

### Flow

1. Task blocks → `blockingStartedAt` set
2. Each poll: Langgraph checks `elapsed > runner.warningTimeout`
3. If true and no warning yet → sets `warning: "{TaskDescription} is taking longer than expected"`
4. Frontend reads `tasks[].warning` and displays amber banner

### Files

- `shared/types/task.ts` — `warning` field on TaskSchema
- `shared/types/deploy/bridge.ts` — `warning` field on bridge task type
- `langgraph_app/app/nodes/deploy/taskRunner.ts` — `warningTimeout` on TaskRunner interface
- `langgraph_app/app/nodes/deploy/deployWebsiteNode.ts` — `warningTimeout: 120_000`
- `langgraph_app/app/nodes/deploy/taskExecutor.ts` — Warning logic in blocking branch
- `rails_app/app/javascript/frontend/hooks/useDeployChat.ts` — Removed: `STUCK_THRESHOLD_MS`, `isStuck`, snapshot refs
- `rails_app/app/javascript/frontend/components/deploy/screens/InProgressScreen.tsx` — Reads `tasks[].warning`
- `rails_app/app/javascript/frontend/pages/Deploy.tsx` — Removed `isStuck` prop

## Layer 8: Auto-Create Support Ticket on Unrecoverable Failure

### Problem

When a deploy fails and needs human investigation, we're not notified. The user sees an error screen but nobody is looking into it.

### Solution

Two paths create support tickets:

1. **Langgraph-classified failures**: Errors are classified with a `needsSupport` flag. Unrecoverable failures (build crashes, unknown errors) pass `needs_support: true` to Rails, which creates a `SupportRequest` (triggers email + Slack + Notion). Transient failures (timeout, network, rate limit) just show retry.

2. **Stuck job detector** (Rails backstop): When the detector finds a job stuck >10 min with an associated deploy, it creates a support ticket directly — no Langgraph dependency. This covers the case where Langgraph itself is down.

### Error Classification

| Error Pattern | canRetry | needsSupport | Reason |
|---|---|---|---|
| Timed out | true | false | Transient, retry likely works |
| Website deploy failed | true | **true** | Build failed, needs investigation |
| Campaign failed | true | **true** | Sync failed, needs investigation |
| Generic deploy failed | true | **true** | Unknown, needs investigation |
| Sidekiq retries exhausted | true | **true** | Persistent failure |
| Google OAuth | true | false | User action needed |
| Payment/billing | true | false | User action needed |
| Rate limit / 429 | true | false | Transient |
| Network / connection | true | false | Transient |
| DEFAULT (unknown) | true | **true** | Unknown = needs investigation |

### Data Flow (Langgraph path)

```
1. Langgraph detects unrecoverable failure
2. Langgraph calls syncDeployStatus("failed") with needs_support: true
3. Rails PATCH /api/v1/deploys/:id receives needs_support flag
4. Deploy after_save callback creates SupportRequest (email + Slack + Notion)
5. Rails returns { support_ticket: "SR-XXXXXXXX" } in response
6. Langgraph stores supportTicket in graph state
7. Frontend reads state.supportTicket immediately (no reload)
8. Error screen shows "We've been notified" + ticket reference
```

### Data Flow (Stuck detector path)

```
1. StuckJobDetectorWorker finds job in pending/running for >10 min
2. Marks job_run as failed, fires webhook to Langgraph
3. If job has a deploy → calls Deploys::AutoSupportTicketService directly
4. SupportRequest created (email + Slack + Notion) — no Langgraph needed
5. Idempotency guard prevents duplicate if Langgraph also processes
```

### Files

**Shared types:**
- `shared/types/deploy/errors.ts` — `needsSupport` on DeployError + `needsSupportTicket()` helper
- `shared/types/deploy/bridge.ts` — `supportTicket` on DeployGraphState

**Rails:**
- Migration: polymorphic `supportable` (type + id) on support_requests table
- `app/models/support_request.rb` — `belongs_to :supportable, polymorphic: true, optional: true`
- `app/models/deploy.rb` — `has_one :support_request, as: :supportable` + after_save callback
- `app/services/deploys/auto_support_ticket_service.rb` — Creates SupportRequest linked to Deploy
- `app/controllers/api/v1/deploys_controller.rb` — Passes needs_support flag, returns ticket
- `app/workers/monitoring/stuck_job_detector_worker.rb` — Creates ticket directly for stuck jobs with deploys

**Langgraph:**
- `app/nodes/deploy/taskExecutor.ts` — `syncDeployStatus` passes `needs_support`, reads ticket back

**Frontend:**
- `components/deploy/screens/DeployErrorScreen.tsx` — Shows ticket reference
- `pages/Deploy.tsx` — Passes `supportTicket` from state

### Tests

- `langgraph_app/tests/tests/deploy/deployErrors.test.ts` — needsSupport classification
- `rails_app/spec/services/deploys/auto_support_ticket_service_spec.rb` — Service unit tests
- `rails_app/spec/requests/api/v1/deploys_spec.rb` — API integration tests
- `rails_app/spec/workers/monitoring/stuck_job_detector_worker_spec.rb` — Stuck detector creates tickets
