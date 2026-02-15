import { chromium, type Browser, type BrowserContext } from "playwright";
import { getLogger } from "@core";

/**
 * Singleton browser pool with lazy initialization and bounded concurrency.
 *
 * Why this exists:
 * - Each Chromium instance uses ~200MB RAM
 * - Multi-tenant SaaS = multiple concurrent deploys
 * - 20 concurrent deploys = 4GB RAM = OOM
 *
 * Solution:
 * - One browser process, multiple contexts (~10MB each)
 * - Bounded concurrency prevents runaway memory
 * - Lazy init: browser only launches on first validation
 * - Auto-release: contexts timeout after 60s to prevent leaks
 */
class BrowserPool {
  private static readonly MAX_CONTEXTS = 20;
  private static readonly CONTEXT_TIMEOUT_MS = 60_000; // 60 seconds max hold time

  private browser: Browser | null = null;
  private browserPromise: Promise<Browser> | null = null;
  private activeContexts = 0;
  private waitQueue: Array<() => void> = [];
  private contextTimers = new Map<BrowserContext, NodeJS.Timeout>();
  private contextIdCounter = 0;
  private contextIds = new Map<BrowserContext, number>();
  private contextAcquiredAt = new Map<BrowserContext, number>();

  /**
   * Get a browser context for validation.
   * Waits if at capacity (bounded concurrency).
   * Context auto-releases after CONTEXT_TIMEOUT_MS to prevent leaks.
   */
  async getContext(): Promise<BrowserContext> {
    const log = getLogger({ component: "BrowserPool" });
    const contextId = ++this.contextIdCounter;
    const startMs = Date.now();

    log.info(
      { contextId, activeContexts: this.activeContexts, waitQueueLength: this.waitQueue.length },
      "getContext requested"
    );

    // Bounded concurrency - wait if at capacity
    if (this.activeContexts >= BrowserPool.MAX_CONTEXTS) {
      log.warn({ contextId }, "At capacity, waiting in queue");
      await new Promise<void>((resolve) => this.waitQueue.push(resolve));
      log.info({ contextId, waitedMs: Date.now() - startMs }, "Dequeued from wait queue");
    }

    // Lazy launch with race condition protection
    const browser = await this.ensureBrowser();

    this.activeContexts++;
    const context = await browser.newContext();
    this.contextIds.set(context, contextId);
    this.contextAcquiredAt.set(context, Date.now());

    log.info(
      { contextId, activeContexts: this.activeContexts, elapsedMs: Date.now() - startMs },
      "Context acquired, starting 60s auto-release timer"
    );

    // Auto-release after timeout to prevent resource leaks
    const timer = setTimeout(() => {
      const heldMs = Date.now() - (this.contextAcquiredAt.get(context) || Date.now());
      log.warn(
        { contextId, timeoutMs: BrowserPool.CONTEXT_TIMEOUT_MS, heldMs },
        "AUTO-RELEASE: Browser context held too long, force-releasing"
      );
      this.releaseContext(context);
    }, BrowserPool.CONTEXT_TIMEOUT_MS);

    this.contextTimers.set(context, timer);

    return context;
  }

  /**
   * Release a context back to the pool.
   * Clears the auto-release timer and wakes up next waiter if any.
   */
  async releaseContext(context: BrowserContext): Promise<void> {
    const log = getLogger({ component: "BrowserPool" });
    const contextId = this.contextIds.get(context) || -1;
    const acquiredAt = this.contextAcquiredAt.get(context);
    const heldMs = acquiredAt ? Date.now() - acquiredAt : -1;

    // Clear auto-release timer if context was released properly
    const timer = this.contextTimers.get(context);
    if (timer) {
      clearTimeout(timer);
      this.contextTimers.delete(context);
      log.info({ contextId, heldMs }, "MANUAL release (normal path)");
    } else {
      // Already released (likely by timeout) - no-op
      log.warn(
        { contextId },
        "releaseContext called but no timer found (already released by auto-release?)"
      );
      return;
    }

    try {
      await context.close();
    } catch (error) {
      log.error({ err: error, contextId }, "Failed to close browser context");
    } finally {
      this.activeContexts--;
      this.contextIds.delete(context);
      this.contextAcquiredAt.delete(context);
      log.info({ contextId, activeContexts: this.activeContexts }, "Context released");
      // Wake up next waiter
      const next = this.waitQueue.shift();
      if (next) next();
    }
  }

  /**
   * Shutdown the browser pool.
   * Clears all timers and closes the browser.
   * Called on process termination.
   */
  async shutdown(): Promise<void> {
    // Clear all pending timers
    for (const timer of this.contextTimers.values()) {
      clearTimeout(timer);
    }
    this.contextTimers.clear();

    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.browserPromise = null;
      getLogger({ component: "BrowserPool" }).info("Browser pool shut down");
    }
  }

  /**
   * Ensure browser is running, with race condition protection.
   * Multiple concurrent calls will share the same launch promise.
   */
  private async ensureBrowser(): Promise<Browser> {
    // Check if browser crashed
    if (this.browser && !this.browser.isConnected()) {
      getLogger({ component: "BrowserPool" }).warn("Browser disconnected, relaunching");
      this.browser = null;
      this.browserPromise = null;
    }

    // Fast path: browser already running
    if (this.browser) {
      return this.browser;
    }

    // Race condition protection: share launch promise
    if (!this.browserPromise) {
      getLogger({ component: "BrowserPool" }).info("Launching browser pool");
      this.browserPromise = chromium.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
      });
    }

    this.browser = await this.browserPromise;
    return this.browser;
  }

  /** For testing: get current active context count */
  getActiveContextCount(): number {
    return this.activeContexts;
  }

  /** For testing: get current wait queue length */
  getWaitQueueLength(): number {
    return this.waitQueue.length;
  }
}

// Singleton instance
export const browserPool = new BrowserPool();

// Graceful shutdown on process termination
process.on("SIGTERM", () => browserPool.shutdown());
process.on("SIGINT", () => browserPool.shutdown());
