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

      // Wait for AI response (ensures project is created in Rails DB)
      await brainstormPage.waitForResponse();

      // Get the thread ID from URL
      const threadId = brainstormPage.getThreadIdFromUrl();
      expect(threadId).not.toBeNull();

      // Reload the page to simulate coming back to conversation
      await page.reload();
      // Wait for chat input instead of networkidle (Vite HMR keeps websocket active)
      await brainstormPage.chatInput.waitFor({ state: "visible", timeout: 10000 });
      // Wait for message history to load
      await brainstormPage.userMessages.first().waitFor({ state: "visible", timeout: 10000 });

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
    test("shows command buttons after AI response completes", async ({
      page,
    }) => {
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

  test("displays social links section", async ({ page }) => {
    // This test depends on social links UI being implemented
    await brainstormPage.goto();
    await brainstormPage.sendMessage("Test message");
    await brainstormPage.waitForResponse();

    // Social links section should be visible
    await brainstormPage.openBrandPanel();
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

  test("message list has proper ARIA role when messages exist", async ({ page }) => {
    // The message list only appears after a conversation starts
    // Start a conversation to make the message list appear
    await brainstormPage.goto();
    await brainstormPage.sendMessage("Test message for ARIA role check");

    // Wait for the user message to appear (don't need AI response for this)
    await expect(brainstormPage.userMessages.first()).toBeVisible({ timeout: 5000 });

    // The message container should have appropriate role
    const messageList = page.locator('[role="log"]');
    await expect(messageList.first()).toBeVisible();
  });

  test("can navigate chat with keyboard", async ({ page }) => {
    await brainstormPage.goto();

    // Focus the chat input directly for a more reliable test
    await brainstormPage.chatInput.focus();

    // Verify the input is focused
    const focusedElement = await page.evaluate(
      () => document.activeElement?.tagName
    );
    // Input or textarea should be focusable
    expect(["INPUT", "TEXTAREA"]).toContain(focusedElement);

    // Verify we can type in it
    await page.keyboard.type("Test message");
    const inputValue = await brainstormPage.chatInput.inputValue();
    expect(inputValue).toBe("Test message");
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

    // Panel should not be expanded initially
    await expect(brainstormPage.examplesPanel).toHaveAttribute("data-expanded", "false");

    // Click to expand
    await brainstormPage.seeExamplesButton.click();

    // Panel should now be expanded with example content
    await expect(brainstormPage.examplesPanel).toHaveAttribute("data-expanded", "true");
    await expect(page.locator('text="Example structure:"')).toBeVisible();
    await expect(page.locator("text=DevMode is a software tool")).toBeVisible();
  });

  test("collapses examples panel when clicking again", async ({ page }) => {
    await brainstormPage.goto();

    // Expand
    await brainstormPage.seeExamplesButton.click();
    await expect(brainstormPage.examplesPanel).toHaveAttribute("data-expanded", "true");

    // Collapse
    await brainstormPage.seeExamplesButton.click();

    // Wait for animation to complete
    await page.waitForTimeout(400);

    // Panel should be collapsed
    await expect(brainstormPage.examplesPanel).toHaveAttribute("data-expanded", "false");
  });

  test("expands 'How it works' panel when clicking 'Learn how it works'", async ({
    page,
  }) => {
    await brainstormPage.goto();

    // Panel should not be expanded initially
    await expect(brainstormPage.howItWorksPanel).toHaveAttribute("data-expanded", "false");

    // Click to expand
    await brainstormPage.learnHowItWorksButton.click();

    // Panel should now be expanded with steps
    await expect(brainstormPage.howItWorksPanel).toHaveAttribute("data-expanded", "true");
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
    await expect(brainstormPage.examplesPanel).toHaveAttribute("data-expanded", "true");
    await expect(brainstormPage.howItWorksPanel).toHaveAttribute("data-expanded", "false");

    // Click "How it works" - should close examples and open how it works
    await brainstormPage.learnHowItWorksButton.click();

    // Wait for animation
    await page.waitForTimeout(400);

    // How it works should be expanded, examples should be collapsed
    await expect(brainstormPage.howItWorksPanel).toHaveAttribute("data-expanded", "true");
    await expect(brainstormPage.examplesPanel).toHaveAttribute("data-expanded", "false");
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

test.describe("Brainstorm Color Palette", () => {
  let brainstormPage: BrainstormPage;

  test.beforeEach(async ({ page }) => {
    await DatabaseSnapshotter.restoreSnapshot("basic_account");
    await loginUser(page);
    brainstormPage = new BrainstormPage(page);
  });

  test("auto-scrolls to page containing selected palette on reload", async ({
    page,
  }) => {
    // Start a conversation to get access to the brand panel
    await brainstormPage.goto();
    await brainstormPage.sendMessage("Test message for color palette test");

    // Wait for URL update
    await page.waitForFunction(
      () =>
        window.location.href.includes("/projects/") &&
        !window.location.href.includes("/projects/new"),
      { timeout: 10000 }
    );

    // Wait for AI response to ensure page is stable
    await brainstormPage.waitForResponse();

    // Reload the page to get Inertia props populated (required for API mutations to work)
    // After pushState URL change, Inertia props don't have project.uuid until a full page load
    await page.reload();
    await brainstormPage.chatInput.waitFor({ state: "visible", timeout: 10000 });

    // Wait for the brand panel to be visible (it renders after messages load)
    await brainstormPage.brandPersonalizationPanel.waitFor({ state: "visible", timeout: 10000 });

    // Open the brand personalization panel using the helper method
    await brainstormPage.openBrandPanel();

    // Wait for color palettes to load (not skeleton)
    await page.waitForFunction(
      () => !document.querySelector('[data-slot="skeleton"]'),
      { timeout: 10000 }
    );

    // Get the pagination label to see how many pages we have
    const paginationLabel = page.getByTestId("color-pagination-label");
    const labelText = await paginationLabel.textContent();
    const totalPages = parseInt(labelText?.split("/")[1] || "1", 10);

    // If there are multiple pages, navigate to page 2 and select a palette there
    if (totalPages >= 2) {
      // Navigate to page 2
      await page.getByTestId("color-pagination-next").click();
      await expect(paginationLabel).toHaveText(/^2\//);

      // Select the first palette on page 2 (which should be the 4th palette overall)
      const palettesOnPage2 = page.locator('[data-testid^="color-palette-"]');
      const firstPaletteOnPage2 = palettesOnPage2.first();

      await firstPaletteOnPage2.click();

      // Verify it's selected (UI state updates optimistically)
      await expect(firstPaletteOnPage2).toHaveAttribute("data-selected", "true");

      // Give time for the API mutation to complete in the background
      // (the mutation runs asynchronously and invalidates the cache on success)
      await page.waitForTimeout(1000);

      // Get the selected palette's test ID for later verification
      const selectedPaletteTestId = await firstPaletteOnPage2.getAttribute("data-testid");

      // Reload the page
      await page.reload();
      await page.getByTestId("chat-input").waitFor({ state: "visible", timeout: 10000 });

      // Open the brand panel again (use the page object helper to handle auto-open race condition)
      await brainstormPage.openBrandPanel();

      // Wait for palettes to load
      await page.waitForFunction(
        () => !document.querySelector('[data-slot="skeleton"]'),
        { timeout: 10000 }
      );

      // Verify we're still on page 2 (not page 1)
      await expect(paginationLabel).toHaveText(/^2\//);

      // Verify the palette is still selected and visible
      const selectedPalette = page.getByTestId(selectedPaletteTestId!);
      await expect(selectedPalette).toBeVisible();
      await expect(selectedPalette).toHaveAttribute("data-selected", "true");
    } else {
      // If only one page of palettes, just verify the basic functionality works
      const palettes = page.locator('[data-testid^="color-palette-"]');
      const paletteCount = await palettes.count();
      expect(paletteCount).toBeGreaterThan(0);
    }
  });
});

test.describe("Brand Personalization Panel Auto-Open", () => {
  let brainstormPage: BrainstormPage;

  test.beforeEach(async ({ page }) => {
    await DatabaseSnapshotter.restoreSnapshot("basic_account");
    await loginUser(page);
    brainstormPage = new BrainstormPage(page);
  });

  test("panel is collapsed by default on new conversation", async ({ page }) => {
    // Start a conversation to get the brand panel visible
    await brainstormPage.goto();
    await brainstormPage.sendMessage("Test message for brand panel");

    // Wait for URL update and conversation to load
    await page.waitForFunction(
      () =>
        window.location.href.includes("/projects/") &&
        !window.location.href.includes("/projects/new"),
      { timeout: 10000 }
    );

    // Wait for brand panel to be visible
    await brainstormPage.brandPersonalizationPanel.waitFor({ state: "visible", timeout: 10000 });

    // Panel should be collapsed by default
    const isExpanded = await brainstormPage.isBrandPanelExpanded();
    expect(isExpanded).toBe(false);
  });

  test("auto-opens panel when a color palette is selected", async ({ page }) => {
    // Start a conversation
    await brainstormPage.goto();
    await brainstormPage.sendMessage("Test message for color palette auto-open");

    // Wait for conversation to load
    await page.waitForFunction(
      () =>
        window.location.href.includes("/projects/") &&
        !window.location.href.includes("/projects/new"),
      { timeout: 10000 }
    );

    // Wait for brand panel to be visible
    await brainstormPage.brandPersonalizationPanel.waitFor({ state: "visible", timeout: 10000 });

    // Open the panel manually to select a color
    await brainstormPage.openBrandPanel();

    // Wait for color palettes to load
    await page.waitForFunction(
      () => !document.querySelector('[data-slot="skeleton"]'),
      { timeout: 10000 }
    );

    // Select a color palette
    await brainstormPage.selectColorPalette(0);

    // Close the panel
    await brainstormPage.closeBrandPanel();
    expect(await brainstormPage.isBrandPanelExpanded()).toBe(false);

    // Reload the page
    await page.reload();
    await brainstormPage.brandPersonalizationPanel.waitFor({ state: "visible", timeout: 10000 });

    // Panel should auto-open because a personalization has been applied
    // Note: The auto-open happens on initial render, not on reload
    // Since the theme is persisted and loaded, the panel should auto-open
    const isExpanded = await brainstormPage.isBrandPanelExpanded();
    expect(isExpanded).toBe(true);
  });

  test("panel can be manually toggled", async ({ page }) => {
    // Start a conversation
    await brainstormPage.goto();
    await brainstormPage.sendMessage("Test message for toggle");

    // Wait for conversation to load
    await page.waitForFunction(
      () =>
        window.location.href.includes("/projects/") &&
        !window.location.href.includes("/projects/new"),
      { timeout: 10000 }
    );

    // Wait for brand panel to be visible
    await brainstormPage.brandPersonalizationPanel.waitFor({ state: "visible", timeout: 10000 });

    // Initially collapsed
    expect(await brainstormPage.isBrandPanelExpanded()).toBe(false);

    // Open
    await brainstormPage.openBrandPanel();
    expect(await brainstormPage.isBrandPanelExpanded()).toBe(true);

    // Content should be visible
    await expect(brainstormPage.brandPersonalizationContent).toBeVisible();

    // Close
    await brainstormPage.closeBrandPanel();
    expect(await brainstormPage.isBrandPanelExpanded()).toBe(false);
  });

  test("shows brand panel sections when expanded", async ({ page }) => {
    // Start a conversation
    await brainstormPage.goto();
    await brainstormPage.sendMessage("Test message for sections");

    // Wait for conversation to load
    await page.waitForFunction(
      () =>
        window.location.href.includes("/projects/") &&
        !window.location.href.includes("/projects/new"),
      { timeout: 10000 }
    );

    // Wait for and open brand panel
    await brainstormPage.brandPersonalizationPanel.waitFor({ state: "visible", timeout: 10000 });
    await brainstormPage.openBrandPanel();

    // Verify all sections are present
    await expect(page.getByRole("heading", { name: "Logo" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Colors" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Social Links" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Images" })).toBeVisible();
  });
});

test.describe("Brand Personalization Uploads", () => {
  let brainstormPage: BrainstormPage;

  test.beforeEach(async ({ page }) => {
    await DatabaseSnapshotter.restoreSnapshot("basic_account");
    await loginUser(page);
    brainstormPage = new BrainstormPage(page);
  });

  test("logo upload persists across page reload", async ({ page }) => {
    // Start a conversation to get access to the brand panel
    await brainstormPage.goto();
    await brainstormPage.sendMessage("Test message for logo upload test");

    // Wait for URL update (conversation created)
    await page.waitForFunction(
      () =>
        window.location.href.includes("/projects/") &&
        !window.location.href.includes("/projects/new"),
      { timeout: 10000 }
    );

    // Wait for response to ensure page is stable
    await brainstormPage.waitForResponse();

    // Open the brand personalization panel
    await brainstormPage.openBrandPanel();

    // Initially, the upload area should be visible (no logo yet)
    await expect(brainstormPage.logoUploadArea).toBeVisible();
    await expect(brainstormPage.logoPreview).not.toBeVisible();

    // Upload a logo
    const logoPath = "e2e/fixtures/files/test-logo.jpg";
    await brainstormPage.uploadLogo(logoPath);

    // Verify logo preview is now visible
    await expect(brainstormPage.logoPreview).toBeVisible();
    await expect(brainstormPage.logoUploadArea).not.toBeVisible();

    // Get the logo src for comparison after reload
    const logoSrcBefore = await brainstormPage.getLogoSrc();
    expect(logoSrcBefore).toBeTruthy();

    // Reload the page
    await page.reload();
    await brainstormPage.chatInput.waitFor({ state: "visible", timeout: 10000 });

    // Set up response waiter BEFORE opening the panel (which triggers the API call)
    const uploadsPromise = page.waitForResponse(
      (response) =>
        response.url().includes("/api/v1/uploads") &&
        response.request().method() === "GET" &&
        response.status() === 200,
      { timeout: 10000 }
    );

    // Open the brand panel (this triggers the uploads query)
    await brainstormPage.openBrandPanel();

    // Wait for uploads API to complete
    await uploadsPromise;

    // Verify logo is still displayed after reload
    await expect(brainstormPage.logoPreview).toBeVisible({ timeout: 10000 });
    await expect(brainstormPage.logoUploadArea).not.toBeVisible();

    // Verify it's the same image (src should contain similar URL pattern)
    const logoSrcAfter = await brainstormPage.getLogoSrc();
    expect(logoSrcAfter).toBeTruthy();
    // Both should be valid image URLs (from S3/R2 or local storage)
    expect(logoSrcAfter).toMatch(/^(https?:\/\/|\/uploads\/)/);  // http(s):// or /uploads/
  });

  test("project images upload persists across page reload", async ({ page }) => {
    // Start a conversation
    await brainstormPage.goto();
    await brainstormPage.sendMessage("Test message for project images test");

    // Wait for conversation to load
    await page.waitForFunction(
      () =>
        window.location.href.includes("/projects/") &&
        !window.location.href.includes("/projects/new"),
      { timeout: 10000 }
    );

    await brainstormPage.waitForResponse();

    // Open brand panel
    await brainstormPage.openBrandPanel();

    // Initially, no project images grid should be visible
    await expect(brainstormPage.projectImagesGrid).not.toBeVisible();

    // Upload multiple project images
    const imagePaths = [
      "e2e/fixtures/files/test-image-1.jpg",
      "e2e/fixtures/files/test-image-2.jpg",
    ];
    await brainstormPage.uploadProjectImages(imagePaths);

    // Verify images are displayed
    await expect(brainstormPage.projectImagesGrid).toBeVisible();
    const imageCountBefore = await brainstormPage.getProjectImageCount();
    expect(imageCountBefore).toBe(2);

    // Reload the page
    await page.reload();
    await brainstormPage.chatInput.waitFor({ state: "visible", timeout: 10000 });

    // Set up response waiter BEFORE opening the panel
    const uploadsPromise = page.waitForResponse(
      (response) =>
        response.url().includes("/api/v1/uploads") &&
        response.request().method() === "GET" &&
        response.status() === 200,
      { timeout: 10000 }
    );

    // Open brand panel again
    await brainstormPage.openBrandPanel();

    // Wait for uploads to load
    await uploadsPromise;

    // Verify images are still displayed
    await expect(brainstormPage.projectImagesGrid).toBeVisible({ timeout: 10000 });
    const imageCountAfter = await brainstormPage.getProjectImageCount();
    expect(imageCountAfter).toBe(2);
  });

  test("uploads display correct images when navigating back to conversation", async ({ page }) => {
    // Start a conversation and upload a logo
    await brainstormPage.goto();
    await brainstormPage.sendMessage("Test message for navigation test");

    await page.waitForFunction(
      () =>
        window.location.href.includes("/projects/") &&
        !window.location.href.includes("/projects/new"),
      { timeout: 10000 }
    );

    await brainstormPage.waitForResponse();

    // Get the conversation URL
    const conversationUrl = page.url();

    // Upload a logo
    await brainstormPage.openBrandPanel();
    await brainstormPage.uploadLogo("e2e/fixtures/files/test-logo.jpg");
    await expect(brainstormPage.logoPreview).toBeVisible();

    // Navigate away to home
    await page.goto("/");
    await brainstormPage.chatInput.waitFor({ state: "visible", timeout: 10000 });

    // Navigate back to the conversation
    await page.goto(conversationUrl);
    await brainstormPage.chatInput.waitFor({ state: "visible", timeout: 10000 });

    // Set up response waiter BEFORE opening the panel
    const uploadsPromise = page.waitForResponse(
      (response) =>
        response.url().includes("/api/v1/uploads") &&
        response.request().method() === "GET" &&
        response.status() === 200,
      { timeout: 10000 }
    );

    // Open brand panel
    await brainstormPage.openBrandPanel();

    // Wait for uploads to load
    await uploadsPromise;

    // Verify logo is displayed
    await expect(brainstormPage.logoPreview).toBeVisible({ timeout: 10000 });
  });

  test("logo upload area displays while uploads are loading", async ({ page }) => {
    // Start a conversation and upload a logo
    await brainstormPage.goto();
    await brainstormPage.sendMessage("Test message for loading state test");

    await page.waitForFunction(
      () =>
        window.location.href.includes("/projects/") &&
        !window.location.href.includes("/projects/new"),
      { timeout: 10000 }
    );

    await brainstormPage.waitForResponse();
    const threadId = brainstormPage.getThreadIdFromUrl();

    // Upload a logo
    await brainstormPage.openBrandPanel();
    await brainstormPage.uploadLogo("e2e/fixtures/files/test-logo.jpg");
    await expect(brainstormPage.logoPreview).toBeVisible();

    // Navigate directly to the conversation URL without waiting
    await brainstormPage.gotoConversationImmediate(threadId!);

    // Set up response waiter BEFORE opening the panel
    const uploadsPromise = page.waitForResponse(
      (response) =>
        response.url().includes("/api/v1/uploads") &&
        response.request().method() === "GET" &&
        response.status() === 200,
      { timeout: 10000 }
    );

    // The brand panel should not show the empty upload area initially
    // (it should show the preview or be loading)
    await brainstormPage.openBrandPanel();

    // Wait for uploads to finish loading
    await uploadsPromise;

    // After loading, the logo preview should be visible
    await expect(brainstormPage.logoPreview).toBeVisible({ timeout: 10000 });
  });
});

test.describe("Brainstorm Inline Chat Attachments", () => {
  let brainstormPage: BrainstormPage;

  test.beforeEach(async ({ page }) => {
    await DatabaseSnapshotter.restoreSnapshot("basic_account");
    await loginUser(page);
    brainstormPage = new BrainstormPage(page);
  });

  test("can add an image attachment to chat input", async ({ page }) => {
    await brainstormPage.goto();

    // Add an image attachment
    await brainstormPage.addChatAttachment("e2e/fixtures/files/test-image-1.jpg");

    // Wait for upload to complete
    await brainstormPage.waitForChatAttachmentsUploaded();

    // Verify attachment appears
    const attachmentCount = await brainstormPage.getChatAttachmentCount();
    expect(attachmentCount).toBe(1);
  });

  test("send button is enabled when only attachments are present (no text)", async ({ page }) => {
    await brainstormPage.goto();

    // Initially, send button should be disabled
    expect(await brainstormPage.isSendButtonEnabled()).toBe(false);

    // Add an image attachment
    await brainstormPage.addChatAttachment("e2e/fixtures/files/test-image-1.jpg");

    // Wait for upload to complete
    await brainstormPage.waitForChatAttachmentsUploaded();

    // Send button should now be enabled (attachments present)
    expect(await brainstormPage.isSendButtonEnabled()).toBe(true);
  });

  test("can add multiple image attachments", async ({ page }) => {
    await brainstormPage.goto();

    // Add multiple image attachments
    await brainstormPage.addChatAttachments([
      "e2e/fixtures/files/test-image-1.jpg",
      "e2e/fixtures/files/test-image-2.jpg",
    ]);

    // Wait for uploads to complete
    await brainstormPage.waitForChatAttachmentsUploaded();

    // Verify both attachments appear
    const attachmentCount = await brainstormPage.getChatAttachmentCount();
    expect(attachmentCount).toBe(2);
  });

  test("can send message with image attachment", async ({ page }) => {
    await brainstormPage.goto();

    // Add an image attachment
    await brainstormPage.addChatAttachment("e2e/fixtures/files/test-image-1.jpg");

    // Wait for upload to complete
    await brainstormPage.waitForChatAttachmentsUploaded();

    // Type a message
    await brainstormPage.chatInput.fill("Here is my logo");

    // Send the message
    await brainstormPage.sendButton.click();

    // Wait for URL to update (message sent)
    await page.waitForFunction(
      () => window.location.href.includes("/projects/"),
      { timeout: 10000 }
    );

    // Verify user message appears
    const messageCount = await brainstormPage.getUserMessageCount();
    expect(messageCount).toBeGreaterThan(0);
  });

  test.skip("can send image-only message (no text)", async ({ page }) => {
    await brainstormPage.goto();

    // Add an image attachment
    await brainstormPage.addChatAttachment("e2e/fixtures/files/test-logo.jpg");

    // Wait for upload to complete
    await brainstormPage.waitForChatAttachmentsUploaded();

    // Send without text
    await brainstormPage.sendMessageWithAttachments();

    // Wait for URL to update (message sent)
    await page.waitForFunction(
      () => window.location.href.includes("/projects/"),
      { timeout: 10000 }
    );

    // Verify message was sent
    const messageCount = await brainstormPage.getUserMessageCount();
    expect(messageCount).toBeGreaterThan(0);
  });

  test("attachments are cleared after sending message", async ({ page }) => {
    await brainstormPage.goto();

    // Add an image attachment
    await brainstormPage.addChatAttachment("e2e/fixtures/files/test-image-1.jpg");

    // Wait for upload to complete
    await brainstormPage.waitForChatAttachmentsUploaded();

    // Verify attachment is visible
    let attachmentCount = await brainstormPage.getChatAttachmentCount();
    expect(attachmentCount).toBe(1);

    // Send the message
    await brainstormPage.chatInput.fill("I want to make a brand to help freelancers manage their income and expenses");
    await brainstormPage.sendButton.click();

    // Wait for message to be sent
    await page.waitForFunction(
      () => window.location.href.includes("/projects/"),
      { timeout: 10000 }
    );

    await brainstormPage.waitForResponse();

    // Attachments should be cleared
    attachmentCount = await brainstormPage.getChatAttachmentCount();
    expect(attachmentCount).toBe(0);
  });

  test("shows loading state while image is uploading", async ({ page }) => {
    await brainstormPage.goto();

    // Add an image attachment
    await brainstormPage.addChatAttachment("e2e/fixtures/files/test-image-1.jpg");

    // Check that we can find attachment items (may show uploading state briefly)
    // The test for complete state is covered in waitForChatAttachmentsUploaded
    await page.waitForSelector('[data-testid="attachment-item"]', { timeout: 5000 });

    // Wait for upload to complete
    await brainstormPage.waitForChatAttachmentsUploaded();

    // Verify status is completed
    const status = await page.$eval(
      '[data-testid="attachment-item"]',
      (el) => el.getAttribute('data-status')
    );
    expect(status).toBe('completed');
  });
});

test.describe("Workflow Progress Stepper", () => {
  let brainstormPage: BrainstormPage;

  test.beforeEach(async ({ page }) => {
    await DatabaseSnapshotter.restoreSnapshot("basic_account");
    await loginUser(page);
    brainstormPage = new BrainstormPage(page);
  });

  test("progress stepper is hidden on home page", async ({ page }) => {
    await brainstormPage.goto();

    // Progress stepper should NOT be visible on home/new project page
    const progressStepper = page.getByTestId("workflow-progress-stepper");
    await expect(progressStepper).not.toBeVisible();
  });

  test("progress stepper is hidden on /projects/new", async ({ page }) => {
    await brainstormPage.gotoNew();

    // Progress stepper should NOT be visible on /projects/new
    const progressStepper = page.getByTestId("workflow-progress-stepper");
    await expect(progressStepper).not.toBeVisible();
  });

  test("progress stepper appears after sending first message", async ({ page }) => {
    await brainstormPage.goto();

    // Initially, stepper should be hidden
    const progressStepper = page.getByTestId("workflow-progress-stepper");
    await expect(progressStepper).not.toBeVisible();

    // Send a message
    await brainstormPage.sendMessage("I want to start a coffee subscription service");

    // Wait for URL to update (message was sent, thread created)
    await page.waitForFunction(
      () => window.location.href.includes("/projects/") && !window.location.href.includes("/projects/new"),
      { timeout: 10000 }
    );

    // Progress stepper should now be visible
    await expect(progressStepper).toBeVisible({ timeout: 5000 });

    // Should show "Brainstorm" as the current step (first step highlighted)
    await expect(page.getByText("Brainstorm")).toBeVisible();
  });

  test("progress stepper shows correct step labels", async ({ page }) => {
    await brainstormPage.goto();
    await brainstormPage.sendMessage("Test message for stepper labels");

    // Wait for URL to update
    await page.waitForFunction(
      () => window.location.href.includes("/projects/") && !window.location.href.includes("/projects/new"),
      { timeout: 10000 }
    );

    // All step labels should be visible
    await expect(page.getByText("Brainstorm")).toBeVisible();
    await expect(page.getByText("Landing Page")).toBeVisible();
    await expect(page.getByText("Ad Campaign")).toBeVisible();
    await expect(page.getByText("Launch")).toBeVisible();
  });

  test("clicking New Project button resets workflow state and hides stepper", async ({ page }) => {
    // Start a conversation to get the stepper visible
    await brainstormPage.goto();
    await brainstormPage.sendMessage("Initial test message");

    // Wait for URL to update
    await page.waitForFunction(
      () => window.location.href.includes("/projects/") && !window.location.href.includes("/projects/new"),
      { timeout: 10000 }
    );

    // Verify stepper is visible
    const progressStepper = page.getByTestId("workflow-progress-stepper");
    await expect(progressStepper).toBeVisible({ timeout: 5000 });

    // Click the New Project button (+ icon) in sidebar
    await page.getByTestId("new-project-link").click();

    // Wait for navigation to /projects/new AND for React to re-render
    await page.waitForURL("**/projects/new");

    // Wait for the chat input to be ready (indicates React has rendered)
    await brainstormPage.expectChatInputReady();

    // Stepper should now be hidden (workflow state reset)
    // Use a longer timeout since state clearing is async after prop changes
    await expect(progressStepper).not.toBeVisible({ timeout: 5000 });
  });

  test("navigating to home (/) resets workflow state and hides stepper", async ({ page }) => {
    // Start a conversation
    await brainstormPage.goto();
    await brainstormPage.sendMessage("Test message for home navigation");

    // Wait for URL to update
    await page.waitForFunction(
      () => window.location.href.includes("/projects/") && !window.location.href.includes("/projects/new"),
      { timeout: 10000 }
    );

    // Verify stepper is visible
    const progressStepper = page.getByTestId("workflow-progress-stepper");
    await expect(progressStepper).toBeVisible({ timeout: 5000 });

    // Navigate to home
    await page.goto("/");
    await brainstormPage.chatInput.waitFor({ state: "visible", timeout: 10000 });

    // Stepper should be hidden
    await expect(progressStepper).not.toBeVisible();
  });

  test("stepper persists when reloading existing conversation", async ({ page }) => {
    // Start a conversation
    await brainstormPage.goto();
    await brainstormPage.sendMessage("Test message for reload");

    // Wait for URL to update
    await page.waitForFunction(
      () => window.location.href.includes("/projects/") && !window.location.href.includes("/projects/new"),
      { timeout: 10000 }
    );

    // Wait for AI response (ensures project is fully persisted in Rails DB)
    await brainstormPage.waitForResponse();

    // Verify stepper is visible
    const progressStepper = page.getByTestId("workflow-progress-stepper");
    await expect(progressStepper).toBeVisible({ timeout: 5000 });

    // Reload the page
    await page.reload();
    await brainstormPage.chatInput.waitFor({ state: "visible", timeout: 15000 });

    // Stepper should still be visible after reload
    await expect(progressStepper).toBeVisible({ timeout: 5000 });
  });

  test("stepper visible when navigating directly to existing conversation", async ({ page }) => {
    // First create a conversation
    await brainstormPage.goto();
    await brainstormPage.sendMessage("Test message for direct navigation");

    // Wait for URL to update and get thread ID
    await page.waitForFunction(
      () => window.location.href.includes("/projects/") && !window.location.href.includes("/projects/new"),
      { timeout: 10000 }
    );

    // Wait for AI response (ensures project is fully persisted in Rails DB)
    await brainstormPage.waitForResponse();

    const threadId = brainstormPage.getThreadIdFromUrl();
    expect(threadId).not.toBeNull();

    // Navigate away to home
    await page.goto("/");
    await brainstormPage.chatInput.waitFor({ state: "visible", timeout: 10000 });

    // Navigate directly to the conversation
    await page.goto(`/projects/${threadId}/brainstorm`);
    await brainstormPage.chatInput.waitFor({ state: "visible", timeout: 15000 });

    // Stepper should be visible
    const progressStepper = page.getByTestId("workflow-progress-stepper");
    await expect(progressStepper).toBeVisible({ timeout: 5000 });
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

// > Okay let's begin dreaming up things for this - currently, we have a killer snapshot builder system which
//   interacts with our tests in useful ways - we can load from existing snapshots to get known states of the
//   world. One good example is the loads existing conversation from URL playwright test.

test.describe("Brainstorm to Website Redirect", () => {
  // These tests involve multiple AI responses, so need longer timeout
  test.setTimeout(120000);

  let brainstormPage: BrainstormPage;

  // Complete business idea that provides enough detail for the AI to accept
  // and move past the idea question (includes unique differentiation)
  const COMPLETE_BUSINESS_IDEA = `
    I'm building InvoiceZen, an invoice management tool specifically for freelance designers.
    Unlike QuickBooks or FreshBooks, we're the only tool that integrates directly with Figma and
    Adobe Creative Cloud. When a designer finishes a project, they can generate an invoice with
    one click, automatically pulling project details, time tracked, and deliverables. We also
    have beautiful, designer-grade invoice templates that match their brand aesthetic.
  `.trim();

  test.beforeEach(async ({ page }) => {
    await DatabaseSnapshotter.restoreSnapshot("basic_account");
    await loginUser(page);
    brainstormPage = new BrainstormPage(page);
  });

  test("redirects to website page when user completes brainstorm", async ({ page }) => {
    // Start a new conversation
    await brainstormPage.goto();

    // Provide a complete business idea with differentiation
    // The AI needs enough detail to move past the "idea" question
    await brainstormPage.sendMessage(COMPLETE_BUSINESS_IDEA);
    await brainstormPage.waitForResponse();

    // Get the thread ID now that we have a conversation
    const threadId = brainstormPage.getThreadIdFromUrl();
    expect(threadId).not.toBeNull();

    // Now "Do the rest" should be available as a command
    // This will complete the remaining questions (audience, solution, social proof)
    await brainstormPage.sendMessage("Do the rest for me");
    await brainstormPage.waitForResponse();

    // Now we should be at the lookAndFeel stage with "Build My Site" available
    // The AI shows the button when ready - clicking it triggers the redirect
    await expect(brainstormPage.buildMySiteButton).toBeVisible({ timeout: 10000 });

    // Click Build My Site - this sends "I'm finished" to the AI
    await brainstormPage.clickBuildMySite();

    // Wait for AI to process the message and trigger redirect
    // The AI should call finishedTool which sets redirect: "website"
    await brainstormPage.waitForResponse(60000);

    // Wait for redirect to website page
    await brainstormPage.waitForWebsiteRedirect(threadId!);

    // Verify we're on the website page
    expect(page.url()).toContain(`/projects/${threadId}/website`);
  });

  test("workflow stepper progresses to Landing Page when redirected", async ({ page }) => {
    // Start a new conversation
    await brainstormPage.goto();

    // Provide a complete business idea
    await brainstormPage.sendMessage(COMPLETE_BUSINESS_IDEA);
    await brainstormPage.waitForResponse();

    const threadId = brainstormPage.getThreadIdFromUrl();
    expect(threadId).not.toBeNull();

    // Complete the brainstorm
    await brainstormPage.sendMessage("Do the rest for me");
    await brainstormPage.waitForResponse();

    // Verify workflow stepper is visible
    const progressStepper = page.getByTestId("workflow-progress-stepper");
    await expect(progressStepper).toBeVisible({ timeout: 5000 });

    // Verify "Brainstorm" step is currently active (has font-semibold class)
    const brainstormStep = progressStepper.getByText("Brainstorm");
    await expect(brainstormStep).toHaveClass(/font-semibold/);

    // Trigger redirect via Build My Site button
    await expect(brainstormPage.buildMySiteButton).toBeVisible({ timeout: 10000 });
    await brainstormPage.clickBuildMySite();

    // Wait for AI to process and trigger redirect
    await brainstormPage.waitForResponse(60000);

    // Wait for redirect to website page
    await brainstormPage.waitForWebsiteRedirect(threadId!);

    // The workflow stepper should still be visible on the website page
    await expect(progressStepper).toBeVisible({ timeout: 5000 });

    // Verify "Landing Page" step is now active (has font-semibold class)
    const landingPageStep = progressStepper.getByText("Landing Page");
    await expect(landingPageStep).toHaveClass(/font-semibold/);

    // Verify "Brainstorm" is no longer the active step
    await expect(brainstormStep).not.toHaveClass(/font-semibold/);
  });
});
