# Deploy Pipeline Recovery

This document describes the resilience layers in the deploy pipeline that handle timeouts, stuck jobs, error classification, and automatic support ticket creation.

## Philosophy: Fail Fast, Fail Loud

All deploy worker errors are treated as **non-recoverable**. When a worker encounters any error:
1. The error is classified and logged
2. The job_run is marked `failed` immediately
3. Langgraph is notified immediately via webhook
4. Generic exceptions trigger Sentry alerts

There are **no Sidekiq retries** for deploy workers in normal operation. `sidekiq_options retry: N` exists only as a backstop for process crashes (OOM, kill -9) where `handle_deploy_error` never ran.

**Rationale**: Deploy failures should surface to the user and engineering team instantly. A 5-minute retry loop before telling the user "something went wrong" is worse than immediate failure with a support ticket. We'd rather fail fast, hear about errors, and fix root causes.

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
  └── On failure: classifies error → needs_support ticket
```

### Who creates support tickets?

| Failure origin | Who detects | Who creates ticket |
|---|---|---|
| Build/deploy crash in Rails | Rails job failure | **Langgraph → Rails** via `needs_support` |
| Job stuck >10 min | Stuck detector worker | **Rails directly** (Langgraph may be down) |
| AI generation failed | Langgraph | **Langgraph → Rails** via `needs_support` |
| Timeout (extensions exhausted) | Langgraph | **Langgraph → Rails** via `needs_support` |

Idempotency guard (`return if deploy.support_request.present?`) prevents duplicate tickets.

## Unified Worker Error Handling (DeployJobHandler)

All deploy-related Sidekiq workers include the `DeployJobHandler` concern, which provides consistent fail-fast error handling.

### Error Classification

When a worker catches an error, `DeployJobs::ErrorClassifier` maps it to a shared `ErrorType`:

| Exception | ErrorType | Notes |
|---|---|---|
| `Google::Ads::GoogleAds::Errors::GoogleAdsError` (terminal) | `policy_violation`, `auth_failure`, or `invalid_data` | Uses `GoogleAds::TerminalErrors` |
| `Google::Ads::GoogleAds::Errors::GoogleAdsError` (non-terminal) | `api_outage` | |
| `Aws::S3::Errors::ServiceError` | `api_outage` | |
| `ApplicationClient::Error` with 429 | `rate_limit` | |
| `ApplicationClient::Error` (other) | `api_outage` | |
| `ActiveRecord::RecordNotFound` | `not_found` | |
| `Lockable::LockNotAcquiredError` | `api_outage` | |
| Generic `StandardError` / `RuntimeError` | `internal` | **Fires Sentry warning** — caller should use a specific error type |
| Timeout pattern in message | `timeout` | |

All error types default to **non-recoverable** (`false`). The shared config lives in `shared/types/deploy/jobErrors.ts` and is exported to `shared/exports/jobErrors.json` for Rails consumption.

### Worker Pattern

Every deploy worker follows this pattern:

```ruby
class MyWorker
  include Sidekiq::Worker
  include DeployJobHandler

  sidekiq_options queue: :default, retry: 5  # retry = crash backstop only

  def perform(job_run_id)
    job_run = JobRun.find(job_run_id)
    job_run.start!
    # ... do work ...
    job_run.complete!(result_data)
    job_run.notify_langgraph(status: "completed", result: result_data)
  rescue => e
    handle_deploy_error(job_run, e)  # Fails immediately, notifies Langgraph, no re-raise
  end
end
```

`handle_deploy_error` does:
1. Classifies the error via `ErrorClassifier`
2. Logs the error type + details
3. Calls `job_run.fail!(error)` — marks job as failed
4. Calls `job_run.notify_langgraph(status: "failed", error: ...)` — notifies Langgraph immediately
5. Does **not** re-raise — Sidekiq considers the job done

`sidekiq_retries_exhausted` is a backstop that only fires when the process crashed (the `rescue` block never ran). It marks the job_run as failed and notifies Langgraph.

### Files

- `rails_app/app/workers/concerns/deploy_job_handler.rb` — Shared concern
- `rails_app/app/services/deploy_jobs/error_classifier.rb` — Exception → ErrorType mapping
- `rails_app/lib/job_error_config.rb` — Reads shared error config from JSON
- `shared/types/deploy/jobErrors.ts` — Error types + recoverability rules (source of truth)
- `shared/exports/jobErrors.json` — JSON export for Rails

### Workers Using This Pattern

| Worker | Queue | Purpose |
|---|---|---|
| `WebsiteDeploy::DeployWorker` | critical | Build + upload website |
| `CampaignDeploy::DeployWorker` | critical | 9-step Google Ads sync |
| `GoogleAds::CampaignEnableWorker` | default | Enable campaign after billing |
| `GoogleAds::PaymentCheckWorker` | default | Check Google Ads billing status |
| `GoogleAds::SendInviteWorker` | default | Send Google Ads invitation |

### Tests

- `rails_app/spec/workers/concerns/deploy_job_handler_spec.rb` — Concern behavior
- `rails_app/spec/services/deploy_jobs/error_classifier_spec.rb` — Classification logic
- `rails_app/spec/lib/job_error_config_spec.rb` — Config reader

## Layer 6: Blocking Timeout with Health Check

### Problem

When a blocking task's timeout expires, we need to check Rails for the job's actual status before failing. The webhook may have been lost even though the job completed.

### Solution

When `blockingTimeout` fires, Langgraph checks Rails once for the job status:
- **Completed**: Recover the result and continue (webhook was lost)
- **Failed**: Propagate the error immediately
- **Still running/pending**: Fail immediately — the job is stuck

For website deploys: `blockingTimeout = 3 min` = **3 minutes max**.

### Flow

1. Task starts blocking → `blockingStartedAt = Date.now()`
2. 3 min passes → timeout fires → Langgraph checks Rails
3. Rails says "completed" → recover result, continue
4. Rails says "failed" → propagate error
5. Rails says "still running" → fail as timeout (job is stuck)

### Files

- `langgraph_app/app/nodes/deploy/taskExecutor.ts` — Timeout + health check logic
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

Three paths create support tickets:

1. **Langgraph-classified failures**: Errors are classified with a `needsSupport` flag. Unrecoverable failures (build crashes, unknown errors) pass `needs_support: true` to Rails, which creates a `SupportRequest` (triggers email + Slack + Notion). Transient failures (timeout, network, rate limit) just show retry.

2. **Stuck job detector** (Rails backstop): When the detector finds a job stuck >10 min with an associated deploy, it creates a support ticket directly — no Langgraph dependency. This covers the case where Langgraph itself is down.

3. **Rails ErrorClassifier + Sentry**: When a generic `StandardError`/`RuntimeError` reaches the ErrorClassifier, a Sentry warning is fired indicating the caller needs a more specific error type. This alerts the engineering team to classification gaps.

### Langgraph Error Classification (Frontend Display)

These are the **Langgraph-side** error classifications that determine what the user sees. They are separate from the Rails-side `ErrorClassifier` (which determines worker behavior).

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

Note: `canRetry` means the user can click "Retry" in the UI. All errors allow retry — the user starts a fresh deploy attempt. This is different from Sidekiq retries (which are disabled for deploy workers).

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
