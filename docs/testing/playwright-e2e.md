# Playwright E2E Tests

E2E tests use Playwright with a cypress-on-rails integration for server-side state management. Tests run against real Rails and Langgraph services on test ports. Each test restores a database snapshot, layers test-specific state via Ruby scenarios, and interacts with the UI through Page Object Models.

## Architecture

```
Playwright Test
       │
       ├─ DatabaseSnapshotter.restoreSnapshot("website_step")
       │     └─ POST /test/database/restore_snapshot
       │
       ├─ appQuery("first_project")
       │     └─ POST /__e2e__/command { name: "queries/first_project" }
       │
       ├─ appScenario("fill_subdomain_limit", { email })
       │     └─ POST /__e2e__/command { name: "scenarios/fill_subdomain_limit" }
       │
       ├─ loginUser(page)
       │     └─ Form submission → /users/sign_in
       │
       └─ WebsitePage.goto(uuid) → assertions
```

## Test Pattern

```typescript
import { test, expect, loginUser } from "./fixtures/auth";
import { DatabaseSnapshotter } from "./fixtures/database";
import { appQuery, appScenario } from "./support/on-rails";

test.describe("Website Builder", () => {
  let websitePage: WebsitePage;

  test.beforeEach(async ({ page }) => {
    await DatabaseSnapshotter.restoreSnapshot("website_step");
    const project = await appQuery<{ id: number; uuid: string }>("first_project");
    await loginUser(page);
    websitePage = new WebsitePage(page);
  });

  test("displays quick actions after loading", async ({ page }) => {
    await websitePage.goto(projectUuid);
    await expect(websitePage.changeColorsButton).toBeVisible({ timeout: 10000 });
  });
});
```

## On-Rails Integration

The `cypress-on-rails` gem exposes `/__e2e__/command` for executing server-side Ruby.

| Function | Purpose | Example |
|----------|---------|---------|
| `appScenario(name, opts)` | Run scenario from `app_commands/scenarios/` | `appScenario("fill_subdomain_limit", { email })` |
| `appQuery(name, opts)` | Run query from `app_commands/queries/` | `appQuery("first_project")` |
| `appFactories(list)` | Create records via FactoryBot | `appFactories([["create", "user", { email }]])` |
| `appEval(code)` | Execute arbitrary Ruby | `appEval("User.count")` |
| `timecop.freeze(date)` | Freeze time | `timecop.freeze("2025-01-15")` |

## Page Object Models

Located in `e2e/pages/`, each page object encapsulates locators and interactions:

| Page Object | Purpose |
|-------------|---------|
| `WebsitePage` | Chat, preview, quick actions, sidebar |
| `BrainstormPage` | Brainstorm chat, brand personalization |
| `DashboardPage` | Analytics dashboard, insights |
| `CampaignPage` | Ad campaign management |
| `DomainPickerPage` | Domain selection UI |
| `LoginPage` | Sign in/up, OAuth |
| `ProjectsPage` | Project listing, pagination |
| `SettingsPage` | Account settings |
| `LeadsPage` | Lead management |
| `PerformancePage` | Performance analytics |

**Locator priority**: `data-testid` > `getByRole()` > `getByPlaceholder()` > text matchers > CSS selectors.

## Configuration

```typescript
// playwright.config.ts
{
  workers: 1,              // Single worker (prevent DB races)
  fullyParallel: false,    // Sequential test execution
  timeout: 120_000,        // 2 minutes per test
  use: {
    baseURL: `http://localhost:${process.env.RAILS_PORT || "3001"}`,
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },
  expect: { timeout: 10_000 },
}
```

## Running Tests

```bash
# Start services on test ports
cd rails_app && bin/dev-test

# Run tests (separate terminal)
pnpm test:e2e              # Headless
pnpm test:e2e:ui           # With Playwright Inspector
pnpm test:e2e -- --grep "pattern"  # Filter tests
```

## Directory Structure

```
rails_app/e2e/
├── config.ts              # Shared config (ports, timeouts)
├── global-setup.ts        # Pre-suite setup
├── global-teardown.ts     # Cleanup (/public/uploads)
├── fixtures/
│   ├── auth.ts            # loginUser(), testUser credentials
│   ├── database.ts        # DatabaseSnapshotter
│   ├── tracking.ts        # Tracking verification helpers
│   └── files/             # Test data (images, PDFs)
├── pages/                 # Page Object Models
├── support/
│   └── on-rails.ts        # cypress-on-rails client
├── app_commands/
│   ├── factory_bot.rb     # FactoryBot integration
│   ├── eval.rb            # Arbitrary Ruby evaluation
│   ├── scenarios/         # State setup scripts
│   └── queries/           # Data retrieval scripts
└── *.spec.ts              # Test suites
```

## Key Files Index

| File | Purpose |
|------|---------|
| `rails_app/playwright.config.ts` | Playwright configuration |
| `rails_app/e2e/config.ts` | Shared test environment config |
| `rails_app/e2e/support/on-rails.ts` | cypress-on-rails TypeScript client |
| `rails_app/e2e/fixtures/auth.ts` | Authentication helpers + test credentials |
| `rails_app/e2e/fixtures/database.ts` | Database snapshot restoration |
| `rails_app/e2e/pages/website.page.ts` | Website builder page object |
| `rails_app/e2e/app_commands/scenarios/` | Ruby scenario scripts |
| `rails_app/e2e/app_commands/queries/` | Ruby query scripts |
| `rails_app/bin/dev-test` | Start services on test ports |

## Gotchas

- **No networkidle waits**: Vite HMR keeps a WebSocket open forever. Use `domcontentloaded` + specific element waits instead of `waitForLoadState("networkidle")`.
- **Test user credentials**: `test_user@launch10.com` / `Launch10TestPass!` — created by the `basic_account` snapshot builder.
- **Services must be running**: Playwright config has no webServer — start services externally via `bin/dev-test`.
- **Port isolation**: Base URL reads from `RAILS_PORT` env var, supporting multi-instance clones (launch1: 3101, launch3: 3301).
- **AI response waits**: For AI-generated content, wait for the thinking indicator to appear then disappear, with generous timeouts (30s+).
