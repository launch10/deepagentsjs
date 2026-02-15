# Fix: Prevent concurrent deploys at every level

## Context

When deploying a website, concurrent `WebsiteDeploy::DeployWorker` jobs can run for the same website. This happens because no layer enforces the invariant that **only one deploy can be in progress per project at a time**. The `deactivate_previous_deploy!` callback only sets `active: false` -- it doesn't cancel in-progress workers, fail stale job_runs, or mark old WebsiteDeploys as terminal. This leads to `Dir.chdir` collisions, stale retry loops, and successful deploys being marked failed.

**Design principle**: The deploy graph is idempotent -- if a deploy is in progress, resume it. The only way to start a fresh deploy is to explicitly cancel the current one first. Every layer enforces this independently.

---

## Changes

### 1. Rails API: Reject deploy creation if one is already in progress

**File**: `rails_app/app/controllers/api/v1/deploys_controller.rb`

The `create` action should check if the project already has an in-progress deploy. If so, return the existing deploy instead of creating a new one. This is the primary gate -- Langgraph's `createDeployNode` calls this endpoint, and if an in-progress deploy exists, the node gets back the existing deploy ID and the graph resumes.

```ruby
def create
  project = current_account.projects.find(params[:project_id])

  # Idempotent: if an in-progress deploy exists, return it instead of creating a new one
  existing = project.deploys.active.in_progress.first
  if existing
    return render json: deploy_json(existing), status: :ok
  end

  deploy = project.deploys.create!(
    status: "pending",
    thread_id: params[:thread_id]
  )
  render json: deploy_json(deploy), status: :created
end
```

This makes the API idempotent -- calling create twice returns the same deploy. Langgraph's `createDeployNode` stores the returned `deployId` in state either way. Since the graph is idempotent (tasks check their own status), resuming on a deploy that's already partway through works naturally.

### 2. Rails: Strengthen `deactivate!` to properly cancel in-progress deploys

**File**: `rails_app/app/models/deploy.rb`

Currently, `deactivate!` just sets `active: false`. When the user clicks "Redeploy", the frontend calls `deactivate` then reloads. The old deploy's Sidekiq workers keep running. Fix: `deactivate!` should also cancel any in-progress work.

```ruby
def deactivate!
  cancel_in_progress! if status.in?(%w[pending running])
  update_column(:active, false)
  chat&.update!(active: false)
  true
end

def cancel_in_progress!
  return unless status.in?(%w[pending running])

  update!(status: "failed", stacktrace: "Superseded by newer deploy")

  # Fail all pending/running job_runs so Sidekiq retries stop notifying Langgraph
  job_runs.where(status: %w[pending running]).find_each do |jr|
    jr.fail!("Deploy superseded by newer deploy")
  end

  # Skip the website_deploy if it hasn't completed
  if website_deploy&.status&.in?(%w[pending building uploading])
    website_deploy.update!(status: "skipped")
  end
end
```

### 3. Rails: Strengthen `deactivate_previous_deploy!` (defense-in-depth)

**File**: `rails_app/app/models/deploy.rb`

The `before_create` callback is the last line of defense. If somehow a new deploy is created while one is in progress (e.g. race condition), properly cancel the old one.

```ruby
def deactivate_previous_deploy!
  previous_deploys = project.deploys.where(active: true).where.not(id: id)

  # Cancel any in-progress deploys -- not just deactivate
  previous_deploys.in_progress.find_each do |old_deploy|
    old_deploy.cancel_in_progress!
  end

  previous_deploys.update_all(active: false)
end
```

### 4. Sidekiq: DeployWorker checks if deploy is still relevant

**File**: `rails_app/app/workers/website_deploy/deploy_worker.rb`

At the top of `perform`, check whether this deploy has been superseded. If the deploy or job_run is already terminal, exit gracefully without retrying.

```ruby
def perform(deploy_id, job_run_id = nil)
  deploy = WebsiteDeploy.find(deploy_id)
  job_run = job_run_id ? JobRun.find_by(id: job_run_id) : nil

  # Guard: deploy was superseded -- exit without retry
  if deploy.status.in?(%w[skipped failed completed])
    Rails.logger.info "Deploy #{deploy_id} already #{deploy.status}, skipping worker"
    return true
  end

  # Guard: job_run was superseded -- exit without retry
  if job_run&.finished?
    Rails.logger.info "JobRun #{job_run_id} already #{job_run.status}, skipping worker"
    return true
  end

  # ... rest of perform unchanged ...
end
```

### 5. Rails: `actually_deploy` returns true for skipped deploys

**File**: `rails_app/app/models/concerns/website_deploy_concerns/deployable.rb`

Currently returns bare `return` (nil) when a later deploy is live. Worker treats nil as failure -> retry loop.

```ruby
# After
if later_deploy_exists
  Rails.logger.info "WebsiteDeploy #{id} skipped -- newer deploy already live for website #{website_id}"
  update!(status: "skipped")
  return true
end
```

### 6. Rails: Replace `Dir.chdir` with thread-safe `system(..., chdir:)`

**File**: `rails_app/app/models/concerns/website_deploy_concerns/buildable.rb`

`Dir.chdir` is process-global. Two Sidekiq threads collide with `conflicting chdir during another chdir block`. `system(..., chdir:)` sets the working directory only for the spawned subprocess.

```ruby
# After
system("pnpm install --ignore-workspace", chdir: temp_dir) or raise "pnpm install failed"
system("pnpm run build", chdir: temp_dir) or raise "pnpm build failed"
```

### 7. Langgraph: Guard jobRunCallback against stale callbacks

**File**: `langgraph_app/app/server/routes/webhooks/jobRunCallback.ts`

After finding the task by `jobId`, check if it's already terminal. Stale retries of cancelled deploys can send callbacks after the task has been processed.

```typescript
// Guard: ignore callbacks for tasks already in terminal state
if (task.status === "completed" || task.status === "skipped" || task.status === "failed") {
  log.warn(
    { jobId: payload.job_run_id, taskName: task.name, status: task.status },
    "Ignoring stale callback -- task already terminal"
  );
  return true;
}
```

### 8. Logging improvements

**deploy_worker.rb**: Include job_run context in the start log:
```ruby
Rails.logger.info "Starting deploy #{deploy_id} for website #{deploy.website_id} (job_run: #{job_run_id || 'none'})"
```

---

## Tests

### Deploy model: cancel_in_progress! and idempotent creation

- `cancel_in_progress!` marks deploy as failed with "Superseded" reason
- `cancel_in_progress!` fails associated pending/running job_runs
- `cancel_in_progress!` skips associated in-progress website_deploy
- `cancel_in_progress!` does nothing for already-terminal deploys
- Creating a new deploy properly cancels (not just deactivates) in-progress deploys
- Creating a new deploy fails job_runs of previous in-progress deploy
- `deactivate!` calls `cancel_in_progress!` for in-progress deploys

### DeploysController: idempotent create

- POST create when in-progress deploy exists -> returns existing deploy (200, not 201)
- POST create when no in-progress deploy -> creates new deploy (201)
- POST create when previous deploy is completed -> creates new deploy (201)

### DeployWorker: superseded deploy handling

- When deploy is already skipped -> returns true, does not call `actually_deploy`
- When deploy is already failed -> returns true, does not call `actually_deploy`
- When job_run is already failed -> returns true, does not call `actually_deploy`

### Langgraph: jobRunCallback stale guard

- `jobRunCallback` with completed task -> returns true, task status unchanged
- `jobRunCallback` with failed task -> returns true, task status unchanged

---

## Files to Modify

| File | Change |
|------|--------|
| `rails_app/app/controllers/api/v1/deploys_controller.rb` | Idempotent create -- return existing in-progress deploy |
| `rails_app/app/models/deploy.rb` | Add `cancel_in_progress!`, strengthen `deactivate!` and `deactivate_previous_deploy!` |
| `rails_app/app/models/concerns/website_deploy_concerns/deployable.rb` | Return `true` for skipped deploys |
| `rails_app/app/models/concerns/website_deploy_concerns/buildable.rb` | Replace `Dir.chdir` with `system(..., chdir:)` |
| `rails_app/app/workers/website_deploy/deploy_worker.rb` | Add superseded-deploy guard, improve logging |
| `langgraph_app/app/server/routes/webhooks/jobRunCallback.ts` | Guard against stale callbacks, add logging |
| `rails_app/spec/models/deploy_spec.rb` | Tests for cancel_in_progress!, idempotent creation |
| `rails_app/spec/requests/deploys_spec.rb` | Tests for idempotent create |
| `rails_app/spec/workers/website_deploy/deploy_worker_spec.rb` | Tests for superseded deploy handling |
| `langgraph_app/tests/tests/routes/jobRunCallback.test.ts` | Tests for stale callback guard |

## Verification

1. `bundle exec rspec spec/models/deploy_spec.rb`
2. `bundle exec rspec spec/requests/deploys_spec.rb`
3. `bundle exec rspec spec/workers/website_deploy/deploy_worker_spec.rb`
4. `cd langgraph_app && pnpm run test -- tests/tests/routes/jobRunCallback.test.ts`

## Open Question: Reaper Layer

Should we add a Sidekiq Reaper that can kill in-process workers or remove stale jobs from the queue? This is an **advanced** layer that could prevent partially-deployed states but adds complexity. Current approach relies on guards (workers check if they're still relevant on entry). A reaper would be useful if:

- Workers do significant damage between the time they're superseded and the time they check
- Queue buildup becomes a problem

**Risk**: Killing a worker mid-deploy could leave partial state (e.g. files written but not uploaded). The guard-based approach is safer because workers complete gracefully. Deferring this to a future iteration unless we observe problems.
