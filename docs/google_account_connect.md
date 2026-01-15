# Google Account Connection & Deploy Workflow

Complete workflow documentation for the deploy process, including Google OAuth connection and Google Ads invite verification.

## Overview

This is a complex async workflow that spans:
- **Frontend**: Deploy.tsx + useDeployChat hook
- **Langgraph**: Deploy graph with subgraphs for OAuth and invite verification
- **Rails**: Controllers, workers, and background job scheduling

The workflow uses a combination of:
- SSE streaming for initial deploy
- Webhook callbacks for async job completion
- Frontend polling for status updates
- Batch scheduling for invite polling and cleanup

---

## Complete Workflow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         DEPLOY WORKFLOW (COMPLETE)                               │
│                                                                                  │
│  Legend: ✅ = Fixed today  |  🔄 = Async/webhook  |  ⏱️ = Has timeout           │
└─────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────┐
│ PHASE 1: INITIALIZATION                                                          │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│ 1. User navigates to /projects/:uuid/deploy                                      │
│    └── projects_controller#deploy                                                │
│        └── Creates Deploy record (or finds existing in_progress)                 │
│        └── Renders Deploy.tsx with props:                                        │
│            { deploy: { id, status, langgraph_thread_id }, jwt, ... }            │
│                                                                                  │
│ 2. Deploy.tsx mounts, useDeployChat hook initializes                             │
│    └── Checks deploy.langgraph_thread_id from props                              │
│        ├── If EXISTS: use it (user refreshed page)                               │
│        └── If NULL: generate `deploy-${deploy.id}-${Date.now()}`                 │
│                                                                                  │
│ 3. Auto-start OR user clicks "Deploy Campaign"                                   │
│    └── useEffect triggers if deploy.status === "pending" && no thread_id         │
│    └── Calls startDeploy()                                                       │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────┐
│ PHASE 2: LANGGRAPH STREAM START                                                  │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│ 4. Frontend POST /api/deploy/stream                                              │
│    └── Body: { threadId, deployId, websiteId, campaignId, state }               │
│                                                                                  │
│ 5. Langgraph deploy.ts handler                                                   │
│    └── FIRST: DeployService.saveThreadId(deployId, threadId)                     │
│        └── Writes to DB via Drizzle:                                             │
│            - langgraph_thread_id = threadId                                      │
│            - status = "running"                                                  │
│            - user_active_at = NOW                                                │
│    └── THEN: graph.stream(initialState, { thread_id: threadId })                │
│    └── Returns SSE stream to frontend                                            │
│                                                                                  │
│ 6. Deploy graph starts                                                           │
│    └── deployGraph checks shouldDeployAnything(state)                            │
│        ├── If website: routes to deployWebsite subgraph                          │
│        └── If googleAds: routes to deployCampaign subgraph                       │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────┐
│ PHASE 3: GOOGLE OAUTH CONNECTION (if needed)                                     │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│ 7. deployCampaign subgraph: shouldSkipGoogleConnect                              │
│    └── GoogleAPIService.getConnectionStatus() → Rails /api/v1/google/status      │
│        ├── If connected: true → skip to step 14 (checkGoogleVerify)              │
│        └── If not connected: false → continue to step 8                          │
│                                                                                  │
│ 8. enqueueGoogleConnect node                                                     │
│    └── Creates task: { name: "ConnectingGoogle", status: "enqueued" }            │
│                                                                                  │
│ 9. googleConnectNode (first invocation)                                          │
│    └── JobRunAPIService.create({                                                 │
│            jobClass: "GoogleOAuthConnect",                                       │
│            threadId: state.threadId,                                             │
│            arguments: {}                                                         │
│        })                                                                        │
│    └── Rails creates JobRun, returns { id: 123 }                                 │
│    └── Updates task: {                                                           │
│            status: "running",                                                    │
│            jobId: 123,                                                           │
│            result: { action: "oauth_required" }  ← Frontend looks for this      │
│        }                                                                         │
│    └── Graph reaches END (waiting for webhook)                                   │
│                                                                                  │
│ 10. Frontend detects OAuth needed                                                │
│     └── Deploy.tsx checks:                                                       │
│         task.name === "ConnectingGoogle" &&                                      │
│         task.result?.action === "oauth_required" &&                              │
│         !task.result?.google_email                                               │
│     └── Renders: "Connect with Google" button                                    │
│     └── Link: /auth/google_oauth2?redirect_to=/projects/:uuid/deploy             │
│                                                                                  │
│ 11. User clicks OAuth button                                                     │
│     └── Browser redirects to Google OAuth consent screen                         │
│     └── User approves access                                                     │
│     └── Google redirects to Rails callback                                       │
│                                                                                  │
│ 12. Rails OAuth callback                                                         │
│     └── omniauth_callbacks_controller#google_oauth2_connected                    │
│     └── Gets account from connected_account.owner.owned_account                  │
│     └── Finds active deploy:                                                     │
│         Deploy.joins(project: :account)                                          │
│           .where(projects: { account_id: account.id })                           │
│           .in_progress                                                           │
│           .user_recently_active  ← user_active_at > 5.minutes.ago               │
│           .order(user_active_at: :desc)                                          │
│           .first                                                                 │
│     └── Finds JobRun via deploy (or falls back to account):                      │
│         deploy.job_runs.where(job_class: "GoogleOAuthConnect", status: "running")│
│     └── job_run.complete!({ google_email: connected_account.email })             │
│     └── job_run.notify_langgraph(status: "completed", result: {...})             │
│         └── Enqueues LanggraphCallbackWorker                                     │
│                                                                                  │
│ 13. 🔄 LanggraphCallbackWorker delivers webhook ⏱️ 30min timeout                │
│     └── POST /webhooks/job_run_callback                                          │
│         Body: { job_run_id, thread_id, status: "completed", result: {...} }      │
│     └── jobRunCallback.ts handler:                                               │
│         └── Uses shared checkpointer (graphParams)                               │
│         └── graph.getState({ thread_id })                                        │
│         └── Finds task by jobId, updates with result                             │
│         └── graph.updateState() ← THIS RUNS THE GRAPH                           │
│                                                                                  │
│ 14. googleConnectNode (second invocation via webhook)                            │
│     └── Sees task.result.google_email exists                                     │
│     └── Returns: task with status: "completed"                                   │
│     └── Graph routes to checkGoogleVerify                                        │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────┐
│ PHASE 4: GOOGLE ADS INVITE VERIFICATION (if needed)                              │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│ 15. checkGoogleVerify → shouldSkipGoogleVerify                                   │
│     └── GoogleAPIService.getInviteStatus() → Rails /api/v1/google/invite_status  │
│         ├── If accepted: true → skip to step 24 (enqueueDeployCampaign)          │
│         └── If not accepted: false → continue to step 16                         │
│                                                                                  │
│ 16. enqueueGoogleVerify node                                                     │
│     └── Creates task: { name: "VerifyingGoogle", status: "enqueued" }            │
│                                                                                  │
│ 17. verifyGoogleNode (first invocation)                                          │
│     └── JobRunAPIService.create({                                                │
│             jobClass: "GoogleAdsInvite",                                         │
│             threadId: state.threadId,                                            │
│             deployId: state.deployId  ← Links job to deploy                     │
│         })                                                                       │
│     └── Rails creates JobRun, dispatches SendInviteWorker                        │
│     └── Updates task: { status: "running", jobId: 456 }                          │
│     └── Graph reaches END (waiting for webhook)                                  │
│                                                                                  │
│ 18. SendInviteWorker runs                                                        │
│     └── job_run.start!                                                           │
│     └── ads_account.google_sync (if needed)                                      │
│     └── ads_account.send_google_ads_invitation_email                             │
│     └── PollInviteAcceptanceWorker.perform_async(job_run_id) ← Immediate poll   │
│                                                                                  │
│ 19. Frontend shows "Waiting for acceptance" UI                                   │
│     └── Deploy.tsx detects:                                                      │
│         task.name === "VerifyingGoogle" &&                                       │
│         task.status === "running" &&                                             │
│         !task.result?.status                                                     │
│     └── Renders: "Check your inbox and accept the invitation"                    │
│     └── Shows spinner: "Waiting for acceptance..."                               │
│                                                                                  │
│ 20. Frontend polling loop ⏱️ 30min max                                           │
│     └── useDeployChat.startPolling()                                             │
│     └── GET /api/deploy/stream?threadId=... every 3s (then 10s after 5min)       │
│     └── Each poll: graph.getState() returns current state                        │
│     └── setState(data.state) + stateRef.current = data.state                     │
│     └── Checks: if status === "completed" || "failed" → stopPolling()            │
│     └── Checks: if elapsed > 30min → timeout error                               │
│                                                                                  │
│ 21. verifyGoogleNode (invoked on each poll via getState touch)                   │
│     └── Sees task.status === "running" && task.jobId exists                      │
│     └── DeployService.touch(state.deployId) ← Direct Drizzle write              │
│         └── Updates: user_active_at = NOW                                        │
│     └── Returns {} (no state change, just keeping deploy alive)                  │
│                                                                                  │
│ 22. 🔄 Batch scheduler (every 30s via Zhong)                                     │
│     └── PollActiveInvitesWorker.perform                                          │
│     └── FIRST: fail_stale_jobs() ⏱️                                              │
│         └── JobRun.running                                                       │
│             .where(job_class: ["GoogleOAuthConnect", "GoogleAdsInvite"])         │
│             .where(started_at: < 30.minutes.ago)                                 │
│         └── For each: job_run.fail!("Timed out")                                 │
│         └── job_run.notify_langgraph(status: "failed", error: "...")             │
│     └── THEN: poll_active_invites()                                              │
│         └── Deploy.in_progress.user_recently_active                              │
│             .joins(:job_runs)                                                    │
│             .where(job_runs: { status: "running", job_class: "GoogleAdsInvite" })│
│         └── For each: PollInviteAcceptanceWorker.perform_async(job_run.id)       │
│                                                                                  │
│ 23. 🔄 PollInviteAcceptanceWorker runs ⏱️ 30min timeout                         │
│     └── job_run = JobRun.find(id)                                                │
│     └── return unless job_run.running?                                           │
│     └── TIMEOUT CHECK:                                                           │
│         if job_run.started_at < 30.minutes.ago                                   │
│           job_run.fail!("Timed out")                                             │
│           job_run.notify_langgraph(status: "failed")                             │
│           return                                                                 │
│     └── invitation = job_run.account.ads_account.google_account_invitation       │
│     └── invitation.google_refresh_status (calls Google API)                      │
│     └── IF invitation.accepted?                                                  │
│         └── job_run.complete!({ status: "accepted" })                            │
│         └── job_run.notify_langgraph(status: "completed", result: {...})         │
│             └── Enqueues LanggraphCallbackWorker                                 │
│                                                                                  │
│ 24. 🔄 Webhook updates task, graph runs                                          │
│     └── POST /webhooks/job_run_callback                                          │
│     └── Updates task with result: { status: "accepted" }                         │
│     └── graph.updateState() runs the graph                                       │
│                                                                                  │
│ 25. verifyGoogleNode (final invocation)                                          │
│     └── Sees task.result.status === "accepted"                                   │
│     └── Returns: task with status: "completed"                                   │
│     └── Graph routes to enqueueDeployCampaign                                    │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────┐
│ PHASE 5: CAMPAIGN DEPLOYMENT                                                     │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│ 26. enqueueDeployCampaign node                                                   │
│     └── Creates task: { name: "DeployingCampaign", status: "enqueued" }          │
│                                                                                  │
│ 27. deployCampaignNode runs                                                      │
│     └── Actually deploys campaign to Google Ads                                  │
│     └── Updates task: { status: "completed", result: { campaignId: ... } }       │
│     └── Graph reaches END                                                        │
│                                                                                  │
│ 28. Frontend polling receives final state                                        │
│     └── state.status === "completed"                                             │
│     └── stopPolling() called (using fresh state, not stale closure)              │
│     └── Deploy.tsx renders success UI                                            │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Error Recovery Paths

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│ ERROR RECOVERY PATHS                                                             │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│ ❌ User refreshes page mid-deploy                                                │
│    └── threadId persisted to deploy.langgraph_thread_id                          │
│    └── useDeployChat reads from props, uses existing threadId                    │
│    └── Polling resumes, reconnects to same graph thread                          │
│                                                                                  │
│ ❌ User abandons OAuth (closes browser)                                          │
│    └── Batch scheduler finds stale GoogleOAuthConnect jobs (>30min)              │
│    └── Fails job, notifies langgraph                                             │
│    └── Graph task marked failed                                                  │
│                                                                                  │
│ ❌ User never accepts invite                                                     │
│    └── After 5min of inactivity, user_active_at expires                          │
│    └── Batch scheduler stops polling for this deploy                             │
│    └── After 30min total, job times out and fails                                │
│    └── Webhook notifies langgraph, task marked failed                            │
│                                                                                  │
│ ❌ Google API errors                                                             │
│    └── PollInviteAcceptanceWorker silently continues                             │
│    └── Eventually times out after 30min                                          │
│                                                                                  │
│ ❌ Frontend network errors                                                       │
│    └── Max 30min polling duration                                                │
│    └── Shows error: "Deploy timed out. Please refresh and try again."            │
│                                                                                  │
│ ❌ Langgraph crashes mid-execution                                               │
│    └── Graph state persisted in PostgreSQL via checkpointer                      │
│    └── Webhook or poll can resume from last checkpoint                           │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Key Components Reference

### Rails

| File | Purpose |
|------|---------|
| `projects_controller.rb` | Creates deploy, renders page |
| `omniauth_callbacks_controller.rb` | OAuth callback, finds JobRun via active deploy |
| `job_runs_controller.rb` | Creates JobRun for langgraph |
| `SendInviteWorker` | Sends Google Ads invite |
| `PollInviteAcceptanceWorker` | Checks invite status, 30min timeout |
| `PollActiveInvitesWorker` | Batch scheduler, stale job cleanup |
| `LanggraphCallbackWorker` | Delivers webhooks to langgraph |

### Langgraph

| File | Purpose |
|------|---------|
| `deploy.ts` (routes) | Stream endpoint, saves threadId first |
| `jobRunCallback.ts` | Webhook handler, shared checkpointer |
| `deployGraph.ts` | Main orchestrator |
| `deployCampaign.ts` | Google Ads subgraph |
| `googleConnectNode.ts` | OAuth job management |
| `verifyGoogleNode.ts` | Invite job management, direct DB touch |
| `DeployService.ts` | Direct Drizzle DB operations |

### Frontend

| File | Purpose |
|------|---------|
| `Deploy.tsx` | Main deploy page |
| `useDeployChat.ts` | Polling hook with stale closure fix |

### Shared

| File | Purpose |
|------|---------|
| `graphParams.ts` | Shared checkpointer instance |

---

## Timeouts Summary

| Timeout | Duration | Purpose |
|---------|----------|---------|
| `user_recently_active` scope | 5 minutes | OAuth callback lookup window |
| Batch scheduler interval | 30 seconds | Zhong scheduling |
| Job timeout (OAuth + Invite) | 30 minutes | Max time for async jobs |
| Frontend polling max | 30 minutes | Max time frontend will poll |
| Frontend poll interval | 3s → 10s | Starts fast, slows after 5min |

---

## Architecture Decisions

### Why webhook + polling hybrid?

1. **Webhooks** provide immediate notification when async jobs complete
2. **Polling** keeps the deploy "alive" (updates `user_active_at`) and catches any missed webhooks
3. The combination ensures reliability even if one mechanism fails

### Why direct Drizzle writes for touch()?

- Avoids HTTP round-trip to Rails for high-frequency operation
- Faster and more reliable during polling loops
- Reduces load on Rails API

### Why shared checkpointer?

- Prevents race conditions between webhook handler and deploy routes
- Both use same PostgreSQL-backed state
- Ensures consistent view of graph state

---

## Testing Scenarios

When testing this workflow, verify:

1. **Happy path**: OAuth → Invite accepted → Campaign deploys
2. **Page refresh**: Mid-deploy refresh reconnects to same thread
3. **OAuth abandon**: Close browser during OAuth, job times out after 30min
4. **Invite timeout**: Never accept invite, job times out after 30min
5. **Multiple deploys**: Start two deploys, OAuth callback finds correct one
6. **Network errors**: Frontend handles fetch failures gracefully
