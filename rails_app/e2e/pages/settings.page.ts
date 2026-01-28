import { type Page, type Locator, expect } from "@playwright/test";

/**
 * Page Object Model for the Settings page.
 * Encapsulates all interactions with the settings/account page.
 */
export class SettingsPage {
  readonly page: Page;

  // Page header
  readonly pageTitle: Locator;

  // Profile section
  readonly profileSection: Locator;
  readonly userEmail: Locator;
  readonly userName: Locator;
  readonly editProfileButton: Locator;
  readonly firstNameInput: Locator;
  readonly lastNameInput: Locator;
  readonly saveProfileButton: Locator;
  readonly cancelEditButton: Locator;

  // Billing & Credits section
  readonly billingSection: Locator;
  readonly creditUsageText: Locator;
  readonly updatePaymentMethodLink: Locator;
  readonly viewBillingHistoryLink: Locator;
  readonly billingHistoryPrevButton: Locator;
  readonly billingHistoryNextButton: Locator;
  readonly billingHistoryPageIndicator: Locator;

  // Subscription section
  readonly subscriptionSection: Locator;
  readonly currentPlanName: Locator;
  readonly changePlanLink: Locator;
  readonly cancelSubscriptionButton: Locator;

  // Cancel subscription modal
  readonly cancelModal: Locator;
  readonly keepSubscriptionButton: Locator;
  readonly confirmCancellationButton: Locator;

  constructor(page: Page) {
    this.page = page;

    // Page header
    this.pageTitle = page.getByText("Account Settings");

    // Profile section
    this.profileSection = page.getByText(/Profile/i).first();
    this.userEmail = page.getByTestId("user-email");
    this.userName = page.getByTestId("user-name");
    this.editProfileButton = page.getByTestId("edit-profile-button");
    this.firstNameInput = page.locator('input[name="user[first_name]"]');
    this.lastNameInput = page.locator('input[name="user[last_name]"]');
    this.saveProfileButton = page.getByRole("button", { name: /Save/i });
    this.cancelEditButton = page.getByRole("button", { name: /Cancel/i });

    // Billing & Credits section
    this.billingSection = page.getByText(/Billing & Credits/i);
    this.creditUsageText = page.getByText(/Credit Usage/i);
    this.updatePaymentMethodLink = page.getByText(/Update Payment Method/i);
    this.viewBillingHistoryLink = page.getByText(/View Billing History/i);
    this.billingHistoryPrevButton = page.getByLabel("Previous page");
    this.billingHistoryNextButton = page.getByLabel("Next page");
    this.billingHistoryPageIndicator = page.getByText(/\d+ \/ \d+/);

    // Subscription section
    this.subscriptionSection = page.getByText(/Subscription/i).first();
    this.currentPlanName = page.getByText(/Current Plan/i);
    this.changePlanLink = page.getByText(/Change Plan/i);
    this.cancelSubscriptionButton = page.getByText(/Cancel Subscription/i);

    // Cancel subscription modal
    this.cancelModal = page.getByText(/remain live until/i);
    this.keepSubscriptionButton = page.getByRole("button", { name: /Keep Subscription/i });
    this.confirmCancellationButton = page.getByText(/Confirm Cancellation/i);
  }

  /**
   * Navigate to the settings page
   */
  async goto(): Promise<void> {
    await this.page.goto("/settings");
    await this.page.waitForLoadState("domcontentloaded");
    await this.pageTitle.waitFor({ state: "visible", timeout: 10000 });
  }

  /**
   * Click the edit profile button to enter edit mode
   */
  async clickEditProfile(): Promise<void> {
    await this.editProfileButton.click();
    await this.firstNameInput.waitFor({ state: "visible", timeout: 5000 });
  }

  /**
   * Update the user's profile name
   * @param firstName - New first name
   * @param lastName - New last name
   */
  async updateProfileName(firstName: string, lastName: string): Promise<void> {
    await this.clickEditProfile();
    await this.firstNameInput.clear();
    await this.firstNameInput.fill(firstName);
    await this.lastNameInput.clear();
    await this.lastNameInput.fill(lastName);
    await this.saveProfileButton.click();
  }

  /**
   * Cancel editing the profile
   */
  async cancelEditProfile(): Promise<void> {
    await this.cancelEditButton.click();
  }

  /**
   * Wait for the profile to be saved and updated name to appear
   * @param expectedName - The full name that should appear after save
   */
  async waitForProfileSaved(expectedName: string): Promise<void> {
    await expect(this.page.getByText(expectedName)).toBeVisible({ timeout: 5000 });
  }

  /**
   * Open the cancel subscription modal
   */
  async openCancelSubscriptionModal(): Promise<void> {
    await this.cancelSubscriptionButton.click();
    await this.cancelModal.waitFor({ state: "visible", timeout: 5000 });
  }

  /**
   * Close the cancel subscription modal by clicking Keep Subscription
   */
  async keepSubscription(): Promise<void> {
    await this.keepSubscriptionButton.click();
    await this.cancelModal.waitFor({ state: "hidden", timeout: 5000 });
  }

  /**
   * Confirm cancellation in the modal
   */
  async confirmCancellation(): Promise<void> {
    await this.confirmCancellationButton.click();
  }

  /**
   * Check if the cancel modal is visible
   */
  async isCancelModalVisible(): Promise<boolean> {
    return await this.cancelModal.isVisible();
  }

  /**
   * Get the displayed user email
   */
  async getUserEmail(): Promise<string | null> {
    // Try data-testid first, fall back to finding email pattern
    const emailElement = this.page.getByTestId("user-email");
    if (await emailElement.isVisible()) {
      return await emailElement.textContent();
    }
    // Fallback: find text that looks like an email
    const emailPattern = this.page.locator("text=/@/").first();
    return await emailPattern.textContent();
  }

  /**
   * Get the displayed user name from the profile section
   */
  async getDisplayedUserName(): Promise<string | null> {
    // Look for the name display in the profile section
    const nameElement = this.page.getByTestId("user-name");
    if (await nameElement.isVisible()) {
      return await nameElement.textContent();
    }
    return null;
  }

  /**
   * Check if the page is displaying the expected email
   * @param email - Email to check for
   */
  async expectEmailVisible(email: string): Promise<void> {
    await expect(this.page.getByText(email)).toBeVisible();
  }

  /**
   * Check if the page has credit usage displayed
   */
  async expectCreditUsageVisible(): Promise<void> {
    await expect(this.creditUsageText).toBeVisible();
    // Should show credits in "X / Y" format
    await expect(this.page.getByText(/\d+[\d,]* \/ [\d,]+/)).toBeVisible();
  }

  /**
   * Check if subscription section shows the plan name
   * @param planName - Expected plan name (e.g., "Growth")
   */
  async expectPlanNameVisible(planName: string): Promise<void> {
    await expect(this.page.getByText(new RegExp(planName, "i"))).toBeVisible();
  }

  /**
   * Check if the three main sections are visible
   */
  async expectAllSectionsVisible(): Promise<void> {
    await expect(this.profileSection).toBeVisible();
    await expect(this.billingSection).toBeVisible();
    await expect(this.subscriptionSection).toBeVisible();
  }

  /**
   * Check if Stripe portal links are visible
   */
  async expectStripeLinksVisible(): Promise<void> {
    await expect(this.updatePaymentMethodLink).toBeVisible();
    await expect(this.viewBillingHistoryLink).toBeVisible();
    await expect(this.changePlanLink).toBeVisible();
  }

  /**
   * Reload the page and wait for it to load
   */
  async reload(): Promise<void> {
    await this.page.reload();
    await this.page.waitForLoadState("domcontentloaded");
    await this.pageTitle.waitFor({ state: "visible", timeout: 10000 });
  }

  /**
   * Check if billing history pagination is visible
   */
  async expectBillingHistoryPaginationVisible(): Promise<void> {
    await expect(this.billingHistoryPrevButton).toBeVisible();
    await expect(this.billingHistoryNextButton).toBeVisible();
    await expect(this.billingHistoryPageIndicator).toBeVisible();
  }

  /**
   * Navigate to next page in billing history
   */
  async goToNextBillingHistoryPage(): Promise<void> {
    await this.billingHistoryNextButton.click();
  }

  /**
   * Navigate to previous page in billing history
   */
  async goToPrevBillingHistoryPage(): Promise<void> {
    await this.billingHistoryPrevButton.click();
  }

  /**
   * Get current billing history page indicator text
   */
  async getBillingHistoryPageText(): Promise<string | null> {
    return await this.billingHistoryPageIndicator.textContent();
  }
}
