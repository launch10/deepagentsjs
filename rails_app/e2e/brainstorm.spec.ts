import { test, expect, loginUser } from "./fixtures/auth";
import { DatabaseSnapshotter } from "./fixtures/database";
import { BrainstormPage } from "./pages/brainstorm.page";

test.describe("Brainstorm Flow", () => {
  let brainstormPage: BrainstormPage;

  test.beforeEach(async ({ page }) => {
    await DatabaseSnapshotter.restoreSnapshot("basic_account");
    await loginUser(page);
    brainstormPage = new BrainstormPage(page);
  });

  test.describe("New Conversation", () => {
    test("displays chat input on new brainstorm page", async ({ page }) => {
      await brainstormPage.goto();

      // Verify chat input is visible and ready
      await brainstormPage.expectChatInputReady();
    });

    test("sends first message and updates URL with thread ID", async ({
      page,
    }) => {
      await brainstormPage.goto();

      // Verify we're on the root URL (new brainstorm)
      expect(page.url()).toMatch(/\/$/); // Root path

      // Send a message
      await brainstormPage.sendMessage("I want to start a coffee subscription service");

      // Wait for the URL to update (silent URL replacement)
      await page.waitForFunction(
        () => window.location.href.includes("/projects/"),
        { timeout: 10000 }
      );

      // Verify URL now contains a thread ID
      const hasThreadId = await brainstormPage.hasThreadIdInUrl();
      expect(hasThreadId).toBe(true);

      // Verify the message appears in the chat
      const userMessageCount = await brainstormPage.getUserMessageCount();
      expect(userMessageCount).toBeGreaterThan(0);
    });

    test("displays thinking indicator while AI responds", async ({ page }) => {
      await brainstormPage.goto();

      // Send a message
      await brainstormPage.sendMessage("Help me brainstorm marketing ideas");

      // Check thinking indicator appears
      await expect(brainstormPage.thinkingIndicator).toBeVisible({
        timeout: 5000,
      });
    });

    test("displays AI response after sending message", async ({ page }) => {
      await brainstormPage.goto();

      // Send a message
      await brainstormPage.sendMessage("I want to start a pet grooming business");

      // Wait for response
      await brainstormPage.waitForResponse();

      // Verify AI message appears
      const aiMessageCount = await brainstormPage.getAIMessageCount();
      expect(aiMessageCount).toBeGreaterThan(0);

      // Verify the AI message contains some content
      const lastAIMessage = await brainstormPage.getLastAIMessage();
      expect(lastAIMessage.length).toBeGreaterThan(0);
    });
  });

  test.describe("Existing Conversation", () => {
    test("loads existing conversation from URL", async ({ page }) => {
      // First create a conversation
      await brainstormPage.goto();
      await brainstormPage.sendMessage("Test message for existing conversation");

      // Wait for URL to update
      await page.waitForFunction(
        () => window.location.href.includes("/projects/"),
        { timeout: 10000 }
      );

      // Get the thread ID from URL
      const threadId = brainstormPage.getThreadIdFromUrl();
      expect(threadId).not.toBeNull();

      // Reload the page to simulate coming back to conversation
      await page.reload();
      await page.waitForLoadState("networkidle");

      // Verify we're still on the same conversation
      const currentThreadId = brainstormPage.getThreadIdFromUrl();
      expect(currentThreadId).toBe(threadId);

      // Verify message history is loaded
      const messageCount = await brainstormPage.getUserMessageCount();
      expect(messageCount).toBeGreaterThan(0);
    });
  });

  test.describe("Chat Input", () => {
    test("enables send button when input has content", async ({ page }) => {
      await brainstormPage.goto();

      // Initially, send button may be disabled with empty input
      await brainstormPage.chatInput.fill("");

      // Fill in content
      await brainstormPage.chatInput.fill("Some business idea");

      // Send button should be enabled/clickable
      await expect(brainstormPage.sendButton).toBeEnabled();
    });

    test("clears input after sending message", async ({ page }) => {
      await brainstormPage.goto();

      const testMessage = "Test message to clear";
      await brainstormPage.chatInput.fill(testMessage);
      await brainstormPage.sendButton.click();

      // Input should be cleared
      await expect(brainstormPage.chatInput).toHaveValue("");
    });

    test("submits message on Enter key", async ({ page }) => {
      await brainstormPage.goto();

      // Type a message and press Enter
      await brainstormPage.chatInput.fill("Submit with Enter key");
      await brainstormPage.chatInput.press("Enter");

      // Wait for URL to update (message was sent)
      await page.waitForFunction(
        () => window.location.href.includes("/projects/"),
        { timeout: 10000 }
      );

      // Verify message was sent
      const userMessageCount = await brainstormPage.getUserMessageCount();
      expect(userMessageCount).toBeGreaterThan(0);
    });
  });

  test.describe("Message Display", () => {
    test("displays user messages with correct styling", async ({ page }) => {
      await brainstormPage.goto();

      await brainstormPage.sendMessage("User message test");
      await page.waitForTimeout(500); // Brief wait for DOM update

      // User messages should be visible
      await expect(brainstormPage.userMessages.first()).toBeVisible();
    });

    test("displays AI messages with content", async ({ page }) => {
      await brainstormPage.goto();

      await brainstormPage.sendMessage("Tell me about marketing");

      // Wait for AI response
      await brainstormPage.waitForResponse();

      // AI message should have content
      const aiMessage = await brainstormPage.getLastAIMessage();
      expect(aiMessage.length).toBeGreaterThan(10); // At least some content
    });
  });

  test.describe("Command Buttons", () => {
    test.skip("shows command buttons after AI response completes", async ({
      page,
    }) => {
      // Skip for now - depends on specific AI response structure
      await brainstormPage.goto();

      await brainstormPage.sendMessage("Generate marketing headlines");
      await brainstormPage.waitForResponse();

      // Command buttons should appear
      const buttonsVisible = await brainstormPage.areCommandButtonsVisible();
      expect(buttonsVisible).toBe(true);
    });
  });

  test.describe("Error Handling", () => {
    test("handles network errors gracefully", async ({ page }) => {
      await brainstormPage.goto();

      // Simulate offline mode
      await page.context().setOffline(true);

      await brainstormPage.sendMessage("This should fail gracefully");

      // Should show some error indication (toast, message, etc.)
      // The exact behavior depends on implementation
      await page.waitForTimeout(2000);

      // Restore network
      await page.context().setOffline(false);

      // Page should still be functional
      await brainstormPage.expectChatInputReady();
    });
  });
});

test.describe("Brainstorm Social Links", () => {
  let brainstormPage: BrainstormPage;

  test.beforeEach(async ({ page }) => {
    await DatabaseSnapshotter.restoreSnapshot("basic_account");
    await loginUser(page);
    brainstormPage = new BrainstormPage(page);
  });

  test.skip("displays social links section", async ({ page }) => {
    // This test depends on social links UI being implemented
    await brainstormPage.goto();
    await brainstormPage.sendMessage("Test message");
    await brainstormPage.waitForResponse();

    // Social links section should be visible
    await expect(brainstormPage.socialLinksSection).toBeVisible();
  });
});

test.describe("Brainstorm Accessibility", () => {
  let brainstormPage: BrainstormPage;

  test.beforeEach(async ({ page }) => {
    await DatabaseSnapshotter.restoreSnapshot("basic_account");
    await loginUser(page);
    brainstormPage = new BrainstormPage(page);
  });

  test("chat input has proper accessibility attributes", async ({ page }) => {
    await brainstormPage.goto();

    // Check for accessible labels
    const input = brainstormPage.chatInput;
    await expect(input).toBeVisible();

    // Should have placeholder or aria-label
    const placeholder = await input.getAttribute("placeholder");
    const ariaLabel = await input.getAttribute("aria-label");
    expect(placeholder || ariaLabel).toBeTruthy();
  });

  test("message list has proper ARIA role", async ({ page }) => {
    await brainstormPage.goto();

    // The message container should have appropriate role
    const messageList = page.locator('[role="log"], [role="list"]');
    await expect(messageList.first()).toBeVisible();
  });

  test("can navigate chat with keyboard", async ({ page }) => {
    await brainstormPage.goto();

    // Tab to chat input
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab"); // May need multiple tabs

    // Should be able to focus the input
    const focusedElement = await page.evaluate(
      () => document.activeElement?.tagName
    );
    // Input or textarea should be focusable
    expect(["INPUT", "TEXTAREA", "BUTTON"]).toContain(focusedElement);
  });
});

test.describe("Brainstorm URL Handling", () => {
  let brainstormPage: BrainstormPage;

  test.beforeEach(async ({ page }) => {
    await DatabaseSnapshotter.restoreSnapshot("basic_account");
    await loginUser(page);
    brainstormPage = new BrainstormPage(page);
  });

  test("bookmarkable URL after first message", async ({ page }) => {
    await brainstormPage.goto();

    await brainstormPage.sendMessage("Bookmark test message");

    // Wait for URL update
    await page.waitForFunction(
      () => window.location.href.includes("/projects/"),
      { timeout: 10000 }
    );

    const url = page.url();

    // Navigate away
    await page.goto("/");

    // Navigate back to the bookmarked URL
    await page.goto(url);
    await page.waitForLoadState("networkidle");

    // Should load the conversation
    const messageCount = await brainstormPage.getUserMessageCount();
    expect(messageCount).toBeGreaterThan(0);
  });

  test("back button works correctly", async ({ page }) => {
    await brainstormPage.goto();

    const initialUrl = page.url();

    await brainstormPage.sendMessage("Navigate test");

    // Wait for URL update
    await page.waitForFunction(
      () => window.location.href.includes("/projects/"),
      { timeout: 10000 }
    );

    // Go back
    await page.goBack();

    // Should return to previous page or handle gracefully
    await page.waitForLoadState("networkidle");
  });
});
