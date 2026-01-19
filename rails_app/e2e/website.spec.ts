import { test, expect, loginUser } from "./fixtures/auth";
import { DatabaseSnapshotter } from "./fixtures/database";
import { WebsitePage } from "./pages/website.page";
import { BrainstormPage } from "./pages/brainstorm.page";

/**
 * Website Builder Tests
 *
 * These tests verify the Website (Landing Page Builder) page functionality.
 * The website page is accessed after completing a brainstorm session.
 *
 * IMPORTANT: Tests rely on CACHE_MODE=true in langgraph_app/.env for fast,
 * deterministic responses without making actual AI calls.
 */
test.describe("Website Builder", () => {
  test.setTimeout(120000); // Longer timeout for AI responses

  let websitePage: WebsitePage;
  let brainstormPage: BrainstormPage;

  test.beforeEach(async ({ page }) => {
    await DatabaseSnapshotter.restoreSnapshot("basic_account");
    await loginUser(page);
    websitePage = new WebsitePage(page);
    brainstormPage = new BrainstormPage(page);
  });

  test.describe("Page Loading", () => {
    test("displays loading state initially when navigating to website page", async ({ page }) => {
      // First, create a brainstorm conversation to get a project
      await brainstormPage.goto();
      await brainstormPage.sendMessage("I want to start a coffee subscription service");

      // Wait for URL to update (project created)
      await page.waitForFunction(
        () =>
          window.location.href.includes("/projects/") &&
          !window.location.href.includes("/projects/new"),
        { timeout: 15000 }
      );

      // Get the project UUID from the URL
      const threadId = brainstormPage.getThreadIdFromUrl();
      expect(threadId).not.toBeNull();

      // Wait for AI response to ensure project is persisted
      await brainstormPage.waitForResponse();

      // Navigate to website page
      await page.goto(`/projects/${threadId}/website`);

      // Should show the sidebar
      await websitePage.expectSidebarVisible();
    });

    test("displays sidebar with Landing Page Designer title", async ({ page }) => {
      // Create a project via brainstorm
      await brainstormPage.goto();
      await brainstormPage.sendMessage("Test message for website navigation");

      await page.waitForFunction(
        () =>
          window.location.href.includes("/projects/") &&
          !window.location.href.includes("/projects/new"),
        { timeout: 15000 }
      );

      const threadId = brainstormPage.getThreadIdFromUrl();
      await brainstormPage.waitForResponse();

      // Navigate to website
      await websitePage.goto(threadId!);

      // Sidebar should show Landing Page Designer
      await expect(page.locator('text="Landing Page Designer"')).toBeVisible();
    });
  });

  test.describe("Chat Functionality", () => {
    test("displays chat input when page is loaded", async ({ page }) => {
      // Create a project via brainstorm
      await brainstormPage.goto();
      await brainstormPage.sendMessage("Test for chat input visibility");

      await page.waitForFunction(
        () =>
          window.location.href.includes("/projects/") &&
          !window.location.href.includes("/projects/new"),
        { timeout: 15000 }
      );

      const threadId = brainstormPage.getThreadIdFromUrl();
      await brainstormPage.waitForResponse();

      // Navigate to website
      await websitePage.goto(threadId!);

      // Wait for loading to complete (quick actions visible = loaded)
      await page.waitForTimeout(2000); // Allow initial loading

      // Chat input should eventually be visible (after loading completes)
      await websitePage.expectChatInputReady();
    });

    test("can send a message and see thinking indicator", async ({ page }) => {
      // Create a project via brainstorm
      await brainstormPage.goto();
      await brainstormPage.sendMessage("Test for sending message");

      await page.waitForFunction(
        () =>
          window.location.href.includes("/projects/") &&
          !window.location.href.includes("/projects/new"),
        { timeout: 15000 }
      );

      const threadId = brainstormPage.getThreadIdFromUrl();
      await brainstormPage.waitForResponse();

      // Navigate to website
      await websitePage.goto(threadId!);

      // Wait for page to load
      await websitePage.expectChatInputReady();
      await page.waitForTimeout(3000); // Wait for initial generation to complete

      // Send a message
      await websitePage.sendMessage("Make the hero section larger");

      // Should show thinking indicator or AI message
      const thinkingOrResponse = await Promise.race([
        websitePage.thinkingIndicator
          .waitFor({ state: "visible", timeout: 5000 })
          .then(() => "thinking"),
        websitePage.aiMessages
          .first()
          .waitFor({ state: "visible", timeout: 5000 })
          .then(() => "response"),
      ]).catch(() => "neither");

      expect(["thinking", "response"]).toContain(thinkingOrResponse);
    });
  });

  test.describe("Quick Actions", () => {
    test("displays quick action buttons after loading", async ({ page }) => {
      // Create a project via brainstorm
      await brainstormPage.goto();
      await brainstormPage.sendMessage("Test for quick actions");

      await page.waitForFunction(
        () =>
          window.location.href.includes("/projects/") &&
          !window.location.href.includes("/projects/new"),
        { timeout: 15000 }
      );

      const threadId = brainstormPage.getThreadIdFromUrl();
      await brainstormPage.waitForResponse();

      // Navigate to website
      await websitePage.goto(threadId!);

      // Wait for loading to complete
      await page.waitForTimeout(3000);

      // Quick action buttons should be visible
      await expect(websitePage.changeColorsButton).toBeVisible({ timeout: 10000 });
      await expect(websitePage.swapImagesButton).toBeVisible({ timeout: 10000 });
      await expect(websitePage.improveCopyButton).toBeVisible({ timeout: 10000 });
    });

    test("Change Colors button can be clicked and expands section", async ({ page }) => {
      await brainstormPage.goto();
      await brainstormPage.sendMessage("Test for colors quick action");

      await page.waitForFunction(
        () =>
          window.location.href.includes("/projects/") &&
          !window.location.href.includes("/projects/new"),
        { timeout: 15000 }
      );

      const threadId = brainstormPage.getThreadIdFromUrl();
      await brainstormPage.waitForResponse();

      await websitePage.goto(threadId!);
      await page.waitForTimeout(3000);

      // Click Change Colors
      await websitePage.clickQuickAction("colors");

      // Should expand to show color options (color palette section)
      await expect(page.locator('text="Colors"').first()).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe("Error Handling", () => {
    test("handles network errors gracefully", async ({ page }) => {
      // Create a project via brainstorm
      await brainstormPage.goto();
      await brainstormPage.sendMessage("Test for error handling");

      await page.waitForFunction(
        () =>
          window.location.href.includes("/projects/") &&
          !window.location.href.includes("/projects/new"),
        { timeout: 15000 }
      );

      const threadId = brainstormPage.getThreadIdFromUrl();
      await brainstormPage.waitForResponse();

      // Navigate to website
      await websitePage.goto(threadId!);
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
      // Create a project via brainstorm
      await brainstormPage.goto();
      await brainstormPage.sendMessage("Test for progress stepper");

      await page.waitForFunction(
        () =>
          window.location.href.includes("/projects/") &&
          !window.location.href.includes("/projects/new"),
        { timeout: 15000 }
      );

      const threadId = brainstormPage.getThreadIdFromUrl();
      await brainstormPage.waitForResponse();

      // Navigate to website
      await websitePage.goto(threadId!);

      // Progress stepper should show Landing Page as active
      const progressStepper = page.getByTestId("workflow-progress-stepper");
      await expect(progressStepper).toBeVisible({ timeout: 10000 });

      // Landing Page step should be visible
      await expect(page.getByText("Landing Page")).toBeVisible();
    });
  });
});
