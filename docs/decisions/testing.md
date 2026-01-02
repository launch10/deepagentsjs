# Testing Decisions

> What we do and why. Decisions first, history at the bottom.

---

## Current Stack

| Layer | Tool | Notes |
|-------|------|-------|
| E2E | Playwright | Page Object Model, database snapshots |
| Frontend Unit | Vitest + React Testing Library | TDD, component-level |
| Backend | RSpec | Request specs, FactoryBot |
| AI Mocking | Polly | HTTP recording/replay |
| Data | Database Snapshots | Known states for any workflow stage |

---

## Playwright E2E Patterns

### 1. Page Object Model

Every workflow gets a Page Object class:

```typescript
export class SomePage {
  readonly page: Page;
  readonly element: Locator;

  constructor(page: Page) {
    this.page = page;
    this.element = page.getByTestId("element-id");
  }

  async goto(): Promise<void> {
    await this.page.goto("/path");
    await this.element.waitFor({ state: "visible", timeout: 10000 });
  }
}
```

### 2. NEVER Use `networkidle`

Vite HMR keeps websocket active forever. Instead:

```typescript
// Wait for specific elements
await element.waitFor({ state: "visible", timeout: 10000 });

// Wait for data attributes
await expect(element).toHaveAttribute("data-ready", "true", { timeout: 30000 });

// Wait for API responses (set up BEFORE triggering action)
const responsePromise = page.waitForResponse(
  (response) => response.url().includes("/api/v1/something") && response.status() === 200,
  { timeout: 10000 }
);
await triggerAction();
await responsePromise;
```

### 3. AI/Streaming State Tracking

Add data attributes to streaming components:

```tsx
<div
  data-testid="chat"
  data-loading-history={isLoadingHistory}
  data-streaming={isStreaming}
  data-ready={!isLoadingHistory && !isStreaming}
>
```

Handle race conditions (response may arrive before thinking indicator):

```typescript
async waitForResponse(timeout: number = 30000): Promise<void> {
  const result = await Promise.race([
    this.thinkingIndicator.waitFor({ state: "visible", timeout: 5000 }).then(() => "thinking"),
    this.aiMessages.first().waitFor({ state: "visible", timeout: 5000 }).then(() => "message"),
  ]).catch(() => "timeout");

  if (result === "thinking") {
    await this.thinkingIndicator.waitFor({ state: "hidden", timeout });
  }
}
```

### 4. Database Snapshots for E2E

```typescript
test.beforeEach(async ({ page }) => {
  await DatabaseSnapshotter.restoreSnapshot("snapshot_name");
  // IMPORTANT: Project UUIDs are dynamic after restore
  const project = await DatabaseSnapshotter.getFirstProject();
  projectUuid = project.uuid;
  await loginUser(page);
});
```

### 5. Pre-Verified Test Data

Never trust AI-generated content for validation tests:

```typescript
export const VALID_TEST_DATA = {
  headlines: [
    "Save 20% on First Order", // 22 chars (max 30)
  ],
} as const;
```

### 6. Required `data-testid` Attributes

| Element Type | Pattern | Example |
|-------------|---------|---------|
| Form containers | `{form-name}-form` | `content-form` |
| Navigation | `{action}-button` | `continue-button` |
| Tabs | `tab-switcher`, `tab-{name}` | `tab-content` |
| Chat | `chat`, `chat-input`, `chat-messages` | |
| Loading | `thinking-indicator` | |
| Inputs | `lockable-input`, `lock-toggle-button` | |
| Uploads | `{purpose}-file-input`, `{purpose}-preview` | `logo-file-input` |
| Panels | `{name}-panel`, `{name}-toggle`, `{name}-content` | `brand-panel` |

### 7. Loading State Testing

Test that wrong states don't flicker:

```typescript
test("shows skeleton not landing page when loading", async ({ page }) => {
  await page.goto(`/projects/${threadId}/something`);
  // Immediately assert wrong state isn't visible
  await expect(landingPageHero).not.toBeVisible();
  // Eventually correct content loads
  await expect(content).toBeVisible();
});
```

### 8. Multi-Step Workflow Testing

Navigate systematically:

```typescript
test("navigates through all steps", async ({ page }) => {
  await pageObject.goto(projectUuid);
  await pageObject.waitForReady();

  await pageObject.expectFormVisible("step1");
  await fillStep1Data();
  await pageObject.clickContinue();

  await pageObject.expectFormVisible("step2");
  // ... continue
});
```

### 9. Autosave/Race Condition Testing

```typescript
test("handles rapid typing then continue", async ({ page }) => {
  for (let i = 0; i < 3; i++) {
    await pageObject.fillNthInput(i, VALID_TEST_DATA.items[i]);
  }
  await pageObject.clickContinue();
  await pageObject.clickBack();

  for (let i = 0; i < 3; i++) {
    await expect(pageObject.getNthInput(i)).toHaveValue(VALID_TEST_DATA.items[i]);
  }
});
```

---

## Database Snapshots

| Snapshot | State | Use Case |
|----------|-------|----------|
| `core_data` | Plans, templates, themes | Base data |
| `basic_account` | Subscribed user | Most common starting point |
| `website_created` | Website with brainstorm data | Website features |
| `campaign_created` | Campaign with ad groups | Ads features |

```bash
# Load snapshot in development for manual testing
rake snapshots:load[completed_brainstorm]
```

**Trade-offs:**
- Snapshots can become stale as schema changes
- Need discipline to update snapshots when flows change

---

## Service Management

```bash
# Run langgraph tests (Rails starts automatically)
cd langgraph_app
bin/test                    # Run once
bin/test --watch            # Watch mode
bin/test --no-rails         # Skip Rails if running manually

# Service management
bin/services status         # Check what's running
bin/services cleanup        # Kill all managed services
bin/services env            # Show current config
```

**Port isolation:** Dev uses 3000/4000, test uses 3001/4001 (can run simultaneously).

---

## Vitest + React Testing Library

### Query Priority

`getByRole` > `getByLabelText` > `getByText` > `getByTestId`

```typescript
// Prefer accessible queries
expect(screen.getByRole("button", { name: "Submit" })).toBeEnabled();
expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("Chat");

// Avoid unless necessary
expect(screen.getByTestId("submit-button")).toBeEnabled(); // Less preferred
```

### Test Structure

```typescript
describe("AIMessage", () => {
  describe("Content", () => {
    it("renders message content", () => {...});
    it("renders markdown", () => {...});
  });

  describe("compound usage", () => {
    it("renders without bubble", () => {...});
    it("renders with bubble", () => {...});
  });
});
```

### Compound Components

Test each sub-component in isolation, then test compositions:

```typescript
describe("AIMessage", () => {
  // Isolation
  describe("Content", () => { it("renders standalone", () => {...}); });
  describe("Bubble", () => { it("renders standalone", () => {...}); });

  // Composition
  describe("composition", () => {
    it("Content works inside Bubble", () => {
      render(
        <AIMessage.Bubble>
          <AIMessage.Content>Text</AIMessage.Content>
        </AIMessage.Bubble>
      );
    });
  });
});
```

---

## RSpec Backend Testing

```ruby
describe "POST /api/v1/social_links" do
  it "creates a social link" do
    post api_v1_social_links_path, params: valid_params, headers: auth_headers
    expect(response).to have_http_status(:created)
    expect(json_response).to match_schema(:social_link)
  end
end
```

---

## Pre-Commit Hooks

- `.husky/pre-commit` runs `pnpm run test:changed`
- CI runs `pnpm run test:coverage`

---

## Key Files

| Purpose | Location |
|---------|----------|
| E2E Page Objects | `rails_app/e2e/pages/*.page.ts` |
| E2E Test Specs | `rails_app/e2e/*.spec.ts` |
| E2E Database Fixtures | `rails_app/e2e/fixtures/database.ts` |
| Database Snapshots | `rails_app/test/fixtures/database/snapshots/` |
| Snapshot Rake Tasks | `rails_app/lib/tasks/snapshot.rake` |
| Polly Recordings | `langgraph_app/tests/__recordings__/` |
| Vitest Config | `rails_app/vitest.config.ts` |
| Testing Library Setup | `rails_app/app/javascript/frontend/test/setup.ts` |
| Service Manager | `bin/services`, `config/services.sh` |

---

## History

### 2026-01-02: Playwright E2E Testing Patterns

**Context:** Built comprehensive E2E tests for Brainstorm and Campaign workflows involving AI streaming, multi-step wizards, file uploads, autosave, and complex state management.

**Decision:** Codified patterns including Page Object Model, data-testid conventions, streaming state tracking, and race condition handling.

**Files:** `brainstorm.page.ts`, `campaign.page.ts`, `brainstorm.spec.ts`, `campaign.spec.ts`, `CAMPAIGN_TEST_NOTES.md`

---

### 2026-01-01: Unified Service Management for Tests

**Context:** Langgraph tests require Rails running. Previously inconsistent between local and CI.

**Decision:** Created `bin/services` and `langgraph_app/bin/test` for unified service management with automatic Rails startup and master key handling.

---

### 2025-12-28: Database Snapshots for Testing

**Context:** Testing Langgraph agents requires realistic data states. Setting up data for every test is time-consuming, expensive (AI API costs), and flaky.

**Decision:** Maintain database snapshots at known work points. Snapshots + Polly solve non-determinism, cost, and speed challenges.

---

### 2025-12-28: TDD with Vitest + React Testing Library

**Context:** Building compound components requires confidence across refactoring.

**Decision:** Write tests before/alongside implementation. Every component gets a `.test.tsx` file.

---

### 2025-12-28: Testing Library Query Priority

**Context:** Needed consistent element querying approach.

**Decision:** Follow `getByRole` > `getByLabelText` > `getByText` > `getByTestId` priority.

---

### 2025-12-28: Test Compound Components in Isolation AND Composition

**Context:** Compound components have sub-components used independently or composed.

**Decision:** Test each sub-component in isolation, then test common compositions.

---

### 2025-12-28: Pre-Commit Hooks Enforce Tests

**Context:** Pattern erosion when tests skipped under time pressure.

**Decision:** Pre-commit hooks run tests for changed files. CI runs full suite.

---

### 2025-12-28: Backend API Request Specs (RSpec)

**Context:** Rails endpoints need comprehensive testing.

**Decision:** Use RSpec request specs with JSON schema validation.
