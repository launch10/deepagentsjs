import { test, expect, loginUser } from "./fixtures/auth";
import { DatabaseSnapshotter } from "./fixtures/database";
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
    const project = await DatabaseSnapshotter.getFirstProject();
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
});
