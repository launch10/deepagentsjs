# Google Account HITL Flow

## Overview

The Google Ads connection requires a 2-step Human-in-the-Loop (HITL) flow:

1. **ConnectingGoogle**: User completes Google OAuth
2. **VerifyingGoogle**: User accepts Google Ads invitation email

Both steps are **skippable** if the account has already completed them (checked via Rails API).

## Flow Diagram

```
Langgraph starts with deployId
         │
         ▼
shouldSkipGoogleConnect? ─────────── API: GET /api/v1/google/connection_status
         │ NO                        │ YES (account has connected before)
         ▼                           │
   googleConnect ────────────────────┤  ← JobRun "GoogleOAuthConnect"
         │                           │    Rails OAuth callback completes it
         ▼                           ▼
shouldSkipGoogleVerify? ◄────────────┴── API: GET /api/v1/google/invite_status
         │ NO                        │ YES (invite already accepted)
         ▼                           │
   verifyGoogle ─────────────────────┤  ← JobRun "GoogleAdsInvite"
         │                           │    PollInviteAcceptanceWorker completes it
         ▼                           ▼
   deployCampaign ◄──────────────────┘
         │
         ▼
       END
```

## Skip Logic: Rails API Calls

Skip logic checks whether the **account** has EVER completed these steps, not the current deploy's task status.

### GET /api/v1/google/connection_status

```ruby
# rails_app/app/controllers/api/v1/google_controller.rb

def connection_status
  render json: {
    connected: current_account.has_google_connected_account?,
    email: current_account.google_email_address
  }
end
```

### GET /api/v1/google/invite_status

```ruby
def invite_status
  invitation = current_account.ads_account&.google_account_invitation

  render json: {
    accepted: invitation&.accepted? || false,
    status: invitation&.google_status || "none",
    email: invitation&.email_address
  }
end
```

## Step 1: GoogleConnect Node

### Node Logic (Idempotent Pattern)

```typescript
// langgraph_app/app/nodes/deploy/googleConnectNode.ts

export const googleConnectNode = async (state: DeployGraphState) => {
  const task = Task.findTask(state.tasks, "ConnectingGoogle");

  // 1. Completed/failed? No-op
  if (task?.status === "completed" || task?.status === "failed") return {};

  // 2. Has result from webhook? Mark completed
  if (task?.status === "running" && task.result?.google_email) {
    return withPhases(state, [{ ...task, status: "completed" }], ["ConnectingGoogle"]);
  }

  // 3. Has error? Mark failed
  if (task?.status === "running" && task.error) {
    return withPhases(state, [{ ...task, status: "failed" }], ["ConnectingGoogle"]);
  }

  // 4. Has jobId? Waiting for OAuth callback
  if (task?.status === "running" && task.jobId) return {};

  // 5. Running without jobId? Create JobRun
  if (task?.status === "running") {
    const jobRun = await jobRunApi.create({
      jobClass: "GoogleOAuthConnect",
      arguments: { account_id: state.accountId, deploy_id: state.deployId },
      threadId: state.threadId,
    });
    return withPhases(state, [{
      ...task,
      jobId: jobRun.id,
      result: { action: "oauth_required" },
    }], ["ConnectingGoogle"]);
  }

  // 6. First run
  return withPhases(state, [
    { ...Deploy.createTask("ConnectingGoogle"), status: "running" }
  ], ["ConnectingGoogle"]);
};
```

### Skip Logic

```typescript
export async function isGoogleConnected(state: DeployGraphState): Promise<boolean> {
  // First check task status (for completed within this deploy)
  const task = Task.findTask(state.tasks, "ConnectingGoogle");
  if (task?.status === "completed") return true;

  // Then check Rails API (for account-level connection)
  const api = new GoogleAPIService({ jwt: state.jwt });
  const { connected } = await api.getConnectionStatus();
  return connected;
}

export async function shouldSkipGoogleConnect(state: DeployGraphState) {
  return (await isGoogleConnected(state)) ? "skipGoogleConnect" : "enqueueGoogleConnect";
}
```

### OAuth Callback (Rails)

```ruby
# rails_app/app/controllers/users/omniauth_callbacks_controller.rb

def google_oauth2_connected(connected_account)
  thread_id = session.delete(:langgraph_thread_id)
  return unless thread_id.present?

  job_run = current_account.job_runs
    .where(job_class: "GoogleOAuthConnect", status: %w[pending running])
    .where(langgraph_thread_id: thread_id)
    .first

  if job_run
    job_run.complete!({ google_email: connected_account.email })
    job_run.notify_langgraph(status: "completed", result: { google_email: connected_account.email })
  end
end
```

## Step 2: VerifyGoogle Node

### Node Logic

```typescript
// langgraph_app/app/nodes/deploy/verifyGoogleNode.ts

export const verifyGoogleNode = async (state: DeployGraphState) => {
  const task = Task.findTask(state.tasks, "VerifyingGoogle");

  // Same idempotent pattern as googleConnect
  // 1-4: No-op checks

  // 5. Running without jobId? Fire job + start polling
  if (task?.status === "running" && !task.jobId) {
    const jobRun = await jobRunApi.create({
      jobClass: "GoogleAdsInvite",
      arguments: { account_id: state.accountId, deploy_id: state.deployId },
      threadId: state.threadId,
    });
    return withPhases(state, [{ ...task, jobId: jobRun.id }], ["VerifyingGoogle"]);
  }

  // 6. First run
  return withPhases(state, [
    { ...Deploy.createTask("VerifyingGoogle"), status: "running" }
  ], ["VerifyingGoogle"]);
};
```

### Polling Worker

```ruby
# rails_app/app/workers/google_ads/poll_invite_acceptance_worker.rb

module GoogleAds
  class PollInviteAcceptanceWorker
    include Sidekiq::Worker
    MAX_ATTEMPTS = 10  # 5 minutes (30 seconds × 10)

    def perform(job_run_id, options = {})
      job_run = JobRun.find_by(id: job_run_id)
      return unless job_run&.running?

      attempts = options["attempts"] || 0
      invitation = job_run.account.ads_account&.google_account_invitation
      invitation&.google_refresh_status

      if invitation&.accepted?
        job_run.complete!({ status: "accepted" })
        job_run.notify_langgraph(status: "completed", result: { status: "accepted" })
      elsif attempts >= MAX_ATTEMPTS
        # Timeout - don't fail, user can re-trigger via frontend
      else
        self.class.perform_in(30.seconds, job_run_id, attempts: attempts + 1)
      end
    end
  end
end
```

## Frontend Integration

### Before OAuth: Store Thread ID

```typescript
// Before redirecting to Google OAuth
const storeThreadId = async (threadId: string) => {
  await fetch("/api/v1/session/store_thread_id", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ thread_id: threadId })
  });
};
```

### UI States

1. **ConnectingGoogle running**: Show "Sign in with Google" button
2. **ConnectingGoogle completed**: Show checkmark, auto-advance
3. **VerifyingGoogle running**: Show "Check your email" with progress
4. **VerifyingGoogle timeout**: Show "I've accepted the invitation" button
5. **All completed**: Proceed to deployCampaign
