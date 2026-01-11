# Sidekiq to GoodJob Migration Plan

## Overview

Migrate from Sidekiq to GoodJob to gain native batch support for the CampaignDeploy workflow. This enables proper Langgraph notification only when all deploy steps complete or fail as a group.

## Why Migrate?

### The Core Problem

`CampaignDeployWorker` needs Sidekiq Batches behavior:

- Langgraph triggers `CampaignDeployWorker` with a `job_run_id`
- `CampaignDeploy::DeployWorker` runs steps recursively (re-enqueues itself after each step)
- We need to notify Langgraph only when **ALL steps complete or fail as a group**
- Sidekiq Batches ($$$) provides `on_success`/`on_failure` callbacks
- **GoodJob has native batch support for free**

### What We Keep

- **Zhong** - Keep as-is for cron scheduling (supports arbitrary Ruby blocks, GoodJob cron does not)
- **Redis** - Still used by Zhong and Rails caching

## Current State Audit

### Sidekiq Features In Use

| Feature                         | Usage                 | GoodJob Equivalent             |
| ------------------------------- | --------------------- | ------------------------------ |
| `sidekiq_options queue:`        | 14 workers            | `queue_as :queue_name`         |
| `sidekiq_options retry:`        | 12 workers            | `retry_on` / `discard_on`      |
| `sidekiq_retries_exhausted`     | 3 workers             | `discard_on` with block        |
| `sidekiq_retry_in`              | 1 worker              | `retry_on wait:`               |
| Queues (critical, default, low) | 3 queues              | Same, native support           |
| Sidekiq::Web                    | Mounted at `/sidekiq` | GoodJob::Engine at `/good_job` |

### Gems to Remove

```ruby
gem "sidekiq"
gem "sidekiq-unique-jobs"  # NOT ACTUALLY USED - dead dependency
```

### Gems to Keep

```ruby
gem "zhong"  # Cron scheduler - keep as-is
gem "sinatra", require: false  # Required for Zhong web UI
```

### Workers to Convert (14 total)

1. `CampaignDeployWorker`
2. `CampaignDeploy::DeployWorker`
3. `WebsiteDeploy::DeployWorker`
4. `WebsiteDeploy::RollbackWorker`
5. `LanggraphCallbackWorker`
6. `Database::PartitionMaintenanceWorker`
7. `Database::PartitionCleanupWorker`
8. `GoogleDocs::IngestWorker`
9. `GoogleAds::LocationTargeting::IngestWorker`
10. `Domain::MonitorWorker` (if exists)
    11-14. (Other workers found in codebase)

## Spec Migration

### Sidekiq Test Patterns Found

| Pattern                                | Files Using It            | GoodJob Equivalent                              |
| -------------------------------------- | ------------------------- | ----------------------------------------------- |
| `Sidekiq::Testing.fake!`               | 3 worker specs            | Not needed - use `perform_later` + inline mode  |
| `Sidekiq::Worker.clear_all`            | rails_helper.rb + 3 specs | DB transaction rollback handles cleanup         |
| `SomeWorker.jobs.last`                 | 5 places in 3 files       | `GoodJob::Job.where(job_class: 'SomeJob').last` |
| `receive(:perform_async)`              | ~10 specs                 | `receive(:perform_later)`                       |
| `sidekiq_options['queue']`             | 6 assertions              | `queue_as` assertions                           |
| `sidekiq_options['retry']`             | 5 assertions              | `retry_on` config assertions                    |
| `sidekiq_retries_exhausted_block.call` | 4 specs                   | `discard_on` block testing                      |

### Spec Files Requiring Changes

**High Touch:**

- `spec/workers/website_deploy/deploy_worker_spec.rb`
- `spec/workers/website_deploy/rollback_worker_spec.rb`
- `spec/models/website_spec.rb`

**Medium Touch:**

- `spec/workers/campaign_deploy_worker_spec.rb`
- `spec/workers/campaign_deploy/deploy_worker_spec.rb`
- `spec/workers/concerns/job_run_trackable_spec.rb`
- `spec/models/job_run_spec.rb`
- `spec/requests/job_runs_spec.rb`
- `spec/models/campaign_deploy_spec.rb`

**Low Touch:**

- `spec/rails_helper.rb`

## Dev Infrastructure Changes

### Procfile.dev (Before)

```procfile
web: bin/rails server -p $PORT
vite: bin/vite dev
sidekiq: bundle exec sidekiq
zhong: bundle exec zhong schedule.rb
```

### Procfile.dev (After)

```procfile
web: bin/rails server -p $PORT
vite: bin/vite dev
good_job: bundle exec good_job start
zhong: bundle exec zhong schedule.rb
```

### config/services.sh Updates

Replace references to `sidekiq` process with `good_job`.

### schedule.rb Updates

Update any direct `perform_async` calls to `perform_later`:

```ruby
# Before
every(1.day, "partition maintenance") { Database::PartitionMaintenanceWorker.perform_async }

# After
every(1.day, "partition maintenance") { Database::PartitionMaintenanceJob.perform_later }
```

## Migration Phases

### Phase 1: Add GoodJob (2 hours)

1. Add `gem "good_job"` to Gemfile
2. Run `rails g good_job:install`
3. Run migrations (creates `good_jobs` and `good_job_batches` tables)
4. Configure in `config/application.rb`:

```ruby
config.active_job.queue_adapter = :good_job
config.good_job.execution_mode = :external
config.good_job.queues = "critical:5;default:3;low:1"
```

### Phase 2: Convert Workers (3 hours)

For each worker:

```ruby
# Before (Sidekiq)
class MyWorker
  include Sidekiq::Worker
  sidekiq_options queue: :critical, retry: 5

  sidekiq_retries_exhausted do |msg, ex|
    # handle exhaustion
  end

  def perform(id)
    # work
  end
end

# After (ActiveJob + GoodJob)
class MyJob < ApplicationJob
  queue_as :critical
  retry_on StandardError, wait: :polynomially_longer, attempts: 5

  discard_on StandardError do |job, error|
    # handle exhaustion (same logic)
  end

  def perform(id)
    # work (unchanged)
  end
end
```

### Phase 3: Migrate Specs (2-3 hours)

1. Remove `require 'sidekiq/testing'` from rails_helper
2. Update mock expectations: `perform_async` → `perform_later`
3. Replace `.jobs` queue inspection with ActiveJob test helpers
4. Update `sidekiq_options` assertions
5. Update `sidekiq_retries_exhausted_block` tests

### Phase 4: Update Dev Infrastructure (30 min)

1. Update `Procfile.dev`
2. Update `config/services.sh`
3. Update `bin/services` if needed
4. Replace `/sidekiq` route with `/good_job`

### Phase 5: Remove Old Dependencies (15 min)

```ruby
# Remove from Gemfile
gem "sidekiq"
gem "sidekiq-unique-jobs"
```

Delete:

- `config/initializers/sidekiq.rb`

### Phase 6: Implement Batch Workflow for Langgraph Notification

#### The Problem

Current `CampaignDeployWorker` runs with `async: false`, meaning ALL steps execute synchronously in one job:

```ruby
def deploy_campaign
  campaign_deploy = CampaignDeploy.deploy(campaign, async: false)  # blocks until ALL done
  complete_job_run!(result)  # then notifies Langgraph
end
```

This works but:
- All steps in one long-running job (risk of timeout)
- If step 8 fails, retry from step 1
- No ability to parallelize independent steps

If we tried `async: true`, the recursive chain would spawn separate jobs, but `complete_job_run!` would fire immediately before steps finish.

#### The Solution: Batch with `batch.add`

Use GoodJob batch to wrap the recursive chain. Each step adds the next step to the **same batch** via `batch.add`. The `on_finish` callback only fires when the batch is empty (all jobs complete).

```ruby
# app/jobs/campaign_deploy_job.rb
class CampaignDeployJob < ApplicationJob
  queue_as :critical

  def perform(job_run_id)
    job_run = JobRun.find(job_run_id)
    campaign = Campaign.find(job_run.job_args["campaign_id"])
    deploy = CampaignDeploy.create!(campaign: campaign, status: "pending")

    GoodJob::Batch.enqueue(
      on_finish: DeployCompleteJob,
      properties: { job_run_id: job_run_id, deploy_id: deploy.id }
    ) do
      DeployStepJob.perform_later(deploy.id)
    end
  end
end
```

```ruby
# app/jobs/deploy_step_job.rb
class DeployStepJob < ApplicationJob
  include GoodJob::ActiveJobExtensions::Batches

  queue_as :critical
  retry_on StandardError, wait: :polynomially_longer, attempts: 3

  def perform(deploy_id)
    deploy = CampaignDeploy.find(deploy_id)
    step = deploy.next_step

    # No more steps = done (batch will fire on_finish)
    return if step.nil?

    step.run unless step.finished?
    deploy.update!(current_step: step.class.step_name.to_s)

    unless step.finished?
      raise CampaignDeploy::StepNotFinishedError,
            "Step #{step.class.step_name} did not complete"
    end

    # Add next iteration to the SAME batch
    batch.add { DeployStepJob.perform_later(deploy_id) }
  end
end
```

```ruby
# app/jobs/deploy_complete_job.rb
class DeployCompleteJob < ApplicationJob
  def perform(batch, context)
    job_run = JobRun.find(batch.properties[:job_run_id])
    deploy = CampaignDeploy.find(batch.properties[:deploy_id])

    if context[:event] == :discard
      deploy.update!(status: "failed")
      job_run.fail!("Deploy failed at step: #{deploy.current_step}")
      job_run.notify_langgraph(status: "failed", error: "Step #{deploy.current_step} failed")
    else
      deploy.update!(status: "completed")
      result = {
        campaign_id: deploy.campaign_id,
        campaign_deploy_id: deploy.id,
        status: "completed"
      }
      job_run.complete!(result)
      job_run.notify_langgraph(status: "completed", result: result)
    end
  end
end
```

#### Visual Flow

```
Langgraph
   │
   ├─POST /api/v1/job_runs───────►Rails creates JobRun
   │                               │
   │                               ▼
   │                        CampaignDeployJob.perform_later(job_run_id)
   │                               │
   │                               ▼
   │                        ┌─────────────────────────────────────┐
   │                        │ GoodJob::Batch                      │
   │                        │   properties: {job_run_id, deploy_id}│
   │                        │   on_finish: DeployCompleteJob      │
   │                        └──────────────┬──────────────────────┘
   │                                       │
   │                                       ▼
   │                        ┌──────────────────────────────┐
   │                        │ DeployStepJob (step 1)       │
   │                        │   └── batch.add { step 2 }   │
   │                        └──────────────┬───────────────┘
   │                                       │
   │                                       ▼
   │                        ┌──────────────────────────────┐
   │                        │ DeployStepJob (step 2)       │
   │                        │   └── batch.add { step 3 }   │
   │                        └──────────────┬───────────────┘
   │                                       │
   │                                       ▼
   │                                      ...
   │                                       │
   │                                       ▼
   │                        ┌──────────────────────────────┐
   │                        │ DeployStepJob (step N)       │
   │                        │   └── next_step.nil? return  │
   │                        └──────────────┬───────────────┘
   │                                       │
   │                                       │ batch now empty
   │                                       ▼
   │                        ┌──────────────────────────────┐
   │                        │ DeployCompleteJob            │
   │                        │   └── job_run.complete!      │
   │                        │   └── notify_langgraph       │
   │                        └──────────────────────────────┘
   │                                       │
   │◄──────────────────webhook─────────────┘
```

#### Why This Works

1. **`batch.add` keeps jobs in the same batch** - Each step adds the next, batch stays open
2. **`on_finish` waits for empty batch** - Only fires when no jobs remain
3. **Retries stay in batch** - Failed job retries still count as batch members
4. **Discards trigger callback** - `context[:event] == :discard` means a job exhausted retries
5. **Keeps existing step logic** - `next_step`, `step.run`, `step.finished?` unchanged

#### Key Change from Current Code

| Current | New |
|---------|-----|
| `CampaignDeploy.deploy(async: false)` blocks | `CampaignDeployJob` enqueues batch and returns |
| All steps in one job | Each step is separate job |
| Retry = restart all steps | Retry = restart failed step only |
| `complete_job_run!` after sync loop | `DeployCompleteJob` callback after batch empty |

## Implementation Order

1. Add GoodJob gem + run migrations
2. Configure GoodJob in `config/application.rb`
3. Create `CampaignDeployJob` (batch orchestrator)
4. Create `DeployStepJob` (recursive step runner with `batch.add`)
5. Create `DeployCompleteJob` (callback for Langgraph notification)
6. Convert remaining Sidekiq workers to ActiveJob
7. Update specs (`perform_async` → `perform_later`, remove Sidekiq testing helpers)
8. Update dev infrastructure (Procfile.dev, services.sh)
9. Remove Sidekiq dependencies

## Benefits After Migration

1. **Native batch support** - `on_finish`, `on_success`, `on_discard` callbacks
2. **DAG workflow support** - Phases with parallel steps, proper dependency ordering
3. **Single Langgraph notification** - Only notify when ALL phases complete (or any fails)
4. **Transactional enqueuing** - Jobs enqueued inside DB transaction only run if transaction commits
5. **PostgreSQL-backed** - No Redis dependency for jobs (only for Zhong cron + caching)
6. **Better dashboard** - GoodJob::Engine has excellent UI

## Risks & Mitigations

| Risk                      | Mitigation                                               |
| ------------------------- | -------------------------------------------------------- |
| Job loss during migration | Run both adapters briefly, drain Sidekiq queue first     |
| Performance regression    | GoodJob benchmarks well; monitor after deploy            |
| Spec failures             | Mechanical changes, run full suite before merge          |
| Zhong compatibility       | Minimal changes (just `perform_async` → `perform_later`) |

## Rollback Plan

If issues arise:

1. Revert Gemfile changes
2. Restore `config/initializers/sidekiq.rb`
3. Revert Procfile.dev
4. GoodJob tables can remain (no harm)
