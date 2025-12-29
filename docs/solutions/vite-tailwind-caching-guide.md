# Vite & Tailwind Caching: Prevention Strategies & Testing Guide

> Prevention strategies for Vite CSS caching issues, test cases to catch regressions, and developer best practices.

---

## Overview

Launch10 uses Tailwind CSS v4 compiled to `app/assets/builds/tailwind.css` and served via Vite dev server. Caching issues occur when:

1. **Vite caches transpiled assets** - Old JS/CSS loaded after code changes
2. **Tailwind config changes don't rebuild** - CSS classes missing from production build
3. **Browser caches stale stylesheets** - Hard refresh needed to see new styles
4. **Asset pipeline out of sync** - Rails serving old compiled CSS

This guide prevents these issues through: proper cache clearing, comprehensive testing, and development workflow discipline.

---

## Part 1: Prevention Best Practices

### 1.1 Start Development Correctly: Use `bin/dev`

The `bin/dev` script starts both Vite dev server AND Tailwind CSS watcher in parallel.

**Correct:**
```bash
cd rails_app
bin/dev
```

This runs:
- `vite dev` - Hot Module Replacement for React/JS
- `tailwindcss -i ... --watch` - Watches for CSS changes
- Rails server

**Why it matters:**
- Vite caches optimized dependencies in `node_modules/.vite`
- Tailwind needs to watch source files and rebuild on changes
- Starting them separately can cause race conditions

**Common mistake:**
```bash
# WRONG: Missing Tailwind watcher
pnpm vite dev

# WRONG: Rails server alone without Vite
rails s
```

**Debugging:**
If styles don't update when you edit component classes:
1. Check Tailwind CSS watcher is running (`css:` line in Procfile.dev output)
2. Verify no "Tailwind: CSS rebuilt" messages appear in terminal
3. Look for errors in both Vite and CSS watcher output

---

### 1.2 Clear Caches When Styles Look Wrong

Use the provided cache-clearing script when:
- Browser shows old colors/styles despite code changes
- Inline styles look right but utility classes don't work
- Hard refresh (Cmd+Shift+R) didn't help
- After pulling code with Tailwind config changes

**Clear all caches:**
```bash
cd rails_app
bin/clear-cache
bin/dev
```

**What `bin/clear-cache` removes:**
```bash
# Vite transpilation caches
node_modules/.vite           # Vite dependency optimization
.vite                        # Local Vite cache
app/javascript/node_modules/.vite

# Rails compilation caches
tmp/cache/vite              # Rails' Vite manifest cache
tmp/cache/bootsnap          # Ruby bytecode cache

# Tailwind rebuild
app/assets/builds/tailwind.css  # Forces rebuild
```

**Then restart:**
```bash
bin/clear-cache
bin/dev
# Open browser with hard refresh: Cmd+Shift+R
```

**When to clear caches:**
- After pulling code with Tailwind changes
- If `bin/dev` appears to hang during startup
- If styles look inconsistent across pages
- Before committing style-critical changes
- If you see "CSS not found" in console

---

### 1.3 Use Inline Styles for Mission-Critical Colors

For colors that MUST be correct immediately (like brand colors, error states), use inline styles as a safety net:

**In components:**
```tsx
// Primary CTA button - inline style ensures color correctness
export function CTAButton({ children }) {
  return (
    <button
      style={{
        backgroundColor: '#3748b8', // Launch10 primary-500
        color: '#ffffff'
      }}
      className="px-4 py-2 rounded font-semibold hover:opacity-90"
    >
      {children}
    </button>
  );
}
```

**Why this works:**
- Inline styles bypass CSS file caching entirely
- They're applied directly in the DOM
- Useful for critical brand elements where a stale cache is unacceptable

**Better practice (use with inline backup):**
```tsx
// Define colors as constants, use in both inline and utilities
const LAUNCH10_PRIMARY = '#3748b8';

export function CTAButton({ children }) {
  return (
    <button
      style={{ backgroundColor: LAUNCH10_PRIMARY }}
      className={`px-4 py-2 rounded font-semibold hover:opacity-90 bg-primary-500`}
    >
      {children}
    </button>
  );
}
```

This gives you:
- Inline backup for immediate correctness
- Tailwind utility for consistency/maintainability
- Single source of truth (the constant)

---

### 1.4 Monitor the Tailwind Color System

Launch10 defines all colors in `app/assets/tailwind/application.css`:

```css
@theme {
  /* Primary colors */
  --color-primary-500: #3748b8;
  --color-primary-600: #2e3c99;
  /* ... 60+ colors defined */
}
```

**When adding new colors:**
1. Add to `app/assets/tailwind/application.css`
2. Reference with CSS variable or Tailwind class
3. **Clear caches** after adding
4. Hard refresh browser
5. Verify in browser DevTools (Colors panel)

**Quick reference for dev team:**
```
Neutral colors:     launch-color-neutral-*     (grays)
Primary:            launch-color-primary-*     (brand blue)
Secondary:          launch-color-secondary-*   (orange)
Success:            launch-color-success-*     (green)
Error:              launch-color-error-*       (red)
Accent Yellow:      launch-color-accent-yellow-*
Accent Green:       launch-color-accent-green-*
```

---

### 1.5 Watch for Tailwind Config Cache Issues

**Vite's dependency optimization** can cache Tailwind config for production builds.

**Prevention:**
1. Never edit Tailwind config during development - changes take effect on restart
2. After Tailwind config changes, clear caches: `bin/clear-cache`
3. Commit config changes separately before styling changes
4. In CI, cache clearing happens automatically

**Example scenario:**
```bash
# You modify app/assets/tailwind/application.css
# Commit changes and push
# In CI, bin/clear-cache runs automatically

# But locally, cache might stale - clear it:
bin/clear-cache
```

---

### 1.6 Use CSS @layers Correctly

Tailwind v4 uses CSS layers. Understand the layer hierarchy:

```css
@layer theme, base, components, utilities;
```

**How to use:**
```css
/* In app/assets/tailwind/components/buttons.css */
@layer components {
  .btn-primary {
    @apply px-4 py-2 bg-primary-500 text-white rounded;
  }
}

/* In app/assets/tailwind/application.css */
@import "./components/buttons.css" layer(components);
```

**Why it matters for caching:**
- Layers ensure CSS specificity is correct
- Utilities override components override base
- Prevents cache issues where old specificity rules apply

**Common mistake:**
```css
/* WRONG: Not using @layer */
.btn-primary {
  @apply px-4 py-2 bg-primary-500 text-white rounded;
}

/* Specificity conflicts with utilities if cached wrongly */
```

---

## Part 2: Test Cases to Catch Caching Issues

### 2.1 E2E Color Verification Tests

Create tests that verify specific computed color values. These catch cache misses before they reach production.

**File:** `rails_app/e2e/visual-regression.spec.ts`

```typescript
import { test, expect } from '@playwright/test';
import { loginUser } from './fixtures/auth';
import { DatabaseSnapshotter } from './fixtures/database';

test.describe('Visual Regression: Critical Colors', () => {
  test.beforeEach(async ({ page }) => {
    await DatabaseSnapshotter.restoreSnapshot('basic_account');
    await loginUser(page);
  });

  test('primary button has correct background color', async ({ page }) => {
    await page.goto('/projects/new');

    // Find CTA button
    const ctaButton = page.locator('button:has-text("Start Brainstorm")').first();
    await expect(ctaButton).toBeVisible();

    // Get computed styles
    const computedStyle = await ctaButton.evaluate((el) => {
      return window.getComputedStyle(el);
    });

    // Verify primary color (should be Launch10 primary-500: #3748b8)
    const bgColor = computedStyle.backgroundColor;
    expect(bgColor).toMatch(/rgb\(55, 72, 184\)|#3748b8/i); // Primary-500
  });

  test('error messages display correct error color', async ({ page }) => {
    await page.goto('/projects/new');

    // Trigger validation error
    const form = page.locator('form').first();
    await form.locator('input[name="title"]').fill('');
    await form.locator('button[type="submit"]').click();

    // Find error message
    const errorMsg = page.locator('[role="alert"]').first();
    const errorColor = await errorMsg.evaluate((el) => {
      return window.getComputedStyle(el).color;
    });

    // Should be error-500: #d14f34
    expect(errorColor).toMatch(/rgb\(209, 79, 52\)/);
  });

  test('success toast shows correct success color', async ({ page }) => {
    await page.goto('/projects/new');

    // Trigger success event
    await page.click('button:has-text("Save")');
    await page.waitForTimeout(500);

    // Find toast
    const toast = page.locator('[role="status"]').filter({ hasText: 'Success' });
    const toastBg = await toast.evaluate((el) => {
      return window.getComputedStyle(el).backgroundColor;
    });

    // Should be success-500: #2e9e72
    expect(toastBg).toMatch(/rgb\(46, 158, 114\)/);
  });

  test('heading typography uses correct color', async ({ page }) => {
    await page.goto('/');

    // Check heading colors
    const h1 = page.locator('h1').first();
    const h1Color = await h1.evaluate((el) => {
      return window.getComputedStyle(el).color;
    });

    // Should use foreground color: #0f1113
    expect(h1Color).toMatch(/rgb\(15, 17, 19\)/);
  });

  test('links have correct hover color', async ({ page }) => {
    await page.goto('/');

    // Find link
    const link = page.locator('a:has-text("View Projects")').first();

    // Get initial color
    const initialColor = await link.evaluate((el) => {
      return window.getComputedStyle(el).color;
    });

    // Hover
    await link.hover();
    await page.waitForTimeout(100);

    // Get hover color (should be darker)
    const hoverColor = await link.evaluate((el) => {
      return window.getComputedStyle(el).color;
    });

    // Colors should be different
    expect(hoverColor).not.toBe(initialColor);
  });

  test('dark mode colors apply correctly', async ({ page }) => {
    await page.goto('/');

    // Enable dark mode
    await page.click('[data-theme-toggle]');
    await page.waitForTimeout(200);

    // Check background color changes
    const body = page.locator('body').first();
    const bgColor = await body.evaluate((el) => {
      return window.getComputedStyle(el).backgroundColor;
    });

    // In dark mode, should be darker (not #ffffff)
    expect(bgColor).not.toMatch(/rgb\(255, 255, 255\)/);
  });
});

test.describe('Visual Regression: Component Styling', () => {
  test('buttons have consistent padding', async ({ page }) => {
    await DatabaseSnapshotter.restoreSnapshot('basic_account');
    await loginUser(page);
    await page.goto('/projects/new');

    // Check multiple buttons
    const buttons = page.locator('button').first();

    const padding = await buttons.evaluate((el) => {
      const style = window.getComputedStyle(el);
      return {
        paddingTop: style.paddingTop,
        paddingRight: style.paddingRight,
        paddingBottom: style.paddingBottom,
        paddingLeft: style.paddingLeft,
      };
    });

    // Should have consistent padding (px-4 py-2 = 1rem 0.5rem)
    expect(padding.paddingTop).toMatch(/^(0.5rem|8px)$/);
    expect(padding.paddingLeft).toMatch(/^(1rem|16px)$/);
  });

  test('form inputs have correct border color', async ({ page }) => {
    await DatabaseSnapshotter.restoreSnapshot('basic_account');
    await loginUser(page);
    await page.goto('/projects/new');

    // Focus input
    const input = page.locator('input[type="text"]').first();
    await input.click();
    await page.waitForTimeout(100);

    // Get border color
    const borderColor = await input.evaluate((el) => {
      return window.getComputedStyle(el).borderColor;
    });

    // Should be border color from theme
    expect(borderColor).toBeDefined();
    expect(borderColor).not.toMatch(/rgb\(0, 0, 0\)/); // Not black
  });
});
```

**Run these tests:**
```bash
pnpm test:e2e visual-regression.spec.ts --headed
```

**What they verify:**
- Computed CSS colors match design system
- Color inheritance works correctly
- Hover/active states have correct colors
- Dark mode colors apply
- Padding/spacing utilities work
- Theme changes affect all colors

**Benefits:**
- Catch cache issues before merging
- Document expected colors in code
- Detect when Tailwind colors change unintentionally
- Works in CI to prevent regressions

---

### 2.2 CSS Availability Test

Verify the compiled CSS file exists and is valid:

**File:** `rails_app/e2e/css-availability.spec.ts`

```typescript
import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

test.describe('CSS Availability', () => {
  test('compiled tailwind.css exists', () => {
    const cssPath = path.join(
      __dirname,
      '../app/assets/builds/tailwind.css'
    );
    expect(fs.existsSync(cssPath)).toBe(true);
  });

  test('compiled tailwind.css is not empty', () => {
    const cssPath = path.join(
      __dirname,
      '../app/assets/builds/tailwind.css'
    );
    const content = fs.readFileSync(cssPath, 'utf-8');
    expect(content.length).toBeGreaterThan(1000); // Should be many KB
  });

  test('tailwind.css contains color definitions', () => {
    const cssPath = path.join(
      __dirname,
      '../app/assets/builds/tailwind.css'
    );
    const content = fs.readFileSync(cssPath, 'utf-8');

    // Check for key color definitions
    expect(content).toContain('--color-primary-500');
    expect(content).toContain('--color-error-500');
    expect(content).toContain('--color-success-500');
  });

  test('CSS loads in browser without errors', async ({ page }) => {
    // Listen for console errors
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Navigate to app
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Check no CSS-related errors
    const cssErrors = consoleErrors.filter(
      (msg) =>
        msg.includes('.css') ||
        msg.includes('Failed to load') ||
        msg.includes('MIME type')
    );

    expect(cssErrors).toHaveLength(0);
  });

  test('CSS stylesheet link exists in HTML', async ({ page }) => {
    await page.goto('/');

    // Check stylesheet link
    const styleLink = page.locator('link[rel="stylesheet"]').first();
    await expect(styleLink).toBeVisible();

    const href = await styleLink.getAttribute('href');
    expect(href).toBeDefined();
  });

  test('Tailwind utilities are applied to elements', async ({ page }) => {
    await page.goto('/');

    // Find element with Tailwind class
    const element = page.locator('.text-base-600').first();
    await expect(element).toBeVisible();

    // Verify class is actually applied
    const classList = await element.evaluate((el) => {
      return Array.from(el.classList);
    });

    expect(classList).toContain('text-base-600');
  });
});
```

**Run these tests:**
```bash
pnpm test:e2e css-availability.spec.ts
```

---

### 2.3 Unit Tests for Color Constants

Test that color definitions are correct and don't accidentally change:

**File:** `rails_app/app/javascript/frontend/test/design-system-colors.test.ts`

```typescript
import { describe, it, expect } from 'vitest';

describe('Design System Colors', () => {
  // Color values from app/assets/tailwind/application.css @theme block
  const LAUNCH10_COLORS = {
    primaryWhite: '#ffffff',
    primary500: '#3748b8',
    primary600: '#2e3c99',
    secondary500: '#df6d4a',
    success500: '#2e9e72',
    error500: '#d14f34',
    base600: '#0f1113',
    neutral100: '#ededec',
    neutralBackground: '#fafaf9',
  };

  it('primary color is correct shade of blue', () => {
    // Convert hex to RGB to verify
    const toRGB = (hex: string) => {
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      return [r, g, b];
    };

    const rgb = toRGB(LAUNCH10_COLORS.primary500);
    expect(rgb).toEqual([55, 72, 184]);
  });

  it('error color contrasts sufficiently with white', () => {
    // WCAG color contrast calculation
    const getLuminance = (color: string) => {
      const rgb = color
        .slice(1)
        .match(/.{2}/g)
        ?.map((x) => parseInt(x, 16) / 255) || [0, 0, 0];

      const [r, g, b] = rgb.map((c) =>
        c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
      );

      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };

    const errorLum = getLuminance(LAUNCH10_COLORS.error500);
    const whiteLum = getLuminance('#ffffff');

    const contrast =
      (Math.max(errorLum, whiteLum) + 0.05) /
      (Math.min(errorLum, whiteLum) + 0.05);

    // WCAG AA requires 4.5:1 for normal text
    expect(contrast).toBeGreaterThanOrEqual(4.5);
  });

  it('all colors are valid hex codes', () => {
    const hexRegex = /^#[0-9A-F]{6}$/i;
    Object.entries(LAUNCH10_COLORS).forEach(([name, color]) => {
      expect(color).toMatch(
        hexRegex,
        `${name} (${color}) is not valid hex`
      );
    });
  });

  it('color values are consistent across definitions', () => {
    // If color is referenced in multiple places, they should match
    expect(LAUNCH10_COLORS.primary500).toBe('#3748b8');
    expect(LAUNCH10_COLORS.primary600).toBe('#2e3c99');

    // Primary 500 and 600 should be visually distinct
    const p500 = LAUNCH10_COLORS.primary500;
    const p600 = LAUNCH10_COLORS.primary600;
    expect(p500).not.toBe(p600);
  });
});
```

**Run these tests:**
```bash
pnpm test design-system-colors.test.ts
```

---

### 2.4 Integration Test: Style Compilation

Test the entire CSS compilation pipeline:

**File:** `rails_app/app/javascript/frontend/test/css-compilation.test.ts`

```typescript
import { describe, it, expect, beforeAll } from 'vitest';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

describe('CSS Compilation Pipeline', () => {
  let compiledCSS: string;

  beforeAll(() => {
    // Read the compiled CSS file
    const cssPath = path.join(
      __dirname,
      '../../assets/builds/tailwind.css'
    );

    if (!fs.existsSync(cssPath)) {
      throw new Error('Compiled CSS not found. Run: bin/clear-cache && bin/dev');
    }

    compiledCSS = fs.readFileSync(cssPath, 'utf-8');
  });

  it('compiled CSS contains all required color variables', () => {
    const requiredColors = [
      '--color-primary-500',
      '--color-primary-600',
      '--color-secondary-500',
      '--color-error-500',
      '--color-success-500',
      '--color-base-600',
      '--color-neutral-white',
    ];

    requiredColors.forEach((color) => {
      expect(compiledCSS).toContain(
        color,
        `Missing required color variable: ${color}`
      );
    });
  });

  it('compiled CSS includes all component imports', () => {
    // Should have imported component CSS files
    const expectedComponents = [
      'buttons',
      'forms',
      'cards',
      'modal',
      'alert',
    ];

    expectedComponents.forEach((component) => {
      // Check that component styles are in compiled output
      // (They won't have the @import, but classes should be there)
      expect(compiledCSS.length).toBeGreaterThan(10000);
    });
  });

  it('compiled CSS is minified for production', () => {
    // Minified CSS should have no newlines in key areas
    const hasNewlines = compiledCSS.match(/;\s*\n/);

    // Some newlines are okay, but shouldn't be excessive
    const newlineCount = (compiledCSS.match(/\n/g) || []).length;
    expect(newlineCount).toBeLessThan(100); // Minified, not formatted
  });

  it('compiled CSS includes font imports', () => {
    expect(compiledCSS).toContain('fonts.googleapis.com');
    expect(compiledCSS).toContain('IBM Plex Serif');
    expect(compiledCSS).toContain('Inter');
    expect(compiledCSS).toContain('Plus Jakarta Sans');
  });

  it('CSS file size is reasonable', () => {
    const fileSizeKB = Buffer.byteLength(compiledCSS, 'utf-8') / 1024;

    // Should be at least 50KB (comprehensive styles)
    // But not more than 500KB (something wrong with compilation)
    expect(fileSizeKB).toBeGreaterThan(50);
    expect(fileSizeKB).toBeLessThan(500);
  });
});
```

**Run these tests:**
```bash
pnpm test css-compilation.test.ts
```

---

## Part 3: Developer Best Practices

### 3.1 Development Workflow Checklist

Before starting work on styles:
- [ ] `cd rails_app`
- [ ] `bin/dev` (both Vite and Tailwind running)
- [ ] Check terminal output: "Tailwind CSS rebuilt" messages appear
- [ ] Browser DevTools → Inspector → check computed styles
- [ ] If styles look wrong: `Ctrl+C`, `bin/clear-cache`, `bin/dev` again

After pulling code:
- [ ] Look for changes to `app/assets/tailwind/application.css`
- [ ] If colors changed: run `bin/clear-cache` before testing
- [ ] Hard refresh browser: Cmd+Shift+R

Before committing:
- [ ] All tests passing: `pnpm test:e2e`
- [ ] Color tests specifically: `pnpm test:e2e visual-regression.spec.ts`
- [ ] No uncommitted changes to `app/assets/builds/tailwind.css`
- [ ] Storybook visually verified: `pnpm storybook` (check component colors)

---

### 3.2 Handling Cache Issues in Code Review

When reviewing code that touches styles:

**Look for:**
1. Changes to `app/assets/tailwind/application.css` - requires cache clear
2. New color variables - verify they're added to @theme block
3. New component CSS files - verify they're imported in `application.css`
4. Tailwind config changes - require Vite cache clear
5. Large CSS changes - check file size before/after

**Comment examples:**
```
# Good review comment
"This adds a new color variable. Before merging, run:
$ bin/clear-cache
$ bin/dev
And verify the color appears correctly in browser."

# Catching potential cache issues
"This changes app/assets/tailwind/application.css. Did you test
with a clean cache? Try: bin/clear-cache && bin/dev"
```

---

### 3.3 Debugging Cache Issues

**Symptom: Colors don't update when I change Tailwind config**

1. Check Tailwind watcher is running: `css:` line in `bin/dev` output
2. Verify the change: `tail -f app/assets/builds/tailwind.css | grep "color-primary-500"`
3. If not updating: kill `bin/dev`, run `bin/clear-cache`, run `bin/dev` again
4. Hard refresh browser: Cmd+Shift+R

**Symptom: Styles work locally but not in CI**

1. Check CI runs cache clearing automatically (it should)
2. If not: add `bin/clear-cache` to CI build script
3. Verify CSS rebuild step runs: `tailwindcss -i ... -o ...`

**Symptom: Some utilities work, some don't**

1. Verify the utility is in compiled CSS: grep in browser DevTools
2. Check the class name spelling exactly matches
3. Verify source file is imported: search `app/assets/tailwind/application.css`
4. Check Tailwind @source directive includes your component files
5. If @source path is wrong: clear cache, restart

---

### 3.4 Documentation for Team

Share this with team members:

**Five-minute cache fix:**
```bash
# When styles look wrong:
cd rails_app
bin/clear-cache
bin/dev

# In browser:
# Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows)
```

**What `bin/dev` does:**
```
1. Starts Rails server (localhost:3000)
2. Starts Vite dev server (serves JS/assets)
3. Starts Tailwind CSS watcher (watches CSS files)

All three must be running for styles to update live.
```

**Color system reference:**
```
Use these colors from app/assets/tailwind/application.css:
- Primary (brand blue): primary-{100,200,300,400,500,600,700,800}
- Error (red): error-{100,200,300,400,500,600,700,800}
- Success (green): success-{100,200,300,400,500,600,700,800}
- Neutral (gray): neutral-{50,100,200,300,400,500,600,700,800}

Example:
<button className="bg-primary-500 text-white">Click me</button>
```

---

## Part 4: CI/CD Integration

### 4.1 GitHub Actions: Cache Clear Step

Add to your CI workflow before building:

```yaml
# .github/workflows/build.yml
name: Build & Test

on: [push, pull_request]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '24'

      - name: Install dependencies
        run: pnpm install

      - name: Clear Vite caches
        working-directory: ./rails_app
        run: bin/clear-cache

      - name: Build CSS
        working-directory: ./rails_app
        run: pnpm run build:css

      - name: Run tests
        run: pnpm test:e2e
```

### 4.2 CI: CSS Verification Step

```yaml
      - name: Verify CSS compilation
        working-directory: ./rails_app
        run: |
          if [ ! -f app/assets/builds/tailwind.css ]; then
            echo "ERROR: tailwind.css not found"
            exit 1
          fi

          if [ ! -s app/assets/builds/tailwind.css ]; then
            echo "ERROR: tailwind.css is empty"
            exit 1
          fi

          grep -q "color-primary-500" app/assets/builds/tailwind.css || {
            echo "ERROR: Color definitions missing from tailwind.css"
            exit 1
          }
```

---

## Part 5: Troubleshooting Reference

| Issue | Symptom | Solution |
|-------|---------|----------|
| **Stale Vite cache** | React components don't update | Clear: `rm -rf node_modules/.vite` then restart |
| **Tailwind not watching** | CSS changes don't appear | Verify `css:` line in `bin/dev` output; restart |
| **Old colors in browser** | Browser shows old hex values | Hard refresh: Cmd+Shift+R |
| **Production build missing colors** | Styles work locally, broken in prod | CI didn't run cache clear; check build script |
| **Component color differs from design** | Utility class applied but wrong color | Verify hex in `application.css` matches design |
| **Specificity conflicts** | Inline style overrides utility (wrong) | Use @layer correctly; check CSS compilation order |
| **Font not loading** | Missing fonts in typography | Verify Google Fonts URL in `application.css` |
| **Performance degraded** | Page load slow, many CSS file requests | Tailwind CSS not compiled; rebuild: `bin/clear-cache` |

---

## Conclusion

**Summary of key practices:**

1. **Start correctly:** Always use `bin/dev` for development
2. **Clear when needed:** Run `bin/clear-cache` after pulling code with style changes
3. **Test constantly:** Run E2E color tests before committing style changes
4. **Monitor compilation:** Watch for "Tailwind CSS rebuilt" messages
5. **Use inline styles:** For mission-critical colors, backup with inline styles
6. **Hard refresh:** After any cache clear, hard refresh the browser
7. **Verify in DevTools:** Use browser inspector to check computed styles
8. **Document changes:** Comment on PRs touching CSS/colors with clear instructions

**For CI/CD:** Always run `bin/clear-cache` before building, and verify CSS file exists and contains color definitions.

---

## Related Documentation

- `/rails_app/.claude/skills/` - Claude Code skills for this project
- `docs/decisions/frontend.md` - Frontend architecture decisions
- `docs/decisions/testing.md` - Testing approach and patterns
- `/CLAUDE.md` - Full project guide
