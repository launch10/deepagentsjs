# Deploy Pipeline

The deploy pipeline is a task-based state machine orchestrated by a Langgraph graph. It runs up to 11 tasks in sequence — validating links, checking for runtime bugs, fixing issues with AI, building the site, uploading to Cloudflare R2, and optionally deploying Google Ads campaigns. Tasks that depend on Rails background jobs suspend and resume via webhook callbacks.

## Task Execution Order

| # | Task | Scope | Skippable? | Recoverable? |
|---|------|-------|------------|--------------|
| 1 | ConnectingGoogle | Campaign only | Yes | No |
| 2 | VerifyingGoogle | Campaign only | Yes | No |
| 3 | AddingAnalytics | All | Yes (no website) | No |
| 4 | OptimizingSEO | All | No | No |
| 5 | ValidateLinks | All | No | Yes |
| 6 | RuntimeValidation | All | No | Yes |
| 7 | FixingBugs | Conditional | Only if validation fails | No |
| 8 | DeployingWebsite | All | No | No |
| 9 | DeployingCampaign | Campaign only | No | No |
| 10 | CheckingBilling | Campaign | Yes (already verified) | No |
| 11 | EnablingCampaign | Campaign | No | No |

## How It Works

```
POST /api/deploy/stream { threadId, state }
       │
       ▼
initPhasesNode → compute task list from deploy config
       │
       ▼
taskExecutor (loop)
  ├─ Find next ready task (by order)
  ├─ Check state:
  │   ├─ completed/skipped → next task
  │   ├─ failed (recoverable) → skip, continue
  │   ├─ failed (non-recoverable) → STOP graph
  │   ├─ running + blocking → EXIT (wait for webhook)
  │   └─ pending → EXECUTE task
  ├─ Run task's runner function
  └─ Loop back
       │
       ▼
All tasks complete → END
```

## Website Deploy Flow

1. `DeployingWebsite` task creates a `JobRun` and enqueues `WebsiteDeploy::DeployWorker`
2. Graph suspends (task is "running + blocking")
3. Sidekiq worker runs:
   - **Build**: Write files to `/tmp/`, inject `.env` (signup token, API URL, gtag), run `pnpm install && pnpm build`
   - **Upload**: Push `dist/` to R2 at `{project_id}/{timestamp}/`, then hotswap `timestamp/ → live/`
   - **Sync**: `website.sync_all_to_atlas` pushes metadata to Cloudflare KV
4. Worker completes → `LanggraphCallbackWorker` fires webhook → graph resumes
5. Task marked complete, executor moves to next task

## Validation & Bug Fixing

**ValidateLinks**: Static analysis — checks anchor `href` values against element IDs and route definitions.

**RuntimeValidation**: Launches Playwright, starts a dev server via `WebsiteRunner`, checks for console errors and Vite overlay errors. Only actual errors fail (warnings ignored).

**FixingBugs**: Triggered only when validation fails. Uses the coding agent to analyze errors, fix code, then re-validate. This creates a cycle: validate → fix → re-validate.

## Key Files Index

| File | Purpose |
|------|---------|
| `langgraph_app/app/graphs/deploy.ts` | Deploy graph definition |
| `langgraph_app/app/nodes/deploy/taskExecutor.ts` | Task loop: find next, execute, handle results |
| `langgraph_app/app/nodes/deploy/taskRunner.ts` | TaskRunner interface |
| `langgraph_app/app/nodes/deploy/*Node.ts` | Individual task runners (11 files) |
| `langgraph_app/app/annotation/deployAnnotation.ts` | Deploy graph state definition |
| `shared/types/deploy/tasks.ts` | Task definitions and TASK_ORDER |
| `shared/types/deploy/phase.ts` | User-facing phase definitions |
| `rails_app/app/models/deploy.rb` | Deploy model (pending/running/completed/failed) |
| `rails_app/app/models/website_deploy.rb` | WebsiteDeploy (build + upload lifecycle) |
| `rails_app/app/models/campaign_deploy.rb` | CampaignDeploy (step-by-step Google Ads) |
| `rails_app/app/models/concerns/website_deploy_concerns/buildable.rb` | Build process (pnpm install/build) |
| `rails_app/app/models/concerns/website_deploy_concerns/deployable.rb` | R2 upload + hotswap |
| `rails_app/app/uploaders/deploy_uploader.rb` | R2 file upload with atomic hotswap |
| `rails_app/app/workers/website_deploy/deploy_worker.rb` | Sidekiq worker (critical queue, 5 retries) |

## Gotchas

- **Atomic hotswap**: The deploy copies files from a timestamped directory to `live/` in R2. This is not truly atomic — there's a brief window where `live/` is being rebuilt. But it's fast enough for practical purposes.
- **Recoverable vs fatal failures**: `ValidateLinks` and `RuntimeValidation` are recoverable (trigger bug fixing). All other task failures are fatal and stop the graph.
- **Campaign deploy is step-by-step**: Unlike website deploy (one build), campaign deploy runs sequential steps (Budget → Campaign → Targeting → Ads) with locking to prevent parallel execution.
- **`sync_all_to_atlas`**: After R2 upload, Rails syncs account, domain, website_url, plan, and website metadata to Atlas KV. All five syncs must succeed for the site to be routable.
