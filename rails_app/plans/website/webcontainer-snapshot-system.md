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

# Production Setup

## 1. CDN Deployment (Cloudflare R2) ✅

The snapshot is uploaded to R2 and served via CDN.

**Scripts:**

- `pnpm run webcontainer:snapshot` - Generate snapshot locally
- `pnpm run webcontainer:upload` - Upload to R2 with content hash

**Upload script:** `scripts/upload-snapshot-to-r2.ts`

- Computes SHA256 hash of snapshot
- Uploads to `{env}/snapshots/webcontainer-snapshot-{hash}.bin`
- Writes manifest to `public/webcontainer-snapshot-manifest.json`
- Sets cache headers: `public, max-age=31536000, immutable` (1 year, content-addressed)

**Required secrets for upload:**

```
CLOUDFLARE_R2_ENDPOINT
CLOUDFLARE_R2_ACCESS_KEY_ID
CLOUDFLARE_R2_SECRET_ACCESS_KEY
CLOUDFLARE_UPLOADS_BUCKET
CLOUDFLARE_ASSET_HOST
CLOUDFLARE_DEPLOY_ENV
```

## 2. Frontend Configuration ✅

**WebContainerManager** fetches from R2 in production via env var:

```bash
# In production .env:
VITE_WEBCONTAINER_SNAPSHOT_URL=https://uploads.launch10.ai/production/snapshots/webcontainer-snapshot-abc123.bin
```

In development, leave empty to use local `/webcontainer-snapshot.bin`.

## 3. CI/CD Pipeline ✅

**Workflow:** `.github/workflows/webcontainer-snapshot.yml`

Triggers on push to main when these files change:

- `rails_app/templates/default/package.json`
- `rails_app/scripts/generate-webcontainer-snapshot.ts`
- `rails_app/scripts/upload-snapshot-to-r2.ts`

Also supports manual trigger via `workflow_dispatch`.

**What it does:**

1. Checkout code
2. Setup pnpm and Node.js with 8GB memory
3. Generate snapshot
4. Upload to R2
5. Output manifest as GitHub Actions artifact

**After workflow runs:**

1. Check the workflow run for the new snapshot URL
2. Update `VITE_WEBCONTAINER_SNAPSHOT_URL` in production environment
3. Deploy to pick up the new URL

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

The snapshot is stored in Git LFS, so developers get it automatically:

```bash
git pull  # LFS downloads public/webcontainer-snapshot.bin
```

The local dev server serves from `public/webcontainer-snapshot.bin`.

**To regenerate locally** (only needed when updating dependencies):

```bash
pnpm run webcontainer:snapshot
```

**Note:** In production, the snapshot is served from R2 CDN via `VITE_WEBCONTAINER_SNAPSHOT_URL`. The LFS file is for local development convenience.

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

---

# Production Deployment Checklist

## First-Time Setup

### 1. Add GitHub Secrets

Add these secrets to the repository settings (Settings → Secrets and variables → Actions):

| Secret                            | Description     | Example                                         |
| --------------------------------- | --------------- | ----------------------------------------------- |
| `CLOUDFLARE_R2_ENDPOINT`          | R2 API endpoint | `https://<account_id>.r2.cloudflarestorage.com` |
| `CLOUDFLARE_R2_ACCESS_KEY_ID`     | R2 access key   | From Cloudflare dashboard                       |
| `CLOUDFLARE_R2_SECRET_ACCESS_KEY` | R2 secret key   | From Cloudflare dashboard                       |
| `CLOUDFLARE_UPLOADS_BUCKET`       | Bucket name     | `uploads`                                       |
| `CLOUDFLARE_ASSET_HOST`           | Public CDN URL  | `https://uploads.launch10.ai`                   |

### 2. Merge to Main

Merge the `webcontainer-fast` branch to `main`. This will:

- Trigger the GitHub Actions workflow
- Generate the snapshot (~2-3 min)
- Upload to R2
- Output the manifest with the new URL

### 3. Get Snapshot URL

After the workflow completes:

1. Go to Actions → WebContainer Snapshot → Latest run
2. Check the "Output snapshot URL" step or download the manifest artifact
3. Copy the URL from the manifest (looks like `https://uploads.launch10.ai/production/snapshots/webcontainer-snapshot-abc123def456.bin`)

### 4. Update Production Environment

Add to your production environment variables:

```bash
VITE_WEBCONTAINER_SNAPSHOT_URL=https://uploads.launch10.ai/production/snapshots/webcontainer-snapshot-abc123def456.bin
```

### 5. Deploy

Deploy the application. The WebContainerManager will now fetch the snapshot from R2.

## Updating the Snapshot

When template dependencies change:

1. Push changes to `templates/default/package.json` on `main`
2. Workflow auto-triggers → generates new snapshot → uploads to R2
3. Get new URL from workflow output
4. Update `VITE_WEBCONTAINER_SNAPSHOT_URL` in production
5. Redeploy

Or manually trigger: Actions → WebContainer Snapshot → Run workflow

## Rollback

To rollback to a previous snapshot:

1. Find the previous snapshot URL (check R2 bucket or workflow history)
2. Update `VITE_WEBCONTAINER_SNAPSHOT_URL` to the old URL
3. Redeploy

Old snapshots are retained in R2 (content-addressed, immutable cache headers).
