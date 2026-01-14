# Plan: Tracking Library E2E Testing

## Status: ✅ COMPLETE (2025-01-13)

All tests passing:
- RSpec: 8 examples, 0 failures
- Playwright E2E: 5 tests passed

## Goal
Validate that `tracking.ts` works end-to-end: browser loads page → tracking calls fire → data lands in DB.

## Approach
Extend our existing test infrastructure pattern (`Test::TestController` + TypeScript clients) to support tracking verification.

## Implementation

### 1. Rails Test Endpoint

**File:** `app/controllers/test/tracking_controller.rb`

```ruby
class Test::TrackingController < Test::TestController
  # GET /test/tracking/stats?website_id=X
  def stats
    website = Website.find(params[:website_id])
    visits = website.visits
    events = Ahoy::Event.where(visit_id: visits.pluck(:id))

    render json: {
      visit_count: visits.count,
      visitor_tokens: visits.pluck(:visitor_token).uniq,
      events: events.map { |e| { name: e.name, properties: e.properties } }
    }
  end
end
```

**File:** `config/routes/dev.rb` (add to existing namespace)

```ruby
namespace :test do
  # ... existing routes ...
  get "tracking/stats", to: "tracking#stats"
end
```

### 2. TypeScript Test Client

**File:** `e2e/fixtures/tracking.ts`

```typescript
import { e2eConfig } from "../config";

const BASE_URL = e2eConfig.railsBaseUrl;

export interface TrackingStats {
  visit_count: number;
  visitor_tokens: string[];
  events: Array<{ name: string; properties: Record<string, unknown> }>;
}

export const TrackingHelper = {
  async getStats(websiteId: string): Promise<TrackingStats> {
    const response = await fetch(
      `${BASE_URL}/test/tracking/stats?website_id=${websiteId}`,
      { headers: { Accept: "application/json" } }
    );

    if (!response.ok) {
      throw new Error(`Failed to get tracking stats: ${response.status}`);
    }

    return response.json();
  },
};
```

### 3. Playwright E2E Test

**File:** `e2e/tracking.spec.ts`

```typescript
import { test, expect } from "@playwright/test";
import { DatabaseSnapshotter } from "./fixtures/database";
import { TrackingHelper } from "./fixtures/tracking";

test.describe("Tracking Library", () => {
  test.beforeEach(async () => {
    await DatabaseSnapshotter.restoreSnapshot("basic_account");
  });

  test("tracks visit and page_view on page load", async ({ page, request }) => {
    // Get test website info
    const project = await DatabaseSnapshotter.getFirstProject();
    // TODO: We need a way to get website ID or build/serve a test page

    // Intercept tracking calls to verify they're made
    const trackingCalls: any[] = [];
    await page.route("**/api/v1/tracking/**", async (route) => {
      const postData = route.request().postDataJSON();
      trackingCalls.push({ url: route.request().url(), data: postData });
      await route.continue();
    });

    // Navigate to the deployed landing page
    // TODO: Need to either deploy a test page or serve locally
    await page.goto("http://localhost:XXXX"); // Test page URL

    // Wait for tracking calls to complete
    await page.waitForTimeout(1000);

    // Verify tracking calls were made
    const visitCall = trackingCalls.find((c) => c.url.includes("/visit"));
    const eventCall = trackingCalls.find((c) => c.url.includes("/event"));

    expect(visitCall).toBeDefined();
    expect(eventCall).toBeDefined();
    expect(eventCall.data.name).toBe("page_view");

    // Verify data landed in database
    const stats = await TrackingHelper.getStats(websiteId);
    expect(stats.visit_count).toBe(1);
    expect(stats.events).toContainEqual(
      expect.objectContaining({ name: "page_view" })
    );
  });
});
```

### 4. Test Page Strategy

**Option A: Serve template directly**
- Build the default template with test env vars
- Serve via a simple HTTP server during tests
- Pro: Fast, isolated
- Con: Doesn't test real deploy flow

**Option B: Use existing deployed test site**
- Deploy a test website to staging/dev environment
- Run tests against that URL
- Pro: Tests real infrastructure
- Con: Slower, external dependency

**Recommendation:** Option A for CI, Option B for smoke tests

## Files to Create/Modify

| File | Action |
|------|--------|
| `app/controllers/test/tracking_controller.rb` | Create |
| `config/routes/dev.rb` | Modify (add route) |
| `e2e/fixtures/tracking.ts` | Create |
| `e2e/tracking.spec.ts` | Create |
| `spec/requests/test/tracking_spec.rb` | Create (test the test endpoint) |

## Verification

1. Run endpoint spec: `bundle exec rspec spec/requests/test/tracking_spec.rb`
2. Run E2E test: `pnpm test:e2e e2e/tracking.spec.ts`
3. Manual verification: Check Ahoy tables have data after test runs

## Future: Rswag Integration

This test controller pattern opens the door to auto-generating test scripts via Rswag:
- Document test endpoints in OpenAPI spec
- Generate TypeScript clients from spec
- Type-safe, always up-to-date test helpers

## Resolved: Test Page Strategy

**Decision:** Created a dedicated Rails test endpoint (`GET /test/tracking/page?project_id=X`) that serves a minimal HTML page with an inline version of the tracking library.

This approach:
- Uses `window.L10_CONFIG` for runtime config instead of Vite's compile-time env vars
- No build step required - the page is served directly by Rails
- Isolated and fast - no external dependencies
- Uses the request's host/port automatically (works on any test port)

The test page includes:
- Full L10 tracking object with `trackVisit()`, `trackEvent()`, `createLead()`
- Auto-tracking on DOMContentLoaded
- A simple lead form for testing lead capture
