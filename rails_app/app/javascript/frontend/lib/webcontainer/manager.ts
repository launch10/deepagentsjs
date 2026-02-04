import { WebContainer } from "@webcontainer/api";
import type { FileSystemTree } from "@webcontainer/api";

export const WORK_DIR_NAME = "project";
export const WORK_DIR = `/home/${WORK_DIR_NAME}`;

/**
 * Dependencies included in the snapshot.
 * If a project has deps not in this list, we run npm install.
 * Keep in sync with scripts/generate-webcontainer-snapshot.ts CURATED_SNAPSHOT_PKG
 */
const SNAPSHOT_DEPS = new Set([
  // Core
  "react",
  "react-dom",
  "react-router-dom",

  // Icons
  "lucide-react",

  // Toasts
  "sonner",

  // Styling utilities
  "clsx",
  "tailwind-merge",
  "class-variance-authority",
  "tailwindcss-animate",

  // All Radix UI components
  "@radix-ui/react-accordion",
  "@radix-ui/react-alert-dialog",
  "@radix-ui/react-aspect-ratio",
  "@radix-ui/react-avatar",
  "@radix-ui/react-checkbox",
  "@radix-ui/react-collapsible",
  "@radix-ui/react-context-menu",
  "@radix-ui/react-dialog",
  "@radix-ui/react-dropdown-menu",
  "@radix-ui/react-hover-card",
  "@radix-ui/react-label",
  "@radix-ui/react-menubar",
  "@radix-ui/react-navigation-menu",
  "@radix-ui/react-popover",
  "@radix-ui/react-progress",
  "@radix-ui/react-radio-group",
  "@radix-ui/react-scroll-area",
  "@radix-ui/react-select",
  "@radix-ui/react-separator",
  "@radix-ui/react-slider",
  "@radix-ui/react-slot",
  "@radix-ui/react-switch",
  "@radix-ui/react-tabs",
  "@radix-ui/react-toast",
  "@radix-ui/react-toggle",
  "@radix-ui/react-toggle-group",
  "@radix-ui/react-tooltip",

  // Build tools (devDependencies)
  "vite",
  "@vitejs/plugin-react",
  "typescript",
  "tailwindcss",
  "postcss",
  "autoprefixer",
  "@tailwindcss/typography",
  "@types/react",
  "@types/react-dom",
  "@types/node",
]);

interface WarmupState {
  booted: boolean;
  depsInstalled: boolean;
  viteRunning: boolean;
  previewUrl: string | null;
}

type WarmupEventType = "state-change" | "log";

interface WarmupEvent {
  type: WarmupEventType;
  state?: WarmupState;
  message?: string;
}

type WarmupListener = (event: WarmupEvent) => void;

/**
 * Singleton manager for WebContainer with eager warmup support.
 *
 * This allows us to start the WebContainer and install dependencies
 * in the background while the user is doing other things (logging in,
 * working on brainstorm, etc.), so by the time they navigate to the
 * Website page, everything is already running.
 *
 * Key features:
 * - Idempotent warmup() - safe to call multiple times
 * - Binary snapshot support for fast dependency loading
 * - Event-based state updates for UI consumption
 * - loadProject() for mounting files after warmup
 */
class WebContainerManagerClass {
  private instance: WebContainer | null = null;
  private warmupPromise: Promise<void> | null = null;
  private listeners: Set<WarmupListener> = new Set();
  private state: WarmupState = {
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
  warmup(): Promise<void> {
    if (this.warmupPromise) {
      return this.warmupPromise;
    }

    // Don't run in SSR
    if (typeof window === "undefined") {
      return Promise.resolve();
    }

    this.warmupPromise = this.doWarmup();
    return this.warmupPromise;
  }

  private async doWarmup(): Promise<void> {
    const start = performance.now();
    this.log("[WebContainer] Starting background warmup...");

    try {
      // Step 1: Boot WebContainer
      this.log("[WebContainer] Booting...");
      this.instance = await WebContainer.boot({ workdirName: WORK_DIR_NAME });
      this.updateState({ booted: true });
      this.log(`[WebContainer] Booted in ${(performance.now() - start).toFixed(0)}ms`);

      // Step 2: Mount snapshot (if available) or run npm install
      const snapshotStart = performance.now();
      try {
        const snapshot = await this.fetchSnapshot();
        this.log("[WebContainer] Snapshot found, mounting...");
        await this.instance.mount(snapshot);
        this.updateState({ depsInstalled: true });
        this.log(
          `[WebContainer] Snapshot mounted in ${(performance.now() - snapshotStart).toFixed(0)}ms`
        );
      } catch {
        // Fallback to npm install if snapshot fails
        this.log("[WebContainer] Snapshot not available, falling back to npm install");
        await this.instance.mount(this.getBaseTemplate());

        const proc = await this.instance.spawn("npm", ["install"]);

        // Pipe output for debugging
        proc.output.pipeTo(
          new WritableStream({
            write: (chunk) => {
              const lines = chunk.split("\n");
              for (const line of lines) {
                if (line.trim()) {
                  this.log(`[npm-install] ${line}`);
                }
              }
            },
          })
        );

        const exitCode = await proc.exit;
        if (exitCode !== 0) {
          throw new Error(`npm install failed with code ${exitCode}`);
        }
        this.updateState({ depsInstalled: true });
        this.log(
          `[WebContainer] npm install complete in ${(performance.now() - snapshotStart).toFixed(0)}ms`
        );
      }

      // Step 3: Start Vite dev server
      const viteStart = performance.now();
      this.log("[WebContainer] Starting Vite dev server...");
      const devProc = await this.instance.spawn("npm", ["run", "dev"]);

      // Pipe dev server output
      devProc.output.pipeTo(
        new WritableStream({
          write: (chunk) => {
            const lines = chunk.split("\n");
            for (const line of lines) {
              if (line.trim()) {
                this.log(`[vite] ${line}`);
              }
            }
          },
        })
      );

      // Wait for Vite to be ready (port event)
      await new Promise<void>((resolve) => {
        this.instance!.on("port", (port, type, url) => {
          if (type === "open") {
            this.updateState({ previewUrl: url, viteRunning: true });
            this.log(
              `[WebContainer] Vite ready on port ${port} in ${(performance.now() - viteStart).toFixed(0)}ms`
            );
            this.log(`[WebContainer] Preview URL: ${url}`);
            resolve();
          }
        });
      });

      this.log(`[WebContainer] Total warmup time: ${(performance.now() - start).toFixed(0)}ms`);
    } catch (error) {
      this.log(`[WebContainer] Warmup failed: ${error}`);
      throw error;
    }
  }

  /**
   * Load a project's files into the warm container.
   * Returns preview URL immediately if container is warm.
   * If not warm yet, waits for warmup then loads.
   *
   * If the project has dependencies not in the snapshot, runs npm install.
   */
  async loadProject(files: FileSystemTree): Promise<string> {
    // Ensure warmup is complete
    await this.warmup();

    if (!this.instance) {
      throw new Error("WebContainer not initialized");
    }

    // Mount project files (this is fast - just file writes)
    this.log("[WebContainer] Mounting project files...");
    await this.instance.mount(files);
    this.log("[WebContainer] Project files mounted");

    // Check if project has dependencies not in the snapshot
    const missingDeps = await this.checkForMissingDeps();
    if (missingDeps.length > 0) {
      this.log(
        `[WebContainer] Project has ${missingDeps.length} deps not in snapshot: ${missingDeps.join(", ")}`
      );
      this.log("[WebContainer] Running npm install for missing deps...");
      const installStart = performance.now();
      const proc = await this.instance.spawn("npm", ["install"]);
      const exitCode = await proc.exit;
      if (exitCode !== 0) {
        this.log("[WebContainer] npm install failed, but continuing...");
      } else {
        this.log(
          `[WebContainer] npm install complete in ${(performance.now() - installStart).toFixed(0)}ms`
        );
      }
    }

    // Return the preview URL (Vite already running)
    if (!this.state.previewUrl) {
      throw new Error("Preview URL not available");
    }

    return this.state.previewUrl;
  }

  /**
   * Check if the mounted project has dependencies not in the snapshot.
   */
  private async checkForMissingDeps(): Promise<string[]> {
    if (!this.instance) return [];

    try {
      const pkgJson = await this.instance.fs.readFile("/package.json", "utf-8");
      const pkg = JSON.parse(pkgJson);
      const projectDeps = {
        ...pkg.dependencies,
        ...pkg.devDependencies,
      };

      const missing: string[] = [];
      for (const dep of Object.keys(projectDeps)) {
        if (!SNAPSHOT_DEPS.has(dep)) {
          missing.push(dep);
        }
      }
      return missing;
    } catch {
      // If we can't read package.json, assume no missing deps
      return [];
    }
  }

  /**
   * Get the WebContainer instance (waits for boot if needed)
   */
  async getInstance(): Promise<WebContainer> {
    await this.warmup();
    if (!this.instance) {
      throw new Error("WebContainer not initialized");
    }
    return this.instance;
  }

  /**
   * Check if container is already warm
   */
  isWarm(): boolean {
    return this.state.booted && this.state.depsInstalled && this.state.viteRunning;
  }

  /**
   * Check if warmup has started
   */
  isWarmupStarted(): boolean {
    return this.warmupPromise !== null;
  }

  /**
   * Get warmup progress for UI display
   */
  getState(): WarmupState {
    return { ...this.state };
  }

  /**
   * Subscribe to state changes
   */
  subscribe(listener: WarmupListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private updateState(partial: Partial<WarmupState>) {
    this.state = { ...this.state, ...partial };
    this.emit({ type: "state-change", state: this.state });
  }

  private log(message: string) {
    // eslint-disable-next-line no-console
    if (import.meta.env.DEV) console.log(message);
    this.emit({ type: "log", message });
  }

  private emit(event: WarmupEvent) {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (e) {
        console.error("[WebContainer] Listener error:", e);
      }
    }
  }

  private async fetchSnapshot(): Promise<Uint8Array> {
    // In production, fetch from R2 CDN. In development, use local file.
    const snapshotUrl =
      import.meta.env.VITE_WEBCONTAINER_SNAPSHOT_URL || "/webcontainer-snapshot.bin";

    this.log(`[WebContainer] Fetching snapshot from: ${snapshotUrl}`);
    const response = await fetch(snapshotUrl);
    if (!response.ok) {
      throw new Error(`Snapshot not found: ${response.status} ${response.statusText}`);
    }
    const buffer = await response.arrayBuffer();
    return new Uint8Array(buffer);
  }

  private getBaseTemplate(): FileSystemTree {
    return {
      "package.json": {
        file: {
          contents: JSON.stringify(
            {
              name: "landing-page",
              type: "module",
              scripts: {
                dev: "vite --port 3000 --host",
                build: "vite build",
              },
              dependencies: {
                react: "^18.3.1",
                "react-dom": "^18.3.1",
              },
              devDependencies: {
                vite: "^5.4.1",
                "@vitejs/plugin-react-swc": "^3.5.0",
                typescript: "^5.5.3",
                tailwindcss: "^3.4.11",
                postcss: "^8.4.47",
                autoprefixer: "^10.4.20",
                "@types/react": "^18.3.3",
                "@types/react-dom": "^18.3.0",
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
import react from '@vitejs/plugin-react-swc';

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
              },
              include: ["src"],
            },
            null,
            2
          ),
        },
      },
      index: {
        directory: {},
      },
      src: {
        directory: {},
      },
    };
  }
}

// Singleton instance - preserves across HMR
let instance: WebContainerManagerClass;

// Handle HMR preservation
if (import.meta.hot) {
  instance = import.meta.hot.data.webcontainerManager ?? new WebContainerManagerClass();
  import.meta.hot.data.webcontainerManager = instance;
} else {
  instance = new WebContainerManagerClass();
}

export const WebContainerManager = instance;
