# Campaign Deploy Architecture: Human-in-the-Loop Steps

## Problem Statement

The `CampaignDeploy` lifecycle includes steps that require human interaction (OAuth, email verification, billing enablement). These steps:

1. Only need to complete once (not per-deploy)
2. Have unpredictable timing (seconds to days)
3. Cannot use retry/backoff patterns (user might not act immediately)
4. Should still be tracked in the deploy steps lifecycle for consistency

The current pattern (`run` → `finished?` → retry with backoff → fail) doesn't work for human steps.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                           USER BROWSER                               │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │  Deploy UI                                                   │    │
│  │  - Shows step progress                                       │    │
│  │  - Renders human action buttons (Connect Google, etc.)       │    │
│  │  - Triggers resume after human action completes              │    │
│  └─────────────────────────────────────────────────────────────┘    │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                          LANGGRAPH                                   │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │  Deploy Orchestrator                                         │    │
│  │  - Owns the poll loop                                        │    │
│  │  - Maintains UI state (awaitingHuman, progress, errors)      │    │
│  │  - Triggers Rails deploy via JobRun                          │    │
│  │  - Interprets deploy status and surfaces to UI               │    │
│  └─────────────────────────────────────────────────────────────┘    │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                            RAILS                                     │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │  CampaignDeploy (Single-Pass Executor)                       │    │
│  │  - Runs steps sequentially                                   │    │
│  │  - Returns status immediately (no retry loops)               │    │
│  │  - Reports where it stopped and why                          │    │
│  └─────────────────────────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │  JobRun                                                      │    │
│  │  - Tracks deploy job status                                  │    │
│  │  - New status: awaiting_human                                │    │
│  │  - Stores current_step and metadata                          │    │
│  └─────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
```

## Key Design Decisions

### 1. LangGraph Owns the Poll Loop

Rails deploy becomes **stateless/single-pass**: "Run what you can, tell me where you stopped."

LangGraph is the **stateful coordinator**: "Keep checking until done or user leaves."

**Why this works:**

- UI activity = graph activity (natural lifecycle binding)
- No Rails-side polling infrastructure needed
- Sidekiq stays simple (no long-running jobs)
- LangGraph already has retry policies and state management

### 2. Three Step Types

| Type                   | `run` behavior           | `finished?` checks                                 | LangGraph behavior                      |
| ---------------------- | ------------------------ | -------------------------------------------------- | --------------------------------------- |
| **Automated**          | Calls external API       | Sync result                                        | Poll until done                         |
| **Human (passive)**    | No-op                    | External state (e.g., `account.google_connected?`) | Return `awaitingHuman`, UI handles      |
| **Human (initiation)** | Sends email/creates task | User action completed                              | Return `awaitingHuman` after initiation |

### 3. CampaignDeploy as Source of Truth for Deploy Status

`CampaignDeploy` already tracks `current_step` and `status`. Rather than duplicating this in `JobRun`, we poll `CampaignDeploy` directly for deploy state:

```ruby
# CampaignDeploy statuses
STATUS = %w[pending running completed failed awaiting_human].freeze
```

`JobRun` remains the job lifecycle tracker (pending/running/completed/failed). `CampaignDeploy` owns the deploy-specific state including `awaiting_human`.

`awaiting_human` signals: "I'm paused waiting for user action, don't retry me."

## Detailed Flow

### Deploy Initiation

```
1. User clicks "Deploy Campaign"
2. UI calls LangGraph deploy endpoint
3. LangGraph creates JobRun via Rails API (status: pending)
4. LangGraph enters poll loop
```

### Poll Loop (LangGraph)

```typescript
async function deployPollLoop(jobRunId: string): Promise<DeployResult> {
  while (true) {
    const response = await callRailsDeploy(jobRunId);

    switch (response.status) {
      case "completed":
        return { status: "completed" };

      case "awaiting_human":
        // Stop polling, surface to UI
        return {
          status: "awaiting_human",
          step: response.currentStep,
          action: response.requiredAction, // 'oauth', 'verify_email', etc.
        };

      case "failed":
        // Could retry transient failures here
        return { status: "failed", error: response.error };

      case "running":
      case "pending":
        // Keep polling
        await sleep(POLL_INTERVAL);
        break;
    }
  }
}
```

### Single-Pass Deploy (Rails)

```ruby
def execute_deploy
  step = next_step

  while step
    # Already done? Skip.
    if step.finished?
      advance_to_next_step
      step = next_step
      next
    end

    # Human step not finished? Pause and report.
    if step.human? && !step.finished?
      # Optionally run initiation (send email, etc.)
      step.initiate if step.respond_to?(:initiate) && !step.initiated?

      return {
        status: 'awaiting_human',
        current_step: step.name,
        required_action: step.required_action
      }
    end

    # Automated step: execute it
    step.run

    # Check result
    unless step.finished?
      return {
        status: 'failed',
        current_step: step.name,
        error: step.error_message
      }
    end

    advance_to_next_step
    step = next_step
  end

  { status: 'completed' }
end
```

### Human Action Completion

```
1. User completes OAuth flow (or verifies email, enables billing, etc.)
2. External state changes (account.google_connected = true)
3. UI calls LangGraph "continue deploy" endpoint
4. LangGraph resumes poll loop
5. Rails sees step.finished? = true, proceeds to next step
```

## Step Definition Examples

### Automated Step

```ruby
Step.define(:sync_budget) do
  step_type :automated

  def run
    campaign.budget.google_sync
  end

  def finished?
    campaign.budget.google_sync_result&.success? || false
  end
end
```

### Human Step (Passive)

```ruby
Step.define(:connect_google_account) do
  step_type :human
  required_action :oauth

  def run
    # No-op: OAuth happens in UI
  end

  def finished?
    campaign.account.google_connected?
  end
end
```

### Human Step (With Initiation)

```ruby
Step.define(:send_account_invitation) do
  step_type :human
  required_action :accept_invitation

  def initiate
    campaign.google_ads_account.send_invitation_email
    mark_initiated!
  end

  def initiated?
    campaign.google_ads_account.invitation_sent?
  end

  def finished?
    campaign.account.google_account_invitation&.accepted?
  end
end
```

## State Management

### LangGraph State (AdsAnnotation extension)

```typescript
// Add to AdsAnnotation
deployStatus: Annotation<DeployStatus | undefined>(),
awaitingHuman: Annotation<AwaitingHumanStep | undefined>(),
deployProgress: Annotation<DeployProgress | undefined>(),

// Types
type DeployStatus = 'idle' | 'deploying' | 'awaiting_human' | 'completed' | 'failed';

type AwaitingHumanStep = {
  step: string;           // 'connect_google_account'
  action: string;         // 'oauth', 'verify_email', 'enable_billing'
  message?: string;       // User-facing message
  actionUrl?: string;     // Optional: direct link for action
};

type DeployProgress = {
  currentStep: string;
  completedSteps: string[];
  totalSteps: number;
};
```

### Rails CampaignDeploy Extension

`CampaignDeploy` already has `current_step` and `status`. We extend it with helper methods:

```ruby
class CampaignDeploy < ApplicationRecord
  STATUS = %w[pending running completed failed awaiting_human].freeze

  def await_human!
    update!(status: 'awaiting_human')
  end

  def awaiting_human?
    status == 'awaiting_human'
  end
  
  def completed_steps
    return [] if current_step.nil?
    current_index = STEPS.index { |s| s.name.to_s == current_step }
    return [] if current_index.nil? || current_index == 0
    STEPS[0...current_index].map { |s| s.step_name.to_s }
  end
  
  def total_steps
    STEPS.size
  end
  
  def current_step_class
    STEPS.find(current_step)
  end
  
  def current_step_action
    current_step_class&.new(campaign)&.required_action
  end
  
  def current_step_message
    current_step_class&.new(campaign)&.user_message
  end
end
```

`JobRun` remains unchanged—it tracks Sidekiq job lifecycle only. `CampaignDeploy` is the source of truth for deploy state.

## UI Components

The UI needs to handle `awaitingHuman` state:

```tsx
function DeployProgress({ deployStatus, awaitingHuman, progress }) {
  if (deployStatus === "awaiting_human") {
    return (
      <HumanActionRequired
        step={awaitingHuman.step}
        action={awaitingHuman.action}
        onComplete={() => resumeDeploy()}
      />
    );
  }

  return <StepProgressIndicator steps={progress} />;
}

function HumanActionRequired({ step, action, onComplete }) {
  switch (action) {
    case "oauth":
      return <GoogleOAuthButton onSuccess={onComplete} />;
    case "verify_email":
      return <EmailVerificationPrompt onVerified={onComplete} />;
    case "enable_billing":
      return <BillingSetupPrompt onEnabled={onComplete} />;
  }
}
```

## API Endpoints

### Rails

```ruby
# POST /api/campaigns/:id/deploy
# Creates CampaignDeploy, enqueues job, returns deploy ID
def create
  deploy = campaign.deploys.create!(status: 'pending')
  CampaignDeploy::DeployWorker.perform_async(deploy.id)
  render json: { campaign_deploy_id: deploy.id }
end

# GET /api/campaign_deploys/:id
# Returns current deploy status for polling (source of truth)
def show
  deploy = CampaignDeploy.find(params[:id])
  
  render json: {
    status: deploy.status,
    current_step: deploy.current_step,
    completed_steps: deploy.completed_steps,
    total_steps: deploy.total_steps,
    awaiting_human: deploy.awaiting_human? ? {
      step: deploy.current_step,
      action: deploy.current_step_action,
      message: deploy.current_step_message
    } : nil,
    error: deploy.stacktrace
  }
end
```

### LangGraph

```typescript
// Deploy node
async function deployNode(state: AdsGraphState, config: Config) {
  // Initial trigger
  if (!state.campaignDeployId) {
    const { campaignDeployId } = await railsApi.createDeploy(state.campaignId);
    return { campaignDeployId, deployStatus: "deploying" };
  }

  // Poll CampaignDeploy for status (source of truth)
  const result = await railsApi.getCampaignDeploy(state.campaignDeployId);

  if (result.status === "awaiting_human") {
    return {
      deployStatus: "awaiting_human",
      awaitingHuman: result.awaitingHuman,
      deployProgress: {
        currentStep: result.currentStep,
        completedSteps: result.completedSteps,
        totalSteps: result.totalSteps,
      },
    };
  }

  if (result.status === "completed") {
    return { deployStatus: "completed" };
  }

  if (result.status === "failed") {
    return { deployStatus: "failed", error: result.error };
  }

  // Still running, will be polled again
  return {
    deployStatus: "deploying",
    deployProgress: {
      currentStep: result.currentStep,
      completedSteps: result.completedSteps,
      totalSteps: result.totalSteps,
    },
  };
}
```

## Benefits

1. **Unified step tracking**: All steps (human and automated) live in `CampaignDeploy::STEPS`
2. **Clean separation**: Rails executes, LangGraph coordinates, UI displays
3. **No long-running jobs**: Rails jobs are quick single-pass executions
4. **Natural lifecycle**: Polling stops when user leaves (graph times out)
5. **Idempotent**: Re-running deploy checks `finished?` and skips completed steps
6. **Extensible**: New human steps follow the same pattern

## Future Human Steps

This pattern supports planned steps:

| Step                     | Action                       | `finished?` checks          |
| ------------------------ | ---------------------------- | --------------------------- |
| `connect_google_account` | OAuth                        | `account.google_connected?` |
| `verify_email`           | Click email link             | `account.email_verified?`   |
| `enable_billing`         | Add payment method           | `account.billing_enabled?`  |
| `accept_invitation`      | Accept in Google Ads         | `invitation.accepted?`      |
| `verify_business`        | Google business verification | `business.verified?`        |

## Migration Path

1. Add `awaiting_human` to `CampaignDeploy::STATUS`
2. Add `step_type` declaration to `Step` base class
3. Add helper methods to `CampaignDeploy` (`completed_steps`, `current_step_action`, etc.)
4. Refactor `actually_deploy` to single-pass pattern
5. Add `GET /api/campaign_deploys/:id` endpoint for polling
6. Add deploy orchestration node to LangGraph ads graph
7. Build UI components for human action states
