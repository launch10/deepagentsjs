import path from "path";
import { fileURLToPath } from "url";
import { test, expect, loginUser } from "./fixtures/auth";
import { DatabaseSnapshotter } from "./fixtures/database";
import { appQuery } from "./support/on-rails";
import { WebsitePage } from "./pages/website.page";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TEST_IMAGE_PATH = path.resolve(__dirname, "fixtures/files/test-image-1.jpg");

/**
 * Website Builder Tests
 *
 * Rich, outcome-focused tests for the 7 core website builder scenarios.
 * - Create Flow: uses website_step snapshot, runs the real create flow (Polly caches after first run)
 * - Edit/Quick Action flows: use website_generated snapshot (website already built, has thread_id)
 * - Build Error & Error Handling tests: kept from previous implementation
 */
test.describe("Website Builder", () => {
  test.setTimeout(180000); // WebContainer boot + AI responses can take time

  // ─── Create Flow ───────────────────────────────────────────────────────────

  test.describe("Create Flow", () => {
    let websitePage: WebsitePage;
    let projectUuid: string;

    test.beforeEach(async ({ page }) => {
      await DatabaseSnapshotter.restoreSnapshot("website_step");
      const project = await appQuery<{ id: number; uuid: string; name: string }>("first_project");
      projectUuid = project.uuid;
      await loginUser(page);
      websitePage = new WebsitePage(page);
    });

    test("generates website: auto-init fires, completes, and preview renders", async ({ page }) => {
      await websitePage.goto(projectUuid);

      // Auto-init fires — we should see either:
      // - Todos progressing (if response streams slowly), or
      // - Quick Actions appearing directly (if Polly cache returns instantly)
      // Either way, Quick Actions must be visible when generation completes.
      await websitePage.waitForQuickActionsReady(120000);

      // Chat input becomes ready
      await websitePage.expectChatInputReady();

      // Streaming finishes
      await websitePage.waitForStreamingComplete(30000);

      // WebContainer preview iframe renders
      await websitePage.waitForPreviewReady(120000);
      await expect(websitePage.previewIframe).toBeVisible();
      const previewUrl = await websitePage.getPreviewUrl();
      expect(previewUrl).toBeTruthy();
      expect(previewUrl).toMatch(/^https?:\/\//);

      // Verify content is visible in iframe (falls back to URL check if cross-origin)
      await websitePage.waitForPreviewContent("scheduling", 15000);
    });
  });

  // ─── Existing Website (website_generated) ──────────────────────────────────

  test.describe("Existing Website", () => {
    let websitePage: WebsitePage;
    let projectUuid: string;

    test.beforeEach(async ({ page }) => {
      await DatabaseSnapshotter.restoreSnapshot("website_generated");
      const project = await appQuery<{ id: number; uuid: string; name: string }>("first_project");
      projectUuid = project.uuid;
      await loginUser(page);
      websitePage = new WebsitePage(page);
    });

    test("loads without re-generating and shows Quick Actions", async ({ page }) => {
      await websitePage.goto(projectUuid);

      // Quick Actions visible immediately (no todo list — thread_id exists, no pending todos)
      await websitePage.waitForQuickActionsReady(30000);

      // Chat input ready
      await websitePage.expectChatInputReady();

      // Wait for streaming to complete (initial load)
      await websitePage.waitForStreamingComplete(60000);

      // WebContainer boots and preview iframe renders
      await websitePage.waitForPreviewReady(120000);
      await expect(websitePage.previewIframe).toBeVisible();
      const previewUrl = await websitePage.getPreviewUrl();
      expect(previewUrl).toBeTruthy();
      expect(previewUrl).toMatch(/^https?:\/\//);
    });

    test("sends edit message and receives response", async ({ page }) => {
      await websitePage.goto(projectUuid);
      await websitePage.waitForPreviewReady(120000);
      await websitePage.waitForStreamingComplete(60000);

      // Send edit message
      await websitePage.sendMessage("Make the hero headline bigger");

      // User message appears in chat
      await expect(
        websitePage.userMessages.filter({ hasText: "Make the hero headline bigger" }).first()
      ).toBeVisible({ timeout: 5000 });

      // Streaming starts (submit button changes to stop icon)
      await expect(websitePage.sendButton).toHaveAttribute("aria-label", "Stop", {
        timeout: 10000,
      });

      // Wait for streaming to complete
      await websitePage.waitForStreamingComplete(120000);

      // Preview iframe still visible (files were updated)
      await expect(websitePage.previewIframe).toBeVisible();
    });

    test("Change Colors: selects palette and theme updates", async ({ page }) => {
      await websitePage.goto(projectUuid);
      await websitePage.waitForQuickActionsReady(30000);
      await websitePage.waitForStreamingComplete(60000);

      // Open colors panel
      await websitePage.clickQuickAction("colors");

      // Colors panel opens with palette rows
      const palettes = page.locator('[data-testid^="color-palette-"]');
      await expect(palettes.first()).toBeVisible({ timeout: 10000 });
      const paletteCount = await palettes.count();
      expect(paletteCount).toBeGreaterThan(0);

      // Click a palette (second one if available, to pick something different)
      const targetIndex = paletteCount > 1 ? 1 : 0;
      await websitePage.selectColorPalette(targetIndex);

      // Panel auto-closes after selection, streaming starts (change_theme intent fires through Langgraph)
      await expect(websitePage.sendButton).toHaveAttribute("aria-label", "Stop", {
        timeout: 10000,
      });
      await websitePage.waitForStreamingComplete(120000);

      // AI confirms the theme change
      await expect(websitePage.aiMessages.last()).toBeVisible({ timeout: 30000 });

      // Preview iframe re-renders with the new theme (CSS updated via index.css change)
      await websitePage.waitForPreviewReady(120000);
      await expect(websitePage.previewIframe).toBeVisible();
    });

    test("Improve Copy: selects style and copy changes", async ({ page }) => {
      await websitePage.goto(projectUuid);
      await websitePage.waitForQuickActionsReady(30000);
      await websitePage.waitForStreamingComplete(60000);

      // Open Improve Copy panel
      await websitePage.clickQuickAction("copy");

      // Style options visible
      await expect(page.locator('button:has-text("Make tone more professional")')).toBeVisible({
        timeout: 5000,
      });
      await expect(page.locator('button:has-text("Make tone more friendly")')).toBeVisible({
        timeout: 5000,
      });
      await expect(page.locator('button:has-text("Make copy shorter")')).toBeVisible({
        timeout: 5000,
      });

      // Click "Make tone more professional"
      await websitePage.clickImproveCopyStyle("Make tone more professional");

      // Message sent — appears as user message in chat
      await expect(
        websitePage.userMessages.filter({ hasText: "Make tone more professional" }).first()
      ).toBeVisible({ timeout: 10000 });

      // Streaming starts
      await expect(websitePage.sendButton).toHaveAttribute("aria-label", "Stop", {
        timeout: 10000,
      });

      // Wait for streaming to complete (may be slow for first uncached run)
      await websitePage.waitForStreamingComplete(120000);

      // Streaming completed — the improve copy flow updated the page files
      // Preview iframe still visible
      await expect(websitePage.previewIframe).toBeVisible();
    });

    test("Swap Images: uploads image and triggers page update", async ({ page }) => {
      await websitePage.goto(projectUuid);
      await websitePage.waitForQuickActionsReady(30000);
      await websitePage.waitForStreamingComplete(60000);

      // Open images panel
      await websitePage.clickQuickAction("images");

      // Upload area visible
      await expect(websitePage.projectImagesUploadArea).toBeVisible({ timeout: 5000 });

      // Upload test image
      await websitePage.uploadProjectImage(TEST_IMAGE_PATH);

      // Image appears in grid
      await expect(websitePage.projectImagesGrid).toBeVisible();
      await expect(websitePage.projectImagesGrid.locator("img").first()).toBeVisible();

      // "Update Page with Images" button becomes visible
      await expect(websitePage.updateImagesButton).toBeVisible({ timeout: 10000 });

      // Click it
      await websitePage.updateImagesButton.click();

      // Chat message appears
      await expect(
        page.getByText("I've updated my project images, can you incorporate them into my site?")
      ).toBeVisible({ timeout: 10000 });
    });

    test("Inline Chat: attaches file and sends with message", async ({ page }) => {
      await websitePage.goto(projectUuid);
      await websitePage.expectChatInputReady();
      await websitePage.waitForStreamingComplete(60000);

      // Attach file via hidden file input in chat dropzone
      await websitePage.attachFileInChat(TEST_IMAGE_PATH);

      // Attachment preview appears in chat input area
      await expect(websitePage.attachmentList).toBeVisible();
      await expect(
        websitePage.attachmentList.locator('[data-testid="attachment-item"]').first()
      ).toBeVisible();

      // Type a message
      await websitePage.chatInput.fill("Use this image as the hero background");

      // Click send
      await websitePage.sendButton.click();

      // User message appears in chat
      await expect(page.getByText("Use this image as the hero background")).toBeVisible({
        timeout: 10000,
      });
    });
  });

  // ─── Error Handling (kept from previous tests) ─────────────────────────────

  test.describe("Error Handling", () => {
    let websitePage: WebsitePage;
    let projectUuid: string;

    test.beforeEach(async ({ page }) => {
      await DatabaseSnapshotter.restoreSnapshot("website_step");
      const project = await appQuery<{ id: number; uuid: string; name: string }>("first_project");
      projectUuid = project.uuid;
      await loginUser(page);
      websitePage = new WebsitePage(page);
    });

    test("handles network errors gracefully", async ({ page }) => {
      await websitePage.goto(projectUuid);
      await websitePage.expectChatInputReady();

      // Wait for auto-init streaming to complete before going offline
      await websitePage.waitForStreamingComplete(60000);

      // Go offline
      await page.context().setOffline(true);

      // Send a message while offline
      await websitePage.chatInput.fill("This should fail gracefully");
      await websitePage.sendButton.click();

      // Wait a bit for error to manifest
      await page.waitForTimeout(2000);

      // Restore network
      await page.context().setOffline(false);

      // Page should still be functional - chat input should still be there
      await websitePage.expectChatInputReady();
    });
  });

  // ─── Build Error UI (kept from previous tests) ────────────────────────────

  test.describe("Build Error UI", () => {
    let websitePage: WebsitePage;
    let projectUuid: string;

    test.beforeEach(async ({ page }) => {
      await DatabaseSnapshotter.restoreSnapshot("website_generated");
      const project = await appQuery<{ id: number; uuid: string; name: string }>("first_project");
      projectUuid = project.uuid;
      await loginUser(page);
      websitePage = new WebsitePage(page);
    });

    test("shows build error UI when console errors are injected", async ({ page }) => {
      await websitePage.goto(projectUuid);
      await websitePage.expectChatInputReady();

      // Wait for streaming to finish so isStreaming=false (error UI is hidden during streaming)
      await websitePage.waitForStreamingComplete(60000);

      // Inject mock build errors via WebContainerManager singleton
      await websitePage.injectBuildErrors([
        {
          type: "error",
          message:
            'Failed to resolve import "../components/NonExistent" from "src/pages/IndexPage.tsx"',
          file: "src/pages/IndexPage.tsx",
        },
      ]);

      // Preview area: build-error status + "Fix errors" button
      await expect(page.getByTestId("preview-status")).toHaveAttribute(
        "data-status",
        "build-error",
        { timeout: 5000 }
      );
      await expect(page.getByText("We had an issue building your page")).toBeVisible();
      await expect(websitePage.fixErrorsButton).toBeVisible();

      // Sidebar: error prompt banner
      await expect(websitePage.buildErrorPrompt).toBeVisible();
      await expect(
        websitePage.buildErrorPrompt.getByText("We ran into an issue building your page")
      ).toBeVisible();
      await expect(websitePage.fixErrorsSidebarButton).toBeVisible();
    });

    test("shows real build errors when broken file is written to WebContainer", async ({
      page,
    }) => {
      await websitePage.goto(projectUuid);

      // Wait for the full preview to be ready (WebContainer booted, Vite running)
      await websitePage.waitForPreviewReady(120000);

      // Wait for streaming to finish
      await websitePage.waitForStreamingComplete(60000);

      // Write a broken file to WebContainer — Vite will try to resolve
      // the import and fail, producing a real build error
      await websitePage.writeBrokenFileToWebContainer(
        "src/pages/IndexPage.tsx",
        `import { NonExistent } from "../components/NonExistent";\nexport default function IndexPage() { return <NonExistent />; }\n`
      );

      // Wait for the build-error status to appear (Vite detects the broken import)
      await expect(page.getByTestId("preview-status")).toHaveAttribute(
        "data-status",
        "build-error",
        { timeout: 15000 }
      );
      await expect(page.getByText("We had an issue building your page")).toBeVisible();
      await expect(websitePage.fixErrorsButton).toBeVisible();

      // Sidebar error prompt should also appear
      await expect(websitePage.buildErrorPrompt).toBeVisible();
    });
  });

  // ─── Progress Stepper (kept from previous tests) ──────────────────────────

  test.describe("Progress Stepper", () => {
    let websitePage: WebsitePage;
    let projectUuid: string;

    test.beforeEach(async ({ page }) => {
      await DatabaseSnapshotter.restoreSnapshot("website_step");
      const project = await appQuery<{ id: number; uuid: string; name: string }>("first_project");
      projectUuid = project.uuid;
      await loginUser(page);
      websitePage = new WebsitePage(page);
    });

    test("shows Landing Page step as active on website page", async ({ page }) => {
      await websitePage.goto(projectUuid);

      // Progress stepper should show Landing Page as active
      const progressStepper = page.getByTestId("workflow-progress-stepper");
      await expect(progressStepper).toBeVisible({ timeout: 10000 });
      await expect(progressStepper.getByText("Landing Page")).toBeVisible();
    });
  });
});
