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
  readonly updateImagesButton: Locator;

  // Sidebar
  readonly sidebar: Locator;

  // Preview area
  readonly previewContainer: Locator;
  readonly previewIframe: Locator;
  readonly previewStatus: Locator;

  // Error UI
  readonly buildErrorPrompt: Locator;
  readonly fixErrorsButton: Locator;
  readonly fixErrorsSidebarButton: Locator;

  constructor(page: Page) {
    this.page = page;

    // Chat input elements
    this.chatInput = page.locator('textarea[placeholder*="Ask me for changes"]');
    this.sendButton = page.getByTestId("website-chat-submit");

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
    this.updateImagesButton = page.locator('button:has-text("Update Page with Images")');

    // Sidebar
    this.sidebar = page.locator('text="Landing Page Designer"');

    // Preview container
    this.previewContainer = page.getByTestId("preview-container");
    this.previewIframe = page.getByTestId("preview-iframe");
    this.previewStatus = page.getByTestId("preview-status");

    // Error UI
    this.buildErrorPrompt = page.getByTestId("build-error-prompt");
    this.fixErrorsButton = page.getByRole("button", { name: "Fix errors" }).first();
    this.fixErrorsSidebarButton = page.getByTestId("build-error-prompt").getByRole("button", { name: "Fix errors" });
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
   * Send a message in the chat.
   * Waits for the submit button to be in "send" mode (not "stop" / streaming mode)
   * before filling and clicking.
   */
  async sendMessage(message: string): Promise<void> {
    // Wait for the submit button to leave stop/streaming mode
    await this.page.waitForFunction(
      () => {
        const btn = document.querySelector('[data-testid="website-chat-submit"]');
        return (
          btn &&
          btn.getAttribute("aria-label") === "Send message" &&
          !(btn as HTMLButtonElement).disabled
        );
      },
      { timeout: 30000 }
    );
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
   * Click an option in the Improve Copy panel
   */
  async clickImproveCopyOption(label: string): Promise<void> {
    await this.page.locator(`button:has-text("${label}")`).click();
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

  /**
   * Wait for the preview to reach a specific status
   */
  async waitForPreviewStatus(
    status: "idle" | "booting" | "mounting" | "installing" | "starting" | "ready" | "error",
    timeout: number = 60000
  ): Promise<void> {
    const statusLocator = this.page.getByTestId(`preview-status-${status}`);
    await statusLocator.waitFor({ state: "visible", timeout });
  }

  /**
   * Wait for the preview iframe to be ready (status = ready + iframe visible)
   */
  async waitForPreviewReady(timeout: number = 120000): Promise<void> {
    // Wait for the preview container with iframe to appear (not the loading state)
    await this.previewContainer.waitFor({ state: "visible", timeout });
    await this.previewIframe.waitFor({ state: "visible", timeout });
  }

  /**
   * Check if the preview is showing a loading status
   */
  async isPreviewLoading(): Promise<boolean> {
    return this.previewStatus.isVisible();
  }

  /**
   * Get the preview iframe's src URL
   */
  async getPreviewUrl(): Promise<string | null> {
    const iframe = await this.previewIframe;
    if (await iframe.isVisible()) {
      return iframe.getAttribute("src");
    }
    return null;
  }

  /**
   * Get current preview status text
   */
  async getPreviewStatusText(): Promise<string | null> {
    if (await this.previewStatus.isVisible()) {
      return this.previewStatus.locator("p").textContent();
    }
    return null;
  }

  /**
   * Inject build errors directly into WebContainerManager via page.evaluate().
   * Tests the React pipeline (manager → event → hook → UI render) without
   * requiring a full WebContainer boot + Vite failure cycle.
   */
  async injectBuildErrors(errors: Array<{ type: string; message: string; file?: string }>): Promise<void> {
    await this.page.evaluate((errs) => {
      const manager = (window as any).__WebContainerManager;
      if (!manager) throw new Error("WebContainerManager not exposed on window");
      for (const err of errs) {
        manager.addConsoleError({ ...err, timestamp: new Date(), stack: "" });
      }
    }, errors);
  }

  /**
   * Write a broken file to the running WebContainer to trigger real Vite errors.
   * Requires WebContainer to be booted and Vite running.
   */
  async writeBrokenFileToWebContainer(path: string, content: string): Promise<void> {
    await this.page.evaluate(async ({ path, content }) => {
      const manager = (window as any).__WebContainerManager;
      if (!manager) throw new Error("WebContainerManager not exposed on window");
      const wc = await manager.getInstance();
      await wc.fs.writeFile(path, content);
    }, { path, content });
  }
}
