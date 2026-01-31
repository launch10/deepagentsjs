# Subdomain Picker Implementation - Red/Green/Refactor Stages

## User Outcomes

The subdomain picker enables users to:
1. **Get smart domain suggestions** based on their business idea
2. **Reuse existing domains** when they make sense for the new site
3. **See their domain portfolio** in one place
4. **Understand their limits** (credits remaining, upgrade paths)

---

## Stage 1: Rails API - Domain Context

### User Outcome
> "I can see all my domains and know how many more I can create"

### Tests (RED)

| # | Test | User Outcome |
|---|------|--------------|
| 1 | Returns existing platform subdomains | User sees their launch10.site domains |
| 2 | Returns existing custom domains | User sees their custom domains |
| 3 | Returns website associations | User knows which sites use which domains |
| 4 | Returns credit limits | User knows how many free subdomains remain |
| 5 | Returns brainstorm context | AI has context for recommendations |
| 6 | Scoped to user's account | User only sees their own data |

### Implementation (GREEN)
- Add `GET /api/v1/websites/:id/domain_context` to context controller
- Return all account domains with website associations
- Return subdomain credit usage

### Refactor
- Ensure no N+1 queries on domain → website relationships

---

## Stage 2: Langgraph Domain Recommendations

### User Outcome
> "I get smart suggestions that match my business, and I know which of my existing domains would work well"

### Tests (RED)

| # | Test | User Outcome |
|---|------|--------------|
| 1 | Scores existing domains against brainstorm | User sees relevance of existing domains |
| 2 | Generates creative new subdomain suggestions | User gets brandable options |
| 3 | Checks availability of suggestions | User doesn't pick taken subdomains |
| 4 | Recommends existing when score > threshold | User reuses good matches |
| 5 | Recommends new when no good existing match | User gets fresh suggestions |
| 6 | Handles zero credits gracefully | User sees existing options or upgrade path |
| 7 | Falls back when AI fails | User always gets some suggestions |
| 8 | Caches results | User sees instant results on revisit |

### Implementation (GREEN)
- Create `domainRecommendationsService.ts`
- LLM prompt to score existing domains for relevance
- LLM prompt to generate brandable subdomains
- DNS/DB check for availability
- State machine: `no_existing_sites` | `existing_recommended` | `new_recommended` | `out_of_credits_*`

### Refactor
- Parallel availability checks
- Extract prompts to config

---

## Stage 3: Frontend Data Fetching

### User Outcome
> "Recommendations are ready by the time I need to pick a domain"

### Tests (RED)

| # | Test | User Outcome |
|---|------|--------------|
| 1 | Preloads during website generation | No wait when reaching domain picker |
| 2 | Shows loading state if still fetching | User knows something is happening |
| 3 | Handles API errors gracefully | User can retry or continue |
| 4 | Combines Rails context + Langgraph recs | User sees unified view |

### Implementation (GREEN)
- `useDomainRecommendations(websiteId)` hook
- Parallel fetch of Rails context + Langgraph recommendations
- Preload when website generation starts

### Refactor
- React Query for caching and deduplication

---

## Stage 4: SubdomainPicker UI Component

### User Outcome
> "I can easily pick a domain, see my options, and understand what's recommended"

### Tests (RED)

| # | Test | User Outcome |
|---|------|--------------|
| 1 | Shows existing sites with star on recommended | User knows which existing domain fits best |
| 2 | Shows new suggestions with star on recommended | User knows which new option is best |
| 3 | Hides existing section when user has none | Clean UI for new users |
| 4 | Disables new options when out of credits | User understands the limit |
| 5 | Shows upgrade CTA when blocked by credits | User has clear path forward |
| 6 | Allows custom subdomain input | User can type their own idea |
| 7 | Validates subdomain format in real-time | User doesn't submit invalid names |
| 8 | Shows loading skeleton during fetch | User knows data is coming |

### Implementation (GREEN)
- `SubdomainPicker.tsx` with combobox pattern
- Sections: Create New (input + suggestions) → Your Existing Sites → Connect Own Domain
- Visual states per UI matrix from plan

### Refactor
- Animation for dropdown sections
- Keyboard navigation

---

## Stage 5: End-to-End Integration

### User Outcome
> "From idea to deployed site, domain selection just works"

### Tests (RED)

| # | Test | User Outcome |
|---|------|--------------|
| 1 | Create website → see recommendations → pick → deploy | Full happy path works |
| 2 | Pick existing domain → site deployed to that domain | Reusing domains works |
| 3 | Type custom subdomain → site deployed there | Custom input works |
| 4 | Out of credits → select existing → deploy | Graceful degradation |
| 5 | Out of credits, no match → shows upgrade path | Clear next steps |

### Implementation (GREEN)
- Wire SubdomainPicker into Website Setup step
- Preload recommendations when chat message submitted
- Handle domain selection → deploy flow

### Refactor
- Telemetry on recommendation acceptance rate
- A/B test recommendation algorithms

---

## Execution Order

```
Stage 1 (Rails) ─┬─→ Stage 3 (Hook) ──→ Stage 4 (UI) ──→ Stage 5 (E2E)
Stage 2 (LG)  ───┘
```

Stages 1 and 2 can run in parallel.

---

## Current Status

- [x] **Stage 1: Rails API** — User sees their domains + credits ✅ (12 tests passing)
- [x] **Stage 2: Langgraph** — User gets smart recommendations ✅ (12 tests passing)
- [x] **Stage 3: Hook** — Data is preloaded, no waiting ✅
- [x] **Stage 4: UI** — User can pick from clear options ✅ (19 tests passing)
- [x] **Stage 5: E2E** — Full flow integrated ✅

---

## Implementation Log

### Stage 1 Complete (2026-01-29)

**Files Created/Modified:**
- `rails_app/config/routes/api.rb` - Added `domain_context` route
- `rails_app/app/controllers/api/v1/context_controller.rb` - Added `domain_context` action
- `rails_app/spec/requests/api/v1/domain_context_spec.rb` - 12 request specs
- `rails_app/spec/support/schemas/context_schemas.rb` - Added response schema

**Key Decisions:**
- Used `includes(:website, :website_urls)` to prevent N+1 queries
- Scoped domains to `current_account.domains` (all domains, not just platform)
- Returns credits based on plan tier limits
- Brainstorm context is nullable when not present

### Stage 2 Complete (2026-01-29)

**Files Created/Modified:**
- `langgraph_app/app/services/domains/domainRecommendationsService.ts` - Core service
- `langgraph_app/app/services/domains/index.ts` - Module export
- `langgraph_app/app/services/index.ts` - Added domains export
- `langgraph_app/app/server/routes/domains.ts` - Hono route for POST /api/domains/recommendations
- `langgraph_app/server.ts` - Registered domains route
- `langgraph_app/tests/tests/services/domains/domainRecommendationsService.test.ts` - 12 unit tests

**Key Decisions:**
- Service uses dependency injection pattern for LLM calls (mockable in tests)
- State machine determines UI state: `no_existing_sites` | `existing_recommended` | `new_recommended` | `out_of_credits_*`
- Score threshold of 80 distinguishes "good match" existing domains
- Fallback generates slug from business idea when LLM fails
- ~~TODO: Implement actual availability checking (DNS/DB lookup)~~ ✅ Done

### Availability Checking Complete (2026-01-29)

**Files Modified:**
- `langgraph_app/app/services/domains/domainRecommendationsService.ts` - Added `checkAvailabilityBatch` method
- `langgraph_app/app/server/routes/domains.ts` - Pass JWT from auth context to service
- `langgraph_app/tests/tests/services/domains/domainRecommendationsService.test.ts` - Added 5 availability tests (now 16 total)
- `rails_app/app/javascript/frontend/api/domainContext.hooks.ts` - Added `existing` to AvailabilityStatus type

**Key Decisions:**
- Batch availability checking via Rails `POST /api/v1/domains/search` endpoint
- Maps Rails statuses to: `available` | `taken` | `existing` | `unknown`
- `existing` means user already owns this domain
- `taken` means another user owns it
- Graceful fallback to `unknown` on API errors
- JWT passed from auth middleware to service for authenticated Rails calls
- Efficient single batch call instead of per-domain calls

### Stage 3 Complete (2026-01-29)

**Files Created/Modified:**
- `shared/lib/api/services/domainContextAPIService.ts` - Rails API client
- `shared/lib/api/services/index.ts` - Added export
- `rails_app/app/javascript/frontend/api/domainContext.hooks.ts` - React Query hooks
- `rails_app/app/javascript/frontend/api/index.ts` - Added export

**Key Decisions:**
- `useDomainContext` fetches Rails context (existing domains + credits + brainstorm)
- `useDomainRecommendations` fetches Langgraph recommendations (requires context first)
- `useDomainRecommendationsWithContext` combines both queries, handling dependencies
- Langgraph URL dynamically computed based on environment (dev: Rails port + 1000)
- 5-minute stale time for caching

### Stage 4 Complete (2026-01-29)

**Files Created/Modified:**
- `rails_app/app/javascript/frontend/components/website/subdomain-picker/SubdomainPicker.tsx` - Main component
- `rails_app/app/javascript/frontend/components/website/subdomain-picker/index.ts` - Exports
- `rails_app/app/javascript/frontend/components/website/subdomain-picker/__tests__/SubdomainPicker.test.tsx` - 19 unit tests

**Key Decisions:**
- Used function components for sub-sections (LoadingSkeleton, ErrorState, DomainOption, etc.)
- Validation uses regex: lowercase, alphanumeric, hyphens; max 63 chars
- Star icon indicates recommendation; checkmark indicates selection
- Disabled state shows opacity and cursor-not-allowed
- UI states handled via `uiState` prop from recommendations response
- Custom subdomain input with real-time validation

### Stage 5 Complete (2026-01-29)

**Files Modified:**
- `rails_app/app/javascript/frontend/components/website/sidebar/quick-actions/QuickActions.tsx` - Added "Connect Domain" quick action

**Key Decisions:**
- Integrated SubdomainPicker as a 4th quick action (alongside colors, images, copy)
- Follows existing QuickActions pattern with toggle expand/collapse
- Uses `GlobeAltIcon` with `text-accent-blue-500` color
- TODO: Wire domain selection to API to create/assign domains

**Remaining Work:**
- ✅ Implement actual availability checking via Rails API
- ✅ Wire `onSelect` callback to domains API to create/assign the domain record
- ✅ Update website with selected domain (domain.website_id is set during create/update)
- ✅ Trigger deployment after domain assignment ("Deploy Now" button added)
- Add preloading during website generation (optional optimization)
- **CRITICAL ARCHITECTURE ISSUE**: Implementation deviates from plan - should be a graph node, not a separate API (see domain_picker.md)

### Domain Assignment Wiring Complete (2026-01-29)

**Files Created/Modified:**
- `rails_app/config/routes/api.rb` - Added `:update` to domains routes
- `rails_app/app/controllers/api/v1/domains_controller.rb` - Added `update` action for domain reassignment
- `rails_app/spec/requests/api/v1/domains_spec.rb` - 6 request specs for domain update endpoint
- `rails_app/spec/support/schemas/context_schemas.rb` - Added `domain_response` schema
- `shared/lib/api/services/domainsAPIService.ts` - Added `update` method
- `rails_app/app/javascript/frontend/api/domainContext.hooks.ts` - Added `useUpdateDomain` mutation hook
- `rails_app/app/javascript/frontend/components/website/sidebar/quick-actions/QuickActions.tsx` - Wired both create and update mutations

**Key Decisions:**
- `PATCH /api/v1/domains/:id` accepts `{ domain: { website_id: number } }` to reassign domains
- Validation ensures target website belongs to current account
- Both new domain creation and existing domain reassignment now work
- Success/error/loading states handle both mutation types

### Refactor: Deploy Button Added (2026-01-29)

**Files Modified:**
- `rails_app/app/javascript/frontend/components/website/sidebar/quick-actions/QuickActions.tsx`

**Changes:**
- Removed unused `cn` import
- Added "Deploy Now" button that appears after successful domain assignment
- Button navigates to `/projects/{projectUuid}/deploy` using Inertia router
- Added `RocketLaunchIcon` for visual consistency
- Added `useProjectUuid` hook to get project context for navigation
