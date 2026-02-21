# Next Steps

## Status Overview

| Plan | Status | Priority |
|------|--------|----------|
| [AI Cost Reconciliation](reconciliation.md) | Not started | Top |
| [Domain Picker](domains/) | Partially implemented | High |
| [Website Todos](website/todos.md) | Partially implemented | Medium |
| [Context Engineering](context-engineering/PLAN.md) | Implemented (needs verification) | Low |
| [Analytics](analytics.md) | Implemented | Done |
| [Performance Page](performance.md) | Implemented | Done |
| [Plan Tiers](tiers.md) | Implemented | Done |
| [Tracking E2E Tests](analytics/) | Implemented | Done |
| [FAQs](faqs/README.md) | Implemented | Done |
| [WebContainer Snapshots](website/webcontainer-snapshot-system.md) | Implemented | Done |

---

## Top Priority

### 1. AI Cost Reconciliation System
**Plan**: [reconciliation.md](reconciliation.md)
**Status**: Not started
**Why**: No verification that our billing pipeline works correctly. Silent bugs = lost revenue.
**Start with**: Phase 1 (Internal Self-Audit + Account Audit) - no external dependencies, catches the most dangerous problems immediately.

---

## High Priority

### 2. Domain Picker - Complete UI/UX Gaps
**Plans**: [domain-picker.md](domain-picker.md), [domains/gap-analysis.md](domains/gap-analysis.md), [domains/migration-roadmap.md](domains/migration-roadmap.md)
**Status**: Partially implemented (Phases 1-3 of migration roadmap done)
**What's done**: Core models (Domain, WebsiteUrl), AI recommendations, credit system, basic React components, DNS fields migration, verify_dns endpoint, TypeScript types.
**What's remaining**:
- Phase 4: UI structure refactor (tab removal, section reordering per Figma)
- Phase 5: DNS verification UI integration (service exists, not wired to CustomDomainPicker)
- Phase 6: Comprehensive E2E tests (current tests have broken locators)
- Plan gating for custom domains (Starter should see lock icon)
- Real-time availability checking on custom subdomain input
- Full URL availability status indicator

---

## Medium Priority

### 3. Website Builder Dynamic Todos
**Plan**: [website/todos.md](website/todos.md)
**Status**: Partially implemented
**What's done**: Todo type definitions, Langgraph annotation field, agent prompt instructions, frontend loading component updated, fallback to hardcoded steps.
**What's remaining**:
- Verify Langgraph middleware integration with createAppBridge
- Ensure agent reliably calls `write_todos` with user-friendly names
- Clean up WebsiteSidebar `currentStep` prop usage

---

## Low Priority / Verification Needed

### 4. Context Engineering Middleware
**Plan**: [context-engineering/PLAN.md](context-engineering/PLAN.md)
**Status**: Implemented, needs verification
**What's done**: AgentContextEvent model, model callback concern, API endpoints, event type validation.
**What needs verification**: Langgraph `contextEngineeringMiddleware` integration with `createAppBridge`.

---

## Completed (Archive Candidates)

These plans are fully implemented and can be moved to `plans/archive/` when convenient:

- **analytics.md** - Hybrid data architecture, caching, daily pre-compute all working
- **analytics/real-e2e-tracking-tests.md** - Full tracking test infrastructure with Buildable pipeline
- **analytics/tracking-e2e-testing.md** - Test endpoints, TypeScript clients, E2E tests
- **performance.md** - ProjectPerformance page, metrics, charts all functional
- **tiers.md** - PlanTier/TierLimit models, delegation, seeding complete
- **faqs/README.md** - Google Docs sync, extraction, admin UI working
- **website/webcontainer-snapshot-system.md** - Full pipeline (generation, CDN, manager, CI/CD)
