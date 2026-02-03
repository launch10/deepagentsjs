# Eager Warmup + Binary Snapshots

## IMPORTANT

This is the most important work we will ever do for our business. Both for the customer and for our team. We're a scrappy startup, and our team is burning crazy cycles waiting for webcontainers to build DURING the development process. We need this work to save the business. Be in founder mode. Be scrappy. Think how we would think. Let's get it done.

## The Insight

The user never needs to see the 60-second wait. We can do it invisibly in the background while they're doing other things (logging in, browsing dashboard, working on brainstorm).

## Strategy

### Part A: Eager Warmup

Start WebContainer + npm install the moment the user logs in. By the time they navigate to Website.tsx, everything is already running.

**When to trigger warmup:**

- On login (user entering credentials = 5-10s of warmup time)
- On dashboard load (user browsing projects = more time)
- On project creation (user filling out brainstorm = 5-10 minutes!)
- On brainstorm completion (guaranteed warmup before Website step)

### Part B: Binary Snapshots

Use `@webcontainer/snapshot` to pre-generate a binary snapshot that includes node_modules. This eliminates npm install entirely.

**How it works:**

1. Generate snapshot once (in CI or manually)
2. Host snapshot file (public directory or CDN)
3. On warmup, fetch and mount snapshot instead of npm install
4. Vite starts immediately - deps are already installed

## Implementation

### WebContainerManager (Singleton)

```typescript
// rails_app/app/javascript/frontend/lib/webcontainer/manager.ts

import { WebContainer } from "@webcontainer/api";
import type { FileSystemTree } from "@webcontainer/api";

interface WarmupState {
  booted: boolean;
  depsInstalled: boolean;
  viteRunning: boolean;
  previewUrl: string | null;
}

class WebContainerManager {
  private static instance: WebContainer | null = null;
  private static warmupPromise: Promise<void> | null = null;
  private static state: WarmupState = {
    booted: false,
    depsInstalled: false,
    viteRunning: false,
    previewUrl: null,
  };

  /**
   * Start warming up WebContainer in background.
   * Call this EARLY - on app init, dashboard load, etc.
   * Safe to call multiple times (idempotent).
   */
  static warmup(): Promise<void> {
    if (this.warmupPromise) {
      return this.warmupPromise;
    }

    this.warmupPromise = this.doWarmup();
    return this.warmupPromise;
  }

  private static async doWarmup(): Promise<void> {
    const start = performance.now();
    console.log("[WebContainer] Starting background warmup...");

    // Step 1: Boot WebContainer
    this.instance = await WebContainer.boot({ workdirName: "project" });
    this.state.booted = true;
    console.log(`[WebContainer] Booted in ${(performance.now() - start).toFixed(0)}ms`);

    // Step 2: Mount snapshot (if available) or run npm install
    const snapshotStart = performance.now();
    try {
      const snapshot = await this.fetchSnapshot();
      await this.instance.mount(snapshot);
      this.state.depsInstalled = true;
      console.log(
        `[WebContainer] Snapshot mounted in ${(performance.now() - snapshotStart).toFixed(0)}ms`
      );
    } catch (e) {
      // Fallback to npm install if snapshot fails
      console.log("[WebContainer] Snapshot not available, falling back to npm install");
      await this.instance.mount(this.getBaseTemplate());
      const proc = await this.instance.spawn("npm", ["install"]);
      const exitCode = await proc.exit;
      if (exitCode !== 0) {
        throw new Error(`npm install failed with code ${exitCode}`);
      }
      this.state.depsInstalled = true;
      console.log(
        `[WebContainer] npm install complete in ${(performance.now() - snapshotStart).toFixed(0)}ms`
      );
    }

    // Step 3: Start Vite dev server
    const viteStart = performance.now();
    await this.instance.spawn("npm", ["run", "dev"]);

    // Wait for Vite to be ready (port event)
    await new Promise<void>((resolve) => {
      this.instance!.on("port", (port, type, url) => {
        if (type === "open") {
          this.state.previewUrl = url;
          this.state.viteRunning = true;
          console.log(
            `[WebContainer] Vite ready in ${(performance.now() - viteStart).toFixed(0)}ms`
          );
          resolve();
        }
      });
    });

    console.log(`[WebContainer] Total warmup time: ${(performance.now() - start).toFixed(0)}ms`);
  }

  /**
   * Load a project's files into the warm container.
   * Returns preview URL immediately if container is warm.
   */
  static async loadProject(files: FileSystemTree): Promise<string> {
    // Ensure warmup is complete
    await this.warmup();

    // Mount project files (this is fast - just file writes)
    await this.instance!.mount(files);

    // Return the preview URL (Vite already running)
    return this.state.previewUrl!;
  }

  /**
   * Check if container is already warm
   */
  static isWarm(): boolean {
    return this.state.booted && this.state.depsInstalled && this.state.viteRunning;
  }

  /**
   * Get warmup progress for UI display
   */
  static getState(): WarmupState {
    return { ...this.state };
  }

  private static async fetchSnapshot(): Promise<Uint8Array> {
    const response = await fetch("/webcontainer-snapshot.bin");
    if (!response.ok) {
      throw new Error("Snapshot not found");
    }
    const buffer = await response.arrayBuffer();
    return new Uint8Array(buffer);
  }

  private static getBaseTemplate(): FileSystemTree {
    return {
      "package.json": {
        file: {
          contents: JSON.stringify({
            name: "landing-page",
            type: "module",
            scripts: {
              dev: "vite --port 3000 --host",
            },
            dependencies: {
              react: "^18.2.0",
              "react-dom": "^18.2.0",
            },
            devDependencies: {
              vite: "^5.0.0",
              "@vitejs/plugin-react": "^4.0.0",
            },
          }),
        },
      },
      "vite.config.ts": {
        file: {
          contents: `
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({ plugins: [react()] });
          `.trim(),
        },
      },
    };
  }
}

export { WebContainerManager };
```

### Trigger Warmup on App Init

```typescript
// rails_app/app/javascript/frontend/App.tsx or layouts/ApplicationLayout.tsx

import { useEffect } from 'react';
import { WebContainerManager } from '@lib/webcontainer/manager';

export function ApplicationLayout({ children }) {
  useEffect(() => {
    // Start warming up WebContainer immediately
    // This runs in background while user browses
    WebContainerManager.warmup().catch((e) => {
      console.error('[WebContainer] Warmup failed:', e);
    });
  }, []);

  return <>{children}</>;
}
```

### Updated useWebsitePreview

```typescript
// rails_app/app/javascript/frontend/hooks/website/useWebsitePreview.ts

import { useState, useEffect } from "react";
import { WebContainerManager } from "@lib/webcontainer/manager";
import { convertFileMapToFileSystemTree } from "@lib/webcontainer/file-utils";
import { useWebsiteChatState } from "./useWebsiteChat";

export function useWebsitePreview() {
  const files = useWebsiteChatState("files");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!files || Object.keys(files).length === 0) {
      return;
    }

    async function loadPreview() {
      try {
        setStatus("loading");

        // This is INSTANT if warmup already completed
        // If not, it waits for warmup then loads
        const fileTree = convertFileMapToFileSystemTree(files);
        const url = await WebContainerManager.loadProject(fileTree);

        setPreviewUrl(url);
        setStatus("ready");
      } catch (e) {
        console.error("Failed to load preview:", e);
        setError(e instanceof Error ? e.message : "Unknown error");
        setStatus("error");
      }
    }

    loadPreview();
  }, [files]);

  return { previewUrl, status, error };
}
```

## Generating the Snapshot

```typescript
// rails_app/scripts/generate-webcontainer-snapshot.ts

import { snapshot } from "@webcontainer/snapshot";
import { writeFileSync } from "fs";
import { join } from "path";

const BASE_TEMPLATE = {
  "package.json": {
    file: {
      contents: JSON.stringify(
        {
          name: "landing-page-template",
          type: "module",
          scripts: {
            dev: "vite --port 3000 --host",
            build: "vite build",
          },
          dependencies: {
            react: "^18.2.0",
            "react-dom": "^18.2.0",
            // Add all common dependencies your landing pages use
            "@radix-ui/react-accordion": "^1.1.2",
            "@radix-ui/react-dialog": "^1.0.5",
            "@radix-ui/react-dropdown-menu": "^2.0.6",
            "@radix-ui/react-tabs": "^1.0.4",
            "lucide-react": "^0.294.0",
            "class-variance-authority": "^0.7.0",
            clsx: "^2.0.0",
            "tailwind-merge": "^2.1.0",
          },
          devDependencies: {
            vite: "^5.0.10",
            "@vitejs/plugin-react": "^4.2.1",
            typescript: "^5.3.3",
            tailwindcss: "^3.4.0",
            postcss: "^8.4.32",
            autoprefixer: "^10.4.16",
            "@types/react": "^18.2.45",
            "@types/react-dom": "^18.2.18",
          },
        },
        null,
        2
      ),
    },
  },
  "vite.config.ts": {
    file: {
      contents: `
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    host: true,
  },
});
      `.trim(),
    },
  },
  "tailwind.config.js": {
    file: {
      contents: `
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: { extend: {} },
  plugins: [],
};
      `.trim(),
    },
  },
  "postcss.config.js": {
    file: {
      contents: `
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
      `.trim(),
    },
  },
  "tsconfig.json": {
    file: {
      contents: JSON.stringify(
        {
          compilerOptions: {
            target: "ES2020",
            useDefineForClassFields: true,
            lib: ["ES2020", "DOM", "DOM.Iterable"],
            module: "ESNext",
            skipLibCheck: true,
            moduleResolution: "bundler",
            allowImportingTsExtensions: true,
            resolveJsonModule: true,
            isolatedModules: true,
            noEmit: true,
            jsx: "react-jsx",
            strict: true,
            noUnusedLocals: true,
            noUnusedParameters: true,
            noFallthroughCasesInSwitch: true,
          },
          include: ["src"],
        },
        null,
        2
      ),
    },
  },
};

async function generateSnapshot() {
  console.log("Generating WebContainer snapshot...");
  const start = Date.now();

  const snapshotBuffer = await snapshot(BASE_TEMPLATE);

  const outputPath = join(process.cwd(), "public", "webcontainer-snapshot.bin");
  writeFileSync(outputPath, Buffer.from(snapshotBuffer));

  const sizeMB = (snapshotBuffer.byteLength / 1024 / 1024).toFixed(2);
  console.log(`Snapshot generated in ${Date.now() - start}ms`);
  console.log(`Output: ${outputPath}`);
  console.log(`Size: ${sizeMB} MB`);
}

generateSnapshot().catch(console.error);
```

## Expected Performance

| Stage             | Without Snapshot | With Snapshot |
| ----------------- | ---------------- | ------------- |
| Boot WebContainer | 5s               | 5s            |
| npm install       | 50s              | 0s (skipped!) |
| Mount snapshot    | N/A              | 2s            |
| Start Vite        | 4s               | 4s            |
| **Total warmup**  | **59s**          | **11s**       |

With eager warmup (started on login), user-perceived wait = **<1 second**.

## Verification

1. Add `console.time` calls to track each stage
2. Open browser DevTools → Network tab
3. Login to app
4. Check console for warmup progress messages
5. Navigate to Website page
6. Should see "ready" status almost immediately

## CI Integration

Add to GitHub Actions or similar:

```yaml
- name: Generate WebContainer Snapshot
  run: |
    cd rails_app
    pnpm install
    pnpm exec ts-node scripts/generate-webcontainer-snapshot.ts

- name: Upload Snapshot
  uses: actions/upload-artifact@v4
  with:
    name: webcontainer-snapshot
    path: rails_app/public/webcontainer-snapshot.bin
```

Regenerate snapshot whenever `package.json` dependencies change.
