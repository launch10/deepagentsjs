# CI/CD Caching Prevention Checklist

Ensure Vite/Tailwind caching issues don't slip through to production.

---

## GitHub Actions Workflow

Add these steps to your main CI workflow (before building and testing):

### Step 1: Clear Vite Caches

```yaml
      - name: Clear Vite caches
        working-directory: ./rails_app
        run: bin/clear-cache
```

This removes:
- `node_modules/.vite` (dependency optimization cache)
- `.vite` (local Vite cache)
- `tmp/cache/vite` (Rails Vite manifest)
- `tmp/cache/bootsnap` (Ruby bytecode cache)

### Step 2: Verify CSS Compilation

```yaml
      - name: Verify CSS compilation
        working-directory: ./rails_app
        run: |
          # Ensure compiled CSS exists
          if [ ! -f app/assets/builds/tailwind.css ]; then
            echo "ERROR: app/assets/builds/tailwind.css not found"
            exit 1
          fi

          # Ensure it's not empty
          if [ ! -s app/assets/builds/tailwind.css ]; then
            echo "ERROR: app/assets/builds/tailwind.css is empty"
            exit 1
          fi

          # Verify key color definitions are present
          grep -q "color-primary-500" app/assets/builds/tailwind.css || {
            echo "ERROR: Color definitions missing from tailwind.css"
            exit 1
          }

          # Show file size for debugging
          ls -lh app/assets/builds/tailwind.css
```

### Step 3: Run CSS-Specific Tests

```yaml
      - name: Run CSS availability tests
        run: pnpm --filter "@launch10/rails" test:e2e css-availability.spec.ts
```

### Step 4: Run Color Regression Tests

```yaml
      - name: Run color regression tests
        run: pnpm --filter "@launch10/rails" test:e2e visual-regression.spec.ts
```

---

## Complete Example Workflow

Here's a complete CI workflow file:

**File:** `.github/workflows/build-and-test.yml`

```yaml
name: Build & Test

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  build:
    runs-on: ubuntu-latest
    timeout-minutes: 30

    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_DB: launch10_test
          POSTGRES_HOST_AUTH_METHOD: trust
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Ruby
        uses: ruby/setup-ruby@v1
        with:
          ruby-version: 3.3
          working-directory: ./rails_app
          bundler-cache: true

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '24'

      - name: Cache pnpm modules
        uses: actions/setup-node@v4
        with:
          node-version: '24'
          cache: 'pnpm'

      # CACHING PREVENTION STEPS
      - name: Clear all caches
        working-directory: ./rails_app
        run: |
          echo "Clearing Vite caches..."
          rm -rf node_modules/.vite .vite tmp/cache/vite tmp/cache/bootsnap 2>/dev/null || true
          echo "Cache clearing complete"

      - name: Install dependencies
        run: pnpm install

      - name: Install Ruby dependencies
        working-directory: ./rails_app
        run: bundle install

      - name: Setup Rails database
        working-directory: ./rails_app
        env:
          DATABASE_URL: postgres://postgres:@localhost:5432/launch10_test
        run: |
          bundle exec rake db:create db:schema:load

      # CSS COMPILATION & VERIFICATION
      - name: Build CSS
        working-directory: ./rails_app
        run: |
          # Ensure Tailwind CLI exists
          npx tailwindcss --version

          # Rebuild CSS from scratch
          rm -f app/assets/builds/tailwind.css
          npx tailwindcss -i app/assets/tailwind/application.css \
                         -o app/assets/builds/tailwind.css \
                         --minify

      - name: Verify CSS compilation
        working-directory: ./rails_app
        run: |
          set -e

          # Check file exists
          if [ ! -f app/assets/builds/tailwind.css ]; then
            echo "ERROR: CSS file not found at app/assets/builds/tailwind.css"
            exit 1
          fi

          # Check file size (should be 100KB+)
          SIZE=$(stat -f%z app/assets/builds/tailwind.css 2>/dev/null || stat -c%s app/assets/builds/tailwind.css)
          if [ "$SIZE" -lt 100000 ]; then
            echo "ERROR: CSS file too small: $SIZE bytes"
            exit 1
          fi

          # Check for critical color definitions
          if ! grep -q "color-primary-500" app/assets/builds/tailwind.css; then
            echo "ERROR: Missing color-primary-500"
            exit 1
          fi

          if ! grep -q "color-error-500" app/assets/builds/tailwind.css; then
            echo "ERROR: Missing color-error-500"
            exit 1
          fi

          if ! grep -q "color-success-500" app/assets/builds/tailwind.css; then
            echo "ERROR: Missing color-success-500"
            exit 1
          fi

          echo "✓ CSS compilation successful"
          echo "  File size: $(numfmt --to=iec $SIZE 2>/dev/null || echo "$SIZE bytes")"

      - name: Build Vite assets
        working-directory: ./rails_app
        run: pnpm build

      # UNIT & INTEGRATION TESTS
      - name: Run unit tests
        working-directory: ./rails_app
        run: pnpm test

      - name: Run design system tests
        working-directory: ./rails_app
        run: pnpm test design-system-colors.test.ts

      # E2E TESTS (with caching checks)
      - name: Install Playwright browsers
        run: pnpm --filter "@launch10/rails" exec playwright install --with-deps chromium

      - name: Run CSS availability E2E tests
        working-directory: ./rails_app
        run: pnpm test:e2e e2e/css-availability.spec.ts

      - name: Run visual regression E2E tests
        working-directory: ./rails_app
        run: pnpm test:e2e e2e/visual-regression.spec.ts

      - name: Run main brainstorm E2E tests
        working-directory: ./rails_app
        run: pnpm test:e2e e2e/brainstorm.spec.ts

      # OPTIONAL: Screenshot comparison
      - name: Upload E2E test results
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report
          path: rails_app/playwright-report/
          retention-days: 30

      # OPTIONAL: Upload Storybook for visual review
      - name: Build Storybook
        working-directory: ./rails_app
        run: pnpm build-storybook

      - name: Deploy Storybook
        if: github.ref == 'refs/heads/main'
        uses: actions/upload-artifact@v4
        with:
          name: storybook
          path: rails_app/storybook-static/
```

---

## Pre-Commit Hooks (Local)

Ensure developers run tests locally before pushing:

**File:** `.husky/pre-commit`

```bash
#!/bin/sh

set -e

echo "Running pre-commit checks..."

# Only run if files changed in rails_app
if git diff --cached --quiet -- rails_app/app/assets/tailwind; then
  echo "CSS changes detected - running color tests..."
  pnpm --filter "@launch10/rails" test design-system-colors.test.ts || {
    echo "FAILED: Color tests failed"
    exit 1
  }
fi

# Run linting
pnpm lint || {
  echo "FAILED: Linting failed"
  exit 1
}

echo "✓ Pre-commit checks passed"
```

---

## Production Deployment Checklist

Before deploying to production:

- [ ] CI workflow completed successfully
- [ ] CSS file size is reasonable (100KB-500KB)
- [ ] Color definitions present in compiled CSS
- [ ] Visual regression tests passing
- [ ] No Vite cache errors in CI logs
- [ ] Storybook built successfully (component colors visible)
- [ ] Manual spot-check of critical colors in staging

---

## Troubleshooting CI

### CSS File Not Found

**Cause:** Tailwind CLI not installed or compilation failed

**Fix:**
```bash
# In CI, ensure:
1. pnpm install runs first
2. npx tailwindcss available
3. app/assets/tailwind/application.css exists

# Check:
npx tailwindcss --version
ls -la app/assets/tailwind/
```

### Color Definitions Missing

**Cause:** Tailwind config not being read during compilation

**Fix:**
```bash
# Verify @theme block in application.css:
grep "@theme" app/assets/tailwind/application.css

# Rebuild with verbose output:
npx tailwindcss -i app/assets/tailwind/application.css \
                -o app/assets/builds/tailwind.css --help
```

### CSS File Too Small

**Cause:** Missing component imports or minification removed everything

**Fix:**
```bash
# Check for errors:
npx tailwindcss -i app/assets/tailwind/application.css \
                -o /tmp/tailwind-test.css

# Verify imports:
head -100 /tmp/tailwind-test.css

# Check for errors in stderr
```

### E2E Tests Timeout

**Cause:** Page loading CSS causing timeout

**Fix:**
```bash
# Add longer timeout in playwright.config.ts:
use: {
  navigationTimeout: 30000,
}

# Or restart Vite in CI:
- name: Start dev server
  run: pnpm vite dev &
  working-directory: ./rails_app
```

---

## Monitoring & Alerts

### CSS File Size Monitoring

Track CSS file size over time to catch bloat:

```bash
# Add to CI after CSS build:
SIZE=$(stat -c%s app/assets/builds/tailwind.css)
echo "CSS_SIZE=$SIZE" >> $GITHUB_OUTPUT

# Log to monitoring system
# Alert if SIZE > 400KB
```

### Color Definition Validation

Ensure colors are always present:

```bash
REQUIRED_COLORS=(
  "color-primary-500"
  "color-error-500"
  "color-success-500"
  "color-neutral-white"
  "color-base-600"
)

for color in "${REQUIRED_COLORS[@]}"; do
  if ! grep -q "$color" app/assets/builds/tailwind.css; then
    echo "ALERT: Missing $color in compiled CSS"
    exit 1
  fi
done
```

---

## Related Documentation

- `docs/solutions/vite-tailwind-caching-guide.md` - Full prevention guide
- `rails_app/.claude/caching-quick-reference.md` - Developer quick reference
- `docs/decisions/testing.md` - Testing decisions and patterns
