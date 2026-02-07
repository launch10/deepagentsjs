# WebContainers

WebContainers provide an in-browser Node.js environment for live-previewing websites during editing. A singleton `WebContainerManager` boots eagerly at login, mounts a pre-built snapshot with all dependencies, and receives file updates from Langgraph via SSE streaming. The preview renders in a sandboxed iframe running Vite's dev server.

## How It Works

```
Login (SiteLayout)
       │
       │ eager warmup
       ▼
WebContainerManager
  1. Boot container
  2. Fetch & mount snapshot (pre-installed node_modules)
  3. Start Vite dev server → previewUrl
       │
       │ files arrive from Langgraph stream
       ▼
useWebsitePreview hook
  1. Convert FileMap → FileSystemTree
  2. loadProject(fileTree) → mount into container
  3. Vite hot-reloads → iframe updates
       │
       ▼
WebsitePreview component
  <iframe src={previewUrl} sandbox="allow-scripts allow-same-origin..." />
```

## Snapshot System

The snapshot is a pre-built binary containing all node_modules, eliminating the ~60s `npm install` at runtime.

**Generation** (`scripts/generate-webcontainer-snapshot.ts`):
1. Reads `templates/default/package.json` and config files
2. Swaps native modules for WASM equivalents (`esbuild → esbuild-wasm`, `rollup → @rollup/wasm-node`)
3. Runs `npm install` (not pnpm — symlinks can't be serialized)
4. Removes `node_modules/.bin` symlinks
5. Serializes to binary: `webcontainer-snapshot.bin`

**Deployment**:
- Local: `/public/webcontainer-snapshot.bin`
- Production: Uploaded to Cloudflare R2 with content-hash filename
- Manifest: `/public/webcontainer-snapshot-manifest.json` tracks URL
- Fetched via `VITE_WEBCONTAINER_SNAPSHOT_URL` env var

**Result**: Startup drops from ~60s → ~10s (boot + mount + Vite start).

## File Flow

```
Langgraph (AI edits)
       │
       │ writes to website_files table
       ▼
syncFilesNode (reads code_files view)
       │
       │ emits FileMap via SSE stream
       ▼
Frontend (useWebsiteChatState("files"))
       │
       │ convertFileMapToFileSystemTree()
       ▼
WebContainerManager.loadProject(fileTree)
       │
       │ instance.mount(files)
       ▼
Vite hot-reloads → iframe updates
```

**FileMap format** (from Langgraph state):
```typescript
{
  "/src/pages/IndexPage.tsx": {
    content: "import React from 'react'...",
    created_at: "2026-01-15T...",
    modified_at: "2026-01-15T..."
  }
}
```

**Optimization**: `useWebsitePreview` tracks previously mounted files via `mountedFilesRef` and skips re-mounting if content hasn't changed.

## Boot Stages

The manager tracks warmup progress for the UI:

| Stage | State Field | What Happens |
|-------|-------------|--------------|
| 1 | `booted` | `WebContainer.boot({ workdirName: "project" })` |
| 2 | `depsInstalled` | Snapshot fetched and mounted |
| 3 | `viteRunning` | `npm run dev` spawned, port detected |
| 4 | `previewUrl` | Dev server URL available for iframe |

`WebsiteLoader` component shows progress steps. `WebsitePreview` renders the iframe once `previewUrl` is available.

## Key Files Index

| File | Purpose |
|------|---------|
| `rails_app/app/javascript/frontend/lib/webcontainer/manager.ts` | Singleton manager (boot, mount, Vite server) |
| `rails_app/app/javascript/frontend/lib/webcontainer/file-utils.ts` | FileMap → FileSystemTree conversion |
| `rails_app/app/javascript/frontend/lib/webcontainer/types.ts` | Type definitions |
| `rails_app/app/javascript/frontend/hooks/website/useWebsitePreview.ts` | Hook: files → container → preview URL |
| `rails_app/app/javascript/frontend/components/website/preview/WebsitePreview.tsx` | Preview iframe + loader UI |
| `rails_app/app/javascript/frontend/layouts/site-layout.tsx` | Eager warmup trigger at login |
| `rails_app/scripts/generate-webcontainer-snapshot.ts` | Snapshot generation script |
| `rails_app/scripts/upload-snapshot-to-r2.ts` | Upload snapshot to Cloudflare R2 |
| `langgraph_app/app/nodes/website/syncFiles.ts` | Reads code_files → FileMap in graph state |
| `langgraph_app/app/annotation/websiteAnnotation.ts` | `files: FileMap` state definition |

## Gotchas

- **WASM overrides required**: WebContainers can't run native binaries. `esbuild` and `rollup` must be swapped for their WASM equivalents in the snapshot.
- **npm, not pnpm**: Snapshot generation uses npm because pnpm creates symlinks that can't be serialized into the binary snapshot format.
- **Eager warmup**: The container starts booting at login (in `SiteLayout`), not when the user navigates to the website builder. This masks the boot time.
- **HMR persistence**: Manager state persists across Vite HMR via `import.meta.hot.data` to avoid re-booting during development.
- **Missing dependencies**: If the AI adds a new package to `package.json` that's not in the snapshot, the manager detects the diff and runs `npm install` inside the container.
- **Static site fallback**: If a project lacks `package.json`, a minimal one is generated with the `serve` package for static file serving.
