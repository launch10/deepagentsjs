---
type: solution
category: testing-issues
title: Fixing Playwright E2E Test Authentication with Database Snapshots
symptoms:
  - Playwright E2E tests failing with users not authenticated
  - Tests landing on public welcome page instead of authenticated dashboard
  - Errno::EPIPE broken pipe errors in Rails logs during test runs
  - CSRF token verification failures on test API endpoints
  - waitForURL with negative lookahead regex causing test flakiness
root_cause: Multiple cascading issues - missing database snapshot restoration in beforeEach hooks, Rails stdout writes failing in Foreman subprocess, CSRF protection blocking test endpoints, and unreliable URL matching regex
components:
  - Playwright E2E test fixtures
  - Rails Test::DatabaseController
  - Database::Snapshotter service
  - Authentication flow
  - CSRF protection
related_docs:
  - docs/features/snapshots.md
  - plans/fix-playwright-authentication-via-database-snapshots.md
date_documented: 2025-12-28
---

# Fixing Playwright E2E Test Authentication with Database Snapshots

## Problem

Playwright E2E tests were failing because users weren't being authenticated. Tests would land on the public "Welcome to Jumpstart" page instead of the authenticated brainstorm interface.

### Symptoms Observed

1. **Tests failing to find chat input**: `Error: element(s) not found` for `[data-testid="chat-input"]`
2. **Screenshot showing public page**: Tests captured the unauthenticated welcome page
3. **EPIPE errors in Rails logs**: `Errno::EPIPE: Broken pipe @ rb_sys_fail_on_write - <STDOUT>`
4. **500 errors from test API**: Snapshot restore endpoint returning internal server errors

## Investigation

### Step 1: Verify Test User Exists

Checked if the test user existed in the database snapshot:
```bash
grep -i "test_user@launch10" test/fixtures/database/snapshots/basic_account.sql
# Found: INSERT INTO public.users ... 'test_user@launch10.ai' ...
```

### Step 2: Verify Password Hash

Confirmed the password hash matches "password":
```ruby
BCrypt::Password.new('$2a$04$3//csD3xh9/kyI7wcX5PWO3gZQmwrLHnf44/P8GOdf4LZVXJrOAMe') == 'password'
# => true
```

### Step 3: Test Snapshot Restore Endpoint

```bash
curl -X POST http://localhost:3000/test/database/restore_snapshot \
  -H "Content-Type: application/json" \
  -d '{"snapshot": {"name": "basic_account", "truncate_first": true}}'
# Error: 500 Internal Server Error with EPIPE
```

### Step 4: Trace EPIPE Source

Found `puts` statements in Ruby code failing when stdout was closed:
- `app/services/database/snapshotter.rb` - Multiple `puts` in `execute_command`
- `app/controllers/test/database_controller.rb` - `puts` in action methods

### Step 5: Test Login Manually with Playwright MCP

Used Playwright browser tools to manually test login - it worked! This confirmed the issue was with automated test execution, not the login flow itself.

## Root Causes

### 1. Missing Database Snapshot Restore

Tests weren't restoring the database snapshot before running, so the test user didn't exist.

### 2. EPIPE Errors from `puts`

When running via Foreman/bin/dev, stdout can be closed or broken. Ruby's `puts` throws `Errno::EPIPE` when writing to a broken pipe, causing 500 errors.

### 3. Problematic `waitForURL` Regex

The auth fixture used:
```typescript
await page.waitForURL(/(?!.*sign_in)/, { timeout: 10000 });
```

Negative lookahead regex patterns are unreliable for URL matching in Playwright.

### 4. CSRF Protection Blocking Test API

The `Test::DatabaseController` inherited from `ApplicationController` which enforced CSRF protection, blocking API calls without tokens.

## Solution

### 1. Add Database Snapshot Restore to Tests

Created `e2e/fixtures/database.ts`:

```typescript
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000";

export const DatabaseSnapshotter = {
  async restoreSnapshot(
    name: string,
    truncateFirst: boolean = true
  ): Promise<DatabaseOperationResult> {
    const response = await fetch(`${BASE_URL}/test/database/restore_snapshot`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        snapshot: { name, truncate_first: truncateFirst },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to restore snapshot '${name}': ${response.status} - ${error}`);
    }

    return response.json();
  },
};
```

Added to all test suites in `beforeEach`:

```typescript
test.beforeEach(async ({ page }) => {
  await DatabaseSnapshotter.restoreSnapshot("basic_account");
  await loginUser(page);
  brainstormPage = new BrainstormPage(page);
});
```

### 2. Replace `puts` with `Rails.logger`

In `app/services/database/snapshotter.rb`:

```ruby
# Before
puts "Executing command..."
puts "✅ Command successful."

# After
Rails.logger.debug "[Database::Snapshotter] Executing command..."
Rails.logger.debug "[Database::Snapshotter] Command successful"
```

In `app/controllers/test/database_controller.rb`:

```ruby
# Before
puts "Database truncated"

# After
Rails.logger.info "[Test::DatabaseController] Database truncated"
```

### 3. Fix `waitForURL` Pattern

In `e2e/fixtures/auth.ts`:

```typescript
// Before - unreliable negative lookahead
await page.waitForURL(/(?!.*sign_in)/, { timeout: 10000 });

// After - callback function for reliable check
await page.waitForURL((url) => !url.toString().includes("/users/sign_in"), {
  timeout: 10000,
});
```

Added explicit login verification:

```typescript
const isAuthenticated = await page
  .locator('[data-testid="chat-input"], [data-testid="user-menu"], nav:has-text("Brainstorm")')
  .first()
  .isVisible({ timeout: 5000 })
  .catch(() => false);

if (!isAuthenticated) {
  throw new Error(`Login may have failed - not on authenticated page. Current URL: ${page.url()}`);
}
```

### 4. Skip CSRF for Test Controller

In `app/controllers/test/test_controller.rb`:

```ruby
class Test::TestController < ApplicationController
  skip_forgery_protection
  before_action :redirect_unless_local_env

  private

  def redirect_unless_local_env
    unless Rails.env.local?
      redirect_to root_path
    end
  end
end
```

### 5. Configure Single Worker Mode

In `playwright.config.ts`:

```typescript
export default defineConfig({
  // Single worker to prevent database race conditions
  fullyParallel: false,
  workers: 1,
  // ...
});
```

## Prevention

### Best Practices

1. **Never use `puts` in app/ code** - Always use `Rails.logger` with appropriate levels
2. **Use callback functions for URL waits** - Avoid regex, especially negative lookahead
3. **Restore database state in `beforeEach`** - Each test should start with known state
4. **Run database-dependent tests with single worker** - Prevents race conditions
5. **Gate test endpoints by environment** - Use `Rails.env.local?` checks

### Code Review Checklist

- [ ] No `puts` or `print` statements in `app/` directory
- [ ] E2E tests restore database state in `beforeEach`
- [ ] Playwright URL waits use simple patterns or callbacks
- [ ] Test API endpoints skip CSRF with environment checks

## Files Changed

| File | Change |
|------|--------|
| `e2e/fixtures/database.ts` | NEW: DatabaseSnapshotter for Playwright |
| `e2e/fixtures/auth.ts` | Fixed waitForURL, added login verification |
| `e2e/brainstorm.spec.ts` | Added snapshot restore to beforeEach hooks |
| `playwright.config.ts` | Set workers: 1, fullyParallel: false |
| `app/controllers/test/test_controller.rb` | Added skip_forgery_protection |
| `app/controllers/test/database_controller.rb` | Replaced puts with Rails.logger |
| `app/services/database/snapshotter.rb` | Replaced puts with Rails.logger |

## Related Documentation

- [Database Snapshots Feature](../features/snapshots.md) - How snapshots work
- [Plan: Fix Playwright Auth](../../plans/fix-playwright-authentication-via-database-snapshots.md) - Original plan
