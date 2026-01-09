# Implementation Order: Landing Page Agent Infrastructure

## Overview

This document defines the implementation order for all coding agent enhancements. Follow Red/Green/Refactor methodology.

**Key Decisions (Resolved):**
1. Unified `deployGraph` with `deployWebsite` and `deployGoogleAds` boolean flags
2. No PostHog - only `L10.conversion()` for Google Ads tracking
3. No tracking in coding agent - `instrumentationNode` handles all tracking
4. Pure LangGraph orchestration for validation

---

## Dependency Graph

```
Phase 1: Foundation (Independent - Can Parallelize)
├── 1a. Atlas SPA Fallback        [atlas-spa-fallback.md]
├── 1b. Environment Variables     [environment-variables.md]
├── 1c. Email Backend (Rails)     [email-backend.md]
│        └── depends on: 1b (Environment Variables)
├── 1d. Image Access              [coding-agent-image-access.md]
├── 1e. Icon Search               [icon-search.md]
├── 1f. Theme Integration         [theme-integration.md]
└── 1g. Browser Pool              [browser-pool.md]
         └── Port 0, lazy init, bounded concurrency for multi-tenant validation

Phase 2: Layer 1 Validation
└── 2. Static Validation          [coding-agent-static-validation.md]
       └── depends on: 1a (Atlas SPA Fallback)

Phase 3: Deploy Infrastructure
└── 3. Unified deployGraph        [website-deploy-graph.md, coding-agent-deploy-validation.md, analytics-tracking.md]
       └── depends on: 2 (Static Validation), 1b (Environment Variables), 1g (Browser Pool)
       └── includes: instrumentation, website deploy, runtime validation, campaign deploy

Phase 4: Integration Testing
└── 4. End-to-End Testing
       └── depends on: all above
```

---

## Phase 1: Foundation

### 1a. Atlas SPA Fallback
**Plan:** `atlas-spa-fallback.md`
**Effort:** Small (~10 lines)
**Why First:** Required by validation - routes must work before we can validate them.

#### RED (Acceptance Criteria)
- [ ] `GET /pricing` returns 404
- [ ] `GET /about/team` returns 404

#### GREEN (Implementation)
- [ ] Modify `atlas/src/index-public.tsx` - add SPA fallback logic
- [ ] `GET /pricing` returns index.html (200)
- [ ] `GET /about/team` returns index.html (200)
- [ ] `GET /assets/missing.js` returns 404 (no fallback for files)

#### REFACTOR
- [ ] Add `X-SPA-Fallback: true` header for debugging

---

### 1b. Environment Variables
**Plan:** `environment-variables.md`
**Effort:** Small
**Why:** Provides env vars (VITE_SIGNUP_TOKEN, VITE_API_BASE_URL) for deployed sites. Required by Email Backend.

#### RED (Acceptance Criteria)
- [ ] No env vars injected during website build
- [ ] Agent doesn't know about available env vars

#### GREEN (Implementation)
- [ ] Add `config.x.api_base_url` to Rails config
- [ ] Add `signup_token` method to Project (uses `signed_id`)
- [ ] Modify `buildable.rb` to write `.env` file before `pnpm build`
- [ ] Update coding agent system prompt with env var documentation

#### REFACTOR
- [ ] N/A (intentionally minimal)

---

### 1c. Email Backend (Rails)
**Plan:** `email-backend.md`
**Depends On:** 1b (Environment Variables)
**Effort:** Medium
**Why:** Provides lead capture infrastructure. Uses VITE_SIGNUP_TOKEN from Environment Variables.

#### RED (Acceptance Criteria)
- [ ] `POST /api/v1/leads` returns 401 (no endpoint exists)
- [ ] No `Lead` model exists

#### GREEN (Implementation)
- [ ] Create `leads` table migration
- [ ] Create `Lead` model with validations
- [ ] Update `Project` model (token generation, `has_many :leads`)
- [ ] Create `Api::V1::LeadsController`
- [ ] Update CORS for public access
- [ ] `POST /api/v1/leads` with valid token creates lead (201)
- [ ] Duplicate email returns 200 (idempotent)
- [ ] Invalid token returns 401

#### REFACTOR
- [ ] Add rate limiting concern (if needed)

---

### 1d. Image Access
**Plan:** `coding-agent-image-access.md`
**Effort:** Small (single file)
**Why:** Simple enhancement to agent capabilities.

#### RED (Acceptance Criteria)
- [ ] Agent receives images as text URLs only

#### GREEN (Implementation)
- [ ] Modify `agent.ts` to use `createMultimodalPseudoMessage`
- [ ] Agent receives images as multimodal content blocks
- [ ] Agent can "see" and describe uploaded images

#### REFACTOR
- [ ] N/A

---

### 1e. Icon Search
**Plan:** `icon-search.md`
**Effort:** Small (move from TODO)
**Why:** Independent tool addition.

#### RED (Acceptance Criteria)
- [ ] Agent has no icon search capability
- [ ] `SearchIconsTool` exists in `TODO/` folder

#### GREEN (Implementation)
- [ ] Move `SearchIconsTool` from `TODO/` to `app/tools/`
- [ ] Move `SearchIconsService` from `TODO/` to `app/services/`
- [ ] Add tool to `createDeepAgent` in `agent.ts`
- [ ] Populate `icon_embeddings` table (if empty)
- [ ] Agent can search for icons by concept ("fast", "secure")
- [ ] Returns relevant Lucide React icon names

#### REFACTOR
- [ ] Add caching warm-up on server start (optional)

---

### 1f. Theme Integration
**Plan:** `theme-integration.md`
**Effort:** Small (move from TODO + 15 lines)
**Why:** Independent enhancement to context loading.

#### RED (Acceptance Criteria)
- [ ] Theme colors not applied to `index.css`
- [ ] `IndexCssService` exists in `TODO/` folder

#### GREEN (Implementation)
- [ ] Move `IndexCssService` to `app/services/themes/`
- [ ] Fix dependency on `TemplateFileModel`
- [ ] Add theme application in `buildContext.ts` (~15 lines)
- [ ] Theme CSS variables injected into `index.css`
- [ ] User-selected theme reflects in generated page

#### REFACTOR
- [ ] Add Rails `before_save` callback for community theme expansion (optional)

---

### 1g. Browser Pool
**Plan:** `browser-pool.md`
**Effort:** Medium
**Why:** Required for concurrent multi-tenant runtime validation without OOM or queue delays.

#### RED (Acceptance Criteria)
- [ ] Each `BrowserErrorCapture` launches full Chromium instance (~200MB)
- [ ] `WebsiteRunner` defaults to port 5173 (concurrent conflicts)
- [ ] 10 concurrent deploys = 2GB RAM = potential OOM

#### GREEN (Implementation)
- [ ] Change `WebsiteRunner` default port from 5173 to 0 (OS assigns)
- [ ] Create `browserPool.ts` singleton with lazy init
- [ ] Add bounded concurrency (max 10 contexts)
- [ ] Add race condition protection for concurrent first-launch
- [ ] Modify `BrowserErrorCapture` to use pool contexts
- [ ] Add proper cleanup with try/finally
- [ ] 10 concurrent deploys = ~300MB RAM (one browser, 10 contexts)

#### REFACTOR
- [ ] Add metrics/logging for context usage (optional)

---

## Phase 2: Layer 1 Validation

### 2. Static Validation (In-Loop)
**Plan:** `coding-agent-static-validation.md`
**Depends On:** 1a (Atlas SPA Fallback)
**Effort:** Medium

#### RED (Acceptance Criteria)
- [ ] Agent generates broken anchor link → no error
- [ ] Agent generates missing route → no error
- [ ] No `staticValidation` node in graph

#### GREEN (Implementation)
- [ ] Create `linkValidator.ts` (anchor, route, asset validation)
- [ ] Create `staticValidationService.ts`
- [ ] Create `staticValidation.ts` node
- [ ] Update `codingAgentAnnotation.ts` (`validationPassed`, `validationErrors`, `retryCount`)
- [ ] Update `codingAgent.ts` graph (add node + conditional edge)
- [ ] Broken anchor link → validation error → retry
- [ ] Missing route → validation error → retry
- [ ] Valid code → passes → cleanup
- [ ] Max 2 retries then proceeds

#### REFACTOR
- [ ] Add TypeScript build validation (optional, separate PR)

---

## Phase 3: Deploy Infrastructure

### 3. Unified deployGraph
**Plans:** `website-deploy-graph.md`, `coding-agent-deploy-validation.md`, `analytics-tracking.md`
**Depends On:** Phase 2
**Effort:** Large

This phase implements the unified `deployGraph` with boolean flags:
- `deployWebsite: boolean` (default: true)
- `deployGoogleAds: boolean` (default: false)

#### RED (Acceptance Criteria)
- [ ] No `deployGraph` exists
- [ ] No `L10.conversion()` in template
- [ ] Console errors in deployed page go undetected
- [ ] Website deploy happens via Rails only (no orchestration)

#### GREEN (Implementation)

**Step 3.1: Graph Structure**
- [ ] Create `deployAnnotation.ts` with boolean flags and state
- [ ] Create `deploy.ts` graph skeleton with conditional edges
- [ ] Graph can be invoked with different flag combinations

**Step 3.2: Instrumentation Node**
- [ ] Create `tracking.ts` in template (`L10.conversion()` module)
- [ ] Create `instrumentationNode.ts`:
  - LLM semantic analysis: identify primary conversion form
  - Inject `L10_CONFIG` with `googleAdsId` and `conversionLabels`
  - Add gtag.js script to index.html
  - Add `L10.conversion({ label: 'signup' })` calls to forms
  - Inject `VITE_SIGNUP_TOKEN` for lead capture
- [ ] Running instrumentation adds gtag script to index.html
- [ ] Running instrumentation adds L10.conversion() to signup form

**Step 3.3: Website Deploy Node**
- [ ] Create `deployWebsiteNode.ts` (fire-and-forget pattern)
- [ ] Node invokes Rails WebsiteDeploy job
- [ ] Node waits for webhook callback

**Step 3.4: Runtime Validation Node**
- [ ] Create `runtimeValidationNode.ts`:
  - Integrate `ErrorExporter`, `WebsiteRunner`, `BrowserErrorCapture`
  - Check for console errors
  - Check for failed network requests
  - Verify all routes load
- [ ] Page with console error → validation fails
- [ ] Page with 404 asset → validation fails
- [ ] All routes load → validation passes

**Step 3.5: Fix Loop**
- [ ] Create `fixWithCodingAgentNode.ts` (invoke codingAgentGraph with error context)
- [ ] Wire conditional edge: validation fail → fix → retry instrumentation
- [ ] Validation failure triggers fix loop
- [ ] Max 2 retries then proceeds

**Step 3.6: Google Ads Integration**
- [ ] Move existing `deployCampaignNode` into deployGraph
- [ ] Create `GoogleAds::Resources::ConversionAction` Rails service
- [ ] deployCampaignNode invokes Rails CampaignDeploy job
- [ ] Conversion actions created in Google Ads

#### REFACTOR
- [ ] Delete old `launchGraph` (replaced by deployGraph)
- [ ] Remove analytics instructions from coding agent system prompt
- [ ] Extract common job invocation pattern to utility

---

## Phase 4: Integration Testing

### 4. End-to-End Testing

#### Acceptance Criteria
- [ ] Create project → generate page → deploy → page live
- [ ] Page with signup form → submit → lead created in Rails
- [ ] Page with signup form → submit → Google Ads conversion tracked
- [ ] Invalid page → validation fails → agent fixes → retry → success
- [ ] Theme change → redeploy → new colors applied

---

## Files Summary

### Phase 1a (Atlas SPA Fallback)
| File | Action |
|------|--------|
| `atlas/src/index-public.tsx` | Modify |

### Phase 1b (Environment Variables)
| File | Action |
|------|--------|
| `rails_app/config/application.rb` | Modify |
| `rails_app/config/environments/production.rb` | Modify |
| `rails_app/app/models/project.rb` | Modify |
| `rails_app/app/models/concerns/website_deploy_concerns/buildable.rb` | Modify |
| `langgraph_app/app/nodes/codingAgent/prompts/system.ts` | Modify |

### Phase 1c (Email Backend)
| File | Action |
|------|--------|
| `rails_app/db/migrate/xxx_create_leads.rb` | Create |
| `rails_app/app/models/lead.rb` | Create |
| `rails_app/app/models/project.rb` | Modify |
| `rails_app/app/controllers/api/v1/leads_controller.rb` | Create |
| `rails_app/config/routes/api.rb` | Modify |
| `rails_app/config/initializers/cors.rb` | Modify |

### Phase 1d (Image Access)
| File | Action |
|------|--------|
| `langgraph_app/app/nodes/codingAgent/agent.ts` | Modify |

### Phase 1e (Icon Search)
| File | Action |
|------|--------|
| `langgraph_app/app/tools/searchIcons.ts` | Move from TODO |
| `langgraph_app/app/services/searchIconsService.ts` | Move from TODO |
| `langgraph_app/app/nodes/codingAgent/utils/agent.ts` | Modify |

### Phase 1f (Theme Integration)
| File | Action |
|------|--------|
| `langgraph_app/app/services/themes/indexCssService.ts` | Move from TODO |
| `langgraph_app/app/nodes/codingAgent/buildContext.ts` | Modify |

### Phase 1g (Browser Pool)
| File | Action |
|------|--------|
| `langgraph_app/app/services/editor/errors/browserPool.ts` | Create |
| `langgraph_app/app/services/editor/errors/browserErrorCapture.ts` | Modify |
| `langgraph_app/app/services/editor/core/websiteRunner.ts` | Modify |
| `langgraph_app/app/services/editor/errors/index.ts` | Modify |
| `langgraph_app/tests/services/editor/errors/browserPool.test.ts` | Create |

### Phase 2 (Static Validation)
| File | Action |
|------|--------|
| `langgraph_app/app/services/editor/validation/linkValidator.ts` | Create |
| `langgraph_app/app/services/editor/validation/staticValidationService.ts` | Create |
| `langgraph_app/app/nodes/codingAgent/staticValidation.ts` | Create |
| `langgraph_app/app/annotation/codingAgentAnnotation.ts` | Modify |
| `langgraph_app/app/graphs/codingAgent.ts` | Modify |

### Phase 3 (Unified deployGraph)
| File | Action |
|------|--------|
| `langgraph_app/app/graphs/deploy.ts` | Create |
| `langgraph_app/app/annotation/deployAnnotation.ts` | Create |
| `langgraph_app/app/nodes/deploy/instrumentationNode.ts` | Create |
| `langgraph_app/app/nodes/deploy/deployWebsiteNode.ts` | Create |
| `langgraph_app/app/nodes/deploy/runtimeValidationNode.ts` | Create |
| `langgraph_app/app/nodes/deploy/fixWithCodingAgentNode.ts` | Create |
| `langgraph_app/app/nodes/deploy/deployCampaignNode.ts` | Move from launch/ |
| `langgraph_app/app/nodes/deploy/index.ts` | Create |
| `rails_app/templates/default/src/lib/tracking.ts` | Create |
| `rails_app/app/services/google_ads/resources/conversion_action.rb` | Create |
| `langgraph_app/app/graphs/launch.ts` | Delete |

---

## Related Plans

| Plan | Description |
|------|-------------|
| `architecture-overview.md` | System architecture overview |
| `environment-variables.md` | Encrypted env var storage and build injection |
| `browser-pool.md` | Lazy browser pool with bounded concurrency |
| `website-deploy-graph.md` | deployGraph implementation details |
| `atlas-spa-fallback.md` | SPA fallback for React Router |
| `coding-agent-static-validation.md` | Layer 1 validation details |
| `coding-agent-deploy-validation.md` | Layer 2 validation details |
| `coding-agent-image-access.md` | Multimodal image injection |
| `icon-search.md` | Lucide icon semantic search |
| `theme-integration.md` | Theme CSS application |
| `email-backend.md` | Lead capture infrastructure |
| `analytics-tracking.md` | Google Ads conversion tracking |
