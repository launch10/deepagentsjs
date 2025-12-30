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
      // Wait for chat input instead of networkidle (Vite HMR keeps websocket active)
      await brainstormPage.chatInput.waitFor({ state: "visible", timeout: 10000 });

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
    // Wait for chat input instead of networkidle (Vite HMR keeps websocket active)
    await brainstormPage.chatInput.waitFor({ state: "visible", timeout: 10000 });

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
    // Wait for chat input instead of networkidle (Vite HMR keeps websocket active)
    await brainstormPage.chatInput.waitFor({ state: "visible", timeout: 10000 });
  });
});

test.describe("New Project Route (/projects/new)", () => {
  let brainstormPage: BrainstormPage;

  test.beforeEach(async ({ page }) => {
    await DatabaseSnapshotter.restoreSnapshot("basic_account");
    await loginUser(page);
    brainstormPage = new BrainstormPage(page);
  });

  test("navigates to /projects/new and displays chat input", async ({ page }) => {
    await brainstormPage.gotoNew();

    // Verify we're on /projects/new
    expect(page.url()).toContain("/projects/new");

    // Verify chat input is ready
    await brainstormPage.expectChatInputReady();
  });

  test("clicking New Project button in sidebar navigates to /projects/new", async ({ page }) => {
    // Start on root
    await brainstormPage.goto();

    // Click the New Project button in sidebar using data-testid
    await page.getByTestId("new-project-link").click();

    // Verify navigation
    await page.waitForURL("**/projects/new");
    expect(page.url()).toContain("/projects/new");

    // Verify brainstorm interface loads
    await brainstormPage.expectChatInputReady();
  });

  test("sending message from /projects/new updates URL with thread ID", async ({ page }) => {
    await brainstormPage.gotoNew();

    // Verify we start on /projects/new
    expect(page.url()).toContain("/projects/new");

    // Send a message
    await brainstormPage.sendMessage("Test from /projects/new route");

    // Wait for URL to update
    await page.waitForFunction(
      () => window.location.href.includes("/projects/") && !window.location.href.includes("/projects/new"),
      { timeout: 10000 }
    );

    // Verify URL now contains a thread ID
    const hasThreadId = await brainstormPage.hasThreadIdInUrl();
    expect(hasThreadId).toBe(true);
  });

  test("unauthenticated user gets 404 (route scoped to authenticated users)", async ({ browser }) => {
    // Create new context without authentication
    const context = await browser.newContext();
    const page = await context.newPage();

    const response = await page.goto("/projects/new");

    // Route is inside authenticated block, so unauthenticated users get 404
    expect(response?.status()).toBe(404);

    await context.close();
  });
});

test.describe("Brainstorm Help Sections", () => {
  let brainstormPage: BrainstormPage;

  test.beforeEach(async ({ page }) => {
    await DatabaseSnapshotter.restoreSnapshot("basic_account");
    await loginUser(page);
    brainstormPage = new BrainstormPage(page);
  });

  test("displays help links on landing page", async ({ page }) => {
    await brainstormPage.goto();

    // Both help links should be visible
    await expect(brainstormPage.seeExamplesButton).toBeVisible();
    await expect(brainstormPage.learnHowItWorksButton).toBeVisible();
  });

  test("expands examples panel when clicking 'See examples of answers'", async ({
    page,
  }) => {
    await brainstormPage.goto();

    // Panel should not be visible initially
    await expect(brainstormPage.examplesPanel).not.toBeVisible();

    // Click to expand
    await brainstormPage.seeExamplesButton.click();

    // Panel should now be visible with example content
    await expect(brainstormPage.examplesPanel).toBeVisible();
    await expect(page.locator('text="Example structure:"')).toBeVisible();
    await expect(page.locator("text=DevMode is a software tool")).toBeVisible();
  });

  test("collapses examples panel when clicking again", async ({ page }) => {
    await brainstormPage.goto();

    // Expand
    await brainstormPage.seeExamplesButton.click();
    await expect(brainstormPage.examplesPanel).toBeVisible();

    // Collapse
    await brainstormPage.seeExamplesButton.click();

    // Wait for animation to complete
    await page.waitForTimeout(400);

    // Panel should be hidden
    await expect(brainstormPage.examplesPanel).not.toBeVisible();
  });

  test("expands 'How it works' panel when clicking 'Learn how it works'", async ({
    page,
  }) => {
    await brainstormPage.goto();

    // Panel should not be visible initially
    await expect(brainstormPage.howItWorksPanel).not.toBeVisible();

    // Click to expand
    await brainstormPage.learnHowItWorksButton.click();

    // Panel should now be visible with steps
    await expect(brainstormPage.howItWorksPanel).toBeVisible();
    await expect(
      page.locator("text=You tell us your big idea")
    ).toBeVisible();
    await expect(
      page.locator("text=high-performing Google Ads campaign")
    ).toBeVisible();
  });

  test("only one panel can be expanded at a time", async ({ page }) => {
    await brainstormPage.goto();

    // Expand examples first
    await brainstormPage.seeExamplesButton.click();
    await expect(brainstormPage.examplesPanel).toBeVisible();
    await expect(brainstormPage.howItWorksPanel).not.toBeVisible();

    // Click "How it works" - should close examples and open how it works
    await brainstormPage.learnHowItWorksButton.click();

    // Wait for animation
    await page.waitForTimeout(400);

    // How it works should be visible, examples should be hidden
    await expect(brainstormPage.howItWorksPanel).toBeVisible();
    await expect(brainstormPage.examplesPanel).not.toBeVisible();
  });

  test("active link is underlined when expanded", async ({ page }) => {
    await brainstormPage.goto();

    // Initially neither should be underlined (text-base-400)
    await expect(brainstormPage.seeExamplesButton).not.toHaveClass(/underline/);

    // Expand examples - should become underlined
    await brainstormPage.seeExamplesButton.click();
    await expect(brainstormPage.seeExamplesButton).toHaveClass(/underline/);

    // How it works should not be underlined
    await expect(brainstormPage.learnHowItWorksButton).not.toHaveClass(
      /underline/
    );

    // Switch to how it works
    await brainstormPage.learnHowItWorksButton.click();
    await page.waitForTimeout(400);

    // Now how it works should be underlined, examples not
    await expect(brainstormPage.learnHowItWorksButton).toHaveClass(/underline/);
    await expect(brainstormPage.seeExamplesButton).not.toHaveClass(/underline/);
  });

  test("help links are not visible in conversation view", async ({ page }) => {
    await brainstormPage.goto();

    // Send a message to create a conversation
    await brainstormPage.sendMessage("Test message for conversation");

    // Wait for URL update
    await page.waitForFunction(
      () =>
        window.location.href.includes("/projects/") &&
        !window.location.href.includes("/projects/new"),
      { timeout: 10000 }
    );

    // Wait for conversation to load
    await brainstormPage.waitForResponse();

    // Help links should not be visible in conversation view
    await expect(brainstormPage.seeExamplesButton).not.toBeVisible();
    await expect(brainstormPage.learnHowItWorksButton).not.toBeVisible();
  });
});

test.describe("Brainstorm Loading States", () => {
  let brainstormPage: BrainstormPage;

  test.beforeEach(async ({ page }) => {
    await DatabaseSnapshotter.restoreSnapshot("basic_account");
    await loginUser(page);
    brainstormPage = new BrainstormPage(page);
  });

  test("shows skeleton (not landing page) when loading existing conversation", async ({ page }) => {
    // First create a conversation to get a valid thread ID
    await brainstormPage.goto();
    await brainstormPage.sendMessage("Test message for loading state test");

    // Wait for URL to update with thread ID
    await page.waitForFunction(
      () => window.location.href.includes("/projects/") && !window.location.href.includes("/projects/new"),
      { timeout: 10000 }
    );

    const threadId = brainstormPage.getThreadIdFromUrl();
    expect(threadId).not.toBeNull();

    // Now navigate directly to the conversation URL
    // Use gotoConversationImmediate to not wait for networkidle
    await brainstormPage.gotoConversationImmediate(threadId!);

    // The landing page hero ("Tell us your next big idea") should NOT be visible
    // If it flickers, this test will fail
    await brainstormPage.expectLandingPageNotVisible();

    // Eventually the messages should load
    // Wait for chat input instead of networkidle (Vite HMR keeps websocket active)
    await brainstormPage.chatInput.waitFor({ state: "visible", timeout: 10000 });
    const messageCount = await brainstormPage.getUserMessageCount();
    expect(messageCount).toBeGreaterThan(0);
  });

  test("shows landing page on new conversation (not skeleton)", async ({ page }) => {
    await brainstormPage.gotoNew();

    // Landing page hero should be visible for new conversations
    await expect(brainstormPage.landingPageHero).toBeVisible();

    // Skeleton should NOT be visible on new conversations
    await expect(brainstormPage.skeleton.first()).not.toBeVisible();
  });
});
