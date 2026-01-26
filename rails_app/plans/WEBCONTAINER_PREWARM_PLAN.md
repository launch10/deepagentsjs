# WebContainer Pre-Warming (Simplified)

## Goal
Pre-install node_modules in the background so when user reaches Website page, they just mount files and GO.

## Key Insight
WebContainer is a **global singleton outside React**. It doesn't care what page/component is mounted. Pre-warm it early, and WebsitePreview is just a window into something already running.

---

## Implementation

### 1. Enhance existing singleton (`lib/webcontainer/index.ts`)

Add ~30 lines to the existing file:

```typescript
let warmupPromise: Promise<void> | null = null;
let isWarmedUp = false;

export async function warmUp(packageJson: string): Promise<void> {
  if (warmupPromise) return warmupPromise;

  warmupPromise = (async () => {
    try {
      const wc = await webcontainer;
      await wc.mount({
        "package.json": { file: { contents: packageJson } },
        "index.html": { file: { contents: "<html><body></body></html>" } },
      });
      const install = await wc.spawn("npm", ["install"]);
      await install.exit;
      isWarmedUp = true;
    } catch (e) {
      warmupPromise = null; // Reset so retry is possible
      throw e;
    }
  })();

  return warmupPromise;
}

export function getIsWarmedUp(): boolean {
  return isWarmedUp;
}

// Export promise so consumers can await in-flight warmup
export { warmupPromise };
```

### 2. Trigger warm-up early (app initialization)

In `ProjectLayout.tsx` (shared by Brainstorm, Website, Ads pages):

```typescript
import { warmUp } from "@lib/webcontainer";
import { useQuery } from "@tanstack/react-query";

// In ProjectLayout component:
const { data: template } = useQuery({
  queryKey: ["template", "default"],
  queryFn: () => api.templates.show("default"),
  staleTime: Infinity, // Cache forever
});

useEffect(() => {
  const packageJson = template?.files?.["package.json"]?.content;
  if (packageJson) {
    warmUp(packageJson).catch(console.error); // Fire and forget, errors logged
  }
}, [template]);
```

This runs when user enters any project page - WebContainer warms up in background while they work on brainstorm/ads.

### 3. Simplify `useWebsitePreview.ts`

Await in-flight warmup, skip npm install if already warmed:

```typescript
import { getIsWarmedUp, warmupPromise } from "@lib/webcontainer";

// In mountAndRun():
if (!devServerStartedRef.current) {
  devServerStartedRef.current = true;

  // Wait for in-flight warmup if it exists
  if (warmupPromise) {
    await warmupPromise.catch(() => {}); // Ignore errors, we'll install below
  }

  // Skip install if pre-warmed
  if (!getIsWarmedUp()) {
    setStatus("installing");
    const installProcess = await wc.spawn("npm", ["install"]);
    await installProcess.exit;
  }

  setStatus("starting");
  // ... rest unchanged
}
```

### 4. Keep WebsitePreview conditionally rendered

Doesn't matter - WebContainer lives outside React. Mount/unmount the component freely.

---

## Files Changed

| File | Change |
|------|--------|
| `rails_app/app/javascript/frontend/lib/webcontainer/index.ts` | Add `warmUp()`, `getIsWarmedUp()`, export `warmupPromise` (~30 lines) |
| `rails_app/app/javascript/frontend/hooks/website/useWebsitePreview.ts` | Await warmup, skip install if pre-warmed (~8 lines) |
| `rails_app/app/javascript/frontend/layouts/ProjectLayout.tsx` | Fetch template, trigger `warmUp()` (~12 lines) |

**Total: ~50 lines across 3 existing files. No new files.**

---

## Verification

1. Open app, navigate to any project (Brainstorm page)
2. Check devtools Network tab - `/templates/default` fetched
3. Check devtools Console - npm install running in background (if DEBUG enabled)
4. Wait for install to complete (~15-20s first time)
5. Navigate to Website page
6. Files mount, dev server starts **immediately** (no npm install wait)
7. Verify preview loads correctly

### Edge Cases to Test
- **Warmup in-flight**: Navigate to Website while npm install is still running → should wait for it
- **Warmup failed**: Simulate network error → should fall back to normal install
- **Mount overlay**: Verify real files completely replace skeleton (not merge)
