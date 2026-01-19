import { type Page, type Locator } from "@playwright/test";
import { e2eConfig } from "../config";

/**
 * Page Object Model for the Website (Landing Page Builder) page.
 * Encapsulates all interactions with the website builder interface.
 */
export class WebsitePage {
  readonly page: Page;

  // Chat elements
  readonly chatInput: Locator;
  readonly sendButton: Locator;
  readonly messageList: Locator;
  readonly userMessages: Locator;
  readonly aiMessages: Locator;
  readonly thinkingIndicator: Locator;

  // Loading states
  readonly websiteLoader: Locator;

  // Quick Actions
  readonly quickActionsPanel: Locator;
  readonly changeColorsButton: Locator;
  readonly swapImagesButton: Locator;
  readonly improveCopyButton: Locator;

  // Sidebar
  readonly sidebar: Locator;

  // Preview area
  readonly previewContainer: Locator;

  constructor(page: Page) {
    this.page = page;

    // Chat input elements
    this.chatInput = page.locator('textarea[placeholder*="Ask me for changes"]');
    this.sendButton = page.locator('button[type="submit"]');

    // Message list elements
    this.messageList = page.locator('[role="log"]');
    this.userMessages = page.getByTestId("user-message");
    this.aiMessages = page.getByTestId("ai-message");

    // Thinking/loading indicator
    this.thinkingIndicator = page.getByTestId("thinking-indicator");

    // Loading states
    this.websiteLoader = page.locator('[class*="WebsiteLoader"]');

    // Quick Actions
    this.quickActionsPanel = page.locator('text="Quick Actions"');
    this.changeColorsButton = page.locator('button:has-text("Change Colors")');
    this.swapImagesButton = page.locator('button:has-text("Swap Images")');
    this.improveCopyButton = page.locator('button:has-text("Improve Copy")');

    // Sidebar
    this.sidebar = page.locator('text="Landing Page Designer"');

    // Preview container
    this.previewContainer = page.locator(".max-w-\\[948px\\]");
  }

  /**
   * Navigate to a project's website page
   */
  async goto(projectUuid: string): Promise<void> {
    await this.page.goto(`/projects/${projectUuid}/website`);
    // Wait for page to stabilize (loading or loaded)
    await this.page.waitForSelector('text="Landing Page Designer"', { timeout: 15000 });
  }

  /**
   * Wait for loading to complete (status changes from pending/running to completed)
   */
  async waitForLoaded(timeout: number = e2eConfig.timeouts.aiResponse): Promise<void> {
    // Wait for the sidebar to show the loaded state (Quick Actions visible, loader gone)
    await this.page.waitForFunction(
      () => {
        // Check if loader is gone and quick actions are visible
        const loader = document.querySelector('[class*="WebsiteLoader"]');
        const quickActions = document.querySelector('button:has-text("Change Colors")');
        return !loader && quickActions;
      },
      { timeout }
    );
  }

  /**
   * Check if the page is in loading state
   */
  async isLoading(): Promise<boolean> {
    // Check if we can see the loading indicator
    return this.websiteLoader.isVisible();
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
  async waitForResponse(timeout: number = e2eConfig.timeouts.aiResponse): Promise<void> {
    // Race: wait for thinking indicator OR AI message
    const thinkingOrMessage = await Promise.race([
      this.thinkingIndicator.waitFor({ state: "visible", timeout: 5000 }).then(() => "thinking"),
      this.aiMessages
        .first()
        .waitFor({ state: "visible", timeout: 5000 })
        .then(() => "message"),
    ]).catch(() => "timeout");

    if (thinkingOrMessage === "thinking") {
      await this.thinkingIndicator.waitFor({ state: "hidden", timeout });
    } else {
      await this.thinkingIndicator.waitFor({ state: "hidden", timeout: 1000 }).catch(() => {});
    }
  }

  /**
   * Get the count of user messages
   */
  async getUserMessageCount(): Promise<number> {
    return this.userMessages.count();
  }

  /**
   * Get the count of AI messages
   */
  async getAIMessageCount(): Promise<number> {
    return this.aiMessages.count();
  }

  /**
   * Click a Quick Action button
   */
  async clickQuickAction(action: "colors" | "images" | "copy"): Promise<void> {
    switch (action) {
      case "colors":
        await this.changeColorsButton.click();
        break;
      case "images":
        await this.swapImagesButton.click();
        break;
      case "copy":
        await this.improveCopyButton.click();
        break;
    }
  }

  /**
   * Check if chat input is ready
   */
  async expectChatInputReady(): Promise<void> {
    await this.chatInput.waitFor({ state: "visible", timeout: 10000 });
  }

  /**
   * Check if the sidebar is visible (page loaded)
   */
  async expectSidebarVisible(): Promise<void> {
    await this.sidebar.waitFor({ state: "visible", timeout: 10000 });
  }

  /**
   * Check if quick actions are visible (page loaded and not in loading state)
   */
  async expectQuickActionsVisible(): Promise<void> {
    await this.quickActionsPanel.waitFor({ state: "visible", timeout: 10000 });
    await this.changeColorsButton.waitFor({ state: "visible", timeout: 10000 });
  }
}
