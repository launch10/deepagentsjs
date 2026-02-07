# Visual Feedback Loop (Post-MVP)

## Problem

The website agent can't "see" what it built. After generating a landing page, there's no quality gate — bad typography, broken layouts, or poor visual hierarchy ship to the user unchecked.

## Approach

Screenshot the generated page server-side via Playwright, score it with a cheap vision model call, and fix the top issues via single-shot edit if the score is below threshold.

## What Already Exists

| Component                        | Location                                            | What it does                                                               |
| -------------------------------- | --------------------------------------------------- | -------------------------------------------------------------------------- |
| `BrowserPool`                    | `app/services/editor/errors/browserPool.ts`         | Singleton Chromium pool, 20 concurrent contexts, lazy init                 |
| `BrowserErrorCapture`            | `app/services/editor/errors/browserErrorCapture.ts` | Navigates Playwright to URL, waits for networkidle, captures errors        |
| `WebsiteRunner`                  | `app/services/editor/core/websiteRunner.ts`         | Spawns isolated Vite dev server, port detection, stdout/stderr capture     |
| `FileExporter`                   | `app/services/editor/core/fileExporter.ts`          | Exports code_files from DB to temp directory                               |
| `ErrorExporter`                  | `app/services/editor/errors/errorExporter.ts`       | Orchestrates: export files → start Vite → capture browser errors           |
| `createMultimodalContextMessage` | `langgraph-ai-sdk`                                  | Creates HumanMessage with `{ type: "image_url" }` blocks for Claude vision |

## New Service: `app/services/editor/screenshot/screenshotService.ts`

Reuses the ErrorExporter pipeline (FileExporter → WebsiteRunner → BrowserPool) and adds `page.screenshot()`.

```typescript
export class ScreenshotService implements AsyncDisposable {
  private websiteId: number;
  private runner?: WebsiteRunner;
  private exporter?: FileExporter;

  constructor(websiteId: number) {
    this.websiteId = websiteId;
  }

  async capture(): Promise<{ screenshot: Buffer; hasErrors: boolean }> {
    // 1. Export files to temp dir
    this.exporter = new FileExporter(this.websiteId);
    const outputDir = await this.exporter.export();

    // 2. Start Vite dev server
    this.runner = new WebsiteRunner(outputDir);
    await this.runner.install();
    await this.runner.start();

    // 3. Get browser context from pool
    const context = await browserPool.getContext();
    try {
      const page = await context.newPage();
      await page.setViewportSize({ width: 1280, height: 800 });
      await page.goto(this.runner.getUrl(), { waitUntil: "networkidle", timeout: 30000 });
      await page.waitForTimeout(2000); // Let animations settle

      const screenshot = await page.screenshot({ fullPage: true, type: "png" });
      const hasErrors = (await page.$("vite-error-overlay")) !== null;

      await page.close();
      return { screenshot, hasErrors };
    } finally {
      await browserPool.releaseContext(context);
      await this.stop();
    }
  }

  async [Symbol.asyncDispose]() {
    await this.stop();
  }

  private async stop() {
    if (this.runner) await this.runner.stop();
    if (this.exporter) await this.exporter[Symbol.asyncDispose]();
  }
}
```

## Vision Scoring

Cheap Haiku call with the screenshot:

```typescript
async function scoreDesignQuality(
  screenshot: Buffer,
  state: MinimalCodingAgentState
): Promise<{ score: number; issues: string[] }> {
  const llm = await getLLM({ skill: "coding", speed: "blazing", cost: "paid", maxTier: 3 });

  const response = await llm.withStructuredOutput(scoreSchema).invoke([
    new SystemMessage(`Score this landing page screenshot 1-10 on visual quality.
Consider: visual impact, typography hierarchy, section rhythm, spacing, color usage, overall professionalism.
List the top 3 most impactful issues to fix (if score < 7).
Be specific: reference exact sections and what's wrong.`),
    new HumanMessage({
      content: [
        {
          type: "image_url",
          image_url: { url: `data:image/png;base64,${screenshot.toString("base64")}` },
        },
      ],
    }),
  ]);

  return response;
}
```

## Integration in websiteBuilderNode

After create flow completes, before returning:

```typescript
// Visual feedback loop — create flow only
if (isCreateFlow && state.websiteId) {
  try {
    const screenshotService = new ScreenshotService(state.websiteId);
    const { screenshot, hasErrors } = await screenshotService.capture();

    if (!hasErrors) {
      const { score, issues } = await scoreDesignQuality(screenshot, state);

      if (score < 7 && issues.length > 0) {
        const fixPrompt = `Fix these design issues:\n${issues.map((i, n) => `${n + 1}. ${i}`).join("\n")}`;
        await createCodingAgent(
          { ...state, isCreateFlow: false },
          { messages: [...messages, new HumanMessage(fixPrompt)], route: "single-shot" }
        );
      }
    }
  } catch (err) {
    getLogger().warn({ err }, "Visual feedback loop failed (non-fatal)");
  }
}
```

## Cost Analysis

| Step                 | Model | Tokens                      | Cost                  |
| -------------------- | ----- | --------------------------- | --------------------- |
| Screenshot capture   | -     | -                           | ~$0 (infra only, ~5s) |
| Vision scoring       | Haiku | ~2K in (image) + ~200 out   | ~$0.003               |
| Fix edit (if needed) | Haiku | ~28K in (cached) + ~500 out | ~$0.005               |
| **Total per create** |       |                             | **~$0.008**           |

## Why This Approach

1. **Reuses battle-tested infrastructure**: BrowserPool, WebsiteRunner, FileExporter are production-proven
2. **No WebContainer dependency**: Runs entirely server-side with Playwright
3. **Non-blocking**: If it fails, the user still gets their page
4. **Self-healing**: Single-shot edit fixes the top issues in one $0.005 call
5. **Bounded**: Only runs on create flow, never edits. One scoring call, one fix at most
6. **Cheap**: ~$0.008 total with prompt caching

## Alternative Considered: WebContainer Screenshots

Could use the frontend's WebContainer + html2canvas or native browser screenshot API. Rejected because:

- Depends on user's browser being open and WebContainer being booted
- Cross-origin iframe restrictions make screenshots unreliable
- Server-side Playwright is deterministic and doesn't depend on client state
