# Playwright E2E Tests

## Overview

This skill covers writing Playwright e2e tests using our cypress-on-rails server helpers pattern.

## Key Imports

```typescript
import { test, expect, loginUser, testUser } from "./fixtures/auth";
import { DatabaseSnapshotter } from "./fixtures/database";
import { appScenario, appQuery, appFactories, clean, timecop } from "./support/on-rails";
```

## Test Setup Pattern

Always use this pattern in `beforeEach`:

```typescript
test.describe('Feature', () => {
  test.beforeEach(async ({ page }) => {
    // 1. Restore database snapshot
    await DatabaseSnapshotter.restoreSnapshot('website_step');

    // 2. Get references to records you need
    const project = await appQuery<{ id: number; uuid: string }>('first_project');

    // 3. Layer scenarios for test-specific state
    await appScenario('fill_subdomain_limit', { email: testUser.email });

    // 4. Login
    await loginUser(page);
  });
});
```

## Server Helpers (cypress-on-rails)

### Scenarios - Modify Test State

Use `appScenario()` for pre-built test states. Available scenarios in `e2e/app_commands/scenarios/`:

```typescript
// Fill subdomain limit
await appScenario('fill_subdomain_limit', { email: 'test@example.com' });

// Set user credits
await appScenario('set_credits', { email: 'test@example.com', credits: 0 });

// Assign platform subdomain to website
await appScenario('assign_platform_subdomain', {
  website_id: 1,
  subdomain: 'my-site',
  path: '/'
});

// Assign custom domain to website
await appScenario('assign_custom_domain', {
  website_id: 1,
  domain_name: 'mybusiness.com',
  path: '/'
});

// Set Stripe price for credit pack
await appScenario('set_stripe_price', { price_id: 'price_xxx' });
```

### Queries - Get Record Data

Use `appQuery()` to get record IDs and data:

```typescript
const project = await appQuery<{ id: number; uuid: string; name: string }>('first_project');
const website = await appQuery<{ id: number; name: string; project_id: number }>('first_website');
```

### FactoryBot - Create Records

Use `appFactories()` when snapshot doesn't have what you need:

```typescript
await appFactories([
  ['create', 'user', { email: 'new@example.com' }],
  ['create', 'website', { name: 'Test Site' }]
]);
```

### Snapshots vs Scenarios

- **Snapshots** (`DatabaseSnapshotter.restoreSnapshot()`): SQL dumps for baseline state
- **Scenarios** (`appScenario()`): Ruby code that modifies state on top of snapshot

Pattern: Restore snapshot first, then layer scenarios.

## Creating New Commands

### New Scenario

Create `e2e/app_commands/scenarios/my_scenario.rb`:

```ruby
# Description of what this does
# Usage: await appScenario('my_scenario', { param: value })
#
# Options:
#   param: string - Description

param = command_options[:param] || command_options["param"]

user = User.find_by!(email: param)
# ... your logic

{ user_id: user.id, created: true }
```

### New Query

Create `e2e/app_commands/queries/my_query.rb`:

```ruby
record = SomeModel.first
{
  id: record.id,
  name: record.name
}
```

## Do NOT Use

- `Test::DatabaseController` endpoints for data manipulation (deprecated)
- Direct database calls in TypeScript
- FactoryBot when a snapshot provides what you need

## Page Object Pattern

Use page objects for reusable selectors:

```typescript
// e2e/pages/domain-picker.page.ts
export class DomainPickerPage {
  constructor(private page: Page) {}

  get siteNameDropdown() {
    return this.page.getByTestId('site-name-dropdown');
  }

  async goto(projectUuid: string) {
    await this.page.goto(`/projects/${projectUuid}/website/domain`);
  }

  async waitForLoaded() {
    await expect(this.page.getByRole('heading', { name: 'Website Setup' })).toBeVisible();
  }
}
```

## Available Snapshots

Check `test/fixtures/database/snapshots/`:
- `basic_account` - User with account, no projects
- `website_step` - User with project and website
- Others as needed

## Running Tests

```bash
# Start test servers
bin/dev-test

# Run all e2e tests (headless)
pnpm test:e2e

# Run with Playwright UI
pnpm test:e2e:ui

# Run specific test file
pnpm test:e2e e2e/domain-picker.spec.ts
```
