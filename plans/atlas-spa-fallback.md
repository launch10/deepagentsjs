# Plan: Atlas SPA Fallback

## Problem

Direct navigation to React Router routes returns 404:

```
GET /pricing → Atlas looks for /pricing/index.html → Not found → 404
```

Should instead serve `index.html` and let React Router handle routing client-side.

## Solution

Add fallback logic to `atlas/src/index-public.tsx`.

**Critical**: We must check the original path **before** normalization. The existing code at lines 99-103 already transforms `/pricing` → `pricing/index.html`, so checking `hasFileExtension` after that will always be true.

```typescript
// BEFORE path normalization (around line 93, before the existing if block)
// Note: strippedPathname still has leading "/" at this point
const lastSegment = strippedPathname.split('/').pop() || '';
const isAssetRequest = lastSegment.includes('.');      // /app.js, /logo.png
const isDotfile = strippedPathname.includes('/.');     // /.well-known, /.htaccess
const isApiRequest = strippedPathname.startsWith('/api/');

const shouldFallbackOnMiss = !isAssetRequest && !isDotfile && !isApiRequest;

// ... existing normalization logic (lines 99-103) stays unchanged ...

// AFTER R2 lookup (around line 120) - change const to let
let object = await r2Bucket.get(objectKey);

// SPA fallback: serve index.html for route paths
if (object === null && shouldFallbackOnMiss) {
  const fallbackKey = `${cloudEnv}/${website.id}/${targetDir}/index.html`;
  object = await r2Bucket.get(fallbackKey);
}

// Existing 404 handling remains unchanged
if (object === null) {
  return new Response(`File not found`, { status: 404 });
}
```

### Exclusions

Paths that should NOT fallback (should 404 if missing):

- **Dotfiles**: `/.well-known/*`, `/.htaccess` - special server paths
- **API paths**: `/api/*` - should not serve HTML
- **Files with extensions**: `/app.js`, `/logo.png` - actual missing assets

## Tests

```typescript
describe('SPA Fallback', () => {
  // Happy paths
  it('serves index.html for root path', async () => {
    // / -> serve index.html directly
  });

  it('serves existing files directly', async () => {
    // /assets/app.js (exists) -> serve app.js
  });

  // Fallback triggers
  it('serves index.html for route without extension', async () => {
    // /pricing -> fallback to index.html (200)
  });

  it('serves index.html for nested route', async () => {
    // /blog/posts/my-article -> fallback to index.html
  });

  it('handles subpath deployments correctly', async () => {
    // /bingo/pricing -> fallback to /bingo's index.html
  });

  // Fallback exclusions
  it('returns 404 for missing asset with extension', async () => {
    // /assets/missing.js -> 404
  });

  it('returns 404 for dotfiles (no fallback)', async () => {
    // /.well-known/acme-challenge/token -> 404
  });
});
```

## Files to Modify

| File | Action |
|------|--------|
| `atlas/src/index-public.tsx` | Add ~12 lines of fallback logic |
| `atlas/src/index-public.test.ts` | Create with 7 test cases |

## Rollout

1. Deploy to staging
2. Verify with existing websites (fallback only triggers on 404s, so existing behavior unchanged)
3. Deploy to production

## Dependencies

- None - standalone Atlas change
- Required by: `coding-agent-static-validation.md` (Phase 2)

---

## Review History

### Review 1: Initial Plan (~310 lines)

**Reviewers**: DHH, Kieran, Simplicity

**Critical Issue Found**: The proposed code checked `hasFileExtension` *after* path normalization. Since existing code at lines 99-103 already transforms `/pricing` → `pricing/index.html`, the extension check would always be true and fallback would never trigger.

**Other Issues**:
- Feature flag suggestion (unnecessary for 10-line additive change)
- Self-answered open questions
- ~15 tests for a ~10 line change
- Future work documentation embedded in plan
- Missing dotfile/API path exclusions

**Decisions**:
- Fix implementation to check path BEFORE normalization
- Remove feature flag
- Reduce to 5 essential tests
- Add dotfile and API path exclusions
- Remove future work sections

### Review 2: Revised Plan (~93 lines)

**Reviewers**: DHH, Kieran, Simplicity

**Issues Found**:
- Leading slash missing in path checks (should be `/.` and `/api/`, not `.` and `api/`)
- Boolean logic could be clearer with descriptive variable names
- Missing test cases: root path, nested routes
- Test file should be "Create" not "Add" (file doesn't exist)

**Decisions**:
- Fix path checks to include leading slash
- Rewrite boolean logic: `isAssetRequest`, `isDotfile`, `isApiRequest`, `shouldFallbackOnMiss`
- Add 2 more tests (root path, nested routes) → 7 total
- Update Files to Modify table

### Review 3: Final Plan (~107 lines)

**Reviewers**: DHH, Kieran, Simplicity

**Verdicts**:
| Reviewer | Verdict |
|----------|---------|
| DHH | **Ship it** - "Stop iterating and start implementing" |
| Kieran | **Almost ready** - Verify line numbers during implementation |
| Simplicity | **Ship it** - "Already minimal, no YAGNI violations" |

**Minor Notes for Implementation**:
- Verify exact line numbers in `atlas/src/index-public.tsx`
- Confirm `strippedPathname` still has leading `/` at insertion point
- Consider trailing slash test if time permits

**Status**: APPROVED
