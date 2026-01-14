# Plan: Real E2E Tracking Tests

## Status: ✅ COMPLETED

## Goal
Replace the hand-rolled tracking controller with real E2E tests that use:
1. The **real tracking.ts** library from `templates/default/src/lib/tracking.ts`
2. The **real Buildable pipeline** (not just Vite, but the full WebsiteDeploy#build!)
3. Static file serving (like Cloudflare does in production)

## Implementation Summary

### 1. Minimal tracking-test Example Website ✅
**Location:** `shared/websites/examples/tracking-test/`

Structure:
```
tracking-test/
├── index.html
├── package.json (minimal deps: react, react-dom, vite)
├── vite.config.ts
├── tsconfig.json
├── src/
│   ├── main.tsx (imports tracking.ts)
│   ├── App.tsx (simple form for lead capture)
│   ├── index.css
│   ├── vite-env.d.ts
│   └── lib/
│       └── tracking.ts → SYMLINK to templates/default/src/lib/tracking.ts
```

**Key:** `tracking.ts` is a **symlink** to `../../../../../../rails_app/templates/default/src/lib/tracking.ts`

### 2. TrackingTestBuilder Uses REAL Buildable Pipeline ✅
**File:** `spec/support/analytics/tracking_test_builder.rb`
**Rake task:** `rake test:tracking:build`

The builder:
1. Creates real database records (User, Account, AdsAccount, Project, Website)
2. Loads files from tracking-test example as WebsiteFiles
3. Calls `website.snapshot` to create history records
4. Creates `WebsiteDeploy` and calls `deploy.build!` (REAL Buildable concern)
5. Buildable concern:
   - Writes files from `website.current_history.files`
   - Writes `.env` file with `VITE_SIGNUP_TOKEN`, `VITE_API_BASE_URL`
   - **Injects gtag script** via `inject_gtag_script!`
   - Runs `pnpm install && pnpm build`
6. Copies dist to `tmp/tracking-test-dist/`

### 3. Test::TrackingController ✅
**File:** `app/controllers/test/tracking_controller.rb`

New endpoints:
- `GET /test/tracking/info` - Returns project/website IDs for E2E tests
- `GET /test/tracking/built` - Serves index.html from built dist
- `GET /test/tracking/built/*path` - Serves other assets (js, css, etc.)

### 4. Playwright Global Setup ✅
**File:** `e2e/global-setup.ts`

Before all tests:
1. Check if `tmp/tracking-test-dist/index.html` exists
2. If not, run `rake test:tracking:build`
3. Skips rebuild if build exists (run `rake test:tracking:clean` to force)

### 5. E2E Tests Updated ✅
**Files:**
- `e2e/fixtures/tracking.ts` - Added `getBuiltPageUrl()` and `getBuiltPageInfo()`
- `e2e/tracking.spec.ts` - Added "Real Tracking Library E2E" test suite

New tests:
- `tracks visit using real tracking.ts library`
- `built page includes gtag from Buildable pipeline`
- `real tracking library fires gtag conversion on lead submission`

## Files Created/Modified

| File | Action |
|------|--------|
| `shared/websites/examples/tracking-test/` | Created ✅ |
| `shared/websites/examples/tracking-test/src/lib/tracking.ts` | Symlink ✅ |
| `spec/support/analytics/tracking_test_builder.rb` | Created (uses real Buildable) ✅ |
| `lib/tasks/test_tracking.rake` | Created ✅ |
| `app/controllers/test/tracking_controller.rb` | Added built/info actions ✅ |
| `config/routes/dev.rb` | Added routes ✅ |
| `e2e/fixtures/tracking.ts` | Added built page helpers ✅ |
| `e2e/tracking.spec.ts` | Added real tracking tests ✅ |
| `e2e/global-setup.ts` | Created ✅ |
| `playwright.config.ts` | Added globalSetup ✅ |

## Verification

1. Run `rake test:tracking:build` - produces `tmp/tracking-test-dist/`
2. Verify gtag injection: `grep "Google tag" tmp/tracking-test-dist/index.html`
3. Manually test: visit `http://localhost:3001/test/tracking/built/` in browser
4. Run E2E tests: `pnpm test:e2e e2e/tracking.spec.ts`

## Key Design Decisions

1. **Uses REAL Buildable concern** - Not a simple Vite build, but the actual `WebsiteDeploy#build!` method that:
   - Writes env vars via `write_env_file!`
   - Injects gtag via `inject_gtag_script!`
   - Runs the full pnpm build

2. **Creates real database records** - TrackingTestBuilder creates:
   - User (account owner)
   - Account with AdsAccount (for Google conversion tracking)
   - Project
   - Website with WebsiteFiles

3. **Symlink for tracking.ts** - Changes to `templates/default/src/lib/tracking.ts` automatically propagate to tests

4. **Skip rebuild if exists** - Global setup skips rebuild for fast iteration, use `rake test:tracking:clean` to force rebuild

5. **Database record validation** - Global setup verifies database records match the build via `.project-id` file:
   - Build writes project ID to `tmp/tracking-test-dist/.project-id`
   - Global setup compares this with current database via `/test/tracking/info`
   - If mismatch (e.g., after DB restore), forces rebuild

6. **Trailing slash redirect** - Controller redirects `/test/tracking/built` to `/test/tracking/built/` to ensure relative asset paths resolve correctly

7. **Fresh builds via temp_dir cleanup** - TrackingTestBuilder cleans the deploy's temp directory before build to prevent stale cached files

8. **dataLayer-based gtag verification** - Tests check `window.dataLayer` for conversion events (not mocked gtag) since the real gtag script rewrites `window.gtag`
