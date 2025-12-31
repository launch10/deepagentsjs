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

  // Brand Personalization Panel elements
  readonly brandPersonalizationPanel: Locator;
  readonly brandPersonalizationToggle: Locator;
  readonly brandPersonalizationContent: Locator;

  // Upload elements
  readonly logoUploadArea: Locator;
  readonly logoPreview: Locator;
  readonly logoFileInput: Locator;
  readonly projectImagesInput: Locator;
  readonly projectImagesGrid: Locator;
  readonly projectImagesUploadArea: Locator;

  // Chat attachment elements (inline uploads)
  readonly chatFileInput: Locator;
  readonly chatAttachmentList: Locator;
  readonly chatAttachmentItems: Locator;

  constructor(page: Page) {
    this.page = page;

    // Chat input elements - use data-testid for stability
    this.chatInput = page.getByTestId('chat-input');
    // Send button - use data-testid or aria-label
    this.sendButton = page.getByTestId('send-button');

    // Message list - using data-testid for stability
    this.messageList = page.getByTestId("message-list");
    this.userMessages = page.getByTestId("user-message");
    this.aiMessages = page.getByTestId("ai-message");

    // Thinking/loading indicator
    this.thinkingIndicator = page.getByTestId("thinking-indicator");

    // Command buttons
    this.commandButtons = page.getByTestId("command-buttons");

    // Social links section
    this.socialLinksSection = page.getByTestId("social-links");

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
    // Use data-testid with data-expanded for proper visibility check
    this.examplesPanel = page.getByTestId("examples-panel");
    this.howItWorksPanel = page.getByTestId("how-it-works-panel");

    // Brand Personalization Panel elements
    this.brandPersonalizationPanel = page.getByTestId("brand-personalization-panel");
    this.brandPersonalizationToggle = page.getByTestId("brand-personalization-toggle");
    this.brandPersonalizationContent = page.getByTestId("brand-personalization-content");

    // Upload elements
    this.logoUploadArea = page.getByTestId("logo-upload-area");
    this.logoPreview = page.getByTestId("logo-preview");
    this.logoFileInput = page.getByTestId("logo-file-input");
    this.projectImagesInput = page.getByTestId("project-images-input");
    this.projectImagesGrid = page.getByTestId("project-images-grid");
    this.projectImagesUploadArea = page.getByTestId("project-images-upload-area");

    // Chat attachment elements - the file input in the chat input area
    this.chatFileInput = page.locator('input[type="file"]').first();
    this.chatAttachmentList = page.getByTestId("attachment-list");
    this.chatAttachmentItems = page.getByTestId("attachment-item");
  }

  /**
   * Navigate to the brainstorm page (new conversation)
   * The root route when logged in is projects#new which shows the brainstorm interface
   */
  async goto(): Promise<void> {
    await this.page.goto("/");
    // Wait for chat input to be ready instead of networkidle (Vite HMR keeps websocket active)
    await this.chatInput.waitFor({ state: "visible", timeout: 10000 });
  }

  /**
   * Navigate to /projects/new (explicit new project route)
   */
  async gotoNew(): Promise<void> {
    await this.page.goto("/projects/new");
    await this.chatInput.waitFor({ state: "visible", timeout: 10000 });
  }

  /**
   * Navigate to an existing brainstorm conversation
   */
  async gotoConversation(threadId: string): Promise<void> {
    await this.page.goto(`/projects/${threadId}/brainstorm`);
    await this.chatInput.waitFor({ state: "visible", timeout: 10000 });
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

  /**
   * Check if the examples panel is expanded
   */
  async isExamplesPanelExpanded(): Promise<boolean> {
    const expanded = await this.examplesPanel.getAttribute("data-expanded");
    return expanded === "true";
  }

  /**
   * Check if the how it works panel is expanded
   */
  async isHowItWorksPanelExpanded(): Promise<boolean> {
    const expanded = await this.howItWorksPanel.getAttribute("data-expanded");
    return expanded === "true";
  }

  /**
   * Check if the brand personalization panel is expanded
   */
  async isBrandPanelExpanded(): Promise<boolean> {
    const expanded = await this.brandPersonalizationToggle.getAttribute("aria-expanded");
    return expanded === "true";
  }

  /**
   * Open the brand personalization panel if it's not already open
   */
  async openBrandPanel(): Promise<void> {
    const isExpanded = await this.isBrandPanelExpanded();
    if (!isExpanded) {
      await this.brandPersonalizationToggle.click();
      await this.brandPersonalizationContent.waitFor({ state: "visible" });
    }
  }

  /**
   * Close the brand personalization panel if it's open
   */
  async closeBrandPanel(): Promise<void> {
    const isExpanded = await this.isBrandPanelExpanded();
    if (isExpanded) {
      await this.brandPersonalizationToggle.click();
      await this.brandPersonalizationContent.waitFor({ state: "hidden" });
    }
  }

  /**
   * Select a color palette by index (0-based) on the current page
   */
  async selectColorPalette(index: number = 0): Promise<void> {
    const palettes = this.page.locator('[data-testid^="color-palette-"]');
    await palettes.nth(index).click();
  }

  /**
   * Upload a logo image via the file input
   * @param filePath - Path to the image file to upload
   */
  async uploadLogo(filePath: string): Promise<void> {
    // Set the file on the hidden input
    await this.logoFileInput.setInputFiles(filePath);
    // Wait for the upload to complete and preview to appear
    await this.logoPreview.waitFor({ state: "visible", timeout: 10000 });
  }

  /**
   * Upload project images via the file input
   * @param filePaths - Array of paths to the image files to upload
   */
  async uploadProjectImages(filePaths: string[]): Promise<void> {
    await this.projectImagesInput.setInputFiles(filePaths);
    // Wait for the grid to appear (indicates at least one image uploaded)
    await this.projectImagesGrid.waitFor({ state: "visible", timeout: 10000 });
  }

  /**
   * Check if logo preview is visible
   */
  async isLogoPreviewVisible(): Promise<boolean> {
    return await this.logoPreview.isVisible();
  }

  /**
   * Check if logo upload area (empty state) is visible
   */
  async isLogoUploadAreaVisible(): Promise<boolean> {
    return await this.logoUploadArea.isVisible();
  }

  /**
   * Get the count of project images in the grid
   */
  async getProjectImageCount(): Promise<number> {
    const images = this.projectImagesGrid.locator("img");
    return await images.count();
  }

  /**
   * Get the logo image src from the preview
   */
  async getLogoSrc(): Promise<string | null> {
    const img = this.logoPreview.locator("img");
    return await img.getAttribute("src");
  }

  /**
   * Wait for uploads API to complete (monitors network requests)
   */
  async waitForUploadsLoaded(): Promise<void> {
    // Wait for any uploads API call to complete
    await this.page.waitForResponse(
      (response) =>
        response.url().includes("/api/v1/uploads") &&
        response.request().method() === "GET" &&
        response.status() === 200,
      { timeout: 10000 }
    );
  }

  /**
   * Add a file attachment to the chat input (inline upload)
   * @param filePath - Path to the file to attach
   */
  async addChatAttachment(filePath: string): Promise<void> {
    await this.chatFileInput.setInputFiles(filePath);
  }

  /**
   * Add multiple file attachments to the chat input
   * @param filePaths - Array of file paths to attach
   */
  async addChatAttachments(filePaths: string[]): Promise<void> {
    await this.chatFileInput.setInputFiles(filePaths);
  }

  /**
   * Get the count of chat attachments currently shown
   */
  async getChatAttachmentCount(): Promise<number> {
    return await this.chatAttachmentItems.count();
  }

  /**
   * Wait for all chat attachments to finish uploading
   * Checks that no attachments have "uploading" status
   */
  async waitForChatAttachmentsUploaded(): Promise<void> {
    // Wait for uploading indicators to disappear
    await this.page.waitForFunction(
      () => {
        const uploadingItems = document.querySelectorAll('[data-status="uploading"]');
        return uploadingItems.length === 0;
      },
      { timeout: 15000 }
    );
  }

  /**
   * Check if the send button is enabled
   */
  async isSendButtonEnabled(): Promise<boolean> {
    return await this.sendButton.isEnabled();
  }

  /**
   * Send a message with attachments (fills input and clicks send)
   * @param message - Optional message text (can be empty if attachments present)
   */
  async sendMessageWithAttachments(message: string = ""): Promise<void> {
    if (message) {
      await this.chatInput.fill(message);
    }
    await this.sendButton.click();
  }

  /**
   * Check if an image is displayed in a user message
   * Returns the count of images in user messages
   */
  async getUserMessageImageCount(): Promise<number> {
    const userMessages = await this.userMessages.all();
    let imageCount = 0;
    for (const message of userMessages) {
      const images = await message.locator("img").count();
      imageCount += images;
    }
    return imageCount;
  }
}
