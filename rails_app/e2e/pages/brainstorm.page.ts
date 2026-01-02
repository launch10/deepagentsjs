import { type Page, type Locator, expect } from "@playwright/test";
import { e2eConfig } from "../config";

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

  // Command buttons for workflow actions
  readonly buildMySiteButton: Locator;

  // Custom theme elements
  readonly addCustomButton: Locator;
  readonly customColorPicker: Locator;
  readonly customColorDoneButton: Locator;
  readonly colorInputs: Locator;

  constructor(page: Page) {
    this.page = page;

    // Chat input elements - use data-testid for stability
    this.chatInput = page.getByTestId("chat-input");
    // Send button - use data-testid or aria-label
    this.sendButton = page.getByTestId("send-button");

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

    // Command buttons for workflow actions - scope to command buttons container to avoid matching examples panel
    this.buildMySiteButton = page
      .getByTestId("command-buttons")
      .getByRole("button", { name: "Build My Site" });

    // Custom theme elements
    this.addCustomButton = page.getByRole("button", { name: "Add Custom" });
    this.customColorPicker = page.getByTestId("custom-color-picker-inline");
    this.customColorDoneButton = page.getByTestId("custom-color-done-btn");
    this.colorInputs = page.locator('input[aria-label="Hex color value"]');
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
  async waitForResponse(timeout: number = e2eConfig.timeouts.aiResponse): Promise<void> {
    // Race condition handling: the response might come back so fast that
    // the thinking indicator is never visible, or is already gone.
    // Wait for EITHER: thinking indicator to appear, OR an AI message to exist.
    const thinkingOrMessage = await Promise.race([
      this.thinkingIndicator.waitFor({ state: "visible", timeout: 5000 }).then(() => "thinking"),
      this.aiMessages
        .first()
        .waitFor({ state: "visible", timeout: 5000 })
        .then(() => "message"),
    ]).catch(() => "timeout");

    // If thinking indicator appeared, wait for it to disappear
    if (thinkingOrMessage === "thinking") {
      await this.thinkingIndicator.waitFor({ state: "hidden", timeout });
    }
    // If message already appeared or we timed out, just ensure thinking is done
    else {
      await this.thinkingIndicator.waitFor({ state: "hidden", timeout: 1000 }).catch(() => {});
    }
  }

  /**
   * Get the last AI message content
   */
  async getLastAIMessage(): Promise<string> {
    const messages = await this.aiMessages.all();
    if (messages.length === 0) {
      return "";
    }
    return (await messages[messages.length - 1].textContent()) || "";
  }

  /**
   * Get the last user message content
   */
  async getLastUserMessage(): Promise<string> {
    const messages = await this.userMessages.all();
    if (messages.length === 0) {
      return "";
    }
    return (await messages[messages.length - 1].textContent()) || "";
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
    await expect(this.page.locator(`text=${text}`).first()).toBeVisible({ timeout: 30000 });
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
    // First, wait a moment for any auto-open to trigger
    await this.page.waitForTimeout(100);

    const isExpanded = await this.isBrandPanelExpanded();
    if (!isExpanded) {
      await this.brandPersonalizationToggle.click();
    }
    // Always wait for content to be visible (handles both cases)
    await this.brandPersonalizationContent.waitFor({ state: "visible", timeout: 5000 });
  }

  /**
   * Open the brand panel and wait for uploads API to complete.
   * Use this after page reload or navigation to ensure uploads are loaded.
   */
  async openBrandPanelAndWaitForUploads(): Promise<void> {
    // Wait a moment for any auto-open to trigger
    await this.page.waitForTimeout(100);

    const isExpanded = await this.isBrandPanelExpanded();
    if (isExpanded) {
      // Panel already open, just wait for uploads
      await this.waitForUploadsLoaded();
      return;
    }

    // Set up response waiter BEFORE opening the panel (which triggers the API call)
    const uploadsPromise = this.page.waitForResponse(
      (response) =>
        response.url().includes("/api/v1/uploads") &&
        response.request().method() === "GET" &&
        response.status() === 200,
      { timeout: 10000 }
    );

    // Open the panel
    await this.brandPersonalizationToggle.click();
    await this.brandPersonalizationContent.waitFor({ state: "visible", timeout: 5000 });

    // Wait for uploads to complete
    await uploadsPromise;
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
    const expectedCount = filePaths.length;

    await this.projectImagesInput.setInputFiles(filePaths);

    // Wait for the grid to appear
    await this.projectImagesGrid.waitFor({ state: "visible", timeout: 10000 });

    // Wait for all images to actually appear in the grid (not just loading placeholders)
    await this.page.waitForFunction(
      (count) => {
        const grid = document.querySelector('[data-testid="project-images-grid"]');
        if (!grid) return false;
        const images = grid.querySelectorAll("img");
        return images.length >= count;
      },
      expectedCount,
      { timeout: 15000 }
    );
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

  /**
   * Click the "Build My Site" command button
   * This triggers the finished command which redirects to website builder
   */
  async clickBuildMySite(): Promise<void> {
    await this.buildMySiteButton.click();
  }

  /**
   * Wait for navigation to the website page
   * @param threadId - The project thread ID
   */
  async waitForWebsiteRedirect(threadId: string): Promise<void> {
    await this.page.waitForURL(`**/projects/${threadId}/website`, {
      timeout: e2eConfig.timeouts.navigation,
    });
  }

  /**
   * Open the custom color picker by clicking "Add Custom"
   */
  async openCustomColorPicker(): Promise<void> {
    await this.addCustomButton.click();
    await this.customColorPicker.waitFor({ state: "visible", timeout: 5000 });
  }

  /**
   * Set a custom color at the specified index (0-4)
   * @param index - The color slot index (0-4)
   * @param hexColor - The hex color without # prefix (e.g., "FF5733")
   */
  async setCustomColor(index: number, hexColor: string): Promise<void> {
    const colorInput = this.colorInputs.nth(index);
    await colorInput.clear();
    await colorInput.fill(hexColor);
  }

  /**
   * Save the custom color palette by clicking "Done"
   */
  async saveCustomPalette(): Promise<void> {
    await this.customColorDoneButton.click();
    // Wait for the custom picker to close and palettes to reload
    await this.customColorPicker.waitFor({ state: "hidden", timeout: 10000 });
  }

  /**
   * Create a custom theme with the specified colors
   * @param colors - Array of hex colors without # prefix (e.g., ["FF5733", "33FF57", ...])
   */
  async createCustomTheme(colors: string[]): Promise<void> {
    await this.openCustomColorPicker();

    // Set each color
    for (let i = 0; i < Math.min(colors.length, 5); i++) {
      await this.setCustomColor(i, colors[i]);
    }

    await this.saveCustomPalette();
  }

  /**
   * Check if the currently selected palette contains the specified colors
   * @param colors - Array of hex colors to look for (without # prefix, e.g., "FF5733")
   * @returns true if the selected palette contains these colors
   */
  async hasCustomThemeWithColors(colors: string[]): Promise<boolean> {
    // Find the selected palette
    const selectedPalette = this.page.locator('[data-testid^="color-palette-"][data-selected="true"]');
    const isVisible = await selectedPalette.isVisible();
    if (!isVisible) {
      return false;
    }

    // Get all color divs in the selected palette
    const colorDivs = selectedPalette.locator("div[style*='background-color']");
    const divCount = await colorDivs.count();

    // Extract RGB values from the style attributes
    const paletteRgbColors: string[] = [];
    for (let i = 0; i < divCount; i++) {
      const style = await colorDivs.nth(i).getAttribute("style");
      if (style) {
        paletteRgbColors.push(style.toLowerCase());
      }
    }

    // Convert input hex colors to RGB for comparison
    const hexToRgb = (hex: string): string => {
      const r = parseInt(hex.substring(0, 2), 16);
      const g = parseInt(hex.substring(2, 4), 16);
      const b = parseInt(hex.substring(4, 6), 16);
      return `rgb(${r}, ${g}, ${b})`;
    };

    // Check if all input colors are found in the palette
    const inputRgbColors = colors.map(c => hexToRgb(c.replace("#", "").toUpperCase()));

    return inputRgbColors.every(inputRgb =>
      paletteRgbColors.some(paletteStyle => paletteStyle.includes(inputRgb))
    );
  }

  /**
   * Get the count of color palettes currently displayed
   */
  async getColorPaletteCount(): Promise<number> {
    const palettes = this.page.locator('[data-testid^="color-palette-"]');
    return await palettes.count();
  }

  /**
   * Check if the first palette (most recently created custom theme) is selected
   */
  async isFirstPaletteSelected(): Promise<boolean> {
    const firstPalette = this.page.locator('[data-testid^="color-palette-"]').first();
    const selected = await firstPalette.getAttribute("data-selected");
    return selected === "true";
  }

  /**
   * Wait for themes API to complete loading
   */
  async waitForThemesLoaded(): Promise<void> {
    await this.page.waitForResponse(
      (response) =>
        response.url().includes("/api/v1/themes") &&
        response.request().method() === "GET" &&
        response.status() === 200,
      { timeout: 10000 }
    );
  }
}
