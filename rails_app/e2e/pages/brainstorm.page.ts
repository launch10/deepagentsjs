import { type Page, type Locator, expect } from "@playwright/test";

/**
 * Page Object Model for the Brainstorm page.
 * Encapsulates all interactions with the brainstorm chat interface.
 */
export class BrainstormPage {
  readonly page: Page;

  // Chat elements
  readonly chatInput: Locator;
  readonly sendButton: Locator;
  readonly messageList: Locator;
  readonly userMessages: Locator;
  readonly aiMessages: Locator;
  readonly thinkingIndicator: Locator;

  // Command buttons
  readonly commandButtons: Locator;

  // Social links
  readonly socialLinksSection: Locator;

  // Loading states
  readonly skeleton: Locator;
  readonly landingPageHero: Locator;

  // Help section elements
  readonly seeExamplesButton: Locator;
  readonly learnHowItWorksButton: Locator;
  readonly examplesPanel: Locator;
  readonly howItWorksPanel: Locator;

  constructor(page: Page) {
    this.page = page;

    // Chat input elements
    this.chatInput = page.locator(
      '[data-testid="chat-input"], textarea[placeholder*="business idea"]'
    );
    this.sendButton = page.locator(
      '[data-testid="send-button"], button[type="submit"]'
    );

    // Message list
    this.messageList = page.locator(
      '[data-testid="message-list"], [role="log"]'
    );
    this.userMessages = page.locator(
      '[data-testid="user-message"], [data-role="user"]'
    );
    this.aiMessages = page.locator(
      '[data-testid="ai-message"], [data-role="assistant"]'
    );

    // Thinking/loading indicator
    this.thinkingIndicator = page.locator(
      '[data-testid="thinking-indicator"], [role="status"]'
    );

    // Command buttons
    this.commandButtons = page.locator('[data-testid="command-buttons"]');

    // Social links section
    this.socialLinksSection = page.locator(
      '[data-testid="social-links"], [aria-label="Social Links"]'
    );

    // Loading states
    this.skeleton = page.locator('[data-slot="skeleton"]');
    this.landingPageHero = page.locator('h1:has-text("Tell us your next")');

    // Help section elements
    this.seeExamplesButton = page.getByRole("button", {
      name: "See examples of answers",
    });
    this.learnHowItWorksButton = page.getByRole("button", {
      name: "Learn how it works",
    });
    this.examplesPanel = page.locator('text="Example structure:"').locator("..");
    this.howItWorksPanel = page.locator(
      'ol:has(li:has-text("You tell us your big idea"))'
    );
  }

  /**
   * Navigate to the brainstorm page (new conversation)
   * The root route when logged in is projects#new which shows the brainstorm interface
   */
  async goto(): Promise<void> {
    await this.page.goto("/");
    await this.page.waitForLoadState("networkidle");
  }

  /**
   * Navigate to /projects/new (explicit new project route)
   */
  async gotoNew(): Promise<void> {
    await this.page.goto("/projects/new");
    await this.page.waitForLoadState("networkidle");
  }

  /**
   * Navigate to an existing brainstorm conversation
   */
  async gotoConversation(threadId: string): Promise<void> {
    await this.page.goto(`/projects/${threadId}/brainstorm`);
    await this.page.waitForLoadState("networkidle");
  }

  /**
   * Send a message in the chat
   */
  async sendMessage(message: string): Promise<void> {
    await this.chatInput.fill(message);
    await this.sendButton.click();
  }

  /**
   * Wait for AI response to complete
   */
  async waitForResponse(timeout: number = 30000): Promise<void> {
    // Wait for thinking indicator to appear
    await this.thinkingIndicator.waitFor({ state: "visible", timeout: 5000 });

    // Wait for thinking indicator to disappear (response complete)
    await this.thinkingIndicator.waitFor({ state: "hidden", timeout });
  }

  /**
   * Get the last AI message content
   */
  async getLastAIMessage(): Promise<string> {
    const messages = await this.aiMessages.all();
    if (messages.length === 0) {
      return "";
    }
    return await messages[messages.length - 1].textContent() || "";
  }

  /**
   * Get the last user message content
   */
  async getLastUserMessage(): Promise<string> {
    const messages = await this.userMessages.all();
    if (messages.length === 0) {
      return "";
    }
    return await messages[messages.length - 1].textContent() || "";
  }

  /**
   * Get the count of user messages
   */
  async getUserMessageCount(): Promise<number> {
    return await this.userMessages.count();
  }

  /**
   * Get the count of AI messages
   */
  async getAIMessageCount(): Promise<number> {
    return await this.aiMessages.count();
  }

  /**
   * Check if the URL was updated with a thread ID
   */
  async hasThreadIdInUrl(): Promise<boolean> {
    const url = this.page.url();
    // UUID pattern: 8-4-4-4-12 hex characters
    return /\/projects\/[\w-]{36}\/brainstorm/.test(url);
  }

  /**
   * Get the thread ID from the URL
   */
  getThreadIdFromUrl(): string | null {
    const url = this.page.url();
    const match = url.match(/\/projects\/([\w-]+)\/brainstorm/);
    return match ? match[1] : null;
  }

  /**
   * Click a command button by its text
   */
  async clickCommandButton(text: string): Promise<void> {
    await this.commandButtons.getByText(text).click();
  }

  /**
   * Check if command buttons are visible
   */
  async areCommandButtonsVisible(): Promise<boolean> {
    return await this.commandButtons.isVisible();
  }

  /**
   * Assert that the chat input is visible and enabled
   */
  async expectChatInputReady(): Promise<void> {
    await expect(this.chatInput).toBeVisible();
    await expect(this.chatInput).toBeEnabled();
  }

  /**
   * Assert that a message appears in the chat
   */
  async expectMessageContaining(text: string): Promise<void> {
    await expect(
      this.page.locator(`text=${text}`).first()
    ).toBeVisible({ timeout: 30000 });
  }

  /**
   * Assert that skeleton is visible (loading state)
   */
  async expectSkeletonVisible(): Promise<void> {
    await expect(this.skeleton.first()).toBeVisible();
  }

  /**
   * Assert that the landing page hero is NOT visible
   * (to verify no flicker to empty state when loading existing conversation)
   */
  async expectLandingPageNotVisible(): Promise<void> {
    await expect(this.landingPageHero).not.toBeVisible();
  }

  /**
   * Navigate to an existing conversation without waiting for networkidle
   * This allows us to observe the initial loading state before data loads
   */
  async gotoConversationImmediate(threadId: string): Promise<void> {
    await this.page.goto(`/projects/${threadId}/brainstorm`);
    // Don't wait for networkidle - we want to observe loading state
  }
}
