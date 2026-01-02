# Testing: Decision History

> Decisions about testing approach, fixtures, and reproducibility. Most recent first.

---

## Current State

**E2E Testing (Playwright):** Page Object Model pattern with database snapshots. Data-testid selectors for stability. Never use `networkidle` - wait for specific elements/attributes instead. AI streaming state tracked via data attributes.

**Unit/Integration Testing:** Database snapshots at known work points + Polly HTTP recording = deterministic, fast, cheap tests. Snapshots let tests start from any point in the user journey. Polly replays AI API responses.

**Frontend (Vitest):** Vitest + React Testing Library with TDD approach. Every component has matching test file.

**Backend (RSpec):** Request specs for API testing.

**Service Management:** Unified `bin/services` script manages Rails/Langgraph for all environments. `langgraph_app/bin/test` auto-starts Rails before running Vitest. Master key handling is automatic in test/CI.

---

## Decision Log

### 2026-01-02: Playwright E2E Testing Patterns

**Context:** Built comprehensive E2E tests for Brainstorm and Campaign workflows. These workflows involve AI streaming, multi-step wizards, file uploads, autosave, and complex state management. Lessons learned should be codified for future workflows.

**Decision:** Establish standardized Playwright E2E patterns:

#### 1. Page Object Model Structure

Every workflow gets a Page Object class that encapsulates all interactions:

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

#### 2. NEVER Use `networkidle`

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

#### 3. AI/Streaming State Tracking

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

#### 4. Database Snapshots for E2E

```typescript
test.beforeEach(async ({ page }) => {
  await DatabaseSnapshotter.restoreSnapshot("snapshot_name");
  // IMPORTANT: Project UUIDs are dynamic after restore
  const project = await DatabaseSnapshotter.getFirstProject();
  projectUuid = project.uuid;
  await loginUser(page);
});
```

#### 5. Pre-Verified Test Data

Never trust AI-generated content for validation tests:

```typescript
export const VALID_TEST_DATA = {
  headlines: [
    "Save 20% on First Order", // 22 chars (max 30)
  ],
} as const;
```

#### 6. Required `data-testid` Attributes

- Form containers: `{form-name}-form`
- Navigation: `{action}-button`
- Tabs: `tab-switcher`, `tab-{name}`
- Chat: `chat`, `chat-input`, `chat-messages`, `thinking-indicator`
- Inputs: `lockable-input`, `lock-toggle-button`
- Uploads: `{purpose}-file-input`, `{purpose}-preview`
- Panels: `{name}-panel`, `{name}-toggle`, `{name}-content`

#### 7. Loading State Testing

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

#### 8. Multi-Step Workflow Testing

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

#### 9. Autosave/Race Condition Testing

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

**Why:**

- Consistent patterns across all E2E tests
- Avoid common pitfalls (networkidle, race conditions, dynamic IDs)
- Page Objects provide reusable, maintainable test infrastructure
- Data attributes provide stable, semantic selectors
- Pre-verified data eliminates flaky validation tests

**Files establishing pattern:**

- `rails_app/e2e/pages/brainstorm.page.ts` - Comprehensive POM example
- `rails_app/e2e/pages/campaign.page.ts` - Multi-step workflow POM
- `rails_app/e2e/brainstorm.spec.ts` - Full test suite example
- `rails_app/e2e/campaign.spec.ts` - Workflow test suite
- `rails_app/e2e/fixtures/database.ts` - Snapshot integration
- `rails_app/e2e/CAMPAIGN_TEST_NOTES.md` - Pattern documentation

**Status:** Current

---

### 2026-01-01: Unified Service Management for Tests

**Context:** Langgraph tests require Rails to be running (for API calls). Previously, CI had to manually start Rails with the master key. Local developers had to remember to start Rails before running langgraph tests. This led to:

- Inconsistent test environments between local and CI
- Duplication of service startup logic
- CI failures when master key handling wasn't synchronized

**Decision:** Create unified service management via `bin/services` and `langgraph_app/bin/test`:

1. `bin/services` - Single source of truth for starting Rails/Langgraph in any environment
2. `langgraph_app/bin/test` - Wrapper that auto-starts Rails before running Vitest
3. `config/services.sh` - Environment config (ports, URLs) for dev/test/CI
4. Automatic `RAILS_MASTER_KEY` handling in test mode (reads from `config/credentials/test.key`)

**Why:**

- **One command**: `bin/test` just works, no manual Rails startup
- **Environment parity**: Same scripts run locally and in CI
- **Port isolation**: Dev uses 3000/4000, test uses 3001/4001 (can run simultaneously)
- **Credentials handled**: Test master key automatically loaded in test/CI environments

**Usage:**

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

**Files:**

- `bin/services` - Unified service manager
- `config/services.sh` - Port/URL configuration
- `langgraph_app/bin/test` - Test wrapper with Rails auto-start

**Status:** Current

---

### 2025-12-28: Use Database Snapshots for Testing

**Context:** Testing Langgraph agents requires realistic data states. You can't test "update an existing website" without first having a website. You can't test "create ads for a completed brainstorm" without first having completed a brainstorm.

Setting up this data for every test is:

- Time-consuming (multiple API calls, AI completions)
- Expensive (real AI API costs)
- Flaky (AI outputs vary)

**Decision:** Maintain database snapshots at known work points. Tests can load a snapshot and start from that state.

**Why:**

Snapshots + Polly solve AI testing challenges:

- **Non-deterministic**: Recorded responses = deterministic
- **Expensive**: Replayed responses = free
- **Slow**: Local replay = fast

Debugging use case:

```bash
# Load the "completed_brainstorm" state in development
rake snapshots:load[completed_brainstorm]

# Now manually test website generation without going through full brainstorm
```

**Available snapshots:**

| Snapshot           | State                        | Use Case                   |
| ------------------ | ---------------------------- | -------------------------- |
| `core_data`        | Plans, templates, themes     | Base data                  |
| `basic_account`    | Subscribed user              | Most common starting point |
| `website_created`  | Website with brainstorm data | Website features           |
| `campaign_created` | Campaign with ad groups      | Ads features               |

**Trade-offs:**

- Snapshots can become stale as schema changes
- Need discipline to update snapshots when flows change
- Storage overhead for snapshot files
- Risk of testing against unrealistic data if snapshots diverge

### 2025-12-28: TDD with Vitest + React Testing Library

**Context:** Building compound components and SDK integrations requires confidence in behavior across refactoring. Needed test infrastructure that supports modern React patterns.

**Decision:** Write tests before or alongside implementation using Vitest and React Testing Library. Every component must have a matching `.test.tsx` file.

**Why:**

- Catches regressions early (especially with compound patterns)
- Documents expected behavior
- Makes refactoring safer
- Vitest optimized for Vite build tool (faster than Jest)
- React Testing Library encourages testing user behavior, not implementation

**Test structure per component:**

```typescript
describe("AIMessage", () => {
  describe("Content", () => {
    it("renders message content", () => {...});
    it("renders markdown", () => {...});
    it("applies inactive styling", () => {...});
  });

  describe("compound usage", () => {
    it("renders without bubble", () => {...});
    it("renders with bubble", () => {...});
  });

  describe("state variants", () => {
    it("shows loading state", () => {...});
  });
});
```

**Files establishing pattern:**

- `rails_app/vitest.config.ts`
- `rails_app/app/javascript/frontend/test/setup.ts`
- `rails_app/app/javascript/frontend/test/testing-library-patterns.tsx`
- `rails_app/app/javascript/frontend/components/chat/__tests__/*.test.tsx`

**Status:** Current

---

## Files Involved

- `rails_app/test/fixtures/database/snapshots/` - Snapshot files
- `rails_app/lib/tasks/snapshot.rake` - Snapshot rake tasks
- `rails_app/spec/snapshot_builders/` - Builder classes
- `langgraph_app/tests/__recordings__/` - Polly recordings
- `.claude/skills/database-snapshots.md` - Full snapshot guide

### 2025-12-28: Testing Library Query Priority

**Context:** Needed consistent approach to querying elements in tests that reflects how users interact with the UI.

**Decision:** Follow Testing Library query priority: `getByRole` > `getByLabelText` > `getByText` > `getByTestId`.

**Why:**

- Queries based on accessibility roles catch a11y issues
- Tests are resilient to implementation changes
- Tests document how users find elements
- `getByTestId` is escape hatch, not default

**Example:**

```typescript
// Prefer accessible queries
expect(screen.getByRole("button", { name: "Submit" })).toBeEnabled();
expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("Chat");

// Avoid unless necessary
expect(screen.getByTestId("submit-button")).toBeEnabled(); // Less preferred
```

**Reference:**

- `rails_app/app/javascript/frontend/test/testing-library-patterns.tsx`

**Status:** Current

---

### 2025-12-28: Test Compound Components in Isolation AND Composition

**Context:** Compound components have sub-components that can be used independently or composed together. Both usage patterns need testing.

**Decision:** Test each sub-component in isolation, then test common compositions.

**Why:**

- Isolation tests catch sub-component bugs
- Composition tests catch integration issues
- Both reflect real usage patterns
- Changes to one sub-component don't break unrelated tests

**Pattern:**

```typescript
describe("AIMessage", () => {
  // Isolation tests
  describe("Content", () => {
    it("renders standalone", () => {...});
  });

  describe("Bubble", () => {
    it("renders standalone", () => {...});
  });

  // Composition tests
  describe("composition", () => {
    it("Content works inside Bubble", () => {
      render(
        <AIMessage.Bubble>
          <AIMessage.Content>Text</AIMessage.Content>
        </AIMessage.Bubble>
      );
      // Verify both work together
    });
  });
});
```

**Status:** Current

---

### 2025-12-28: Pre-Commit Hooks Enforce Tests

**Context:** Pattern erosion occurs when tests are skipped under time pressure. Need automated enforcement.

**Decision:** Pre-commit hooks run tests for changed files. CI runs full test suite.

**Why:**

- Can't accidentally push untested code
- Fast feedback (only changed files locally)
- Full coverage verified in CI
- Reduces code review burden

**Configuration:**

- `.husky/pre-commit` runs `pnpm run test:changed`
- CI runs `pnpm run test:coverage`

**Status:** Current

---

### 2025-12-28: Backend API Request Specs (RSpec)

**Context:** Social Links API and other Rails endpoints need comprehensive testing including validation, authorization, and error handling.

**Decision:** Use RSpec request specs for API testing with JSON schema validation.

**Why:**

- Request specs test full stack (routes, controllers, serializers)
- JSON schema validation catches response structure issues
- Factories (FactoryBot) create consistent test data
- Matches Rails conventions

**Pattern:**

```ruby
describe "POST /api/v1/social_links" do
  it "creates a social link" do
    post api_v1_social_links_path, params: valid_params, headers: auth_headers
    expect(response).to have_http_status(:created)
    expect(json_response).to match_schema(:social_link)
  end
end
```

**Files establishing pattern:**

- `rails_app/spec/requests/social_links_spec.rb`
- `rails_app/spec/support/schemas/social_link_schemas.rb`

**Status:** Current

---

## Superseded Decisions

(None yet - these are initial decisions)
