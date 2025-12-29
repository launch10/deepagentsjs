# Testing: Decision History

> Decisions about testing approach, fixtures, and reproducibility. Most recent first.

---

## Current State

Database snapshots at known work points + Polly HTTP recording = deterministic, fast, cheap tests. Snapshots let tests start from any point in the user journey. Polly replays AI API responses.
Frontend uses Vitest + React Testing Library with TDD approach. Every component has matching test file. Backend uses RSpec with request specs for API testing.

---

## Decision Log

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
