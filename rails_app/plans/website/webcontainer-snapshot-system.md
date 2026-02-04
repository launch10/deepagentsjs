# WebContainer Snapshot System

## Overview

The WebContainer snapshot system pre-installs npm dependencies into a binary snapshot, reducing website preview startup time from ~60 seconds to ~3.5 seconds.

**Before:** User waits for WebContainer boot → npm install → Vite start (~60s)
**After:** User waits for snapshot mount → Vite start (~3.5s)

## How It Works

### 1. Snapshot Generation (`scripts/generate-webcontainer-snapshot.ts`)

Generates a binary snapshot containing:

- Pre-installed `node_modules/` with all dependencies
- Config files copied from `templates/default/` (vite.config.ts, tailwind.config.ts, etc.)
- Minimal placeholder source files

```bash
# Generate snapshot (requires ~8GB memory for large dependency trees)
NODE_OPTIONS="--max-old-space-size=8192" pnpm run webcontainer:snapshot
```

Output: `public/webcontainer-snapshot.bin` (~111MB)

### 2. WebContainerManager (`app/javascript/frontend/lib/webcontainer/manager.ts`)

Singleton that manages WebContainer lifecycle with eager warmup:

```
warmup() - Called early (login, dashboard)
├── Boot WebContainer
├── Fetch and mount snapshot (has node_modules)
└── Start Vite dev server

loadProject(files) - Called when viewing website
├── Mount project files (overwrites snapshot placeholders)
├── Check for missing deps → npm install if needed
└── Return preview URL (Vite already running)
```

The key optimization: Vite starts during warmup while the user is doing other things. By the time they view the website, everything is ready.

### 3. File Mounting Order

1. Snapshot mounts first (node_modules + template configs)
2. Project files mount second (overwrite configs and source files)
3. Vite HMR picks up source file changes

**Important:** Snapshot config files must match the template's configs to avoid issues. We copy real files from `templates/default/`, not hardcoded versions.

## Dependencies

### Curated Package List (~45 deps)

The snapshot includes a curated set of dependencies that cover most landing page needs:

**Core:**

- react, react-dom, react-router-dom

**UI Components (all Radix UI primitives):**

- @radix-ui/react-accordion, alert-dialog, avatar, checkbox, dialog, dropdown-menu, etc.

**Styling:**

- tailwindcss, tailwindcss-animate, clsx, tailwind-merge, class-variance-authority

**Icons & Toasts:**

- lucide-react, sonner

**Build Tools:**

- vite, @vitejs/plugin-react, typescript, postcss, autoprefixer

### Removed Dependencies

These were removed to reduce snapshot size:

- `eslint` - Not needed at runtime
- `posthog-js` - Analytics, add per-project if needed
- `recharts` - Data viz rarely needed in landing pages
- `@tanstack/react-query` - Not needed for static pages
- `react-hook-form`, `zod` - Basic forms work with React state
- `cmdk`, `vaul` - Niche components

### WASM Overrides

WebContainer can't run native binaries. The snapshot's package.json includes:

```json
{
  "overrides": {
    "rollup": "npm:@rollup/wasm-node",
    "esbuild": "npm:esbuild-wasm"
  }
}
```

### Plugin Choice

We use `@vitejs/plugin-react` (Babel) instead of `@vitejs/plugin-react-swc` because SWC requires native binaries.

## Key Files

| File                                                  | Purpose                                   |
| ----------------------------------------------------- | ----------------------------------------- |
| `scripts/generate-webcontainer-snapshot.ts`           | Generates the binary snapshot             |
| `app/javascript/frontend/lib/webcontainer/manager.ts` | Singleton manager with warmup/loadProject |
| `templates/default/package.json`                      | Curated dependencies for snapshot         |
| `templates/default/vite.config.ts`                    | Uses Babel plugin (not SWC)               |
| `templates/default/tailwind.config.ts`                | Full shadcn/ui color config               |
| `templates/default/src/index.css`                     | CSS variables for shadcn/ui               |
| `public/webcontainer-snapshot.bin`                    | Generated snapshot (gitignored)           |

## Regenerating the Snapshot

Regenerate when:

- `templates/default/package.json` dependencies change
- Config files change (vite, tailwind, postcss)
- Updating to new versions of core dependencies

```bash
cd rails_app
NODE_OPTIONS="--max-old-space-size=8192" pnpm run webcontainer:snapshot
```

---

# Production Considerations

## 1. CDN Deployment (Cloudflare R2)

The 111MB snapshot should be served from R2, not bundled with the Rails app.

**TODO:** Create `scripts/upload-snapshot-to-r2.ts`

- Upload to same R2 bucket as user assets
- Path: `snapshots/webcontainer-snapshot-{hash}.bin`

**TODO:** Update `WebContainerManager.fetchSnapshot()`

- Fetch from R2 URL in production
- URL passed via Inertia shared data or env var
- Fallback to `/webcontainer-snapshot.bin` in development

## 2. Cache Busting / Versioning

**TODO:** Add content hash to filename

- Generate: `webcontainer-snapshot-a1b2c3d4.bin`
- Create manifest file with current snapshot filename
- Update Rails to read manifest and pass URL to frontend

## 3. CI/CD Pipeline

**TODO:** Create `.github/workflows/webcontainer-snapshot.yml`

Trigger on changes to:

- `templates/default/package.json`
- `scripts/generate-webcontainer-snapshot.ts`

Steps:

1. Checkout repo
2. Setup Node with increased memory
3. Run `pnpm run webcontainer:snapshot`
4. Upload to R2
5. Update manifest/version reference
6. Commit manifest changes (or store in R2)

## 4. Monitoring

Consider tracking:

- Snapshot load times (via WebContainerManager logs)
- Cache hit rates on R2
- Fallback to npm install frequency (indicates missing deps)

## 5. Snapshot Size Optimization

Current: ~111MB

Potential optimizations if needed:

- Further dependency curation
- Compression (gzip/brotli) - check if WebContainer supports
- Split snapshots (core vs optional deps)

## 6. Failure Handling

Current fallback: If snapshot fetch fails, WebContainerManager falls back to `npm install`. This is slow but ensures the feature still works.

Consider:

- Retry logic for transient R2 failures
- Cached snapshot in localStorage/IndexedDB as secondary fallback
- User-facing loading states that explain the delay

---

# Development Workflow

## Local Development

1. Generate snapshot once: `pnpm run webcontainer:snapshot`
2. Snapshot served from `public/webcontainer-snapshot.bin`
3. Changes to template files require regenerating snapshot

## Testing Changes

1. Make changes to `templates/default/` or snapshot script
2. Regenerate: `pnpm run webcontainer:snapshot`
3. Hard refresh browser (Cmd+Shift+R) to clear cached snapshot
4. Navigate to website preview, verify it loads quickly
5. Check browser console for WebContainer logs

## Debugging

WebContainerManager logs to console in dev mode:

```
[WebContainer] Starting background warmup...
[WebContainer] Booted in 1234ms
[WebContainer] Snapshot found, mounting...
[WebContainer] Snapshot mounted in 567ms
[WebContainer] Starting Vite dev server...
[vite] VITE v5.4.1 ready in 890ms
[WebContainer] Vite ready on port 3000 in 1234ms
[WebContainer] Total warmup time: 3456ms
```

If you see "Snapshot not available, falling back to npm install", the snapshot isn't being served correctly.
