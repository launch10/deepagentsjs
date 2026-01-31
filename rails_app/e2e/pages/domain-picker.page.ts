import { type Page, type Locator, expect } from "@playwright/test";

/**
 * Page Object Model for the Domain Picker page.
 * Encapsulates all interactions with the domain picker interface.
 */
export class DomainPickerPage {
  readonly page: Page;

  // Container
  readonly container: Locator;
  readonly loadingSkeleton: Locator;

  // Header
  readonly header: Locator;
  readonly description: Locator;

  // Tab switcher
  readonly tabsList: Locator;
  readonly launch10Tab: Locator;
  readonly customDomainTab: Locator;

  // Launch10 Site Picker
  readonly siteNameDropdown: Locator;
  readonly pageNameInput: Locator;
  readonly existingSitesSection: Locator;
  readonly createNewSiteSection: Locator;

  // Custom Domain Picker
  readonly customDomainInput: Locator;
  readonly cnameInstructions: Locator;

  // Full URL Preview
  readonly fullUrlPreview: Locator;
  readonly urlPreviewText: Locator;

  // Navigation
  readonly previousStepButton: Locator;
  readonly previewButton: Locator;
  readonly continueButton: Locator;

  constructor(page: Page) {
    this.page = page;

    // Container
    this.container = page
      .locator('[data-testid="domain-picker"]')
      .or(page.locator('text="Website Setup"').locator("..").locator(".."));
    this.loadingSkeleton = page.getByTestId("domain-picker-loading");

    // Header
    this.header = page.locator('text="Website Setup"');
    this.description = page.locator('text="Choose where your landing page will live"');

    // Tab switcher
    this.tabsList = page.locator('[role="tablist"]');
    this.launch10Tab = page.locator('button:has-text("Launch10 Site")');
    this.customDomainTab = page.locator('button:has-text("Custom Domain")');

    // Launch10 Site Picker components
    this.siteNameDropdown = page
      .locator('[data-testid="site-name-dropdown"]')
      .or(page.locator('text="Your site name"').locator("..").locator("input, select, button"));
    this.pageNameInput = page
      .locator('[data-testid="page-name-input"]')
      .or(page.locator('text="Page name"').locator("..").locator("input"));
    this.existingSitesSection = page.locator('text="Your Existing Sites"');
    this.createNewSiteSection = page.locator('text="Create New Site"');

    // Custom Domain Picker
    this.customDomainInput = page
      .locator('[data-testid="custom-domain-input"]')
      .or(page.locator('[placeholder*="yourdomain.com"]'));
    this.cnameInstructions = page.locator('text="CNAME"').locator("..");

    // Full URL Preview
    this.fullUrlPreview = page
      .locator('[data-testid="full-url-preview"]')
      .or(page.locator('text="Your URL will be"').locator(".."));
    this.urlPreviewText = page.locator('[data-testid="url-preview-text"]');

    // Navigation buttons
    this.previousStepButton = page.locator('button:has-text("Previous Step")');
    this.previewButton = page.locator('button:has-text("Preview")');
    this.continueButton = page.locator('button:has-text("Continue")');
  }

  /**
   * Navigate to a project's domain picker page
   */
  async goto(projectUuid: string): Promise<void> {
    await this.page.goto(`/projects/${projectUuid}/website/domain`);
  }

  /**
   * Wait for the domain picker to finish loading
   */
  async waitForLoaded(timeout: number = 30000): Promise<void> {
    // Wait for loading skeleton to disappear
    await this.loadingSkeleton.waitFor({ state: "hidden", timeout }).catch(() => {
      // Loading skeleton might not appear if data loads fast
    });
    // Wait for header to be visible
    await this.header.waitFor({ state: "visible", timeout });
  }

  /**
   * Check if the domain picker is showing loading state
   */
  async isLoading(): Promise<boolean> {
    return this.loadingSkeleton.isVisible();
  }

  /**
   * Switch to Launch10 Site tab
   */
  async selectLaunch10Tab(): Promise<void> {
    await this.launch10Tab.click();
  }

  /**
   * Switch to Custom Domain tab
   */
  async selectCustomDomainTab(): Promise<void> {
    await this.customDomainTab.click();
  }

  /**
   * Get the currently active tab
   */
  async getActiveTab(): Promise<"launch10" | "custom"> {
    const launch10Active = await this.launch10Tab.getAttribute("data-state");
    return launch10Active === "active" ? "launch10" : "custom";
  }

  /**
   * Select an existing domain from the dropdown
   */
  async selectExistingDomain(domainName: string): Promise<void> {
    await this.siteNameDropdown.click();
    await this.page.locator(`text="${domainName}"`).click();
  }

  /**
   * Enter a custom subdomain in the site name input
   */
  async enterSubdomain(subdomain: string): Promise<void> {
    await this.siteNameDropdown.click();
    // Look for a "type your own" option or input field
    const typeOwnInput = this.page
      .locator('[placeholder*="type"]')
      .or(this.page.locator('input[type="text"]').first());
    await typeOwnInput.fill(subdomain);
  }

  /**
   * Enter a path in the page name input
   */
  async enterPageName(path: string): Promise<void> {
    await this.pageNameInput.fill(path);
  }

  /**
   * Enter a custom domain
   */
  async enterCustomDomain(domain: string): Promise<void> {
    await this.customDomainInput.fill(domain);
  }

  /**
   * Get the full URL preview text
   */
  async getFullUrlPreview(): Promise<string | null> {
    if (await this.fullUrlPreview.isVisible()) {
      return this.urlPreviewText.textContent();
    }
    return null;
  }

  /**
   * Click continue button
   */
  async clickContinue(): Promise<void> {
    await this.continueButton.click();
  }

  /**
   * Click previous step button
   */
  async clickPreviousStep(): Promise<void> {
    await this.previousStepButton.click();
  }

  /**
   * Assert that the domain picker loaded successfully
   */
  async expectLoaded(): Promise<void> {
    await expect(this.header).toBeVisible({ timeout: 30000 });
    await expect(this.loadingSkeleton).not.toBeVisible();
  }

  /**
   * Assert that existing domains are displayed
   */
  async expectExistingDomainsVisible(): Promise<void> {
    await expect(this.existingSitesSection).toBeVisible({ timeout: 10000 });
  }

  /**
   * Assert that the URL preview is showing the expected URL
   */
  async expectUrlPreview(expectedUrl: string): Promise<void> {
    await expect(this.fullUrlPreview).toBeVisible();
    await expect(this.fullUrlPreview).toContainText(expectedUrl);
  }

  /**
   * Assert that CNAME instructions are visible (custom domain mode)
   */
  async expectCnameInstructionsVisible(): Promise<void> {
    await expect(this.cnameInstructions).toBeVisible({ timeout: 5000 });
  }
}
