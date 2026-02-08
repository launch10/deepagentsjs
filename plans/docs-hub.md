# Plan: Create Canonical docs/ Hub

## Context

Documentation is scattered across 125+ files in `plans/`, `langgraph_app/plans/`, `rails_app/plans/`, `docs/`, `rails_app/docs/`, and various CLAUDE.md files. Much of it is vestigial planning docs for features that are now implemented. There's no single place to answer "how does X work today?"

This plan creates a `docs/` hub at the project root as the canonical current-state reference. Existing well-structured docs (billing/, decisions/) are preserved in place. Implemented plans get archived. Each major system gets a focused doc.

## Directory Structure

```
docs/
├── README.md                          # Master index / table of contents
│
├── architecture/
│   ├── overview.md                    # Two-service architecture (Rails + LG + Atlas)
│   ├── authentication.md              # Devise + JWT + multi-tenancy
│   └── async-patterns.md              # Fire-and-forget + webhook callback pattern
│
├── website/
│   ├── coding-agent.md                # Classifier → single-shot → full agent
│   ├── themes.md                      # Theme system & design tokens
│   ├── templates.md                   # Landing page templates
│   ├── domains.md                     # Subdomain picker, custom domains
│   └── webcontainers.md              # In-browser preview, snapshot system
│
├── deployment/
│   ├── pipeline.md                    # Deploy graph: task phases
│   ├── atlas.md                       # Cloudflare Workers, R2, KV
│   └── firewall.md                    # Rate limiting, request counting
│
├── brainstorm/
│   └── agent.md                       # Brainstorm agent flow
│
├── ads/
│   ├── google-ads.md                  # Campaign creation, deferred sync
│   ├── google-account-connect.md      # OAuth + invite verification flow
│   └── campaign-deploy.md             # CampaignDeploy steps
│
├── analytics/
│   ├── tracking.md                    # Ahoy events, conversion tracking
│   └── insights.md                    # Dashboard, AI-generated insights
│
├── billing/                           # ← EXISTING, keep as-is (13 docs)
│
├── agent-infrastructure/
│   ├── llm-configuration.md           # getLLM, model tiers, prompt caching
│   ├── cost-management.md             # Token tracking, cost optimization
│   ├── langgraph-sdk.md               # useLanggraph hook, SmartSubscription
│   └── chat-system.md                 # Polymorphic Chat, threading, streaming
│
├── support/
│   └── help-center.md                 # FAQ system, AI support agent
│
├── testing/
│   ├── overview.md                    # Testing philosophy & stack
│   ├── database-snapshots.md          # Snapshot system for test isolation
│   ├── playwright-e2e.md              # E2E with scenarios/queries
│   ├── polly-recordings.md            # HTTP recording for AI tests
│   └── evals.md                       # Online/offline evals, scoring
│
├── infrastructure/
│   ├── services.md                    # Port allocation, parallel dev
│   ├── database.md                    # Shared DB, Rails-owns-schema
│   └── background-jobs.md            # Sidekiq, Zhong, worker patterns
│
├── decisions/                         # ← EXISTING, keep as-is (10 ADRs)
│
└── project-workflow/
    └── workflow.md                    # Brainstorm → website → ads lifecycle
```

**Total: 30 new files + 2 existing directories preserved**

## Doc Format

Each doc follows the billing/ style (our gold standard — see `docs/billing/00-architecture-overview.md`):

1. **Title + 2-3 sentence overview** of current state
2. **Architecture diagram** (ASCII) if applicable
3. **How it works** — step-by-step flow
4. **Key Files Index** — table of file paths → purpose
5. **Gotchas / Known Issues** — things that trip people up
6. Max ~3-5KB per doc. Link to code, don't duplicate it.

## Execution Plan

### Step 1: Create docs/README.md (the hub index)

Master table of contents with one-liner per doc. This is created first so every subsequent doc has a home.

### Step 2: Architecture docs (3 files)

- `architecture/overview.md` — Synthesize from `docs/decisions/architecture.md`, `plans/architecture/architecture-overview.md`, and CLAUDE.md
- `architecture/authentication.md` — From `docs/decisions/authentication.md` + CLAUDE.md auth section
- `architecture/async-patterns.md` — From `docs/decisions/langgraph-rails-pattern.md`

### Step 3: Website docs (5 files)

- `website/coding-agent.md` — Condense `langgraph_app/plans/website/coding-agent-status.md` (70KB) into focused 5KB entry point
- `website/themes.md` — From `plans/themes/README.md` (nearly ready as-is)
- `website/templates.md` — From `rails_app/docs/templates/templates.md`
- `website/domains.md` — From `langgraph_app/plans/domains.md` + `plans/website/domain_picker.md`
- `website/webcontainers.md` — From `rails_app/plans/website/webcontainer-snapshot-system.md`

### Step 4: Deployment docs (3 files)

- `deployment/pipeline.md` — From `plans/deploy/` directory
- `deployment/atlas.md` — From `atlas/README.md` and `.claude/skills/atlas-deployment.md`
- `deployment/firewall.md` — From `rails_app/docs/features/deploys/firewall.md`

### Step 5: Ads docs (3 files)

- `ads/google-ads.md` — From `rails_app/decisions/google_ads/000-architecture-overview.md`
- `ads/google-account-connect.md` — Move `docs/google_account_connect.md` here
- `ads/campaign-deploy.md` — From `rails_app/decisions/google_ads/001-instrumentation-and-logging.md`

### Step 6: Agent infrastructure docs (4 files)

- `agent-infrastructure/llm-configuration.md` — From codebase + MEMORY.md
- `agent-infrastructure/cost-management.md` — From `plans/cost.md`
- `agent-infrastructure/langgraph-sdk.md` — From `docs/decisions/sdk.md`
- `agent-infrastructure/chat-system.md` — New synthesis from codebase

### Step 7: Remaining feature docs (5 files)

- `brainstorm/agent.md` — New synthesis from graph + prompts
- `analytics/tracking.md` — From `plans/analytics/` directory
- `analytics/insights.md` — From `langgraph_app/plans/analytics-dashboard-insights.md`
- `support/help-center.md` — From `docs/planning/help-center.md`
- `project-workflow/workflow.md` — New synthesis

### Step 8: Testing docs (5 files)

- `testing/overview.md` — From `docs/decisions/testing.md`
- `testing/database-snapshots.md` — Merge rails_app/docs/testing/ + features/snapshots.md
- `testing/playwright-e2e.md` — From `.claude/skills/playwright-e2e-tests.md`
- `testing/polly-recordings.md` — From MEMORY.md + langgraph CLAUDE.md
- `testing/evals.md` — From `langgraph_app/plans/evals.md`

### Step 9: Infrastructure docs (3 files)

- `infrastructure/services.md` — Move `docs/services.md`, add parallel dev info
- `infrastructure/database.md` — From `docs/decisions/data.md`
- `infrastructure/background-jobs.md` — New synthesis from CLAUDE.md patterns

### Step 10: Archive implemented plans

Move these to `plans/archive/` (create if needed):

**Root plans/**:
- `plans/cost.md` — Historical, bugs resolved
- `plans/aggressive-cost-cutting.md` — Implemented
- `plans/smart-cost-cutting.md` — Implemented
- `plans/swap-images.md` — Implemented
- `plans/impersonation-fix.md` — Empty placeholder
- `plans/architecture/architecture-overview.md` — Superseded by docs/
- `plans/coding-agent/image-access.md` — Implemented
- `plans/coding-agent/link-instructions.md` — Implemented
- `plans/coding-agent/static-validation.md` — Implemented
- `plans/deploy/website-deploy-graph.md` — Implemented
- `plans/deploy/deploy-graph-refactor.md` — Implemented
- `plans/deploy/instrumentation.md` — Implemented
- `plans/deploy/pre-deployment-validation.md` — Implemented
- `plans/deploy/atlas-spa-fallback.md` — Implemented
- `plans/analytics/analytics-tracking.md` — Implemented
- `plans/analytics/email-backend.md` — Implemented
- `plans/analytics/email-agent-guidance.md` — Implemented
- `plans/deploys/00-05` (all 6 files) — Older deploy plan, superseded

**langgraph_app/plans/**:
- `backend-optimization.md` — Stub, no content
- `polly-dev-mode.md` — Reference, absorbed into testing docs

**rails_app/plans/**:
- `playwright-server-helpers.md` — Implemented
- `subscribe-first-create-account-second.md` — Implemented
- `branch-split-proposal.md` — Reference/historical
- `website-builder-frontend.todo.md` — Stale todo list

**Keep active (NOT archived)**:
- `plans/deploy/browser-pool.md`, `environment-variables.md`, `seo.md`, `deploy-graph-testing.md`
- `plans/coding-agent/icon-search.md`, `next-steps.md`
- `plans/google-ads/*`, `plans/infrastructure/*`, `plans/sdk/*`
- `plans/context-engineering/*`, `plans/themes/deviations.md`
- `langgraph_app/plans/evals.md`, `template-pool.md`, `logging.md`, `task-phases-and-skippable-tasks.md`
- `langgraph_app/plans/website/close-gaps.md`, `visual-feedback.md`, `coding-agent-status.md` (deep reference)

### Step 11: Update docs/README.md with final links

Once all docs are written, do a final pass on the README to ensure all links work.

## Key Principles

- **docs/ = "how does it work today?"** — Current state only
- **plans/ = "what do we want to build?"** — Forward-looking, archived when done
- **decisions/ = "why did we choose this?"** — ADR format, append-only
- **CLAUDE.md = agent instructions** — Stays separate, links to docs/ for details
- **Link to code, don't duplicate it** — Key Files tables with paths + purpose
- **Billing docs are the gold standard** — Every new doc targets that format/depth

## Verification

After completion:
1. Every doc in docs/ should have a corresponding entry in docs/README.md
2. `docs/billing/` and `docs/decisions/` should be untouched
3. Archived plans should be in `plans/archive/`, `langgraph_app/plans/archive/`, or `rails_app/plans/archive/`
4. Active plans should remain in their original locations
5. Spot-check 3-4 docs against the actual codebase to verify accuracy
