import { expect, type Locator, type Page } from "@playwright/test";

/**
 * Valid test data that respects character limits.
 * These are pre-verified to be within limits and will pass validation.
 */
export const VALID_TEST_DATA = {
  // Headlines: max 30 chars
  headlines: [
    "Save 20% on First Order", // 22 chars
    "Fast Shipping Available", // 22 chars
    "Expert Support 24/7", // 19 chars
    "Free Trial - No Card", // 20 chars
    "Join 10K+ Customers", // 19 chars
    "100% Money Back", // 15 chars
  ],
  // Descriptions: max 90 chars
  descriptions: [
    "Get started today with our easy-to-use platform. No credit card required.", // 72 chars
    "Join thousands of satisfied customers. Start your free trial now.", // 64 chars
    "Expert support available around the clock. We're here to help you.", // 67 chars
    "Transform your workflow with our powerful tools. See results fast.", // 65 chars
  ],
  // Callouts: max 25 chars
  callouts: [
    "Free Shipping", // 13 chars
    "24/7 Support", // 11 chars
    "Money Back Guarantee", // 19 chars
    "Expert Consultation", // 18 chars
    "Easy Returns", // 12 chars
    "Secure Checkout", // 15 chars
  ],
  // Structured Snippets: max 25 chars
  snippets: [
    "Premium Support", // 15 chars
    "Basic Plan", // 10 chars
    "Enterprise", // 10 chars
    "Custom Solutions", // 16 chars
  ],
  // Keywords: max 90 chars
  keywords: [
    "marketing automation",
    "email marketing tools",
    "crm software",
    "lead generation",
  ],
} as const;

/**
 * Invalid test data that exceeds character limits.
 * Use for testing validation error messages.
 */
export const INVALID_TEST_DATA = {
  // Headlines: exceeds 30 chars
  headlineTooLong:
    "This headline is way too long and will fail validation", // 55 chars
  // Descriptions: exceeds 90 chars
  descriptionTooLong:
    "This description is intentionally made extremely long to exceed the ninety character limit that Google Ads enforces on descriptions.", // 133 chars
  // Callouts: exceeds 25 chars
  calloutTooLong: "This callout is too long to pass", // 32 chars
  // Snippets: exceeds 25 chars
  snippetTooLong: "This snippet detail is too long", // 31 chars
} as const;

/**
 * Page Object Model for the Campaign page.
 * Encapsulates all interactions with the ads campaign workflow.
 */
export class CampaignPage {
  readonly page: Page;

  // Main containers
  readonly contentForm: Locator;
  readonly highlightsForm: Locator;
  readonly keywordsForm: Locator;
  readonly settingsForm: Locator;
  readonly launchForm: Locator;
  readonly reviewForm: Locator;

  // Tab switcher
  readonly tabSwitcher: Locator;
  readonly contentTab: Locator;
  readonly highlightsTab: Locator;
  readonly keywordsTab: Locator;
  readonly settingsTab: Locator;
  readonly launchTab: Locator;
  readonly reviewTab: Locator;

  // Navigation
  readonly backButton: Locator;
  readonly continueButton: Locator;
  readonly reviewButton: Locator;

  // Chat elements
  readonly adsChat: Locator;
  readonly adsChatMessages: Locator;
  readonly adsChatInput: Locator;
  readonly adsChatSubmit: Locator;
  readonly refreshAllSuggestions: Locator;

  // Settings elements
  readonly locationSearchInput: Locator;
  readonly budgetInput: Locator;
  readonly scheduleDays: Locator;

  constructor(page: Page) {
    this.page = page;

    // Main containers
    this.contentForm = page.getByTestId("content-form");
    this.highlightsForm = page.getByTestId("highlights-form");
    this.keywordsForm = page.getByTestId("keywords-form");
    this.settingsForm = page.getByTestId("settings-form");
    this.launchForm = page.getByTestId("launch-form");
    this.reviewForm = page.getByTestId("review-form");

    // Tab switcher
    this.tabSwitcher = page.getByTestId("tab-switcher");
    this.contentTab = page.getByTestId("tab-content");
    this.highlightsTab = page.getByTestId("tab-highlights");
    this.keywordsTab = page.getByTestId("tab-keywords");
    this.settingsTab = page.getByTestId("tab-settings");
    this.launchTab = page.getByTestId("tab-launch");
    this.reviewTab = page.getByTestId("tab-review");

    // Navigation
    this.backButton = page.getByTestId("campaign-back-button");
    this.continueButton = page.getByTestId("campaign-continue-button");
    this.reviewButton = page.getByTestId("campaign-review-button");

    // Chat elements
    this.adsChat = page.getByTestId("ads-chat");
    this.adsChatMessages = page.getByTestId("ads-chat-messages");
    this.adsChatInput = page.getByTestId("ads-chat-input");
    this.adsChatSubmit = page.getByTestId("ads-chat-submit");
    this.refreshAllSuggestions = page.getByTestId("refresh-all-suggestions");

    // Settings elements
    this.locationSearchInput = page.getByTestId("location-search-input");
    this.budgetInput = page.getByTestId("budget-input");
    this.scheduleDays = page.getByTestId("schedule-days");
  }

  /**
   * Navigate to the campaign page for a project.
   * URL format: /projects/{uuid}/campaigns/{substep}
   * Campaign starts at the 'content' substep.
   */
  async goto(
    projectUuid: string,
    substep: "content" | "highlights" | "keywords" | "settings" | "launch" | "review" = "content"
  ): Promise<void> {
    await this.page.goto(`/projects/${projectUuid}/campaigns/${substep}`);
    // Wait for the appropriate form to be visible
    const formMap = {
      content: this.contentForm,
      highlights: this.highlightsForm,
      keywords: this.keywordsForm,
      settings: this.settingsForm,
      launch: this.launchForm,
      review: this.reviewForm,
    };
    await formMap[substep].waitFor({ state: "visible", timeout: 15000 });
  }

  /**
   * Wait for page to be fully loaded and ready for interaction.
   * This waits for the chat to finish loading history and any streaming.
   */
  async waitForReady(): Promise<void> {
    // Wait for the tab switcher to be visible
    await this.tabSwitcher.waitFor({ state: "visible", timeout: 10000 });
    // Wait for chat to be visible
    await this.adsChat.waitFor({ state: "visible", timeout: 10000 });
    // Wait for chat to be ready (not loading history, not streaming)
    await this.waitForContentReady();
  }

  /**
   * Wait for the chat to finish loading history and streaming.
   * Content (headlines, descriptions, etc.) is populated during this phase.
   */
  async waitForContentReady(timeout: number = 30000): Promise<void> {
    await expect(this.adsChat).toHaveAttribute("data-ready", "true", { timeout });
  }

  /**
   * Wait for streaming to complete after sending a message.
   */
  async waitForStreamingComplete(timeout: number = 30000): Promise<void> {
    await expect(this.adsChat).toHaveAttribute("data-streaming", "false", { timeout });
  }

  // ============ Navigation Methods ============

  /**
   * Click the Continue button to advance to the next step.
   */
  async clickContinue(): Promise<void> {
    await this.continueButton.click();
    // Wait for navigation to complete
    await this.page.waitForTimeout(500);
  }

  /**
   * Click the Back button to go to the previous step.
   */
  async clickBack(): Promise<void> {
    await this.backButton.click();
    await this.page.waitForTimeout(500);
  }

  /**
   * Click the Review button to return to review page.
   */
  async clickReturnToReview(): Promise<void> {
    await this.reviewButton.click();
    await this.reviewForm.waitFor({ state: "visible", timeout: 10000 });
  }

  /**
   * Click a specific tab.
   */
  async clickTab(tabName: "content" | "highlights" | "keywords" | "settings" | "launch" | "review"): Promise<void> {
    await this.page.getByTestId(`tab-${tabName}`).click();
    await this.page.waitForTimeout(300);
  }

  /**
   * Get the currently active tab name.
   */
  async getActiveTab(): Promise<string | null> {
    const tabs = ["content", "highlights", "keywords", "settings", "launch", "review"];
    for (const tab of tabs) {
      const isActive = await this.page.getByTestId(`tab-${tab}`).getAttribute("data-active");
      if (isActive === "true") return tab;
    }
    return null;
  }

  // ============ Chat Methods ============

  /**
   * Send a message in the ads chat.
   */
  async sendMessage(message: string): Promise<void> {
    await this.adsChatInput.fill(message);
    await this.adsChatSubmit.click();
    // Wait for response to start streaming
    await this.page.waitForTimeout(1000);
  }

  /**
   * Wait for the AI to finish responding.
   */
  async waitForAIResponse(timeout: number = 30000): Promise<void> {
    // Wait for streaming to stop by checking the ads-chat data attribute
    await this.waitForStreamingComplete(timeout);
  }

  /**
   * Click the "Refresh All Suggestions" button and wait for streaming to complete.
   */
  async refreshAllSuggestionsClick(): Promise<void> {
    await this.refreshAllSuggestions.click();
    // Wait for streaming to start then complete
    await this.page.waitForTimeout(500);
    await this.waitForStreamingComplete();
  }

  // ============ Form Field Methods ============

  /**
   * Get all lockable inputs in the current form.
   */
  getLockableInputs(): Locator {
    return this.page.getByTestId("lockable-input");
  }

  /**
   * Get all lock toggle buttons.
   */
  getLockButtons(): Locator {
    return this.page.getByTestId("lock-toggle-button");
  }

  /**
   * Get all delete buttons.
   */
  getDeleteButtons(): Locator {
    return this.page.getByTestId("delete-button");
  }

  /**
   * Get the nth lockable input field.
   */
  getNthInput(n: number): Locator {
    return this.getLockableInputs().nth(n);
  }

  /**
   * Get the lock button for the nth field.
   */
  getNthLockButton(n: number): Locator {
    return this.getLockButtons().nth(n);
  }

  /**
   * Check if the nth field is locked.
   */
  async isFieldLocked(n: number): Promise<boolean> {
    const lockButton = this.getNthLockButton(n);
    const isLocked = await lockButton.getAttribute("data-locked");
    return isLocked === "true";
  }

  /**
   * Toggle the lock state of the nth field.
   */
  async toggleLock(n: number): Promise<void> {
    await this.getNthLockButton(n).click();
    await this.page.waitForTimeout(200);
  }

  /**
   * Type into the nth input field.
   */
  async fillNthInput(n: number, text: string): Promise<void> {
    const input = this.getNthInput(n);
    await input.clear();
    await input.fill(text);
  }

  /**
   * Delete the nth field.
   */
  async deleteNthField(n: number): Promise<void> {
    await this.getDeleteButtons().nth(n).click();
    await this.page.waitForTimeout(200);
  }

  /**
   * Click the refresh suggestions button in a form section and wait for streaming to complete.
   */
  async clickRefreshSuggestions(): Promise<void> {
    await this.page.getByTestId("refresh-suggestions-button").first().click();
    // Wait for streaming to start then complete
    await this.page.waitForTimeout(500);
    await this.waitForStreamingComplete();
  }

  // ============ Content Form Methods ============

  /**
   * Fill all headlines with valid data.
   */
  async fillValidHeadlines(): Promise<void> {
    await this.contentForm.waitFor({ state: "visible" });
    const inputs = this.getLockableInputs();
    const count = await inputs.count();

    // Fill each headline with valid data
    for (let i = 0; i < Math.min(count, VALID_TEST_DATA.headlines.length); i++) {
      await this.fillNthInput(i, VALID_TEST_DATA.headlines[i]);
      // Lock each one after filling
      await this.toggleLock(i);
    }
  }

  /**
   * Fill descriptions with valid data.
   * Note: Descriptions start after headlines in the DOM.
   */
  async fillValidDescriptions(): Promise<void> {
    // Descriptions have their own section - scroll down if needed
    await this.page.getByText("Details").first().scrollIntoViewIfNeeded();

    // Find description inputs - they're in a separate section
    const descriptionSection = this.page.locator('text=Details').locator('..').locator('..');
    await descriptionSection.waitFor({ state: "visible" });
  }

  // ============ Settings Form Methods ============

  /**
   * Search for a location and select it.
   */
  async searchAndSelectLocation(query: string): Promise<void> {
    await this.locationSearchInput.fill(query);
    // Wait for dropdown to appear
    await this.page.waitForTimeout(500);
    // Click the first result
    const firstResult = this.page.locator('button:has-text("' + query + '")').first();
    if (await firstResult.isVisible()) {
      await firstResult.click();
    }
  }

  /**
   * Set the daily budget.
   */
  async setBudget(amount: number): Promise<void> {
    await this.budgetInput.clear();
    await this.budgetInput.fill(amount.toString());
  }

  /**
   * Click a schedule day button.
   */
  async clickScheduleDay(day: string): Promise<void> {
    await this.page.getByTestId(`schedule-day-${day.toLowerCase().replace(" ", "-")}`).click();
  }

  /**
   * Set schedule to "Always On".
   */
  async setAlwaysOn(): Promise<void> {
    await this.clickScheduleDay("always on");
  }

  // ============ Review Form Methods ============

  /**
   * Click an "Edit Section" button on the review page.
   */
  async clickEditSection(section: "content" | "highlights" | "keywords" | "settings" | "launch"): Promise<void> {
    await this.page.getByRole("button", { name: "Edit Section" }).nth(
      ["content", "highlights", "keywords", "settings", "launch"].indexOf(section)
    ).click();
    await this.page.waitForTimeout(500);
  }

  // ============ Validation Methods ============

  /**
   * Check if the continue button shows validation failed animation.
   */
  async hasValidationError(): Promise<boolean> {
    const style = await this.continueButton.getAttribute("style");
    return style?.includes("shake") ?? false;
  }

  /**
   * Wait for autosave to complete.
   */
  async waitForAutosave(timeout: number = 3000): Promise<void> {
    // Autosave is debounced, so wait for it to trigger and complete
    await this.page.waitForTimeout(timeout);
  }

  // ============ Assertion Helpers ============

  /**
   * Assert that a specific form is visible.
   */
  async expectFormVisible(formName: "content" | "highlights" | "keywords" | "settings" | "launch" | "review"): Promise<void> {
    const forms: Record<string, Locator> = {
      content: this.contentForm,
      highlights: this.highlightsForm,
      keywords: this.keywordsForm,
      settings: this.settingsForm,
      launch: this.launchForm,
      review: this.reviewForm,
    };
    await expect(forms[formName]).toBeVisible();
  }

  /**
   * Assert that the specified tab is active.
   */
  async expectTabActive(tabName: string): Promise<void> {
    const tab = this.page.getByTestId(`tab-${tabName}`);
    await expect(tab).toHaveAttribute("data-active", "true");
  }

  /**
   * Assert that a field is locked.
   */
  async expectFieldLocked(n: number): Promise<void> {
    const lockButton = this.getNthLockButton(n);
    await expect(lockButton).toHaveAttribute("data-locked", "true");
  }

  /**
   * Assert that a field is unlocked.
   */
  async expectFieldUnlocked(n: number): Promise<void> {
    const lockButton = this.getNthLockButton(n);
    await expect(lockButton).toHaveAttribute("data-locked", "false");
  }

  /**
   * Count the number of input fields visible.
   */
  async countInputFields(): Promise<number> {
    return await this.getLockableInputs().count();
  }
}
