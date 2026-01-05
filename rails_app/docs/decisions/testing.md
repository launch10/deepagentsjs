# Testing Decisions

This document records architectural decisions related to testing strategy, patterns, and tooling.

## Current State

- E2E tests use database snapshots restored in `beforeEach` hooks for test isolation
- Single worker mode for database-dependent Playwright tests
- `Rails.logger` used instead of `puts` in all test utilities
- Callback functions preferred over regex for Playwright URL waits

---

## Decision Log

### 2025-12-28: Playwright E2E Test Authentication Strategy

**Context:** Playwright E2E tests were failing because users weren't authenticated. Tests needed a reliable way to restore database state and verify successful login.

**Decision:** Use database snapshots with `beforeEach` hooks to restore authenticated state. Run tests in single worker mode for database-dependent tests. Use callback functions instead of regex for Playwright URL waits.

**Why:**
1. **`beforeEach` over global setup**: Trades some performance (snapshots restored per-test vs per-suite) for better isolation and debuggability. Each test gets a clean slate, making failures easier to diagnose and reproduce.

2. **Single worker mode**: Acknowledges that Playwright's parallel execution conflicts with shared mutable state (the database). This is a deliberate constraint that prevents flaky tests from race conditions.

3. **`Rails.logger` over `puts`**: Establishes a pattern for test utilities to use proper logging, which enables log-level filtering, structured output, and prevents `Errno::EPIPE` errors when stdout is closed.

4. **Callback functions for URL waits**: The choice of `waitForURL((url) => !url.includes('/sign_in'))` over regex patterns like `/(?!.*sign_in)/` provides more reliable, predictable matching that handles edge cases better.

**Alternatives Considered:**
- Global setup with single snapshot restore (rejected: harder to debug, tests not isolated)
- Environment variable to skip auth (rejected: doesn't match how users actually interact)
- Parallel workers with separate databases (rejected: complexity, resource usage)

**Status:** Current

---

## Related Documentation

- [Solution: Playwright E2E Auth](../solutions/testing-issues/playwright-e2e-auth-database-snapshots.md)
- [Feature: Database Snapshots](../features/snapshots.md)
