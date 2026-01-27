import { test, expect, loginUser, testUser } from "../fixtures/auth";
import { DatabaseSnapshotter } from "../fixtures/database";
import { BrainstormPage } from "../pages/brainstorm.page";
import { e2eConfig } from "../config";

test.describe("Credit Exhaustion", () => {
  let brainstormPage: BrainstormPage;

  test.describe("Pre-run 402 Response (Mocked)", () => {
    test.beforeEach(async ({ page }) => {
      await DatabaseSnapshotter.restoreSnapshot("basic_account");
      await loginUser(page);
      brainstormPage = new BrainstormPage(page);
    });

    test("shows exhaustion modal when Langgraph returns 402", async ({ page }) => {
      // Intercept the Langgraph stream endpoint and return 402
      await page.route("**/api/brainstorm/stream", async (route) => {
        await route.fulfill({
          status: 402,
          contentType: "application/json",
          body: JSON.stringify({
            error: "Insufficient credits",
            code: "CREDITS_EXHAUSTED",
            balance: 0,
            planCredits: 0,
            packCredits: 0,
          }),
        });
      });

      await brainstormPage.goto();

      // Send a message which will trigger the mocked 402 response
      await brainstormPage.chatInput.fill("Test message for credit exhaustion");
      await brainstormPage.sendButton.click();

      // Verify the exhaustion modal appears
      await expect(page.getByText("You've run out of credits")).toBeVisible({
        timeout: 10000,
      });

      // Verify the modal has the expected content
      await expect(page.getByRole("link", { name: "Upgrade Plan" })).toBeVisible();
      await expect(page.getByRole("link", { name: "Purchase Credit Pack" })).toBeVisible();
      await expect(page.getByText("Dismiss for now")).toBeVisible();
    });

    test("can dismiss the exhaustion modal", async ({ page }) => {
      // Intercept the Langgraph stream endpoint and return 402
      await page.route("**/api/brainstorm/stream", async (route) => {
        await route.fulfill({
          status: 402,
          contentType: "application/json",
          body: JSON.stringify({
            error: "Insufficient credits",
            code: "CREDITS_EXHAUSTED",
            balance: 0,
            planCredits: 0,
            packCredits: 0,
          }),
        });
      });

      await brainstormPage.goto();

      // Trigger the modal
      await brainstormPage.chatInput.fill("Test message");
      await brainstormPage.sendButton.click();

      // Wait for modal to appear
      await expect(page.getByText("You've run out of credits")).toBeVisible({
        timeout: 10000,
      });

      // Dismiss the modal
      await page.getByText("Dismiss for now").click();

      // Verify modal is hidden
      await expect(page.getByText("You've run out of credits")).not.toBeVisible();
    });
  });

  test.describe("Real Credit Exhaustion Flow", () => {
    test.beforeEach(async ({ page }) => {
      await DatabaseSnapshotter.restoreSnapshot("basic_account");

      // Set credits to 1 millicent (essentially 0 - will be exhausted after first LLM call)
      await DatabaseSnapshotter.setCredits(testUser.email, 1, 0);

      await loginUser(page);
      brainstormPage = new BrainstormPage(page);
    });

    test("shows exhaustion modal after real brainstorm depletes credits", async ({ page }) => {
      await brainstormPage.goto();

      // Send a real brainstorm message
      // This will make an actual LLM call which costs more than 1 millicent
      await brainstormPage.sendMessage("I want to start a coffee subscription service");

      // Wait for the AI response to complete
      await brainstormPage.waitForResponse(e2eConfig.timeouts.aiResponse);

      // After the response, the credit status should trigger the modal
      // The modal should appear when justExhausted is detected
      await expect(page.getByText("You've run out of credits")).toBeVisible({
        timeout: 15000,
      });

      // Verify modal content shows the low/negative balance
      await expect(page.getByRole("link", { name: "Upgrade Plan" })).toBeVisible();
    });

    test("clicking submit when exhausted shows modal instead of sending", async ({ page }) => {
      await brainstormPage.goto();

      // Send a message to exhaust credits
      await brainstormPage.sendMessage("I want to start a coffee subscription service");
      await brainstormPage.waitForResponse(e2eConfig.timeouts.aiResponse);

      // Wait for the modal to appear (confirms exhaustion detected)
      await expect(page.getByText("You've run out of credits")).toBeVisible({
        timeout: 15000,
      });

      // Dismiss the modal
      await page.getByText("Dismiss for now").click();
      await expect(page.getByText("You've run out of credits")).not.toBeVisible();

      // Try to send another message - the button should still be clickable
      // but clicking it should show the modal instead of submitting
      await brainstormPage.chatInput.fill("Another test message");
      await brainstormPage.sendButton.click();

      // The modal should appear again instead of sending the message
      await expect(page.getByText("You've run out of credits")).toBeVisible({
        timeout: 5000,
      });

      // Verify no new user message was added (the message wasn't sent)
      const userMessageCount = await brainstormPage.getUserMessageCount();
      // Should still be 1 (only the original message)
      expect(userMessageCount).toBe(1);
    });
  });
});
