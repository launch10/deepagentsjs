# Plan: Atlas SPA Fallback

## Summary

Add SPA (Single Page Application) fallback behavior to Atlas so that React Router routes work with direct navigation. When a path doesn't match a file in R2 and has no file extension, serve `index.html` instead of 404.

## Problem

Current behavior:
```
GET /pricing → Atlas looks for /pricing/index.html in R2 → Not found → 404
```

Desired behavior:
```
GET /pricing → Atlas looks for /pricing/index.html in R2 → Not found → Fallback to /index.html → React Router handles /pricing client-side
```

This mismatch means:
- Client-side navigation works (React Router intercepts clicks)
- Direct navigation/refresh breaks (Atlas 404s)
- Shared links to subpages break

## Solution

Add fallback logic to `atlas/src/index-public.tsx`:

```typescript
// After line 120: const object = await r2Bucket.get(objectKey);

let object = await r2Bucket.get(objectKey);

// SPA fallback: if no file found and path looks like a route (no extension), serve index.html
if (object === null) {
  const hasFileExtension = strippedPathname.split('/').pop()?.includes('.');

  if (!hasFileExtension) {
    const fallbackKey = `${cloudEnv}/${website.id}/${targetDir}/index.html`;
    console.log(`SPA fallback: ${objectKey} not found, trying ${fallbackKey}`);
    object = await r2Bucket.get(fallbackKey);
  }
}

// Existing 404 handling remains for actual missing files (images, js, css, etc.)
if (object === null) {
  return new Response(`File not found`, { status: 404 });
}
```

## Behavior Matrix

| Request Path | File in R2? | Has Extension? | Result |
|--------------|-------------|----------------|--------|
| `/` | Yes (`index.html`) | No | Serve `index.html` |
| `/pricing` | No | No | **SPA fallback** → Serve `index.html` |
| `/pricing/` | No | No | **SPA fallback** → Serve `index.html` |
| `/about/team` | No | No | **SPA fallback** → Serve `index.html` |
| `/assets/app.js` | Yes | Yes | Serve `app.js` |
| `/assets/app.js` | No | Yes | **404** (missing asset) |
| `/images/logo.png` | No | Yes | **404** (missing asset) |
| `/favicon.ico` | Yes | Yes | Serve `favicon.ico` |

## Files to Modify

### 1. `atlas/src/index-public.tsx`

Add SPA fallback logic after R2 lookup (see solution above).

### 2. `atlas/src/index-public.test.ts` (create or extend)

Add test cases for SPA fallback behavior.

## Test Cases

### Unit Tests (Vitest)

```typescript
describe('SPA Fallback', () => {
  describe('when path has no file extension', () => {
    it('serves index.html for /pricing when file does not exist', async () => {
      // Mock R2 to return null for /pricing/index.html
      // Mock R2 to return content for /index.html
      // Assert response is index.html content
    });

    it('serves index.html for /about/team (nested route)', async () => {
      // Same pattern for nested routes
    });

    it('serves index.html for /pricing/ (with trailing slash)', async () => {
      // Trailing slash should also fallback
    });

    it('serves the actual file if it exists at /pricing/index.html', async () => {
      // If someone pre-renders a page, it should be served
      // Mock R2 to return content for /pricing/index.html
      // Assert that content is served (not root index.html)
    });
  });

  describe('when path has file extension', () => {
    it('returns 404 for missing /assets/app.js', async () => {
      // Mock R2 to return null
      // Assert 404 response
    });

    it('returns 404 for missing /images/logo.png', async () => {
      // Should NOT fallback for missing images
    });

    it('serves the file when it exists', async () => {
      // Mock R2 to return content
      // Assert content is served with correct content-type
    });
  });

  describe('with subpath deployments', () => {
    it('serves subpath index.html for /bingo/pricing', async () => {
      // Website deployed at /bingo
      // Request: /bingo/pricing
      // Should fallback to /bingo's index.html, not root
      // R2 key: production/{id}/live/index.html (stripped path)
    });

    it('does not cross-contaminate between subpaths', async () => {
      // /bingo/pricing should NOT serve root website's index.html
      // Should serve /bingo website's index.html
    });
  });
});
```

### Integration Tests

```typescript
describe('SPA Fallback Integration', () => {
  beforeAll(async () => {
    // Deploy a test website with:
    // - index.html (with React Router routes for /, /pricing, /about)
    // - assets/app.js
    // - favicon.ico
  });

  it('serves index.html for root path', async () => {
    const res = await fetch('https://test.launch10.site/');
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/html');
  });

  it('serves index.html for React Router route', async () => {
    const res = await fetch('https://test.launch10.site/pricing');
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/html');
    // Body should be same as index.html
  });

  it('serves assets directly', async () => {
    const res = await fetch('https://test.launch10.site/assets/app.js');
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('javascript');
  });

  it('returns 404 for missing assets', async () => {
    const res = await fetch('https://test.launch10.site/assets/nonexistent.js');
    expect(res.status).toBe(404);
  });

  it('handles direct navigation then client-side navigation', async () => {
    // This would be a Playwright test
    // 1. Navigate directly to /pricing
    // 2. Assert page renders (React Router handles it)
    // 3. Click link to /about
    // 4. Assert /about renders (client-side navigation)
    // 5. Refresh page
    // 6. Assert /about still renders (SPA fallback)
  });
});
```

### Edge Cases to Test

1. **Trailing slash handling**: `/pricing` vs `/pricing/` should both work
2. **Query strings**: `/pricing?ref=google` should fallback correctly
3. **Hash fragments**: `/pricing#features` should work (handled client-side anyway)
4. **Nested routes**: `/blog/2024/my-post` should fallback
5. **Preview vs Live**: Both environments should support fallback
6. **CloudEnv parameter**: `?cloudEnv=staging` should fallback to correct environment's index.html
7. **Subpath deployments**: `/bingo/pricing` falls back to `/bingo`'s index.html

## Rollout Plan

1. **Add feature flag** (optional): `SPA_FALLBACK_ENABLED` environment variable
2. **Deploy to staging** first
3. **Test with existing websites** - should not break anything (fallback only triggers on 404)
4. **Deploy to production**
5. **Update agent instructions** to use React Router routes confidently

## Impact on Coding Agent Validation

Once this is deployed, the validation plan (`plans/coding-agent-validation.md`) simplifies:

### Link Validation Rules

```typescript
async validateLinks(files: CodeFile[]): Promise<ValidationError[]> {
  const errors: ValidationError[] = [];

  // 1. Collect all anchor IDs
  const anchors = collectAnchorsFromFiles(files);

  // 2. Collect all React Router routes from App.tsx
  const routes = parseRoutesFromAppTsx(files);

  // 3. Collect all static files (images, assets, etc.)
  const staticFiles = files
    .filter(f => f.path.match(/\.(png|jpg|svg|ico|js|css|json)$/))
    .map(f => f.path);

  for (const file of files) {
    const hrefs = extractHrefs(file.content);

    for (const href of hrefs) {
      if (href.startsWith('#')) {
        // Anchor link - must have matching id
        if (!anchors.has(href.slice(1))) {
          errors.push({ type: 'link', message: `Broken anchor: ${href}`, file: file.path });
        }
      } else if (href.startsWith('http') || href.startsWith('mailto:')) {
        // External link - skip
        continue;
      } else if (href.match(/\.(png|jpg|svg|ico|js|css|json)$/)) {
        // Static file - must exist
        if (!staticFiles.includes(href) && !staticFiles.includes(`/src${href}`)) {
          errors.push({ type: 'link', message: `Missing file: ${href}`, file: file.path });
        }
      } else {
        // Route link - must have matching React Router route
        const normalizedHref = href.replace(/\/$/, '') || '/';
        if (!routes.has(normalizedHref)) {
          errors.push({ type: 'link', message: `No route for: ${href}`, file: file.path });
        }
      }
    }
  }

  return errors;
}
```

## Agent Instructions (Post-Implementation)

Add to the coding agent's system prompt:

```markdown
## Page Routing

All pages are React Router routes defined in `src/App.tsx`.

To add a new page:
1. Create a component in `src/pages/MyPage.tsx`
2. Add a route in `src/App.tsx`: `<Route path="/my-page" element={<MyPage />} />`
3. Link to it with `href="/my-page"` or `<Link to="/my-page">`

Do NOT create separate HTML files for each page. The SPA handles all routing.

### Link Types

| Link Type | Example | How It Works |
|-----------|---------|--------------|
| Page route | `href="/pricing"` | React Router handles client-side |
| Anchor | `href="#features"` | Scrolls to `id="features"` element |
| Asset | `src="/images/hero.png"` | Served directly from storage |
| External | `href="https://example.com"` | Opens external site |

### Common Mistakes to Avoid

- Don't create `/pricing/index.html` - just add a route
- Don't use `href="/pricing.html"` - use `href="/pricing"`
- Ensure every `#anchor` link has a matching `id` attribute
```

## Dependencies

- None - this is a standalone Atlas change
- Can be deployed independently of coding agent validation

## Related Plans

These plans depend on this SPA fallback being in place:
- `plans/coding-agent-static-validation.md` - Uses route-based link validation
- `plans/coding-agent-deploy-validation.md` - Tests routes at runtime

## Estimated Scope

- Atlas code change: ~10 lines
- Unit tests: ~50-100 lines
- Integration tests: ~50 lines
- Documentation updates: ~30 lines

## Open Questions

1. **Should we add a response header** indicating SPA fallback was used? (Useful for debugging)
2. **Should fallback be opt-in per website?** (Probably not - SPA is the default pattern)
3. **Should we cache the fallback differently?** (Probably same caching rules apply)
