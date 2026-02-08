# Launch10 Documentation Hub

Canonical current-state reference for how Launch10 works today.

- **docs/** = "How does it work today?" — Current state only
- **plans/** = "What do we want to build?" — Forward-looking, archived when done
- **decisions/** = "Why did we choose this?" — ADR format, append-only

## Architecture

| Doc | Description |
|-----|-------------|
| [Architecture Overview](architecture/overview.md) | Two-service architecture: Rails + Langgraph + Atlas |
| [Authentication](architecture/authentication.md) | Devise + JWT + multi-tenancy across services |
| [Async Patterns](architecture/async-patterns.md) | Fire-and-forget, webhook callbacks, streaming |

## Frontend

| Doc | Description |
|-----|-------------|
| [Architecture Overview](frontend/overview.md) | React + Inertia + Vite stack, directory structure, routing |
| [Components](frontend/components.md) | shadcn/ui design system, CVA patterns, compound components |
| [Streaming & Chat](frontend/streaming.md) | useLanggraph, SmartSubscription, SSE, Chat compound components |
| [Website Builder UI](frontend/website-builder-ui.md) | Preview panel, sidebar, quick actions, WebContainer frontend |
| [State & Forms](frontend/forms-and-state.md) | Zustand stores, React Hook Form, React Query, Inertia hydration |

## Website Builder

| Doc | Description |
|-----|-------------|
| [Coding Agent](website/coding-agent.md) | Classifier → single-shot edit → full agent escalation |
| [Themes](website/themes.md) | Theme system and design tokens |
| [Templates](website/templates.md) | Landing page templates |
| [Domains](website/domains.md) | Subdomain picker, custom domains |
| [WebContainers](website/webcontainers.md) | In-browser preview and snapshot system |

## Deployment

| Doc | Description |
|-----|-------------|
| [Pipeline](deployment/pipeline.md) | Deploy graph: task phases |
| [Atlas](deployment/atlas.md) | Cloudflare Workers, R2, KV |
| [Firewall](deployment/firewall.md) | Rate limiting, request counting |

## Brainstorm

| Doc | Description |
|-----|-------------|
| [Brainstorm Agent](brainstorm/agent.md) | Brainstorm agent flow and prompts |

## Ads

| Doc | Description |
|-----|-------------|
| [Google Ads](ads/google-ads.md) | Campaign creation, deferred sync |
| [Account Connect](ads/google-account-connect.md) | OAuth + invite verification flow |
| [Campaign Deploy](ads/campaign-deploy.md) | CampaignDeploy step-by-step |

## Analytics

| Doc | Description |
|-----|-------------|
| [Tracking](analytics/tracking.md) | Ahoy events, conversion tracking |
| [Insights](analytics/insights.md) | Dashboard, AI-generated insights |

## Billing

See [billing/](billing/) — 13 docs covering credits, Stripe, charging, and subscriptions.

## Agent Infrastructure

| Doc | Description |
|-----|-------------|
| [LLM Configuration](agent-infrastructure/llm-configuration.md) | getLLM, model tiers, prompt caching |
| [Cost Management](agent-infrastructure/cost-management.md) | Token tracking, cost optimization |
| [Langgraph SDK](agent-infrastructure/langgraph-sdk.md) | useLanggraph hook, SmartSubscription |
| [Chat System](agent-infrastructure/chat-system.md) | Polymorphic Chat, threading, streaming |

## Support

| Doc | Description |
|-----|-------------|
| [Help Center](support/help-center.md) | FAQ system, AI support agent |

## Testing

| Doc | Description |
|-----|-------------|
| [Overview](testing/overview.md) | Testing philosophy and stack |
| [Database Snapshots](testing/database-snapshots.md) | Snapshot system for test isolation |
| [Playwright E2E](testing/playwright-e2e.md) | E2E with scenarios/queries |
| [Polly Recordings](testing/polly-recordings.md) | HTTP recording for AI tests |
| [Evals](testing/evals.md) | Online/offline evals, scoring |

## Infrastructure

| Doc | Description |
|-----|-------------|
| [Services](infrastructure/services.md) | Port allocation, parallel development |
| [Database](infrastructure/database.md) | Shared DB, Rails-owns-schema |
| [Background Jobs](infrastructure/background-jobs.md) | Sidekiq, Zhong, worker patterns |
| [Debugging & Observability](infrastructure/debugging.md) | LangSmith traces, Pino logging, Rollbar, Google Ads instrumentation |

## Decisions

See [decisions/](decisions/) — ADRs for architecture, auth, data, deployment, frontend, SDK, and testing.

## Project Workflow

| Doc | Description |
|-----|-------------|
| [Workflow](project-workflow/workflow.md) | Brainstorm → website → ads lifecycle |
