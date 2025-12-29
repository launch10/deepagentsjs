# Vite/Tailwind Caching: Quick Reference

TL;DR for developers working on Launch10 styles.

## When Styles Look Wrong

**Follow these steps in order:**

1. **Check the CSS watcher is running**
   ```
   Look at bin/dev output - should show:
   css: tailwindcss -i app/assets/tailwind/application.css -o ...
   ```

2. **If missing, restart:**
   ```bash
   Ctrl+C
   bin/dev
   ```

3. **Wait for CSS rebuild**
   ```
   Look for: "Tailwind CSS rebuilt" message in terminal
   ```

4. **Hard refresh browser**
   ```
   Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows)
   ```

5. **Still broken? Clear caches:**
   ```bash
   Ctrl+C
   bin/clear-cache
   bin/dev
   Cmd+Shift+R
   ```

## Before Starting Work

- [ ] `cd rails_app`
- [ ] `bin/dev` (wait for both "Vite server ready" and "Tailwind CSS rebuilt")
- [ ] Open browser to localhost:3000

## After Pulling Code

- [ ] Check git diff for changes to `app/assets/tailwind/application.css`
- [ ] If changed: run `bin/clear-cache` before testing
- [ ] Run tests: `pnpm test:e2e visual-regression.spec.ts --headed`

## What to Test

Test that specific colors appear correctly:

```bash
# Run color verification tests
pnpm test:e2e visual-regression.spec.ts

# Or test locally in browser:
# 1. Inspect button with DevTools (right-click → Inspect)
# 2. Check "Computed" tab
# 3. Verify background-color matches design
```

## Color Reference

Core colors from `app/assets/tailwind/application.css`:

| Name | Hex | Use Case |
|------|-----|----------|
| Primary 500 | #3748b8 | Brand CTAs, primary actions |
| Primary 600 | #2e3c99 | Hover/active states |
| Secondary 500 | #df6d4a | Secondary actions, accents |
| Error 500 | #d14f34 | Errors, destructive actions |
| Success 500 | #2e9e72 | Success states, confirmations |
| Base 600 | #0f1113 | Body text, headings |
| Neutral 100 | #ededec | Light backgrounds |
| White | #ffffff | Paper white backgrounds |

## Common Issues

| Problem | Fix |
|---------|-----|
| Colors don't update | Restart `bin/dev` + hard refresh |
| Utility classes don't work | Clear cache: `bin/clear-cache` |
| Some styles work, some don't | Check CSS file compilation: `ls -la app/assets/builds/tailwind.css` |
| Browser shows old colors | Hard refresh: Cmd+Shift+R |
| Production styles broken | CI didn't run cache clear (alert code reviewer) |

## For Mission-Critical Colors

If a color MUST be correct immediately, use inline style as backup:

```tsx
<button style={{ backgroundColor: '#3748b8' }} className="bg-primary-500">
  Save
</button>
```

This ensures the color works even if CSS cache is stale.

## Testing Checklist Before Committing

- [ ] Colors verified in browser DevTools
- [ ] E2E tests passing: `pnpm test:e2e visual-regression.spec.ts`
- [ ] No uncommitted changes to `app/assets/builds/tailwind.css`
- [ ] Storybook colors match design: `pnpm storybook`

## Ask for Help If

- Cache clearing doesn't fix it
- Same styles work for you but break for others
- Only specific colors are affected
- Production build looks different from dev
- Tests are failing with unexpected colors
