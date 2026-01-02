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
   * Get lockable inputs for a specific field type by name attribute.
   * Field names follow the pattern: headlines.0.text, descriptions.0.text, etc.
   */
  getInputsByFieldName(fieldName: "headlines" | "descriptions" | "callouts" | "details"): Locator {
    return this.page.locator(`[data-testid="lockable-input"][name^="${fieldName}."]`);
  }

  /**
   * Get the lock button for a specific field type and index.
   */
  getLockButtonForField(fieldName: "headlines" | "descriptions" | "callouts" | "details", index: number): Locator {
    // Structure: div.flex > [Button(lock), Button(delete), InputGroup > input]
    // So from input, go up to InputGroup, then find preceding-sibling lock button
    const input = this.getInputsByFieldName(fieldName).nth(index);
    return input.locator("xpath=ancestor::*[@data-testid='lockable-input-group']/preceding-sibling::button[@data-testid='lock-toggle-button']");
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

  // ============ Step Completion Helpers ============
  // These helpers fill and lock the required fields for each step.
  // Use these to properly complete a step before calling clickContinue().

  /**
   * Fill and lock a specific field type with valid test data.
   * @param fieldName - The field type to fill (headlines, descriptions, callouts, details)
   * @param testData - Array of valid test data strings
   * @param minCount - Minimum number of fields to fill (default: 3)
   */
  async fillAndLockFieldType(
    fieldName: "headlines" | "descriptions" | "callouts" | "details",
    testData: readonly string[],
    minCount: number = 3
  ): Promise<void> {
    const inputs = this.getInputsByFieldName(fieldName);
    const count = await inputs.count();
    const fillCount = Math.min(count, minCount, testData.length);

    for (let i = 0; i < fillCount; i++) {
      const input = inputs.nth(i);
      await input.clear();
      await input.fill(testData[i]);
      // Find the lock button for this input
      // Structure: div.flex > [Button(lock), Button(delete), InputGroup > input]
      // So from input, go up to InputGroup, then find preceding-sibling lock button
      const lockButton = input.locator("xpath=ancestor::*[@data-testid='lockable-input-group']/preceding-sibling::button[@data-testid='lock-toggle-button']");
      await lockButton.click();
      await this.page.waitForTimeout(100);
    }
  }

  /**
   * Complete the content step by filling headlines and descriptions.
   * Requires: At least 3 headlines (max 30 chars) and 2 descriptions (max 90 chars).
   */
  async completeContentStep(): Promise<void> {
    await this.contentForm.waitFor({ state: "visible" });
    await this.page.waitForTimeout(1000); // Wait for inputs to render

    // Fill headlines (need at least 3, max 30 chars each)
    await this.fillAndLockFieldType("headlines", VALID_TEST_DATA.headlines, 3);

    // Fill descriptions (need at least 2, max 90 chars each)
    await this.fillAndLockFieldType("descriptions", VALID_TEST_DATA.descriptions, 2);
  }

  /**
   * Complete the highlights step by filling callouts and structured snippet details.
   * Requires: At least 4 callouts (max 25 chars) and 3 snippet details (max 25 chars).
   */
  async completeHighlightsStep(): Promise<void> {
    await this.highlightsForm.waitFor({ state: "visible" });
    await this.page.waitForTimeout(1000); // Wait for inputs to render

    // Fill callouts (need at least 4, max 25 chars each)
    await this.fillAndLockFieldType("callouts", VALID_TEST_DATA.callouts, 4);

    // Fill structured snippet details (need at least 3, max 25 chars each)
    await this.fillAndLockFieldType("details", VALID_TEST_DATA.snippets, 3);
  }

  /**
   * Complete the settings step by configuring location, schedule, and budget.
   */
  async completeSettingsStep(): Promise<void> {
    await this.settingsForm.waitFor({ state: "visible" });

    // Set schedule to "Always On" (simplest valid option)
    await this.setAlwaysOn();

    // Set a valid budget
    await this.setBudget(25);
  }

  /**
   * Complete all steps from content to review.
   * Useful for tests that need to be on a later step.
   */
  async completeAllStepsToReview(): Promise<void> {
    // Content step
    await this.completeContentStep();
    await this.clickContinue();
    await this.page.waitForTimeout(1000);

    // Highlights step
    await this.completeHighlightsStep();
    await this.clickContinue();
    await this.page.waitForTimeout(1000);

    // Keywords step (no required fields to fill)
    await this.clickContinue();
    await this.page.waitForTimeout(1000);

    // Settings step
    await this.completeSettingsStep();
    await this.clickContinue();
    await this.page.waitForTimeout(1000);

    // Launch step (no required fields to fill)
    await this.clickContinue();
    await this.page.waitForTimeout(1000);

    // Now on review step
    await this.expectFormVisible("review");
  }

  // ============ Content Form Methods ============

  /**
   * Fill all headlines with valid data.
   * @deprecated Use completeContentStep() instead for proper step completion.
   */
  async fillValidHeadlines(): Promise<void> {
    await this.fillAndLockFieldType("headlines", VALID_TEST_DATA.headlines, 3);
  }

  /**
   * Fill descriptions with valid data.
   * @deprecated Use completeContentStep() instead for proper step completion.
   */
  async fillValidDescriptions(): Promise<void> {
    await this.fillAndLockFieldType("descriptions", VALID_TEST_DATA.descriptions, 2);
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
