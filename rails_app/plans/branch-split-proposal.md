# Branch Split Proposal: `google-invite`

This branch contains several competing features. Below is a proposed split into self-contained PRs that can be reviewed independently.

---

## PR 1: Admin/Madmin UI Overhaul (React/Inertia)

**Summary**: Migrates the admin dashboard from ERB to Inertia/React pages.

**Files**:

- `rails_app/app/controllers/madmin/*_controller.rb` (accounts, announcements, dashboard, plans, subscriptions, users)
- `rails_app/app/javascript/frontend/components/navigation/AdminSidebar.tsx`
- `rails_app/app/javascript/frontend/components/shared/header/AdminHeader.tsx`
- `rails_app/app/javascript/frontend/layouts/admin-layout.tsx`
- `rails_app/app/javascript/frontend/pages/Madmin/**/*.tsx` (Dashboard, Accounts, Announcements, Plans, Subscriptions, Users)
- `rails_app/app/views/layouts/madmin/application.html.erb`
- `rails_app/app/views/madmin/application/_flash.html.erb`
- `rails_app/app/views/madmin/application/_javascript.html.erb`
- `rails_app/app/views/madmin/application/_navigation.html.erb`
- `rails_app/config/routes/madmin.rb` (partial - admin routes only)

**Dependencies**: None

---

## PR 2: Impersonation Fixes

**Summary**: Fixes for admin impersonation flow including a visible banner and JWT handling.

**Files**:

- `rails_app/app/controllers/concerns/jwt_helpers.rb`
- `rails_app/app/controllers/madmin/application_controller.rb` (impersonation-related changes)
- `rails_app/app/controllers/madmin/user/impersonates_controller.rb`
- `rails_app/app/controllers/subscribed_controller.rb`
- `rails_app/app/javascript/frontend/components/shared/ImpersonationBanner.tsx`
- `rails_app/app/javascript/frontend/components/shared/header/Header.tsx` (banner integration)
- `rails_app/spec/requests/madmin/user/impersonates_spec.rb`
- `plans/impersonation-fix.md`

**Dependencies**: PR 1 (Admin UI) for AdminHeader

---

## PR 3: Model Configuration/Preferences System

**Summary**: Adds LLM model configuration and preference system for managing model fallbacks.

**Rails Files**:

- `rails_app/app/controllers/api/v1/model_configuration_controller.rb`
- `rails_app/app/models/model_config.rb`
- `rails_app/app/models/model_preference.rb`
- `rails_app/db/migrate/20260115160347_create_model_configs.rb`
- `rails_app/db/migrate/20260115170001_add_model_card_to_model_configs.rb`
- `rails_app/db/migrate/20260115170002_create_model_fallback_chains.rb`
- `rails_app/db/migrate/20260115181121_rename_model_fallback_chains_to_model_preferences.rb`
- `rails_app/spec/factories/model_configs.rb`
- `rails_app/spec/factories/model_preferences.rb`
- `rails_app/spec/models/model_config_spec.rb`
- `rails_app/spec/models/model_preference_spec.rb`
- `rails_app/spec/requests/model_configuration_spec.rb`
- `rails_app/spec/snapshot_builders/core/model_configs.rb`
- `rails_app/spec/snapshot_builders/core/model_preferences.rb`

**Langgraph Files**:

- `langgraph_app/app/core/llm/service.ts` (new)
- `langgraph_app/app/core/llm/types.ts` (updated)
- `langgraph_app/app/core/llm/llm.ts` (refactored)
- `langgraph_app/app/core/llm/index.ts`
- Removal of `langgraph_app/app/core/llm/core.ts` and `factory.ts`
- `langgraph_app/tests/tests/core/llm/service.test.ts`
- `langgraph_app/tests/tests/core/llm/fallbacks.test.ts`

**Admin UI** (can be split or included here):

- `rails_app/app/javascript/frontend/pages/Madmin/Models.tsx`
- `rails_app/app/controllers/madmin/models_controller.rb`

**Dependencies**: None (can merge independently)

---

## PR 4: Deploy Model & API Foundation

**Summary**: Creates the Deploy model and basic API endpoints for tracking deployment state.

**Files**:

- `rails_app/app/controllers/api/v1/deploys_controller.rb`
- `rails_app/app/models/deploy.rb`
- `rails_app/app/models/project.rb` (deploy association)
- `rails_app/app/models/job_run.rb` (deploy_id addition)
- `rails_app/db/migrate/20260115170000_create_project_deploys.rb`
- `rails_app/db/migrate/20260115181736_add_deploy_id_to_job_runs.rb`
- `rails_app/db/migrate/20260115181801_add_user_active_at_to_deploys.rb`
- `rails_app/spec/factories/deploys.rb`
- `rails_app/spec/models/deploy_spec.rb`
- `rails_app/spec/requests/deploys_spec.rb`
- `rails_app/spec/snapshot_builders/deploy_step.rb`
- `shared/lib/api/services/deployAPIService.ts`
- `shared/types/deploy/bridge.ts`
- `plans/deploys/00-implementation-checklist.md`
- `plans/deploys/01-deploy-model-and-api.md`
- `plans/deploys/02-controller-frontend-flow.md`

**Dependencies**: None

---

## PR 5: Google Invite/Connect Flow (HITL)

**Summary**: Human-in-the-loop flow for Google Ads account connection during deploy.

**Rails Files**:

- `rails_app/app/controllers/api/v1/google_controller.rb`
- `rails_app/app/controllers/users/omniauth_callbacks_controller.rb` (Google-related changes)
- `rails_app/app/services/google_ads/resources/account_invitation.rb`
- `rails_app/app/services/google_ads/resources/billing.rb`
- `rails_app/app/workers/google_ads/send_invite_worker.rb`
- `rails_app/app/workers/google_ads/poll_invite_acceptance_worker.rb`
- `rails_app/app/workers/google_ads/poll_active_invites_worker.rb`
- `rails_app/app/workers/google_ads/payment_check_worker.rb`
- `rails_app/app/workers/google_ads/campaign_enable_worker.rb`
- `rails_app/spec/controllers/users/omniauth_callbacks_controller_spec.rb`
- `rails_app/spec/requests/google_spec.rb`
- `rails_app/spec/workers/google_ads/*_spec.rb`
- `rails_app/schedule.rb` (worker schedules)
- `docs/google_account_connect.md`
- `rails_app/docs/decisions/google_account_connect.md`
- `plans/deploys/03-google-hitl-flow.md`

**Langgraph Files**:

- `langgraph_app/app/nodes/deploy/googleConnectNode.ts`
- `langgraph_app/app/nodes/deploy/verifyGoogleNode.ts`
- `langgraph_app/app/nodes/deploy/checkPaymentNode.ts`
- `langgraph_app/app/nodes/deploy/enableCampaignNode.ts`
- `langgraph_app/app/services/googleAPIService.ts`
- `langgraph_app/app/server/routes/deploy.ts`
- `langgraph_app/tests/tests/nodes/deploy/googleConnectNode.test.ts`
- `langgraph_app/tests/tests/nodes/deploy/verifyGoogleNode.test.ts`

**Dependencies**: PR 4 (Deploy Model)

---

## PR 6: Unified Deploy Graph

**Summary**: Consolidates deploy graphs into a single unified graph and updates the deploy flow.

**Files**:

- `langgraph_app/app/graphs/deploy.ts` (major refactor)
- `langgraph_app/app/graphs/index.ts`
- `langgraph_app/app/annotation/deployAnnotation.ts`
- `langgraph_app/app/nodes/deploy/createEnqueueNode.ts`
- `langgraph_app/app/nodes/deploy/index.ts`
- `langgraph_app/app/services/deployService.ts`
- Removal of `deployCampaign.ts`, `deployWebsite.ts`, `deployCampaignNode.ts`
- `langgraph_app/tests/tests/graphs/deploy/deploy.test.ts` (expanded)
- All new deploy test recordings (`enqueue-*.har`, etc.)
- `plans/deploys/04-langgraph-graph-updates.md`

**Dependencies**: PR 4 (Deploy Model), PR 5 (Google Flow)

---

## PR 7: Deploy Frontend & Workflow Integration

**Summary**: Frontend page for deploy step and workflow navigation updates.

**Files**:

- `rails_app/app/javascript/frontend/pages/Deploy.tsx`
- `rails_app/app/javascript/frontend/hooks/useDeployChat.ts`
- `rails_app/app/javascript/frontend/hooks/useDeployStatus.ts`
- `rails_app/app/javascript/frontend/stores/workflowStore.ts`
- `rails_app/app/javascript/frontend/lib/workflowNavigation.ts`
- `rails_app/app/javascript/frontend/components/deploy/PhaseProgress.tsx`
- `rails_app/app/javascript/frontend/components/deploy/index.ts`
- `rails_app/app/javascript/frontend/components/ads/CampaignDeploy.tsx`
- `rails_app/app/models/concerns/project_concerns/serialization.rb`
- `rails_app/config/routes/subscribed.rb`
- `rails_app/lib/workflow_config.rb`
- `shared/config/workflow.ts`
- `shared/exports/workflow.json`
- `shared/types/deploy/phase.ts`
- `shared/types/deploy/tasks.ts`

**Dependencies**: PR 4, PR 5, PR 6

---

## PR 8: E2E Deploy Testing

**Summary**: End-to-end test infrastructure and tests for the deploy flow.

**Files**:

- `rails_app/e2e/deploy/deploy-invite-flow.spec.ts`
- `rails_app/e2e/fixtures/e2e-mocks.ts`
- `rails_app/app/controllers/test/e2e_controller.rb`
- `rails_app/lib/testing/e2e_google_ads_client.rb`
- `rails_app/lib/testing/google_ads_responses.rb`
- `rails_app/test/fixtures/database/snapshots/deploy_step.sql`
- `plans/deploys/05-e2e-testing-plan.md`

**Dependencies**: PR 4-7 (full deploy flow)

---

## PR 9: Cleanup & Housekeeping

**Summary**: Removes dead code, updates tooling, and adds Claude skills.

**Files**:

- `.husky/pre-commit` (updates)
- `langgraph_app/agents/websites/4/tracking_test_website/*` (deletion)
- `langgraph_app/app/core/node/middleware/withInterrupt.ts` (deletion)
- `rails_app/.claude/commands/fast-iteration.md`
- `rails_app/.claude/commands/streamline-plan.md`
- `rails_app/.claude/skills/rails-migrations.md`
- Snapshot SQL updates (timestamps only)
- Swagger/API spec updates

**Dependencies**: None (can merge early or last)

---

## Suggested Merge Order

```
1. PR 9: Cleanup (can go first to reduce noise)
2. PR 1: Admin UI
3. PR 2: Impersonation Fixes
4. PR 3: Model Configuration
5. PR 4: Deploy Model & API
6. PR 5: Google Invite Flow
7. PR 6: Unified Deploy Graph
8. PR 7: Deploy Frontend
9. PR 8: E2E Testing
```

Alternatively, PRs 1-4 and 9 can be merged in parallel since they're independent.

---

## Notes

- Some files touch multiple features (e.g., `swagger.yaml`, `structure.sql`). These will need careful rebasing.
- Test recordings (`.har` files) should stay with their respective features.
- The Model Configuration feature went through a rename (`ModelFallbackChain` → `ModelPreference`) - the PR should include the final state only.
