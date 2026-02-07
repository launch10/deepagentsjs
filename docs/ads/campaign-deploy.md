# Campaign Deploy

Campaign deployment syncs the locally-built campaign to Google Ads via a **step-by-step background worker**. Each step is atomic and idempotent — the worker runs one step, enqueues itself for the next, and reports back to Langgraph when all steps complete.

## Deploy Steps (Sequential)

| # | Step | What It Does |
|---|------|-------------|
| 1 | sync_budget | Create/update campaign budget in Google |
| 2 | create_campaign | Create campaign resource in Google |
| 3 | create_geo_targeting | Add location targets (geo/radius) |
| 4 | create_schedule | Add ad schedules (day/time) |
| 5 | create_callouts | Add callout extensions |
| 6 | create_structured_snippets | Add structured snippet extensions |
| 7 | create_ad_groups | Create ad groups |
| 8 | create_keywords | Create keywords in each ad group |
| 9 | create_ads | Create responsive search ads |

## How It Works

```
Langgraph deploy graph
  └─ DeployingCampaign task
       │
       │ POST /api/v1/job_runs { job_class: "CampaignDeploy::DeployWorker" }
       ▼
Rails creates JobRun + CampaignDeploy
       │
       │ Sidekiq (critical queue)
       ▼
DeployWorker.perform(deploy_id, job_run_id)
  ├─ Lock deploy (prevents concurrent execution)
  ├─ Find next_step (first unfinished step)
  ├─ step.run() → calls GoogleAds::Resources::*.sync()
  ├─ Update current_step
  ├─ Re-enqueue self for next step
  │   ... (repeats until all steps done)
  └─ On completion:
       ├─ job_run.complete!({ status: "completed" })
       └─ job_run.notify_langgraph (webhook callback)
```

## Enabling Campaigns

After deploy completes, the `EnablingCampaign` task in the deploy graph:

1. Checks `google_ready_to_enable?` (channel type, bidding, billing all configured)
2. Enqueues `GoogleAds::CampaignEnableWorker`
3. Worker calls `campaign.enable!()` which sets Google status to ENABLED
4. Notifies Langgraph of completion

## Key Files Index

| File | Purpose |
|------|---------|
| `rails_app/app/models/campaign_deploy.rb` | Deploy model (steps, status, locking) |
| `rails_app/app/workers/campaign_deploy/deploy_worker.rb` | Step-by-step worker (critical, 5 retries) |
| `rails_app/app/workers/google_ads/campaign_enable_worker.rb` | Enables campaign after deploy |
| `rails_app/app/services/google_ads/resources/*.rb` | Per-resource sync services |
| `langgraph_app/app/nodes/deploy/deployCampaignNode.ts` | Langgraph task that triggers deploy |
| `langgraph_app/app/nodes/deploy/enableCampaignNode.ts` | Langgraph task that triggers enable |

## Gotchas

- **Locking prevents concurrent deploys**: The `Lockable` mixin ensures only one deploy runs at a time per campaign. A second deploy request will wait or fail.
- **Idempotent steps**: Each step checks `finished?` before running. Re-running the worker is safe.
- **One step per worker iteration**: The worker processes one step, then re-enqueues itself. This provides visibility into which step is active and allows Sidekiq retries per-step.
- **Sync plan for dry runs**: `CampaignDeploy` supports `sync_plan()` which shows creates/updates/deletes without executing them. Useful for debugging.
