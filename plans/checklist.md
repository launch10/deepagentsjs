## Completed Features

### Phase 1a: Atlas SPA Fallback
- [x] Implemented SPA fallback logic in `atlas/src/index-public.tsx`
- [x] Routes without file extensions now fallback to index.html
- [x] Excludes asset requests, dotfiles, and API paths from fallback
- [x] Added comprehensive tests for SPA fallback behavior

### Phase 1b: Environment Variables
- [x] Add `config.x.api_base_url` to Rails config
- [x] Add `signup_token` method to Project
- [x] Modify `buildable.rb` to write `.env` file before `pnpm build`
- [x] Update coding agent system prompt with env var documentation

## In Progress

### Phase 1c: Email Backend (Rails)
- [x] Add `rack-cors` gem to Gemfile
- [x] Create leads migration
- [x] Create Lead model
- [x] Update Project model with `has_many :leads`
- [x] Create LeadsController
- [x] Add leads route
- [x] Create CORS initializer

### Phase 1d: Image Access
- [x] Modify `agent.ts` to use `createMultimodalPseudoMessage`

### Phase 1e: Icon Search
- [x] Move `SearchIconsTool` from `TODO/` to `app/tools/`
- [x] Move `SearchIconsService` from `TODO/` to `app/services/`
- [x] Add tool to `createDeepAgent` in `agent.ts`

### Phase 1f: Theme Integration
- [x] Add `Themes::ColorExpander` service in Rails
- [x] Add before_save callback in Theme model
- [x] Backfill migration for existing community themes

### Phase 1g: Browser Pool
- [x] Create BrowserPool singleton with bounded concurrency
- [x] Update BrowserErrorCapture to use pool
- [x] Change WebsiteRunner default port to 0 (dynamic)
- [x] Add graceful shutdown handlers

## Phase 1 Complete

All Phase 1 features have been implemented:
- Atlas SPA Fallback for React Router
- Environment Variables for lead capture
- Email Backend (Rails) with CORS
- Image Access for coding agent
- Icon Search with semantic embeddings
- Theme Integration for community themes
- Browser Pool for concurrent validation

## Phase 2 Complete

### Phase 2: Static Validation
- [x] Create `staticValidation.ts` with link validation logic
- [x] Validate anchor links (#id) against id attributes
- [x] Validate route links (/path) against App.tsx Routes
- [x] Skip external, mailto, and tel links
- [x] Add retry mechanism (up to 2 retries on failure)
- [x] Export from codingAgent/index.ts
- [x] Update graph with conditional edges for retry loop
- [x] Add unit tests for validation functions

## In Progress

### Phase 3: Deploy Infrastructure
- [x] Create DeployAnnotation with task-based state pattern
- [x] Create deployGraph skeleton with conditional edges
- [x] Create runtimeValidationNode using ErrorExporter
- [x] Create deployWebsiteNode (fire-and-forget pattern, stub)
- [x] Create instrumentationNode (stub for LLM analysis)
- [x] Create fixWithCodingAgentNode (invokes codingAgentGraph)
- [x] Copy deployCampaignNode to deploy/ with DeployGraphState
- [x] Add TaskNames for new deploy tasks (WebsiteDeploy, etc.)
- [x] Add WebsiteDeploy to Rails ALLOWED_JOBS
- [x] Update swagger and regenerate types
- [x] Create tracking.ts template for L10.conversion()
- [x] Implement full instrumentationNode with LLM analysis

## Phase 3 Complete

All Phase 3 features have been implemented:
- DeployAnnotation with task-based state pattern
- Unified deployGraph with conditional edges for validation/fix loop
- runtimeValidationNode using Playwright ErrorExporter
- deployWebsiteNode with fire-and-forget Rails job pattern
- instrumentationNode with LLM analysis for conversion tracking injection
- fixWithCodingAgentNode invoking codingAgentGraph subgraph
- deployCampaignNode for Google Ads deployment
- tracking.ts template for L10.conversion()
- Rails WebsiteDeploy job integration

## Pending

### Phase 4: Integration Testing
- [ ] Create e2e test for deployGraph flow
- [ ] Test instrumentation injects L10.conversion correctly
- [ ] Test runtime validation catches console errors
- [ ] Test fix loop retries with coding agent
- [ ] Test WebsiteDeploy job execution
