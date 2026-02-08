# Testing Overview

Launch10 uses a multi-layer testing strategy across both Rails and Langgraph services. Rails uses RSpec for unit/request specs, Vitest for React component tests, and Playwright for E2E browser tests. Langgraph uses Vitest with Polly.js HTTP recording for deterministic AI agent testing. All test layers enforce sequential execution to prevent race conditions.

## Testing Stack

```
Layer 4: E2E (Playwright)
  └─ Full user workflows in browser
  └─ Database snapshots for isolation
  └─ cypress-on-rails for server-side state

Layer 3: Integration (Vitest + Polly.js)
  └─ Full agent graph execution
  └─ HTTP recording/replay (no live API calls in CI)
  └─ GraphTestBuilder fluent API

Layer 2: Component (Vitest + Testing Library)
  └─ React component behavior
  └─ happy-dom environment

Layer 1: Unit/Request (RSpec)
  └─ Models, services, controllers
  └─ FactoryBot fixtures (61 factories)
  └─ Swagger/RSwag for API docs
```

## Configuration Files

| File | Framework | Key Settings |
|------|-----------|-------------|
| `rails_app/spec/rails_helper.rb` | RSpec | DatabaseCleaner (transaction), Sidekiq fake mode, eager load |
| `rails_app/vitest.config.ts` | Vitest | happy-dom, 30s timeout, `app/javascript/frontend/**/*.test.ts` |
| `rails_app/playwright.config.ts` | Playwright | 1 worker, 2min timeout, base URL from `RAILS_PORT` |
| `langgraph_app/vitest.config.ts` | Vitest | `fileParallelism: false`, node env, 1 fork max |

## Running Tests

```bash
# Rails unit/model/request specs
cd rails_app
bundle exec rspec                    # All specs
bundle exec rspec spec/models/       # Model specs
bundle exec rspec spec/requests/     # API specs

# React component tests
cd rails_app
pnpm test                            # Vitest (happy-dom)

# Langgraph agent tests
cd langgraph_app
pnpm test                            # All tests (sequential)
pnpm test -t "pattern"               # Filter by name

# E2E browser tests
cd rails_app
bin/dev-test                         # Start services on test ports
pnpm test:e2e                        # Headless
pnpm test:e2e:ui                     # With Playwright UI
```

## Test Organization

```
rails_app/spec/
├── factories/           # 61 FactoryBot factories
├── support/
│   ├── core/            # JWT, API, account helpers
│   ├── deploy/          # Deployment mocks
│   ├── google_ads/      # Google Ads mocks
│   └── schemas/         # JSON schema validators
├── models/              # Model specs
├── requests/            # API request specs (with Swagger)
├── services/            # Service object specs
├── workers/             # Background job specs
└── snapshot_builders/   # Database snapshot builders

langgraph_app/tests/
├── support/
│   ├── setup.ts         # Global setup (disable cache, cleanup)
│   ├── matchers/        # Custom Vitest matchers
│   ├── helpers/         # Assertions, streaming
│   ├── evals/           # Evaluation scorers
│   └── graph/           # GraphTestBuilder
├── tests/
│   ├── graphs/          # Integration tests for full graphs
│   ├── tools/           # Tool-specific tests
│   └── middleware/       # Middleware tests
└── recordings/          # Polly.js HAR files (~73 directories)

rails_app/e2e/
├── pages/               # Page Object Models (10+ pages)
├── fixtures/            # Auth, database, tracking helpers
├── support/             # cypress-on-rails integration
├── app_commands/        # Server-side Ruby commands
│   ├── scenarios/       # State setup scripts
│   └── queries/         # Data retrieval scripts
└── *.spec.ts            # Test suites
```

## Key Patterns

**RSpec**: DatabaseCleaner with transaction strategy. Sidekiq runs in fake mode (jobs enqueued but not executed). `rails_helper.rb` calls `Rails.application.eager_load!` before suite to catch Zeitwerk autoloading issues early.

**Langgraph Vitest**: `fileParallelism: false` is critical — Polly.js uses a global singleton for recording names. Parallel execution causes cache misses and real API calls ($6+ per run).

**Playwright**: Single worker mode (`workers: 1`) prevents database race conditions. Each test restores a database snapshot in `beforeEach`. Services run externally via `bin/dev-test`.

**GraphTestBuilder**: Fluent API for testing Langgraph nodes with automatic Polly recording management:

```typescript
const result = await testGraph()
  .withGraph(websiteGraph)
  .withPrompt("Create a website about dogs")
  .stopAfter("nameProject")
  .execute();
```

## Key Files Index

| File | Purpose |
|------|---------|
| `rails_app/spec/rails_helper.rb` | RSpec setup (DatabaseCleaner, eager load, Sidekiq fake) |
| `rails_app/spec/spec_helper.rb` | Core RSpec configuration |
| `rails_app/vitest.config.ts` | React component test config |
| `rails_app/playwright.config.ts` | E2E test config |
| `langgraph_app/vitest.config.ts` | Langgraph test config (sequential execution) |
| `langgraph_app/tests/support/setup.ts` | Global test setup (disable cache, cleanup) |
| `langgraph_app/tests/support/graph/` | GraphTestBuilder for agent testing |

## Gotchas

- **Never run Langgraph tests in parallel**: Polly.js global state causes recording mismatches and expensive API calls.
- **Eager load catches Zeitwerk issues**: Unqualified constant references (e.g. `CostCalculator` instead of `Credits::CostCalculator`) only fail when the sibling class hasn't been loaded yet.
- **Sidekiq inline for E2E**: `bin/dev-test` sets `SIDEKIQ_INLINE=true` so background jobs execute synchronously during Playwright tests.
- **No networkidle waits in Playwright**: Vite HMR keeps a WebSocket open. Use `domcontentloaded` + element waits instead.
