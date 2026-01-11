import { type BrowserContext, type Page, type ConsoleMessage } from "playwright";
import { type ConsoleError } from "@types";
import { browserPool } from "./browserPool";

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
    console.log(`Starting browser for ${this.url}`);

    // Get context from pool (waits if at capacity)
    this.context = await browserPool.getContext();

    // Create page
    this.page = await this.context.newPage();

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
      console.log(`  ✗ Page error: ${error.message}`);
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
        console.log(`  ✗ Request failed: ${request.url()}`);
      }
    });

    // Navigate to the page
    try {
      await this.page.goto(this.url, {
        waitUntil: "networkidle",
        timeout: 30000,
      });
      console.log(`  ✓ Page loaded: ${this.url}`);
    } catch (error) {
      console.error(`  ✗ Failed to load page: ${error}`);
      // Still continue to capture any errors that occurred
    }

    // Wait a bit for any async errors
    await this.page.waitForTimeout(3000);

    // Check for Vite error overlay
    await this.captureViteOverlayErrors();
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
        console.log(`  ✗ Vite overlay error: ${errorDetails.message}`);
        if (errorDetails.file) {
          console.log(`    File: ${errorDetails.file}`);
        }
      }
    } catch (error) {
      // Ignore errors when checking for overlay - it might not exist
      console.debug(`Failed to check Vite overlay: ${error}`);
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
      console.log(`  ✗ Console ${type}: ${detailedMessage}`);

      if (location) {
        console.log(`    at ${error.location}`);
      }
    } catch (error) {
      console.error(`Failed to capture console error: ${error}`);
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
      console.error("Error closing page:", error);
    } finally {
      // ALWAYS release context, even if page.close() failed
      if (context) {
        await browserPool.releaseContext(context);
      }
    }

    console.log(`  ✓ Browser context released (captured ${this.errors.length} errors)`);
  }

  /**
   * Clear captured errors
   */
  clearErrors(): void {
    this.errors = [];
  }
}
