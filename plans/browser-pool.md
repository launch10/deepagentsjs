# Plan: Browser Pool for Concurrent Validation

## Summary

Singleton browser pool with lazy initialization and bounded concurrency for multi-tenant runtime validation.

## Problem

Each `BrowserErrorCapture` currently launches a full Chromium instance (~200MB RAM). For a multi-tenant SaaS where multiple users deploy simultaneously:

| Concurrent Users | RAM (Current) | RAM (With Pool) |
|------------------|---------------|-----------------|
| 1 | 200MB | 210MB |
| 5 | 1GB | 250MB |
| 10 | 2GB | 300MB |
| 20 | 4GB (OOM) | 400MB |

**Alternatives considered:**

1. **Queue all validations** - Unacceptable UX. User B waits for User A to finish.
2. **Launch browser per validation** - Current approach. OOMs under load.
3. **Browser pool with contexts** - One browser, multiple lightweight contexts. ✓

## Solution

One browser process per worker, multiple browser contexts (like incognito tabs). Contexts are ~10MB each vs ~200MB for full browsers. Bounded concurrency prevents runaway memory usage.

```
┌─────────────────────────────────────────┐
│            Browser Pool                  │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │     Chromium Process (~200MB)   │    │
│  │                                 │    │
│  │  ┌─────────┐ ┌─────────┐       │    │
│  │  │Context 1│ │Context 2│  ...  │    │
│  │  │  ~10MB  │ │  ~10MB  │       │    │
│  │  └─────────┘ └─────────┘       │    │
│  └─────────────────────────────────┘    │
│                                         │
│  Max Contexts: 10                       │
│  Wait Queue: [User 11, User 12, ...]    │
└─────────────────────────────────────────┘
```

**Bounded concurrency:** When 11th user requests a context while 10 are active, they wait in-process until a context is released. Validation takes ~10-30 seconds, so worst-case wait is short.

**Future scaling:** If demand requires horizontal scaling, move validation to Sidekiq workers. Each worker runs its own browser pool. The pool implementation is reusable.

---

## Implementation

### browserPool.ts

**File:** `langgraph_app/app/services/editor/errors/browserPool.ts`

```typescript
import { chromium, type Browser, type BrowserContext } from "playwright";

/**
 * Singleton browser pool with lazy initialization and bounded concurrency.
 *
 * Why this exists:
 * - Each Chromium instance uses ~200MB RAM
 * - Multi-tenant SaaS = multiple concurrent deploys
 * - 10 concurrent deploys = 2GB RAM = OOM
 *
 * Solution:
 * - One browser process, multiple contexts (~10MB each)
 * - Bounded concurrency prevents runaway memory
 * - Lazy init: browser only launches on first validation
 */
class BrowserPool {
  private static readonly MAX_CONTEXTS = 10;

  private browser: Browser | null = null;
  private browserPromise: Promise<Browser> | null = null;
  private activeContexts = 0;
  private waitQueue: Array<() => void> = [];

  /**
   * Get a browser context for validation.
   * Waits if at capacity (bounded concurrency).
   */
  async getContext(): Promise<BrowserContext> {
    // Bounded concurrency - wait if at capacity
    if (this.activeContexts >= BrowserPool.MAX_CONTEXTS) {
      await new Promise<void>((resolve) => this.waitQueue.push(resolve));
    }

    // Lazy launch with race condition protection
    const browser = await this.ensureBrowser();

    this.activeContexts++;
    return browser.newContext();
  }

  /**
   * Release a context back to the pool.
   * Wakes up next waiter if any.
   */
  async releaseContext(context: BrowserContext): Promise<void> {
    try {
      await context.close();
    } catch (error) {
      console.error("Failed to close browser context:", error);
    } finally {
      this.activeContexts--;
      // Wake up next waiter
      const next = this.waitQueue.shift();
      if (next) next();
    }
  }

  /**
   * Shutdown the browser pool.
   * Called on process termination.
   */
  async shutdown(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.browserPromise = null;
      console.log("Browser pool shut down");
    }
  }

  /**
   * Ensure browser is running, with race condition protection.
   * Multiple concurrent calls will share the same launch promise.
   */
  private async ensureBrowser(): Promise<Browser> {
    // Check if browser crashed
    if (this.browser && !this.browser.isConnected()) {
      console.warn("Browser disconnected, relaunching...");
      this.browser = null;
      this.browserPromise = null;
    }

    // Fast path: browser already running
    if (this.browser) {
      return this.browser;
    }

    // Race condition protection: share launch promise
    if (!this.browserPromise) {
      console.log("Launching browser pool...");
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
```

### Update BrowserErrorCapture

**File:** `langgraph_app/app/services/editor/errors/browserErrorCapture.ts`

```typescript
import { browserPool } from "./browserPool";
import type { BrowserContext, Page, ConsoleMessage } from "playwright";
import type { ConsoleError } from "@types";  // NOT @annotation

export class BrowserErrorCapture {
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private errors: ConsoleError[] = [];
  private url: string;

  constructor(url: string) {
    this.url = url;
  }

  async start(): Promise<void> {
    console.log(`Starting browser for ${this.url}`);

    // Get context from pool (waits if at capacity)
    this.context = await browserPool.getContext();
    this.page = await this.context.newPage();

    // ... rest of existing listener setup unchanged ...
  }

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

  // ... rest of existing methods unchanged ...
}
```

### Update WebsiteRunner (Port 0)

**File:** `langgraph_app/app/services/editor/core/websiteRunner.ts`

```typescript
// Change default from 5173 to 0
constructor(projectDir: string, port: number = 0) {
  this.projectDir = projectDir;
  this.port = port;
  this.serverUrl = `http://localhost:${port}`;
}
```

Existing stdout parsing (lines 87-91) already captures actual port from Vite output.

---

## Files Summary

| Action | File |
|--------|------|
| Create | `langgraph_app/app/services/editor/errors/browserPool.ts` |
| Modify | `langgraph_app/app/services/editor/errors/browserErrorCapture.ts` |
| Modify | `langgraph_app/app/services/editor/core/websiteRunner.ts` |
| Modify | `langgraph_app/app/services/editor/errors/index.ts` (export browserPool) |

---

## Testing

### Unit Tests

**File:** `langgraph_app/tests/services/editor/errors/browserPool.test.ts`

```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { browserPool } from "@services/editor/errors/browserPool";

describe("BrowserPool", () => {
  afterEach(async () => {
    await browserPool.shutdown();
  });

  describe("getContext", () => {
    it("lazily launches browser on first call", async () => {
      expect(browserPool.getActiveContextCount()).toBe(0);

      const context = await browserPool.getContext();

      expect(context).toBeDefined();
      expect(browserPool.getActiveContextCount()).toBe(1);

      await browserPool.releaseContext(context);
    });

    it("reuses browser for multiple contexts", async () => {
      const context1 = await browserPool.getContext();
      const context2 = await browserPool.getContext();

      expect(browserPool.getActiveContextCount()).toBe(2);

      await browserPool.releaseContext(context1);
      await browserPool.releaseContext(context2);
    });
  });

  describe("bounded concurrency", () => {
    it("queues requests when at capacity", async () => {
      // Get MAX_CONTEXTS contexts
      const contexts = [];
      for (let i = 0; i < 10; i++) {
        contexts.push(await browserPool.getContext());
      }

      expect(browserPool.getActiveContextCount()).toBe(10);

      // 11th request should queue
      let resolved = false;
      const pendingContext = browserPool.getContext().then((ctx) => {
        resolved = true;
        return ctx;
      });

      // Give it a moment
      await new Promise((r) => setTimeout(r, 50));
      expect(resolved).toBe(false);
      expect(browserPool.getWaitQueueLength()).toBe(1);

      // Release one context
      await browserPool.releaseContext(contexts[0]);

      // Pending should resolve
      const context11 = await pendingContext;
      expect(resolved).toBe(true);
      expect(context11).toBeDefined();

      // Cleanup
      await browserPool.releaseContext(context11);
      for (let i = 1; i < contexts.length; i++) {
        await browserPool.releaseContext(contexts[i]);
      }
    });
  });

  describe("race condition protection", () => {
    it("handles concurrent first calls without double-launch", async () => {
      // Shutdown to reset state
      await browserPool.shutdown();

      // Call getContext concurrently
      const [ctx1, ctx2, ctx3] = await Promise.all([
        browserPool.getContext(),
        browserPool.getContext(),
        browserPool.getContext(),
      ]);

      // All should succeed with one browser
      expect(ctx1).toBeDefined();
      expect(ctx2).toBeDefined();
      expect(ctx3).toBeDefined();
      expect(browserPool.getActiveContextCount()).toBe(3);

      await browserPool.releaseContext(ctx1);
      await browserPool.releaseContext(ctx2);
      await browserPool.releaseContext(ctx3);
    });
  });

  describe("releaseContext", () => {
    it("decrements active count", async () => {
      const context = await browserPool.getContext();
      expect(browserPool.getActiveContextCount()).toBe(1);

      await browserPool.releaseContext(context);
      expect(browserPool.getActiveContextCount()).toBe(0);
    });

    it("handles double-release gracefully", async () => {
      const context = await browserPool.getContext();
      await browserPool.releaseContext(context);

      // Second release should not throw or go negative
      await browserPool.releaseContext(context);
      expect(browserPool.getActiveContextCount()).toBe(0);
    });
  });

  describe("shutdown", () => {
    it("closes browser and resets state", async () => {
      const context = await browserPool.getContext();
      await browserPool.releaseContext(context);

      await browserPool.shutdown();

      // Can start fresh after shutdown
      const newContext = await browserPool.getContext();
      expect(newContext).toBeDefined();
      await browserPool.releaseContext(newContext);
    });
  });
});
```

### Integration Tests

**File:** `langgraph_app/tests/services/editor/errors/browserErrorCapture.integration.test.ts`

```typescript
import { describe, it, expect } from "vitest";
import { ErrorExporter } from "@services/editor/errors/errorExporter";
import { browserPool } from "@services/editor/errors/browserPool";

describe("BrowserErrorCapture with Pool (Integration)", () => {
  it("releases context after validation completes", async () => {
    const initialCount = browserPool.getActiveContextCount();

    const exporter = new ErrorExporter(testWebsiteId);
    await exporter.run();

    expect(browserPool.getActiveContextCount()).toBe(initialCount);
  });

  it("handles concurrent validations", async () => {
    const exporters = [
      new ErrorExporter(testWebsiteId1),
      new ErrorExporter(testWebsiteId2),
      new ErrorExporter(testWebsiteId3),
    ];

    // Run all concurrently
    const results = await Promise.all(exporters.map((e) => e.run()));

    // All should complete without error
    expect(results).toHaveLength(3);
    expect(browserPool.getActiveContextCount()).toBe(0);
  });
});
```

### Port Allocation Tests

**File:** `langgraph_app/tests/services/editor/core/websiteRunner.test.ts`

```typescript
describe("WebsiteRunner port allocation", () => {
  it("uses dynamic port when default (0) is specified", async () => {
    const runner1 = new WebsiteRunner(projectDir1);
    const runner2 = new WebsiteRunner(projectDir2);

    await runner1.install();
    await runner2.install();

    await Promise.all([runner1.start(), runner2.start()]);

    // Both should have different non-zero ports
    const url1 = runner1.getUrl();
    const url2 = runner2.getUrl();

    expect(url1).not.toBe(url2);
    expect(url1).not.toContain(":0");
    expect(url2).not.toContain(":0");

    await runner1.stop();
    await runner2.stop();
  });
});
```

---

## Verification

1. **Unit tests pass:** `pnpm test browserPool`
2. **No race condition:** 3 concurrent `getContext()` calls → 1 browser launched
3. **Bounded concurrency:** 11 concurrent requests → 10 active, 1 waiting
4. **Context cleanup:** After validation → `activeContexts` returns to 0
5. **Port allocation:** 2 concurrent `WebsiteRunner` instances → different ports
