import { test, expect, loginUser } from "./fixtures/auth";
import { DatabaseSnapshotter } from "./fixtures/database";
import { appQuery } from "./support/on-rails";
import { WebsitePage } from "./pages/website.page";

/**
 * Website Builder Tests
 *
 * These tests verify the Website (Landing Page Builder) page functionality.
 * Uses the website_step snapshot which has a project already at the website step.
 *
 * IMPORTANT: Tests rely on CACHE_MODE=true in langgraph_app/.env for fast,
 * deterministic responses without making actual AI calls.
 */
test.describe("Website Builder", () => {
  test.setTimeout(120000); // Longer timeout for AI responses

  let websitePage: WebsitePage;
  let projectUuid: string;

  test.beforeEach(async ({ page }) => {
    await DatabaseSnapshotter.restoreSnapshot("website_step");
    const project = await appQuery<{ id: number; uuid: string; name: string }>("first_project");
    projectUuid = project.uuid;
    await loginUser(page);
    websitePage = new WebsitePage(page);
  });

  test.describe("Page Loading", () => {
    test("displays sidebar when navigating to website page", async ({ page }) => {
      // Navigate directly to website page using project from snapshot
      await websitePage.goto(projectUuid);

      // Should show the sidebar
      await websitePage.expectSidebarVisible();
    });

    test("displays sidebar with Landing Page Designer title", async ({ page }) => {
      // Navigate to website
      await websitePage.goto(projectUuid);

      // Sidebar should show Landing Page Designer
      await expect(page.locator('text="Landing Page Designer"')).toBeVisible();
    });
  });

  test.describe("Chat Functionality", () => {
    test("displays chat input when page is loaded", async ({ page }) => {
      // Navigate to website
      await websitePage.goto(projectUuid);

      // Wait for loading to complete
      await page.waitForTimeout(2000);

      // Chat input should eventually be visible (after loading completes)
      await websitePage.expectChatInputReady();
    });

    test("can send a message and see it in chat", async ({ page }) => {
      // Navigate to website
      await websitePage.goto(projectUuid);

      // Wait for chat input to be ready
      await websitePage.expectChatInputReady();

      // Wait for initial generation to complete (files should appear in preview)
      // The preview starts in "idle" state showing "Waiting for files..."
      // We need to wait until the preview is ready or shows content
      await page.waitForTimeout(5000);

      // Send a message
      const testMessage = "Make the hero section larger";
      await websitePage.sendMessage(testMessage);

      // The user's message should appear in the chat
      await expect(page.getByText(testMessage)).toBeVisible({ timeout: 5000 });
    });

    test("auto-init produces AI response with landing page creation message", async ({ page }) => {
      // Navigate to website
      await websitePage.goto(projectUuid);

      // The auto-init should fire and send create command to langgraph
      // In CACHE_MODE, this should return quickly with a deterministic AI message
      // The expected message from cacheMode.ts is:
      // "I've created a scheduling tool landing page for you with a hero section, features, and pricing."

      // Wait for the AI message to appear (this verifies the full flow works)
      const aiMessageText = "I've created a scheduling tool landing page";
      await expect(page.getByText(aiMessageText, { exact: false })).toBeVisible({
        timeout: 30000,
      });
    });
  });

  test.describe("Quick Actions", () => {
    test("displays quick action buttons after loading", async ({ page }) => {
      // Navigate to website
      await websitePage.goto(projectUuid);

      // Wait for loading to complete
      await page.waitForTimeout(3000);

      // Quick action buttons should be visible
      await expect(websitePage.changeColorsButton).toBeVisible({ timeout: 10000 });
      await expect(websitePage.swapImagesButton).toBeVisible({ timeout: 10000 });
      await expect(websitePage.improveCopyButton).toBeVisible({ timeout: 10000 });
    });

    test("Change Colors button can be clicked and expands section", async ({ page }) => {
      await websitePage.goto(projectUuid);
      await page.waitForTimeout(3000);

      // Click Change Colors
      await websitePage.clickQuickAction("colors");

      // Should expand to show color options (color palette section)
      await expect(page.locator('text="Colors"').first()).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe("Error Handling", () => {
    test("handles network errors gracefully", async ({ page }) => {
      // Navigate to website
      await websitePage.goto(projectUuid);
      await websitePage.expectChatInputReady();
      await page.waitForTimeout(3000);

      // Go offline
      await page.context().setOffline(true);

      // Try to send a message
      await websitePage.sendMessage("This should fail gracefully");

      // Wait a bit for error to manifest
      await page.waitForTimeout(2000);

      // Restore network
      await page.context().setOffline(false);

      // Page should still be functional - chat input should still be there
      await websitePage.expectChatInputReady();
    });
  });

  test.describe("Progress Stepper", () => {
    test("shows Landing Page step as active on website page", async ({ page }) => {
      // Navigate to website
      await websitePage.goto(projectUuid);

      // Progress stepper should show Landing Page as active
      const progressStepper = page.getByTestId("workflow-progress-stepper");
      await expect(progressStepper).toBeVisible({ timeout: 10000 });

      // Landing Page step should be visible within the stepper
      await expect(progressStepper.getByText("Landing Page")).toBeVisible();
    });
  });

  test.describe("WebContainer Preview", () => {
    test("shows preview loading state initially", async ({ page }) => {
      // Navigate to website
      await websitePage.goto(projectUuid);

      // We should see a preview status initially (idle state)
      // The preview goes through: idle -> booting -> mounting -> installing -> starting -> ready
      const previewStatus = page.getByTestId("preview-status");

      // Wait for the status to appear
      await expect(previewStatus).toBeVisible({ timeout: 10000 });

      // Should show "Waiting for files..." initially
      await expect(page.getByText("Waiting for files...")).toBeVisible({ timeout: 5000 });
    });

    test("receives files from langgraph after auto-init", async ({ page }) => {
      // Navigate to website
      await websitePage.goto(projectUuid);

      // Wait a bit for auto-init to trigger
      await page.waitForTimeout(2000);

      // The agent should auto-send the create command
      // Files should start loading, moving past "idle" state
      // Wait for status to change from "idle" to any loading state (booting, mounting, etc.)
      // or directly to the preview container (if WebContainer boots very fast)
      const statusChanged = await page.waitForFunction(
        () => {
          // Check if we've moved past "Waiting for files..."
          const idleText = document.body.innerText.includes("Waiting for files...");
          const hasBootingStatus = document.body.innerText.includes("Starting preview environment...");
          const hasMountingStatus = document.body.innerText.includes("Loading files...");
          const hasInstallingStatus = document.body.innerText.includes("Installing dependencies...");
          const hasStartingStatus = document.body.innerText.includes("Starting preview server...");
          const hasPreviewContainer = document.querySelector('[data-testid="preview-container"]');

          // Return true if we've progressed past idle OR if we're showing the preview
          return (
            !idleText ||
            hasBootingStatus ||
            hasMountingStatus ||
            hasInstallingStatus ||
            hasStartingStatus ||
            hasPreviewContainer
          );
        },
        { timeout: 60000 }
      );

      expect(statusChanged).toBeTruthy();
    });

    // Note: Full WebContainer boot tests are slow (npm install) and may timeout
    // in CI environments. These tests are marked for manual/local verification.
    test.skip("preview becomes ready with iframe displaying content", async ({ page }) => {
      // Navigate to website
      await websitePage.goto(projectUuid);

      // Wait for the full preview to be ready - this means:
      // 1. Files were received from langgraph
      // 2. WebContainer booted
      // 3. Files mounted
      // 4. npm install completed
      // 5. Dev server started
      // 6. Port opened and URL available
      await websitePage.waitForPreviewReady(180000);

      // The iframe should now be visible with a src URL
      await expect(websitePage.previewIframe).toBeVisible();

      // The iframe should have a src (the WebContainer preview URL)
      const previewUrl = await websitePage.getPreviewUrl();
      expect(previewUrl).toBeTruthy();
      expect(previewUrl).toMatch(/^https?:\/\//);
    });

    test.skip("preview updates after sending edit message", async ({ page }) => {
      // Navigate to website
      await websitePage.goto(projectUuid);

      // Wait for initial preview to be ready
      await websitePage.waitForPreviewReady(180000);

      // Get the initial preview URL
      const initialUrl = await websitePage.getPreviewUrl();
      expect(initialUrl).toBeTruthy();

      // Wait for chat input
      await websitePage.expectChatInputReady();

      // Send an edit message
      const editMessage = "Make the headline bigger";
      await websitePage.sendMessage(editMessage);

      // User message should appear
      await expect(page.getByText(editMessage)).toBeVisible({ timeout: 5000 });

      // Wait for the AI to respond (thinking indicator appears then disappears)
      await websitePage.waitForResponse(60000);

      // The preview should still be ready (files were updated and re-mounted)
      // The iframe should still be visible
      await expect(websitePage.previewIframe).toBeVisible();

      // Preview URL should still exist (same server, updated content)
      const updatedUrl = await websitePage.getPreviewUrl();
      expect(updatedUrl).toBeTruthy();
    });
  });
});
