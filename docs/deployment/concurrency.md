# Deploy Concurrency Protection

Only one deploy can be in progress per project at a time. This invariant is enforced at every layer — API, model, worker, Langgraph, and database — so that no single layer is a single point of failure.

## Why This Matters

Without concurrency guards, two `WebsiteDeploy::DeployWorker` jobs can run simultaneously for the same website. This causes `Dir.chdir` collisions (process-global), stale Sidekiq retry loops, and successful deploys being marked as failed when an older worker overwrites a newer one's state.

## Defense Layers

```
Request arrives
    │
    ▼
[1] API: return existing in-progress deploy (idempotent create)
    │
    ▼
[2] DB: unique index rejects second active deploy (TOCTOU backstop)
    │
    ▼
[3] Model: cancel_in_progress! terminates old deploy atomically
    │
    ▼
[4] Worker: guard at top of perform — bail if deploy/job_run is terminal
    │
    ▼
[5] Langgraph: ignore stale callbacks for terminal tasks
    │
    ▼
[6] Build: thread-safe system(..., chdir:) instead of Dir.chdir
```

### Layer 1: API — Idempotent Create

`POST /api/v1/deploys` checks for an existing active, in-progress deploy before creating. If one exists, it returns that deploy (200) instead of creating a new one (201). This is the primary gate — Langgraph's `createDeployNode` stores whichever `deployId` comes back.

```ruby
# deploys_controller.rb
existing = project.deploys.active.in_progress.first
return render json: deploy_json(existing), status: :ok if existing
```

### Layer 2: Database — Unique Index

A partial unique index on `(project_id, active) WHERE active = true AND deleted_at IS NULL` guarantees at most one active deploy per project at the database level. This catches TOCTOU races where two requests pass the check simultaneously but only one INSERT succeeds.

The controller rescues `ActiveRecord::RecordNotUnique` and returns the winning deploy:

```ruby
rescue ActiveRecord::RecordNotUnique
  existing = project.deploys.active.in_progress.first!
  render json: deploy_json(existing), status: :ok
```

### Layer 3: Model — Atomic Cancellation

`Deploy#cancel_in_progress!` terminates a deploy and all its associated records in a single transaction:

```ruby
def cancel_in_progress!
  return unless status.in?(%w[pending running])

  transaction do
    update!(status: "failed", stacktrace: "Superseded by newer deploy")
    job_runs.where(status: %w[pending running]).find_each { |jr| jr.fail!("Deploy superseded") }
    website_deploy.update!(status: "skipped") if website_deploy&.status&.in?(%w[pending building uploading])
  end
end
```

This is called from two places:

- **`deactivate!`** — when the user clicks Redeploy (frontend calls `POST /api/v1/deploys/deactivate`)
- **`deactivate_previous_deploy!`** — `before_create` callback on new deploys (defense-in-depth)

The transaction ensures all-or-nothing: if any step fails, the deploy stays in its original state.

### Layer 4: Worker — Superseded Deploy Guard

At the top of `DeployWorker#perform`, the worker checks whether the deploy or job_run has already been cancelled. If so, it returns `true` (no Sidekiq retry):

```ruby
def perform(deploy_id, job_run_id = nil)
  deploy = WebsiteDeploy.find(deploy_id)
  return true if deploy.status.in?(%w[skipped failed completed])

  job_run = job_run_id ? JobRun.find_by(id: job_run_id) : nil
  return true if job_run&.finished?
  # ...
end
```

This prevents stale Sidekiq retries from doing work after a deploy has been superseded.

### Layer 5: Langgraph — Stale Callback Guard

The `jobRunCallback` webhook handler checks whether the task is already in a terminal state before updating graph state:

```typescript
if (task.status === "completed" || task.status === "skipped" || task.status === "failed") {
  log.warn({ jobId, taskName: task.name, status: task.status }, "Ignoring stale callback");
  return true;
}
```

This prevents stale webhook deliveries from reviving cancelled tasks in the Langgraph graph.

### Layer 6: Build — Thread-Safe Subprocess

`Dir.chdir` is process-global and causes `conflicting chdir during another chdir block` when two Sidekiq threads build simultaneously. Replaced with `system(..., chdir:)` which scopes the working directory to the spawned subprocess:

```ruby
system("pnpm install --ignore-workspace", chdir: temp_dir) or raise "pnpm install failed"
system("pnpm run build", chdir: temp_dir) or raise "pnpm build failed"
```

### Bonus: Skipped Deploy Return Value

`WebsiteDeploy#actually_deploy` returns `true` (not `nil`) when a later deploy is already live. This prevents the worker from treating a skip as a failure and entering a retry loop.

## Known Edge Case

If a worker is **mid-execution** (building or uploading) when `cancel_in_progress!` runs, the worker holds stale in-memory objects and can overwrite the cancelled state. The result is a "failed" Deploy with a website that actually deployed successfully.

**Why this is acceptable**: The frontend does not expose the Redeploy button while a deploy is in progress. This scenario requires direct API manipulation. The system self-heals on the next deploy.

**Future mitigation**: A Sidekiq Reaper that sends a graceful shutdown signal (SIGTERM/USR1) to in-progress workers, letting them checkpoint and stop. Or optimistic locking (`lock_version`) on WebsiteDeploy so stale writes raise `StaleObjectError`.

## Key Files

| File | Role |
|------|------|
| `app/controllers/api/v1/deploys_controller.rb` | Idempotent create, TOCTOU rescue |
| `app/models/deploy.rb` | `cancel_in_progress!`, `deactivate!`, `deactivate_previous_deploy!` |
| `app/models/concerns/website_deploy_concerns/deployable.rb` | `actually_deploy` skip handling |
| `app/models/concerns/website_deploy_concerns/buildable.rb` | Thread-safe build |
| `app/workers/website_deploy/deploy_worker.rb` | Superseded deploy guard |
| `langgraph_app/app/server/routes/webhooks/jobRunCallback.ts` | Stale callback guard |
| `db/migrate/*_add_unique_index_deploys_on_active_project.rb` | Unique partial index |

## Test Coverage

| File | What's tested |
|------|---------------|
| `spec/models/deploy_spec.rb` | `cancel_in_progress!` state transitions, atomicity rollback, unique index rejection, deactivate! cancellation |
| `spec/requests/deploys_spec.rb` | Idempotent create, TOCTOU rescue, completed/failed deploy allows new create |
| `spec/workers/website_deploy/deploy_worker_spec.rb` | Superseded deploy/job_run guards |
| `langgraph_app/tests/tests/routes/jobRunCallback.test.ts` | Stale callback guard for completed/failed/skipped tasks |
