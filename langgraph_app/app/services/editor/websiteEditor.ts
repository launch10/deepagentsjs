import { DatabaseSnapshotter } from "@services";
import { db, websites, websiteFiles, eq, and } from "@db";
import { FileExporter } from "./core/fileExporter";
import { WebsiteRunner } from "./core/websiteRunner";
import { ScenarioSaver } from "./scenarios";
import { watch, FSWatcher } from "chokidar";
import { readFileSync } from "fs";
import { join, relative } from "path";
import { exec } from "child_process";
import { promisify } from "util";
import { loadScenarioConfig, type ScenarioConfig } from "./scenarios";
import { ScenarioRunner } from "./scenarios";
import { withTimestamps } from "@db";
import { getLogger } from "@core";

const execAsync = promisify(exec);

export interface WebsiteEditorOptions {
  websiteName: string;
  snapshotName: string;
  autoOpen?: boolean;
  editor?: string;
  saveMode?: "snapshot" | "scenario";
  scenarioName?: string;
  existingScenario?: string; // For editing an existing scenario
}

export class WebsiteEditor implements AsyncDisposable {
  private websiteName: string;
  private snapshotName: string;
  private websiteId?: number;
  private outputDir?: string;
  private exporter?: FileExporter;
  private runner?: WebsiteRunner;
  private watcher?: FSWatcher;
  private autoOpen: boolean;
  private editor: string;
  private isRunning: boolean = false;
  private saveMode: "snapshot" | "scenario";
  private scenarioName?: string;
  private existingScenario?: string;
  private scenarioSaver?: ScenarioSaver;

  constructor(options: WebsiteEditorOptions) {
    this.websiteName = options.websiteName;
    this.snapshotName = options.snapshotName;
    this.autoOpen = options.autoOpen ?? true;
    this.editor = options.editor ?? "windsurf"; // Default to Windsurf
    this.saveMode = options.saveMode ?? "snapshot";
    this.scenarioName = options.scenarioName;
    this.existingScenario = options.existingScenario;
  }

  async [Symbol.asyncDispose](): Promise<void> {
    await this.cleanup();
  }

  /**
   * Start the interactive editing session
   */
  async start(): Promise<void> {
    const log = getLogger({ component: "WebsiteEditor" });
    log.info({ website: this.websiteName, snapshot: this.snapshotName, editor: this.editor }, "Starting editing session");

    try {
      // 1. Restore snapshot
      await this.restoreSnapshot();

      // 2. Get website ID (needed before applying scenario)
      await this.loadWebsiteId();

      // 3. If editing an existing scenario, apply its modifications first
      if (this.existingScenario) {
        log.info({ scenario: this.existingScenario }, "Applying existing scenario");
        await this.applyExistingScenario();
      }

      // 5. Export files to local directory
      await this.exportFiles();

      // 6. Start dev server
      await this.startDevServer();

      // 7. Set up file watcher
      await this.setupFileWatcher();

      // 8. Open editor if requested
      if (this.autoOpen) {
        await this.openEditor();
      }

      // 9. Set up signal handlers
      this.setupSignalHandlers();

      this.isRunning = true;

      log.info({
        devServer: this.runner?.getUrl(),
        localFiles: this.outputDir,
        saveMode: this.saveMode,
        scenario: this.saveMode === "scenario" ? this.scenarioName : undefined,
        existingScenario: this.existingScenario || undefined,
      }, "Editor is ready");

      // Keep the process alive
      await this.waitForShutdown();
    } catch (error) {
      log.error({ err: error }, "Failed to start editor");
      await this.cleanup();
      throw error;
    } finally {
      await this.cleanup();
    }
  }

  /**
   * Restore the snapshot
   */
  private async restoreSnapshot(): Promise<void> {
    const log = getLogger({ component: "WebsiteEditor" });
    log.info({ snapshot: this.snapshotName }, "Restoring snapshot");
    await DatabaseSnapshotter.restoreSnapshot(this.snapshotName);
    log.info({ snapshot: this.snapshotName }, "Snapshot restored");
  }

  /**
   * Apply scenario from an existing scenario
   */
  private async applyExistingScenario(): Promise<void> {
    if (!this.existingScenario) return;

    const log = getLogger({ component: "WebsiteEditor" });
    log.info({ scenario: this.existingScenario }, "Loading existing scenario");

    if (!this.scenarioName) {
      throw new Error("Scenario name is required when saving scenario");
    }
    this.scenarioSaver = new ScenarioSaver(
      this.websiteId!,
      this.websiteName,
      this.snapshotName,
      this.scenarioName
    );
    // Load before applying modifications, so we track changes vs the original
    // scenario. If we do this AFTER, we'll lose any existing modifications
    await this.scenarioSaver.loadOriginalFiles();

    // Create a ScenarioRunner to apply the modifications
    const runner = new ScenarioRunner({
      website: this.websiteName,
      scenario: this.existingScenario,
      snapshot: this.snapshotName,
      log: true,
    });

    // The runner will load the scenario and apply modifications
    // We only need to apply modifications, not run the full scenario
    await runner.setup();

    log.info({ scenario: this.existingScenario }, "Applied modifications from scenario");
  }

  /**
   * Load the website ID from the database
   */
  private async loadWebsiteId(): Promise<void> {
    const [site] = await db
      .select()
      .from(websites)
      .where(eq(websites.name, this.websiteName))
      .limit(1);

    if (!site) {
      throw new Error(`Website not found: ${this.websiteName}`);
    }

    this.websiteId = site.id;
    getLogger({ component: "WebsiteEditor" }).info({ websiteId: this.websiteId }, "Website loaded");
  }

  /**
   * Export files to local directory
   */
  private async exportFiles(): Promise<void> {
    const log = getLogger({ component: "WebsiteEditor" });
    log.info("Exporting website files");
    this.exporter = new FileExporter(this.websiteId!);
    this.outputDir = await this.exporter.export();
    log.info({ outputDir: this.outputDir }, "Files exported");
  }

  /**
   * Start the dev server
   */
  private async startDevServer(): Promise<void> {
    const log = getLogger({ component: "WebsiteEditor" });
    log.info("Starting development server");
    this.runner = new WebsiteRunner(this.outputDir!);
    await this.runner.install();
    await this.runner.start();
    log.info({ url: this.runner.getUrl() }, "Dev server running");
  }

  /**
   * Set up file watcher to sync changes back to database
   */
  private async setupFileWatcher(): Promise<void> {
    const log = getLogger({ component: "WebsiteEditor" });
    log.info("Setting up file watcher");

    const srcDir = join(this.outputDir!, "src");

    this.watcher = watch(srcDir, {
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: 500,
        pollInterval: 100,
      },
    });

    this.watcher.on("change", async (filePath: string) => {
      await this.handleFileChange(filePath);
    });

    this.watcher.on("add", async (filePath: string) => {
      await this.handleFileChange(filePath);
    });

    this.watcher.on("unlink", async (filePath: string) => {
      await this.handleFileDelete(filePath);
    });

    log.info({ srcDir }, "Watching for changes");
  }

  /**
   * Handle file changes and sync to database
   */
  private async handleFileChange(filePath: string): Promise<void> {
    const log = getLogger({ component: "WebsiteEditor" });
    try {
      const relativePath = relative(this.outputDir!, filePath);
      log.info({ path: relativePath }, "File changed");

      // Read the new content
      const content = readFileSync(filePath, "utf-8");

      // Check if file exists in database
      const [existingFile] = await db
        .select()
        .from(websiteFiles)
        .where(
          and(eq(websiteFiles.websiteId, this.websiteId!), eq(websiteFiles.path, relativePath))
        )
        .limit(1);

      if (existingFile) {
        // Update existing file
        await db.update(websiteFiles).set({ content }).where(eq(websiteFiles.id, existingFile.id));
        log.debug({ path: relativePath }, "Updated in database");
      } else {
        // Create new file
        await db.insert(websiteFiles).values(
          withTimestamps({
            websiteId: this.websiteId!,
            path: relativePath,
            content,
          })
        );
        log.debug({ path: relativePath }, "Added to database");
      }
    } catch (error) {
      log.error({ err: error }, "Failed to sync file");
    }
  }

  /**
   * Handle file deletion and remove from database
   */
  private async handleFileDelete(filePath: string): Promise<void> {
    const log = getLogger({ component: "WebsiteEditor" });
    try {
      const relativePath = relative(this.outputDir!, filePath);
      log.info({ path: relativePath }, "File deleted");

      // Delete the file from the database
      const result = await db
        .delete(websiteFiles)
        .where(
          and(eq(websiteFiles.websiteId, this.websiteId!), eq(websiteFiles.path, relativePath))
        );

      log.debug({ path: relativePath }, "Removed from database");

      // Track deletion in scenario saver if in scenario mode
      if (this.scenarioSaver) {
        // Track that this file was deleted by setting empty content
        this.scenarioSaver.trackModifiedFile(relativePath, "");
      }
    } catch (error) {
      log.error({ err: error }, "Failed to delete file");
    }
  }

  /**
   * Open the editor
   */
  private async openEditor(): Promise<void> {
    const log = getLogger({ component: "WebsiteEditor" });
    log.info({ editor: this.editor }, "Opening editor");

    try {
      // Map common editor names to their CLI commands
      const editorCommands: Record<string, string> = {
        windsurf: "windsurf",
        code: "code",
        vscode: "code",
        cursor: "cursor",
        sublime: "subl",
        atom: "atom",
        vim: "vim",
        nvim: "nvim",
        emacs: "emacs",
      };

      const command = editorCommands[this.editor.toLowerCase()] || this.editor;

      // Open the output directory in the editor
      await execAsync(`${command} "${this.outputDir}"`);
      log.info("Editor opened");
    } catch (error) {
      log.warn({ outputDir: this.outputDir }, "Could not open editor automatically, please open manually");
    }
  }

  /**
   * Set up signal handlers for graceful shutdown
   */
  private setupSignalHandlers(): void {
    const shutdown = async (signal: string) => {
      if (!this.isRunning) return;

      getLogger({ component: "WebsiteEditor" }).info({ signal, saveMode: this.saveMode }, "Received signal, saving and shutting down");
      await this.saveAndCleanup();
      process.exit(0);
    };

    process.on("SIGINT", () => shutdown("SIGINT"));
    process.on("SIGTERM", () => shutdown("SIGTERM"));
    process.on("SIGHUP", () => shutdown("SIGHUP"));
  }

  /**
   * Wait for shutdown signal
   */
  private async waitForShutdown(): Promise<void> {
    return new Promise(() => {
      // This promise never resolves naturally - it waits for signal handlers
    });
  }

  /**
   * Save snapshot and cleanup
   */
  private async saveAndCleanup(): Promise<void> {
    this.isRunning = false;
    const log = getLogger({ component: "WebsiteEditor" });

    try {
      log.debug({ saveMode: this.saveMode }, "Save mode");
      if (this.saveMode === "snapshot") {
        // Save the current state as a snapshot
        log.info({ snapshot: this.snapshotName }, "Saving snapshot");
        await DatabaseSnapshotter.createSnapshot(this.snapshotName);
        log.info({ snapshot: this.snapshotName }, "Snapshot saved");
      } else if (this.saveMode === "scenario" && this.scenarioSaver) {
        // Save scenario to filesystem
        log.info({ scenario: this.scenarioName }, "Saving scenario");
        // Include information about the original scenario if editing
        const description = this.existingScenario
          ? `Scenario edited from ${this.existingScenario}`
          : `Scenario created from editing session`;
        await this.scenarioSaver.save(description);
        log.info({ scenario: this.scenarioName }, "Scenario saved");
      }
    } catch (error) {
      log.error({ err: error }, "Failed to save");
    }

    await this.cleanup();
  }

  /**
   * Cleanup resources
   */
  private async cleanup(): Promise<void> {
    const log = getLogger({ component: "WebsiteEditor" });
    log.info("Cleaning up");

    // Stop file watcher
    if (this.watcher) {
      await this.watcher.close();
      log.debug("File watcher stopped");
    }

    // Stop dev server
    if (this.runner) {
      await this.runner[Symbol.asyncDispose]();
      log.debug("Dev server stopped");
    }

    // Clean up temporary directory
    if (this.exporter) {
      await this.exporter[Symbol.asyncDispose]();
      log.debug("Temporary files cleaned up");
    }

    log.info("Cleanup complete");
  }
}

/**
 * Convenience function to start an editing session
 */
export async function startWebsiteEditor(options: WebsiteEditorOptions): Promise<void> {
  await using editor = new WebsiteEditor(options);
  await editor.start();
}
