# Deploy Implementation Checklist

## Overview

This implementation adds a 2-step HITL flow for Google Ads connection, wrapped in a new Deploy model that tracks launch history.

## Documentation Files

1. [Deploy Model & API](./01-deploy-model-and-api.md) - Database model and REST endpoints
2. [Controller & Frontend Flow](./02-controller-frontend-flow.md) - User journey and page rendering
3. [Google HITL Flow](./03-google-hitl-flow.md) - OAuth and invite verification steps
4. [Langgraph Graph Updates](./04-langgraph-graph-updates.md) - Graph structure and state changes

## Implementation Tasks

### Rails Tasks

- [ ] **1. Create Deploy Model + Migration**
  - `rails_app/app/models/deploy.rb`
  - `rails_app/db/migrate/xxx_create_deploys.rb`
  - Add `has_many :deploys` to Project
  - Add `active_deploy` and `live_deploy` methods

- [ ] **2. Create Deploy API Endpoints**
  - `rails_app/app/controllers/api/v1/deploys_controller.rb`
  - POST `/api/v1/deploys` - Create new deploy
  - GET `/api/v1/deploys/:id` - Get deploy status
  - Add routes

- [ ] **3. Create Google Status APIs**
  - `rails_app/app/controllers/api/v1/google_controller.rb`
  - GET `/api/v1/google/connection_status`
  - GET `/api/v1/google/invite_status`
  - Add routes

- [ ] **4. Update to_launch_json Serialization**
  - `rails_app/app/models/concerns/project_concerns/serialization.rb`
  - Add `deploy: project.active_deploy&.as_json` to output

- [ ] **5. Add Job Classes to ALLOWED_JOBS**
  - `rails_app/app/models/job_run.rb`
  - Add `GoogleOAuthConnect` and `GoogleAdsInvite`

- [ ] **6. Update OAuth Callback**
  - `rails_app/app/controllers/users/omniauth_callbacks_controller.rb`
  - Complete JobRun on successful OAuth
  - Call `notify_langgraph`

- [ ] **7. Create Google Ads Workers**
  - `rails_app/app/workers/google_ads/send_invite_worker.rb`
  - `rails_app/app/workers/google_ads/poll_invite_acceptance_worker.rb`

- [ ] **8. Update JobRunsController**
  - `rails_app/app/controllers/api/v1/job_runs_controller.rb`
  - Add dispatch for new job classes

### Langgraph Tasks

- [ ] **9. Update googleConnectNode.ts**
  - `langgraph_app/app/nodes/deploy/googleConnectNode.ts`
  - Convert to JobRun pattern
  - Add Rails API check for skip logic

- [ ] **10. Create verifyGoogleNode.ts**
  - `langgraph_app/app/nodes/deploy/verifyGoogleNode.ts`
  - JobRun pattern with polling
  - Rails API check for skip logic

- [ ] **11. Update deployCampaign.ts Graph**
  - `langgraph_app/app/graphs/deployCampaign.ts`
  - Add verify nodes
  - Add conditional edges for skip logic

- [ ] **12. Update Deploy Annotation**
  - `langgraph_app/app/annotation/deployAnnotation.ts`
  - Add `deployId` field

### Frontend Tasks

- [ ] **13. Deploy Button Handler**
  - Create deploy record
  - Redirect to launch_deployment

- [ ] **14. Launch Component Updates**
  - Receive deploy in props
  - Start Langgraph flow with deployId
  - Handle reload (continue same deploy)

- [ ] **15. OAuth Flow Integration**
  - Store threadId before OAuth redirect
  - Handle OAuth callback

## Testing

- [ ] Unit tests for node idempotent behavior
- [ ] Integration test: full deploy flow
- [ ] Integration test: skip tests for already-connected accounts
- [ ] Manual test: real Google OAuth + invite flow

## Critical Files Summary

| File | Action |
|------|--------|
| `rails_app/app/models/deploy.rb` | Create |
| `rails_app/db/migrate/xxx_create_deploys.rb` | Create |
| `rails_app/app/controllers/api/v1/deploys_controller.rb` | Create |
| `rails_app/app/controllers/api/v1/google_controller.rb` | Create |
| `rails_app/app/models/concerns/project_concerns/serialization.rb` | Update |
| `rails_app/app/models/job_run.rb` | Update |
| `rails_app/app/controllers/users/omniauth_callbacks_controller.rb` | Update |
| `rails_app/app/controllers/api/v1/job_runs_controller.rb` | Update |
| `rails_app/app/workers/google_ads/send_invite_worker.rb` | Create |
| `rails_app/app/workers/google_ads/poll_invite_acceptance_worker.rb` | Create |
| `langgraph_app/app/nodes/deploy/googleConnectNode.ts` | Update |
| `langgraph_app/app/nodes/deploy/verifyGoogleNode.ts` | Create |
| `langgraph_app/app/graphs/deployCampaign.ts` | Update |
| `langgraph_app/app/annotation/deployAnnotation.ts` | Update |
