# Project Workflow

The project workflow tracks a user's progression through the launch journey: **brainstorm → website → ad campaign → complete**. Each step maps to a Chat type and a Langgraph graph. The `ProjectWorkflow` model tracks the current step, substep, and overall progress percentage.

## Lifecycle

```
Project created (via Brainstorm)
       │
       ▼
ProjectWorkflow (type: "launch", status: "active")
       │
  ┌────┴────────────────────────────────────┐
  │  Step 1: brainstorm                      │
  │    → Brainstorm graph captures idea      │
  │    → Brainstorm model stores 4 fields    │
  │    → Website created (with theme)        │
  ├──────────────────────────────────────────┤
  │  Step 2: website                         │
  │    → Website graph generates/edits pages │
  │    → Code files stored in database       │
  │    → Preview via WebContainers           │
  ├──────────────────────────────────────────┤
  │  Step 3: ad_campaign                     │
  │    → Ads graph creates campaign          │
  │    → Campaign stored with ad groups/ads  │
  ├──────────────────────────────────────────┤
  │  Step 4: deploy                          │
  │    → Deploy graph runs all tasks         │
  │    → Website built + uploaded to R2      │
  │    → Campaign synced to Google Ads       │
  ├──────────────────────────────────────────┤
  │  complete / archive                      │
  └──────────────────────────────────────────┘
```

## Data Model

```ruby
ProjectWorkflow
  ├─ workflow_type  # "launch"
  ├─ step           # "brainstorm", "website", "ad_campaign", "deploy"
  ├─ substep        # Granular progress within a step
  ├─ status         # "active", "completed", "archived"
  ├─ data           # JSONB for step-specific state
  │
  └─ belongs_to :project
       ├─ has_one :website
       ├─ has_one :brainstorm
       └─ has_many :campaigns
```

## Step Navigation

- `next_step!()` — advance to next step/substep
- `advance_to(step:, substep:)` — jump to specific step
- `complete!()` — mark workflow as completed
- `progress` — percentage based on step index in `WorkflowConfig`

**Constraint**: Only one active `launch` workflow per project.

## Key Files Index

| File | Purpose |
|------|---------|
| `rails_app/app/models/project_workflow.rb` | Workflow model (step tracking, navigation) |
| `rails_app/lib/workflow_config.rb` | Step definitions loaded from config |
| `shared/exports/workflow.json` | Step hierarchy (shared with frontend) |
| `rails_app/app/models/project.rb` | Project model (has_one workflow) |

## Gotchas

- **Step = chat type**: Each workflow step name matches a `chat_type`. The Chat model links the step's conversation to its Langgraph thread.
- **Config-driven**: Step order and substeps are defined in `workflow.json` (shared between Rails and frontend), not hardcoded in the model.
- **Archive vs complete**: Completed projects have finished the full workflow. Archived projects were shelved mid-workflow (can be unarchived later).
- **One active workflow**: Validated at the model level. A project cannot have two active `launch` workflows simultaneously.
