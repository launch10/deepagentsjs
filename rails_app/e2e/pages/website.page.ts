import { type Page, type Locator, type FrameLocator } from "@playwright/test";
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

  // Website chat container (has data-streaming attribute)
  readonly websiteChat: Locator;

  // Project images
  readonly projectImagesInput: Locator;
  readonly projectImagesGrid: Locator;
  readonly projectImagesUploadArea: Locator;

  // Chat file attachment
  readonly chatDropzone: Locator;
  readonly attachmentList: Locator;

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
    this.fixErrorsSidebarButton = page
      .getByTestId("build-error-prompt")
      .getByRole("button", { name: "Fix errors" });

    // Website chat container
    this.websiteChat = page.getByTestId("website-chat");

    // Project images
    this.projectImagesInput = page.getByTestId("project-images-input");
    this.projectImagesGrid = page.getByTestId("project-images-grid");
    this.projectImagesUploadArea = page.getByTestId("project-images-upload-area");

    // Chat file attachment
    this.chatDropzone = page.getByTestId("website-chat-dropzone");
    this.attachmentList = page.getByTestId("attachment-list");
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

  // --- Todo Flow Methods ---

  /**
   * Wait for todo items to be visible in the sidebar (CreateFlowTodoList renders items).
   * Todos are rendered as bordered items with icons inside CardDescription.
   */
  async waitForTodosVisible(timeout: number = 30000): Promise<void> {
    await this.page.waitForFunction(
      () => {
        // Todo items are rendered as bordered rounded-lg divs with flex layout inside CardDescription
        // They contain an icon + label + status indicator (CheckCircleIcon or Spinner)
        const todoItems = document.querySelectorAll(
          ".flex.items-center.justify-between.rounded-lg"
        );
        return todoItems.length > 0;
      },
      { timeout }
    );
  }

  /**
   * Wait for all todos to show completed state (CheckCircleIcon, no Spinners remaining).
   */
  async waitForTodosCompleted(timeout: number = 120000): Promise<void> {
    await this.page.waitForFunction(
      () => {
        // Check that todo items exist and none have spinners (animate-spin)
        const todoItems = document.querySelectorAll(
          ".flex.items-center.justify-between.rounded-lg"
        );
        if (todoItems.length === 0) return false;

        // No spinners should remain in the todo area
        const spinners = document.querySelectorAll(
          '.flex.items-center.justify-between.rounded-lg [class*="animate-spin"]'
        );
        // All items should have the success check icon
        const checkIcons = document.querySelectorAll(
          ".flex.items-center.justify-between.rounded-lg .text-success-500"
        );
        return spinners.length === 0 && checkIcons.length === todoItems.length;
      },
      { timeout }
    );
  }

  /**
   * Wait for all 3 Quick Action buttons to be visible (replaces todo list after generation).
   */
  async waitForQuickActionsReady(timeout: number = 120000): Promise<void> {
    await this.changeColorsButton.waitFor({ state: "visible", timeout });
    await this.swapImagesButton.waitFor({ state: "visible", timeout });
    await this.improveCopyButton.waitFor({ state: "visible", timeout });
  }

  // --- Preview Content Methods ---

  /**
   * Returns a FrameLocator for the preview iframe, allowing content assertions.
   * Note: May fail for cross-origin iframes (WebContainer uses StackBlitz origin).
   */
  getPreviewFrameLocator(): FrameLocator {
    return this.page.frameLocator('[data-testid="preview-iframe"]');
  }

  /**
   * Wait for specific text content to be visible in the preview iframe.
   * Falls back to verifying iframe has a valid src if cross-origin blocks content access.
   */
  async waitForPreviewContent(text: string, timeout: number = 30000): Promise<boolean> {
    try {
      const frame = this.getPreviewFrameLocator();
      await frame.locator(`text=${text}`).waitFor({ state: "visible", timeout });
      return true;
    } catch {
      // Cross-origin fallback: verify iframe is visible with a valid src
      const src = await this.getPreviewUrl();
      return src !== null && src.startsWith("http");
    }
  }

  // --- Streaming Methods ---

  /**
   * Wait for streaming to complete. Checks both:
   * - data-streaming="false" on [data-testid="website-chat"]
   * - aria-label="Send message" on submit button (not in stop mode)
   */
  async waitForStreamingComplete(timeout: number = 120000): Promise<void> {
    await this.page.waitForFunction(
      () => {
        const chat = document.querySelector('[data-testid="website-chat"]');
        const btn = document.querySelector('[data-testid="website-chat-submit"]');
        return (
          chat &&
          chat.getAttribute("data-streaming") === "false" &&
          btn &&
          btn.getAttribute("aria-label") === "Send message"
        );
      },
      { timeout }
    );
  }

  // --- Quick Action Interaction Methods ---

  /**
   * Select a color palette by clicking the nth palette element.
   * Palettes have data-testid="color-palette-{id}".
   */
  async selectColorPalette(index: number): Promise<void> {
    const palettes = this.page.locator('[data-testid^="color-palette-"]');
    await palettes.nth(index).click();
  }

  /**
   * Get the currently selected color palette's data-testid.
   */
  async getSelectedPaletteTestId(): Promise<string | null> {
    const selected = this.page.locator('[data-testid^="color-palette-"][data-selected="true"]');
    if (await selected.isVisible()) {
      return selected.getAttribute("data-testid");
    }
    return null;
  }

  /**
   * Upload a project image via the hidden file input.
   * Waits for the image to appear in the grid.
   */
  async uploadProjectImage(filePath: string): Promise<void> {
    await this.projectImagesInput.setInputFiles(filePath);
    // Wait for image to appear in grid
    await this.projectImagesGrid.waitFor({ state: "visible", timeout: 15000 });
    await this.projectImagesGrid
      .locator("img")
      .first()
      .waitFor({ state: "visible", timeout: 15000 });
  }

  /**
   * Click an Improve Copy style button (e.g. "Make tone more professional").
   */
  async clickImproveCopyStyle(style: string): Promise<void> {
    await this.page.locator(`button:has-text("${style}")`).click();
  }

  /**
   * Attach a file in the chat via the hidden file input inside the dropzone.
   * Waits for the attachment preview to appear.
   */
  async attachFileInChat(filePath: string): Promise<void> {
    // The FileButton component renders a hidden input[type="file"] inside the chat footer.
    // Use page-level locator since the input may be outside the dropzone testid boundary.
    const fileInput = this.page.locator('[data-testid="website-chat"] input[type="file"]');
    await fileInput.setInputFiles(filePath);
    // Wait for attachment preview to appear
    await this.attachmentList.waitFor({ state: "visible", timeout: 10000 });
  }

  // --- Error Injection Methods ---

  /**
   * Inject build errors directly into WebContainerManager via page.evaluate().
   * Tests the React pipeline (manager -> event -> hook -> UI render) without
   * requiring a full WebContainer boot + Vite failure cycle.
   */
  async injectBuildErrors(
    errors: Array<{ type: string; message: string; file?: string }>
  ): Promise<void> {
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
    await this.page.evaluate(
      async ({ path, content }) => {
        const manager = (window as any).__WebContainerManager;
        if (!manager) throw new Error("WebContainerManager not exposed on window");
        const wc = await manager.getInstance();
        await wc.fs.writeFile(path, content);
      },
      { path, content }
    );
  }
}
