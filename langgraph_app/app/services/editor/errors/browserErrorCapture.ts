import { type BrowserContext, type Page, type ConsoleMessage } from "playwright";
import { type ConsoleError } from "@types";
import { browserPool } from "./browserPool";
import { getLogger } from "@core";

/**
 * Captures browser console errors using Playwright
 */
export class BrowserErrorCapture {
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private errors: ConsoleError[] = [];
  private viteOverlayErrors: ConsoleError[] = [];
  private url: string;

  constructor(url: string) {
    this.url = url;
  }

  /**
   * Get Vite error overlay errors (build/compile errors shown in the overlay)
   */
  getViteOverlayErrors(): ConsoleError[] {
    return this.viteOverlayErrors;
  }

  /**
   * Start the browser and navigate to the URL
   */
  async start(): Promise<void> {
    const log = getLogger({ component: "BrowserErrorCapture" });
    const t0 = Date.now();
    const elapsed = () => Date.now() - t0;

    log.info({ url: this.url }, "start() BEGIN");

    // Get context from pool (waits if at capacity)
    this.context = await browserPool.getContext();
    log.info({ elapsedMs: elapsed() }, "getContext acquired");

    // Create page
    this.page = await this.context.newPage();
    log.info({ elapsedMs: elapsed() }, "page created");

    // === SMOKING GUN LISTENERS: detect page/context close or crash ===
    this.page.on("close", () => {
      log.warn({ elapsedMs: elapsed() }, "PAGE CLOSED EVENT FIRED");
    });
    this.page.on("crash", () => {
      log.error({ elapsedMs: elapsed() }, "PAGE CRASH EVENT FIRED");
    });

    // Set up console listener before navigation
    this.page.on("console", (msg: ConsoleMessage) => {
      if (msg.type() === "error") {
        this.captureConsoleError(msg, "error");
      } else if (msg.type() === "warning") {
        this.captureConsoleError(msg, "warning");
      }
    });

    // Set up page error listener (for uncaught exceptions)
    this.page.on("pageerror", (error: Error) => {
      this.errors.push({
        type: "error",
        message: error.message,
        stack: error.stack,
        timestamp: new Date(),
      });
      log.debug({ error: error.message }, "Page error captured");
    });

    // Set up request failure listener
    this.page.on("requestfailed", (request) => {
      const failure = request.failure();
      if (failure) {
        this.errors.push({
          type: "error",
          message: `Request failed: ${request.url()} - ${failure.errorText}`,
          location: request.url(),
          timestamp: new Date(),
        });
        log.debug({ url: request.url(), errorText: failure.errorText }, "Request failed");
      }
    });

    // Navigate to the page
    log.info({ elapsedMs: elapsed(), url: this.url }, "goto started");
    try {
      const response = await this.page.goto(this.url, {
        waitUntil: "networkidle",
        timeout: 30000,
      });
      log.info(
        { elapsedMs: elapsed(), url: this.url, status: response?.status() },
        "goto completed"
      );
    } catch (error) {
      log.error({ err: error, url: this.url, elapsedMs: elapsed() }, "goto FAILED");
      // If the page or context was closed (e.g., browser pool timeout),
      // we can't do anything more — return with whatever errors were captured
      if (this.page.isClosed()) {
        log.warn(
          { elapsedMs: elapsed() },
          "Page was closed during navigation, skipping further checks"
        );
        return;
      }
    }

    // Wait a bit for any async errors (guard against closed page)
    log.info({ elapsedMs: elapsed() }, "waitForTimeout(3000) started");
    try {
      await this.page.waitForTimeout(3000);
      log.info({ elapsedMs: elapsed() }, "waitForTimeout(3000) completed");
    } catch (error) {
      log.warn({ err: error, elapsedMs: elapsed() }, "waitForTimeout FAILED, page may have closed");
      return;
    }

    // Check for Vite error overlay
    log.info({ elapsedMs: elapsed() }, "captureViteOverlay started");
    await this.captureViteOverlayErrors();
    log.info({ elapsedMs: elapsed() }, "captureViteOverlay completed");
    log.info({ elapsedMs: elapsed(), errorCount: this.errors.length }, "start() END");
  }

  /**
   * Capture errors from Vite's error overlay (shown for build/compile errors)
   */
  private async captureViteOverlayErrors(): Promise<void> {
    if (!this.page) return;

    try {
      // Vite uses a custom element <vite-error-overlay> with shadow DOM
      const overlay = await this.page.$("vite-error-overlay");
      if (!overlay) return;

      // Extract error details from the overlay's shadow DOM
      const errorDetails = await overlay.evaluate((el) => {
        const shadow = (
          el as unknown as {
            shadowRoot: {
              querySelector: (selector: string) => { textContent?: string } | null;
            } | null;
          }
        ).shadowRoot;
        if (!shadow) return null;

        // Get the error message
        const messageEl = shadow.querySelector(".message-body");
        const message = messageEl?.textContent?.trim() || "";

        // Get the file path
        const fileEl = shadow.querySelector(".file");
        const file = fileEl?.textContent?.trim() || "";

        // Get the code frame
        const frameEl = shadow.querySelector(".frame-code");
        const frame = frameEl?.textContent?.trim() || "";

        // Get the stack trace if available
        const stackEl = shadow.querySelector(".stack");
        const stack = stackEl?.textContent?.trim() || "";

        return { message, file, frame, stack };
      });

      if (errorDetails && errorDetails.message) {
        const error: ConsoleError = {
          type: "vite-overlay",
          message: errorDetails.message,
          file: errorDetails.file || undefined,
          frame: errorDetails.frame || undefined,
          stack: errorDetails.stack || undefined,
          timestamp: new Date(),
        };

        this.viteOverlayErrors.push(error);
        getLogger({ component: "BrowserErrorCapture" }).debug(
          { message: errorDetails.message, file: errorDetails.file || undefined },
          "Vite overlay error captured"
        );
      }
    } catch (error) {
      // Ignore errors when checking for overlay - it might not exist
      getLogger({ component: "BrowserErrorCapture" }).debug(
        { err: error },
        "Failed to check Vite overlay"
      );
    }
  }

  /**
   * Capture a console error
   */
  private async captureConsoleError(msg: ConsoleMessage, type: "error" | "warning"): Promise<void> {
    try {
      const location = msg.location();
      const text = msg.text();

      // Try to get more detailed error info
      let detailedMessage = text;
      try {
        const args = msg.args();
        if (args.length > 0) {
          // Try to get the actual error object
          const firstArg = await args[0]?.jsonValue().catch(() => null);
          if (firstArg && typeof firstArg === "object") {
            detailedMessage = firstArg.message || firstArg.toString() || text;
          }
        }
      } catch {
        // Fall back to basic text
      }

      const error: ConsoleError = {
        type,
        message: detailedMessage,
        location: location
          ? `${location.url}:${location.lineNumber}:${location.columnNumber}`
          : undefined,
        timestamp: new Date(),
      };

      this.errors.push(error);
      getLogger({ component: "BrowserErrorCapture" }).debug(
        { type, message: detailedMessage, location: error.location },
        "Console error captured"
      );
    } catch (error) {
      getLogger({ component: "BrowserErrorCapture" }).error(
        { err: error },
        "Failed to capture console error"
      );
    }
  }

  /**
   * Wait for specific errors or timeout
   */
  async waitForErrors(options: { timeout?: number; expectedCount?: number } = {}): Promise<void> {
    const { timeout = 5000, expectedCount } = options;
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      if (expectedCount !== undefined && this.errors.length >= expectedCount) {
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  /**
   * Get all captured errors
   */
  getErrors(): ConsoleError[] {
    return this.errors;
  }

  /**
   * Get only JavaScript errors (not warnings)
   */
  getConsoleErrors(): ConsoleError[] {
    return this.errors.filter((e) => e.type === "error");
  }

  /**
   * Get a formatted error report
   */
  getErrorReport(): string {
    if (this.errors.length === 0) {
      return "No errors detected";
    }

    const report: string[] = [`Found ${this.errors.length} console errors:\n`];

    this.errors.forEach((error, index) => {
      report.push(`${index + 1}. [${error.type.toUpperCase()}] ${error.message}`);
      if (error.location) {
        report.push(`   Location: ${error.location}`);
      }
      if (error.stack) {
        report.push(
          `   Stack trace:\n${error.stack
            .split("\n")
            .map((l) => "     " + l)
            .join("\n")}`
        );
      }
    });

    return report.join("\n");
  }

  /**
   * Stop the browser
   */
  async stop(): Promise<void> {
    const context = this.context;
    const page = this.page;

    // Clear references first to prevent double-cleanup
    this.page = null;
    this.context = null;

    // Close page with error handling
    try {
      if (page) {
        await page.close();
      }
    } catch (error) {
      getLogger({ component: "BrowserErrorCapture" }).error({ err: error }, "Error closing page");
    } finally {
      // ALWAYS release context, even if page.close() failed
      if (context) {
        await browserPool.releaseContext(context);
      }
    }

    getLogger({ component: "BrowserErrorCapture" }).info(
      { errorCount: this.errors.length },
      "Browser context released"
    );
  }

  /**
   * Clear captured errors
   */
  clearErrors(): void {
    this.errors = [];
  }
}
