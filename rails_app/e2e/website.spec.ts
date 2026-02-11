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

      // Send a message (sendMessage waits for streaming to finish before submitting)
      const testMessage = "Make the hero section larger";
      await websitePage.sendMessage(testMessage);

      // The user's message should appear in the chat
      await expect(page.getByText(testMessage)).toBeVisible({ timeout: 5000 });
    });

    test("auto-init triggers website generation on page load", async ({ page }) => {
      // Navigate to website
      await websitePage.goto(projectUuid);

      // The auto-init should fire automatically on page load.
      // Verify the chat area shows activity — either a "Getting ready..." status
      // (streaming started) or an AI message appears.
      const gettingReady = page.getByText("Getting ready", { exact: false });
      const aiMessage = page.getByTestId("ai-message").first();

      // Wait for either indicator that auto-init fired
      await expect(gettingReady.or(aiMessage)).toBeVisible({ timeout: 15000 });
    });
  });

  test.describe("Quick Actions", () => {
    test("displays quick action buttons after loading", async ({ page }) => {
      await websitePage.goto(projectUuid);
      await page.waitForTimeout(3000);

      await expect(websitePage.changeColorsButton).toBeVisible({ timeout: 10000 });
      await expect(websitePage.swapImagesButton).toBeVisible({ timeout: 10000 });
      await expect(websitePage.improveCopyButton).toBeVisible({ timeout: 10000 });
    });

    test("Change Colors button can be clicked and expands section", async ({ page }) => {
      await websitePage.goto(projectUuid);
      await page.waitForTimeout(3000);

      await websitePage.clickQuickAction("colors");
      await expect(page.locator('text="Colors"').first()).toBeVisible({ timeout: 5000 });
    });

    test("Swap Images button can be clicked and expands section", async ({ page }) => {
      await websitePage.goto(projectUuid);
      await page.waitForTimeout(3000);

      await websitePage.clickQuickAction("images");
      // ProjectImagesSection renders an "Images" heading or upload area
      await expect(page.locator('text="Images"').first()).toBeVisible({ timeout: 5000 });
    });

    test("Improve Copy button can be clicked and expands section", async ({ page }) => {
      await websitePage.goto(projectUuid);
      await page.waitForTimeout(3000);

      await websitePage.clickQuickAction("copy");
      await expect(page.locator('text="Update Copy"').first()).toBeVisible({ timeout: 5000 });
    });

    test("clicking the same quick action button closes the panel", async ({ page }) => {
      await websitePage.goto(projectUuid);
      await page.waitForTimeout(3000);

      // Open colors
      await websitePage.clickQuickAction("colors");
      await expect(page.locator('text="Colors"').first()).toBeVisible({ timeout: 5000 });

      // Click again to close
      await websitePage.clickQuickAction("colors");
      await expect(page.locator('text="Colors"').first()).not.toBeVisible({ timeout: 5000 });
    });

    test("switching between quick actions shows the new panel", async ({ page }) => {
      await websitePage.goto(projectUuid);
      await page.waitForTimeout(3000);

      // Open colors
      await websitePage.clickQuickAction("colors");
      await expect(page.locator('text="Colors"').first()).toBeVisible({ timeout: 5000 });

      // Switch to copy
      await websitePage.clickQuickAction("copy");
      await expect(page.locator('text="Update Copy"').first()).toBeVisible({ timeout: 5000 });
      // Colors should no longer be visible (replaced by copy)
      await expect(page.locator('text="Colors"').first()).not.toBeVisible({ timeout: 3000 });
    });

    test("Improve Copy shows style options that can be clicked", async ({ page }) => {
      await websitePage.goto(projectUuid);
      await page.waitForTimeout(3000);

      await websitePage.clickQuickAction("copy");

      // All three style options should be visible
      await expect(page.locator('button:has-text("Make tone more professional")')).toBeVisible({
        timeout: 5000,
      });
      await expect(page.locator('button:has-text("Make tone more friendly")')).toBeVisible({
        timeout: 5000,
      });
      await expect(page.locator('button:has-text("Make copy shorter")')).toBeVisible({
        timeout: 5000,
      });
    });
  });

  test.describe("Error Handling", () => {
    test("handles network errors gracefully", async ({ page }) => {
      // Navigate to website
      await websitePage.goto(projectUuid);
      await websitePage.expectChatInputReady();

      // Wait for auto-init streaming to complete before going offline
      await page.waitForFunction(
        () => {
          const btn = document.querySelector('[data-testid="website-chat-submit"]');
          return btn && btn.getAttribute("aria-label") === "Send message";
        },
        { timeout: 30000 }
      );

      // Go offline
      await page.context().setOffline(true);

      // Send a message while offline (fill and click directly since sendMessage
      // would wait for aria-label which is already "Send message")
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
    test("shows loading state initially while generating", async ({ page }) => {
      // Navigate to website
      await websitePage.goto(projectUuid);

      // Initially the page shows a loading state while the agent generates content.
      // The sidebar shows step-by-step loading indicators and the main area shows
      // "Building your landing page" with the WebsiteLoader component.
      // After generation completes, the WebsitePreview replaces the loader.
      const buildingText = page.getByText("Building your landing page", { exact: false });
      const previewStatus = page.getByTestId("preview-status");

      // Either the building loader is shown (during generation) or the preview status
      // (after generation completes and WebContainer starts booting)
      await expect(buildingText.or(previewStatus)).toBeVisible({ timeout: 15000 });
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
          const hasBootingStatus = document.body.innerText.includes(
            "Starting preview environment..."
          );
          const hasMountingStatus = document.body.innerText.includes("Loading files...");
          const hasInstallingStatus = document.body.innerText.includes(
            "Installing dependencies..."
          );
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

    test("preview becomes ready with iframe displaying content", async ({ page }) => {
      // Navigate to website
      await websitePage.goto(projectUuid);

      // Wait for the full preview to be ready - this means:
      // 1. Files were received from langgraph
      // 2. WebContainer booted (using pre-built snapshot)
      // 3. Files mounted
      // 4. Dev server started
      // 5. Port opened and URL available
      await websitePage.waitForPreviewReady(180000);

      // The iframe should now be visible with a src URL
      await expect(websitePage.previewIframe).toBeVisible();

      // The iframe should have a src (the WebContainer preview URL)
      const previewUrl = await websitePage.getPreviewUrl();
      expect(previewUrl).toBeTruthy();
      expect(previewUrl).toMatch(/^https?:\/\//);
    });

    test("preview updates after sending edit message", async ({ page }) => {
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

  test.describe("Build Error UI", () => {
    test("shows build error UI when console errors are injected", async ({ page }) => {
      // Navigate to website — auto-init fires since website_step has no thread_id
      await websitePage.goto(projectUuid);
      await websitePage.expectChatInputReady();

      // Wait for streaming to finish so isStreaming=false (error UI is hidden during streaming)
      await page.waitForFunction(
        () => {
          const btn = document.querySelector('[data-testid="website-chat-submit"]');
          return btn && btn.getAttribute("aria-label") === "Send message";
        },
        { timeout: 60000 }
      );

      // Inject mock build errors via WebContainerManager singleton
      await websitePage.injectBuildErrors([
        { type: "error", message: "Failed to resolve import \"../components/NonExistent\" from \"src/pages/IndexPage.tsx\"", file: "src/pages/IndexPage.tsx" },
      ]);

      // Preview area: build-error status + "Fix errors" button
      await expect(page.getByTestId("preview-status")).toHaveAttribute("data-status", "build-error", { timeout: 5000 });
      await expect(page.getByText("We had an issue building your page")).toBeVisible();
      await expect(websitePage.fixErrorsButton).toBeVisible();

      // Sidebar: error prompt banner
      await expect(websitePage.buildErrorPrompt).toBeVisible();
      await expect(
        websitePage.buildErrorPrompt.getByText("We ran into an issue building your page")
      ).toBeVisible();
      await expect(websitePage.fixErrorsSidebarButton).toBeVisible();
    });

    test("shows real build errors when broken file is written to WebContainer", async ({ page }) => {
      // Navigate to website — auto-init generates files and boots WebContainer
      await websitePage.goto(projectUuid);

      // Wait for the full preview to be ready (WebContainer booted, Vite running)
      await websitePage.waitForPreviewReady(180000);

      // Wait for streaming to finish
      await page.waitForFunction(
        () => {
          const btn = document.querySelector('[data-testid="website-chat-submit"]');
          return btn && btn.getAttribute("aria-label") === "Send message";
        },
        { timeout: 60000 }
      );

      // Write a broken file to WebContainer — Vite will try to resolve
      // the import and fail, producing a real build error
      await websitePage.writeBrokenFileToWebContainer(
        "/src/pages/IndexPage.tsx",
        `import { NonExistent } from "../components/NonExistent";\nexport default function IndexPage() { return <NonExistent />; }\n`
      );

      // Wait for the build-error status to appear (Vite detects the broken import)
      await expect(page.getByTestId("preview-status")).toHaveAttribute("data-status", "build-error", { timeout: 15000 });
      await expect(page.getByText("We had an issue building your page")).toBeVisible();
      await expect(websitePage.fixErrorsButton).toBeVisible();

      // Sidebar error prompt should also appear
      await expect(websitePage.buildErrorPrompt).toBeVisible();
    });
  });
});
