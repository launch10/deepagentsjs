# Google Ads Integration Architecture

**Status**: Living Document
**Last Updated**: 2025-01-05

## Overview

The Google Ads integration follows a **deferred sync** pattern: user changes are saved to our database immediately, but only synced to Google Ads when a deployment is triggered. **LangGraph orchestrates the full deployment workflow**, which includes website deployment, analytics setup verification, and Google Ads account/campaign sync.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              USER INTERFACE                                  │
│                    (Edit campaigns, ads, keywords, etc.)                    │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼ Immediate save
┌─────────────────────────────────────────────────────────────────────────────┐
│                           RAILS DATABASE                                     │
│              (Campaign, AdGroup, Ad, AdKeyword, AdBudget, etc.)             │
│                                                                              │
│   Changes are staged here. Google IDs (google_campaign_id, etc.) are        │
│   populated after successful sync to Google.                                 │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼ User clicks "Deploy"
┌─────────────────────────────────────────────────────────────────────────────┐
│                         LANGGRAPH ORCHESTRATION                              │
│                                                                              │
│   Orchestrates the full deployment flow:                                     │
│   1. Deploy website                                                          │
│   2. Verify PostHog/GTM setup                                               │
│   3. Check website runs without errors                                       │
│   4. Ensure Google account connected                                         │
│   5. Verify Google Ads billing enabled                                       │
│   6. Trigger CampaignDeploy via JobRuns pattern                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼ JobRuns async pattern
┌─────────────────────────────────────────────────────────────────────────────┐
│                           CampaignDeploy                                     │
│                                                                              │
│   Orchestrates the Google Ads sync through ordered Steps.                    │
│   Tracks progress: current_step, status (pending/completed/failed)          │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼ Steps execute sequentially
┌─────────────────────────────────────────────────────────────────────────────┐
│                        GoogleAds::Resources::*                               │
│                                                                              │
│   Resource classes handle sync logic for each entity type.                   │
│   Each provides: sync, sync_result, sync_plan, delete, fetch                │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼ API calls with instrumentation
┌─────────────────────────────────────────────────────────────────────────────┐
│                          GOOGLE ADS API                                      │
│                   (via google-ads-googleads gem)                            │
└─────────────────────────────────────────────────────────────────────────────┘
```

## LangGraph Orchestration

### Full Deployment Flow

When a user clicks "Deploy", LangGraph orchestrates the entire deployment workflow. Campaign deployment to Google Ads is just one step in a larger process:

```
┌──────────────────────────────────────────────────────────────────────────┐
│                        LangGraph Deployment Graph                         │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐                  │
│  │   Deploy    │───►│   Verify    │───►│   Check     │                  │
│  │   Website   │    │ PostHog/GTM │    │  No Errors  │                  │
│  └─────────────┘    └─────────────┘    └─────────────┘                  │
│                                               │                          │
│                                               ▼                          │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐                  │
│  │   Deploy    │◄───│   Verify    │◄───│   Ensure    │                  │
│  │  Campaign   │    │   Billing   │    │ Google Acct │                  │
│  └─────────────┘    └─────────────┘    └─────────────┘                  │
│        │                                                                 │
│        ▼                                                                 │
│  ┌─────────────┐                                                        │
│  │  Complete   │                                                        │
│  └─────────────┘                                                        │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

### Pre-requisites Before Campaign Deploy

LangGraph ensures these conditions are met before triggering `CampaignDeploy`:

| Step | What it checks | Why it matters |
|------|----------------|----------------|
| Deploy Website | Website is live at target domain | Ads need a destination URL |
| Verify PostHog/GTM | Analytics tracking is configured | Conversion tracking for ROI |
| Check No Errors | Website loads without JS errors | Google disapproves broken landing pages |
| Ensure Google Account | User has connected Google account | Required for Google Ads API access |
| Verify Billing | Google Ads billing is enabled | Ads won't run without payment method |

### JobRuns Pattern: LangGraph ↔ Rails Async Communication

LangGraph nodes need to trigger long-running Rails jobs (like `CampaignDeploy`) and wait for completion. The **JobRuns pattern** enables this:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            JobRuns Pattern                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   LANGGRAPH                              RAILS                               │
│   ─────────                              ─────                               │
│                                                                              │
│   1. Node calls POST /api/v1/job_runs ──────────────► Creates JobRun        │
│      { job_class: "CampaignDeployWorker" }            Enqueues Sidekiq job  │
│                                                                              │
│   2. Node calls interrupt()                                                  │
│      Stores job_run_id in state                                             │
│      Graph execution pauses                                                  │
│                                                                              │
│   3.                                     ◄────────── Sidekiq executes job   │
│                                                      (CampaignDeploy runs)  │
│                                                                              │
│   4.                                     ◄────────── Job completes          │
│                                                      LanggraphCallbackWorker│
│                                                      sends signed webhook   │
│                                                                              │
│   5. Webhook received at /webhooks/job_run_callback                         │
│      Signature verified (HMAC)                                              │
│      Thread state updated with results                                      │
│      Graph execution resumes                                                │
│                                                                              │
│   6. Node resumes with state.jobRunComplete                                 │
│      Contains result data from Rails job                                    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### JobRuns Node Pattern (TypeScript)

```typescript
// In a LangGraph node (e.g., deployCampaignNode)
async function deployCampaignNode(state: State) {
  // If resuming after job completion, handle the result
  if (state.jobRunComplete) {
    const result = state.jobRunComplete.result;
    return {
      deployResult: result,
      deployStatus: result.success ? "completed" : "failed"
    };
  }

  // First visit: trigger the job and interrupt
  const jobRun = await apiService.create({
    jobClass: "CampaignDeployWorker",
    args: { campaign_id: state.campaignId },
    callback_url: getCallbackUrl(state.threadId)
  });

  // Interrupt pauses execution until webhook resumes it
  return interrupt({
    reason: "waiting_for_job",
    jobRunId: jobRun.id
  });
}
```

### Rails Components

| Component | Purpose |
|-----------|---------|
| `JobRun` model | Tracks job state with `thread_id`, `callback_url`, `result_data` |
| `API::V1::JobRunsController` | Creates JobRun records and enqueues Sidekiq workers |
| `LanggraphCallbackWorker` | Sends HMAC-signed webhook to LangGraph when job completes |
| `JobRunCallbackRoutes` | LangGraph webhook endpoint with signature verification |

### Why This Pattern?

1. **Separation of concerns**: LangGraph handles orchestration, Rails handles execution
2. **Retry logic**: Sidekiq provides robust retry with exponential backoff
3. **Observability**: JobRun records provide audit trail
4. **Resumability**: Interrupted graphs can be resumed after server restarts
5. **Timeout handling**: Long-running jobs don't block LangGraph workers

## Core Concepts

### 1. Deferred Sync Pattern

**Why**: Immediate sync would require handling API failures inline with user actions. Deferred sync lets users make multiple changes, preview them, and deploy as a batch.

**How it works**:

1. User edits campaign settings → saved to `campaigns` table
2. User adds keywords → saved to `ad_keywords` table
3. User clicks "Deploy" → LangGraph orchestrates full deployment flow
4. LangGraph triggers `CampaignDeploy` via JobRuns pattern
5. Steps execute in order, syncing each entity to Google Ads
6. Google IDs are backfilled to our records upon successful sync
7. LangGraph receives webhook, resumes, and completes deployment graph

### 2. Resource Classes

Each Google Ads entity has a corresponding resource class in `app/services/google_ads/resources/`:

| Resource            | Model                     | Google Entity                |
| ------------------- | ------------------------- | ---------------------------- |
| `Account`           | `AdsAccount`              | Customer                     |
| `AccountInvitation` | `GoogleAccountInvitation` | CustomerUserAccessInvitation |
| `Budget`            | `AdBudget`                | CampaignBudget               |
| `Campaign`          | `Campaign`                | Campaign                     |
| `AdGroup`           | `AdGroup`                 | AdGroup                      |
| `Ad`                | `Ad`                      | AdGroupAd                    |
| `Keyword`           | `AdKeyword`               | AdGroupCriterion (keyword)   |
| `LocationTarget`    | `AdLocationTarget`        | CampaignCriterion (geo)      |
| `AdSchedule`        | `AdSchedule`              | CampaignCriterion (schedule) |
| `Callout`           | `AdCallout`               | Asset + CampaignAsset        |
| `StructuredSnippet` | `AdStructuredSnippet`     | Asset + CampaignAsset        |
| `Favicon`           | `Favicon`                 | Asset + CampaignAsset        |

### 3. The 5 Core Methods

Every resource class implements these methods:

```ruby
class SomeResource
  # Check if local matches remote
  def synced?
    remote = fetch
    return false unless remote
    fields_match?(remote)
  end

  # Sync local to remote (create/update as needed)
  def sync
    return SyncResult.unchanged if synced?
    remote = fetch
    remote ? update(remote) : create
  end

  # Get current sync state without modifying anything
  def sync_result
    remote = fetch
    return SyncResult.not_found unless remote
    fields_match?(remote) ? SyncResult.unchanged : SyncResult.error(...)
  end

  # Dry run: what would sync do?
  def sync_plan
    remote = fetch
    return Plan.new([{action: :create, ...}]) if remote.nil?
    return Plan.new([{action: :update, ...}]) unless fields_match?(remote)
    Plan.new([{action: :unchanged, ...}])
  end

  # Remove from Google Ads
  def delete
    # Remove from Google, clear local google_* IDs
  end

  # Fetch remote resource by ID (or by content if ID missing)
  def fetch
    fetch_by_id || fetch_by_content
  end
end
```

### 4. Field Mappings

The `FieldMappable` concern provides declarative field mapping between local models and Google's API:

```ruby
class Campaign
  include FieldMappable

  field_mapping :name,
    local: :name,                    # Our model attribute
    remote: :name                    # Google's attribute

  field_mapping :status,
    local: :google_status,
    remote: ->(r) { r.status.to_s }, # Lambda for complex extraction
    transform: TRANSFORMS::TO_SYMBOL # Transform before sending to Google
end
```

This enables:

- `to_google_json` - Convert local model to Google format
- `from_google_json(remote)` - Convert Google response to local format
- `compare_fields(remote)` - Compare local vs remote with detailed diff
- `fields_match?(remote)` - Boolean check if in sync

## CampaignDeploy

### Step Workflow

`CampaignDeploy` orchestrates sync through ordered steps:

```ruby
STEPS = Steps.new([
  Step.define(:sync_budget) { ... },
  Step.define(:create_campaign) { ... },
  Step.define(:create_geo_targeting) { ... },
  Step.define(:create_schedule) { ... },
  Step.define(:create_callouts) { ... },
  Step.define(:create_structured_snippets) { ... },
  Step.define(:create_ad_groups) { ... },
  Step.define(:create_keywords) { ... },
  Step.define(:create_ads) { ... }
])
```

Each step implements:

- `run` - Execute the sync
- `finished?` - Check if step completed successfully
- `sync_result` - Get the result without running
- `sync_plan` - Dry run planning

### Dependency Graph

Steps must execute in order due to Google Ads dependencies:

```
Budget ──► Campaign ──┬──► Geo Targeting
                      ├──► Ad Schedule
                      ├──► Callouts
                      ├──► Structured Snippets
                      └──► Ad Groups ──┬──► Keywords
                                       └──► Ads
```

### Current Execution Model

Steps run **sequentially** via Sidekiq:

```ruby
def actually_deploy(async: true)
  step = next_step
  return update!(status: "completed") if step.nil?

  step.run unless step.finished?
  update!(current_step: step.class.step_name.to_s)

  raise StepNotFinishedError unless step.finished?

  # Recurse to next step
  if async
    CampaignDeploy::DeployWorker.perform_async(id)
  else
    actually_deploy(async: false)
  end
end
```

## Sync Plans

### Current Implementation

`Sync::Plan` represents what a sync operation **would do** without executing:

```ruby
plan = GoogleAds::Resources::Campaign.new(campaign).sync_plan
# => Plan with operations: [{action: :create, record: campaign, ...}]

plan.any_changes?  # => true
plan.creates       # => [{action: :create, ...}]
plan.updates       # => []
plan.unchanged     # => []
```

### StepRunner.plan

Get a merged plan across ALL steps:

```ruby
runner = CampaignDeploy::StepRunner.new(campaign)
full_plan = runner.plan

full_plan.budgets.creates    # Budget operations
full_plan.campaigns.updates  # Campaign operations
full_plan.keywords.deletes   # Keyword deletions
```

### Future Vision: Plan-Driven Parallelization

**Goal**: Use sync plans as the source of truth for `CampaignDeploy`, enabling parallel execution.

**Proposed Architecture**:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         CampaignDeploy.deploy                                │
│                                                                              │
│  1. Generate full sync plan (all operations across all entities)            │
│  2. Build dependency graph from plan                                         │
│  3. Enqueue all operations with dependencies                                 │
│  4. Workers poll for unblocked operations                                    │
│  5. Execute in parallel where dependencies allow                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Dependency Model**:

```ruby
# Proposed operation structure
{
  action: :create,
  record: ad_group,
  depends_on: [:campaign_123],  # Wait for campaign sync
  provides: [:ad_group_456]     # Unblocks keyword/ad syncs
}
```

**Execution Flow**:

```
1. Enqueue:
   - Budget (no deps)
   - Campaign (deps: budget)
   - Geo/Schedule/Callouts (deps: campaign)
   - AdGroups (deps: campaign)
   - Keywords/Ads (deps: ad_groups)

2. Worker picks up Budget (unblocked), executes

3. Campaign becomes unblocked, worker picks it up

4. Geo, Schedule, Callouts, AdGroups all become unblocked
   → 4 workers execute in parallel

5. Keywords and Ads become unblocked
   → Execute in parallel per ad_group
```

**Benefits**:

- Faster deploys (parallel where possible)
- Better visibility (plan shows exactly what will happen)
- Resumability (failed operations can be retried without re-running successful ones)
- Idempotency (plans can be re-applied safely)

## Sync Results

### SyncResult

Individual operation result:

```ruby
result = campaign.google_sync
result.success?    # true if created/updated/unchanged/deleted
result.created?    # true if newly created
result.error?      # true if failed
result.action      # :created, :updated, :unchanged, :deleted, :not_found, :error
```

### CollectionSyncResult

Aggregates results for collection operations:

```ruby
results = GoogleAds::Resources::Keyword.sync_all(ad_group)
results.success?   # All succeeded
results.any_errors? # Any failures
results.created    # Array of created results
results.errors     # Array of error results
```

## File Structure

```
app/services/google_ads/
├── instrumentation.rb           # Log tagging for observability
├── field_compare.rb             # Field-by-field comparison utility
├── sync_result.rb               # Legacy result class (being phased out)
├── sync_verification_error.rb   # Error for sync mismatches
├── resources/
│   ├── field_mappable.rb        # Declarative field mapping concern
│   ├── instrumentable.rb        # Instrumentation concern
│   ├── transforms.rb            # Value transformers (symbols, enums, etc.)
│   ├── account.rb               # Customer sync
│   ├── account_invitation.rb    # User access invitation sync
│   ├── budget.rb                # CampaignBudget sync
│   ├── campaign.rb              # Campaign sync
│   ├── ad_group.rb              # AdGroup sync
│   ├── ad.rb                    # AdGroupAd sync
│   ├── keyword.rb               # Keyword criterion sync
│   ├── location_target.rb       # Geo criterion sync
│   ├── ad_schedule.rb           # Schedule criterion sync
│   ├── callout.rb               # Callout asset sync
│   ├── structured_snippet.rb    # Structured snippet asset sync
│   └── favicon.rb               # Business logo asset sync
└── sync/
    ├── plan.rb                  # Dry-run planning
    ├── sync_result.rb           # Operation result
    └── collection_sync_result.rb # Collection result
```

## Related Documentation

**Google Ads ADRs**:
- [ADR-001: Instrumentation and Logging](./001-instrumentation-and-logging.md) - Tagged logging for observability

**Cross-cutting Patterns**:
- JobRuns Pattern - LangGraph ↔ Rails async job orchestration (see `langgraph_app/` docs)
- LangGraph Deployment Graph - Full deployment workflow orchestration

## Implementation Status

| Component | Status | Notes |
|-----------|--------|-------|
| Resource classes | ✅ Complete | All 12 resources implemented |
| FieldMappable concern | ✅ Complete | Declarative field mapping |
| Instrumentable concern | ✅ Complete | Tagged logging for all resources |
| CampaignDeploy steps | ✅ Complete | Sequential execution |
| Sync Plans | ⚠️ Partial | Dry-run works; not yet driving execution |
| JobRuns pattern | 🚧 In Progress | On separate branch |
| LangGraph orchestration | 🚧 In Progress | Deployment graph being built |
| Plan-driven parallelization | 📋 Planned | Future optimization |

## Open Questions / Future Work

### Near-term

1. **JobRuns integration**: Complete JobRuns pattern for CampaignDeploy
2. **LangGraph deployment graph**: Wire up full deployment flow with all pre-requisites
3. **Error handling**: Propagate CampaignDeploy errors back to LangGraph for user feedback

### Medium-term

4. **Plan-driven execution**: Use sync plans as source of truth for CampaignDeploy
5. **Parallelization**: Execute independent steps concurrently (see dependency graph)
6. **Partial deploys**: Allow deploying specific entities without full sync

### Long-term

7. **Rollback support**: Undo a deploy by reversing operations
8. **Conflict detection**: Detect external changes made in Google Ads UI
9. **Batch API calls**: Use Google's batch mutation API for efficiency
10. **Real-time sync**: Webhook-based sync when changes occur in Google Ads UI
