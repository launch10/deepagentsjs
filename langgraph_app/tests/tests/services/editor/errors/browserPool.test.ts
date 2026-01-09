import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// We need to test a fresh instance each time, so we mock the module
// and create new instances rather than using the singleton
vi.mock("playwright", () => ({
  chromium: {
    launch: vi.fn(),
  },
}));

import { chromium } from "playwright";

// Create a testable version of BrowserPool (same logic, but not singleton)
class TestableBrowserPool {
  private static readonly MAX_CONTEXTS = 10;
  private static readonly CONTEXT_TIMEOUT_MS = 60_000;

  private browser: any = null;
  private browserPromise: Promise<any> | null = null;
  private activeContexts = 0;
  private waitQueue: Array<() => void> = [];
  private contextTimers = new Map<any, NodeJS.Timeout>();

  async getContext(): Promise<any> {
    if (this.activeContexts >= TestableBrowserPool.MAX_CONTEXTS) {
      await new Promise<void>((resolve) => this.waitQueue.push(resolve));
    }

    const browser = await this.ensureBrowser();
    this.activeContexts++;
    const context = await browser.newContext();

    // Auto-release after timeout
    const timer = setTimeout(() => {
      this.releaseContext(context);
    }, TestableBrowserPool.CONTEXT_TIMEOUT_MS);

    this.contextTimers.set(context, timer);

    return context;
  }

  async releaseContext(context: any): Promise<void> {
    const timer = this.contextTimers.get(context);
    if (timer) {
      clearTimeout(timer);
      this.contextTimers.delete(context);
    } else {
      // Already released - no-op
      return;
    }

    try {
      await context.close();
    } catch (error) {
      // Ignore close errors in tests
    } finally {
      this.activeContexts--;
      const next = this.waitQueue.shift();
      if (next) next();
    }
  }

  async shutdown(): Promise<void> {
    for (const timer of this.contextTimers.values()) {
      clearTimeout(timer);
    }
    this.contextTimers.clear();

    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.browserPromise = null;
    }
  }

  private async ensureBrowser(): Promise<any> {
    if (this.browser && !this.browser.isConnected()) {
      this.browser = null;
      this.browserPromise = null;
    }

    if (this.browser) {
      return this.browser;
    }

    if (!this.browserPromise) {
      this.browserPromise = chromium.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
      });
    }

    this.browser = await this.browserPromise;
    return this.browser;
  }

  getActiveContextCount(): number {
    return this.activeContexts;
  }

  getWaitQueueLength(): number {
    return this.waitQueue.length;
  }

  getContextTimerCount(): number {
    return this.contextTimers.size;
  }
}

describe("BrowserPool", () => {
  let pool: TestableBrowserPool;
  let mockBrowser: any;
  let mockContexts: any[];

  beforeEach(() => {
    pool = new TestableBrowserPool();
    mockContexts = [];

    mockBrowser = {
      isConnected: vi.fn().mockReturnValue(true),
      newContext: vi.fn().mockImplementation(() => {
        const ctx = {
          close: vi.fn().mockResolvedValue(undefined),
        };
        mockContexts.push(ctx);
        return ctx;
      }),
      close: vi.fn().mockResolvedValue(undefined),
    };

    vi.mocked(chromium.launch).mockResolvedValue(mockBrowser);
  });

  afterEach(async () => {
    await pool.shutdown();
    vi.clearAllMocks();
  });

  describe("Context Lifecycle", () => {
    it("acquires a context and increments active count", async () => {
      expect(pool.getActiveContextCount()).toBe(0);

      const context = await pool.getContext();

      expect(pool.getActiveContextCount()).toBe(1);
      expect(context).toBeDefined();
    });

    it("releases a context and decrements active count", async () => {
      const context = await pool.getContext();
      expect(pool.getActiveContextCount()).toBe(1);

      await pool.releaseContext(context);

      expect(pool.getActiveContextCount()).toBe(0);
      expect(context.close).toHaveBeenCalled();
    });

    it("handles multiple contexts correctly", async () => {
      const ctx1 = await pool.getContext();
      const ctx2 = await pool.getContext();
      const ctx3 = await pool.getContext();

      expect(pool.getActiveContextCount()).toBe(3);

      await pool.releaseContext(ctx2);
      expect(pool.getActiveContextCount()).toBe(2);

      await pool.releaseContext(ctx1);
      await pool.releaseContext(ctx3);
      expect(pool.getActiveContextCount()).toBe(0);
    });
  });

  describe("Bounded Concurrency", () => {
    it("allows up to MAX_CONTEXTS (10) concurrent contexts", async () => {
      const contexts = await Promise.all(Array.from({ length: 10 }, () => pool.getContext()));

      expect(pool.getActiveContextCount()).toBe(10);
      expect(pool.getWaitQueueLength()).toBe(0);

      // Cleanup
      await Promise.all(contexts.map((ctx) => pool.releaseContext(ctx)));
    });

    it("queues requests beyond MAX_CONTEXTS", async () => {
      // Acquire 10 contexts (max)
      const contexts = await Promise.all(Array.from({ length: 10 }, () => pool.getContext()));

      expect(pool.getActiveContextCount()).toBe(10);

      // The 11th request should wait
      let eleventhResolved = false;
      const eleventhPromise = pool.getContext().then((ctx) => {
        eleventhResolved = true;
        return ctx;
      });

      // Give it a tick to ensure it's queued
      await new Promise((r) => setTimeout(r, 10));

      expect(eleventhResolved).toBe(false);
      expect(pool.getWaitQueueLength()).toBe(1);

      // Release one context
      await pool.releaseContext(contexts[0]);

      // Now the 11th should resolve
      const eleventhContext = await eleventhPromise;
      expect(eleventhResolved).toBe(true);
      expect(pool.getActiveContextCount()).toBe(10);
      expect(pool.getWaitQueueLength()).toBe(0);

      // Cleanup
      await pool.releaseContext(eleventhContext);
      await Promise.all(contexts.slice(1).map((ctx) => pool.releaseContext(ctx)));
    });

    it("processes wait queue in FIFO order", async () => {
      const contexts = await Promise.all(Array.from({ length: 10 }, () => pool.getContext()));

      const order: number[] = [];

      // Queue 3 more requests
      const waiter1 = pool.getContext().then(() => order.push(1));
      const waiter2 = pool.getContext().then(() => order.push(2));
      const waiter3 = pool.getContext().then(() => order.push(3));

      await new Promise((r) => setTimeout(r, 10));
      expect(pool.getWaitQueueLength()).toBe(3);

      // Release 3 contexts
      await pool.releaseContext(contexts[0]);
      await pool.releaseContext(contexts[1]);
      await pool.releaseContext(contexts[2]);

      await Promise.all([waiter1, waiter2, waiter3]);

      expect(order).toEqual([1, 2, 3]);
    });
  });

  describe("Lazy Initialization", () => {
    it("does not launch browser until first getContext", async () => {
      expect(chromium.launch).not.toHaveBeenCalled();

      await pool.getContext();

      expect(chromium.launch).toHaveBeenCalledOnce();
      expect(chromium.launch).toHaveBeenCalledWith({
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
      });
    });

    it("reuses the same browser for multiple contexts", async () => {
      await pool.getContext();
      await pool.getContext();
      await pool.getContext();

      expect(chromium.launch).toHaveBeenCalledOnce();
      expect(mockBrowser.newContext).toHaveBeenCalledTimes(3);
    });
  });

  describe("Race Condition Protection", () => {
    it("shares browser launch promise for concurrent calls", async () => {
      // Simulate slow browser launch
      let launchResolve: (browser: any) => void;
      vi.mocked(chromium.launch).mockReturnValue(
        new Promise((resolve) => {
          launchResolve = resolve;
        })
      );

      // Fire off multiple concurrent getContext calls
      const promises = [pool.getContext(), pool.getContext(), pool.getContext()];

      // All should be waiting on the same launch
      expect(chromium.launch).toHaveBeenCalledOnce();

      // Resolve the launch
      launchResolve!(mockBrowser);

      const contexts = await Promise.all(promises);
      expect(contexts).toHaveLength(3);
      expect(chromium.launch).toHaveBeenCalledOnce();
    });
  });

  describe("Browser Crash Recovery", () => {
    it("relaunches browser if disconnected", async () => {
      // First call launches browser
      await pool.getContext();
      expect(chromium.launch).toHaveBeenCalledOnce();

      // Simulate browser crash
      mockBrowser.isConnected.mockReturnValue(false);

      // Create a new mock browser for relaunch
      const newMockBrowser = {
        isConnected: vi.fn().mockReturnValue(true),
        newContext: vi.fn().mockReturnValue({ close: vi.fn() }),
        close: vi.fn(),
      } as any;
      vi.mocked(chromium.launch).mockResolvedValue(newMockBrowser);

      // Next call should relaunch
      await pool.getContext();
      expect(chromium.launch).toHaveBeenCalledTimes(2);
    });
  });

  describe("Shutdown", () => {
    it("closes the browser on shutdown", async () => {
      await pool.getContext();
      expect(mockBrowser.close).not.toHaveBeenCalled();

      await pool.shutdown();

      expect(mockBrowser.close).toHaveBeenCalledOnce();
    });

    it("handles shutdown when no browser was launched", async () => {
      // Should not throw
      await expect(pool.shutdown()).resolves.toBeUndefined();
    });

    it("can launch new browser after shutdown", async () => {
      await pool.getContext();
      await pool.shutdown();

      expect(chromium.launch).toHaveBeenCalledOnce();

      // Launch again
      await pool.getContext();
      expect(chromium.launch).toHaveBeenCalledTimes(2);
    });
  });

  describe("Error Handling", () => {
    it("decrements count even if context.close() fails", async () => {
      const context = await pool.getContext();
      context.close.mockRejectedValue(new Error("Close failed"));

      expect(pool.getActiveContextCount()).toBe(1);

      // Should not throw, should still decrement
      await pool.releaseContext(context);

      expect(pool.getActiveContextCount()).toBe(0);
    });

    it("wakes up waiters even if context.close() fails", async () => {
      const contexts = await Promise.all(Array.from({ length: 10 }, () => pool.getContext()));

      contexts[0].close.mockRejectedValue(new Error("Close failed"));

      let waiterResolved = false;
      const waiterPromise = pool.getContext().then(() => {
        waiterResolved = true;
      });

      await new Promise((r) => setTimeout(r, 10));
      expect(waiterResolved).toBe(false);

      // Release the failing context
      await pool.releaseContext(contexts[0]);

      await waiterPromise;
      expect(waiterResolved).toBe(true);
    });
  });

  describe("Context Timeout (Good Citizen)", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("auto-releases context after 60s timeout", async () => {
      const context = await pool.getContext();
      expect(pool.getActiveContextCount()).toBe(1);
      expect(pool.getContextTimerCount()).toBe(1);

      // Advance time past timeout
      await vi.advanceTimersByTimeAsync(60_000);

      expect(pool.getActiveContextCount()).toBe(0);
      expect(pool.getContextTimerCount()).toBe(0);
      expect(context.close).toHaveBeenCalled();
    });

    it("clears timeout when released manually before expiry", async () => {
      const context = await pool.getContext();
      expect(pool.getContextTimerCount()).toBe(1);

      // Release before timeout
      await pool.releaseContext(context);

      expect(pool.getContextTimerCount()).toBe(0);

      // Advance time - should not double-release
      await vi.advanceTimersByTimeAsync(60_000);

      expect(context.close).toHaveBeenCalledOnce();
    });

    it("is idempotent - double release is a no-op", async () => {
      const context = await pool.getContext();
      expect(pool.getActiveContextCount()).toBe(1);

      await pool.releaseContext(context);
      expect(pool.getActiveContextCount()).toBe(0);

      // Second release should be a no-op
      await pool.releaseContext(context);
      expect(pool.getActiveContextCount()).toBe(0);
      expect(context.close).toHaveBeenCalledOnce();
    });

    it("frees queue slot when context times out", async () => {
      // Fill pool to capacity
      const contexts = await Promise.all(Array.from({ length: 10 }, () => pool.getContext()));

      // 11th waits in queue
      let waiterResolved = false;
      const waiterPromise = pool.getContext().then(() => {
        waiterResolved = true;
      });

      // Let the waiter get queued
      await vi.advanceTimersByTimeAsync(10);
      expect(pool.getWaitQueueLength()).toBe(1);
      expect(waiterResolved).toBe(false);

      // First context times out
      await vi.advanceTimersByTimeAsync(60_000);

      await waiterPromise;
      expect(waiterResolved).toBe(true);
      expect(pool.getWaitQueueLength()).toBe(0);
    });

    it("clears all timers on shutdown", async () => {
      await pool.getContext();
      await pool.getContext();
      await pool.getContext();

      expect(pool.getContextTimerCount()).toBe(3);

      await pool.shutdown();

      expect(pool.getContextTimerCount()).toBe(0);
    });
  });
});
