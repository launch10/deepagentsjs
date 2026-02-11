import { WebContainer } from "@webcontainer/api";
import type { FileSystemTree, PreviewMessage } from "@webcontainer/api";
import type { Website } from "@shared";
import { processViteChunk, parsePreviewMessage } from "./errorParsing";

type ConsoleError = Website.Errors.ConsoleError;

export const WORK_DIR_NAME = "project";
export const WORK_DIR = `/home/${WORK_DIR_NAME}`;

interface WarmupState {
  booted: boolean;
  depsInstalled: boolean;
  viteRunning: boolean;
  previewUrl: string | null;
  consoleErrors: ConsoleError[];
}

type WarmupEventType = "state-change" | "log" | "console-errors";

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
  private snapshotDeps: Set<string> = new Set();
  private state: WarmupState = {
    booted: false,
    depsInstalled: false,
    viteRunning: false,
    previewUrl: null,
    consoleErrors: [],
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
      this.instance = await WebContainer.boot({
        workdirName: WORK_DIR_NAME,
        forwardPreviewErrors: true,
      });
      this.updateState({ booted: true });

      // Listen for runtime errors from preview iframes
      this.instance.on("preview-message", (msg: PreviewMessage) => {
        this.addConsoleError(parsePreviewMessage(msg));
      });
      this.log(`[WebContainer] Booted in ${(performance.now() - start).toFixed(0)}ms`);

      // Step 2: Mount snapshot (required - contains pre-installed node_modules)
      const snapshotStart = performance.now();
      const snapshot = await this.fetchSnapshot();
      this.log("[WebContainer] Snapshot found, mounting...");
      await this.instance.mount(snapshot);

      // Read snapshot's package.json to know which deps are pre-installed
      await this.loadSnapshotDeps();

      this.updateState({ depsInstalled: true });
      this.log(
        `[WebContainer] Snapshot mounted in ${(performance.now() - snapshotStart).toFixed(0)}ms`
      );

      // Step 3: Start Vite dev server
      const viteStart = performance.now();
      this.log("[WebContainer] Starting Vite dev server...");
      const devProc = await this.instance.spawn("npm", ["run", "dev"]);

      // Pipe dev server output and parse for build errors
      devProc.output.pipeTo(
        new WritableStream({
          write: (chunk) => {
            const lines = chunk.split("\n");
            for (const line of lines) {
              if (line.trim()) {
                this.log(`[vite] ${line}`);
              }
            }

            // Parse chunk for build errors AND detect successful rebuilds.
            // When Vite reports HMR update / page reload, stale errors from
            // transient build failures (e.g. missing imports during incremental
            // file writes) are cleared.
            const result = processViteChunk(chunk);
            for (const error of result.errors) {
              this.addConsoleError(error);
            }
            if (this.state.consoleErrors.length > 0 && result.clearsErrors) {
              this.clearConsoleErrors();
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

    // Clear previous errors before mounting new files
    this.clearConsoleErrors();

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
   * Read the snapshot's package.json to know which deps are pre-installed.
   * Called after mounting the snapshot.
   */
  private async loadSnapshotDeps(): Promise<void> {
    if (!this.instance) return;

    try {
      const pkgJson = await this.instance.fs.readFile("/package.json", "utf-8");
      const pkg = JSON.parse(pkgJson);
      const allDeps = {
        ...pkg.dependencies,
        ...pkg.devDependencies,
      };

      this.snapshotDeps = new Set(Object.keys(allDeps));
      this.log(`[WebContainer] Snapshot has ${this.snapshotDeps.size} pre-installed deps`);
    } catch (e) {
      this.log(`[WebContainer] Could not read snapshot package.json: ${e}`);
    }
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
        if (!this.snapshotDeps.has(dep)) {
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
   * Get current console errors (build + runtime).
   * Maps 1:1 to WebsiteAnnotation.consoleErrors on the backend.
   */
  getConsoleErrors(): ConsoleError[] {
    return [...this.state.consoleErrors];
  }

  /**
   * Clear console errors — called when new files are mounted (new attempt).
   */
  clearConsoleErrors(): void {
    this.state = { ...this.state, consoleErrors: [] };
    this.emit({ type: "console-errors", state: this.state });
  }

  /**
   * Subscribe to state changes
   */
  subscribe(listener: WarmupListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  addConsoleError(error: ConsoleError) {
    this.state = {
      ...this.state,
      consoleErrors: [...this.state.consoleErrors, error],
    };
    if (import.meta.env.DEV) {
      console.warn(`[WebContainer] Build error:`, error.message, error.file ? `(${error.file})` : "");
    }
    this.emit({ type: "console-errors", state: this.state });
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

// Expose for e2e testing — allows injecting errors without WebContainer boot
if (typeof window !== "undefined") {
  (window as any).__WebContainerManager = instance;
}
